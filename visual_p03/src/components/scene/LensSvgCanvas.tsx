/**
 * LensSvgCanvas.tsx
 * Main SVG rendering component for the lens imaging module.
 * Ported from phys_template_p03/src/module-lens.tsx — visual logic preserved exactly.
 */

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useLensStore } from '@/store/lensStore';
import { solveLens, clampLensX, clampSourceX, clampScreenX, clamp, computeLensVisualHeight } from '@/engine/lensSolver';
import type { LensRaySegment } from '@/engine/lensSolver';
import type { LensDragTarget, LensSettings, LensKind } from '@/data/lensData';
import { LENS_STAGE } from '@/data/lensData';

// ---------------------------------------------------------------------------
// Sub-components: Grid, Shapes, Marks, Objects
// ---------------------------------------------------------------------------

function LensGrid({ w, h, step = 24 }: { w: number; h: number; step?: number }) {
  const lines: React.ReactElement[] = [];
  for (let x = 0; x <= w; x += step) {
    lines.push(
      <line
        key={`vx${x}`}
        x1={x} y1={0} x2={x} y2={h}
        stroke="var(--theme-border, #e5e5e5)"
        strokeWidth={x % 120 === 0 ? 0.6 : 0.25}
        opacity={x % 120 === 0 ? 0.5 : 0.3}
      />,
    );
  }
  for (let y = 0; y <= h; y += step) {
    lines.push(
      <line
        key={`hy${y}`}
        x1={0} y1={y} x2={w} y2={y}
        stroke="var(--theme-border, #e5e5e5)"
        strokeWidth={y % 120 === 0 ? 0.6 : 0.25}
        opacity={y % 120 === 0 ? 0.5 : 0.3}
      />,
    );
  }
  return <g>{lines}</g>;
}

function LensShape({ type, x, y, height }: { type: LensKind; x: number; y: number; height: number }) {
  if (type === 'convex') {
    return (
      <g transform={`translate(${x}, ${y})`}>
        <path
          d={`M 0 ${-height / 2} Q 18 0 0 ${height / 2} Q -18 0 0 ${-height / 2} Z`}
          fill="oklch(0.85 0.04 210 / 0.3)"
          stroke="var(--theme-text-muted, #888)"
          strokeWidth={1.5}
        />
        <line
          x1={0} y1={-height / 2 - 14} x2={0} y2={height / 2 + 14}
          stroke="var(--theme-text-muted, #888)"
          strokeWidth={0.8}
          strokeDasharray="2 2"
        />
      </g>
    );
  }
  return (
    <g transform={`translate(${x}, ${y})`}>
      <path
        d={`M -8 ${-height / 2} L 8 ${-height / 2} Q -4 0 8 ${height / 2} L -8 ${height / 2} Q 4 0 -8 ${-height / 2} Z`}
        fill="oklch(0.85 0.04 210 / 0.3)"
        stroke="var(--theme-text-muted, #888)"
        strokeWidth={1.5}
      />
      <line
        x1={0} y1={-height / 2 - 14} x2={0} y2={height / 2 + 14}
        stroke="var(--theme-text-muted, #888)"
        strokeWidth={0.8}
        strokeDasharray="2 2"
      />
    </g>
  );
}

function FocalMark({ x, y, label, dim }: { x: number; y: number; label: string; dim?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={3.5} fill={dim ? 'var(--theme-text-muted, #888)' : 'var(--theme-primary, #00C06B)'} />
      <text
        y={18} textAnchor="middle"
        className="text-[10px]"
        fill={dim ? 'var(--theme-text-muted, #888)' : 'var(--theme-text, #333)'}
      >
        {label}
      </text>
    </g>
  );
}

function FocusMarker({ x, y, label, virtual }: { x: number; y: number; label: string; virtual?: boolean }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle
        r={6.5}
        fill={virtual ? 'none' : 'oklch(0.70 0.18 45)'}
        stroke="oklch(0.70 0.18 45)"
        strokeWidth={1.5}
        strokeDasharray={virtual ? '4 3' : undefined}
      />
      <text
        x={10} y={-10}
        className="text-[10px]"
        fill="var(--theme-text, #333)"
      >
        {label}
      </text>
    </g>
  );
}

