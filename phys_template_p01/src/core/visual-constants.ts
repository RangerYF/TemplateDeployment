/**
 * 统一视觉常量 — 所有渲染器和 UI 组件从这里取颜色
 *
 * 颜色规范来源：types.ts ForceType 注释 + 注册机制设计文档 §8.4
 */

import type { ForceType } from './types';

/** 力类型 → 颜色映射（权威单一来源） */
export const FORCE_COLORS: Record<ForceType, string> = {
  gravity: '#C0392B', // 深红
  normal: '#2980B9', // 蓝色
  friction: '#E67E22', // 橙色
  tension: '#27AE60', // 绿色
  electric: '#F39C12', // 金色
  lorentz: '#9B59B6', // 品红
  ampere: '#9B59B6', // 品红
  resultant: '#8E44AD', // 紫色
  spring: '#27AE60', // 绿色
  custom: '#7F8C8D', // 灰色（域扩展的自定义力）
};

/** 力类型 → 中文名称 */
export const FORCE_TYPE_NAMES: Record<ForceType, string> = {
  gravity: '重力',
  normal: '支持力',
  friction: '摩擦力',
  tension: '张力',
  electric: '电场力',
  lorentz: '洛伦兹力',
  ampere: '安培力',
  resultant: '合力',
  spring: '弹力',
  custom: '自定义力',
};
