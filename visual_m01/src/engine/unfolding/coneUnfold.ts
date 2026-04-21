import type { ConeParams } from '@/types/geometry';
import type { Vec2 } from './cuboidUnfold';

/** 圆锥展开结果 */
export interface ConeUnfoldResult {
  kind: 'cone';
  /** 扇形侧面 */
  sector: {
    /** 扇形圆心（展开后的顶点 P） */
    center: Vec2;
    /** 扇形半径（= 母线长 l） */
    radius: number;
    /** 扇形起始角度（弧度，从水平向右为 0） */
    startAngle: number;
    /** 扇形圆心角（弧度） */
    sweepAngle: number;
    /** 扇形弧上标注点：左端点、右端点 */
    labels: { position: Vec2; text: string }[];
  };
  /** 底面圆 */
  baseCircle: {
    center: Vec2;
    radius: number;
    /** 圆心标注 */
    label: { position: Vec2; text: string };
  };
  /** 母线长 */
  slantHeight: number;
  /** 包围盒宽高 */
  width: number;
  height: number;
}

/**
 * 圆锥展开图
 *
 * 侧面展开为扇形：
 * - 半径 = 母线长 l = √(r² + h²)
 * - 圆心角 θ = 2πr / l（弧度）
 *
 * 底面圆放在扇形下方
 *
 * 手算验证：r=1.5, h=2 → l=2.5, θ=2π×1.5/2.5=1.2π=216°
 */
export function coneUnfold(params: ConeParams): ConeUnfoldResult {
  const { radius: r, height: h } = params;

  const l = Math.sqrt(r * r + h * h); // 母线长
  const theta = (2 * Math.PI * r) / l; // 圆心角

  // 扇形居中放置，对称轴向下
  // 扇形圆心在上方，弧在下方
  const sectorCenterX = l + r; // 留出左侧空间
  const sectorCenterY = l * 0.1; // 顶部留一点 padding

  // 扇形起始角：使扇形关于竖直方向对称
  // 竖直向下是 π/2，对称分布 → 起始角 = π/2 - θ/2
  const startAngle = Math.PI / 2 - theta / 2;

  // 弧端点
  const leftEnd: Vec2 = [
    sectorCenterX + l * Math.cos(startAngle),
    sectorCenterY + l * Math.sin(startAngle),
  ];
  const rightEnd: Vec2 = [
    sectorCenterX + l * Math.cos(startAngle + theta),
    sectorCenterY + l * Math.sin(startAngle + theta),
  ];

  // 底面圆放在扇形弧最低点下方
  const sectorBottomY = sectorCenterY + l; // 扇形弧最低可能到的 Y
  const gap = r * 0.6; // 扇形与底面圆间距
  const circleCenterY = sectorBottomY + gap + r;
  const circleCenterX = sectorCenterX;

  // 包围盒
  const totalWidth = (l + r) * 2;
  const totalHeight = circleCenterY + r + r * 0.1;

  return {
    kind: 'cone',
    sector: {
      center: [sectorCenterX, sectorCenterY],
      radius: l,
      startAngle,
      sweepAngle: theta,
      labels: [
        { position: leftEnd, text: 'A' },
        { position: rightEnd, text: 'A\'' },
        { position: [sectorCenterX, sectorCenterY], text: 'P' },
      ],
    },
    baseCircle: {
      center: [circleCenterX, circleCenterY],
      radius: r,
      label: { position: [circleCenterX, circleCenterY], text: 'O' },
    },
    slantHeight: l,
    width: totalWidth,
    height: totalHeight,
  };
}