function CandleObject({ x, y, h, label }: { x: number; y: number; h: number; label: string }) {
  const s = clamp(h / 80, 0.5, 2.5);
  const bodyH = Math.min(Math.max(16, h * 0.72), Math.max(1, h - 2));
  const bodyW = Math.max(12, h * 0.18);
  const candleTop = y - bodyH;
  const flameY = y - h;
  return (
    <g>
      <rect x={x - bodyW / 2} y={candleTop} width={bodyW} height={bodyH} rx={bodyW / 2} fill="oklch(0.91 0.06 85)" stroke="oklch(0.70 0.05 80)" strokeWidth="1.2" />
      <rect x={x - bodyW / 2 + 2} y={candleTop + 5} width={Math.max(3, bodyW - 4)} height={Math.max(8, bodyH - 10)} rx={Math.max(2, (bodyW - 4) / 2)} fill="oklch(0.97 0.03 90)" opacity="0.55" />
      <line x1={x} y1={candleTop + 1} x2={x} y2={candleTop - 4 * s} stroke="oklch(0.25 0.02 40)" strokeWidth="1.2" />
      <path d={`M ${x} ${flameY} C ${x + 5 * s} ${flameY + 6 * s}, ${x + 4 * s} ${flameY + 14 * s}, ${x} ${flameY + 18 * s} C ${x - 5 * s} ${flameY + 14 * s}, ${x - 4 * s} ${flameY + 6 * s}, ${x} ${flameY} Z`} fill="oklch(0.82 0.16 70)" />
      <path d={`M ${x} ${flameY + 5 * s} C ${x + 2 * s} ${flameY + 9 * s}, ${x + 2 * s} ${flameY + 13 * s}, ${x} ${flameY + 15 * s} C ${x - 2 * s} ${flameY + 13 * s}, ${x - 2 * s} ${flameY + 9 * s}, ${x} ${flameY + 5 * s} Z`} fill="oklch(0.98 0.08 100)" />
      <text className="text-[10px]" x={x + 10} y={candleTop + 4} fill="var(--theme-text, #333)">{label}</text>
    </g>
  );
}

function CandleImage({ x, y, h, label, virtual }: { x: number; y: number; h: number; label: string; virtual?: boolean }) {
  const absH = Math.abs(h);
  const inverted = h < 0;
  const s = clamp(absH / 80, 0.4, 2.5);
  const bodyH = Math.min(Math.max(12, absH * 0.72), Math.max(1, absH - 2));
  const bodyW = Math.max(8, absH * 0.18);
  const scale = inverted ? -1 : 1;
  const candleTop = -bodyH;
  const flameY = -absH;
  const op = virtual ? 0.48 : 0.72;
  const dash = virtual ? '3 3' : undefined;
  const fillBody = virtual ? 'oklch(0.78 0.02 220)' : 'oklch(0.75 0.10 154)';
  const strokeBody = virtual ? 'oklch(0.64 0.02 220)' : 'oklch(0.58 0.08 154)';
  const fillFlame = virtual ? 'oklch(0.72 0.04 220)' : 'oklch(0.78 0.14 70)';
  const fillCore = virtual ? 'oklch(0.84 0.02 220)' : 'oklch(0.92 0.08 90)';
  return (
    <g transform={`translate(${x}, ${y}) scale(1, ${scale})`} opacity={op}>
      <rect x={-bodyW / 2} y={candleTop} width={bodyW} height={bodyH} rx={bodyW / 2} fill={fillBody} stroke={strokeBody} strokeWidth="1" strokeDasharray={dash} />
      <line x1={0} y1={candleTop + 1} x2={0} y2={candleTop - 3 * s} stroke="oklch(0.35 0.02 40)" strokeWidth="1" strokeDasharray={dash} />
      <path d={`M 0 ${flameY} C ${4 * s} ${flameY + 5 * s}, ${3 * s} ${flameY + 11 * s}, 0 ${flameY + 14 * s} C ${-3 * s} ${flameY + 11 * s}, ${-4 * s} ${flameY + 5 * s}, 0 ${flameY} Z`} fill={fillFlame} />
      <path d={`M 0 ${flameY + 4 * s} C ${1.5 * s} ${flameY + 7 * s}, ${1.5 * s} ${flameY + 10 * s}, 0 ${flameY + 12 * s} C ${-1.5 * s} ${flameY + 10 * s}, ${-1.5 * s} ${flameY + 7 * s}, 0 ${flameY + 4 * s} Z`} fill={fillCore} />
      <text className="text-[10px]" x={bodyW / 2 + 6} y={candleTop + 2} transform={`scale(1, ${scale})`} fill={virtual ? 'var(--theme-text-muted, #888)' : 'var(--theme-text, #333)'}>{label}</text>
    </g>
  );
}

