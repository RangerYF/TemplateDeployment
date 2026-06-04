/**
 * thinFilmSolver.ts
 * Pure physics solver and Canvas renderers for thin-film interference.
 * No window references, no React — pure math and drawing functions.
 */

import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import type { ThinFilmSettings, FilmKind, WedgeProfile } from '@/data/thinFilmData';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

export function fmt(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

// ---------------------------------------------------------------------------
// RGB helpers
// ---------------------------------------------------------------------------

export interface RGB {
  r: number;
  g: number;
  b: number;
}

/** Parse "rgb(R,G,B)" into components. Returns null on failure. */
export function parseRGB(color: string): RGB | null {
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  if (!m) return null;
  return { r: +m[1], g: +m[2], b: +m[3] };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** White-light RGB sample wavelengths and their tint colors for soap bubble. */
export const SOAP_SAMPLES: readonly [number, string][] = [
  [650, '#ff5a36'],
  [532, '#45d483'],
  [470, '#4a8dff'],
] as const;

// ---------------------------------------------------------------------------
// Core physics
// ---------------------------------------------------------------------------

/**
 * Thin-film interference intensity at a given thickness (in metres).
 * Includes the π phase shift from half-wave loss at one surface.
 *
 *   phi = 2π(2nt)/λ + π
 *   I = cos²(phi/2)
 */
export function soapIntensityAtThickness(t_m: number, wl_m: number, n: number): number {
  const phi = 2 * Math.PI * (2 * n * t_m) / wl_m + Math.PI;
  return Math.pow(Math.cos(phi / 2), 2);
}

/**
 * Air-gap thickness at radial distance r from centre for Newton's rings.
 *   t = r² / (2R)
 */
export function newtonThicknessAtR(r_m: number, lensR: number): number {
  return (r_m * r_m) / (2 * lensR);
}

/**
 * Wedge angle in radians (input is arc-minutes).
 */
export function wedgeAngleRad(angleMin: number): number {
  return angleMin * Math.PI / 180 / 60;
}

/**
 * Wedge film thickness at position x (metres) for a given profile.
 */
export function wedgeProfileThickness(
  x_m: number,
  angleMin: number,
  profile: WedgeProfile = 'linear',
): number {
  const base = Math.max(0, x_m) * Math.tan(wedgeAngleRad(angleMin));
  const u = clamp(x_m / 0.030, 0, 1);
  const curvature = Math.tan(wedgeAngleRad(angleMin)) * 0.030;
  if (profile === 'convex') return base + 1.8 * curvature * u * u;
  if (profile === 'concave') return Math.max(0, base + 1.8 * curvature * (2 * u - u * u));
  return base;
}

// ---------------------------------------------------------------------------
// Derived intensity helpers
// ---------------------------------------------------------------------------

/** Newton's rings intensity at radial distance r. */
export function ringsIntensityAtR(
  r_m: number,
  lensR: number,
  wavelengthM: number,
  filmN: number,
): number {
  const t = newtonThicknessAtR(r_m, lensR);
  return soapIntensityAtThickness(t, wavelengthM, filmN);
}

/** Wedge film intensity at position x. */
export function wedgeIntensityAtX(
  x_m: number,
  wedgeAngle: number,
  wedgeProfile: WedgeProfile,
  wavelengthM: number,
  filmN: number,
): number {
  const t = wedgeProfileThickness(x_m, wedgeAngle, wedgeProfile);
  return soapIntensityAtThickness(t, wavelengthM, filmN);
}

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

export interface ThinFilmMetrics {
  filmType: FilmKind;

  // Newton's rings
  r1: number;          // first dark ring radius (m)
  r5: number;          // fifth dark ring radius (m)
  sampleR: number;     // sample point radial distance (m)
  sampleT: number;     // sample point air-gap thickness (m)
  sampleI: number;     // sample point intensity [0,1]

  // Wedge
  fringeSpacing: number; // fringe spacing (m)

  // Soap
  opticalPathDiff: number; // 2 * n * t (nm)

  // Common
  wavelength: number;  // wavelength (nm)
  filmN: number;
}

export function computeThinFilmMetrics(settings: ThinFilmSettings): ThinFilmMetrics {
  const lam = settings.wavelength * 1e-9;
  const { filmType, filmN, lensR, wedgeAngle, thickness, newtonSampleRatio } = settings;

  // Newton's rings
  const rMax = Math.sqrt(8 * lam * lensR / filmN);
  const sampleR = newtonSampleRatio * rMax;
  const sampleT = newtonThicknessAtR(sampleR, lensR);
  const sampleI = soapIntensityAtThickness(sampleT, lam, filmN);
  const r1 = Math.sqrt(1 * lam * lensR / filmN);
  const r5 = Math.sqrt(5 * lam * lensR / filmN);

  // Wedge
  const dx = lam / (2 * filmN * Math.max(Math.tan(wedgeAngleRad(wedgeAngle)), 1e-7));

  // Soap
  const opticalPathDiff = 2 * filmN * thickness; // in nm (thickness already nm)

  return {
    filmType,
    r1,
    r5,
    sampleR,
    sampleT,
    sampleI,
    fringeSpacing: dx,
    opticalPathDiff,
    wavelength: settings.wavelength,
    filmN,
  };
}

// ---------------------------------------------------------------------------
// Canvas helper: size from parent
// ---------------------------------------------------------------------------

function getCanvasSize(canvas: HTMLCanvasElement): { width: number; height: number } | null {
  const parent = canvas.parentElement;
  if (!parent) return null;
  const width = Math.floor(parent.clientWidth);
  const height = Math.floor(parent.clientHeight);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return { width, height };
}

// ---------------------------------------------------------------------------
// Canvas helper: putImageData with cover
// ---------------------------------------------------------------------------

function putImageDataCover(
  ctx: CanvasRenderingContext2D,
  img: ImageData,
  width: number,
  height: number,
): void {
  const bitmap = document.createElement('canvas');
  bitmap.width = width;
  bitmap.height = height;
  bitmap.getContext('2d')?.putImageData(img, 0, 0);
  ctx.drawImage(bitmap, 0, 0, width, height);
}

// ---------------------------------------------------------------------------
// Newton's rings diagram: lens-curve Y helper
// ---------------------------------------------------------------------------

export function newtonDiagramLensY(x: number, apexSag: number): number {
  const t = clamp((x - 120) / 240, 0, 1);
  return 180 - 2 * apexSag * t * (1 - t);
}

/** Diagram constants for Newton's sample point. */
export const NEWTON_SAMPLE_X_MIN = 228;
export const NEWTON_SAMPLE_X_RANGE = 148;

// ---------------------------------------------------------------------------
// Canvas pattern renderer (interference fringe image)
// ---------------------------------------------------------------------------

/**
 * Draw the thin-film interference pattern onto a canvas.
 * Returns true if drawing succeeded.
 */
export function drawThinFilmPattern(
  canvas: HTMLCanvasElement,
  settings: ThinFilmSettings,
): boolean {
  const size = getCanvasSize(canvas);
  if (!size) return false;
  const W = size.width;
  const H = size.height;
  const dpr = globalThis.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(dpr, dpr);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  const { filmType, wavelength, thickness, filmN, lensR, wedgeAngle, wedgeProfile, newtonSampleRatio } = settings;
  const lam = wavelength * 1e-9;
  const color = wavelengthToColor(wavelength);
  const m = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
  const cr = m ? +m[1] : 0;
  const cg = m ? +m[2] : 0;
  const cb = m ? +m[3] : 0;
  const img = ctx.createImageData(W, H);

  if (filmType === 'newton') {
    const rMax = 0.0032;
    const newtonRMax = Math.sqrt(8 * lam * lensR / filmN);
    const newtonSampleR = newtonSampleRatio * newtonRMax;
    const scale = Math.min(W, H) / 2 / Math.max(rMax, 1e-9);
    const sampleRPx = newtonSampleR * scale;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const dx = (px - W / 2) / scale;
        const dy = (py - H / 2) / scale;
        const r = Math.hypot(dx, dy);
        const I = ringsIntensityAtR(r, lensR, lam, filmN);
        const v = Math.pow(clamp(I, 0, 1), 0.72);
        const idx = (py * W + px) * 4;
        img.data[idx] = cr * v;
        img.data[idx + 1] = cg * v;
        img.data[idx + 2] = cb * v;
        img.data[idx + 3] = 255;
      }
    }
    putImageDataCover(ctx, img, W, H);

    // Centre dark spot annotation
    ctx.strokeStyle = 'rgba(255,255,255,0.72)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, Math.max(12, Math.min(W, H) * 0.09), 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillText('中心暗斑', W / 2 - 28, 18);

    // Sample point dashed line
    ctx.strokeStyle = 'rgba(255,255,255,0.84)';
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(W / 2, H / 2);
    ctx.lineTo(W / 2 + sampleRPx, H / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sample point dot
    ctx.fillStyle = 'rgba(255,255,255,0.96)';
    ctx.beginPath();
    ctx.arc(W / 2 + sampleRPx, H / 2, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillText(
      `采样 r = ${fmt(newtonSampleR * 1000)} mm`,
      W / 2 + sampleRPx + 10,
      H / 2 - 10,
    );
    return true;
  }

  if (filmType === 'wedge') {
    const xMax = 0.030;
    for (let py = 0; py < H; py++) {
      for (let px = 0; px < W; px++) {
        const x_m = (px / W) * xMax;
        const I = wedgeIntensityAtX(x_m, wedgeAngle, wedgeProfile, lam, filmN);
        const v = Math.pow(clamp(I, 0, 1), 0.72);
        const idx = (py * W + px) * 4;
        img.data[idx] = cr * v;
        img.data[idx + 1] = cg * v;
        img.data[idx + 2] = cb * v;
        img.data[idx + 3] = 255;
      }
    }
    putImageDataCover(ctx, img, W, H);
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.font = '12px JetBrains Mono, monospace';
    ctx.fillText('等厚干涉条纹', 12, 18);
    return true;
  }

  // Soap bubble: RGB composite with wobble
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const tNm = thickness * (1 - py / H) + 50;
      const wobble = Math.sin(px * 0.02 + py * 0.015) * 40;
      const tEff = Math.max(0, (tNm + wobble) * 1e-9);
      let R = 0;
      let G = 0;
      let B = 0;
      for (const [wl, tint] of SOAP_SAMPLES) {
        const localLam = wl * 1e-9;
        const I = soapIntensityAtThickness(tEff, localLam, filmN);
        if (tint === '#ff5a36') R += I;
        if (tint === '#45d483') G += I;
        if (tint === '#4a8dff') B += I;
      }
      const idx = (py * W + px) * 4;
      img.data[idx] = Math.pow(Math.min(1, R), 0.72) * 255;
      img.data[idx + 1] = Math.pow(Math.min(1, G), 0.72) * 255;
      img.data[idx + 2] = Math.pow(Math.min(1, B), 0.72) * 255;
      img.data[idx + 3] = 255;
    }
  }
  putImageDataCover(ctx, img, W, H);
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = '12px JetBrains Mono, monospace';
  ctx.fillText('白光下不同波长在不同厚度位置增强', 12, 18);
  return true;
}

