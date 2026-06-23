import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { entityRegistry } from '@/core/registries/entity-registry';
import { screenToWorld } from '@/renderer/coordinate';
import type { Entity, ParamSchema } from '@/core/types';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import { CanvasContainer } from './CanvasContainer';
import { PlaybackDock } from '../timeline/TimelineBar';
import { CircuitInfoCards } from '../panels/CircuitInfoCards';
import { WireBFieldCanvasOverlay } from '../panels/WireBFieldTeachingPanels';
import { LoopBFieldCanvasOverlay } from '../panels/LoopBFieldTeachingPanels';
import { PanelErrorBoundary } from '../components/PanelErrorBoundary';
import { P08_PRESET_IDS } from '../pages/p08PresetCatalog';
import { WIRE_BFIELD_PRESET_ID } from '@/domains/em/logic/straight-wire-teaching';
import {
  LOOP_BFIELD_PRESET_ID,
  getLoopViewMode,
} from '@/domains/em/logic/loop-current-teaching';
import {
  clampLoopPitchDeg,
  getLoopCameraState,
} from '@/domains/em/logic/loop-current-3d';
import {
  getPotentialSurfacePanelBounds,
  getPotentialSurfaceResetButtonBounds,
} from '@/domains/em/viewports/potential-surface-renderer';
import {
  getP08CanvasBackground,
  getP08CanvasShellStyle,
} from '../p08/p08Theme';
import { syncStoreFromSimulator } from '../utils/syncStore';

