/**
 * 麦克斯韦速率分布工具函数
 *
 * 功能：随机速率采样、直方图统计、理论曲线生成
 */

import { kB } from './gas-law-utils';

/**
 * Box-Muller 变换：生成标准正态分布随机数
 */
function boxMuller(): number {
  let u1 = 0;
  let u2 = 0;
  while (u1 === 0) u1 = Math.random();
  while (u2 === 0) u2 = Math.random();
  return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
}

/**
 * 从麦克斯韦分布采样单个分子的速度分量
 * @param temperature 温度 (K)
 * @param mass 分子质量 (kg)
 * @returns 速度分量 (m/s)
 */
export function sampleVelocityComponent(temperature: number, mass: number): number {
  const sigma = Math.sqrt(kB * temperature / mass);
  return sigma * boxMuller();
}

/**
 * 初始化 N 个分子的位置和速度
 * @param count 分子数量
 * @param temperature 温度 (K)
 * @param mass 分子质量 (kg)
 * @param width 容器宽度 (m)
 * @param height 容器高度 (m)
 * @returns { positions: number[], velocities: number[] }
 */
export function initializeMolecules(
  count: number,
  temperature: number,
  mass: number,
  width: number,
  height: number,
): { positions: number[]; velocities: number[] } {
  const positions: number[] = [];
  const velocities: number[] = [];

  for (let i = 0; i < count; i++) {
    // 均匀随机分布位置
    positions.push(Math.random() * width);
    positions.push(Math.random() * height);

    // 麦克斯韦分布速度
    velocities.push(sampleVelocityComponent(temperature, mass));
    velocities.push(sampleVelocityComponent(temperature, mass));
  }

  return { positions, velocities };
}

/**
 * 重新采样所有分子速度（温度变化时调用）
 */
export function resampleVelocities(
  count: number,
  temperature: number,
  mass: number,
): number[] {
  const velocities: number[] = [];
  for (let i = 0; i < count; i++) {
    velocities.push(sampleVelocityComponent(temperature, mass));
    velocities.push(sampleVelocityComponent(temperature, mass));
  }
  return velocities;
}

/**
 * 计算速率分布直方图
 * @param velocities 速度数组 [vx1,vy1,vx2,vy2,...]
 * @param binCount 分箱数量
 * @returns { histogram: number[], bins: number[] }
 */
export function computeSpeedHistogram(
  velocities: number[],
  binCount: number = 20,
): { histogram: number[]; bins: number[] } {
  const speeds: number[] = [];
  for (let i = 0; i < velocities.length; i += 2) {
    const vx = velocities[i] ?? 0;
    const vy = velocities[i + 1] ?? 0;
    speeds.push(Math.sqrt(vx * vx + vy * vy));
  }

  if (speeds.length === 0) {
    return { histogram: [], bins: [] };
  }

  const maxSpeed = Math.max(...speeds);
  const binWidth = maxSpeed / binCount || 1;

  const histogram = new Array<number>(binCount).fill(0);
  const bins: number[] = [];

  for (let i = 0; i <= binCount; i++) {
    bins.push(i * binWidth);
  }

  for (const s of speeds) {
    const idx = Math.min(Math.floor(s / binWidth), binCount - 1);
    histogram[idx] = (histogram[idx] ?? 0) + 1;
  }

  // 归一化为概率密度
  const total = speeds.length * binWidth;
  for (let i = 0; i < histogram.length; i++) {
    histogram[i] = (histogram[i] ?? 0) / total;
  }

  return { histogram, bins };
}

/**
 * 麦克斯韦速率分布理论值
 * f(v) = 4π·n·(m/(2πkT))^(3/2)·v²·exp(-mv²/(2kT))
 * 2D 简化版：f(v) = (m/kT)·v·exp(-mv²/(2kT))
 */
export function maxwellSpeedDistribution2D(
  v: number,
  temperature: number,
  mass: number,
): number {
  const factor = mass / (kB * temperature);
  return factor * v * Math.exp(-0.5 * factor * v * v);
}

/**
 * 最概然速率 (2D)
 * v_p = sqrt(kT/m)
 */
export function mostProbableSpeed2D(temperature: number, mass: number): number {
  return Math.sqrt(kB * temperature / mass);
}

/**
 * 均方根速率
 * v_rms = sqrt(2kT/m)  (2D)
 */
export function rmsSpeed2D(temperature: number, mass: number): number {
  return Math.sqrt(2 * kB * temperature / mass);
}
