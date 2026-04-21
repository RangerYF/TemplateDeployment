/**
 * Design Tokens - SYXMA Minimal Design System
 * 与 visual_template 共享的设计令牌
 */

export const COLORS = {
  primary: "#00C06B",
  primaryHover: "#00A85A",
  primaryLight: "#F0FBF6",
  primaryDisabled: "#B8EFD5",
  primaryFocusRing: "rgba(0, 192, 107, 0.1)",

  bg: "#FFFFFF",
  bgPage: "#F7F8FA",
  bgMuted: "#F5F5F7",
  bgHover: "#F0F0F0",
  bgActive: "#E5E7EB",

  text: "#1A1A2E",
  textSecondary: "#595959",
  textMuted: "#6B7280",
  textPlaceholder: "#9CA3AF",
  textTertiary: "#BFBFBF",

  border: "#E5E7EB",
  borderStrong: "#D1D1CF",

  success: "#00C06B",
  successLight: "#E8F8F0",
  warning: "#FAAD14",
  warningLight: "#FFF7E6",
  error: "#FF4D4F",
  errorLight: "#FFF1F0",
  info: "#1890FF",
  infoLight: "#E6F7FF",

  dark: "#1A1A2E",
  darkHover: "#2D2D4A",

  white: "#FFFFFF",
} as const;

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

export const SHADOWS = {
  sm: "0 1px 4px rgba(0, 0, 0, 0.04)",
  md: "0 2px 12px rgba(0, 0, 0, 0.06)",
  lg: "0 4px 20px rgba(0, 0, 0, 0.1)",
  toast: "0 4px 16px rgba(0, 0, 0, 0.12)",
} as const;
