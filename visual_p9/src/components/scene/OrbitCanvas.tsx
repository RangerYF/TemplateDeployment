import { useEffect, useMemo, useRef, type PointerEvent as ReactPointerEvent } from 'react';
import { buildFrame, type SceneFrame, type Vec2 } from '@/engine/orbitalMechanics';
import { useActiveModel, useActiveParams, useSimulationStore } from '@/store/simulationStore';
import { useUIStore, type ViewportSnapshot } from '@/store/uiStore';
import { COLORS } from '@/styles/tokens';

interface Star {
  x: number;
  y: number;
  radius: number;
  alpha: number;
}

function makeStars(width: number, height: number): Star[] {
  const count = Math.max(80, Math.floor((width * height) / 9000));
  return Array.from({ length: count }, (_, index) => {
    const seed = Math.sin(index * 93.171) * 10000;
    const seed2 = Math.sin(index * 17.317) * 10000;
    return {
      x: (seed - Math.floor(seed)) * width,
      y: (seed2 - Math.floor(seed2)) * height,
      radius: 0.6 + ((index * 7) % 11) / 12,
      alpha: 0.35 + ((index * 13) % 17) / 30,
    };
  });
}

function toCanvas(point: Vec2, width: number, height: number, viewport: ViewportSnapshot): Vec2 {
  return {
    x: width / 2 + viewport.offsetX + point.x * viewport.zoom,
    y: height / 2 + viewport.offsetY + point.y * viewport.zoom,
  };
}

