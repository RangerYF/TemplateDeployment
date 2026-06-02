import { toRadicalForm } from '@/engine/radicalEngine';

export type ConicDisplayMode = 'teaching' | 'decimal';

function gcd(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x || 1;
}

export function toFraction(value: number, maxDen = 24): string | null {
  if (!Number.isFinite(value)) return null;
  for (let den = 1; den <= maxDen; den++) {
    const num = Math.round(value * den);
    if (Math.abs(value - num / den) < 1e-8) {
      const g = gcd(num, den);
      const n = num / g;
      const d = den / g;
      if (d === 1) return String(n);
      return `${n}/${d}`;
    }
  }
  return null;
}

export function formatTeachingValue(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return '—';
  const roundedInt = Math.round(value);
  if (Math.abs(value - roundedInt) < 1e-10) return String(roundedInt);

  const radical = toRadicalForm(Math.abs(value));
  if (radical) return value < 0 ? `−${radical}` : radical;

  const frac = toFraction(value);
  if (frac) return frac.startsWith('-') ? `−${frac.slice(1)}` : frac;

  return value.toFixed(decimals);
}

export function formatConicValue(
  value: number,
  mode: ConicDisplayMode,
  decimals = 4,
): string {
  if (mode === 'decimal') {
    if (!Number.isFinite(value)) return '—';
    const roundedInt = Math.round(value);
    if (Math.abs(value - roundedInt) < 1e-10) return String(roundedInt);
    return value.toFixed(decimals);
  }
  return formatTeachingValue(value, Math.min(decimals, 2));
}

export function formatFractionPreferredConicValue(
  value: number,
  mode: ConicDisplayMode,
  decimals = 4,
  maxDen = 96,
): string {
  if (!Number.isFinite(value)) return '—';
  const roundedInt = Math.round(value);
  if (Math.abs(value - roundedInt) < 1e-10) return String(roundedInt);

  const frac = toFraction(value, maxDen);
  if (frac) return frac.startsWith('-') ? `−${frac.slice(1)}` : frac;

  return formatConicValue(value, mode, decimals);
}

export function formatSignedTeachingValue(value: number, decimals = 4): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-10) return '0';
  const body = formatTeachingValue(Math.abs(value), decimals);
  return value >= 0 ? `+${body}` : `−${body}`;
}

export function formatSignedConicValue(
  value: number,
  mode: ConicDisplayMode,
  decimals = 4,
): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1e-10) return '0';
  const body = formatConicValue(Math.abs(value), mode, decimals);
  return value >= 0 ? `+${body}` : `−${body}`;
}

export function formatPointTeaching(x: number, y: number, decimals = 4): string {
  return `(${formatTeachingValue(x, decimals)}, ${formatTeachingValue(y, decimals)})`;
}

export function formatPointConic(
  x: number,
  y: number,
  mode: ConicDisplayMode,
  decimals = 2,
): string {
  return `(${formatConicValue(x, mode, decimals)}, ${formatConicValue(y, mode, decimals)})`;
}

export function formatSquareTerm(value: number): string {
  const sq = value * value;
  return formatTeachingValue(sq, 2);
}

export function formatSquareTermConic(value: number, mode: ConicDisplayMode): string {
  const sq = value * value;
  return formatConicValue(sq, mode, 2);
}

export function formatAsymptoteTeaching(k: number, b: number): string {
  const slope = formatTeachingValue(Math.abs(k), 4);
  const sign = k >= 0 ? '' : '−';
  if (Math.abs(b) < 1e-10) return `y = ${sign}${slope}x`;
  const intercept = formatTeachingValue(Math.abs(b), 4);
  return `y = ${sign}${slope}x ${b >= 0 ? '+' : '−'} ${intercept}`;
}

export function formatAsymptoteConic(k: number, b: number, mode: ConicDisplayMode): string {
  const slope = formatConicValue(Math.abs(k), mode, mode === 'teaching' ? 2 : 4);
  const sign = k >= 0 ? '' : '−';
  if (Math.abs(b) < 1e-10) return `y = ${sign}${slope}x`;
  const intercept = formatConicValue(Math.abs(b), mode, mode === 'teaching' ? 2 : 4);
  return `y = ${sign}${slope}x ${b >= 0 ? '+' : '−'} ${intercept}`;
}
