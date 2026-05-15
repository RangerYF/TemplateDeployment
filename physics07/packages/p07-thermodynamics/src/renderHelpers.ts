import type { CanvasManager, ArrowOptions } from '@physics/core';
import { ArrowRenderer } from '@physics/core';

export function drawBallAtScreen(
  ctx: CanvasRenderingContext2D,
  sx: number, sy: number, r: number, color: string,
  options?: { glow?: boolean; alpha?: number },
): void {
  ctx.save();
  if (options?.alpha !== undefined) ctx.globalAlpha = options.alpha;

  if (options?.glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = r * 1.2;
  }

  const grad = ctx.createRadialGradient(
    sx - r * 0.25, sy - r * 0.25, r * 0.05,
    sx, sy, r,
  );
  grad.addColorStop(0, lightenColor(color, 60));
  grad.addColorStop(0.5, color);
  grad.addColorStop(1, darkenColor(color, 30));

  ctx.beginPath();
  ctx.arc(sx, sy, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(sx - r * 0.2, sy - r * 0.2, r * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fill();

  ctx.restore();
}

export function drawScreenArrow(
  cm: CanvasManager,
  sx: number, sy: number, ex: number, ey: number,
  opts: ArrowOptions,
): void {
  const arrows = new ArrowRenderer(cm);
  const [wx1, wy1] = cm.toWorld(sx, sy);
  const [wx2, wy2] = cm.toWorld(ex, ey);
  arrows.draw(wx1, wy1, wx2 - wx1, wy2 - wy1, opts);
}

export function lightenColor(hex: string, amount: number): string {
  const rgb = parseColor(hex);
  if (!rgb) return hex;
  return `rgb(${Math.min(255, rgb.r + amount)},${Math.min(255, rgb.g + amount)},${Math.min(255, rgb.b + amount)})`;
}

export function darkenColor(hex: string, amount: number): string {
  const rgb = parseColor(hex);
  if (!rgb) return hex;
  return `rgb(${Math.max(0, rgb.r - amount)},${Math.max(0, rgb.g - amount)},${Math.max(0, rgb.b - amount)})`;
}

function parseColor(color: string): { r: number; g: number; b: number } | null {
  const hex = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hex) return { r: parseInt(hex[1], 16), g: parseInt(hex[2], 16), b: parseInt(hex[3], 16) };
  const rgb = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (rgb) return { r: Number(rgb[1]), g: Number(rgb[2]), b: Number(rgb[3]) };
  return null;
}
