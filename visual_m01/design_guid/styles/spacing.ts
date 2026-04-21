/**
 * Design System - Spacing Scale
 *
 * 基于 SYXMA-minimal 设计系统的统一间距系统
 * 对齐 8px 网格（space-1 ~ space-20）
 * 参照 syxma-minimal-demo.html :root spacing variables
 */

/**
 * Spacing Scale (8px 网格间距)
 * 对齐 syxma-minimal-demo.html --space-N 变量
 *
 * | Token   | Px  | Tailwind |
 * |---------|-----|----------|
 * | space-1 |  4  | 1        |
 * | space-2 |  8  | 2        |
 * | space-3 | 12  | 3        |
 * | space-4 | 16  | 4        |
 * | space-5 | 20  | 5        |
 * | space-6 | 24  | 6        |
 * | space-8 | 32  | 8        |
 * | space-10| 40  | 10       |
 * | space-12| 48  | 12       |
 * | space-16| 64  | 16       |
 * | space-20| 80  | 20       |
 */
export const SPACING = {
  // ============================================
  // Gap Utilities (Tailwind Class Names)
  // ============================================
  "1": "gap-1", // 4px
  "2": "gap-2", // 8px
  "3": "gap-3", // 12px
  "4": "gap-4", // 16px
  "5": "gap-5", // 20px
  "6": "gap-6", // 24px
  "8": "gap-8", // 32px
  "10": "gap-10", // 40px
  "12": "gap-12", // 48px
  "16": "gap-16", // 64px
  "20": "gap-20", // 80px

  // Semantic aliases (向后兼容)
  xs: "gap-2", // 8px
  sm: "gap-3", // 12px
  md: "gap-4", // 16px
  lg: "gap-6", // 24px
  xl: "gap-8", // 32px
  "2xl": "gap-12", // 48px

  // ============================================
  // Pixel Values (用于 inline styles 或计算)
  // ============================================
  "1Px": 4,
  "2Px": 8,
  "3Px": 12,
  "4Px": 16,
  "5Px": 20,
  "6Px": 24,
  "8Px": 32,
  "10Px": 40,
  "12Px": 48,
  "16Px": 64,
  "20Px": 80,

  // Legacy aliases
  xsPx: 8,
  smPx: 12,
  mdPx: 16,
  lgPx: 24,
  xlPx: 32,
  "2xlPx": 48,
} as const;

/**
 * Padding/Margin Utilities
 * 提供完整的间距工具类
 */
