import { cssVar, getTheme } from './themeMode';

/**
 * Canvas colour registry — a MUTABLE object whose fields are reassigned in place
 * by refreshCanvasColors(). Scenes `import { COLORS }` (a live binding); because we
 * mutate fields rather than reassigning the variable, every `COLORS.xxx` read at
 * render time automatically follows the active theme with zero scene-side changes.
 *
 * The literal below holds the LIGHT defaults so the very first paint (before
 * refreshCanvasColors runs) is already correct.
 */
export const COLORS = {
  canvasBg: '#FAFAFA',
  textPrimary: '#1A1A1A',
  textSecondary: '#555555',
  textDim: '#888888',
  accentGreen: '#00C06B',
  accentGreenLight: '#34D399',
  resultHighlight: '#059669',
  verifyGreen: '#00C06B',

  moleculeCool: '#42A5F5',
  moleculeHot: '#EF5350',
  mercury: '#9E9E9E',
  piston: '#795548',
  gasFill: 'rgba(144,202,249,0.3)',

  isothermalLine: '#D32F2F',
  isochoricLine: '#1565C0',
  isobaricLine: '#059669',

  brownianTrail: '#D32F2F',
  brownianParticle: '#1A1A1A',

  containerBorder: '#333333',
  dimensionLine: '#00C06B',
  arrowHeating: '#E65100',
  arrowForce: '#D32F2F',
  arrowPressure: '#1565C0',
};

// Cached RGB triplets / strokes for the theme-aware helpers — recomputed only by
// refreshCanvasColors(), never per frame.
let surfaceBase = '255, 255, 255';
let lineBase = '15, 23, 42';
let gridStroke = 'rgba(15, 23, 42, 0.035)';

function hexToRgbTriplet(hex: string, fallback: string): string {
  const m = hex.trim().replace('#', '');
  if (m.length === 6) {
    const r = parseInt(m.slice(0, 2), 16), g = parseInt(m.slice(2, 4), 16), b = parseInt(m.slice(4, 6), 16);
    if (![r, g, b].some(Number.isNaN)) return `${r}, ${g}, ${b}`;
  }
  if (m.length === 3) {
    const r = parseInt(m[0] + m[0], 16), g = parseInt(m[1] + m[1], 16), b = parseInt(m[2] + m[2], 16);
    if (![r, g, b].some(Number.isNaN)) return `${r}, ${g}, ${b}`;
  }
  return fallback;
}

/**
 * Recompute the canvas colour registry from the active theme's CSS variables.
 * Call once at startup and once on every theme toggle — NOT per frame.
 */
export function refreshCanvasColors(): void {
  const dark = getTheme() === 'dark';

  COLORS.canvasBg = cssVar('--canvas-bg', dark ? '#0e1422' : '#FAFAFA');
  COLORS.textPrimary = cssVar('--text-primary', dark ? '#e2e8f0' : '#1A1A1A');
  COLORS.textSecondary = cssVar('--text-secondary', dark ? '#94a3b8' : '#555555');
  COLORS.textDim = cssVar('--text-dim', dark ? '#64748b' : '#888888');

  COLORS.accentGreen = cssVar('--accent-green', '#00C06B');
  COLORS.accentGreenLight = dark ? '#34D399' : '#34D399';
  COLORS.resultHighlight = COLORS.accentGreen;
  COLORS.verifyGreen = COLORS.accentGreen;
  COLORS.dimensionLine = COLORS.accentGreen;

  COLORS.arrowHeating = cssVar('--accent-amber', dark ? '#fb923c' : '#E65100');
  COLORS.arrowForce = cssVar('--accent-red', dark ? '#f87171' : '#D32F2F');
  COLORS.arrowPressure = dark ? '#60a5fa' : '#1565C0';

  // Semantic data colours — brightened on dark so they read on the navy canvas.
  COLORS.moleculeCool = dark ? '#5BB8FF' : '#42A5F5';
  COLORS.moleculeHot = dark ? '#FF7B79' : '#EF5350';
  COLORS.mercury = dark ? '#C2C8D0' : '#9E9E9E';
  COLORS.piston = dark ? '#B0A095' : '#795548';
  COLORS.gasFill = dark ? 'rgba(96, 165, 250, 0.22)' : 'rgba(144, 202, 249, 0.3)';
  COLORS.isothermalLine = dark ? '#F87171' : '#D32F2F';
  COLORS.isochoricLine = dark ? '#60A5FA' : '#1565C0';
  COLORS.isobaricLine = dark ? '#34D399' : '#059669';
  COLORS.brownianTrail = dark ? '#FF6B6B' : '#D32F2F';
  COLORS.brownianParticle = dark ? '#E2E8F0' : '#1A1A1A';
  COLORS.containerBorder = cssVar('--canvas-line', dark ? 'rgba(226, 232, 240, 0.5)' : '#333333');

  surfaceBase = hexToRgbTriplet(cssVar('--canvas-card', dark ? '#1a2234' : '#ffffff'), dark ? '26, 34, 52' : '255, 255, 255');
  lineBase = dark ? '226, 232, 240' : '15, 23, 42';
  gridStroke = cssVar('--canvas-grid', dark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(15, 23, 42, 0.035)');
}

/** Card / panel fill — white-ish on light, dark-panel on dark. */
export function surface(alpha = 1): string {
  return `rgba(${surfaceBase}, ${alpha})`;
}

/** Hairline / grid stroke — dark-on-light, light-on-dark (theme-flipped). */
export function lineInk(alpha = 1): string {
  return `rgba(${lineBase}, ${alpha})`;
}

/** Drop shadow — kept dark on both themes to preserve depth. */
export function shadowInk(alpha = 1): string {
  return `rgba(0, 0, 0, ${alpha})`;
}

/** Faint backdrop grid stroke. */
export function gridLine(): string {
  return gridStroke;
}

/** Apply an alpha to any colour (#rgb / #rrggbb / rgb() / rgba()). */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith('#')) {
    return `rgba(${hexToRgbTriplet(c, '0, 0, 0')}, ${alpha})`;
  }
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (m) {
    const [r, g, b] = m[1].split(',').map((s) => s.trim());
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return c;
}

export const CANVAS_FONTS = {
  title: 'bold 18px -apple-system, sans-serif',
  subtitle: '14px -apple-system, sans-serif',
  label: 'bold 14px -apple-system, sans-serif',
  annotation: '13px -apple-system, sans-serif',
  small: '12px -apple-system, sans-serif',
} as const;

export function speedToColor(frac: number): string {
  const r = Math.floor(66 + frac * 173);
  const g = Math.floor(165 - frac * 100);
  const b = Math.floor(245 - frac * 162);
  return `rgb(${r}, ${g}, ${b})`;
}
