export interface CanvasManagerOptions {
  container: HTMLElement;
  width?: number;
  height?: number;
  bgColor?: string;
  autoResize?: boolean;
}

export interface DragState {
  dragging: boolean;
  worldX: number;
  worldY: number;
  startWorldX: number;
  startWorldY: number;
  target: string | null;
}

export type CanvasMouseHandler = (worldX: number, worldY: number, state: DragState) => void;

export class CanvasManager {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  private logicalWidth: number;
  private logicalHeight: number;
  private dpr: number;

  // World coordinate system
  private originX: number = 0;
  private originY: number = 0;
  private pxPerUnit: number = 100;

  // Interaction
  private dragState: DragState = {
    dragging: false, worldX: 0, worldY: 0,
    startWorldX: 0, startWorldY: 0, target: null,
  };
  private onMouseDown?: CanvasMouseHandler;
  private onMouseMove?: CanvasMouseHandler;
  private onMouseUp?: CanvasMouseHandler;
  private onClick?: CanvasMouseHandler;
  private hoverCursor: string = 'default';

  private hitTargets: { id: string; worldX: number; worldY: number; radius: number }[] = [];

  // Offscreen buffer for bloom
  private bloomCanvas?: HTMLCanvasElement;
  private bloomCtx?: CanvasRenderingContext2D;

  constructor(options: CanvasManagerOptions) {
    this.dpr = window.devicePixelRatio || 1;
    this.canvas = document.createElement('canvas');
    this.canvas.style.display = 'block';
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.ctx = this.canvas.getContext('2d')!;
    options.container.appendChild(this.canvas);

    const autoResize = options.autoResize ?? true;
    if (autoResize) {
      this.logicalWidth = options.container.clientWidth || (options.width ?? 800);
      this.logicalHeight = options.container.clientHeight || (options.height ?? 600);
    } else {
      this.logicalWidth = options.width ?? 800;
      this.logicalHeight = options.height ?? 600;
      this.canvas.style.width = this.logicalWidth + 'px';
      this.canvas.style.height = this.logicalHeight + 'px';
    }
    this.applySize();

    this.originX = this.logicalWidth / 2;
    this.originY = this.logicalHeight * 0.75;

    if (autoResize) {
      const ro = new ResizeObserver(() => {
        const w = options.container.clientWidth;
        const h = options.container.clientHeight;
        if (w > 0 && h > 0 && (w !== this.logicalWidth || h !== this.logicalHeight)) {
          const oxRatio = this.originX / this.logicalWidth;
          const oyRatio = this.originY / this.logicalHeight;
          this.logicalWidth = w;
          this.logicalHeight = h;
          this.originX = w * oxRatio;
          this.originY = h * oyRatio;
          this.applySize();
        }
      });
      ro.observe(options.container);
    }

    this.setupMouseEvents();
  }

