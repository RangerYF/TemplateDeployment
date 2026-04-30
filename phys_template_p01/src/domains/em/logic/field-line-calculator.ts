/**
 * 电场线与等势线计算器
 *
 * - 电场线：从电荷表面等角出发，RK4 积分追踪
 * - 等势线：网格采样 + marching squares 提取等势轮廓
 * - 正电荷沿场方向追踪，负电荷逆向追踪
 * - 线条数量随 |q| 动态调整
 *
 * 电场向量公式（库仑定律向量形式）：
 *   E = k * q * r_vec / |r|^3
 * 即：
 *   Ex += k * q * dx / (r*r*r)
 *   Ey += k * q * dy / (r*r*r)
 */

import type { FieldLineDensity, Vec2 } from '@/core/types';

// ─── 公共接口 ───────────────────────────────────────

export interface FieldLine {
  points: Vec2[];
  startChargeId: string;
  /** 来源电荷符号：1=正电荷, -1=负电荷 */
  sourceSign: 1 | -1;
}

export interface EquipotentialLine {
  points: Vec2[];
  voltage: number;
}

interface ChargeInfo {
  id: string;
  position: Vec2;
  charge: number; // 单位：C（调用方需已转换）
  radius?: number; // m，渲染半径（用于自适应起点/终点距离）
}

interface ChargeBase {
  position: Vec2;
  charge: number;
  radius?: number;
}

interface Bounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

// ─── 常量 ───────────────────────────────────────────

const K = 8.99e9; // 库仑常数
const MAX_STEPS = 600;
const BASE_LINES = 12; // 基础电场线数量
const REFERENCE_CHARGE = 1e-6; // C，1 μC 对应 BASE_LINES
const MIN_LINES = 6;
const MAX_LINES = 24;
const MIN_FIELD_THRESHOLD = 1e-4; // 场强过小终止阈值（鞍点检测）
const MIN_STEP_SIZE = 0.002;
const MAX_STEP_SIZE = 0.04;
const MIN_GRID_SPACING = 0.005;
const MAX_GRID_SPACING = 0.05;
const DEFAULT_START_RADIUS = 0.18;
const DEFAULT_TERMINATE_DISTANCE = 0.12;
const DEFAULT_MARGIN = 0.5;
const DEFAULT_SINGULARITY_PADDING = 0.2;

interface FieldTraceConfig {
  stepSize: number;
  margin: number;
  startRadius: number;
  terminateDistance: number;
}

interface FieldLineOptions {
  density?: FieldLineDensity;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function densityFactor(density: FieldLineDensity): number {
  switch (density) {
    case 'sparse':
      return 0.7;
    case 'dense':
      return 1.4;
    case 'standard':
    default:
      return 1;
  }
}

function equipotentialLineCountForDensity(density: FieldLineDensity): number {
  switch (density) {
    case 'sparse':
      return 4;
    case 'dense':
      return 8;
    case 'standard':
    default:
      return 6;
  }
}

function computeNearestChargeDistance(charges: ChargeBase[]): number | null {
  let minDistance = Infinity;

  for (let i = 0; i < charges.length; i++) {
    for (let j = i + 1; j < charges.length; j++) {
      const a = charges[i]!;
      const b = charges[j]!;
      const dx = a.position.x - b.position.x;
      const dy = a.position.y - b.position.y;
      const distance = Math.hypot(dx, dy);
      if (distance > 1e-8) {
        minDistance = Math.min(minDistance, distance);
      }
    }
  }

  return Number.isFinite(minDistance) ? minDistance : null;
}

function computeFieldTraceConfig(
  charges: ChargeBase[],
  bounds: Bounds,
): FieldTraceConfig {
  const spanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const spanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const span = Math.max(spanX, spanY);
  const nearestDistance = computeNearestChargeDistance(charges);
  const avgRadius =
    charges.reduce((sum, charge) => sum + (charge.radius ?? 0), 0) /
    Math.max(charges.length, 1);

  const characteristicLength = nearestDistance ?? span / 6;
  const startRadius = clamp(
    Math.max(avgRadius * 1.2, characteristicLength * 0.12, 0.012),
    0.012,
    DEFAULT_START_RADIUS,
  );
  const terminateDistance = clamp(
    Math.max(avgRadius * 1.5, characteristicLength * 0.1, 0.01),
    0.01,
    DEFAULT_TERMINATE_DISTANCE,
  );
  const stepSize = clamp(
    characteristicLength / 25,
    MIN_STEP_SIZE,
    MAX_STEP_SIZE,
  );
  const margin = clamp(
    Math.max(stepSize * 4, characteristicLength * 0.2, 0.08),
    0.08,
    DEFAULT_MARGIN,
  );

  return {
    stepSize,
    margin,
    startRadius,
    terminateDistance,
  };
}

// ─── 电场计算（向量形式 E = kq * r_vec / |r|^3）───────

/**
 * 计算点 pos 处的合电场（向量叠加）
 *
 * 对每个电荷 i：
 *   dx = pos.x - xi,  dy = pos.y - yi
 *   r = sqrt(dx² + dy²)
 *   Ex += k * qi * dx / (r*r*r)
 *   Ey += k * qi * dy / (r*r*r)
 */
function electricField(pos: Vec2, charges: ChargeBase[]): Vec2 {
  let ex = 0;
  let ey = 0;
  for (const c of charges) {
    const dx = pos.x - c.position.x;
    const dy = pos.y - c.position.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-10) continue; // 避免奇点
    const r = Math.sqrt(r2);
    const r3 = r * r * r;
    // E = k * q * r_vec / |r|^3 — 直接向量形式，不拆分标量
    ex += K * c.charge * dx / r3;
    ey += K * c.charge * dy / r3;
  }
  return { x: ex, y: ey };
}

