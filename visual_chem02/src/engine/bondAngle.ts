/**
 * 键长/键角计算工具
 * 用于标注功能：点选两个原子显示键长，点选三个原子显示键角
 */

import type { Vec3 } from './types';
import { vec3Sub, vec3Length, vec3Dot, vec3Normalize } from './types';

/** 计算两原子间距离（pm） */
export function computeBondLength(posA: Vec3, posB: Vec3): number {
  return vec3Length(vec3Sub(posB, posA)) * 100; // 场景单位 → pm
}

/** 计算三原子构成的键角（度数）。B 为中心原子 */
export function computeBondAngle(posA: Vec3, posB: Vec3, posC: Vec3): number {
  const ba = vec3Normalize(vec3Sub(posA, posB));
  const bc = vec3Normalize(vec3Sub(posC, posB));
  const dot = Math.max(-1, Math.min(1, vec3Dot(ba, bc)));
  return Math.acos(dot) * (180 / Math.PI);
}

/** 格式化键长（保留整数） */
export function formatBondLength(pm: number): string {
  return `${Math.round(pm)} pm`;
}

/** 格式化键角（保留1位小数） */
export function formatBondAngle(degrees: number): string {
  return `${degrees.toFixed(1)}°`;
}