  private applySize(): void {
    this.canvas.width = this.logicalWidth * this.dpr;
    this.canvas.height = this.logicalHeight * this.dpr;
    this.canvas.style.width = this.logicalWidth + 'px';
    this.canvas.style.height = this.logicalHeight + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  private setupMouseEvents(): void {
    const getWorldPos = (e: MouseEvent): [number, number] => {
      const rect = this.canvas.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      return this.toWorld(sx, sy);
    };

    this.canvas.addEventListener('mousedown', (e) => {
      const [wx, wy] = getWorldPos(e);
      this.dragState.dragging = true;
      this.dragState.worldX = wx;
      this.dragState.worldY = wy;
      this.dragState.startWorldX = wx;
      this.dragState.startWorldY = wy;
      this.dragState.target = null;
      for (const t of this.hitTargets) {
        const dx = wx - t.worldX;
        const dy = wy - t.worldY;
        if (Math.sqrt(dx * dx + dy * dy) < t.radius) {
          this.dragState.target = t.id;
          break;
        }
      }
      this.onMouseDown?.(wx, wy, { ...this.dragState });
    });

    this.canvas.addEventListener('mousemove', (e) => {
      const [wx, wy] = getWorldPos(e);
      this.dragState.worldX = wx;
      this.dragState.worldY = wy;
      let hovering = false;
      for (const t of this.hitTargets) {
        const dx = wx - t.worldX;
        const dy = wy - t.worldY;
        if (Math.sqrt(dx * dx + dy * dy) < t.radius) {
          hovering = true;
          break;
        }
      }
      this.canvas.style.cursor = hovering ? 'grab' : this.hoverCursor;
      if (this.dragState.dragging) this.canvas.style.cursor = 'grabbing';
      this.onMouseMove?.(wx, wy, { ...this.dragState });
    });

    this.canvas.addEventListener('mouseup', (e) => {
      const [wx, wy] = getWorldPos(e);
      this.dragState.dragging = false;
      this.onMouseUp?.(wx, wy, { ...this.dragState });
      this.dragState.target = null;
    });

    this.canvas.addEventListener('click', (e) => {
      const [wx, wy] = getWorldPos(e);
      this.onClick?.(wx, wy, this.dragState);
    });

    this.canvas.addEventListener('mouseleave', () => {
      this.dragState.dragging = false;
      this.dragState.target = null;
      this.canvas.style.cursor = this.hoverCursor;
    });
  }

  setMouseHandlers(handlers: {
    onDown?: CanvasMouseHandler;
    onMove?: CanvasMouseHandler;
    onUp?: CanvasMouseHandler;
    onClick?: CanvasMouseHandler;
  }): void {
    this.onMouseDown = handlers.onDown;
    this.onMouseMove = handlers.onMove;
    this.onMouseUp = handlers.onUp;
    this.onClick = handlers.onClick;
  }

  registerHitTarget(id: string, worldX: number, worldY: number, radiusWorld: number): void {
    const existing = this.hitTargets.find(t => t.id === id);
    if (existing) {
      existing.worldX = worldX;
      existing.worldY = worldY;
      existing.radius = radiusWorld;
    } else {
      this.hitTargets.push({ id, worldX, worldY, radius: radiusWorld });
    }
  }

  clearHitTargets(): void { this.hitTargets.length = 0; }
  getDragState(): DragState { return { ...this.dragState }; }
  setOrigin(x: number, y: number): void { this.originX = x; this.originY = y; }
  setScale(pxPerUnit: number): void { this.pxPerUnit = pxPerUnit; }
  getScale(): number { return this.pxPerUnit; }
  getWidth(): number { return this.logicalWidth; }
  getHeight(): number { return this.logicalHeight; }

  toScreen(wx: number, wy: number): [number, number] {
    return [this.originX + wx * this.pxPerUnit, this.originY - wy * this.pxPerUnit];
  }

  toWorld(sx: number, sy: number): [number, number] {
    return [(sx - this.originX) / this.pxPerUnit, (this.originY - sy) / this.pxPerUnit];
  }

  // ===== Clear with optional vignette =====

  clear(bgColor: string = '#050a12'): void {
    const ctx = this.ctx;
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);

    // Subtle radial vignette
    const vignette = ctx.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w * 0.8);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, w, h);
  }

  resize(w: number, h: number): void {
    this.logicalWidth = w;
    this.logicalHeight = h;
    this.applySize();
  }

  exportPNG(): string { return this.canvas.toDataURL('image/png'); }

  // ===== Modern drawing helpers =====

  /** Draw a ball with radial gradient, glow, and specular highlight */
  drawBall(
    worldX: number, worldY: number,
    radiusPx: number,
    color: string,
    options?: { glow?: boolean; label?: string; labelColor?: string; outlineColor?: string; pulse?: boolean }
  ): void {
    const ctx = this.ctx;
    const [sx, sy] = this.toScreen(worldX, worldY);

    ctx.save();

    // Outer glow
    if (options?.glow !== false) {
      ctx.shadowColor = color;
      ctx.shadowBlur = radiusPx * 1.2;
    }

    // Main gradient
    const grad = ctx.createRadialGradient(
      sx - radiusPx * 0.25, sy - radiusPx * 0.25, radiusPx * 0.05,
      sx, sy, radiusPx
    );
    grad.addColorStop(0, lightenColor(color, 80));
    grad.addColorStop(0.4, lightenColor(color, 20));
    grad.addColorStop(0.8, color);
    grad.addColorStop(1, darkenColor(color, 40));

    ctx.beginPath();
    ctx.arc(sx, sy, radiusPx, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Crisp outline
    ctx.shadowBlur = 0;
    ctx.strokeStyle = options?.outlineColor ?? `rgba(255,255,255,0.15)`;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Primary specular highlight
    ctx.beginPath();
    ctx.ellipse(
      sx - radiusPx * 0.2, sy - radiusPx * 0.22,
      radiusPx * 0.35, radiusPx * 0.2,
      -0.3, 0, Math.PI * 2
    );
    const specGrad = ctx.createRadialGradient(
      sx - radiusPx * 0.2, sy - radiusPx * 0.22, 0,
      sx - radiusPx * 0.2, sy - radiusPx * 0.22, radiusPx * 0.35
    );
    specGrad.addColorStop(0, 'rgba(255,255,255,0.25)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Secondary bottom rim light
    ctx.beginPath();
    ctx.arc(sx, sy + radiusPx * 0.2, radiusPx * 0.9, Math.PI * 0.15, Math.PI * 0.85);
    ctx.strokeStyle = `rgba(255,255,255,0.04)`;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Label
    if (options?.label) {
      ctx.fillStyle = options.labelColor ?? 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.max(10, radiusPx * 0.65)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(options.label, sx, sy + 1);
    }

    ctx.restore();
  }

  /** Draw a ground surface with modern texture */
  drawGround(worldLeft: number, worldRight: number, worldY: number = 0, thickness: number = 0.3): void {
    const ctx = this.ctx;
    const [x1, y1] = this.toScreen(worldLeft, worldY);
    const [x2] = this.toScreen(worldRight, worldY);
    const groundH = 30;

    // Ground body with gradient
    const bodyGrad = ctx.createLinearGradient(x1, y1, x1, y1 + groundH);
    bodyGrad.addColorStop(0, 'rgba(60, 75, 90, 0.25)');
    bodyGrad.addColorStop(0.3, 'rgba(40, 55, 70, 0.15)');
    bodyGrad.addColorStop(1, 'rgba(30, 40, 55, 0.05)');
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x1, y1, x2 - x1, groundH);

    // Surface line with glow
    ctx.save();
    ctx.strokeStyle = 'rgba(140, 160, 185, 0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(140, 160, 185, 0.3)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.stroke();
    ctx.restore();

    // Specular highlight on surface
    const specGrad = ctx.createLinearGradient(x1, y1 - 1, x1, y1 + 2);
    specGrad.addColorStop(0, 'rgba(255,255,255,0.08)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.fillRect(x1, y1 - 1, x2 - x1, 3);

    // Hatching pattern
    ctx.strokeStyle = 'rgba(120, 140, 165, 0.12)';
    ctx.lineWidth = 1;
    const hatchSpacing = 12;
    const hatchLen = 10;
    for (let x = x1; x <= x2; x += hatchSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, y1 + 2);
      ctx.lineTo(x - hatchLen, y1 + hatchLen + 2);
      ctx.stroke();
    }
  }

  /** Draw a line between two world points */
  drawLine(
    x1: number, y1: number, x2: number, y2: number,
    color: string, lineWidth: number = 2, dashed?: boolean
  ): void {
    const ctx = this.ctx;
    const [sx1, sy1] = this.toScreen(x1, y1);
    const [sx2, sy2] = this.toScreen(x2, y2);
    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    if (dashed) ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(sx1, sy1);
    ctx.lineTo(sx2, sy2);
    ctx.stroke();
    ctx.restore();
  }

  /** Draw text at world position with optional background pill */
  drawText(
    text: string, worldX: number, worldY: number,
    options?: {
      color?: string; font?: string; align?: CanvasTextAlign;
      baseline?: CanvasTextBaseline; offsetX?: number; offsetY?: number;
      bg?: boolean;
    }
  ): void {
    const ctx = this.ctx;
    const [sx, sy] = this.toScreen(worldX, worldY);
    const ox = options?.offsetX ?? 0;
    const oy = options?.offsetY ?? 0;
    ctx.save();
    ctx.font = options?.font ?? 'bold 13px -apple-system, sans-serif';
    ctx.textAlign = options?.align ?? 'left';
    ctx.textBaseline = options?.baseline ?? 'middle';

    if (options?.bg) {
      const metrics = ctx.measureText(text);
      const tw = metrics.width + 10;
      const th = 20;
      ctx.fillStyle = 'rgba(5, 10, 18, 0.75)';
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 0.5;
      const rx = options?.align === 'center' ? sx + ox - tw / 2 : sx + ox - 5;
      roundRect(ctx, rx, sy + oy - th / 2, tw, th, 4);
      ctx.fill();
      ctx.stroke();
    }

    ctx.fillStyle = options?.color ?? '#e2e8f0';
    ctx.fillText(text, sx + ox, sy + oy);
    ctx.restore();
  }

  // ===== Bloom post-processing =====

  /** Apply a soft bloom/glow pass to bright areas */
  applyBloom(intensity: number = 0.3): void {
    const w = this.logicalWidth;
    const h = this.logicalHeight;

    if (!this.bloomCanvas) {
      this.bloomCanvas = document.createElement('canvas');
      this.bloomCtx = this.bloomCanvas.getContext('2d')!;
    }

    // Downscale for performance
    const scale = 0.25;
    const bw = Math.floor(w * scale);
    const bh = Math.floor(h * scale);
    this.bloomCanvas.width = bw;
    this.bloomCanvas.height = bh;
    const bctx = this.bloomCtx!;

    // Draw downscaled version
    bctx.drawImage(this.canvas, 0, 0, bw, bh);

    // Apply blur by drawing multiple offset copies
    bctx.filter = `blur(${Math.floor(bw * 0.02)}px)`;
    bctx.drawImage(this.bloomCanvas, 0, 0);
    bctx.filter = 'none';

    // Composite bloom back
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = intensity;
    ctx.globalCompositeOperation = 'screen';
    ctx.setTransform(1, 0, 0, 1, 0, 0); // reset to pixel coords
    ctx.drawImage(this.bloomCanvas, 0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); // restore
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // ===== High-quality object renderers =====

  /** Draw a wooden crate with plank texture, nails, and 3D depth */
  drawCrate(
    worldX: number, worldY: number,
    halfW: number, halfH: number,
    label?: string, rotation?: number
  ): void {
    const ctx = this.ctx;
    const [sx, sy] = this.toScreen(worldX, worldY);
    const pw = halfW * this.pxPerUnit * 2;
    const ph = halfH * this.pxPerUnit * 2;
    const depth = Math.min(8, pw * 0.12);

    ctx.save();
    ctx.translate(sx, sy);
    if (rotation) ctx.rotate(-rotation);

    // Drop shadow
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fillRect(-pw / 2, -ph, pw, ph);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 3D side face (right)
    const sideGrad = ctx.createLinearGradient(pw / 2, 0, pw / 2 + depth, 0);
    sideGrad.addColorStop(0, '#7a5c3a');
    sideGrad.addColorStop(1, '#5a3e22');
    ctx.fillStyle = sideGrad;
    ctx.beginPath();
    ctx.moveTo(pw / 2, -ph); ctx.lineTo(pw / 2 + depth, -ph - depth);
    ctx.lineTo(pw / 2 + depth, -depth); ctx.lineTo(pw / 2, 0);
    ctx.closePath();
    ctx.fill();

    // 3D top face
    const topGrad = ctx.createLinearGradient(0, -ph, 0, -ph - depth);
    topGrad.addColorStop(0, '#a07850');
    topGrad.addColorStop(1, '#8a6540');
    ctx.fillStyle = topGrad;
    ctx.beginPath();
    ctx.moveTo(-pw / 2, -ph); ctx.lineTo(-pw / 2 + depth, -ph - depth);
    ctx.lineTo(pw / 2 + depth, -ph - depth); ctx.lineTo(pw / 2, -ph);
    ctx.closePath();
    ctx.fill();

    // Front face — wood base color
    const woodGrad = ctx.createLinearGradient(-pw / 2, -ph, -pw / 2, 0);
    woodGrad.addColorStop(0, '#9a7a52');
    woodGrad.addColorStop(0.3, '#8d6d45');
    woodGrad.addColorStop(0.7, '#7a5c3a');
    woodGrad.addColorStop(1, '#6b4f30');
    ctx.fillStyle = woodGrad;
    ctx.fillRect(-pw / 2, -ph, pw, ph);

    // Horizontal plank lines
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = 1;
    const plankCount = Math.max(2, Math.floor(ph / 16));
    for (let i = 1; i < plankCount; i++) {
      const py = -ph + (ph * i) / plankCount;
      ctx.beginPath();
      ctx.moveTo(-pw / 2 + 1, py);
      ctx.lineTo(pw / 2 - 1, py);
      ctx.stroke();
      // Subtle highlight above plank line
      ctx.strokeStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath();
      ctx.moveTo(-pw / 2 + 1, py + 1);
      ctx.lineTo(pw / 2 - 1, py + 1);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    }

    // Vertical center brace
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, -ph + 2); ctx.lineTo(0, -2);
    ctx.stroke();

    // Wood grain (subtle diagonal lines)
    ctx.strokeStyle = 'rgba(0,0,0,0.05)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 6; i++) {
      const x = -pw / 2 + (pw * (i + 0.5)) / 6;
      ctx.beginPath();
      ctx.moveTo(x - 4, -ph + 2);
      ctx.bezierCurveTo(x - 2, -ph * 0.6, x + 3, -ph * 0.3, x - 1, -2);
      ctx.stroke();
    }

    // Corner nails (4 corners)
    const nailR = Math.min(3, pw * 0.04);
    const nailInset = nailR + 4;
    const nailPositions = [
      [-pw / 2 + nailInset, -ph + nailInset],
      [pw / 2 - nailInset, -ph + nailInset],
      [-pw / 2 + nailInset, -nailInset],
      [pw / 2 - nailInset, -nailInset],
    ];
    for (const [nx, ny] of nailPositions) {
      ctx.beginPath();
      ctx.arc(nx, ny, nailR, 0, Math.PI * 2);
      const nailGrad = ctx.createRadialGradient(nx - 0.5, ny - 0.5, 0, nx, ny, nailR);
      nailGrad.addColorStop(0, '#c0c0c0');
      nailGrad.addColorStop(0.6, '#888');
      nailGrad.addColorStop(1, '#555');
      ctx.fillStyle = nailGrad;
      ctx.fill();
    }

    // Front outline
    ctx.strokeStyle = 'rgba(60, 40, 20, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-pw / 2, -ph, pw, ph);

    // Top edge specular
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-pw / 2 + 3, -ph + 1);
    ctx.lineTo(pw / 2 - 3, -ph + 1);
    ctx.stroke();

    // Label
    if (label) {
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 4;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.max(14, pw * 0.2)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, -ph / 2);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  /** Draw a metallic block with brushed metal texture */
  drawMetalBlock(
    worldX: number, worldY: number,
    halfW: number, halfH: number,
    color: string = '#6888aa',
    label?: string, rotation?: number
  ): void {
    const ctx = this.ctx;
    const [sx, sy] = this.toScreen(worldX, worldY);
    const pw = halfW * this.pxPerUnit * 2;
    const ph = halfH * this.pxPerUnit * 2;
    const depth = Math.min(7, pw * 0.1);
    const rgb = hexToRgb(color) ?? { r: 104, g: 136, b: 170 };

    ctx.save();
    ctx.translate(sx, sy);
    if (rotation) ctx.rotate(-rotation);

    // Shadow
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = 'rgba(0,0,0,0.01)';
    ctx.fillRect(-pw / 2, -ph, pw, ph);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // 3D side
    ctx.fillStyle = `rgb(${rgb.r - 30},${rgb.g - 30},${rgb.b - 30})`;
    ctx.beginPath();
    ctx.moveTo(pw / 2, -ph); ctx.lineTo(pw / 2 + depth, -ph - depth);
    ctx.lineTo(pw / 2 + depth, -depth); ctx.lineTo(pw / 2, 0);
    ctx.closePath(); ctx.fill();

    // 3D top
    ctx.fillStyle = `rgb(${Math.min(255, rgb.r + 20)},${Math.min(255, rgb.g + 20)},${Math.min(255, rgb.b + 20)})`;
    ctx.beginPath();
    ctx.moveTo(-pw / 2, -ph); ctx.lineTo(-pw / 2 + depth, -ph - depth);
    ctx.lineTo(pw / 2 + depth, -ph - depth); ctx.lineTo(pw / 2, -ph);
    ctx.closePath(); ctx.fill();

    // Front face gradient
    const metalGrad = ctx.createLinearGradient(-pw / 2, -ph, pw / 2, 0);
    metalGrad.addColorStop(0, `rgb(${Math.min(255, rgb.r + 15)},${Math.min(255, rgb.g + 15)},${Math.min(255, rgb.b + 15)})`);
    metalGrad.addColorStop(0.5, color);
    metalGrad.addColorStop(1, `rgb(${rgb.r - 20},${rgb.g - 20},${rgb.b - 20})`);
    ctx.fillStyle = metalGrad;
    ctx.fillRect(-pw / 2, -ph, pw, ph);

    // Brushed metal lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 0.5;
    for (let y = -ph + 2; y < 0; y += 3) {
      ctx.beginPath();
      ctx.moveTo(-pw / 2 + 2, y);
      ctx.lineTo(pw / 2 - 2, y);
      ctx.stroke();
    }

    // Outline
    ctx.strokeStyle = `rgba(${rgb.r + 40},${rgb.g + 40},${rgb.b + 40},0.5)`;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-pw / 2, -ph, pw, ph);

    // Top specular
    const specGrad = ctx.createLinearGradient(-pw / 2, -ph, pw / 2, -ph);
    specGrad.addColorStop(0, 'rgba(255,255,255,0)');
    specGrad.addColorStop(0.3, 'rgba(255,255,255,0.2)');
    specGrad.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.strokeStyle = specGrad;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-pw / 2 + 4, -ph + 1);
    ctx.lineTo(pw / 2 - 4, -ph + 1);
    ctx.stroke();

    // Label
    if (label) {
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 3;
      ctx.fillStyle = 'rgba(255,255,255,0.95)';
      ctx.font = `bold ${Math.max(14, pw * 0.2)}px -apple-system, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 0, -ph / 2);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }

  /** Draw a textured ground surface with hatching below */
  drawTexturedGround(
    worldLeft: number, worldRight: number, worldY: number = 0,
    style: 'concrete' | 'grass' | 'ice' = 'concrete'
  ): void {
    const ctx = this.ctx;
    const [x1, y1] = this.toScreen(worldLeft, worldY);
    const [x2] = this.toScreen(worldRight, worldY);
    const groundH = 35;
    const w = x2 - x1;

    ctx.save();

    // Ground body
    const colors = {
      concrete: { top: 'rgba(80, 90, 105, 0.5)', mid: 'rgba(60, 70, 85, 0.35)', bot: 'rgba(40, 50, 65, 0.15)', line: 'rgba(150, 165, 185, 0.6)', hatch: 'rgba(130, 145, 170, 0.18)' },
      grass: { top: 'rgba(50, 90, 50, 0.5)', mid: 'rgba(40, 75, 40, 0.35)', bot: 'rgba(30, 55, 30, 0.15)', line: 'rgba(80, 180, 80, 0.5)', hatch: 'rgba(60, 140, 60, 0.15)' },
      ice: { top: 'rgba(120, 160, 200, 0.3)', mid: 'rgba(100, 140, 180, 0.2)', bot: 'rgba(80, 120, 160, 0.08)', line: 'rgba(160, 200, 240, 0.5)', hatch: 'rgba(140, 180, 220, 0.12)' },
    };
    const c = colors[style];

    const bodyGrad = ctx.createLinearGradient(x1, y1, x1, y1 + groundH);
    bodyGrad.addColorStop(0, c.top);
    bodyGrad.addColorStop(0.4, c.mid);
    bodyGrad.addColorStop(1, c.bot);
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(x1, y1, w, groundH);

    // Hatching
    ctx.strokeStyle = c.hatch;
    ctx.lineWidth = 1;
    for (let x = x1; x <= x2; x += 11) {
      ctx.beginPath();
      ctx.moveTo(x, y1 + 2);
      ctx.lineTo(x - 10, y1 + 12);
      ctx.stroke();
    }

    // Surface line
    ctx.strokeStyle = c.line;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = c.line;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Specular on surface
    const specGrad = ctx.createLinearGradient(x1, y1 - 1, x1, y1 + 3);
    specGrad.addColorStop(0, 'rgba(255,255,255,0.1)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.fillRect(x1, y1 - 1, w, 4);

    ctx.restore();
  }

  /** Draw a 3D incline/ramp with texture */
  drawIncline(
    originX: number, originY: number,
    length: number, angleRad: number,
    style: 'concrete' | 'metal' = 'concrete'
  ): void {
    const ctx = this.ctx;
    const topX = originX + length * Math.cos(angleRad);
    const topY = originY + length * Math.sin(angleRad);
    const [s0x, s0y] = this.toScreen(originX, originY);
    const [s1x, s1y] = this.toScreen(topX, topY);
    const [s2x] = this.toScreen(topX, originY);
    const depth = 8;

    const isMetal = style === 'metal';
    const baseColor = isMetal ? [80, 100, 130] : [70, 85, 65];

    ctx.save();

    // 3D depth — bottom face
    ctx.fillStyle = `rgba(${baseColor[0] - 20},${baseColor[1] - 20},${baseColor[2] - 20},0.5)`;
    ctx.beginPath();
    ctx.moveTo(s0x, s0y); ctx.lineTo(s0x + depth, s0y + depth);
    ctx.lineTo(s2x + depth, s0y + depth); ctx.lineTo(s2x, s0y);
    ctx.closePath(); ctx.fill();

    // 3D depth — right face
    ctx.fillStyle = `rgba(${baseColor[0] - 10},${baseColor[1] - 10},${baseColor[2] - 10},0.4)`;
    ctx.beginPath();
    ctx.moveTo(s2x, s0y); ctx.lineTo(s2x + depth, s0y + depth);
    ctx.lineTo(s1x + depth, s1y + depth); ctx.lineTo(s1x, s1y);
    ctx.closePath(); ctx.fill();

    // Main triangle face
    const triGrad = ctx.createLinearGradient(s0x, s1y, s0x, s0y);
    triGrad.addColorStop(0, `rgba(${baseColor[0] + 30},${baseColor[1] + 30},${baseColor[2] + 30},0.55)`);
    triGrad.addColorStop(0.5, `rgba(${baseColor[0] + 10},${baseColor[1] + 10},${baseColor[2] + 10},0.45)`);
    triGrad.addColorStop(1, `rgba(${baseColor[0]},${baseColor[1]},${baseColor[2]},0.35)`);
    ctx.fillStyle = triGrad;
    ctx.beginPath();
    ctx.moveTo(s0x, s0y); ctx.lineTo(s1x, s1y); ctx.lineTo(s2x, s0y);
    ctx.closePath(); ctx.fill();

    // Surface edge (the slope) with glow
    const slopeColor = isMetal ? 'rgba(140,170,210,0.6)' : 'rgba(100,180,100,0.5)';
    ctx.strokeStyle = slopeColor;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = slopeColor;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(s0x, s0y); ctx.lineTo(s1x, s1y);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Other edges
    ctx.strokeStyle = `rgba(${baseColor[0] + 40},${baseColor[1] + 40},${baseColor[2] + 40},0.3)`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(s1x, s1y); ctx.lineTo(s2x, s0y); ctx.lineTo(s0x, s0y);
    ctx.stroke();

    // Specular highlight on slope
    const sLen = Math.sqrt((s1x - s0x) ** 2 + (s1y - s0y) ** 2);
    if (sLen > 10) {
      const nx = -(s1y - s0y) / sLen;
      const ny = (s1x - s0x) / sLen;
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(s0x + nx * 4 + (s1x - s0x) * 0.1, s0y + ny * 4 + (s1y - s0y) * 0.1);
      ctx.lineTo(s0x + nx * 4 + (s1x - s0x) * 0.9, s0y + ny * 4 + (s1y - s0y) * 0.9);
      ctx.stroke();
    }

    ctx.restore();
  }

  /** Draw a 3D coil spring between two screen points */
  drawSpring(
    worldX1: number, worldY1: number,
    worldX2: number, worldY2: number,
    coils: number = 8, amplitude: number = 10,
    color: string = '#60a5fa'
  ): void {
    const ctx = this.ctx;
    const [x1, y1] = this.toScreen(worldX1, worldY1);
    const [x2, y2] = this.toScreen(worldX2, worldY2);
    const dx = x2 - x1, dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len < 2) return;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const rgb = hexToRgb(color) ?? { r: 96, g: 165, b: 250 };

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(x1 + 1, y1 + 2);
    const totalSegs = coils * 2;
    for (let i = 0; i < totalSegs; i++) {
      const t = (i + 1) / totalSegs;
      const px = x1 + dx * t + 1;
      const py = y1 + dy * t + 2;
      const side = i % 2 === 0 ? 1 : -1;
      if (i < totalSegs - 1) {
        const mt = (i + 0.5) / totalSegs;
        ctx.quadraticCurveTo(x1 + dx * mt + nx * amplitude * side + 1, y1 + dy * mt + ny * amplitude * side + 2, px, py);
      } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();

    // Main coil
    const coilGrad = ctx.createLinearGradient(x1, y1, x2, y2);
    coilGrad.addColorStop(0, color);
    coilGrad.addColorStop(0.5, `rgb(${Math.min(255, rgb.r + 40)},${Math.min(255, rgb.g + 40)},${Math.min(255, rgb.b + 40)})`);
    coilGrad.addColorStop(1, color);
    ctx.strokeStyle = coilGrad;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    for (let i = 0; i < totalSegs; i++) {
      const t = (i + 1) / totalSegs;
      const px = x1 + dx * t;
      const py = y1 + dy * t;
      const side = i % 2 === 0 ? 1 : -1;
      if (i < totalSegs - 1) {
        const mt = (i + 0.5) / totalSegs;
        ctx.quadraticCurveTo(x1 + dx * mt + nx * amplitude * side, y1 + dy * mt + ny * amplitude * side, px, py);
      } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1 + nx, y1 + ny);
    for (let i = 0; i < totalSegs; i++) {
      const t = (i + 1) / totalSegs;
      const px = x1 + dx * t + nx;
      const py = y1 + dy * t + ny;
      const side = i % 2 === 0 ? 1 : -1;
      if (i < totalSegs - 1) {
        const mt = (i + 0.5) / totalSegs;
        ctx.quadraticCurveTo(x1 + dx * mt + nx * (amplitude * side + 1), y1 + dy * mt + ny * (amplitude * side + 1), px, py);
      } else { ctx.lineTo(px, py); }
    }
    ctx.stroke();

    ctx.restore();
  }

  /** Draw a rope/string between two world points */
  drawRope(
    worldX1: number, worldY1: number,
    worldX2: number, worldY2: number,
    thickness: number = 2.5
  ): void {
    const ctx = this.ctx;
    const [sx1, sy1] = this.toScreen(worldX1, worldY1);
    const [sx2, sy2] = this.toScreen(worldX2, worldY2);
    const len = Math.sqrt((sx2 - sx1) ** 2 + (sy2 - sy1) ** 2);
    if (len < 1) return;
    const ux = (sx2 - sx1) / len;
    const uy = (sy2 - sy1) / len;

    ctx.save();

    // Shadow
    ctx.strokeStyle = 'rgba(0,0,0,0.2)';
    ctx.lineWidth = thickness + 2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx1 + 1, sy1 + 2); ctx.lineTo(sx2 + 1, sy2 + 2);
    ctx.stroke();

    // Main rope
    const ropeGrad = ctx.createLinearGradient(sx1, sy1, sx2, sy2);
    ropeGrad.addColorStop(0, 'rgba(190,180,165,0.9)');
    ropeGrad.addColorStop(0.5, 'rgba(170,160,145,0.8)');
    ropeGrad.addColorStop(1, 'rgba(150,140,125,0.9)');
    ctx.strokeStyle = ropeGrad;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(sx1, sy1); ctx.lineTo(sx2, sy2);
    ctx.stroke();

    // Highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(sx1 - uy * 0.5, sy1 + ux * 0.5);
    ctx.lineTo(sx2 - uy * 0.5, sy2 + ux * 0.5);
    ctx.stroke();

    // Attachment dots
    for (const [px, py] of [[sx1, sy1], [sx2, sy2]]) {
      const dotGrad = ctx.createRadialGradient(px - 0.5, py - 0.5, 0, px, py, 3.5);
      dotGrad.addColorStop(0, 'rgba(210,200,185,0.9)');
      dotGrad.addColorStop(1, 'rgba(140,130,115,0.7)');
      ctx.fillStyle = dotGrad;
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  /** Draw a pulley wheel at world position */
  drawPulley(worldX: number, worldY: number, radiusWorld: number): void {
    const ctx = this.ctx;
    const [sx, sy] = this.toScreen(worldX, worldY);
    const r = radiusWorld * this.pxPerUnit;

    ctx.save();

    // Outer ring
    const ringGrad = ctx.createRadialGradient(sx, sy, r * 0.7, sx, sy, r);
    ringGrad.addColorStop(0, '#556677');
    ringGrad.addColorStop(0.5, '#778899');
    ringGrad.addColorStop(1, '#445566');
    ctx.fillStyle = ringGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, r, 0, Math.PI * 2);
    ctx.fill();

    // Inner groove
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();

    // Hub
    const hubGrad = ctx.createRadialGradient(sx - 1, sy - 1, 0, sx, sy, r * 0.35);
    hubGrad.addColorStop(0, '#aabbcc');
    hubGrad.addColorStop(1, '#667788');
    ctx.fillStyle = hubGrad;
    ctx.beginPath();
    ctx.arc(sx, sy, r * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Spokes
    ctx.strokeStyle = 'rgba(120,140,160,0.4)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      ctx.beginPath();
      ctx.moveTo(sx + Math.cos(a) * r * 0.3, sy + Math.sin(a) * r * 0.3);
      ctx.lineTo(sx + Math.cos(a) * r * 0.8, sy + Math.sin(a) * r * 0.8);
      ctx.stroke();
    }

    // Axle dot
    ctx.fillStyle = '#99aabb';
    ctx.beginPath();
    ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Specular
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(sx, sy - r * 0.1, r * 0.6, -Math.PI * 0.7, -Math.PI * 0.3);
    ctx.stroke();

    // Mounting bracket
    ctx.fillStyle = 'rgba(90,100,115,0.6)';
    ctx.fillRect(sx - 4, sy - r - 12, 8, 12);
    ctx.strokeStyle = 'rgba(140,155,175,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(sx - 4, sy - r - 12, 8, 12);

    ctx.restore();
  }

  /** Draw a water body with animated surface */
  drawWater(
    worldLeft: number, worldRight: number,
    worldTop: number, worldBottom: number,
    time: number = 0
  ): void {
    const ctx = this.ctx;
    const [x1, y1] = this.toScreen(worldLeft, worldTop);
    const [x2, y2] = this.toScreen(worldRight, worldBottom);
    const w = x2 - x1;
    const h = y2 - y1;

    ctx.save();

    // Water body gradient
    const waterGrad = ctx.createLinearGradient(x1, y1, x1, y2);
    waterGrad.addColorStop(0, 'rgba(30, 100, 200, 0.15)');
    waterGrad.addColorStop(0.5, 'rgba(25, 80, 180, 0.22)');
    waterGrad.addColorStop(1, 'rgba(20, 60, 150, 0.30)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(x1, y1, w, h);

    // Animated wave surface
    ctx.strokeStyle = 'rgba(80, 160, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(80, 160, 255, 0.4)';
    ctx.shadowBlur = 6;
    ctx.beginPath();
    for (let x = x1; x <= x2; x += 2) {
      const frac = (x - x1) / w;
      const waveY = y1 + 2 * Math.sin(frac * 20 + time * 2) + 1 * Math.sin(frac * 35 + time * 3);
      if (x === x1) ctx.moveTo(x, waveY); else ctx.lineTo(x, waveY);
    }
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Secondary wave
    ctx.strokeStyle = 'rgba(60, 140, 230, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = x1; x <= x2; x += 2) {
      const frac = (x - x1) / w;
      const waveY = y1 + 8 + 1.5 * Math.sin(frac * 15 + time * 1.5 + 1);
      if (x === x1) ctx.moveTo(x, waveY); else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    ctx.restore();
  }

  /** Draw a wall (vertical surface with hatching) */
  drawWall(worldX: number, worldBottom: number, worldTop: number, side: 'left' | 'right' = 'left'): void {
    const ctx = this.ctx;
    const [sx, sy1] = this.toScreen(worldX, worldTop);
    const [, sy2] = this.toScreen(worldX, worldBottom);
    const wallW = 15;
    const dir = side === 'left' ? -1 : 1;

    ctx.save();

    // Wall body
    const wallGrad = ctx.createLinearGradient(sx, sy1, sx + wallW * dir, sy1);
    wallGrad.addColorStop(0, 'rgba(80, 90, 105, 0.5)');
    wallGrad.addColorStop(1, 'rgba(60, 70, 85, 0.2)');
    ctx.fillStyle = wallGrad;
    ctx.fillRect(Math.min(sx, sx + wallW * dir), sy1, wallW, sy2 - sy1);

    // Surface line
    ctx.strokeStyle = 'rgba(150, 165, 185, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx, sy1); ctx.lineTo(sx, sy2);
    ctx.stroke();

    // Hatching
    ctx.strokeStyle = 'rgba(130, 145, 170, 0.15)';
    ctx.lineWidth = 1;
    for (let y = sy1; y <= sy2; y += 10) {
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.lineTo(sx + 9 * dir, y - 9);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ===== Color utilities =====

function lightenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgb(${Math.min(255, rgb.r + amount)},${Math.min(255, rgb.g + amount)},${Math.min(255, rgb.b + amount)})`;
}

function darkenColor(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  return `rgb(${Math.max(0, rgb.r - amount)},${Math.max(0, rgb.g - amount)},${Math.max(0, rgb.b - amount)})`;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
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
