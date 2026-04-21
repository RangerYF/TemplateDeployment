import type { Vec2 } from '@/core/types';

export interface ArrowStyle {
  color: string;
  lineWidth: number;
  arrowHeadSize: number;
  dashed?: boolean;
}

const DEFAULT_ARROW_STYLE: ArrowStyle = {
  color: '#C0392B',
  lineWidth: 2,
  arrowHeadSize: 10,
  dashed: false,
};

/**
 * 在 Canvas 上绘制带箭头的向量（屏幕坐标）
 */
export function drawArrow(
  ctx: CanvasRenderingContext2D,
  from: Vec2,
  to: Vec2,
  style: Partial<ArrowStyle> = {},
): void {
  const s = { ...DEFAULT_ARROW_STYLE, ...style };
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const angle = Math.atan2(dy, dx);
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len < 1) return; // 太短不画

  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  const headSize = Math.min(s.arrowHeadSize, len * 0.4);

  if (s.dashed) {
    ctx.setLineDash([6, 4]);
  }

  // 线段：终点停在箭头三角形底边中点（尖端后退 headSize * cos(30°)）
  const headDepth = headSize * Math.cos(Math.PI / 6);
  const lineEndX = to.x - headDepth * Math.cos(angle);
  const lineEndY = to.y - headDepth * Math.sin(angle);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(lineEndX, lineEndY);
  ctx.stroke();

  if (s.dashed) {
    ctx.setLineDash([]);
  }

  // 箭头三角形
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(
    to.x - headSize * Math.cos(angle - Math.PI / 6),
    to.y - headSize * Math.sin(angle - Math.PI / 6),
  );
  ctx.lineTo(
    to.x - headSize * Math.cos(angle + Math.PI / 6),
    to.y - headSize * Math.sin(angle + Math.PI / 6),
  );
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}