function ScenePointSource({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <g transform={`translate(${x}, ${y})`}>
      <circle r={5} fill="oklch(0.82 0.16 70)" stroke="oklch(0.70 0.12 60)" strokeWidth={1.2} />
      <circle r={2} fill="oklch(0.98 0.08 100)" />
      <text className="text-[10px]" x={10} y={-8} fill="var(--theme-text, #333)">{label}</text>
    </g>
  );
}

function SceneParallelSource({ x, y, width, label, color }: { x: number; y: number; width: number; label: string; color: string }) {
  return (
    <g>
      <rect x={x - width / 2} y={y - 70} width={width} height={140} rx={4} fill={color} opacity={0.15} stroke={color} strokeWidth={1} />
      <text className="text-[10px]" x={x} y={y - 78} textAnchor="middle" fill="var(--theme-text, #333)">{label}</text>
    </g>
  );
}

function SceneScreen({ x, top, bottom, label }: { x: number; top: number; bottom: number; label: string }) {
  return (
    <g>
      <line x1={x} y1={top} x2={x} y2={bottom} stroke="var(--theme-text-muted, #888)" strokeWidth={3} />
      <text className="text-[10px]" x={x + 8} y={top - 4} fill="var(--theme-text, #333)">{label}</text>
    </g>
  );
}

function DistanceBracket({ x1, x2, y, label, dashed }: { x1: number; x2: number; y: number; label: string; dashed?: boolean }) {
  const mid = (x1 + x2) / 2;
  const stroke = 'var(--theme-text-muted, #888)';
  const dash = dashed ? '3 3' : '2 3';
  return (
    <g opacity={dashed ? 0.65 : 1}>
      <line x1={x1} y1={y - 4} x2={x1} y2={y + 4} stroke={stroke} strokeDasharray={dashed ? '2 2' : undefined} />
      <line x1={x2} y1={y - 4} x2={x2} y2={y + 4} stroke={stroke} strokeDasharray={dashed ? '2 2' : undefined} />
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={stroke} strokeDasharray={dash} />
      <text className="text-[10px]" x={mid} y={y + 14} textAnchor="middle" fill="var(--theme-text-muted, #888)">{label}</text>
    </g>
  );
}

