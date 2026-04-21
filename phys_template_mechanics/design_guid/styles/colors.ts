/**
 * Design System - Color Palette
 *
 * 基于 playground 组件的统一色彩系统
 * 提供一致的品牌色、状态色和中性色
 */

export const COLORS = {
  // ============================================
  // Primary Colors (主色调)
  // ============================================
  primary: "#32D583", // Green - 主要操作色
  primaryHover: "#28B86D", // Green Hover - 悬停状态
  primaryLight: "#32D583", // Light variant for backgrounds

  // ============================================
  // Neutral Colors (中性色)
  // ============================================
  dark: "#1A1A1E", // 深色文本/标题
  neutral: "#6B6B70", // 次要文本/说明文字
  light: "#FAFAF9", // 浅色背景
  lightAlt: "#F5F5F5", // 备用浅色背景
  border: "#E5E5E5", // 边框色
  white: "#FFFFFF", // 纯白背景
  placeholder: "#A0A0A0", // 占位符文字

  // ============================================
  // Status Colors (状态色)
  // ============================================
  success: "#10B981", // 成功状态 (Green)
  warning: "#F59E0B", // 警告状态 (Orange)
  error: "#EF4444", // 错误状态 (Red)
  info: "#3B82F6", // 信息提示 (Blue)

  // ============================================
  // Extended Status Colors (扩展状态色)
  // ============================================
  successAlt: "#52C41A", // 备用成功色
  dangerAlt: "#F5222D", // 危险/删除操作

  // ============================================
  // Background Gradients (渐变背景)
  // ============================================
  gradientPrimary: "linear-gradient(135deg, #32D583 0%, #28B86D 100%)",
} as const;

/**
 * Color Utilities
 */
export const colorUtils = {
  /**
   * 获取带透明度的颜色
   * @param color 基础颜色
   * @param opacity 透明度 (0-100)
   */
  withOpacity: (color: string, opacity: number) => `${color}/${opacity}`,

  /**
   * 创建渐变背景
   * @param from 起始颜色
   * @param to 结束颜色
   * @param angle 渐变角度 (默认 135deg)
   */
  gradient: (from: string, to: string, angle: number = 135) =>
    `linear-gradient(${angle}deg, ${from} 0%, ${to} 100%)`,
};

/**
 * CSS Variables Export (可选)
 * 用于 Tailwind 配置或全局 CSS
 */
export const cssVariables = {
  "--color-primary": COLORS.primary,
  "--color-primary-hover": COLORS.primaryHover,
  "--color-dark": COLORS.dark,
  "--color-neutral": COLORS.neutral,
  "--color-light": COLORS.light,
  "--color-border": COLORS.border,
  "--color-white": COLORS.white,
  "--color-success": COLORS.success,
  "--color-warning": COLORS.warning,
  "--color-error": COLORS.error,
  "--color-info": COLORS.info,
} as const;

export type ColorKey = keyof typeof COLORS;
