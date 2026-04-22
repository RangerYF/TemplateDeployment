import { CanvasManager } from './CanvasManager';

export class GridRenderer {
  constructor(private cm: CanvasManager) {}

  draw(options?: {
    majorSpacing?: number;
    minorSpacing?: number;
    majorColor?: string;
    minorColor?: string;
    showLabels?: boolean;
    labelUnit?: string;
    axisColor?: string;
    style?: 'dots' | 'lines' | 'crosshairs';
  }): void {
    const ctx = this.cm.ctx;
    const w = this.cm.getWidth();
    const h = this.cm.getHeight();

    const majorSpacing = options?.majorSpacing ?? 1;
    const minorSpacing = options?.minorSpacing ?? 0.5;
    const showLabels = options?.showLabels ?? true;
    const labelUnit = options?.labelUnit ?? 'm';
    const style = options?.style ?? 'dots';

    const [ox, oy] = this.cm.toScreen(0, 0);
    const [wLeft] = this.cm.toWorld(0, 0);
    const [wRight] = this.cm.toWorld(w, 0);
    const [, wTop] = this.cm.toWorld(0, 0);
    const [, wBottom] = this.cm.toWorld(0, h);

    // Minor grid dots with subtle glow at intersections
    const startXm = Math.floor(wLeft / minorSpacing) * minorSpacing;
    const startYm = Math.floor(wBottom / minorSpacing) * minorSpacing;

    if (style === 'dots' || style === 'crosshairs') {
      for (let wx = startXm; wx <= wRight; wx += minorSpacing) {
        for (let wy = startYm; wy <= wTop; wy += minorSpacing) {
          const isMajor = Math.abs(wx % majorSpacing) < 0.01 && Math.abs(wy % majorSpacing) < 0.01;
          const [sx, sy] = this.cm.toScreen(wx, wy);

          if (isMajor) {
            // Major grid intersection: subtle cross
            ctx.strokeStyle = 'rgba(255,255,255,0.06)';
            ctx.lineWidth = 0.5;
            const size = 4;
            ctx.beginPath();
            ctx.moveTo(sx - size, sy);
            ctx.lineTo(sx + size, sy);
            ctx.moveTo(sx, sy - size);
            ctx.lineTo(sx, sy + size);
            ctx.stroke();
          } else {
            // Minor: tiny dot
            ctx.fillStyle = 'rgba(255,255,255,0.025)';
            ctx.fillRect(sx - 0.5, sy - 0.5, 1, 1);
          }
        }
      }
    }

    if (style === 'lines') {
      // Major grid lines (very faint)
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth = 0.5;
      this.drawGridLines(ctx, wLeft, wRight, wBottom, wTop, majorSpacing);
    }

    // Axes with gradient fade
    // X axis
    if (oy >= 0 && oy <= h) {
      const axGrad = ctx.createLinearGradient(0, oy, w, oy);
      axGrad.addColorStop(0, 'transparent');
      axGrad.addColorStop(0.15, 'rgba(255,255,255,0.08)');
      axGrad.addColorStop(0.85, 'rgba(255,255,255,0.08)');
      axGrad.addColorStop(1, 'transparent');
      ctx.strokeStyle = axGrad;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(0, oy);
      ctx.lineTo(w, oy);
      ctx.stroke();
    }

    // Y axis
    if (ox >= 0 && ox <= w) {
      const axGrad = ctx.createLinearGradient(ox, 0, ox, h);
      axGrad.addColorStop(0, 'transparent');
      axGrad.addColorStop(0.15, 'rgba(255,255,255,0.08)');
      axGrad.addColorStop(0.85, 'rgba(255,255,255,0.08)');
      axGrad.addColorStop(1, 'transparent');
      ctx.strokeStyle = axGrad;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(ox, 0);
      ctx.lineTo(ox, h);
      ctx.stroke();
    }

    // Labels
    if (showLabels) {
      ctx.fillStyle = 'rgba(255,255,255,0.2)';
      ctx.font = '10px -apple-system, BlinkMacSystemFont, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const start = Math.ceil(wLeft / majorSpacing) * majorSpacing;
      for (let wx = start; wx <= wRight; wx += majorSpacing) {
        if (Math.abs(wx) < 0.001) continue;
        const [sx] = this.cm.toScreen(wx, 0);
        ctx.fillText(`${wx}${labelUnit}`, sx, oy + 4);
      }

      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const startY = Math.ceil(wBottom / majorSpacing) * majorSpacing;
      for (let wy = startY; wy <= wTop; wy += majorSpacing) {
        if (Math.abs(wy) < 0.001) continue;
        const [, sy] = this.cm.toScreen(0, wy);
        ctx.fillText(`${wy}`, ox - 5, sy);
      }
    }
  }

  private drawGridLines(
    ctx: CanvasRenderingContext2D,
    wLeft: number, wRight: number,
    wBottom: number, wTop: number,
    spacing: number
  ): void {
    const w = this.cm.getWidth();
    const h = this.cm.getHeight();

    const startX = Math.floor(wLeft / spacing) * spacing;
    for (let wx = startX; wx <= wRight; wx += spacing) {
      const [sx] = this.cm.toScreen(wx, 0);
      ctx.beginPath();
      ctx.moveTo(sx, 0);
      ctx.lineTo(sx, h);
      ctx.stroke();
    }

    const startY = Math.floor(wBottom / spacing) * spacing;
    for (let wy = startY; wy <= wTop; wy += spacing) {
      const [, sy] = this.cm.toScreen(0, wy);
      ctx.beginPath();
      ctx.moveTo(0, sy);
      ctx.lineTo(w, sy);
      ctx.stroke();
    }
  }
}
