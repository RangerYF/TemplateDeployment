export interface GraphTrace {
  x: number[];
  y: number[];
  name: string;
  color: string;
  yaxis?: string;
}

export interface SyncedGraphOptions {
  container: HTMLElement;
  title?: string;
  xLabel?: string;
  yLabel?: string;
  y2Label?: string;
  maxPoints?: number;
  height?: number;
  onTimeClick?: (t: number) => void;
}

export class SyncedGraph {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private traces: GraphTrace[] = [];
  private currentTime: number = 0;
  private maxPoints: number;
  private title: string;
  private xLabel: string;
  private yLabel: string;
  private width: number;
  private height: number;
  private dpr: number;
  private onTimeClick?: (t: number) => void;

  private plotLeft = 50;
  private plotRight = 14;
  private plotTop = 32;
  private plotBottom = 32;

  constructor(options: SyncedGraphOptions) {
    this.dpr = window.devicePixelRatio || 1;
    this.maxPoints = options.maxPoints ?? 500;
    this.title = options.title ?? '';
    this.xLabel = options.xLabel ?? 't (s)';
    this.yLabel = options.yLabel ?? '';
    this.onTimeClick = options.onTimeClick;
    this.height = options.height ?? 220;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'synced-graph-canvas';
    this.width = options.container.clientWidth || 600;
    this.applySize();
    this.ctx = this.canvas.getContext('2d')!;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    options.container.appendChild(this.canvas);

    if (this.onTimeClick) {
      this.canvas.addEventListener('click', (e) => {
        const rect = this.canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const plotW = this.width - this.plotLeft - this.plotRight;
        if (sx < this.plotLeft || sx > this.plotLeft + plotW) return;
        const frac = (sx - this.plotLeft) / plotW;
        const [xMin, xMax] = this.getXRange();
        const t = xMin + frac * (xMax - xMin);
        this.onTimeClick?.(t);
      });
      this.canvas.style.cursor = 'crosshair';
    }
  }

  private applySize(): void {
    this.canvas.width = this.width * this.dpr;
    this.canvas.height = this.height * this.dpr;
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';
  }

  setTraces(traces: GraphTrace[]): void { this.traces = traces; }
  updateCurrentTime(t: number): void { this.currentTime = t; }
  updateTitle(title: string): void { this.title = title; }