export function SimulatorCanvas({ presetId, onContextReady, transformRef }: {
  presetId: string;
  onContextReady: (ctx: CanvasRenderingContext2D) => void;
  transformRef: React.MutableRefObject<{ scale: number; originX: number; originY: number }>;
}) {
  const density = useSimulationStore((s) => s.viewportState.density);
  const setInfoDensity = useSimulationStore((s) => s.setInfoDensity);
  const viewport = useSimulationStore((s) => s.viewportState.primary);
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const placePotentialProbe = useSimulationStore((s) => s.placePotentialProbe);
  const setPotentialProbe = useSimulationStore((s) => s.setPotentialProbe);
  const potentialProbeA = useSimulationStore((s) => s.potentialProbeA);
  const potentialProbeB = useSimulationStore((s) => s.potentialProbeB);
  const activePotentialProbe = useSimulationStore((s) => s.activePotentialProbe);
  const setActivePotentialProbe = useSimulationStore((s) => s.setActivePotentialProbe);
  const setElectrostaticSurface3D = useSimulationStore((s) => s.setElectrostaticSurface3D);
  const resetElectrostaticSurface3D = useSimulationStore((s) => s.resetElectrostaticSurface3D);
  const [popup, setPopup] = useState<{ entity: Entity; x: number; y: number } | null>(null);
  const [isLoopOrbiting, setIsLoopOrbiting] = useState(false);
  const dragRef = useRef<{
    mode: 'none' | 'pan' | 'entity' | 'loop-orbit' | 'surface-3d' | 'probe';
    lastX: number;
    lastY: number;
    entityId: string | null;
    offsetX: number;
    offsetY: number;
    suppressClick: boolean;
    orbitYaw: number;
    orbitPitch: number;
    surfaceYaw: number;
    surfacePitch: number;
    probeLabel: 'A' | 'B' | null;
  }>({
    mode: 'none',
    lastX: 0,
    lastY: 0,
    entityId: null,
    offsetX: 0,
    offsetY: 0,
    suppressClick: false,
    orbitYaw: 0,
    orbitPitch: 0,
    surfaceYaw: 0,
    surfacePitch: 0,
    probeLabel: null,
  });

  const isCircuit = viewport === 'circuit';
  const isField = viewport === 'field';
  const isRealistic = density === 'detailed';
  const isP08Scene = P08_PRESET_IDS.has(presetId);
  const isStraightWireTeachingScene = presetId === WIRE_BFIELD_PRESET_ID;
  const isLoopTeachingScene = presetId === LOOP_BFIELD_PRESET_ID;
  const isTeachingScene = isStraightWireTeachingScene || isLoopTeachingScene;
  const canRotateLoopView = isLoopTeachingScene && getLoopViewMode(paramValues) === 'isometric';
  const canDragPointCharges =
    isField &&
    Array.from(entities.values()).some((entity) => entity.type === 'point-charge') &&
    !Array.from(entities.values()).some(
      (entity) => entity.type === 'uniform-efield' || entity.type === 'uniform-bfield',
    );
  const canDragParticleEmitters =
    !isTeachingScene &&
    Array.from(entities.values()).some((entity) => entity.type === 'particle-emitter');
  const supportsPotentialMeasurement = isP08Scene && canDragPointCharges;

  const getProbeHitLabel = useCallback((container: HTMLElement, clientX: number, clientY: number): 'A' | 'B' | null => {
    if (!supportsPotentialMeasurement) return null;
    const rect = container.getBoundingClientRect();
    const screenX = clientX - rect.left;
    const screenY = clientY - rect.top;
    const transform = {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    };

    const candidates = [
      potentialProbeA ? { label: 'A' as const, point: potentialProbeA } : null,
      potentialProbeB ? { label: 'B' as const, point: potentialProbeB } : null,
    ].filter(Boolean) as Array<{ label: 'A' | 'B'; point: { x: number; y: number } }>;

    for (const candidate of candidates) {
      const px = transform.origin.x + (candidate.point.x * transform.scale);
      const py = transform.origin.y - (candidate.point.y * transform.scale);
      if (Math.hypot(px - screenX, py - screenY) <= 14) {
        return candidate.label;
      }
    }
    return null;
  }, [potentialProbeA, potentialProbeB, supportsPotentialMeasurement, transformRef]);

  useEffect(() => {
    if (!isTeachingScene) return;
    setPopup(null);
    useSimulationStore.getState().selectEntity(null);
  }, [isTeachingScene]);

  useEffect(() => {
    if (canRotateLoopView) return;
    dragRef.current.mode = 'none';
    setIsLoopOrbiting(false);
  }, [canRotateLoopView]);

  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (supportsPotentialMeasurement && target.tagName === 'CANVAS') {
      const panelBounds = getPotentialSurfacePanelBounds(target as HTMLCanvasElement, {
        avoidBottomLeftLegend: useSimulationStore.getState().showPotentialMap,
      });
      if (panelBounds) {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const insidePanel =
          x >= panelBounds.x &&
          x <= panelBounds.x + panelBounds.width &&
          y >= panelBounds.y &&
          y <= panelBounds.y + panelBounds.height;
        if (insidePanel) {
          e.preventDefault();
          const current = useSimulationStore.getState().electrostaticSurface3D;
          setElectrostaticSurface3D({
            zoom: Math.max(0.7, Math.min(1.8, current.zoom * (e.deltaY > 0 ? 0.92 : 1.08))),
          });
          return;
        }
      }
    }

    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(30, Math.min(2500, transformRef.current.scale * factor));

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const ratio = newScale / transformRef.current.scale;
    transformRef.current.originX = mx - (mx - transformRef.current.originX) * ratio;
    transformRef.current.originY = my - (my - transformRef.current.originY) * ratio;
    transformRef.current.scale = newScale;
  }, [setElectrostaticSurface3D, supportsPotentialMeasurement, transformRef]);

  const getWorldPoint = useCallback((container: HTMLElement, clientX: number, clientY: number) => {
    const rect = container.getBoundingClientRect();
    const pixel = { x: clientX - rect.left, y: clientY - rect.top };
    return screenToWorld(pixel, {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    });
  }, [transformRef]);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    const canvasTarget = target.tagName === 'CANVAS' ? target as HTMLCanvasElement : null;

    if (e.button === 0 && canvasTarget && supportsPotentialMeasurement) {
      const panelBounds = getPotentialSurfacePanelBounds(canvasTarget, {
        avoidBottomLeftLegend: useSimulationStore.getState().showPotentialMap,
      });
      if (panelBounds) {
        const rect = canvasTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const resetBounds = getPotentialSurfaceResetButtonBounds(panelBounds);
        const inReset =
          x >= resetBounds.x &&
          x <= resetBounds.x + resetBounds.width &&
          y >= resetBounds.y &&
          y <= resetBounds.y + resetBounds.height;
        if (inReset) {
          resetElectrostaticSurface3D();
          return;
        }

        const inSurfacePanel =
          x >= panelBounds.x &&
          x <= panelBounds.x + panelBounds.width &&
          y >= panelBounds.y &&
          y <= panelBounds.y + panelBounds.height;
        if (inSurfacePanel) {
          const surface = useSimulationStore.getState().electrostaticSurface3D;
          dragRef.current = {
            ...dragRef.current,
            mode: 'surface-3d',
            lastX: e.clientX,
            lastY: e.clientY,
            suppressClick: false,
            surfaceYaw: surface.yawDeg,
            surfacePitch: surface.pitchDeg,
            probeLabel: null,
          };
          return;
        }
      }
    }

    if (e.button === 0 && canRotateLoopView) {
      if (target.tagName !== 'CANVAS') return;
      const camera = getLoopCameraState(useSimulationStore.getState().paramValues);
      dragRef.current = {
        ...dragRef.current,
        mode: 'loop-orbit',
        lastX: e.clientX,
        lastY: e.clientY,
        entityId: null,
        suppressClick: false,
        orbitYaw: camera.yawDeg,
        orbitPitch: camera.pitchDeg,
      };
      setIsLoopOrbiting(true);
      return;
    }

    if (e.button === 1 || e.button === 2) {
      e.preventDefault();
      dragRef.current = {
        ...dragRef.current,
        mode: 'pan',
        lastX: e.clientX,
        lastY: e.clientY,
        entityId: null,
        suppressClick: false,
      };
      return;
    }

    if (e.button !== 0) return;
    if (target.tagName !== 'CANVAS') return;

    const probeHit = getProbeHitLabel(e.currentTarget, e.clientX, e.clientY);
    if (probeHit) {
      setActivePotentialProbe(probeHit);
      dragRef.current = {
        ...dragRef.current,
        mode: 'probe',
        lastX: e.clientX,
        lastY: e.clientY,
        suppressClick: false,
        probeLabel: probeHit,
      };
      return;
    }
    if (!canDragPointCharges && !canDragParticleEmitters) return;

    const worldPoint = getWorldPoint(e.currentTarget, e.clientX, e.clientY);
    const tf = {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    };

    for (const entity of entities.values()) {
      if (entity.type === 'point-charge' && !canDragPointCharges) continue;
      if (entity.type === 'particle-emitter' && !canDragParticleEmitters) continue;
      if (entity.type !== 'point-charge' && entity.type !== 'particle-emitter') continue;
      const registration = entityRegistry.get(entity.type);
      if (!registration?.hitTest(entity, worldPoint, tf)) continue;

      setPopup(null);
      useSimulationStore.getState().selectEntity(entity.id);
      dragRef.current = {
        mode: 'entity',
        lastX: e.clientX,
        lastY: e.clientY,
        entityId: entity.id,
        offsetX: worldPoint.x - entity.transform.position.x,
        offsetY: worldPoint.y - entity.transform.position.y,
        suppressClick: false,
        orbitYaw: dragRef.current.orbitYaw,
        orbitPitch: dragRef.current.orbitPitch,
        surfaceYaw: dragRef.current.surfaceYaw,
        surfacePitch: dragRef.current.surfacePitch,
        probeLabel: null,
      };
      return;
    }
  }, [canDragParticleEmitters, canDragPointCharges, canRotateLoopView, entities, getProbeHitLabel, getWorldPoint, resetElectrostaticSurface3D, setActivePotentialProbe, supportsPotentialMeasurement, transformRef]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.mode === 'none') return;

    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    if (Math.hypot(dx, dy) > 2) {
      dragRef.current.suppressClick = true;
    }

    if (dragRef.current.mode === 'pan') {
      transformRef.current.originX += dx;
      transformRef.current.originY += dy;
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'loop-orbit') {
      dragRef.current.orbitYaw += dx * 0.45;
      dragRef.current.orbitPitch = clampLoopPitchDeg(dragRef.current.orbitPitch - dy * 0.24);
      const store = useSimulationStore.getState();
      store.updateParam('loopCameraYawDeg', dragRef.current.orbitYaw);
      store.updateParam('loopCameraPitchDeg', dragRef.current.orbitPitch);
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'surface-3d') {
      dragRef.current.surfaceYaw += dx * 0.42;
      dragRef.current.surfacePitch = Math.max(-15, Math.min(70, dragRef.current.surfacePitch - (dy * 0.24)));
      setElectrostaticSurface3D({
        yawDeg: dragRef.current.surfaceYaw,
        pitchDeg: dragRef.current.surfacePitch,
      });
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'probe' && dragRef.current.probeLabel) {
      const worldPoint = getWorldPoint(e.currentTarget, e.clientX, e.clientY);
      setPotentialProbe(dragRef.current.probeLabel, worldPoint);
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
      return;
    }

    if (dragRef.current.mode === 'entity' && dragRef.current.entityId) {
      const worldPoint = getWorldPoint(e.currentTarget, e.clientX, e.clientY);
      simulator.updateEntityPosition(dragRef.current.entityId, {
        x: worldPoint.x - dragRef.current.offsetX,
        y: worldPoint.y - dragRef.current.offsetY,
      });
      syncStoreFromSimulator();
      dragRef.current.lastX = e.clientX;
      dragRef.current.lastY = e.clientY;
    }
  }, [getWorldPoint, setElectrostaticSurface3D, setPotentialProbe, transformRef]);

  const handleMouseUp = useCallback(() => {
    if (dragRef.current.mode === 'loop-orbit') {
      simulator.updateParam('loopCameraYawDeg', dragRef.current.orbitYaw);
      simulator.updateParam('loopCameraPitchDeg', dragRef.current.orbitPitch);
      syncStoreFromSimulator();
    }

    setIsLoopOrbiting(false);
    if (dragRef.current.mode === 'probe') {
      setActivePotentialProbe(null);
    }
    dragRef.current.mode = 'none';
    dragRef.current.entityId = null;
    dragRef.current.probeLabel = null;
  }, [setActivePotentialProbe]);

  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (dragRef.current.suppressClick) {
      dragRef.current.suppressClick = false;
      return;
    }

    setPopup(null);
    const target = e.target as HTMLElement;
    if (target.tagName !== 'CANVAS') return;

    if (supportsPotentialMeasurement) {
      const panelBounds = getPotentialSurfacePanelBounds(target as HTMLCanvasElement, {
        avoidBottomLeftLegend: useSimulationStore.getState().showPotentialMap,
      });
      if (panelBounds) {
        const rect = target.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const inSurfacePanel =
          x >= panelBounds.x &&
          x <= panelBounds.x + panelBounds.width &&
          y >= panelBounds.y &&
          y <= panelBounds.y + panelBounds.height;
        if (inSurfacePanel) return;
      }
    }

    const tf = {
      scale: transformRef.current.scale,
      origin: { x: transformRef.current.originX, y: transformRef.current.originY },
    };
    const wp = getWorldPoint(e.currentTarget, e.clientX, e.clientY);

    const sceneEntities = useSimulationStore.getState().simulationState.scene.entities;
    for (const ent of sceneEntities.values()) {
      const reg = entityRegistry.get(ent.type);
      if (reg?.hitTest(ent, wp, tf)) {
        if (isTeachingScene) return;
        setPopup({ entity: ent, x: e.clientX, y: e.clientY });
        useSimulationStore.getState().selectEntity(ent.id);
        return;
      }
    }
    if (supportsPotentialMeasurement) {
      placePotentialProbe(wp);
      useSimulationStore.getState().selectEntity(null);
      return;
    }
    useSimulationStore.getState().selectEntity(null);
  }, [getWorldPoint, isTeachingScene, placePotentialProbe, supportsPotentialMeasurement, transformRef]);

  return (
    <div
      style={{
        position: 'relative',
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        cursor:
          dragRef.current.mode === 'surface-3d' || dragRef.current.mode === 'probe'
            ? 'grabbing'
            : canRotateLoopView
              ? (isLoopOrbiting ? 'grabbing' : 'grab')
              : activePotentialProbe
                ? 'grab'
                : 'default',
        ...(isP08Scene ? getP08CanvasShellStyle(presetId) : {}),
      }}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => e.preventDefault()}
    >
      <CanvasContainer
        onContextReady={onContextReady}
        backgroundStyle={isLoopTeachingScene ? {
          background:
            'radial-gradient(circle at 50% 18%, rgba(255,255,255,0.98) 0%, rgba(244,247,242,0.96) 36%, rgba(231,237,230,0.92) 100%)',
        } : isP08Scene ? getP08CanvasBackground(presetId, viewport) : undefined}
      />
      {isCircuit && (
        <button
          onClick={(e) => { e.stopPropagation(); setInfoDensity(isRealistic ? 'standard' : 'detailed'); }}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 50,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid ${isRealistic ? '#3B82F6' : '#D1D5DB'}`,
            backgroundColor: isRealistic ? '#EFF6FF' : 'rgba(255,255,255,0.95)',
            color: isRealistic ? '#3B82F6' : '#374151',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {isRealistic ? '实物图模式' : '电路图模式'}
          <span style={{ color: '#9CA3AF', fontSize: 10 }}>点击切换</span>
        </button>
      )}
      {isCircuit && (
        <PanelErrorBoundary title="电路信息卡" compact>
          <CircuitInfoCards entities={entities} />
        </PanelErrorBoundary>
      )}
      {isStraightWireTeachingScene && <WireBFieldCanvasOverlay transformRef={transformRef} />}
      {isLoopTeachingScene && <LoopBFieldCanvasOverlay />}
      {!isP08Scene && <PlaybackDock />}
      {popup && (
        <SimulatorParamPopup
          entity={popup.entity}
          x={popup.x}
          y={popup.y}
          onClose={() => setPopup(null)}
        />
      )}
    </div>
  );
}

function SimulatorParamPopup({ entity, x, y, onClose }: {
  entity: Entity; x: number; y: number; onClose: () => void;
}) {
  const paramValues = useSimulationStore((s) => s.paramValues);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-sim-popup]')) onClose();
    };
    const timer = setTimeout(() => window.addEventListener('click', handler), 50);
    return () => { clearTimeout(timer); window.removeEventListener('click', handler); };
  }, [onClose]);

  const reg = entityRegistry.get(entity.type);
  if (!reg) return null;

  const paramGroups = useSimulationStore.getState().simulationState.scene.paramGroups;

  const entityParams: Array<{ schema: ParamSchema; value: unknown }> = [];
  for (const group of paramGroups) {
    for (const param of group.params) {
      if (param.targetEntityId === entity.id) {
        entityParams.push({ schema: param, value: paramValues[param.key] ?? getParamSchemaDefaultValue(param) });
      }
    }
  }

  if (entityParams.length === 0) return null;

  const panelW = 240;
  const left = Math.max(8, Math.min(window.innerWidth - panelW - 8, x - panelW / 2));
  const top = Math.max(8, Math.min(window.innerHeight - 300, y + 20));

  const handleChange = (key: string, value: number | boolean | string) => {
    simulator.updateParam(key, value);
    syncStoreFromSimulator();
  };

  return (
    <div
      data-sim-popup
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        left,
        top,
        width: panelW,
        zIndex: 1000,
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        boxShadow: SHADOWS.md,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{entity.label ?? reg.label}</span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.textMuted, fontSize: 14, padding: 0 }}
        >×</button>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entityParams.map(({ schema, value }) => {
          if (schema.type === 'slider') {
            const numVal = (value as number) ?? schema.default;
            return (
              <div key={schema.key}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{schema.label}</span>
                  <span style={{ fontSize: 11, color: COLORS.text, fontWeight: 500 }}>{numVal}{schema.unit}</span>
                </div>
                <input
                  type="range"
                  min={schema.min}
                  max={schema.max}
                  step={schema.step}
                  value={Math.min(numVal, schema.max)}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (!isNaN(v)) handleChange(schema.key, v);
                  }}
                  style={{ width: '100%', accentColor: COLORS.primary }}
                />
              </div>
            );
          }
          if (schema.type === 'toggle') {
            const boolVal = (value as boolean) ?? schema.default;
            return (
              <div key={schema.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 11, color: COLORS.textSecondary }}>{schema.label}</span>
                <button
                  onClick={() => handleChange(schema.key, !boolVal)}
                  style={{
                    padding: '2px 10px',
                    fontSize: 11,
                    borderRadius: 4,
                    border: `1px solid ${COLORS.border}`,
                    backgroundColor: boolVal ? COLORS.primaryLight : COLORS.bg,
                    color: boolVal ? COLORS.primary : COLORS.textSecondary,
                    cursor: 'pointer',
                  }}
                >{boolVal ? (schema.labelOn ?? '开') : (schema.labelOff ?? '关')}</button>
              </div>
            );
          }
          if (schema.type === 'select') {
            const curVal = value ?? schema.default;
            return (
              <div key={schema.key}>
                <span style={{ fontSize: 11, color: COLORS.textSecondary, display: 'block', marginBottom: 4 }}>{schema.label}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {schema.options.map((opt) => {
                    const optVal = typeof opt.value === 'number' ? opt.value : opt.value;
                    const isActive = String(optVal) === String(curVal);
                    return (
                      <button
                        key={opt.value}
                        onClick={() => { handleChange(schema.key, optVal); }}
                        style={{
                          display: 'block',
                          width: '100%',
                          padding: '5px 10px',
                          fontSize: 11,
                          textAlign: 'left',
                          borderRadius: 4,
                          border: `1px solid ${isActive ? COLORS.primary : COLORS.border}`,
                          backgroundColor: isActive ? COLORS.primaryLight : COLORS.bg,
                          color: isActive ? COLORS.primary : COLORS.text,
                          fontWeight: isActive ? 600 : 400,
                          cursor: 'pointer',
                        }}
                      >{opt.label}</button>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
      </div>
    </div>
  );
}

function getParamSchemaDefaultValue(schema: ParamSchema): unknown {
  switch (schema.type) {
    case 'slider':
    case 'input':
    case 'toggle':
    case 'select':
      return schema.default;
    case 'button':
    default:
      return undefined;
  }
}