function electricPotential(pos: Vec2, charges: ChargeBase[]): number {
  let v = 0;
  for (const c of charges) {
    const dx = pos.x - c.position.x;
    const dy = pos.y - c.position.y;
    const r = Math.sqrt(dx * dx + dy * dy);
    if (r < 1e-10) continue;
    v += K * c.charge / r;
  }
  return v;
}

// ─── RK4 归一化场方向步进 ────────────────────────────

/** 返回归一化电场方向（单位向量），乘以 direction 控制正/逆向 */
function fieldDirection(pos: Vec2, charges: ChargeBase[], direction: 1 | -1): Vec2 {
  const e = electricField(pos, charges);
  const mag = Math.sqrt(e.x * e.x + e.y * e.y);
  if (mag < 1e-20) return { x: 0, y: 0 };
  return { x: direction * e.x / mag, y: direction * e.y / mag };
}

function rk4Step(
  pos: Vec2,
  charges: ChargeBase[],
  direction: 1 | -1,
  h: number,
): Vec2 {
  const k1 = fieldDirection(pos, charges, direction);
  const k2 = fieldDirection(
    { x: pos.x + 0.5 * h * k1.x, y: pos.y + 0.5 * h * k1.y },
    charges, direction,
  );
  const k3 = fieldDirection(
    { x: pos.x + 0.5 * h * k2.x, y: pos.y + 0.5 * h * k2.y },
    charges, direction,
  );
  const k4 = fieldDirection(
    { x: pos.x + h * k3.x, y: pos.y + h * k3.y },
    charges, direction,
  );

  return {
    x: pos.x + (h / 6) * (k1.x + 2 * k2.x + 2 * k3.x + k4.x),
    y: pos.y + (h / 6) * (k1.y + 2 * k2.y + 2 * k3.y + k4.y),
  };
}

// ─── 电场线追踪 ─────────────────────────────────────