  resize(w: number): void {
    this.width = w;
    this.applySize();
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  render(): void {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;

    // Background
    ctx.fillStyle = '#080e1a';
    ctx.fillRect(0, 0, w, h);

    if (this.traces.length === 0) return;

    const plotW = w - this.plotLeft - this.plotRight;
    const plotH = h - this.plotTop - this.plotBottom;
    const [xMin, xMax] = this.getXRange();
    const [yMin, yMax] = this.getYRange();

    // Grid lines (very subtle)
    for (let i = 0; i <= 5; i++) {
      const gy = this.plotTop + (plotH * i) / 5;
      const grad = ctx.createLinearGradient(this.plotLeft, gy, this.plotLeft + plotW, gy);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.1, 'rgba(255,255,255,0.03)');
      grad.addColorStop(0.9, 'rgba(255,255,255,0.03)');
      grad.addColorStop(1, 'transparent');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(this.plotLeft, gy);
      ctx.lineTo(this.plotLeft + plotW, gy);
      ctx.stroke();
    }

    // Tick labels
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i <= 5; i++) {
      const x = this.plotLeft + (plotW * i) / 5;
      const val = xMin + ((xMax - xMin) * i) / 5;
      ctx.fillText(val.toFixed(1), x, this.plotTop + plotH + 13);
    }
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
      const y = this.plotTop + plotH - (plotH * i) / 5;
      const val = yMin + ((yMax - yMin) * i) / 5;
      ctx.fillText(val.toFixed(1), this.plotLeft - 4, y + 3);
    }

    // Traces
    for (const trace of this.traces) {
      if (trace.x.length < 2) continue;
      const toSx = (v: number) => this.plotLeft + ((v - xMin) / (xMax - xMin)) * plotW;
      const toSy = (v: number) => this.plotTop + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

      // Gradient fill under curve
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(toSx(trace.x[0]), toSy(trace.y[0]));
      for (let i = 1; i < trace.x.length; i++) {
        ctx.lineTo(toSx(trace.x[i]), toSy(trace.y[i]));
      }
      ctx.lineTo(toSx(trace.x[trace.x.length - 1]), this.plotTop + plotH);
      ctx.lineTo(toSx(trace.x[0]), this.plotTop + plotH);
      ctx.closePath();
      const fillGrad = ctx.createLinearGradient(0, this.plotTop, 0, this.plotTop + plotH);
      fillGrad.addColorStop(0, adjustAlpha(trace.color, 0.08));
      fillGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = fillGrad;
      ctx.fill();
      ctx.restore();

      // Glow pass
      ctx.save();
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.1;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      for (let i = 0; i < trace.x.length; i++) {
        const sx = toSx(trace.x[i]);
        const sy = toSy(trace.y[i]);
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();
      ctx.restore();

      // Main line
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < trace.x.length; i++) {
        const sx = toSx(trace.x[i]);
        const sy = toSy(trace.y[i]);
        if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
      }
      ctx.stroke();

      // Dot at current time
      if (xMax > xMin) {
        const idx = trace.x.findIndex(v => v >= this.currentTime);
        if (idx >= 0 && idx < trace.x.length) {
          const dotX = toSx(trace.x[idx]);
          const dotY = toSy(trace.y[idx]);
          ctx.save();
          ctx.shadowColor = trace.color;
          ctx.shadowBlur = 6;
          ctx.beginPath();
          ctx.arc(dotX, dotY, 3, 0, Math.PI * 2);
          ctx.fillStyle = trace.color;
          ctx.fill();
          ctx.restore();
        }
      }
    }

    // Cursor line
    if (xMax > xMin) {
      const cursorX = this.plotLeft + ((this.currentTime - xMin) / (xMax - xMin)) * plotW;
      if (cursorX >= this.plotLeft && cursorX <= this.plotLeft + plotW) {
        const cursorGrad = ctx.createLinearGradient(cursorX, this.plotTop, cursorX, this.plotTop + plotH);
        cursorGrad.addColorStop(0, 'rgba(255,255,255,0.4)');
        cursorGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
        cursorGrad.addColorStop(1, 'rgba(255,255,255,0.4)');
        ctx.strokeStyle = cursorGrad;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 3]);
        ctx.beginPath();
        ctx.moveTo(cursorX, this.plotTop);
        ctx.lineTo(cursorX, this.plotTop + plotH);
        ctx.stroke();
        ctx.setLineDash([]);

        // Time badge
        const timeText = `${this.currentTime.toFixed(2)}s`;
        ctx.font = 'bold 9px -apple-system, sans-serif';
        const tw = ctx.measureText(timeText).width + 6;
        ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        roundRect(ctx, cursorX - tw / 2, this.plotTop - 14, tw, 13, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.7)';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(timeText, cursorX, this.plotTop - 7.5);
      }
    }

    // Title
    if (this.title) {
      ctx.fillStyle = 'rgba(139, 156, 184, 0.7)';
      ctx.font = 'bold 11px -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(this.title, w / 2, 14);
    }

    // Legend
    ctx.font = '10px -apple-system, sans-serif';
    let legendX = this.plotLeft + plotW - 4;
    let legendY = this.plotTop + 10;
    for (const trace of this.traces) {
      ctx.textAlign = 'right';
      ctx.fillStyle = trace.color;
      const tw = ctx.measureText(trace.name).width;
      // Color line
      ctx.strokeStyle = trace.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(legendX - tw - 14, legendY);
      ctx.lineTo(legendX - tw - 4, legendY);
      ctx.stroke();
      ctx.fillText(trace.name, legendX, legendY + 3);
      legendY += 13;
    }

    // Axis labels
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px -apple-system, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(this.xLabel, this.plotLeft + plotW / 2, h - 4);

    ctx.save();
    ctx.translate(9, this.plotTop + plotH / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(this.yLabel, 0, 0);
    ctx.restore();

    // Plot area border (very subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(this.plotLeft, this.plotTop, plotW, plotH);
  }

  private getXRange(): [number, number] {
    let min = Infinity, max = -Infinity;
    for (const t of this.traces) {
      for (const x of t.x) { if (x < min) min = x; if (x > max) max = x; }
    }
    if (min === Infinity) return [0, 1];
    if (max - min < 0.01) return [min - 0.5, max + 0.5];
    return [min, max];
  }

  private getYRange(): [number, number] {
    let min = Infinity, max = -Infinity;
    for (const t of this.traces) {
      for (const y of t.y) { if (y < min) min = y; if (y > max) max = y; }
    }
    if (min === Infinity) return [0, 1];
    const margin = (max - min) * 0.1 || 0.5;
    return [min - margin, max + margin];
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
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
