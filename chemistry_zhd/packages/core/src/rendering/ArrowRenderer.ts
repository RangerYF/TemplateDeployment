import { CanvasManager } from './CanvasManager';

export interface ArrowOptions {
  color: string;
  lineWidth?: number;
  headLength?: number;
  headAngle?: number;
  label?: string;
  labelOffset?: number;
  dashed?: boolean;
  glow?: boolean;
  gradient?: boolean;
}

const FORCE_COLOR = '#4ade80';
const VELOCITY_COLOR = '#60a5fa';
const ACCEL_COLOR = '#f87171';
const MOMENTUM_COLOR = '#c084fc';

export const ARROW_COLORS = {
  force: FORCE_COLOR,
  velocity: VELOCITY_COLOR,
  acceleration: ACCEL_COLOR,
  momentum: MOMENTUM_COLOR,
  energy: '#fbbf24',
};

export class ArrowRenderer {
  constructor(private cm: CanvasManager) {}

  draw(
    x: number, y: number,
    dx: number, dy: number,
    options: ArrowOptions
  ): void {
    const ctx = this.cm.ctx;
    const [sx, sy] = this.cm.toScreen(x, y);
    const [ex, ey] = this.cm.toScreen(x + dx, y + dy);

    const len = Math.sqrt((ex - sx) ** 2 + (ey - sy) ** 2);
    if (len < 2) return;

    const angle = Math.atan2(ey - sy, ex - sx);
    const headLen = options.headLength ?? Math.min(16, len * 0.3);
    const headAngle = options.headAngle ?? Math.PI / 6;
    const lineWidth = options.lineWidth ?? 3;
    const glow = options.glow !== false;

    ctx.save();

    // Glow layer
    if (glow && !options.dashed) {
      ctx.strokeStyle = options.color;
      ctx.lineWidth = lineWidth + 4;
      ctx.globalAlpha = 0.08;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }

    // Shaft - gradient from transparent to full color
    if (options.gradient !== false && !options.dashed) {
      const grad = ctx.createLinearGradient(sx, sy, ex, ey);
      grad.addColorStop(0, adjustAlpha(options.color, 0.3));
      grad.addColorStop(0.4, adjustAlpha(options.color, 0.8));
      grad.addColorStop(1, options.color);
      ctx.strokeStyle = grad;
    } else {
      ctx.strokeStyle = options.color;
    }

    ctx.fillStyle = options.color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (options.dashed) {
      ctx.setLineDash([5, 4]);
      ctx.globalAlpha = 0.6;
    }

    // Shaft (stop short of arrowhead)
    const shaftEndX = ex - headLen * 0.5 * Math.cos(angle);
    const shaftEndY = ey - headLen * 0.5 * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(shaftEndX, shaftEndY);
    ctx.stroke();

    // Arrowhead
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(
      ex - headLen * Math.cos(angle - headAngle),
      ey - headLen * Math.sin(angle - headAngle)
    );
    ctx.lineTo(
      ex - headLen * 0.35 * Math.cos(angle),
      ey - headLen * 0.35 * Math.sin(angle)
    );
    ctx.lineTo(
      ex - headLen * Math.cos(angle + headAngle),
      ey - headLen * Math.sin(angle + headAngle)
    );
    ctx.closePath();
    ctx.fill();

    // Label
    ctx.shadowBlur = 0;
    if (options.label) {
      const offset = options.labelOffset ?? 16;
      const perpX = -Math.sin(angle) * offset;
      const perpY = Math.cos(angle) * offset;
      const midX = (sx + ex) / 2 + perpX;
      const midY = (sy + ey) / 2 + perpY;

      ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const textMetrics = ctx.measureText(options.label);
      const tw = textMetrics.width + 12;
      const th = 22;

      // Background pill with border
      ctx.fillStyle = 'rgba(5, 10, 18, 0.8)';
      ctx.strokeStyle = adjustAlpha(options.color, 0.2);
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      roundRect(ctx, midX - tw / 2, midY - th / 2, tw, th, 4);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = options.color;
      ctx.fillText(options.label, midX, midY);
    }

    ctx.restore();
  }

  drawWithComponents(
    x: number, y: number,
    dx: number, dy: number,
    options: ArrowOptions
  ): void {
    this.draw(x, y, dx, dy, options);
    if (Math.abs(dx) > 0.001) {
      this.draw(x, y, dx, 0, { ...options, dashed: true, label: undefined, glow: false, gradient: false });
    }
    if (Math.abs(dy) > 0.001) {
      this.draw(x + dx, y, 0, dy, { ...options, dashed: true, label: undefined, glow: false, gradient: false });
    }
  }
}

function adjustAlpha(color: string, alpha: number): string {
  const m = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return color;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
}
