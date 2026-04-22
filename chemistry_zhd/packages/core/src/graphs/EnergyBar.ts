export interface EnergyBarData {
  label: string;
  value: number;
  color: string;
}

export class EnergyBar {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private dpr: number;

  constructor(container: HTMLElement, width: number = 200, height: number = 400) {
    this.width = width;
    this.height = height;
    this.dpr = window.devicePixelRatio || 1;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width * this.dpr;
    this.canvas.height = height * this.dpr;
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.canvas.className = 'energy-bar-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    container.appendChild(this.canvas);
  }

  draw(bars: EnergyBarData[], maxEnergy: number, title?: string): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const padding = 30;
    const barAreaTop = title ? 36 : 20;
    const barAreaHeight = h - barAreaTop - padding;
    const barWidth = Math.min(32, (w - padding * 2) / (bars.length + 1));
    const gap = barWidth * 0.4;

    ctx.fillStyle = '#080e1a';
    ctx.fillRect(0, 0, w, h);

    if (title) {
      ctx.fillStyle = 'rgba(139, 156, 184, 0.6)';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(title, w / 2, 18);
    }

    const totalWidth = bars.length * (barWidth + gap) - gap;
    let x = (w - totalWidth) / 2;

    // Reference lines
    ctx.strokeStyle = 'rgba(255,255,255,0.03)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const ly = barAreaTop + barAreaHeight * (1 - i / 4);
      ctx.beginPath();
      ctx.moveTo(padding / 2, ly);
      ctx.lineTo(w - padding / 2, ly);
      ctx.stroke();
    }

    for (const bar of bars) {
      const barH = Math.max(0, (bar.value / maxEnergy) * barAreaHeight);
      const barY = barAreaTop + barAreaHeight - barH;

      if (barH > 1) {
        // Bar gradient
        const grad = ctx.createLinearGradient(x, barY, x, barAreaTop + barAreaHeight);
        grad.addColorStop(0, bar.color);
        grad.addColorStop(0.5, adjustAlpha(bar.color, 0.7));
        grad.addColorStop(1, adjustAlpha(bar.color, 0.3));

        // Glow
        ctx.save();
        ctx.shadowColor = bar.color;
        ctx.shadowBlur = 12;
        ctx.fillStyle = grad;
        roundRect(ctx, x, barY, barWidth, barH, 3);
        ctx.fill();
        ctx.shadowBlur = 0;

        // Inner highlight
        const innerGrad = ctx.createLinearGradient(x, barY, x + barWidth, barY);
        innerGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
        innerGrad.addColorStop(0.5, 'rgba(255,255,255,0.02)');
        innerGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = innerGrad;
        roundRect(ctx, x, barY, barWidth, barH, 3);
        ctx.fill();

        // Top edge shine
        ctx.strokeStyle = adjustAlpha(bar.color, 0.4);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x + 3, barY + 1);
        ctx.lineTo(x + barWidth - 3, barY + 1);
        ctx.stroke();
        ctx.restore();
      }

      // Value label above bar
      if (bar.value > 0.01) {
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.font = 'bold 10px -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(bar.value.toFixed(1), x + barWidth / 2, barY - 5);
      }

      // Name label below
      ctx.fillStyle = adjustAlpha(bar.color, 0.7);
      ctx.font = '10px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(bar.label, x + barWidth / 2, barAreaTop + barAreaHeight + 13);

      x += barWidth + gap;
    }

    // Baseline
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(padding / 2, barAreaTop + barAreaHeight);
    ctx.lineTo(w - padding / 2, barAreaTop + barAreaHeight);
    ctx.stroke();
  }
}

function adjustAlpha(hex: string, alpha: number): string {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return hex;
  return `rgba(${parseInt(m[1], 16)},${parseInt(m[2], 16)},${parseInt(m[3], 16)},${alpha})`;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
