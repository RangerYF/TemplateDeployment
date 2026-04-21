/**
 * Design System — Typography
 * Font: Inter + PingFang SC
 * Colors reference SYXMA tokens (tokens.ts)
 *
 * All values are Tailwind class-name strings.
 * Use in JSX: <h2 className={TYPOGRAPHY.h2}>…</h2>
 */

export const FONT_FAMILY = {
  base: "font-[Inter,'PingFang_SC','Microsoft_YaHei',-apple-system,sans-serif]",
  css:  "'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
} as const;

export const TYPOGRAPHY = {
  h1:         'text-2xl font-bold text-eduMind-text',
  h2:         'text-xl font-semibold text-eduMind-text',
  h3:         'text-base font-medium text-eduMind-text',
  body:       'text-sm text-eduMind-textSecondary',
  bodyLarge:  'text-base text-eduMind-text',
  bodyMedium: 'text-sm font-medium text-eduMind-text',
  caption:    'text-xs text-eduMind-textMuted',
  captionBold:'text-xs font-semibold text-eduMind-text',
  label:      'text-sm font-medium text-eduMind-text',
  labelSmall: 'text-xs font-medium text-eduMind-text',
  link:       'text-sm text-eduMind-primary hover:text-eduMind-primaryHover transition-colors',
  button:     'text-sm font-medium',
  buttonLarge:'text-base font-semibold',
} as const;

export const FONT_WEIGHTS = {
  regular:  'font-normal',
  medium:   'font-medium',
  semibold: 'font-semibold',
  bold:     'font-bold',
} as const;

export const FONT_SIZES = {
  xs:   'text-xs',
  sm:   'text-sm',
  base: 'text-base',
  lg:   'text-lg',
  xl:   'text-xl',
  '2xl':'text-2xl',
  '3xl':'text-3xl',
} as const;

export const TEXT_COLORS = {
  primary:     'text-eduMind-text',
  secondary:   'text-eduMind-textSecondary',
  muted:       'text-eduMind-textMuted',
  placeholder: 'text-eduMind-textPlaceholder',
  tertiary:    'text-eduMind-textTertiary',
  accent:      'text-eduMind-primary',
  error:       'text-eduMind-error',
  success:     'text-eduMind-primary',
  white:       'text-white',
} as const;

export const COMPONENT_TYPOGRAPHY = {
  card: {
    title:    TYPOGRAPHY.h2,
    subtitle: TYPOGRAPHY.body,
    description: TYPOGRAPHY.caption,
  },
  form: {
    label:  TYPOGRAPHY.label,
    input:  TYPOGRAPHY.body,
    helper: TYPOGRAPHY.caption,
    error:  `${TYPOGRAPHY.caption} ${TEXT_COLORS.error}`,
  },
  button: {
    primary:   `${TYPOGRAPHY.button} text-white`,
    secondary: `${TYPOGRAPHY.button} ${TEXT_COLORS.primary}`,
    ghost:     `${TYPOGRAPHY.button} ${TEXT_COLORS.accent}`,
  },
  navigation: {
    item:  TYPOGRAPHY.bodyMedium,
    badge: TYPOGRAPHY.captionBold,
  },
} as const;

export const typographyUtils = {
  combine: (
    size: keyof typeof FONT_SIZES,
    weight: keyof typeof FONT_WEIGHTS,
    color?: keyof typeof TEXT_COLORS,
  ): string => {
    const parts: string[] = [FONT_SIZES[size], FONT_WEIGHTS[weight]];
    if (color) parts.push(TEXT_COLORS[color]);
    return parts.join(' ');
  },

  truncate: (lines: number = 1): string =>
    lines === 1 ? 'truncate' : `line-clamp-${lines}`,
};

export type TypographyKey = keyof typeof TYPOGRAPHY;
export type FontSizeKey   = keyof typeof FONT_SIZES;
export type FontWeightKey = keyof typeof FONT_WEIGHTS;
export type TextColorKey  = keyof typeof TEXT_COLORS;
