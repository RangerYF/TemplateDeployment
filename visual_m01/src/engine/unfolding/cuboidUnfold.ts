import type { CuboidParams } from '@/types/geometry';

/** 2D 坐标 */
export type Vec2 = [number, number];

/** 展开图中的一个多边形面 */
export interface UnfoldFace {
  /** 面名称（如 "底面"、"前面"） */
  name: string;
  /** 2D 顶点坐标（按顺序围成多边形） */
  vertices: Vec2[];
  /** 每个顶点对应的 3D 标签 */
  labels: string[];
}

/** 长方体展开结果 */
export interface CuboidUnfoldResult {
  kind: 'polygon';
  faces: UnfoldFace[];
  /** 整体包围盒宽高（用于 viewBox） */
  width: number;
  height: number;
}

/**
 * 长方体十字形展开（底面居中）
 *
 *               ┌──────────┐
 *               │   顶面   │  (l × w)
 *               ├──────────┤
 *               │   后面   │  (l × h)
 *          ┌────┼──────────┼────┐
 *          │ 左 │   底面   │ 右 │  (h×w, l×w, h×w)
 *          └────┼──────────┼────┘
 *               │   前面   │  (l × h)
 *               └──────────┘
 *
 * 坐标系：X 向右，Y 向下（SVG 坐标系）
 *
 * 长方体参数：length(X) × width(Z) × height(Y)
 * 3D 顶点（与 cuboid builder 一致）：
 * 0:A(-hl,0,hw)  1:B(hl,0,hw)  2:C(hl,0,-hw)  3:D(-hl,0,-hw)
 * 4:A₁(-hl,h,hw) 5:B₁(hl,h,hw) 6:C₁(hl,h,-hw) 7:D₁(-hl,h,-hw)
 *
 * 铰链边关系：
 * 底面 ↔ 后面 : DC 边    底面 ↔ 前面 : AB 边
 * 底面 ↔ 左面 : DA 边    底面 ↔ 右面 : CB 边
 * 后面 ↔ 顶面 : D₁C₁ 边
 */
export function cuboidUnfold(params: CuboidParams): CuboidUnfoldResult {
  const { length: l, width: w, height: h } = params;

  // midX = 左面宽度 = h（左面 h×w，3D 高度 h 展开为水平方向）
  // midY = 顶面高度 w + 后面高度 h
  const midX = h;
  const midY = w + h;

  // ── 底面 (ABCD) — 十字形中心 ──
  // SVG X 对应 3D X：左=-hl(D侧) 右=+hl(C侧)
  // SVG Y 对应 3D Z：上=-hw(后/D侧) 下=+hw(前/A侧)
  const bottom: UnfoldFace = {
    name: '底面',
    vertices: [
      [midX, midY],               // D（上左）
      [midX + l, midY],           // C（上右）
      [midX + l, midY + w],       // B（下右）
      [midX, midY + w],           // A（下左）
    ],
    labels: ['D', 'C', 'B', 'A'],
  };

  // ── 后面 (DCC₁D₁) — 绕 DC 边向上翻折 ──
  const back: UnfoldFace = {
    name: '后面',
    vertices: [
      [midX, midY - h],           // D₁
      [midX + l, midY - h],       // C₁
      [midX + l, midY],           // C（铰链）
      [midX, midY],               // D（铰链）
    ],
    labels: ['D₁', 'C₁', 'C', 'D'],
  };

  // ── 顶面 — 绕 D₁C₁ 边继续向上翻折 ──
  const top: UnfoldFace = {
    name: '顶面',
    vertices: [
      [midX, 0],                  // A₁
      [midX + l, 0],              // B₁
      [midX + l, midY - h],       // C₁（铰链）
      [midX, midY - h],           // D₁（铰链）
    ],
    labels: ['A₁', 'B₁', 'C₁', 'D₁'],
  };

  // ── 前面 (ABB₁A₁) — 绕 AB 边向下翻折 ──
  const front: UnfoldFace = {
    name: '前面',
    vertices: [
      [midX, midY + w],           // A（铰链）
      [midX + l, midY + w],       // B（铰链）
      [midX + l, midY + w + h],   // B₁
      [midX, midY + w + h],       // A₁
    ],
    labels: ['A', 'B', 'B₁', 'A₁'],
  };

  // ── 左面 (DAA₁D₁) — 绕 DA 边向左翻折 ──
  const left: UnfoldFace = {
    name: '左面',
    vertices: [
      [0, midY],                  // D₁
      [midX, midY],               // D（铰链）
      [midX, midY + w],           // A（铰链）
      [0, midY + w],              // A₁
    ],
    labels: ['D₁', 'D', 'A', 'A₁'],
  };

  // ── 右面 (CBB₁C₁) — 绕 CB 边向右翻折 ──
  const right: UnfoldFace = {
    name: '右面',
    vertices: [
      [midX + l, midY],           // C（铰链）
      [midX + l + h, midY],       // C₁
      [midX + l + h, midY + w],   // B₁
      [midX + l, midY + w],       // B（铰链）
    ],
    labels: ['C', 'C₁', 'B₁', 'B'],
  };

  const totalWidth = h + l + h;
  const totalHeight = w + h + w + h;

  return {
    kind: 'polygon',
    faces: [bottom, top, back, front, left, right],
    width: totalWidth,
    height: totalHeight,
  };
}
