/**
 * Design System - Main Export
 *
 * 统一导出所有设计系统模块
 * 使用方式：import { COLORS, SPACING, TYPOGRAPHY } from '@/styles'
 * 新 SYXMA Token：import { TOKENS } from '@/styles'
 */

export * from "./colors";
export * from "./spacing";
export * from "./typography";
export * as TOKENS from "./tokens";

/**
 * Quick Access Aliases
 * 快速访问设计系统常用配置
 */
import { COLORS } from "./colors";
import { SPACING } from "./spacing";
import { TYPOGRAPHY } from "./typography";

export const designSystem = {
  colors: COLORS,
  spacing: SPACING,
  typography: TYPOGRAPHY,
} as const;