// ---------------------------------------------------------------------------
// Canvas intensity/relation-plot renderer
// ---------------------------------------------------------------------------

/**
 * Draw the I(position) relation plot onto a canvas.
 * Returns true if drawing succeeded.
 */
export function drawThinFilmPlot(
  canvas: HTMLCanvasElement,
  settings: ThinFilmSettings,
): boolean {
  const size = getCanvasSize(canvas);
  if (!size) return false;
  const W = size.width;
  const H = size.height;
  const dpr = globalThis.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(dpr, dpr);

  const { filmType, wavelength, thickness, filmN, lensR, wedgeAngle, wedgeProfile, newtonSampleRatio } = settings;
  const lam = wavelength * 1e-9;
  const color = wavelengthToColor(wavelength);

  // Background
  const bg = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#1a1a2e';
  const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#888';
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim() || '#555';
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const m = H * 0.15;
  const plotW = W - m * 2;
  const plotH = H - m * 2;

  // Axes
  ctx.strokeStyle = border;
  ctx.beginPath();
  ctx.moveTo(m, m);
  ctx.lineTo(m, H - m);
  ctx.lineTo(W - m, H - m);
  ctx.stroke();

  ctx.lineWidth = 1.5;
  let detail = '';

  if (filmType === 'newton') {
    const rMax = 0.0032;
    const newtonRMax = Math.sqrt(8 * lam * lensR / filmN);
    const newtonSampleR = newtonSampleRatio * newtonRMax;
    const newtonSampleI = ringsIntensityAtR(newtonSampleR, lensR, lam, filmN);
    const r1 = Math.sqrt(1 * lam * lensR / filmN);
    const r5 = Math.sqrt(5 * lam * lensR / filmN);
    const xSample = m + (newtonSampleR / rMax) * plotW;
    const ySample = (H - m) - newtonSampleI * plotH;

    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const r = (px / plotW) * rMax;
      const I = ringsIntensityAtR(r, lensR, lam, filmN);
      const x = m + px;
      const y = (H - m) - I * plotH;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Reference lines for r1, r5
    const x1 = m + (r1 / rMax) * plotW;
    const x5 = m + (r5 / rMax) * plotW;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = ink3;
    ctx.beginPath();
    ctx.moveTo(x1, m);
    ctx.lineTo(x1, H - m);
    ctx.moveTo(x5, m);
    ctx.lineTo(x5, H - m);
    ctx.stroke();
    ctx.setLineDash([]);

    // Sample point vertical line
    ctx.strokeStyle = 'rgba(60,60,60,0.55)';
    ctx.beginPath();
    ctx.moveTo(xSample, m);
    ctx.lineTo(xSample, H - m);
    ctx.stroke();

    // Sample point dot
    ctx.fillStyle = 'rgba(132,255,41,0.95)';
    ctx.beginPath();
    ctx.arc(xSample, ySample, 5, 0, Math.PI * 2);
    ctx.fill();

    detail = `r₁ = ${fmt(r1 * 1000)} mm · r₅ = ${fmt(r5 * 1000)} mm`;
    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('I(r) 径向分布', m + 4, m + 12);
    ctx.fillText(`采样点：r = ${fmt(newtonSampleR * 1000)} mm`, W - m - 180, m + 12);
  } else if (filmType === 'wedge') {
    const xMax = 0.030;
    const dx = lam / (2 * filmN * Math.max(Math.tan(wedgeAngleRad(wedgeAngle)), 1e-7));

    ctx.strokeStyle = color;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const xM = (px / plotW) * xMax;
      const I = wedgeIntensityAtX(xM, wedgeAngle, wedgeProfile, lam, filmN);
      const x = m + px;
      const y = (H - m) - I * plotH;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Reference lines
    const x1 = m + (dx / xMax) * plotW;
    const x2 = m + (2 * dx / xMax) * plotW;
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = ink3;
    ctx.beginPath();
    ctx.moveTo(x1, m);
    ctx.lineTo(x1, H - m);
    ctx.moveTo(x2, m);
    ctx.lineTo(x2, H - m);
    ctx.stroke();
    ctx.setLineDash([]);

    detail = `条纹间距 Δx = ${fmt(dx * 1000)} mm`;
    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('I(x) 沿楔方向', m + 4, m + 12);
  } else {
    // Soap: multi-wavelength plot
    const tMax = thickness * 2 * 1e-9;
    for (const [wl, stroke] of SOAP_SAMPLES) {
      ctx.strokeStyle = stroke;
      ctx.beginPath();
      for (let px = 0; px <= plotW; px++) {
        const t = (px / plotW) * tMax;
        const I = soapIntensityAtThickness(t, wl * 1e-9, filmN);
        const x = m + px;
        const y = (H - m) - I * plotH;
        if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    detail = '红 / 绿 / 蓝在不同膜厚位置满足增强条件';
    ctx.fillStyle = ink3;
    ctx.font = '11px JetBrains Mono, monospace';
    ctx.fillText('I(t) 与厚度对应关系', m + 4, m + 12);

    // Legend
    for (let i = 0; i < SOAP_SAMPLES.length; i++) {
      const [wl, stroke] = SOAP_SAMPLES[i];
      ctx.fillStyle = stroke;
      ctx.fillRect(W - m - 110, m + 4 + i * 15, 10, 3);
      ctx.fillStyle = ink3;
      ctx.fillText(`${wl} nm`, W - m - 94, m + 10 + i * 15);
    }
  }

  ctx.fillStyle = ink3;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText(detail, m + 4, H - m + 14);
  return true;
}
