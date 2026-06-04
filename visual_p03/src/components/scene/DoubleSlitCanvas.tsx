/**
 * DoubleSlitCanvas.tsx
 * Hybrid SVG + Canvas renderer for the double-slit interference module.
 *
 * Layout: vertical stack of cards —
 *   1. SVG setup diagram (light source → slit → screen)
 *   2. Canvas fringe pattern
 *   3. Canvas intensity plot (optional)
 */

import { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import {
  clamp,
  computeScreenFringeRects,
  computeSourceIntensityScale,
  drawFringePattern,
  drawIntensityPlot,
  fringeSpacing,
} from '@/engine/doubleSlitSolver';
import type { DoubleSlitSettings } from '@/data/doubleSlitData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DragTarget = 'slit' | 'screen' | 'source' | null;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DoubleSlitCanvas({
  settings,
  onUpdateSettings,
}: {
  settings: DoubleSlitSettings;
  onUpdateSettings: (updater: (prev: DoubleSlitSettings) => DoubleSlitSettings) => void;
}) {
  const { slitSpacing, slitWidth, screenDistance, wavelength, whiteLight, showColor, showIntensity } = settings;

  // SI values
  const d = slitSpacing * 1e-6;
  const L = screenDistance;
  const lam = wavelength * 1e-9;
  const color = wavelengthToColor(wavelength);
  const dy = fringeSpacing(lam, L, d);

  // Layout positions (clamped)
  const sourceX = clamp(settings.sourceX, 50, 180);
  const slitX = clamp(settings.slitX, 220, 420);
  const screenX = clamp(settings.screenX, slitX + 60, 760);
  const sourceIntensityScale = computeSourceIntensityScale(sourceX, slitX);

  // SVG slit geometry
  const setupCenterY = 75;
  const slitGapPx = clamp(12 + (slitSpacing - 50) / 950 * 42, 12, 54);
  const slitOpeningH = clamp(5 + (slitWidth - 5) / 75 * 7, 5, 12);
  const slitTopY = setupCenterY - slitGapPx / 2;
  const slitBottomY = setupCenterY + slitGapPx / 2;

  // Refs
  const setupRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLCanvasElement | null>(null);

  // Drag state
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const dragRef = useRef<{ kind: DragTarget; prev: DoubleSlitSettings } | null>(null);

  // ── Screen fringe rects (memoised) ──────────────────────────────────

  const screenFringeRects = useMemo(
    () => computeScreenFringeRects(settings, sourceIntensityScale),
    [slitSpacing, screenDistance, wavelength, slitWidth, whiteLight, sourceIntensityScale],
  );

  // ── Canvas draw effect ──────────────────────────────────────────────

  useEffect(() => {
    const redraw = () => {
      if (canvasRef.current) drawFringePattern(canvasRef.current, settings, sourceIntensityScale);
      if (plotRef.current) drawIntensityPlot(plotRef.current, settings, sourceIntensityScale);
    };
    const frame = requestAnimationFrame(redraw);
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
    const patternParent = canvasRef.current?.parentElement;
    const plotParent = plotRef.current?.parentElement;
    if (patternParent) observer?.observe(patternParent);
    if (plotParent) observer?.observe(plotParent);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [slitSpacing, screenDistance, wavelength, slitWidth, whiteLight, showColor, showIntensity, settings.sourceX, settings.slitX, settings.screenX]);

  // ── Drag system ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!dragTarget || !dragRef.current) return;
    let rafId = 0;
    let pendingX = 0;
    let hasPending = false;

    const flush = () => {
      rafId = 0;
      if (!hasPending) return;
      hasPending = false;
      const x = pendingX;
      const info = dragRef.current;
      if (!info) return;

      if (info.kind === 'source') {
        onUpdateSettings((prev) => ({ ...prev, sourceX: clamp(x, 50, prev.slitX - 80) }));
        return;
      }
      if (info.kind === 'slit') {
        onUpdateSettings((prev) => {
          const nextSlitX = clamp(x, prev.sourceX + 80, prev.screenX - 80);
          const nextDistance = clamp((prev.screenX - nextSlitX) / 110, 0.1, 5.0);
          return { ...prev, slitX: nextSlitX, screenDistance: Number(nextDistance.toFixed(2)) };
        });
        return;
      }
      onUpdateSettings((prev) => {
        const nextScreenX = clamp(x, prev.slitX + 60, 760);
        const nextDistance = clamp((nextScreenX - prev.slitX) / 110, 0.1, 5.0);
        return { ...prev, screenX: nextScreenX, screenDistance: Number(nextDistance.toFixed(2)) };
      });
    };

    const onMove = (event: PointerEvent) => {
      if (!setupRef.current) return;
      const rect = setupRef.current.getBoundingClientRect();
      pendingX = ((event.clientX - rect.left) / rect.width) * 800;
      hasPending = true;
      if (!rafId) rafId = requestAnimationFrame(flush);
    };

    const onUp = () => {
      if (rafId) { cancelAnimationFrame(rafId); flush(); }
      dragRef.current = null;
      setDragTarget(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragTarget, onUpdateSettings]);

  const beginDrag = useCallback(
    (kind: DragTarget) => (event: React.PointerEvent) => {
      event.stopPropagation();
      dragRef.current = { kind, prev: settings };
      setDragTarget(kind);
    },
    [settings],
  );

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: showIntensity ? '320px 1fr 1fr' : '320px 1fr', gap: 0, overflow: 'hidden' }}>
        {/* Card 1 — SVG Setup Diagram */}
        <div
          style={{
            background: 'var(--theme-bg-muted, #f5f5f7)',
            borderBottom: '1px solid var(--theme-border, #e0e0e0)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            className="card-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--theme-text-muted)',
            }}
          >
            <span>实验布局 · Draggable Setup</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--theme-primary, #00C06B)',
                }}
              />
              拖动双缝或屏幕位置
            </span>
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <svg
              ref={setupRef}
              viewBox="0 0 800 150"
              preserveAspectRatio="xMidYMid meet"
              style={{ width: '100%', height: '100%', display: 'block' }}
            >
              {/* Incident beam */}
              <line
                x1={sourceX}
                y1={75}
                x2={slitX}
                y2={75}
                stroke="oklch(0.60 0.18 210)"
                strokeWidth="2.4"
              />

              {/* Double slit (draggable) */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={beginDrag('slit')}
              >
                <rect
                  x={slitX - 28}
                  y={16}
                  width={56}
                  height={118}
                  rx={16}
                  fill="rgba(0,0,0,0.001)"
                  pointerEvents="all"
                />
                {/* Slit body */}
                <rect x={slitX - 4} y={44} width={8} height={62} rx={2} fill="var(--theme-text, #222)" />
                {/* Rays: source → slit openings */}
                <line x1={sourceX} y1={75} x2={slitX} y2={slitTopY} stroke={color} strokeWidth="1.5" opacity="0.42" />
                <line x1={sourceX} y1={75} x2={slitX} y2={slitBottomY} stroke={color} strokeWidth="1.5" opacity="0.42" />
                {/* Rays: slit → screen (dashed) */}
                <line x1={slitX} y1={slitTopY} x2={screenX} y2={75} stroke={color} strokeWidth="1.1" opacity="0.32" strokeDasharray="5 5" />
                <line x1={slitX} y1={slitBottomY} x2={screenX} y2={75} stroke={color} strokeWidth="1.1" opacity="0.32" strokeDasharray="5 5" />
                {/* Slit openings (bright gaps) */}
                <line x1={slitX} y1={slitTopY - slitOpeningH / 2} x2={slitX} y2={slitTopY + slitOpeningH / 2} stroke="var(--theme-bg-muted, #f5f5f7)" strokeWidth="3.4" />
                <line x1={slitX} y1={slitBottomY - slitOpeningH / 2} x2={slitX} y2={slitBottomY + slitOpeningH / 2} stroke="var(--theme-bg-muted, #f5f5f7)" strokeWidth="3.4" />
                {/* d dimension line */}
                <line x1={slitX + 10} y1={slitTopY} x2={slitX + 10} y2={slitBottomY} stroke="var(--theme-text-muted, #888)" strokeWidth="0.8" strokeDasharray="3 3" opacity="0.55" />
                <text x={slitX + 16} y={setupCenterY + 4} style={{ fontSize: 11, fill: 'var(--theme-text-muted, #888)' }}>{`d=${slitSpacing}μm`}</text>
              </g>

              {/* Screen (draggable) */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={beginDrag('screen')}
              >
                <line x1={screenX} y1={12} x2={screenX} y2={138} stroke="transparent" strokeWidth="36" />
                <line x1={screenX} y1={20} x2={screenX} y2={130} stroke="var(--theme-text-muted, #888)" strokeWidth="1.5" />
                <text x={screenX + 8} y={18} style={{ fontSize: 11, fill: 'var(--theme-text-muted, #888)', pointerEvents: 'none' }}>屏幕</text>
              </g>

              {/* Screen fringe overlay */}
              <g>
                {screenFringeRects.map((r, i) => (
                  <rect
                    key={i}
                    x={screenX - 2}
                    y={r.y}
                    width={22}
                    height={r.h}
                    fill={`rgb(${Math.round(r.fillR)},${Math.round(r.fillG)},${Math.round(r.fillB)})`}
                    opacity={0.92}
                    rx={1}
                  />
                ))}
              </g>

              {/* Point source (draggable) */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={beginDrag('source')}
              >
                <circle cx={sourceX} cy={75} r="24" fill="rgba(0,0,0,0.001)" pointerEvents="all" />
                <circle cx={sourceX} cy={75} r="7" fill="oklch(0.70 0.18 45)" />
                <circle cx={sourceX} cy={75} r="12" fill="none" stroke="oklch(0.70 0.18 45 / 0.28)" />
                <text x={sourceX - 6} y={75 - 17} style={{ fontSize: 11, fill: 'var(--theme-text-muted, #888)', pointerEvents: 'none' }}>光源</text>
              </g>

              {/* Double-slit label */}
              <text x={slitX + 8} y={50} style={{ fontSize: 11, fill: 'var(--theme-text-muted, #888)', pointerEvents: 'none' }}>双缝</text>

              {/* Distance label */}
              <line x1={slitX} y1={75} x2={screenX} y2={75} stroke="var(--theme-text-muted, #888)" strokeDasharray="4 4" />
              <text
                x={(slitX + screenX) / 2}
                y={68}
                textAnchor="middle"
                style={{ fontSize: 11, fill: 'var(--theme-text-muted, #888)', pointerEvents: 'none' }}
              >
                {`L = ${screenDistance.toFixed(2)} m`}
              </text>
            </svg>
          </div>
        </div>

        {/* Card 2 — Canvas Fringe Pattern */}
        <div
          style={{
            background: '#000',
            borderBottom: showIntensity ? '1px solid var(--theme-border, #e0e0e0)' : undefined,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            className="card-head"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 12px',
              fontSize: 12,
              color: 'var(--theme-text-muted)',
              background: 'rgba(0,0,0,0.6)',
            }}
          >
            <span>屏上条纹 · Screen Pattern</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: whiteLight
                    ? 'linear-gradient(90deg, #4050ff, #4dff77, #ff6a3d)'
                    : color,
                }}
              />
              {whiteLight ? '白光干涉' : `λ = ${wavelength} nm`}
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
          </div>
        </div>

        {/* Card 3 — Canvas Intensity Plot (conditional) */}
        {showIntensity && (
          <div
            style={{
              background: 'var(--theme-bg-muted, #f5f5f7)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            <div
              className="card-head"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                fontSize: 12,
                color: 'var(--theme-text-muted)',
              }}
            >
              <span>强度分布 · Intensity I(y)</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--theme-primary, #00C06B)',
                  }}
                />
                Δy = {(dy * 1000).toFixed(3)} mm
              </span>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <canvas ref={plotRef} style={{ display: 'block', width: '100%', height: '100%' }} />
            </div>
          </div>
        )}
    </div>
  );
}