export const SPACING_UTILS = {
  // ============================================
  // Padding (内边距)
  // ============================================
  padding: {
    "1": "p-1", // 4px
    "2": "p-2", // 8px
    "3": "p-3", // 12px
    "4": "p-4", // 16px
    "5": "p-5", // 20px
    "6": "p-6", // 24px
    "8": "p-8", // 32px
    "10": "p-10", // 40px
    "12": "p-12", // 48px
    "16": "p-16", // 64px
    "20": "p-20", // 80px
    // Semantic aliases
    xs: "p-2",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
    xl: "p-8",
    "2xl": "p-12",
  },

  paddingX: {
    "1": "px-1",
    "2": "px-2",
    "3": "px-3",
    "4": "px-4",
    "5": "px-5",
    "6": "px-6",
    "8": "px-8",
    "10": "px-10",
    "12": "px-12",
    "16": "px-16",
    "20": "px-20",
    xs: "px-2",
    sm: "px-3",
    md: "px-4",
    lg: "px-6",
    xl: "px-8",
    "2xl": "px-12",
  },

  paddingY: {
    "1": "py-1",
    "2": "py-2",
    "3": "py-3",
    "4": "py-4",
    "5": "py-5",
    "6": "py-6",
    "8": "py-8",
    "10": "py-10",
    "12": "py-12",
    "16": "py-16",
    "20": "py-20",
    xs: "py-2",
    sm: "py-3",
    md: "py-4",
    lg: "py-6",
    xl: "py-8",
    "2xl": "py-12",
  },

  // ============================================
  // Margin (外边距)
  // ============================================
  margin: {
    "1": "m-1",
    "2": "m-2",
    "3": "m-3",
    "4": "m-4",
    "5": "m-5",
    "6": "m-6",
    "8": "m-8",
    "10": "m-10",
    "12": "m-12",
    "16": "m-16",
    "20": "m-20",
    xs: "m-2",
    sm: "m-3",
    md: "m-4",
    lg: "m-6",
    xl: "m-8",
    "2xl": "m-12",
  },

  marginX: {
    "1": "mx-1",
    "2": "mx-2",
    "3": "mx-3",
    "4": "mx-4",
    "5": "mx-5",
    "6": "mx-6",
    "8": "mx-8",
    "10": "mx-10",
    "12": "mx-12",
    "16": "mx-16",
    "20": "mx-20",
    xs: "mx-2",
    sm: "mx-3",
    md: "mx-4",
    lg: "mx-6",
    xl: "mx-8",
    "2xl": "mx-12",
  },

  marginY: {
    "1": "my-1",
    "2": "my-2",
    "3": "my-3",
    "4": "my-4",
    "5": "my-5",
    "6": "my-6",
    "8": "my-8",
    "10": "my-10",
    "12": "my-12",
    "16": "my-16",
    "20": "my-20",
    xs: "my-2",
    sm: "my-3",
    md: "my-4",
    lg: "my-6",
    xl: "my-8",
    "2xl": "my-12",
  },

  // ============================================
  // Space (子元素间距)
  // ============================================
  spaceY: {
    "1": "space-y-1",
    "2": "space-y-2",
    "3": "space-y-3",
    "4": "space-y-4",
    "5": "space-y-5",
    "6": "space-y-6",
    "8": "space-y-8",
    "10": "space-y-10",
    "12": "space-y-12",
    xs: "space-y-2",
    sm: "space-y-3",
    md: "space-y-4",
    lg: "space-y-6",
    xl: "space-y-8",
    "2xl": "space-y-12",
  },

  spaceX: {
    "1": "space-x-1",
    "2": "space-x-2",
    "3": "space-x-3",
    "4": "space-x-4",
    "5": "space-x-5",
    "6": "space-x-6",
    "8": "space-x-8",
    "10": "space-x-10",
    "12": "space-x-12",
    xs: "space-x-2",
    sm: "space-x-3",
    md: "space-x-4",
    lg: "space-x-6",
    xl: "space-x-8",
    "2xl": "space-x-12",
  },
} as const;

/**
 * Component-specific Spacing Presets
 * 组件级别的间距预设
 */
export const COMPONENT_SPACING = {
  card: {
    padding: SPACING_UTILS.padding.lg, // 24px
    gap: SPACING.md, // 16px
  },
  form: {
    fieldGap: SPACING.md, // 16px between fields
    labelGap: SPACING.sm, // 12px between label and input
    sectionGap: SPACING.lg, // 24px between sections
  },
  layout: {
    containerPadding: SPACING_UTILS.paddingX.lg, // 24px horizontal
    sectionGap: SPACING.xl, // 32px between sections
  },
  button: {
    paddingX: SPACING_UTILS.paddingX.md, // 16px horizontal
    paddingY: "py-2.5", // 10px vertical
    gap: SPACING.xs, // 8px between icon and text
  },
} as const;

/**
 * Spacing Utilities Functions
 */
export const spacingUtils = {
  /**
   * 获取间距的像素值
   * @param token 间距 token 编号 (1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12 | 16 | 20)
   */
  getPxValue: (token: "1" | "2" | "3" | "4" | "5" | "6" | "8" | "10" | "12" | "16" | "20"): number => {
    const key = `${token}Px` as keyof typeof SPACING;
    return SPACING[key] as number;
  },

  /**
   * 创建自定义间距类名
   * @param value 间距值 (Tailwind 单位)
   */
  custom: (value: number) => `gap-${value}`,
};

export type SpacingKey = keyof typeof SPACING;
