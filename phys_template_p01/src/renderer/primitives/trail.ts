import type { Vec2 } from '@/core/types';

export interface TrailStyle {
  color: string;
  lineWidth: number;
  fadeTail?: boolean; // 尾部渐隐
}

const DEFAULT_TRAIL_STYLE: TrailStyle = {
  color: '#2980B9',
  lineWidth: 1.5,
  fadeTail: true,
};

/**
 * 在 Canvas 上绘制轨迹线（屏幕坐标点序列）
 */
export function drawTrail(
  ctx: CanvasRenderingContext2D,
  points: Vec2[],
  style: Partial<TrailStyle> = {},
): void {
  if (points.length < 2) return;

  const s = { ...DEFAULT_TRAIL_STYLE, ...style };

  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.lineWidth = s.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (s.fadeTail) {
    // 分段绘制，alpha 从尾到头递增
    const total = points.length - 1;
    for (let i = 0; i < total; i++) {
      const p0 = points[i]!;
      const p1 = points[i + 1]!;
      const alpha = (i + 1) / total;
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
  } else {
    const first = points[0]!;
    ctx.beginPath();
    ctx.moveTo(first.x, first.y);
    for (let i = 1; i < points.length; i++) {
      const p = points[i]!;
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }

  ctx.restore();
}
