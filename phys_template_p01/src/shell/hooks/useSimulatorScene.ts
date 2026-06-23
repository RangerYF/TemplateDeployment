import { useCallback, useEffect, useRef } from 'react';
import { simulator } from '@/core/engine/simulator';
import { presetRegistry } from '@/core/registries/preset-registry';
import { createRenderLoop } from '@/renderer/render-loop';
import { computeCenteredOrigin } from '@/renderer/fit-entities';
import { useSimulationStore } from '@/store';
import type { Entity, ParamSchema, ParamValues } from '@/core/types';
import { syncStoreFromSimulator } from '@/shell/utils/syncStore';

export interface UseSimulatorSceneResult {
  schemas: ParamSchema[];
  paramValues: ParamValues;
  duration: number;
  handleParamChange: (key: string, value: number | boolean | string) => void;
  handleContextReady: (ctx: CanvasRenderingContext2D) => void;
  transformRef: React.MutableRefObject<{ scale: number; originX: number; originY: number }>;
}

export function useSimulatorScene(presetId: string): UseSimulatorSceneResult {
  const paramGroups = useSimulationStore(
    (s) => s.simulationState.scene.paramGroups,
  );
  const paramValues = useSimulationStore((s) => s.paramValues);
  const status = useSimulationStore((s) => s.simulationState.status);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);
  const renderLoopRef = useRef<ReturnType<typeof createRenderLoop> | null>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null);

  const transformRef = useRef<{ scale: number; originX: number; originY: number }>({
    scale: 150, originX: 0, originY: 0,
  });

  const recenterTransform = useCallback((ctx: CanvasRenderingContext2D | null, entities: Map<string, Entity>) => {
    if (!ctx) return;

    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const canvasW = canvas.width / dpr;
    const canvasH = canvas.height / dpr;
    const origin = computeCenteredOrigin({
      entities: entities.values(),
      scale: transformRef.current.scale,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
    });
    transformRef.current.originX = origin.x;
    transformRef.current.originY = origin.y;
  }, []);

  useEffect(() => {
    const preset = presetRegistry.get(presetId);
    if (!preset) return;

    const dc = preset.displayConfig;
    if (dc?.scale) transformRef.current.scale = dc.scale;
    if (dc?.origin) {
      transformRef.current.originX = dc.origin.x;
      transformRef.current.originY = dc.origin.y;
    } else {
      transformRef.current.originX = 0;
      transformRef.current.originY = 0;
    }

    simulator.loadPreset(preset);
    const state = simulator.getState();
    useSimulationStore.getState().initFromPreset({
      simulationState: state,
      paramValues: { ...state.scene.paramValues },
      viewportState: {
        primary: preset.defaultViewport,
        overlays: [],
        density: 'standard',
      },
    });
    recenterTransform(canvasContextRef.current, state.scene.entities);
  }, [presetId, recenterTransform]);

  useEffect(() => {
    if (status !== 'running') return;

    let rafId: number;
    let lastTime = performance.now();

    function tick() {
      const now = performance.now();
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      simulator.step(dt);

      const simState = simulator.getState();
      const result = simulator.getCurrentResult();
      const store = useSimulationStore.getState();

      let allStopped = false;
      if (result && result.motionStates.size > 0) {
        allStopped = true;
        for (const ms of result.motionStates.values()) {
          const speed = Math.hypot(ms.velocity.x, ms.velocity.y);
          const accel = Math.hypot(ms.acceleration.x, ms.acceleration.y);
          if (speed > 0.001 || accel > 0.001) { allStopped = false; break; }
        }
      }

      store.setSimulationState({
        status: allStopped ? 'finished' : simState.status,
        timeline: simState.timeline,
        currentResult: result,
      });

      if (!allStopped && simState.status === 'running') {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [status]);

  const handleParamChange = useCallback(
    (key: string, value: number | boolean | string) => {
      simulator.updateParam(key, value);
      syncStoreFromSimulator();
    },
    [],
  );

  const handleContextReady = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      canvasContextRef.current = ctx;
      renderLoopRef.current?.stop();

      const canvas = ctx.canvas;
      const entities = useSimulationStore.getState().simulationState.scene.entities;
      recenterTransform(ctx, entities);

      const loop = createRenderLoop({
        canvas,
        getEntities: () =>
          useSimulationStore.getState().simulationState.scene.entities,
        getRelations: () =>
          useSimulationStore.getState().simulationState.scene.relations,
        getResult: () => simulator.getCurrentResult(),
        getViewport: () => useSimulationStore.getState().viewportState,
        getSelectedEntityId: () =>
          useSimulationStore.getState().selectedEntityId,
        getCoordinateTransform: () => ({
          scale: transformRef.current.scale,
          origin: {
            x: transformRef.current.originX,
            y: transformRef.current.originY,
          },
        }),
      });

      renderLoopRef.current = loop;
      loop.start();
    },
    [recenterTransform],
  );

  useEffect(() => {
    return () => {
      renderLoopRef.current?.stop();
    };
  }, []);

  const schemas = paramGroups.flatMap((g) => g.params);

  return {
    schemas,
    paramValues,
    duration,
    handleParamChange,
    handleContextReady,
    transformRef,
  };
}
