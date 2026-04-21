import type { TruncatedConeParams } from '@/types/geometry';
import type { Vec2 } from './cuboidUnfold';

/** 圆台展开结果 */
export interface TruncatedConeUnfoldResult {
  kind: 'truncatedCone';
  /** 扇环侧面 */
  annularSector: {
    /** 扇环圆心 */
    center: Vec2;
    /** 外弧半径（对应下底圆，= 母线长延长到锥顶的距离） */
    outerRadius: number;
    /** 内弧半径（对应上底圆） */
    innerRadius: number;
    /** 起始角度（弧度） */
    startAngle: number;
    /** 圆心角（弧度） */
    sweepAngle: number;
  };
  /** 底面圆（下底） */
  bottomCircle: {
    center: Vec2;
    radius: number;
    label: { position: Vec2; text: string };
  };
  /** 顶面圆（上底） */
  topCircle: {
    center: Vec2;
    radius: number;
    label: { position: Vec2; text: string };
  };
  /** 包围盒 */
  width: number;
  height: number;
}

/**
 * 圆台展开图
 *
 * 侧面展开为扇环（大扇形 - 小扇形）：
 * - 母线长 l = √((r₂-r₁)² + h²)
 * - 假想锥顶到下底距离 R₂ = r₂·l/(r₂-r₁)
 * - 假想锥顶到上底距离 R₁ = r₁·l/(r₂-r₁)
 * - 扇环圆心角 θ = 2πr₂/R₂ = 2π(r₂-r₁)/l（当 r₂ ≠ r₁ 时）
 */
export function truncatedConeUnfold(params: TruncatedConeParams): TruncatedConeUnfoldResult {
  const { topRadius: r1, bottomRadius: r2, height: h } = params;

  const dr = r2 - r1;
  const l = Math.sqrt(dr * dr + h * h); // 母线长

  // 扇环参数
  let outerR: number;
  let innerR: number;
  let theta: number;

  if (Math.abs(dr) < 1e-8) {
    // r₁ ≈ r₂：退化为圆柱，侧面展开为矩形
    // 用很大的半径近似
    outerR = 100 * r2;
    innerR = outerR - l;
    theta = (2 * Math.PI * r2) / outerR;
  } else {
    outerR = (r2 * l) / Math.abs(dr);
    innerR = (r1 * l) / Math.abs(dr);
    theta = (2 * Math.PI * r2) / outerR;
  }

  // 扇环居中放置
  const sectorCX = outerR + r2;
  const sectorCY = outerR * 0.1;

  // 扇环对称轴向下
  const startAngle = Math.PI / 2 - theta / 2;

  // 底面圆和顶面圆放在扇环下方
  const sectorBottomY = sectorCY + outerR;
  const gap = Math.max(r1, r2) * 0.5;

  // 底面圆（下底，较大）
  const bottomCY = sectorBottomY + gap + r2;
  const bottomCX = sectorCX - r2 * 1.2;

  // 顶面圆（上底，较小）
  const topCX = sectorCX + r1 * 1.2;
  const topCY = bottomCY;

  // 包围盒
  const allX = [sectorCX - outerR, sectorCX + outerR, bottomCX - r2, bottomCX + r2, topCX - r1, topCX + r1];
  const allY = [sectorCY, sectorCY + outerR, bottomCY + r2, topCY + r1];
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const maxY = Math.max(...allY);
  const padding = Math.max(r1, r2) * 0.15;

  const offsetX = -minX + padding;
  const shift = (v: Vec2): Vec2 => [v[0] + offsetX, v[1] + padding];

  return {
    kind: 'truncatedCone',
    annularSector: {
      center: shift([sectorCX, sectorCY]),
      outerRadius: outerR,
      innerRadius: innerR,
      startAngle,
      sweepAngle: theta,
    },
    bottomCircle: {
      center: shift([bottomCX, bottomCY]),
      radius: r2,
      label: { position: shift([bottomCX, bottomCY]), text: 'O' },
    },
    topCircle: {
      center: shift([topCX, topCY]),
      radius: r1,
      label: { position: shift([topCX, topCY]), text: 'O₁' },
    },
    width: maxX - minX + padding * 2,
    height: maxY + padding * 2,
  };
}
