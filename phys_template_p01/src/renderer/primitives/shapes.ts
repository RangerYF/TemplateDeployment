import type { Vec2 } from '@/core/types';

export interface ShapeStyle {
  strokeColor?: string;
  fillColor?: string;
  lineWidth: number;
  dashed?: boolean;
}

const DEFAULT_SHAPE_STYLE: ShapeStyle = {
  lineWidth: 1,
};

function applyStyle(
  ctx: CanvasRenderingContext2D,
  s: ShapeStyle,
): void {
  ctx.lineWidth = s.lineWidth;
  if (s.dashed) ctx.setLineDash([6, 4]);
  if (s.strokeColor) ctx.strokeStyle = s.strokeColor;
  if (s.fillColor) ctx.fillStyle = s.fillColor;
}

/**
 * 绘制矩形（屏幕坐标）
 */
export function drawRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  style: Partial<ShapeStyle> = {},
): void {
  const s = { ...DEFAULT_SHAPE_STYLE, ...style };
  ctx.save();
  applyStyle(ctx, s);

  if (s.fillColor) {
    ctx.fillRect(x, y, width, height);
  }
  if (s.strokeColor) {
    ctx.strokeRect(x, y, width, height);
  }

  ctx.restore();
}

/**
 * 绘制圆形（屏幕坐标）
 */
export function drawCircle(
  ctx: CanvasRenderingContext2D,
  center: Vec2,
  radius: number,
  style: Partial<ShapeStyle> = {},
): void {
  const s = { ...DEFAULT_SHAPE_STYLE, ...style };
  ctx.save();
  applyStyle(ctx, s);

  ctx.beginPath();
  ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);

  if (s.fillColor) ctx.fill();
  if (s.strokeColor) ctx.stroke();

  ctx.restore();
}

/**
 * 绘制线段（屏幕坐标）
 */
export function drawLine(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  to: Vec2,
  style: Partial<ShapeStyle> = {},
): void {
  const s = { ...DEFAULT_SHAPE_STYLE, ...style };
  ctx.save();
  applyStyle(ctx, s);

  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();

  ctx.restore();
}
