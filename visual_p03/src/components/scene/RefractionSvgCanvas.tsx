import { useMemo, useCallback, useRef, useState, useEffect } from 'react';
import { useSimulationStore } from '@/store/simulationStore';
import { useUIStore } from '@/store/uiStore';
import { solveRefraction } from '@/engine/refractionSolver';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';
import type { DragTarget, RefractionSettings } from '@/data/refractionData';
import { GridBackground } from './svg/GridBackground';
import { MediumShape } from './svg/MediumShape';
import { LaserSource } from './svg/LaserSource';
import { RaySegment } from './svg/RaySegment';
import { AngleMark } from './svg/AngleMark';
const STAGE_W = 1000;
const STAGE_H = 620;
const DEFAULT_RAY_COLOR = 'oklch(0.72 0.19 142)';
const SOURCE_MIN_X = 40;
const SOURCE_MAX_X = 960;
const SOURCE_MIN_Y = 20;
const SOURCE_MAX_Y = 600;

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

export function RefractionSvgCanvas() {
  const settings = useSimulationStore((s) => s.settings);
  const updateSettings = useSimulationStore((s) => s.updateSettings);
  const viewport = useUIStore((s) => s.viewport);
  const setViewport = useUIStore((s) => s.setViewport);

  const result = useMemo(() => solveRefraction(settings), [settings]);

  const rayColor = settings.showColor
    ? wavelengthToColor(settings.wavelength)
    : DEFAULT_RAY_COLOR;

  const sourceX = settings.sourceAnchorX;
  const sourceY = settings.sourceY ?? 90;
  const sourceAngle = settings.sourceAngleDeg ?? 56;

  // -- Drag system: source, source2, element, pan ----------------------------

  const dragRef = useRef<{
    kind: DragTarget;
    startX: number;
    startY: number;
    prev: RefractionSettings;
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTarget>(null);

  useEffect(() => {
    if (!dragTarget || !dragRef.current) return;

    const onMove = (e: PointerEvent) => {
      const info = dragRef.current;
      if (!info) return;
      const dx = e.clientX - info.startX;
      const dy = e.clientY - info.startY;
      const zoom = viewport.zoom || 1;
      const localDx = dx / zoom;
      const localDy = dy / zoom;

      if (info.kind === 'pan') {
        setViewport({
          offsetX: clamp((info.prev.canvasPanX ?? 0) + dx, -2000, 2000),
          offsetY: clamp((info.prev.canvasPanY ?? 0) + dy, -2000, 2000),
          zoom: viewport.zoom,
        });
        return;
      }
      if (info.kind === 'source') {
        updateSettings({
          sourceAnchorX: clamp((info.prev.sourceAnchorX ?? 180) + localDx, SOURCE_MIN_X, SOURCE_MAX_X),
          sourceY: clamp((info.prev.sourceY ?? 90) + localDy, SOURCE_MIN_Y, SOURCE_MAX_Y),
        });
        return;
      }
      if (info.kind === 'source2') {
        updateSettings({
          source2AnchorX: clamp((info.prev.source2AnchorX ?? info.prev.sourceAnchorX ?? 180) + localDx, SOURCE_MIN_X, SOURCE_MAX_X),
          source2Y: clamp((info.prev.source2Y ?? 150) + localDy, SOURCE_MIN_Y, SOURCE_MAX_Y),
        });
        return;
      }
      if (info.kind === 'element') {
        updateSettings({
          elementCenterX: clamp((info.prev.elementCenterX ?? 520) + localDx, 120, 880),
          elementCenterY: clamp((info.prev.elementCenterY ?? 260) + localDy, 120, 500),
        });
      }
    };

    const onUp = () => {
      dragRef.current = null;
      setDragTarget(null);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragTarget, viewport.zoom, setViewport, updateSettings]);

  const beginDrag = useCallback(
    (kind: DragTarget) => (e: React.PointerEvent) => {
      e.stopPropagation();
      dragRef.current = { kind, startX: e.clientX, startY: e.clientY, prev: { ...settings } };
      setDragTarget(kind);
    },
    [settings],
  );

  const handleStageDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const target = e.target as SVGElement;
      if (target.closest('[data-draggable]')) return;
      dragRef.current = {
        kind: 'pan',
        startX: e.clientX,
        startY: e.clientY,
        prev: { ...settings, canvasPanX: viewport.offsetX, canvasPanY: viewport.offsetY },
      };
      setDragTarget('pan');
    },
    [settings, viewport.offsetX, viewport.offsetY],
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<SVGSVGElement>) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.08 : 0.08;
      setViewport((prev) => ({
        ...prev,
        zoom: clamp(prev.zoom + delta, 0.3, 5.0),
      }));
    },
    [setViewport],
  );

  return (
    <div className="relative h-full w-full" style={{ background: 'var(--theme-bg)' }}>
    <svg
      viewBox={`0 0 ${STAGE_W} ${STAGE_H}`}
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
        <filter id="ref-soft-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      <GridBackground />

      <g transform={`translate(${viewport.offsetX} ${viewport.offsetY}) scale(${viewport.zoom})`}>
        {/* Medium shape (draggable) */}
        <g data-draggable="element" onPointerDown={beginDrag('element')} style={{ cursor: 'move' }}>
          <MediumShape />
        </g>

        {/* Laser source (draggable) */}
        {settings.shape !== 'apparent' && (
          <g data-draggable="source" onPointerDown={beginDrag('source')} style={{ cursor: 'move' }}>
            <LaserSource x={sourceX} y={sourceY} angleDeg={sourceAngle} color={rayColor} />
          </g>
        )}

        {/* Normal lines */}
        {settings.showNormals &&
          result.normals.map((line, idx) => (
            <line
              key={`n-${idx}`}
              x1={line[0].x}
              y1={line[0].y}
              x2={line[1].x}
              y2={line[1].y}
              stroke="var(--theme-text-muted)"
              strokeWidth={0.8}
              strokeDasharray="6 4"
            />
          ))}

        {/* Ray segments */}
        <g opacity={settings.shape === 'apparent' ? (settings.apparentRayOpacity ?? 1) : 1}>
          {result.segments.map((segment, index) => (
            <RaySegment key={`ray-${index}`} segment={segment} color={rayColor} thick={settings.rayThick} />
          ))}
        </g>

        {/* Angle marks */}
        {settings.showAngles &&
          result.angleMarks.map((mark, index) => (
            <AngleMark key={`am-${index}`} mark={mark} />
          ))}
      </g>
    </svg>
    </div>
  );
}
