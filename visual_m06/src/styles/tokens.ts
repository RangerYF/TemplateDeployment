/**
 * Design Tokens — M-06 向量运算演示台
 * 与 visual_template 保持一致的设计语言
 */

export const COLORS = {
  // 品牌色
  primary: '#00C06B',
  primaryHover: '#00A85A',
  primaryLight: '#F0FBF6',
  primaryDisabled: '#B8EFD5',
  primaryFocusRing: 'rgba(0, 192, 107, 0.1)',

  // 中性色
  bg: '#FFFFFF',
  bgPage: '#F7F8FA',
  bgMuted: '#F5F5F7',
  bgHover: '#F0F0F0',
  bgActive: '#E5E7EB',

  // 文字色
  text: '#1A1A2E',
  textSecondary: '#595959',
  textMuted: '#6B7280',
  textPlaceholder: '#9CA3AF',
  textTertiary: '#BFBFBF',

  // 边框
  border: '#E5E7EB',
  borderStrong: '#D1D1CF',

  // 语义色
  success: '#00C06B',
  successLight: '#E8F8F0',
  warning: '#FAAD14',
  warningLight: '#FFF7E6',
  error: '#FF4D4F',
  errorLight: '#FFF1F0',
  info: '#1890FF',
  infoLight: '#E6F7FF',

  // 深色面板
  dark: '#1A1A2E',
  darkHover: '#2D2D4A',
  white: '#FFFFFF',

  // 坐标轴
  axis: '#000000',         // 坐标轴：纯黑

  // 向量专用色
  vecA: '#8C8C8C',       // 向量 a：灰色（默认）
  vecB: '#8C8C8C',       // 向量 b：灰色（默认）
  vecResult: '#FFD700',  // 和/差/结果向量：金色
  vecScalar: '#9C27B0',  // 数乘结果：紫色
  basis1: '#2196F3',     // 基底1：蓝色
  basis2: '#FF9800',     // 基底2：橙色
  decompTarget: '#00C06B', // 分解目标：主绿色
  negVec: '#90A4AE',     // 负向量/辅助线：灰蓝色
} as const;

export const RADIUS = {
  xs: '4px',
  sm: '8px',
  md: '12px',
  card: '18px',
  input: '14px',
  lg: '16px',
  pill: '26px',
  full: '9999px',
} as const;

export const SHADOWS = {
  sm: '0 1px 4px rgba(0, 0, 0, 0.04)',
  md: '0 2px 12px rgba(0, 0, 0, 0.06)',
  lg: '0 4px 20px rgba(0, 0, 0, 0.1)',
  toast: '0 4px 16px rgba(0, 0, 0, 0.12)',
} as const;

export type ColorKey = keyof typeof COLORS;
export type RadiusKey = keyof typeof RADIUS;
export type ShadowKey = keyof typeof SHADOWS;
