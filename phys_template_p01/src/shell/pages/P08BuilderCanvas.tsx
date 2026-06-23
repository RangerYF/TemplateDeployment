import { useCallback, useMemo, useRef } from 'react';
import { simulator } from '@/core/engine/simulator';
import { entityRegistry } from '@/core/registries/entity-registry';
import { screenToWorld } from '@/renderer/coordinate';
import { CanvasContainer } from '@/shell/canvas/CanvasContainer';
import { FieldInfoCards } from '@/shell/panels/FieldInfoCards';
import { P08DisplayControls } from '@/shell/panels/P08DisplayControls';
import { P08ResultOverlay } from '@/shell/panels/P08ResultOverlay';
import { P08StageHeader } from '@/shell/panels/P08StageHeader';
import { useSimulationStore } from '@/store';
import { RADIUS, SHADOWS, COLORS } from '@/styles/tokens';
import {
  isP08BuilderInternalEntity,
} from '@/domains/em/builder/p08-field-builder-scene';
import { getP08SceneSummary } from '@/shell/panels/p08SceneSummary';
import {
  getP08CanvasBackground,
  getP08CanvasShellStyle,
} from '@/shell/p08/p08Theme';
import { syncStoreFromSimulator } from '@/shell/utils/syncStore';

export interface P08BuilderCanvasProps {
  sceneId: string;
  onContextReady: (ctx: CanvasRenderingContext2D) => void;
  transformRef: React.MutableRefObject<{ scale: number; originX: number; originY: number }>;
}

