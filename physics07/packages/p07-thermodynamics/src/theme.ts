export const COLORS = {
  canvasBg: '#FAFAFA',
  textPrimary: '#1A1A1A',
  textSecondary: '#555555',
  textDim: '#888888',
  accentGreen: '#10B981',
  accentGreenLight: '#34D399',
  resultHighlight: '#059669',
  verifyGreen: '#10B981',

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
  dimensionLine: '#10B981',
  arrowHeating: '#E65100',
  arrowForce: '#D32F2F',
  arrowPressure: '#1565C0',
} as const;

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
