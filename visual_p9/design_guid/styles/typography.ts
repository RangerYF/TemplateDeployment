/**
 * Design System - Typography
 *
 * 基于 SYXMA-minimal 设计系统的统一字体规范
 * 字体族：Inter + PingFang SC
 * 颜色引用新 COLORS token（tokens.ts）
 */

/**
 * Font Family (字体族)
 * 对齐 syxma-minimal-demo.html body font-family
 */
export const FONT_FAMILY = {
  base: "font-[Inter,'PingFang_SC','Microsoft_YaHei',-apple-system,sans-serif]",
  /** CSS value（用于 inline style 或全局 CSS） */
  css: "'Inter', 'PingFang SC', 'Microsoft YaHei', -apple-system, sans-serif",
} as const;

/**
 * Typography Scale (字体层级)
 * 使用 Tailwind class names 格式
 * 颜色对齐 COLORS token：text #1A1A2E，textSecondary #595959，textMuted #6B7280
 */
export const TYPOGRAPHY = {
  // ============================================
  // Headings (标题层级)
  // ============================================
  h1: "text-2xl font-bold text-[#1A1A2E]", // 24px Bold
  h2: "text-xl font-semibold text-[#1A1A2E]", // 20px Semibold
  h3: "text-base font-medium text-[#1A1A2E]", // 16px Medium

  // ============================================
  // Body Text (正文文本)
  // ============================================
  body: "text-sm text-[#595959]", // 14px Regular
  bodyLarge: "text-base text-[#1A1A2E]", // 16px Regular
  bodyMedium: "text-sm font-medium text-[#1A1A2E]", // 14px Medium

  // ============================================
  // Caption & Small Text (辅助文本)
  // ============================================
  caption: "text-xs text-[#6B7280]", // 12px Regular — textMuted
  captionBold: "text-xs font-semibold text-[#1A1A2E]", // 12px Semibold

  // ============================================
  // Labels (标签文本)
  // ============================================
  label: "text-sm font-medium text-[#1A1A2E]", // 14px Medium
  labelSmall: "text-xs font-medium text-[#1A1A2E]", // 12px Medium

  // ============================================
  // Interactive Text (交互文本)
  // ============================================
  link: "text-sm text-[#00C06B] hover:text-[#00A85A] transition-colors", // 14px Primary
  button: "text-sm font-medium", // 14px Medium
  buttonLarge: "text-base font-semibold", // 16px Semibold
} as const;

/**
 * Font Weights (字重)
 */
export const FONT_WEIGHTS = {
  regular: "font-normal", // 400
  medium: "font-medium", // 500
  semibold: "font-semibold", // 600
  bold: "font-bold", // 700
} as const;

/**
 * Font Sizes (字号)
 */
export const FONT_SIZES = {
  xs: "text-xs", // 12px
  sm: "text-sm", // 14px
  base: "text-base", // 16px
  lg: "text-lg", // 18px
  xl: "text-xl", // 20px
  "2xl": "text-2xl", // 24px
  "3xl": "text-3xl", // 30px
} as const;

/**
 * Line Heights (行高)
 */
export const LINE_HEIGHTS = {
  tight: "leading-tight", // 1.25
  snug: "leading-snug", // 1.375
  normal: "leading-normal", // 1.5
  relaxed: "leading-relaxed", // 1.625 — 对齐 syxma line-height 1.65
  loose: "leading-loose", // 2
} as const;

/**
 * Text Colors (文本颜色)
 * 对齐 COLORS token（tokens.ts）
 */
export const TEXT_COLORS = {
  primary: "text-[#1A1A2E]", // 深色主文本 — COLORS.text
  secondary: "text-[#595959]", // 次要文本 — COLORS.textSecondary
  muted: "text-[#6B7280]", // 弱化文本 — COLORS.textMuted
  placeholder: "text-[#9CA3AF]", // 占位符 — COLORS.textPlaceholder
  tertiary: "text-[#BFBFBF]", // 极弱文本 — COLORS.textTertiary
  accent: "text-[#00C06B]", // 强调文本 (品牌绿) — COLORS.primary
  error: "text-[#FF4D4F]", // 错误文本 — COLORS.error
  success: "text-[#00C06B]", // 成功文本 — COLORS.success
  white: "text-white", // 白色文本
} as const;

/**
 * Component-specific Typography Presets
 * 组件级别的字体预设
 */
export const COMPONENT_TYPOGRAPHY = {
  card: {
    title: TYPOGRAPHY.h2,
    subtitle: TYPOGRAPHY.body,
    description: TYPOGRAPHY.caption,
  },
  form: {
    label: TYPOGRAPHY.label,
    input: TYPOGRAPHY.body,
    helper: TYPOGRAPHY.caption,
    error: `${TYPOGRAPHY.caption} ${TEXT_COLORS.error}`,
  },
  button: {
    primary: `${TYPOGRAPHY.button} text-white`,
    secondary: `${TYPOGRAPHY.button} ${TEXT_COLORS.primary}`,
    ghost: `${TYPOGRAPHY.button} ${TEXT_COLORS.accent}`,
  },
  navigation: {
    item: TYPOGRAPHY.bodyMedium,
    badge: TYPOGRAPHY.captionBold,
  },
} as const;

/**
 * Typography Utilities
 */
export const typographyUtils = {
  /**
   * 组合字体样式
   * @param size 字号
   * @param weight 字重
   * @param color 颜色
   */
  combine: (
    size: keyof typeof FONT_SIZES,
    weight: keyof typeof FONT_WEIGHTS,
    color?: keyof typeof TEXT_COLORS
  ): string => {
    const classes: string[] = [FONT_SIZES[size], FONT_WEIGHTS[weight]];
    if (color) classes.push(TEXT_COLORS[color]);
    return classes.join(" ");
  },

  /**
   * 创建截断文本样式
   * @param lines 截断行数 (1 = 单行, >1 = 多行)
   */
  truncate: (lines: number = 1) => {
    if (lines === 1) {
      return "truncate";
    }
    return `line-clamp-${lines}`;
  },
};

/**
 * Placeholder Styles (输入框占位符)
 */
export const PLACEHOLDER_STYLES = {
  default: "placeholder:text-[#9CA3AF]",
  light: "placeholder:text-[#BFBFBF]",
} as const;

export type TypographyKey = keyof typeof TYPOGRAPHY;
export type FontSizeKey = keyof typeof FONT_SIZES;
export type FontWeightKey = keyof typeof FONT_WEIGHTS;
export type TextColorKey = keyof typeof TEXT_COLORS;
