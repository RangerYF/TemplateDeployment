/**
 * diffractionSolver.ts
 * Pure physics solver for single-slit / circular-aperture diffraction.
 * No window references, no React — pure math + Canvas drawing functions.
 */

import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import type { DiffractionSettings, ApertureType } from '@/data/diffractionData';

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

export function fmt(v: number, digits = 3): string {
  return Number.isFinite(v) ? v.toFixed(digits) : '—';
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Wavelengths used in RGB compare mode (nm). */
export const COMPARE_WAVELENGTHS = [450, 532, 650] as const;

/** Physical screen span (metres) per aperture type. */
export const DIFFRACTION_VIEW_SPAN: Record<ApertureType, number> = {
  slit: 0.066,
  circle: 0.040,
  disk: 0.040,
};

// ---------------------------------------------------------------------------
// Bessel J1 (rational approximation, matches the original exactly)
// ---------------------------------------------------------------------------

export function besselJ1(x: number): number {
  if (x === 0) return 0;
  const ax = Math.abs(x);
  if (ax < 8) {
    const y = x * x;
    const num =
      x *
      (72362614232.0 +
        y *
          (-7895059235.0 +
            y *
              (242396853.1 +
                y * (-2972611.439 + y * (15704.4826 + y * -30.16036606)))));
    const den =
      144725228442.0 +
      y *
        (2300535178.0 +
          y * (18583304.74 + y * (99447.43394 + y * (376.9991397 + y * 1.0))));
    return num / den;
  }
  const z = 8 / ax;
  const y = z * z;
  const ans1 =
    1.0 +
    y *
      (0.183105e-2 +
        y *
          (-0.3516396496e-4 +
            y * (0.2457520174e-5 + y * -0.240337019e-6)));
  const ans2 =
    0.04687499995 +
    y *
      (-0.2002690873e-3 +
        y *
          (0.8449199096e-5 + y * (-0.88228987e-6 + y * 0.105787412e-6)));
  const xx = ax - 2.356194491;
  const ans =
    Math.sqrt(0.636619772 / ax) *
    (Math.cos(xx) * ans1 - z * Math.sin(xx) * ans2);
  return x < 0 ? -ans : ans;
}

// ---------------------------------------------------------------------------
// Perceptual tone-mapping
// ---------------------------------------------------------------------------

export function perceptualToneMap(
  I: number,
  ap: 'slit' | 'circle',
): number {
  const c = clamp01(I);
  const gamma = ap === 'circle' ? 0.22 : 0.25;
  return Math.pow(c, gamma) * 0.82 + Math.pow(c, 0.65) * 0.18;
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
// Source-distance intensity scale (matches the old module)
// ---------------------------------------------------------------------------

export function computeSourceIntensityScale(
  sourceX: number,
  apertureX: number,
): number {
  const sourceDistanceM = Math.max(0.2, (apertureX - sourceX) / 110);
  return clamp(Math.pow(1.55 / sourceDistanceM, 2), 0.28, 1.65);
}

// ---------------------------------------------------------------------------
// Core physics: intensity at a screen position
// ---------------------------------------------------------------------------

/**
 * Compute raw intensity at a physical y-position on the screen.
 *
 * - slit:   sinc^2 Fraunhofer diffraction
 * - circle: Airy pattern via besselJ1
 * - disk:   Poisson bright-spot approximation
 */
export function diffractionIntensity(
  y: number,
  aperture: ApertureType,
  slitWidthM: number,
  diameterM: number,
  wavelengthM: number,
  screenDistanceM: number,
  sourceIntensityScale: number,
  wavelengthNm?: number,
): number {
  const lam = wavelengthNm != null ? wavelengthNm * 1e-9 : wavelengthM;
  const L = screenDistanceM;
  const a = slitWidthM;
  const D = diameterM;
  const sinTheta = y / L;

  if (aperture === 'slit') {
    const x = (Math.PI * a * sinTheta) / lam;
    if (Math.abs(x) < 1e-6) return sourceIntensityScale;
    const s = Math.sin(x) / x;
    return sourceIntensityScale * s * s;
  }

  // circle or disk
  const x = (Math.PI * D * sinTheta) / lam;
  if (Math.abs(x) < 1e-6) return sourceIntensityScale;
  const v = (2 * besselJ1(x)) / x;
  const airy = sourceIntensityScale * v * v;

  if (aperture === 'disk') {
    const poisson = Math.exp(-Math.pow(x / 1.05, 2));
    const weakRings = Math.pow(Math.abs(v), 1.4) * 0.2;
    return sourceIntensityScale * clamp(poisson + weakRings, 0, 1);
  }

  return airy;
}

// ---------------------------------------------------------------------------
// Convenience wrapper using DiffractionSettings
// ---------------------------------------------------------------------------

/**
 * Intensity using full settings (converts units internally).
 * Optional `wlNm` overrides the settings wavelength.
 */
export function intensityAt(
  y: number,
  settings: DiffractionSettings,
  sourceIntensityScale: number,
  wlNm?: number,
): number {
  const lam = (wlNm ?? settings.wavelength) * 1e-9;
  const a = settings.slitWidth * 1e-6;
  const D = settings.diameter * 1e-6;
  const L = settings.screenDistance;

  return diffractionIntensity(
    y,
    settings.aperture,
    a,
    D,
    lam,
    L,
    sourceIntensityScale,
  );
}

// ---------------------------------------------------------------------------
// First minimum position
// ---------------------------------------------------------------------------

export function firstMinimumPosition(settings: DiffractionSettings): number {
  const lam = settings.wavelength * 1e-9;
  const L = settings.screenDistance;
  if (settings.aperture === 'slit') {
    const a = settings.slitWidth * 1e-6;
    return (lam * L) / a;
  }
  const D = settings.diameter * 1e-6;
  return (1.22 * lam * L) / D;
}

/**
 * Primary display value in mm:
 * - slit: central maximum width (2 * firstMin)
 * - circle/disk: Airy disk radius (firstMin)
 */
export function primaryValueMm(settings: DiffractionSettings): number {
  const firstMin = firstMinimumPosition(settings);
  return (settings.aperture === 'slit' ? 2 * firstMin : firstMin) * 1000;
}

// ---------------------------------------------------------------------------
// Canvas: diffraction pattern
// ---------------------------------------------------------------------------

/**
 * Draw the diffraction pattern onto a canvas.
 *   - Single mode: one wavelength, full 1D (slit) or 2D radial (circle/disk).
 *   - Compare mode: 3 wavelength bands stacked vertically.
 *
 * Returns true if drawing succeeded.
 */
export function drawDiffractionPattern(
  canvas: HTMLCanvasElement,
  settings: DiffractionSettings,
  sourceIntensityScale: number,
): boolean {
  const parent = canvas.parentElement;
  if (!parent) return false;
  const W = Math.floor(parent.clientWidth);
  const H = Math.floor(parent.clientHeight);
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0)
    return false;

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

  const { aperture, wavelength, showColor, compareMode } = settings;
  const screenSpan = DIFFRACTION_VIEW_SPAN[aperture];
  const firstMin = firstMinimumPosition(settings);

  if (!compareMode) {
    // ── Single-wavelength mode ──────────────────────────────────────
    const color = wavelengthToColor(wavelength);
    const rgb = parseRGB(color);
    const cr = rgb?.r ?? 0;
    const cg = rgb?.g ?? 0;
    const cb = rgb?.b ?? 0;

    // Use logical dimensions for physics (not pixel dimensions)
    const img = ctx.createImageData(pixelW, pixelH);
    for (let px = 0; px < pixelW; px++) {
      const y = ((px - pixelW / 2) / pixelW) * screenSpan;
      const iHoriz = intensityAt(y, settings, sourceIntensityScale);

      for (let py = 0; py < pixelH; py++) {
        const I =
          aperture === 'slit'
            ? iHoriz
            : intensityAt(
                Math.hypot(y, ((py - pixelH / 2) / pixelW) * screenSpan),
                settings,
                sourceIntensityScale,
              );
        const v = perceptualToneMap(I, aperture === 'disk' ? 'circle' : aperture);
        const gray = 255 * v;
        const idx = (py * pixelW + px) * 4;
        img.data[idx] = showColor ? cr * v : gray;
        img.data[idx + 1] = showColor ? cg * v : gray;
        img.data[idx + 2] = showColor ? cb * v : gray;
        img.data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);

    // Annotations (draw in logical coords via scale)
    ctx.save();
    ctx.scale(dpr, dpr);
    const ink = 'rgba(255,255,255,0.74)';
    const soft = 'rgba(210,255,180,0.10)';

    if (aperture === 'slit') {
      const xMin1 = W / 2 + (firstMin / screenSpan) * W;
      const xMin2 = W / 2 - (firstMin / screenSpan) * W;
      ctx.fillStyle = soft;
      ctx.fillRect(xMin2, 0, xMin1 - xMin2, H);
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(xMin1, 0);
      ctx.lineTo(xMin1, H);
      ctx.moveTo(xMin2, 0);
      ctx.lineTo(xMin2, H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillText('中央主极大', W / 2 - 38, 18);
    } else {
      const rPx = (firstMin / screenSpan) * W;
      ctx.strokeStyle = ink;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(W / 2, H / 2, Math.max(8, rPx), 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.font = '12px JetBrains Mono, monospace';
      ctx.fillText(
        aperture === 'disk' ? '泊松亮斑' : '艾里斑',
        W / 2 - 30,
        18,
      );
    }
    ctx.restore();
  } else {
    // ── Compare mode (3 wavelength bands) ───────────────────────────
    const bandH = Math.floor(pixelH / 3);
    const img = ctx.createImageData(pixelW, pixelH);

    for (let bi = 0; bi < 3; bi++) {
      const wl = COMPARE_WAVELENGTHS[bi];
      const rgb = parseRGB(wavelengthToColor(wl));
      const cr = rgb?.r ?? 0;
      const cg = rgb?.g ?? 0;
      const cb = rgb?.b ?? 0;

      for (let px = 0; px < pixelW; px++) {
        const y = ((px - pixelW / 2) / pixelW) * screenSpan;
        const I = intensityAt(y, settings, sourceIntensityScale, wl);
        const v = perceptualToneMap(
          I,
          aperture === 'disk' ? 'circle' : (aperture as 'slit' | 'circle'),
        );
        const gray = 255 * v;
        const y0 = bi * bandH;
        const y1 = bi === 2 ? pixelH : (bi + 1) * bandH;
        for (let py = y0; py < y1; py++) {
          const idx = (py * pixelW + px) * 4;
          img.data[idx] = showColor ? cr * v : gray;
          img.data[idx + 1] = showColor ? cg * v : gray;
          img.data[idx + 2] = showColor ? cb * v : gray;
          img.data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(img, 0, 0);

    // Band dividers and labels (logical coords)
    ctx.save();
    ctx.scale(dpr, dpr);
    const logicalBandH = Math.floor(H / 3);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(0, i * logicalBandH);
      ctx.lineTo(W, i * logicalBandH);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '11px JetBrains Mono, monospace';
    for (let bi = 0; bi < 3; bi++) {
      ctx.fillText(`${COMPARE_WAVELENGTHS[bi]} nm`, 8, bi * logicalBandH + 14);
    }
    ctx.restore();
  }

  return true;
}

// ---------------------------------------------------------------------------
// Canvas: intensity plot
// ---------------------------------------------------------------------------

/**
 * Draw the I(y) / I(r) intensity plot onto a canvas.
 * In compare mode, three curves are drawn.
 * Returns true if drawing succeeded.
 */
export function drawDiffractionPlot(
  canvas: HTMLCanvasElement,
  settings: DiffractionSettings,
  sourceIntensityScale: number,
): boolean {
  const parent = canvas.parentElement;
  if (!parent) return false;
  const W = Math.floor(parent.clientWidth);
  const H = Math.floor(parent.clientHeight);
  if (!Number.isFinite(W) || !Number.isFinite(H) || W <= 0 || H <= 0)
    return false;

  const dpr = globalThis.devicePixelRatio || 1;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  ctx.scale(dpr, dpr);

  const { aperture, wavelength, compareMode } = settings;
  const isSlit = aperture === 'slit';
  const screenSpan = DIFFRACTION_VIEW_SPAN[aperture];
  const firstMin = firstMinimumPosition(settings);

  // Background
  const bgColor =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--panel')
      .trim() || '#1a1a2e';
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Margins
  const m = H * 0.15;
  const plotW = W - m * 2;
  const plotH = H - m * 2;

  const ink3 =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--ink-3')
      .trim() || '#888';
  const border =
    getComputedStyle(document.documentElement)
      .getPropertyValue('--border-strong')
      .trim() || '#555';

  // Axes
  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(m, m);
  ctx.lineTo(m, H - m);
  ctx.lineTo(W - m, H - m);
  ctx.stroke();

  // Centre dashed line
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(W / 2, m);
  ctx.lineTo(W / 2, H - m);
  ctx.stroke();
  ctx.setLineDash([]);

  // Curves
  const wls = compareMode ? Array.from(COMPARE_WAVELENGTHS) : [wavelength];

  for (const wl of wls) {
    ctx.strokeStyle = wavelengthToColor(wl);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let px = 0; px <= plotW; px++) {
      const x = m + px;
      const y_m = (px / plotW - 0.5) * screenSpan;
      const I = clamp01(intensityAt(y_m, settings, sourceIntensityScale, wl));
      const y = H - m - I * plotH;
      if (px === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // Annotations
  ctx.fillStyle = ink3;
  ctx.font = '11px JetBrains Mono, monospace';

  if (!compareMode) {
    const xMin1 = W / 2 + (firstMin / screenSpan) * plotW;
    const xMin2 = W / 2 - (firstMin / screenSpan) * plotW;
    ctx.fillStyle = 'rgba(140, 255, 84, 0.08)';
    ctx.fillRect(xMin2, m, xMin1 - xMin2, plotH);
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = ink3;
    ctx.beginPath();
    ctx.moveTo(xMin1, m);
    ctx.lineTo(xMin1, H - m);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(xMin2, m);
    ctx.lineTo(xMin2, H - m);
    ctx.stroke();
    ctx.setLineDash([]);

    const firstMinMm = firstMin * 1000;
    const primMm = primaryValueMm(settings);
    if (isSlit) {
      ctx.fillStyle = ink3;
      ctx.fillText(`±${fmt(firstMinMm, 2)} mm`, W / 2 + 6, m + 12);
      ctx.fillText(
        `2y₁ = ${fmt(primMm, 2)} mm`,
        W / 2 + 6,
        m + 26,
      );
    } else {
      ctx.fillStyle = ink3;
      ctx.fillText(
        `r₁ = ${fmt(firstMinMm, 2)} mm`,
        W / 2 + 6,
        m + 12,
      );
    }
  } else {
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = wavelengthToColor(COMPARE_WAVELENGTHS[i]);
      ctx.fillRect(W - m - 90, m + 4 + i * 14, 10, 3);
      ctx.fillStyle = ink3;
      ctx.fillText(`${COMPARE_WAVELENGTHS[i]} nm`, W - m - 75, m + 10 + i * 14);
    }
  }
  ctx.fillStyle = ink3;
  ctx.fillText(isSlit ? 'I(y)' : 'I(r)', m + 4, m + 12);

  return true;
}

// ---------------------------------------------------------------------------
// Derived metrics
// ---------------------------------------------------------------------------

export interface DiffractionMetrics {
  /** First minimum position in metres */
  firstMinM: number;
  /** First minimum position in mm */
  firstMinMm: number;
  /** Primary display value in mm (central max width for slit, Airy radius for circle) */
  primaryMm: number;
  /** Current wavelength label */
  wavelengthLabel: string;
  /** Aperture label */
  apertureLabel: string;
  /** Trend description */
  trendText: string;
  /** Trend note */
  trendNote: string;
}

export function computeMetrics(settings: DiffractionSettings): DiffractionMetrics {
  const firstMin = firstMinimumPosition(settings);
  const primMm = primaryValueMm(settings);
  const isSlit = settings.aperture === 'slit';
  const isDisk = settings.aperture === 'disk';

  return {
    firstMinM: firstMin,
    firstMinMm: firstMin * 1000,
    primaryMm: primMm,
    wavelengthLabel: `${settings.wavelength} nm`,
    apertureLabel: isSlit
      ? '中央主极大宽度'
      : isDisk
        ? '泊松亮斑尺度'
        : '艾里斑半径',
    trendText: isSlit
      ? 'a ↓ 或 λ ↑ => 中央主极大变宽'
      : isDisk
        ? 'D ↓ 或 λ ↑ => 泊松亮斑及弱环尺度变大'
        : 'D ↓ 或 λ ↑ => 艾里斑变大',
    trendNote: isSlit
      ? '中央亮纹最宽最亮，是单缝讲解的主结论。'
      : isDisk
        ? '泊松亮斑来自圆板边缘衍射在阴影中心相干增强。'
        : '艾里斑的尺寸由孔径和波长共同决定。',
  };
}
