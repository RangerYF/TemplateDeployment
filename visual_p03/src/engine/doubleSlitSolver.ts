/**
 * doubleSlitSolver.ts
 * Pure physics solver for double-slit interference.
 * No window references, no React — pure math functions.
 */

import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import type { DoubleSlitSettings } from '@/data/doubleSlitData';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

// ---------------------------------------------------------------------------
// Core physics
// ---------------------------------------------------------------------------

/** White-light sample wavelengths (nm). */
export const WHITE_LIGHT_SAMPLES = [420, 470, 530, 580, 650] as const;

/** Wavelengths shown on the intensity plot when in white-light mode. */
export const WHITE_LIGHT_PLOT_SAMPLES = [450, 550, 650] as const;

/**
 * Fringe spacing for Young's double-slit experiment.
 *   Δy = λL / d
 */
export function fringeSpacing(wavelengthM: number, screenDistanceM: number, slitSpacingM: number): number {
  return wavelengthM * screenDistanceM / slitSpacingM;
}

/**
 * Single-slit diffraction envelope (sinc² factor).
 * `betaHalf = π a sinθ / λ`
 */
export function singleSlitEnvelope(betaHalf: number): number {
  if (Math.abs(betaHalf) < 1e-6) return 1;
  return Math.pow(Math.sin(betaHalf) / betaHalf, 2);
}

/**
 * Double-slit intensity at a given physical y-position on the screen.
 *
 *   I(y) = I₀ × sinc²(πa sinθ/λ) × cos²(πd sinθ/λ)
 *
 * Returns raw intensity (may exceed 1 when sourceIntensityScale > 1).
 */
