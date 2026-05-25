import * as math from 'mathjs';
import katex from 'katex';

function simplifyRadicalInt(n: number): { outside: number; inside: number } {
  let outside = 1;
  let inside = n;
  for (let factor = 2; factor * factor <= inside; factor++) {
    while (inside % (factor * factor) === 0) {
      inside /= factor * factor;
      outside *= factor;
    }
  }
  return { outside, inside };
}

function decimalToFraction(value: number, maxDen = 36): { num: number; den: number } | null {
  for (let den = 1; den <= maxDen; den++) {
    const num = Math.round(value * den);
    if (Math.abs(value - num / den) < 1e-8) return { num, den };
  }
  return null;
}

function isExactish(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const roundedInt = Math.round(value);
  if (Math.abs(value - roundedInt) < 1e-10) return true;

  const squared = value * value;
  const roundedSquared = Math.round(squared);
  if (roundedSquared > 0 && Math.abs(squared - roundedSquared) < 1e-8) return true;

  return decimalToFraction(value) !== null;
}

export function parsePositiveMathInput(raw: string): number | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const normalized = text.replace(/√/g, 'sqrt');
    const value = math.evaluate(normalized);
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

export function formatTeachingNumber(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return '—';
  const roundedInt = Math.round(value);
  if (Math.abs(value - roundedInt) < 1e-10) return String(roundedInt);

  const squared = value * value;
  const roundedSquared = Math.round(squared);
  if (roundedSquared > 0 && Math.abs(squared - roundedSquared) < 1e-8) {
    const { outside, inside } = simplifyRadicalInt(roundedSquared);
    if (inside === 1) return String(outside);
    if (outside === 1) return `√${inside}`;
    return `${outside}√${inside}`;
  }

  const frac = decimalToFraction(value);
  if (frac && frac.den !== 1) {
    return `${frac.num}/${frac.den}`;
  }

  return value.toFixed(digits);
}

export function formatExactTeachingNumber(value: number, digits = 4): string {
  return formatTeachingNumber(value, digits);
}

export function formatExactOnly(value: number, digits = 4): string {
  const exact = formatExactTeachingNumber(value, digits);
  if (exact === '—') return exact;
  if (isExactish(value)) return exact;
  return value.toFixed(digits);
}

export function formatExactWithApprox(value: number, digits = 4): string {
  const exact = formatExactTeachingNumber(value, digits);
  if (exact === '—') return exact;
  if (isExactish(value)) return exact;
  return value.toFixed(digits);
}

export function formatTeachingAngleDeg(degrees: number): string {
  const rounded = Math.round(degrees * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-8) return `${Math.round(rounded)}°`;
  return `${rounded.toFixed(2)}°`;
}

export function formatTeachingErrorValue(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-8) return String(Math.round(rounded));
  return rounded.toFixed(3);
}

export function toKatexInline(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.includes('√') && !trimmed.includes('/')) return trimmed;

  if (trimmed.includes('/')) {
    const match = trimmed.match(/^(-?\d+)\/(\d+)$/);
    if (match) return `\\frac{${match[1]}}{${match[2]}}`;
  }

  const radicalMatch = trimmed.match(/^(-?)(\d+)?√(\d+)$/);
  if (radicalMatch) {
    const sign = radicalMatch[1] === '-' ? '-' : '';
    const coeff = radicalMatch[2] ?? '';
    return `${sign}${coeff}\\sqrt{${radicalMatch[3]}}`;
  }

  return trimmed;
}

export function renderInlineKatex(text: string): string {
  return katex.renderToString(toKatexInline(text), { throwOnError: false, displayMode: false });
}