function traceFieldLine(
  startPos: Vec2,
  charges: ChargeInfo[],
  bounds: Bounds,
  direction: 1 | -1,
  config: FieldTraceConfig,
): Vec2[] {
  const points: Vec2[] = [{ ...startPos }];
  let pos = { ...startPos };
  let prevDir: Vec2 | null = null;

  for (let i = 0; i < MAX_STEPS; i++) {
    // 计算当前场强
    const e = electricField(pos, charges);
    const eMag = Math.sqrt(e.x * e.x + e.y * e.y);

    // 鞍点检测：场强过小（同号电荷中点附近 E→0）
    if (eMag < MIN_FIELD_THRESHOLD) break;

    // 方向反转检测：与前一步方向的点积 < 0 说明经过了鞍点
    const curDir: Vec2 = { x: direction * e.x / eMag, y: direction * e.y / eMag };
    if (prevDir !== null) {
      const dot = curDir.x * prevDir.x + curDir.y * prevDir.y;
      if (dot < 0) break; // 方向反转 → 经过鞍点，截断
    }
    prevDir = curDir;

    // RK4 步进
    const nextPos = rk4Step(pos, charges, direction, config.stepSize);

    // 检测是否到达异号电荷（正向追踪找负电荷，逆向追踪找正电荷）
    for (const c of charges) {
      const isTarget = direction === 1 ? c.charge < 0 : c.charge > 0;
      if (!isTarget) continue;
      const dx = nextPos.x - c.position.x;
      const dy = nextPos.y - c.position.y;
      const stopDistance = Math.max(config.terminateDistance, (c.radius ?? 0) * 1.5);
      if (Math.sqrt(dx * dx + dy * dy) < stopDistance) {
        points.push({ x: c.position.x, y: c.position.y });
        return points;
      }
    }

    // 检测是否回到了同号电荷（避免自循环），跳过起点附近的前几步
    if (i > 5) {
      for (const c of charges) {
        const isSameSign = direction === 1 ? c.charge > 0 : c.charge < 0;
        if (!isSameSign) continue;
        const dx = nextPos.x - c.position.x;
        const dy = nextPos.y - c.position.y;
        const stopDistance = Math.max(config.terminateDistance, (c.radius ?? 0) * 1.5);
        if (Math.sqrt(dx * dx + dy * dy) < stopDistance) {
          points.push({ ...nextPos });
          return points;
        }
      }
    }

    // 出界检测
    if (
      nextPos.x < bounds.minX - config.margin ||
      nextPos.x > bounds.maxX + config.margin ||
      nextPos.y < bounds.minY - config.margin ||
      nextPos.y > bounds.maxY + config.margin
    ) {
      points.push({ ...nextPos });
      break;
    }

    points.push({ ...nextPos });
    pos = nextPos;
  }

  return points;
}

// ─── 起始角度计算（避开同号电荷方向）────────────────

/**
 * 计算电荷 c 的电场线起始角度列表。
 *
 * 关键：避免任何起始角精确对准另一个同号电荷的方向。
 * 物理原因：两同号电荷连线是不稳定平衡线（分离线/鞍点线），
 * 数值追踪中如果精确在此线上，由于完美对称 dy≡0，线永远不会弯曲，
 * 产生错误的"水平贯穿"电场线。
 *
 * 方法：计算从 c 指向每个同号电荷的"禁止角"，然后旋转整个角度分布，
 * 使所有禁止角落在两条相邻电场线的正中间。
 */
function computeStartAngles(
  c: ChargeInfo,
  allCharges: ChargeInfo[],
  numLines: number,
): number[] {
  // 找出所有同号电荷的方向角（禁止角）
  const forbiddenAngles: number[] = [];
  for (const other of allCharges) {
    if (other.id === c.id) continue;
    // 同号电荷
    if ((c.charge > 0 && other.charge > 0) || (c.charge < 0 && other.charge < 0)) {
      const dx = other.position.x - c.position.x;
      const dy = other.position.y - c.position.y;
      forbiddenAngles.push(Math.atan2(dy, dx));
    }
  }

  // 基础等间距角度
  const spacing = (2 * Math.PI) / numLines;

  if (forbiddenAngles.length === 0) {
    // 无同号电荷，直接等间距
    return Array.from({ length: numLines }, (_, i) => i * spacing);
  }

  // 计算偏移量：使第一个禁止角落在两条线的正中间
  // 即：禁止角 = offset + (k + 0.5) * spacing  →  offset = 禁止角 - (k + 0.5) * spacing
  // 取第一个禁止角，找最近的半步格点
  const fa = forbiddenAngles[0]!;
  // fa 应该落在 offset + (k+0.5)*spacing 处
  // 取 k = round(fa/spacing - 0.5)，则 offset = fa - (k+0.5)*spacing
  const k = Math.round(fa / spacing - 0.5);
  const offset = fa - (k + 0.5) * spacing;

  return Array.from({ length: numLines }, (_, i) => offset + i * spacing);
}

// ─── 动态线条数量 ────────────────────────────────────

/**
 * 根据 |q| 决定电场线数量。
 *
 * 这里使用绝对电荷量映射：
 * - 1 μC → 12 条线（默认）
 * - 更小电荷减少线数
 * - 更大电荷增加线数
 */
function linesForCharge(absQ: number, density: FieldLineDensity): number {
  if (absQ < 1e-20) return MIN_LINES;
  const scaledLines = Math.round(
    BASE_LINES * (absQ / REFERENCE_CHARGE) * densityFactor(density),
  );
  return Math.max(MIN_LINES, Math.min(MAX_LINES, scaledLines));
}