export function doubleSlitIntensity(
  y: number,
  screenDistanceM: number,
  slitSpacingM: number,
  slitWidthM: number,
  wavelengthM: number,
  sourceIntensityScale: number,
): number {
  const sinTheta = y / screenDistanceM;
  const betaHalf = Math.PI * slitWidthM * sinTheta / wavelengthM;
  const deltaHalf = Math.PI * slitSpacingM * sinTheta / wavelengthM;
  const envelope = singleSlitEnvelope(betaHalf);
  return sourceIntensityScale * envelope * Math.pow(Math.cos(deltaHalf), 2);
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
// SVG screen-fringe data (for the setup diagram overlay)
// ---------------------------------------------------------------------------

export interface FringeRect {
  y: number;
  h: number;
  fillR: number;
  fillG: number;
  fillB: number;
}

/**
 * Compute the fringe rectangles rendered on the screen in the SVG setup diagram.
 * Returns an array of N rects covering the screen from svgTop to svgBot.
 */
export function computeScreenFringeRects(
  settings: DoubleSlitSettings,
  sourceIntensityScale: number,
): FringeRect[] {
  const { slitSpacing, slitWidth, screenDistance, wavelength, whiteLight } = settings;
  const d = slitSpacing * 1e-6;
  const L = screenDistance;
  const lam = wavelength * 1e-9;
  const a = slitWidth * 1e-6;
  const color = wavelengthToColor(wavelength);

  const N = 55;
  const svgTop = 20;
  const svgBot = 130;
  const svgH = svgBot - svgTop;
  const screenSpan = 0.04; // metres of physical screen height
  const rects: FringeRect[] = [];

  for (let i = 0; i < N; i++) {
    const svgY = svgTop + (i / N) * svgH;
    const h = svgH / N + 0.5;
    const physY = ((i / N) - 0.5) * screenSpan;
    const sinTheta = physY / L;

    if (whiteLight) {
      const wls = WHITE_LIGHT_SAMPLES;
      let rr = 0, gg = 0, bb = 0;
      for (const wl of wls) {
        const ll = wl * 1e-9;
        const bH = Math.PI * a * sinTheta / ll;
        const dH = Math.PI * d * sinTheta / ll;
        const env = singleSlitEnvelope(bH);
        const Iv = Math.pow(Math.max(0, Math.min(1, sourceIntensityScale * env * Math.pow(Math.cos(dH), 2))), 0.72);
        const rgb = parseRGB(wavelengthToColor(wl));
        if (rgb) { rr += rgb.r * Iv; gg += rgb.g * Iv; bb += rgb.b * Iv; }
      }
      rects.push({
        y: svgY,
        h,
        fillR: Math.min(255, rr / wls.length * 1.8),
        fillG: Math.min(255, gg / wls.length * 1.8),
        fillB: Math.min(255, bb / wls.length * 1.8),
      });
    } else {
      const bH = Math.PI * a * sinTheta / lam;
      const dH = Math.PI * d * sinTheta / lam;
      const env = singleSlitEnvelope(bH);
      const Iv = Math.pow(Math.max(0, Math.min(1, sourceIntensityScale * env * Math.pow(Math.cos(dH), 2))), 0.7);
      const rgb = parseRGB(color);
      if (rgb) {
        rects.push({ y: svgY, h, fillR: rgb.r * Iv, fillG: rgb.g * Iv, fillB: rgb.b * Iv });
      }
    }
  }

  return rects;
}

// ---------------------------------------------------------------------------
// Canvas pattern renderer (interference fringe strip)
// ---------------------------------------------------------------------------

/**
 * Draw the interference fringe pattern onto a canvas.
 * The canvas shows vertical stripes for each screen position.
 * Returns true if drawing succeeded.
 */
export function drawFringePattern(
  canvas: HTMLCanvasElement,
  settings: DoubleSlitSettings,
  sourceIntensityScale: number,
): boolean {
  const parent = canvas.parentElement;
  if (!parent) return false;
  const W = Math.floor(parent.clientWidth);
  const H = Math.floor(parent.clientHeight);
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return false;

  const dpr = globalThis.devicePixelRatio || 1;
  const pixelW = Math.max(1, Math.floor(W * dpr));
  const pixelH = Math.max(1, Math.floor(H * dpr));
  canvas.width = pixelW;
  canvas.height = pixelH;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, pixelW, pixelH);

  const { slitSpacing, slitWidth, screenDistance, wavelength, whiteLight, showColor } = settings;
  const d = slitSpacing * 1e-6;
  const L = screenDistance;
  const lam = wavelength * 1e-9;
  const a = slitWidth * 1e-6;
  const screenW = 0.04; // physical screen width in metres
  const color = wavelengthToColor(wavelength);
  const img = ctx.createImageData(pixelW, pixelH);
  const monoRGB = parseRGB(color);
  const cr = monoRGB?.r ?? 0;
  const cg = monoRGB?.g ?? 0;
  const cb = monoRGB?.b ?? 0;

  for (let px = 0; px < pixelW; px++) {
    const y = (px - pixelW / 2) / pixelW * screenW;

    const getI = (wlNm: number): number => {
      const localLam = wlNm * 1e-9;
      const sinTheta = y / L;
      const betaHalf = Math.PI * a * sinTheta / localLam;
      const deltaHalf = Math.PI * d * sinTheta / localLam;
      const envelope = singleSlitEnvelope(betaHalf);
      return sourceIntensityScale * envelope * Math.pow(Math.cos(deltaHalf), 2);
    };

    let rr = 0, gg = 0, bb = 0;
    const monoI = getI(wavelength);

    if (whiteLight) {
      for (const wl of WHITE_LIGHT_SAMPLES) {
        const localRGB = parseRGB(wavelengthToColor(wl));
        if (!localRGB) continue;
        const I = Math.pow(Math.max(0, Math.min(1, getI(wl))), 0.72);
        rr += localRGB.r * I;
        gg += localRGB.g * I;
        bb += localRGB.b * I;
      }
      rr = Math.min(255, rr / WHITE_LIGHT_SAMPLES.length * 1.8);
      gg = Math.min(255, gg / WHITE_LIGHT_SAMPLES.length * 1.8);
      bb = Math.min(255, bb / WHITE_LIGHT_SAMPLES.length * 1.8);
    }

    const v = Math.pow(Math.max(0, Math.min(1, monoI)), 0.7);

    for (let py = 0; py < pixelH; py++) {
      const idx = (py * pixelW + px) * 4;
      if (whiteLight) {
        const gray = (rr + gg + bb) / 3;
        img.data[idx]     = showColor ? rr : gray;
        img.data[idx + 1] = showColor ? gg : gray;
        img.data[idx + 2] = showColor ? bb : gray;
      } else {
        const gray = 255 * v;
        img.data[idx]     = showColor ? cr * v : gray;
        img.data[idx + 1] = showColor ? cg * v : gray;
        img.data[idx + 2] = showColor ? cb * v : gray;
      }
      img.data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  return true;
}

// ---------------------------------------------------------------------------
// Canvas intensity-plot renderer
// ---------------------------------------------------------------------------

/**
 * Draw the I(y) intensity plot onto a canvas.
 * In white-light mode, three curves (450 / 550 / 650 nm) are drawn.
 * Returns true if drawing succeeded.
 */
export function drawIntensityPlot(
  canvas: HTMLCanvasElement,
  settings: DoubleSlitSettings,
  sourceIntensityScale: number,
): boolean {
  const parent = canvas.parentElement;
  if (!parent) return false;
  const W = Math.floor(parent.clientWidth);
  const H = Math.floor(parent.clientHeight);
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0) return false;

  const dpr = globalThis.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(dpr, dpr);

  const { slitSpacing, slitWidth, screenDistance, wavelength, whiteLight } = settings;
  const d = slitSpacing * 1e-6;
  const L = screenDistance;
  const lam = wavelength * 1e-9;
  const a = slitWidth * 1e-6;
  const dy = fringeSpacing(lam, L, d);
  const color = wavelengthToColor(wavelength);

  // Background
  const bgColor = getComputedStyle(document.documentElement).getPropertyValue('--panel').trim() || '#1a1a2e';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Margins and plot area
  const m = H * 0.15;
  const plotW = W - m * 2;
  const plotH = H - m * 2;

  const ink3 = getComputedStyle(document.documentElement).getPropertyValue('--ink-3').trim() || '#888';
  const border = getComputedStyle(document.documentElement).getPropertyValue('--border-strong').trim() || '#555';

  // Axes
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m, m);
  ctx.lineTo(m, H - m);
  ctx.lineTo(W - m, H - m);
  ctx.stroke();

  // Center dashed line
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(W / 2, m);
  ctx.lineTo(W / 2, H - m);
  ctx.stroke();
  ctx.setLineDash([]);

  // Plot curves
  const screenW = 0.04;
  const wls = whiteLight ? Array.from(WHITE_LIGHT_PLOT_SAMPLES) : [wavelength];

  for (const wl of wls) {
    ctx.strokeStyle = whiteLight ? wavelengthToColor(wl) : color;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const x = m + px;
      const y_m = (px / plotW - 0.5) * screenW;
      const localLam = wl * 1e-9;
      const sinTheta = y_m / L;
      const betaHalf = Math.PI * a * sinTheta / localLam;
      const deltaHalf = Math.PI * d * sinTheta / localLam;
      const envelope = singleSlitEnvelope(betaHalf);
      const I = sourceIntensityScale * envelope * Math.pow(Math.cos(deltaHalf), 2);
      const y = (H - m) - I * plotH;
      if (px === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Labels
  ctx.fillStyle = ink3;
  ctx.font = '11px JetBrains Mono, monospace';
  ctx.fillText('I(y)', m + 4, m + 12);
  ctx.fillText('y →', W - m - 26, H - m - 6);
  ctx.fillText(`Δy = ${(dy * 1000).toFixed(2)} mm`, W / 2 + 8, m + 14);
  if (whiteLight) ctx.fillText('450 / 550 / 650 nm', W - m - 92, m + 12);

  return true;
}

// ---------------------------------------------------------------------------
// Derived metric helpers
// ---------------------------------------------------------------------------

export interface DoubleSlitMetrics {
  /** Fringe spacing in metres */
  fringeSpacingM: number;
  /** Fringe spacing in mm */
  fringeSpacingMM: number;
  /** Central maximum width (first single-slit minimum on each side) in metres */
  centralMaxWidthM: number;
  /** Central maximum width in mm */
  centralMaxWidthMM: number;
  /** Ratio of slit spacing to screen distance */
  slitToScreenRatio: number;
  /** Current wavelength description */
  wavelengthLabel: string;
}

export function computeMetrics(settings: DoubleSlitSettings): DoubleSlitMetrics {
  const d = settings.slitSpacing * 1e-6;
  const L = settings.screenDistance;
  const lam = settings.wavelength * 1e-9;
  const a = settings.slitWidth * 1e-6;

  const dy = fringeSpacing(lam, L, d);
  // Central maximum width of single-slit envelope: 2λL/a
  const centralMaxW = 2 * lam * L / a;

  return {
    fringeSpacingM: dy,
    fringeSpacingMM: dy * 1000,
    centralMaxWidthM: centralMaxW,
    centralMaxWidthMM: centralMaxW * 1000,
    slitToScreenRatio: (d / L) * 1e6, // dimensionless but scaled for display
    wavelengthLabel: settings.whiteLight ? '白光' : `${settings.wavelength} nm`,
  };
}

// ---------------------------------------------------------------------------
// Source-distance intensity scale (matches the old module)
// ---------------------------------------------------------------------------

export function computeSourceIntensityScale(sourceX: number, slitX: number): number {
  const sourceDistanceM = Math.max(0.2, (slitX - sourceX) / 110);
  return clamp(Math.pow(1.55 / sourceDistanceM, 2), 0.28, 1.65);
}
