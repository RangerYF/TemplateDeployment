import type { Vec2 } from '@/core/types';

export interface TextLabelStyle {
  color: string;
  fontSize: number;
  fontFamily: string;
  align: CanvasTextAlign;
  baseline: CanvasTextBaseline;
  backgroundColor?: string;
  padding?: number;
}

const DEFAULT_TEXT_STYLE: TextLabelStyle = {
  color: '#1A1A2E',
  fontSize: 12,
  fontFamily: "'Inter', sans-serif",
  align: 'center',
  baseline: 'middle',
};

/**
 * 在 Canvas 上绘制文字标注（屏幕坐标）
 */
export function drawTextLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  position: Vec2,
  style: Partial<TextLabelStyle> = {},
): void {
  const s = { ...DEFAULT_TEXT_STYLE, ...style };

  ctx.save();
  ctx.font = `${s.fontSize}px ${s.fontFamily}`;
  ctx.textAlign = s.align;
  ctx.textBaseline = s.baseline;

  // 可选背景
  if (s.backgroundColor) {
    const pad = s.padding ?? 4;
    const metrics = ctx.measureText(text);
    const w = metrics.width + pad * 2;
    const h = s.fontSize + pad * 2;
    ctx.fillStyle = s.backgroundColor;
    ctx.fillRect(
      position.x - w / 2,
      position.y - h / 2,
      w,
      h,
    );
  }

  ctx.fillStyle = s.color;
  ctx.fillText(text, position.x, position.y);
  ctx.restore();
}