function LensRenderedRay({ segment, thick }: { segment: LensRaySegment; thick: number }) {
  const col = segment.color;
  if (segment.dashed) {
    return (
      <g>
        <line
          x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
          stroke={col} strokeWidth={Math.max(1, thick - 0.15)} opacity={segment.light ? 0.48 : 0.88} strokeDasharray="5 4"
        />
      </g>
    );
  }
  return (
    <g>
      <line
        x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
        stroke={col} strokeWidth={thick + 2.6} opacity={0.18} filter="url(#lens-soft-glow)"
      />
      <line
        x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
        stroke={col} strokeWidth={thick + 0.9} opacity={0.42}
      />
      <line
        x1={segment.from.x} y1={segment.from.y} x2={segment.to.x} y2={segment.to.y}
        stroke={col} strokeWidth={Math.max(1, thick - 0.15)} opacity={0.98}
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Main canvas component
// ---------------------------------------------------------------------------

export function LensSvgCanvas() {
  const settings = useLensStore((s) => s.settings);
  const updateSettings = useLensStore((s) => s.updateSettings);
  const viewport = useUIStore((s) => s.viewport);
  const setViewport = useUIStore((s) => s.setViewport);

  const result = useMemo(() => solveLens(settings), [settings]);
  const lensVisH = useMemo(() => computeLensVisualHeight(settings), [settings]);

  const W = LENS_STAGE.width;
  const H = LENS_STAGE.height;
  const axisY = LENS_STAGE.axisY;
  const lensX = clampLensX(settings.lensCenterX);
  const sourceX = clampSourceX(settings.objectX, lensX);
  const screenX = clampScreenX(settings.screenX, lensX);
  const sourcePoint =
    settings.sourceType === 'point'
      ? { x: sourceX, y: axisY - Math.max(18, settings.objectHeight * 0.78) }
      : { x: sourceX, y: axisY - settings.objectHeight };

  // -- Drag system ----------------------------------------------------------

  const dragRef = useRef<{
    kind: LensDragTarget;
    startX: number;
    startY: number;
    prev: LensSettings;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<LensDragTarget>(null);

  useEffect(() => {
    if (!dragTarget || !dragRef.current) return;

    const onMove = (event: PointerEvent): void => {
      const info = dragRef.current;
      if (!info) return;
      const dx = event.clientX - info.startX;
      const dy = event.clientY - info.startY;
      const localDx = dx / (info.prev.canvasZoom ?? 1);

      if (info.kind === 'pan') {
        setViewport({
          offsetX: clamp((info.prev.canvasPanX ?? 0) + dx, -2000, 2000),
          offsetY: clamp((info.prev.canvasPanY ?? 0) + dy, -2000, 2000),
          zoom: viewport.zoom,
        });
        return;
      }
      if (info.kind === 'source') {
        const nextLensX = clampLensX(info.prev.lensCenterX ?? 400);
        const nextObjectX = clampSourceX((info.prev.objectX ?? 360) + localDx, nextLensX);
        updateSettings({
          objectX: nextObjectX,
          objectDistance: Math.round((clampLensX(settings.lensCenterX ?? 400) - nextObjectX) * 10) / 10,
        });
        return;
      }
      if (info.kind === 'lens') {
        const prevObjectX = clampSourceX(info.prev.objectX ?? 260, clampLensX(info.prev.lensCenterX ?? 400));
        const nextLensX = clamp((info.prev.lensCenterX ?? 400) + localDx, prevObjectX + 18, LENS_STAGE.lensMaxX);
        updateSettings({
          lensCenterX: nextLensX,
          objectDistance: Math.round((nextLensX - clampSourceX(settings.objectX ?? 260, nextLensX)) * 10) / 10,
        });
        return;
      }
      // screen drag
      const nextScreenX = clampScreenX((info.prev.screenX ?? 520) + localDx, clampLensX(info.prev.lensCenterX ?? 400));
      updateSettings({ screenX: nextScreenX });
    };

    const onUp = (): void => {
      dragRef.current = null;
      setDragTarget(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragTarget, viewport.zoom, setViewport, updateSettings, settings]);

  const beginDrag = useCallback(
    (kind: LensDragTarget) => (event: React.PointerEvent): void => {
      event.stopPropagation();
      dragRef.current = {
        kind,
        startX: event.clientX,
        startY: event.clientY,
        prev: { ...settings, canvasPanX: viewport.offsetX, canvasPanY: viewport.offsetY },
      };
      setDragTarget(kind);
    },
    [settings, viewport.offsetX, viewport.offsetY],
  );

  const handleWheel = useCallback(
    (event: React.WheelEvent<SVGSVGElement>): void => {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.08 : 0.08;
      setViewport((prev) => ({
        ...prev,
        zoom: clamp(prev.zoom + delta, 0.7, 1.9),
      }));
    },
    [setViewport],
  );

  const handleStageDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>): void => {
      const target = event.target as SVGElement;
      if (target.closest('[data-lens-no-pan="true"]')) return;
      dragRef.current = {
        kind: 'pan',
        startX: event.clientX,
        startY: event.clientY,
        prev: { ...settings, canvasPanX: viewport.offsetX, canvasPanY: viewport.offsetY },
      };
      setDragTarget('pan');
    },
    [settings, viewport.offsetX, viewport.offsetY],
  );

  const panX = viewport.offsetX;
  const panY = viewport.offsetY;
  const zoom = clamp(viewport.zoom, 0.7, 1.9);

  return (
    <div className="relative h-full w-full" style={{ background: 'var(--theme-bg)' }}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          cursor: dragTarget === 'pan' ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onPointerDown={handleStageDown}
      >
        <defs>
          <filter id="lens-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <LensGrid w={W} h={H} />

        <g transform={`translate(${panX} ${panY}) scale(${zoom})`}>
          {/* Optical axis */}
          <line
            x1={LENS_STAGE.axisLeft} y1={axisY} x2={LENS_STAGE.axisRight} y2={axisY}
            stroke="var(--theme-text-muted, #888)"
            strokeWidth={0.8}
            strokeDasharray="2 4"
          />
          <text
            className="text-[10px]"
            x={LENS_STAGE.axisRight} y={axisY - 8} textAnchor="end"
            fill="var(--theme-text-muted, #888)"
          >
            主光轴
          </text>

          {/* Focal marks */}
          <FocalMark x={lensX - Math.abs(result.f)} y={axisY} label="F" />
          <FocalMark x={lensX + Math.abs(result.f)} y={axisY} label="F'" />
          <FocalMark x={lensX - 2 * Math.abs(result.f)} y={axisY} label="2F" dim />
          <FocalMark x={lensX + 2 * Math.abs(result.f)} y={axisY} label="2F'" dim />

          {/* Lens (draggable) */}
          <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('lens')}>
            <LensShape type={settings.lensType} x={lensX} y={axisY} height={lensVisH} />
          </g>

          {/* Object / Source */}
          {settings.sourceType === 'object' && (
            <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('source')}>
              <CandleObject x={sourceX} y={axisY} h={settings.objectHeight} label="蜡烛" />
            </g>
          )}
          {settings.sourceType === 'point' && (
            <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('source')}>
              <ScenePointSource x={sourcePoint.x} y={sourcePoint.y} label="点光源" />
            </g>
          )}
          {settings.sourceType === 'parallel' && (
            <SceneParallelSource
              x={LENS_STAGE.parallelSourceX}
              y={axisY}
              width={LENS_STAGE.parallelSourceWidth}
              label="平行光源"
              color="oklch(0.55 0.17 210)"
            />
          )}

          {/* Image (candle) */}
          {result.imageX !== null && settings.sourceType === 'object' && result.imageHeight !== null && (
            <CandleImage
              x={result.imageX}
              y={axisY}
              h={result.imageHeight}
              label={result.virtualImage ? '虚像' : '像'}
              virtual={result.virtualImage}
            />
          )}

          {/* Image (point source) */}
          {result.imageX !== null && settings.sourceType === 'point' && (
            <FocusMarker
              x={result.imageX}
              y={axisY - (result.imageHeight ?? 0)}
              label={result.virtualImage ? '虚像点' : '像点'}
              virtual={result.virtualImage}
            />
          )}

          {/* Image (parallel light) */}
          {settings.sourceType === 'parallel' && result.imageX !== null && (
            <FocusMarker
              x={settings.lensType === 'convex' ? result.imageX : lensX - Math.abs(result.f)}
              y={axisY}
              label={settings.lensType === 'convex' ? '焦点会聚' : '虚焦点'}
              virtual={settings.lensType === 'concave'}
            />
          )}

          {/* Ray bundles */}
          {settings.showRays && result.rayBundles.map((bundle) => (
            <g key={bundle.key}>
              {bundle.segments.map((segment, index) => (
                <LensRenderedRay key={`${bundle.key}-${index}`} segment={segment} thick={settings.rayThick} />
              ))}
            </g>
          ))}

          {/* Distance brackets */}
          <DistanceBracket
            x1={sourceX}
            x2={lensX}
            y={axisY + 84}
            label={settings.sourceType === 'parallel' ? '平行光入射' : `u = ${result.u.toFixed(1)} cm`}
          />

          {settings.sourceType !== 'parallel' && result.imageX !== null && Number.isFinite(result.v) && result.realImage && (
            <DistanceBracket x1={lensX} x2={result.imageX} y={axisY + 108} label={`v = ${result.v.toFixed(1)} cm`} />
          )}
          {settings.sourceType !== 'parallel' && result.imageX !== null && Number.isFinite(result.v) && result.virtualImage && (
            <DistanceBracket x1={result.imageX} x2={lensX} y={axisY + 108} label={`v = ${result.v.toFixed(1)} cm（虚）`} dashed />
          )}

          {/* Screen (draggable) */}
          {settings.showScreen && (
            <g data-lens-no-pan="true" style={{ cursor: 'grab' }} onPointerDown={beginDrag('screen')}>
              <SceneScreen x={screenX} top={axisY - 150} bottom={axisY + 150} label="屏幕" />
            </g>
          )}

          {settings.showScreen && result.imageX !== null && result.realImage && (
            <DistanceBracket x1={lensX} x2={screenX} y={axisY + 116} label={`屏距 = ${(screenX - lensX).toFixed(1)} cm`} />
          )}
        </g>
      </svg>

      {/* Legend overlay */}
      <div
        className="absolute bottom-4 right-4 rounded-xl px-3 py-2 text-[10px] space-y-1"
        style={{
          background: 'rgba(5, 10, 24, 0.6)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: 'rgba(255,255,255,0.8)',
        }}
      >
        <div className="font-semibold text-white/90">图例</div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm" style={{ background: 'oklch(0.68 0.16 24)' }} />
          <span>特殊光线</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm border border-dashed border-white/40" />
          <span>反向延长线</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-4 rounded-sm" style={{ background: 'var(--theme-text-muted, #888)' }} />
          <span>透镜 / 屏幕</span>
        </div>
      </div>

      {/* HUD overlay */}
      <div
        className="absolute bottom-4 left-4 flex flex-wrap gap-2 text-[10px]"
        style={{ pointerEvents: 'none' }}
      >
        <span
          className="rounded-full px-2.5 py-1"
          style={{ background: 'rgba(5, 10, 24, 0.6)', backdropFilter: 'blur(16px)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          路径 = {result.pathMode}
        </span>
        <span
          className="rounded-full px-2.5 py-1"
          style={{ background: 'rgba(5, 10, 24, 0.6)', backdropFilter: 'blur(16px)', color: 'rgba(255,255,255,0.85)', border: '1px solid rgba(255,255,255,0.12)' }}
        >
          像的性质 = {result.imageNature}
        </span>
        {settings.showScreen && (
          <span
            className="rounded-full px-2.5 py-1"
            style={{
              background: result.screenHit ? 'rgba(0,192,107,0.25)' : result.virtualImage ? 'rgba(255,180,0,0.2)' : 'rgba(5, 10, 24, 0.6)',
              backdropFilter: 'blur(16px)',
              color: result.screenHit ? 'rgba(0,230,120,0.95)' : result.virtualImage ? 'rgba(255,200,60,0.9)' : 'rgba(255,255,255,0.85)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            {result.screenHit ? '成像落在屏上' : result.virtualImage ? '虚像不能落屏' : '像未落在屏上'}
          </span>
        )}
      </div>
    </div>
  );
}