function drawPath(ctx: CanvasRenderingContext2D, frame: SceneFrame, width: number, height: number, viewport: ViewportSnapshot) {
  for (const path of frame.paths) {
    if (path.points.length === 0) continue;
    ctx.save();
    ctx.strokeStyle = path.color;
    ctx.lineWidth = 1.6;
    ctx.globalAlpha = 0.86;
    if (path.dashed) ctx.setLineDash([8, 7]);
    ctx.beginPath();
    path.points.forEach((point, index) => {
      const p = toCanvas(point, width, height, viewport);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.restore();
  }
}

function drawSectors(ctx: CanvasRenderingContext2D, frame: SceneFrame, width: number, height: number, viewport: ViewportSnapshot, enabled: boolean) {
  if (!enabled) return;
  for (const sector of frame.sectors) {
    if (sector.points.length < 3) continue;
    ctx.save();
    ctx.fillStyle = sector.color;
    ctx.strokeStyle = 'rgba(255,235,59,0.72)';
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    sector.points.forEach((point, index) => {
      const p = toCanvas(point, width, height, viewport);
      if (index === 0) ctx.moveTo(p.x, p.y);
      else ctx.lineTo(p.x, p.y);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    const labelPoint = sector.points.reduce<Vec2>(
      (sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }),
      { x: 0, y: 0 },
    );
    const label = toCanvas(
      { x: labelPoint.x / sector.points.length, y: labelPoint.y / sector.points.length },
      width,
      height,
      viewport,
    );
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = '600 12px Inter, sans-serif';
    ctx.fillText(sector.areaLabel, label.x + 4, label.y - 4);
    ctx.restore();
  }
}

function drawBody(ctx: CanvasRenderingContext2D, body: SceneFrame['bodies'][number], width: number, height: number, viewport: ViewportSnapshot) {
  const p = toCanvas(body.position, width, height, viewport);
  const radius = Math.max(4, body.radiusPx * Math.sqrt(viewport.zoom));
  const gradient = ctx.createRadialGradient(p.x - radius * 0.35, p.y - radius * 0.35, 1, p.x, p.y, radius * 1.3);
  gradient.addColorStop(0, '#FFFFFF');
  gradient.addColorStop(0.22, body.color);
  gradient.addColorStop(1, 'rgba(0,0,0,0.15)');

  ctx.save();
  ctx.shadowColor = body.color;
  ctx.shadowBlur = radius * 1.4;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = 'rgba(255,255,255,0.46)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.86)';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(body.label, p.x, p.y + radius + 16);
  ctx.restore();
}

function drawVector(ctx: CanvasRenderingContext2D, from: Vec2, to: Vec2, color: string, label: string, width: number, height: number, viewport: ViewportSnapshot) {
  const start = toCanvas(from, width, height, viewport);
  const end = toCanvas(to, width, height, viewport);
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const head = 7;

  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - head * Math.cos(angle - Math.PI / 6), end.y - head * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(end.x - head * Math.cos(angle + Math.PI / 6), end.y - head * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
  ctx.font = '12px Inter, sans-serif';
  ctx.fillText(label, end.x + 8, end.y - 8);
  ctx.restore();
}

function drawMarkers(ctx: CanvasRenderingContext2D, frame: SceneFrame, width: number, height: number, viewport: ViewportSnapshot) {
  for (const marker of frame.markers) {
    const p = toCanvas(marker.position, width, height, viewport);
    ctx.save();
    ctx.strokeStyle = marker.color;
    ctx.fillStyle = marker.color;
    ctx.lineWidth = 1.6;
    if (marker.cross) {
      ctx.beginPath();
      ctx.moveTo(p.x - 8, p.y);
      ctx.lineTo(p.x + 8, p.y);
      ctx.moveTo(p.x, p.y - 8);
      ctx.lineTo(p.x, p.y + 8);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.font = '12px Inter, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillText(marker.label, p.x + 10, p.y - 8);
    ctx.restore();
  }
}

function drawHud(ctx: CanvasRenderingContext2D, frame: SceneFrame, width: number, height: number) {
  const boxWidth = Math.min(420, width - 32);
  ctx.save();
  ctx.fillStyle = 'rgba(5, 10, 24, 0.72)';
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(16, height - 102, boxWidth, 82, 18);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.font = '600 13px Inter, sans-serif';
  ctx.fillText(frame.metrics.title, 34, height - 72);
  ctx.font = '12px Inter, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.68)';
  ctx.fillText(frame.metrics.insight.slice(0, 52), 34, height - 48);
  ctx.fillText(frame.scaleLabel, 34, height - 28);
  ctx.restore();
}

function renderFrame(
  ctx: CanvasRenderingContext2D,
  frame: SceneFrame,
  width: number,
  height: number,
  viewport: ViewportSnapshot,
  showVectors: boolean,
  showAreaSectors: boolean,
) {
  ctx.clearRect(0, 0, width, height);

  const background = ctx.createLinearGradient(0, 0, width, height);
  background.addColorStop(0, '#050A18');
  background.addColorStop(0.55, '#07162C');
  background.addColorStop(1, '#111827');
  ctx.fillStyle = background;
  ctx.fillRect(0, 0, width, height);

  for (const star of makeStars(width, height)) {
    ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(0, 0);
  drawSectors(ctx, frame, width, height, viewport, showAreaSectors);
  drawPath(ctx, frame, width, height, viewport);
  drawMarkers(ctx, frame, width, height, viewport);
  for (const body of frame.bodies) drawBody(ctx, body, width, height, viewport);
  if (showVectors) {
    for (const vector of frame.vectors) drawVector(ctx, vector.from, vector.to, vector.color, vector.label, width, height, viewport);
  }
  ctx.restore();

  drawHud(ctx, frame, width, height);
}

export function OrbitCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const viewport = useUIStore((state) => state.viewport);
  const setViewport = useUIStore((state) => state.setViewport);
  const model = useActiveModel();
  const params = useActiveParams();
  const elapsedSeconds = useSimulationStore((state) => state.elapsedSeconds);
  const hohmannPhase = useSimulationStore((state) => state.hohmannPhase);
  const hohmannIgnitionAngle = useSimulationStore((state) => state.hohmannIgnitionAngle);
  const showVectors = useSimulationStore((state) => state.showVectors);
  const showAreaSectors = useSimulationStore((state) => state.showAreaSectors);
  const tick = useSimulationStore((state) => state.tick);

  const frame = useMemo(
    () => buildFrame(model.id, params, elapsedSeconds, hohmannPhase, hohmannIgnitionAngle),
    [elapsedSeconds, hohmannIgnitionAngle, hohmannPhase, model.id, params],
  );

  useEffect(() => {
    let animationId = 0;
    let last = performance.now();
    const run = (now: number) => {
      const delta = Math.min(0.05, (now - last) / 1000);
      last = now;
      tick(delta);
      animationId = requestAnimationFrame(run);
    };
    animationId = requestAnimationFrame(run);
    return () => cancelAnimationFrame(animationId);
  }, [tick]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const width = Math.max(320, rect.width);
      const height = Math.max(320, rect.height);
      canvas.width = Math.floor(width * ratio);
      canvas.height = Math.floor(height * ratio);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      renderFrame(ctx, frame, width, height, viewport, showVectors, showAreaSectors);
    };

    draw();
    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas);
    return () => resizeObserver.disconnect();
  }, [frame, showAreaSectors, showVectors, viewport]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.button !== 0) return;
    dragRef.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.x;
    const dy = event.clientY - drag.y;
    dragRef.current = { ...drag, x: event.clientX, y: event.clientY };
    setViewport((current) => ({ ...current, offsetX: current.offsetX + dx, offsetY: current.offsetY + dy }));
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      setViewport((current) => {
        const nextZoom = Math.min(2.4, Math.max(0.55, current.zoom * (event.deltaY > 0 ? 0.9 : 1.1)));
        const scale = nextZoom / current.zoom;
        return {
          zoom: nextZoom,
          offsetX: mouseX - rect.width / 2 - (mouseX - rect.width / 2 - current.offsetX) * scale,
          offsetY: mouseY - rect.height / 2 - (mouseY - rect.height / 2 - current.offsetY) * scale,
        };
      });
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [setViewport]);

  return (
    <div className="relative h-full w-full overflow-hidden" style={{ background: '#050A18' }}>
      <canvas
        ref={canvasRef}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      />
      <div className="pointer-events-none absolute left-4 top-4 rounded-[18px] border px-4 py-3 backdrop-blur-md" style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(5,10,24,0.58)' }}>
        <div className="text-xs font-semibold text-white">{model.name_cn}</div>
        <div className="mt-1 text-[11px]" style={{ color: 'rgba(255,255,255,0.68)' }}>
          {model.animations.mode} · {frame.scaleLabel}
        </div>
      </div>
      <div className="pointer-events-none absolute right-4 top-4 hidden rounded-full px-3 py-1.5 text-xs font-medium text-white md:block" style={{ background: 'rgba(255,255,255,0.12)' }}>
        2D Canvas · 左键拖拽 · 滚轮缩放 {viewport.zoom.toFixed(2)}x
      </div>
      <div className="absolute bottom-4 right-4 rounded-[18px] border px-4 py-3 text-xs backdrop-blur-md xl:hidden" style={{ borderColor: 'rgba(255,255,255,0.14)', background: 'rgba(5,10,24,0.66)', color: COLORS.white }}>
        <div className="font-semibold">{frame.metrics.title}</div>
        <div className="mt-1 max-w-[260px] text-[11px]" style={{ color: 'rgba(255,255,255,0.68)' }}>
          {frame.metrics.values.slice(0, 3).map((item) => `${item.label}: ${item.value}`).join(' · ')}
        </div>
      </div>
    </div>
  );
}