// ─── 公共 API ───────────────────────────────────────

export function calculateFieldLines(
  charges: Array<{ id: string; position: Vec2; charge: number; radius?: number }>,
  bounds: Bounds,
  options?: FieldLineOptions,
): FieldLine[] {
  const lines: FieldLine[] = [];
  if (charges.length === 0) return lines;

  const density = options?.density ?? 'standard';
  const traceConfig = computeFieldTraceConfig(charges, bounds);
  const positives = charges.filter((charge) => charge.charge > 0);
  const negatives = charges.filter((charge) => charge.charge < 0);
  const emitters = positives.length > 0 ? positives : negatives;

  for (const c of emitters) {
    if (c.charge === 0) continue;

    const isPositive = c.charge > 0;
    const numLines = linesForCharge(Math.abs(c.charge), density);
    const angles = computeStartAngles(c, charges, numLines);

    for (const angle of angles) {
      const startRadius = Math.max(traceConfig.startRadius, (c.radius ?? 0) * 1.2);
      const startPos: Vec2 = {
        x: c.position.x + startRadius * Math.cos(angle),
        y: c.position.y + startRadius * Math.sin(angle),
      };

      // 正电荷沿场方向出发，负电荷逆场方向出发
      const direction: 1 | -1 = isPositive ? 1 : -1;
      const points = traceFieldLine(startPos, charges, bounds, direction, traceConfig);

      if (points.length > 2) {
        lines.push({
          points,
          startChargeId: c.id,
          sourceSign: isPositive ? 1 : -1,
        });
      }
    }
  }

  return lines;
}

