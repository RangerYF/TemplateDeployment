import type { Vec2 } from '@/core/types';

/**
 * 布局工具函数
 *
 * - 力标签：局部防重叠（placeLabel）
 * - Popover：简单方向选择（pickPopoverPosition）
 * - 不再有全局共享的障碍物池
 */

const LABEL_PAD = 6; // 标签间最小间距 px

export interface PlacementBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** 两个 box 是否重叠（含 pad 间距） */
function boxesOverlap(a: PlacementBox, b: PlacementBox, pad: number): boolean {
  return !(
    a.left + a.width + pad <= b.left ||
    b.left + b.width + pad <= a.left ||
    a.top + a.height + pad <= b.top ||
    b.top + b.height + pad <= a.top
  );
}

/**
 * 从候选位置中选一个不与已有 boxes 重叠的位置
 * 所有候选都重叠时选第一个（偏好最高）
 * 放置后自动将结果 push 到 occupied 数组
 */
export function placeLabel(
  candidates: Array<{ left: number; top: number; preference: number }>,
  width: number,
  height: number,
  occupied: PlacementBox[],
): { left: number; top: number } {
  // 候选已按 preference 排序（index 0 = 最偏好）
  for (const cand of candidates) {
    const box: PlacementBox = { left: cand.left, top: cand.top, width, height };
    const overlaps = occupied.some((obs) => boxesOverlap(box, obs, LABEL_PAD));
    if (!overlaps) {
      occupied.push(box);
      return { left: cand.left, top: cand.top };
    }
  }
  // 全部重叠，选第一个
  const fallback = candidates[0]!;
  occupied.push({ left: fallback.left, top: fallback.top, width, height });
  return { left: fallback.left, top: fallback.top };
}

/**
 * Popover 简单方向选择
 * 按偏好顺序尝试 4 个正方向，第一个不出界的就选它
 * 全出界时选出界最少的
 */
/** 方向索引：0=上 1=右 2=下 3=左 */
export type PopoverDirection = 0 | 1 | 2 | 3;

/**
 * 根据方向向量推断最佳 popover 方向
 * 力指向哪边，popover 就优先出现在那边（跟着箭头走）
 */
export function directionToPreferred(dx: number, dy: number): PopoverDirection {
  // 屏幕坐标：dy > 0 表示物理向上（箭头在屏幕上指向上方）
  if (Math.abs(dy) >= Math.abs(dx)) {
    return dy > 0 ? 0 : 2; // 向上→popover上方, 向下→popover下方
  }
  return dx > 0 ? 1 : 3; // 向右→popover右侧, 向左→popover左侧
}

export function pickPopoverPosition(
  anchorX: number,
  anchorY: number,
  panelWidth: number,
  panelHeight: number,
  canvasWidth: number,
  canvasHeight: number,
  gap: number = 12,
  anchorHalfW: number = 0,
  anchorHalfH: number = 0,
  preferredFirst?: PopoverDirection,
): { left: number; top: number } {
  const oX = anchorHalfW + gap;
  const oY = anchorHalfH + gap;

  // 4 个正方向：上(0) 右(1) 下(2) 左(3)
  const all = [
    { left: anchorX - panelWidth / 2, top: anchorY - oY - panelHeight },
    { left: anchorX + oX, top: anchorY - panelHeight / 2 },
    { left: anchorX - panelWidth / 2, top: anchorY + oY },
    { left: anchorX - oX - panelWidth, top: anchorY - panelHeight / 2 },
  ];

  // 按偏好重排：preferred 排第一，其余保持相对顺序
  const order = preferredFirst != null
    ? [preferredFirst, ...([0, 1, 2, 3] as const).filter((i) => i !== preferredFirst)]
    : [0, 1, 2, 3];
  const candidates = order.map((i) => all[i]!);

  let bestIdx = 0;
  let bestOOB = Infinity;

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    let oob = 0;
    if (c.left < 0) oob += -c.left;
    if (c.top < 0) oob += -c.top;
    if (c.left + panelWidth > canvasWidth) oob += c.left + panelWidth - canvasWidth;
    if (c.top + panelHeight > canvasHeight) oob += c.top + panelHeight - canvasHeight;

    if (oob === 0) return c; // 完全不出界，直接选
    if (oob < bestOOB) {
      bestOOB = oob;
      bestIdx = i;
    }
  }

  return candidates[bestIdx]!;
}

// ─── 工具函数 ───

/** 线段转 AABB（用于箭头障碍物） */
export function segmentToBox(from: Vec2, to: Vec2, lineWidth: number): PlacementBox {
  const pad = lineWidth / 2 + 4;
  const left = Math.min(from.x, to.x) - pad;
  const top = Math.min(from.y, to.y) - pad;
  return {
    left,
    top,
    width: Math.abs(to.x - from.x) + pad * 2,
    height: Math.abs(to.y - from.y) + pad * 2,
  };
}

/** 测量标签文本像素宽度 */
export function measureText(
  text: string,
  fontSize: number,
  ctx: CanvasRenderingContext2D,
): number {
  ctx.font = `${fontSize}px 'Inter', sans-serif`;
  return ctx.measureText(text).width;
}