export function P08BuilderCanvas({
  sceneId,
  onContextReady,
  transformRef,
}: P08BuilderCanvasProps) {
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const viewport = useSimulationStore((s) => s.viewportState.primary);
  const result = useSimulationStore((s) => s.simulationState.currentResult);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const potentialProbeA = useSimulationStore((s) => s.potentialProbeA);
  const potentialProbeB = useSimulationStore((s) => s.potentialProbeB);
  const placePotentialProbe = useSimulationStore((s) => s.placePotentialProbe);
  const selectEntity = useSimulationStore((s) => s.selectEntity);

  const summary = getP08SceneSummary({
    presetId: sceneId,
    entities,
    result,
    paramValues,
    potentialProbeA,
    potentialProbeB,
  });
  const interactiveEntities = useMemo(
    () => Array.from(entities.values()).filter((entity) => !isP08BuilderInternalEntity(entity)),
    [entities],
  );

  const dragRef = useRef<{
    mode: 'none' | 'pan' | 'entity';
    lastX: number;
    lastY: number;
    entityId: string | null;
    offsetX: number;
    offsetY: number;
    suppressClick: boolean;
  }>({
    mode: 'none',
    lastX: 0,
    lastY: 0,
    entityId: null,
    offsetX: 0,
    offsetY: 0,
    suppressClick: false,
  });

  const handleWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    const factor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(30, Math.min(2500, transformRef.current.scale * factor));
    const rect = event.currentTarget.getBoundingClientRect();
    const mx = event.clientX - rect.left;
    const my = event.clientY - rect.top;
    const ratio = newScale / transformRef.current.scale;
    transformRef.current.originX = mx - (mx - transformRef.current.originX) * ratio;
    transformRef.current.originY = my - (my - transformRef.current.originY) * ratio;
    transformRef.current.scale = newScale;
  }, [transformRef]);

  const getWorldPoint = useCallback((container: HTMLElement, clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    const pixel = { x: clientX - rect.left, y: clientY - rect.top };
    return screenToWorld(pixel, {
      scale: transformRef.current.scale,
      origin: {
        x: transformRef.current.originX,
        y: transformRef.current.originY,
      },
    });
  }, [transformRef]);

  const handleMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (event.button === 1 || event.button === 2) {
      event.preventDefault();
      dragRef.current = {
        ...dragRef.current,
        mode: 'pan',
        lastX: event.clientX,
        lastY: event.clientY,
        entityId: null,
        suppressClick: false,
      };
      return;
    }

    if (event.button !== 0) return;
    const target = event.target as HTMLElement;
    if (target.tagName !== 'CANVAS') return;

    const worldPoint = getWorldPoint(event.currentTarget, event.clientX, event.clientY);
    const coordinateTransform = {
      scale: transformRef.current.scale,
      origin: {
        x: transformRef.current.originX,
        y: transformRef.current.originY,
      },
    };

    for (const entity of interactiveEntities) {
      const registration = entityRegistry.get(entity.type);
      if (!registration?.hitTest(entity, worldPoint, coordinateTransform)) continue;

      selectEntity(entity.id);
      dragRef.current = {
        mode: 'entity',
        lastX: event.clientX,
        lastY: event.clientY,
        entityId: entity.id,
        offsetX: worldPoint.x - entity.transform.position.x,
        offsetY: worldPoint.y - entity.transform.position.y,
        suppressClick: false,
      };
      return;
    }
  }, [getWorldPoint, interactiveEntities, selectEntity, transformRef]);

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.mode === 'none') return;

    const dx = event.clientX - dragRef.current.lastX;
    const dy = event.clientY - dragRef.current.lastY;
    if (Math.hypot(dx, dy) > 2) {
      dragRef.current.suppressClick = true;
    }

    if (dragRef.current.mode === 'pan') {
      transformRef.current.originX += dx;
      transformRef.current.originY += dy;
      dragRef.current.lastX = event.clientX;
      dragRef.current.lastY = event.clientY;
      return;
    }

    if (dragRef.current.mode === 'entity' && dragRef.current.entityId) {
      const worldPoint = getWorldPoint(event.currentTarget, event.clientX, event.clientY);
      simulator.updateEntityPosition(dragRef.current.entityId, {
        x: worldPoint.x - dragRef.current.offsetX,
        y: worldPoint.y - dragRef.current.offsetY,
      });
      syncStoreFromSimulator();
      dragRef.current.lastX = event.clientX;
      dragRef.current.lastY = event.clientY;
    }
  }, [getWorldPoint, transformRef]);

  const handleMouseUp = useCallback(() => {
    dragRef.current.mode = 'none';
    dragRef.current.entityId = null;
  }, []);

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.suppressClick) {
      dragRef.current.suppressClick = false;
      return;
    }

    const target = event.target as HTMLElement;
    if (target.tagName !== 'CANVAS') return;

    const worldPoint = getWorldPoint(event.currentTarget, event.clientX, event.clientY);
    const coordinateTransform = {
      scale: transformRef.current.scale,
      origin: {
        x: transformRef.current.originX,
        y: transformRef.current.originY,
      },
    };

    for (const entity of interactiveEntities) {
      const registration = entityRegistry.get(entity.type);
      if (!registration?.hitTest(entity, worldPoint, coordinateTransform)) continue;
      selectEntity(entity.id);
      return;
    }

    if (summary.supportsPotentialDifference) {
      placePotentialProbe(worldPoint);
      selectEntity(null);
      return;
    }
    selectEntity(null);
  }, [getWorldPoint, interactiveEntities, placePotentialProbe, selectEntity, summary.supportsPotentialDifference, transformRef]);

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        ...getP08CanvasShellStyle(sceneId),
      }}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      <CanvasContainer
        onContextReady={onContextReady}
        backgroundStyle={getP08CanvasBackground(sceneId, viewport)}
      />
      <P08StageHeader presetId={sceneId} viewport={viewport} />
      <P08DisplayControls presetId={sceneId} />
      <FieldInfoCards entities={entities} presetId={sceneId} />
      <P08ResultOverlay presetId={sceneId} />
      {viewport === 'motion' && interactiveEntities.length === 0 && (
        <CanvasHint text="先添加带电粒子与场源，再切到运动视角查看轨迹与速度。" />
      )}
    </div>
  );
}

function CanvasHint({ text }: { text: string }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 16,
        zIndex: 45,
        maxWidth: 300,
        padding: '10px 12px',
        borderRadius: RADIUS.md,
        border: `1px solid ${COLORS.border}`,
        backgroundColor: 'rgba(255,255,255,0.92)',
        boxShadow: SHADOWS.sm,
        fontSize: 12,
        lineHeight: 1.6,
        color: COLORS.textSecondary,
      }}
    >
      {text}
    </div>
  );
}
