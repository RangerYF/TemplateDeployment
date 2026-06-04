/**
 * DiffractionCanvas.tsx
 * Hybrid SVG + Canvas renderer for the diffraction module.
 *
 * Layout: vertical stack of cards —
 *   1. SVG setup diagram (light source -> aperture -> screen)
 *   2. Canvas diffraction pattern (1D for slit, 2D radial for circle/disk)
 *   3. Canvas intensity plot (optional)
 */

import { useRef, useEffect, useState, useCallback } from 'react';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import {
  clamp,
  computeSourceIntensityScale,
  drawDiffractionPattern,
  drawDiffractionPlot,
  COMPARE_WAVELENGTHS,
} from '@/engine/diffractionSolver';
import type { DiffractionSettings } from '@/data/diffractionData';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DragTarget = 'source' | 'aperture' | 'screen' | null;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function DiffractionCanvas({
  settings,
  onUpdateSettings,
}: {
  settings: DiffractionSettings;
  onUpdateSettings: (
    updater: (prev: DiffractionSettings) => DiffractionSettings,
  ) => void;
}) {
  const {
    aperture,
    slitWidth,
    diameter,
    wavelength,
    screenDistance,
    showColor,
    showIntensity,
    compareMode,
  } = settings;

  const color = wavelengthToColor(wavelength);

  // Layout positions (clamped)
  const sourceX = clamp(settings.sourceX, 50, 180);
  const apertureX = clamp(settings.apertureX, 220, 430);
  const screenX = clamp(settings.screenX, apertureX + 70, 760);
  const sourceIntensityScale = computeSourceIntensityScale(sourceX, apertureX);

  // Refs
  const setupRef = useRef<SVGSVGElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const plotRef = useRef<HTMLCanvasElement | null>(null);

  // Drag state
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);
  const dragRef = useRef<{ kind: DragTarget; prev: DiffractionSettings } | null>(
    null,
  );

  // ── Canvas draw effect ──────────────────────────────────────────────

  useEffect(() => {
    const redraw = () => {
      if (canvasRef.current)
        drawDiffractionPattern(canvasRef.current, settings, sourceIntensityScale);
      if (plotRef.current)
        drawDiffractionPlot(plotRef.current, settings, sourceIntensityScale);
    };
    const frame = requestAnimationFrame(redraw);
    const observer =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
    const patternParent = canvasRef.current?.parentElement;
    const plotParent = plotRef.current?.parentElement;
    if (patternParent) observer?.observe(patternParent);
    if (plotParent) observer?.observe(plotParent);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [
    aperture,
    slitWidth,
    diameter,
    wavelength,
    screenDistance,
    showColor,
    showIntensity,
    compareMode,
    settings.sourceX,
    settings.apertureX,
    settings.screenX,
  ]);

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
        onUpdateSettings((prev) => ({ ...prev, sourceX: clamp(x, 50, prev.apertureX - 90) }));
        return;
      }
      if (info.kind === 'aperture') {
        onUpdateSettings((prev) => {
          const nextApertureX = clamp(x, prev.sourceX + 90, prev.screenX - 80);
          const nextDistance = clamp((prev.screenX - nextApertureX) / 110, 0.5, 3.0);
          return { ...prev, apertureX: nextApertureX, screenDistance: Number(nextDistance.toFixed(2)) };
        });
        return;
      }
      onUpdateSettings((prev) => {
        const nextScreenX = clamp(x, prev.apertureX + 70, 760);
        const nextDistance = clamp((nextScreenX - prev.apertureX) / 110, 0.5, 3.0);
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

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
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

  // ── Aperture SVG element ────────────────────────────────────────────

  const apertureLabel =
    aperture === 'slit' ? '单缝' : aperture === 'disk' ? '圆板' : '圆孔';

  const renderApertureElement = () => {
    if (aperture === 'slit') {
      return (
        <>
          <rect
            x={apertureX - 4}
            y={42}
            width={8}
            height={66}
            rx={2}
            fill="var(--theme-text, #222)"
          />
          {/* Slit openings */}
          <line
            x1={apertureX}
            y1={58}
            x2={apertureX}
            y2={68}
            stroke="var(--theme-bg-muted, #f5f5f7)"
            strokeWidth="2.4"
          />
          <line
            x1={apertureX}
            y1={82}
            x2={apertureX}
            y2={92}
            stroke="var(--theme-bg-muted, #f5f5f7)"
            strokeWidth="2.4"
          />
        </>
      );
    }
    if (aperture === 'disk') {
      return (
        <>
          <rect
            x={apertureX - 4}
            y={42}
            width={8}
            height={66}
            rx={2}
            fill="rgba(30,35,37,0.28)"
          />
          <circle
            cx={apertureX}
            cy={75}
            r={12}
            fill="var(--theme-text, #222)"
            stroke="var(--theme-text, #222)"
            strokeWidth="2.4"
          />
        </>
      );
    }
    // circle
    return (
      <>
        <rect
          x={apertureX - 4}
          y={42}
          width={8}
          height={66}
          rx={2}
          fill="var(--theme-text, #222)"
        />
        <circle
          cx={apertureX}
          cy={75}
          r={11}
          fill="var(--theme-bg-muted, #f5f5f7)"
          stroke="var(--theme-text, #222)"
          strokeWidth="2.4"
        />
      </>
    );
  };

  // ── Pattern card header ─────────────────────────────────────────────

  const patternTitle =
    aperture === 'slit'
      ? '单缝衍射图样 · 中央主极大'
      : aperture === 'disk'
        ? '圆板衍射图样 · 泊松亮斑'
        : '圆孔衍射图样 · 艾里斑';

  // ── Render ──────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'grid', gridTemplateRows: showIntensity ? '320px 1fr 1fr' : '320px 1fr', gap: 0, overflow: 'hidden' }}
      >
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
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: 'var(--theme-primary, #00C06B)',
                }}
              />
              拖动光源、{apertureLabel}和屏幕
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
                x2={apertureX}
                y2={75}
                stroke="oklch(0.60 0.18 210)"
                strokeWidth="2.4"
              />

              {/* Aperture element (draggable) */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={beginDrag('aperture')}
              >
                <rect
                  x={apertureX - 28}
                  y={16}
                  width={56}
                  height={118}
                  rx={16}
                  fill="rgba(0,0,0,0.001)"
                  pointerEvents="all"
                />
                {renderApertureElement()}
              </g>

              {/* Screen (draggable) */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={beginDrag('screen')}
              >
                <line
                  x1={screenX}
                  y1={12}
                  x2={screenX}
                  y2={138}
                  stroke="transparent"
                  strokeWidth="36"
                />
                <line
                  x1={screenX}
                  y1={20}
                  x2={screenX}
                  y2={130}
                  stroke="var(--theme-text-muted, #888)"
                  strokeWidth="1.5"
                />
                <text
                  x={screenX + 8}
                  y={18}
                  style={{
                    fontSize: 11,
                    fill: 'var(--theme-text-muted, #888)',
                    pointerEvents: 'none',
                  }}
                >
                  屏幕
                </text>
              </g>

              {/* Point source (draggable) */}
              <g
                style={{ cursor: 'grab', touchAction: 'none' }}
                onPointerDown={beginDrag('source')}
              >
                <circle
                  cx={sourceX}
                  cy={75}
                  r={24}
                  fill="rgba(0,0,0,0.001)"
                  pointerEvents="all"
                />
                <circle
                  cx={sourceX}
                  cy={75}
                  r={7}
                  fill="oklch(0.70 0.18 45)"
                />
                <circle
                  cx={sourceX}
                  cy={75}
                  r={12}
                  fill="none"
                  stroke="oklch(0.70 0.18 45 / 0.28)"
                />
                <text
                  x={sourceX - 6}
                  y={75 - 17}
                  style={{
                    fontSize: 11,
                    fill: 'var(--theme-text-muted, #888)',
                    pointerEvents: 'none',
                  }}
                >
                  光源
                </text>
              </g>

              {/* Aperture label */}
              <text
                x={apertureX + 8}
                y={50}
                style={{
                  fontSize: 11,
                  fill: 'var(--theme-text-muted, #888)',
                  pointerEvents: 'none',
                }}
              >
                {apertureLabel}
              </text>

              {/* Distance label */}
              <line
                x1={apertureX}
                y1={75}
                x2={screenX}
                y2={75}
                stroke="var(--theme-text-muted, #888)"
                strokeDasharray="4 4"
              />
              <text
                x={(apertureX + screenX) / 2}
                y={68}
                textAnchor="middle"
                style={{
                  fontSize: 11,
                  fill: 'var(--theme-text-muted, #888)',
                  pointerEvents: 'none',
                }}
              >
                {`L = ${screenDistance.toFixed(2)} m`}
              </text>
            </svg>
          </div>
        </div>

        {/* Card 2 — Canvas Diffraction Pattern */}
        <div
          style={{
            background: '#000',
            borderBottom: showIntensity
              ? '1px solid var(--theme-border, #e0e0e0)'
              : undefined,
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
            <span>{patternTitle}</span>
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11,
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: compareMode
                    ? 'linear-gradient(90deg, #4080ff, #40ff80, #ff4040)'
                    : color,
                }}
              />
              {compareMode
                ? 'RGB 对比'
                : `λ = ${wavelength} nm`}
            </span>
          </div>
          <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
            <canvas
              ref={canvasRef}
              style={{ display: 'block', width: '100%', height: '100%' }}
            />
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
              <span>
                {aperture === 'slit'
                  ? '强度分布 I(y)'
                  : '径向强度分布 I(r)'}
              </span>
              <span
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11,
                }}
              >
                <span
                  style={{
                    display: 'inline-block',
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: 'var(--theme-primary, #00C06B)',
                  }}
                />
                {aperture === 'slit'
                  ? '中央主极大已标识'
                  : '第一暗环已标识'}
              </span>
            </div>
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <canvas
                ref={plotRef}
                style={{ display: 'block', width: '100%', height: '100%' }}
              />
            </div>
          </div>
        )}
    </div>
  );
}
