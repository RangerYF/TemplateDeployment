/**
 * Design Tokens - SYXMA Minimal Design System
 *
 * 完整迁移自 syxma-minimal-demo.html 的 CSS Variables
 * 所有色值、圆角、阴影的单一真相源 (Single Source of Truth)
 */

// ============================================
// COLORS - 色彩系统
// ============================================
export const COLORS = {
  // Brand Colors (品牌色)
  primary: "#00C06B",
  primaryHover: "#00A85A",
  primaryLight: "#F0FBF6",
  primaryDisabled: "#B8EFD5",
  primaryFocusRing: "rgba(0, 192, 107, 0.1)",

  // Neutral Colors (中性色)
  bg: "#FFFFFF",
  bgPage: "#F7F8FA",
  bgMuted: "#F5F5F7",
  bgHover: "#F0F0F0",
  bgActive: "#E5E7EB",

  // Text Colors (文本色)
  text: "#1A1A2E",
  textSecondary: "#595959",
  textMuted: "#6B7280",
  textPlaceholder: "#9CA3AF",
  textTertiary: "#BFBFBF",

  // Border (边框色)
  border: "#E5E7EB",
  borderStrong: "#D1D1CF",

  // Semantic / Functional (语义色)
  success: "#00C06B",
  successLight: "#E8F8F0",
  warning: "#FAAD14",
  warningLight: "#FFF7E6",
  error: "#FF4D4F",
  errorLight: "#FFF1F0",
  info: "#1890FF",
  infoLight: "#E6F7FF",

  // Dark Panel (深色面板)
  dark: "#1A1A2E",
  darkHover: "#2D2D4A",

  // Difficulty Colors (难度色)
  easy: "#52C41A",
  easyBg: "#F6FFED",
  medium: "#FAAD14",
  mediumBg: "#FFFBE6",
  hard: "#FF4D4F",
  hardBg: "#FFF1F0",

  // Gradients (渐变)
  gradientPrimary: "linear-gradient(135deg, #00C06B 0%, #00A85A 100%)",

  // Pure white
  white: "#FFFFFF",
} as const;

// ============================================
// RADIUS - 圆角系统
// ============================================
export const RADIUS = {
  xs: "4px",
  sm: "8px",
  md: "12px",
  card: "18px",
  input: "14px",
  lg: "16px",
  pill: "26px",
  full: "9999px",
} as const;

// ============================================
// SHADOWS - 阴影系统
// ============================================
export const SHADOWS = {
  sm: "0 1px 4px rgba(0, 0, 0, 0.04)",
  md: "0 2px 12px rgba(0, 0, 0, 0.06)",
  lg: "0 4px 20px rgba(0, 0, 0, 0.1)",
  toast: "0 4px 16px rgba(0, 0, 0, 0.12)",
} as const;

// ============================================
// Type Exports
// ============================================
export type ColorKey = keyof typeof COLORS;
export type RadiusKey = keyof typeof RADIUS;
export type ShadowKey = keyof typeof SHADOWS;
