/**
 * Design Tokens — SYXMA Minimal Design System (light-theme)
 *
 * Used by src/components/ui/* for interactive controls rendered
 * inside M02's right panel. Import via:
 *   import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
 *
 * NOTE: This COLORS is the SYXMA light palette (#00C06B primary).
 * For M02's dark layout/canvas, use '@/styles/colors' (#32D583 primary).
 */

export const COLORS = {
  // Brand
  primary:           '#00C06B',
  primaryHover:      '#00A85A',
  primaryLight:      '#F0FBF6',
  primaryDisabled:   '#B8EFD5',
  primaryFocusRing:  'rgba(0, 192, 107, 0.1)',

  // Neutral backgrounds
  bg:       '#FFFFFF',
  bgPage:   '#F7F8FA',
  bgMuted:  '#F5F5F7',
  bgHover:  '#F0F0F0',
  bgActive: '#E5E7EB',

  // Text
  text:            '#1A1A2E',
  textSecondary:   '#595959',
  textMuted:       '#6B7280',
  textPlaceholder: '#9CA3AF',
  textTertiary:    '#BFBFBF',

  // Border
  border:       '#E5E7EB',
  borderStrong: '#D1D1CF',

  // Semantic
  success:      '#00C06B',
  successLight: '#E8F8F0',
  warning:      '#FAAD14',
  warningLight: '#FFF7E6',
  error:        '#FF4D4F',
  errorLight:   '#FFF1F0',
  info:         '#1890FF',
  infoLight:    '#E6F7FF',

  // Dark panel
  dark:     '#1A1A2E',
  darkHover: '#2D2D4A',

  // Difficulty
  easy:     '#52C41A',
  easyBg:   '#F6FFED',
  medium:   '#FAAD14',
  mediumBg: '#FFFBE6',
  hard:     '#FF4D4F',
  hardBg:   '#FFF1F0',

  // Gradient
  gradientPrimary: 'linear-gradient(135deg, #00C06B 0%, #00A85A 100%)',

  white: '#FFFFFF',
} as const;

export const RADIUS = {
  xs:    '4px',
  sm:    '8px',
  md:    '12px',
  card:  '18px',
  input: '14px',
  lg:    '16px',
  pill:  '26px',
  full:  '9999px',
} as const;

export const SHADOWS = {
  sm:    '0 1px 4px rgba(0, 0, 0, 0.04)',
  md:    '0 2px 12px rgba(0, 0, 0, 0.06)',
  lg:    '0 4px 20px rgba(0, 0, 0, 0.1)',
  toast: '0 4px 16px rgba(0, 0, 0, 0.12)',
} as const;

export type ColorKey  = keyof typeof COLORS;
export type RadiusKey = keyof typeof RADIUS;
export type ShadowKey = keyof typeof SHADOWS;