export function calculateEquipotentialLines(
  charges: Array<{ position: Vec2; charge: number; radius?: number }>,
  bounds: Bounds,
  options?: FieldLineOptions & { numLines?: number },
): EquipotentialLine[] {
  if (charges.length === 0) return [];

  const density = options?.density ?? 'standard';
  const numLines = options?.numLines ?? equipotentialLineCountForDensity(density);
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY, 1e-6);
  const avgRadius =
    charges.reduce((sum, charge) => sum + (charge.radius ?? 0), 0) /
    Math.max(charges.length, 1);
  const gridSpacing = clamp(span / 120, MIN_GRID_SPACING, MAX_GRID_SPACING);
  const singularityPadding = clamp(
    Math.max(avgRadius * 1.6, gridSpacing * 2, 0.03),
    0.03,
    DEFAULT_SINGULARITY_PADDING,
  );

  // 网格采样
  const cols = Math.ceil((bounds.maxX - bounds.minX) / gridSpacing) + 1;
  const rows = Math.ceil((bounds.maxY - bounds.minY) / gridSpacing) + 1;

  // 限制网格规模
  const maxDim = 200;
  const actualCols = Math.min(cols, maxDim);
  const actualRows = Math.min(rows, maxDim);
  const actualSpacingX = (bounds.maxX - bounds.minX) / (actualCols - 1);
  const actualSpacingY = (bounds.maxY - bounds.minY) / (actualRows - 1);

  // 采样电位网格
  const grid = new Float64Array(actualRows * actualCols);
  let vMin = Infinity;
  let vMax = -Infinity;

  const gridAt = (row: number, col: number): number => grid[row * actualCols + col] ?? 0;

  for (let row = 0; row < actualRows; row++) {
    for (let col = 0; col < actualCols; col++) {
      const pos: Vec2 = {
        x: bounds.minX + col * actualSpacingX,
        y: bounds.minY + row * actualSpacingY,
      };

      // 避开电荷附近的奇点
      let tooClose = false;
      for (const c of charges) {
        const dx = pos.x - c.position.x;
        const dy = pos.y - c.position.y;
        if (Math.sqrt(dx * dx + dy * dy) < singularityPadding) {
          tooClose = true;
          break;
        }
      }

      if (tooClose) {
        grid[row * actualCols + col] = NaN;
      } else {
        const v = electricPotential(pos, charges);
        grid[row * actualCols + col] = v;
        if (!isNaN(v) && isFinite(v)) {
          if (v < vMin) vMin = v;
          if (v > vMax) vMax = v;
        }
      }
    }
  }

  if (!isFinite(vMin) || !isFinite(vMax) || vMin >= vMax) return [];

  // 选择等势线电位值
  const isoValues: number[] = [];
  const positiveMax = Math.min(vMax, 1e8);
  const negativeMin = Math.max(vMin, -1e8);

  if (positiveMax > 100) {
    const count = Math.ceil(numLines / 2);
    for (let i = 1; i <= count; i++) {
      isoValues.push(positiveMax * (i / (count + 1)));
    }
  }
  if (negativeMin < -100) {
    const count = Math.ceil(numLines / 2);
    for (let i = 1; i <= count; i++) {
      isoValues.push(negativeMin * (i / (count + 1)));
    }
  }
  if (isoValues.length === 0) {
    for (let i = 1; i <= numLines; i++) {
      isoValues.push(vMin + (vMax - vMin) * (i / (numLines + 1)));
    }
  }

  // Marching squares 提取等值线
  const result: EquipotentialLine[] = [];

  for (const isoVal of isoValues) {
    const segments: Array<[Vec2, Vec2]> = [];

    for (let row = 0; row < actualRows - 1; row++) {
      for (let col = 0; col < actualCols - 1; col++) {
        const v00 = gridAt(row, col);
        const v10 = gridAt(row, col + 1);
        const v01 = gridAt(row + 1, col);
        const v11 = gridAt(row + 1, col + 1);

        if (isNaN(v00) || isNaN(v10) || isNaN(v01) || isNaN(v11)) continue;
        if (!isFinite(v00) || !isFinite(v10) || !isFinite(v01) || !isFinite(v11)) continue;

        const x0 = bounds.minX + col * actualSpacingX;
        const y0 = bounds.minY + row * actualSpacingY;
        const x1 = x0 + actualSpacingX;
        const y1 = y0 + actualSpacingY;

        const caseIndex =
          ((v00 >= isoVal ? 1 : 0)) |
          ((v10 >= isoVal ? 1 : 0) << 1) |
          ((v11 >= isoVal ? 1 : 0) << 2) |
          ((v01 >= isoVal ? 1 : 0) << 3);

        if (caseIndex === 0 || caseIndex === 15) continue;

        const lerp = (va: number, vb: number, pa: number, pb: number): number => {
          const t = (isoVal - va) / (vb - va);
          return pa + t * (pb - pa);
        };

        const bottom: Vec2 = { x: lerp(v00, v10, x0, x1), y: y0 };
        const right: Vec2 = { x: x1, y: lerp(v10, v11, y0, y1) };
        const top: Vec2 = { x: lerp(v01, v11, x0, x1), y: y1 };
        const left: Vec2 = { x: x0, y: lerp(v00, v01, y0, y1) };

        const addSeg = (a: Vec2, b: Vec2) => segments.push([a, b]);

        switch (caseIndex) {
          case 1: addSeg(bottom, left); break;
          case 2: addSeg(right, bottom); break;
          case 3: addSeg(right, left); break;
          case 4: addSeg(top, right); break;
          case 5: addSeg(bottom, right); addSeg(top, left); break;
          case 6: addSeg(top, bottom); break;
          case 7: addSeg(top, left); break;
          case 8: addSeg(left, top); break;
          case 9: addSeg(bottom, top); break;
          case 10: addSeg(bottom, left); addSeg(top, right); break;
          case 11: addSeg(right, top); break;
          case 12: addSeg(left, right); break;
          case 13: addSeg(right, bottom); break;
          case 14: addSeg(left, bottom); break;
        }
      }
    }

    if (segments.length > 0) {
      const chains = chainSegments(segments);
      for (const chain of chains) {
        if (chain.length >= 3) {
          result.push({ points: chain, voltage: isoVal });
        }
      }
    }
  }

  return result;
}

// ─── 辅助：将线段串联为多段线 ───────────────────────

function chainSegments(segments: Array<[Vec2, Vec2]>): Vec2[][] {
  const eps = 1e-6;
  const used = new Array<boolean>(segments.length).fill(false);
  const chains: Vec2[][] = [];

  const close = (a: Vec2, b: Vec2): boolean =>
    Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps;

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;

    const seg = segments[i]!;
    const chain: Vec2[] = [seg[0], seg[1]];
    let extended = true;

    while (extended) {
      extended = false;
      for (let j = 0; j < segments.length; j++) {
        if (used[j]) continue;
        const s = segments[j]!;
        const tail = chain[chain.length - 1]!;
        if (close(tail, s[0])) {
          chain.push(s[1]);
          used[j] = true;
          extended = true;
        } else if (close(tail, s[1])) {
          chain.push(s[0]);
          used[j] = true;
          extended = true;
        }
      }
    }

    chains.push(chain);
  }

  return chains;
}
