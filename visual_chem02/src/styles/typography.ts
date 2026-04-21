/**
 * EduMind Typography - SYXMA Minimal
 */

export const FONT_FAMILY = {
  base: "font-[Inter,'PingFang_SC','Microsoft_YaHei',-apple-system,sans-serif]",
  css: "'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
} as const;

export const TYPOGRAPHY = {
  h1: "text-2xl font-bold text-eduMind-text",
  h2: "text-xl font-semibold text-eduMind-text",
  h3: "text-base font-medium text-eduMind-text",
  body: "text-sm text-eduMind-textSecondary",
  bodyLarge: "text-base text-eduMind-text",
  bodyMedium: "text-sm font-medium text-eduMind-text",
  caption: "text-xs text-eduMind-textMuted",
  captionBold: "text-xs font-semibold text-eduMind-text",
  label: "text-sm font-medium text-eduMind-text",
  labelSmall: "text-xs font-medium text-eduMind-text",
  link: "text-sm text-eduMind-primary hover:text-eduMind-primaryHover transition-colors",
  button: "text-sm font-medium",
  buttonLarge: "text-base font-semibold",
} as const;
