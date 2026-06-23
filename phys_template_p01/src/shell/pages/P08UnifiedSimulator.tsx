import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import { presetRegistry } from '@/core/registries/preset-registry';
import { createRenderLoop } from '@/renderer/render-loop';
import { computeCenteredOrigin } from '@/renderer/fit-entities';
import type { Entity } from '@/core/types';
import { AppLayout } from '@/shell/layout/AppLayout';
import type { TopBarTab, TopBarModeSwitch, TopBarModuleSelector } from '@/shell/layout/TopBar';
import { RightSidebar } from '@/shell/panels/RightSidebar';
import { PanelErrorBoundary } from '@/shell/components/PanelErrorBoundary';
import { TimelineBar } from '@/shell/timeline/TimelineBar';
import { useSimulationStore } from '@/store';
import { useSimulatorScene } from '@/shell/hooks/useSimulatorScene';
import { P08BuilderSidebar } from './P08BuilderSidebar';
import { P08BuilderCanvas } from './P08BuilderCanvas';
import { SimulatorCanvas } from '@/shell/canvas/SimulatorCanvas';
import {
  P08_FIELD_BUILDER_SCENE_ID,
  P08_FIELD_BUILDER_PALETTE,
  createP08BuilderEntity,
  createP08BuilderSceneLoadConfig,
  isP08BuilderInternalEntity,
} from '@/domains/em/builder/p08-field-builder-scene';
import {
  P08_MODULES,
  P08_PRESET_IDS,
  P08_SPECIAL_PRESET_IDS,
  getP08ModuleKeyByPresetId,
  type P08ModuleKey,
} from './p08PresetCatalog';
import { getP08PageBackground } from '@/shell/p08/p08Theme';
import { syncStoreFromSimulator } from '@/shell/utils/syncStore';


export interface P08UnifiedSimulatorProps {
  onBack: () => void;
  onNavigateToSpecialPage: (presetId: string) => void;
  initialPresetId?: string;
  initialModuleKey?: P08ModuleKey;
  initialMode?: 'preset' | 'builder';
}

function getDefaultPresetId(moduleKey: P08ModuleKey): string {
  const mod = P08_MODULES.find((m) => m.key === moduleKey);
  if (mod) return mod.recommendedPresetId;
  // fallback: first module always exists
  return P08_MODULES[0]!.recommendedPresetId;
}

function getModuleForPreset(presetId: string): P08ModuleKey {
  return getP08ModuleKeyByPresetId(presetId) ?? 'electrostatic';
}

export function P08UnifiedSimulator({
  onNavigateToSpecialPage,
  initialPresetId,
  initialModuleKey,
  initialMode = 'preset',
}: P08UnifiedSimulatorProps) {
  const resolvedInitialModule = initialModuleKey
    ?? (initialPresetId ? getModuleForPreset(initialPresetId) : 'electrostatic');
  const resolvedInitialPreset = initialPresetId ?? getDefaultPresetId(resolvedInitialModule);

  const [mode, setMode] = useState<'preset' | 'builder'>(initialMode);
  const [moduleKey, setModuleKey] = useState<P08ModuleKey>(resolvedInitialModule);
  const [presetId, setPresetId] = useState<string>(resolvedInitialPreset);
  const savedPresetRef = useRef(resolvedInitialPreset);
  const savedModuleRef = useRef(resolvedInitialModule);

  const handleModeChange = useCallback((newMode: 'preset' | 'builder') => {
    if (newMode === mode) return;
    if (newMode === 'builder') {
      savedPresetRef.current = presetId;
      savedModuleRef.current = moduleKey;
    }
    setMode(newMode);
    if (newMode === 'preset') {
      setPresetId(savedPresetRef.current);
      setModuleKey(savedModuleRef.current);
    }
  }, [mode, presetId, moduleKey]);

  const handleModuleChange = useCallback((newKey: string) => {
    const key = newKey as P08ModuleKey;
    setModuleKey(key);
    const defaultId = getDefaultPresetId(key);
    if (P08_SPECIAL_PRESET_IDS.has(defaultId)) {
      onNavigateToSpecialPage(defaultId);
    } else {
      setPresetId(defaultId);
    }
  }, [onNavigateToSpecialPage]);

  const handleSelectTab = useCallback((tabId: string) => {
    if (P08_SPECIAL_PRESET_IDS.has(tabId)) {
      onNavigateToSpecialPage(tabId);
    } else {
      setPresetId(tabId);
    }
  }, [onNavigateToSpecialPage]);

  const moduleTabs = useMemo((): TopBarTab[] => {
    const mod = P08_MODULES.find((m) => m.key === moduleKey);
    if (!mod) return [];
    return mod.presetIds
      .map((id) => {
        const p = presetRegistry.get(id);
        return p ? { id, label: p.name } : null;
      })
      .filter((t): t is TopBarTab => t !== null);
  }, [moduleKey]);

  const moduleOptions = useMemo((): TopBarModuleSelector['modules'] =>
    P08_MODULES.map((m) => ({ key: m.key, label: m.shortTitle })),
  []);

  const modeSwitch: TopBarModeSwitch = useMemo(() => ({
    mode,
    onModeChange: handleModeChange,
  }), [mode, handleModeChange]);

  const moduleSelectorProps: TopBarModuleSelector = useMemo(() => ({
    modules: moduleOptions,
    activeKey: moduleKey,
    onSelect: handleModuleChange,
  }), [moduleOptions, moduleKey, handleModuleChange]);

  if (mode === 'builder') {
    return (
      <BuilderMode
        modeSwitch={modeSwitch}
      />
    );
  }

  return (
    <PresetMode
      presetId={presetId}
      onSelectTab={handleSelectTab}
      tabs={moduleTabs}
      modeSwitch={modeSwitch}
      moduleSelector={moduleSelectorProps}
    />
  );
}

// ─── Preset Mode ───

function PresetMode({
  presetId,
  onSelectTab,
  tabs,
  modeSwitch,
  moduleSelector,
}: {
  presetId: string;
  onSelectTab: (id: string) => void;
  tabs: TopBarTab[];
  modeSwitch: TopBarModeSwitch;
  moduleSelector: TopBarModuleSelector;
}) {
  const { schemas, paramValues, duration, handleParamChange, handleContextReady, transformRef } =
    useSimulatorScene(presetId);

  return (
    <AppLayout
      title="P-08 电磁场模拟器"
      tabs={tabs}
      activeTabId={presetId}
      onSelectTab={onSelectTab}
      modeSwitch={modeSwitch}
      moduleSelector={moduleSelector}
      pageStyle={P08_PRESET_IDS.has(presetId) ? getP08PageBackground(presetId) : undefined}
      timeline={duration > 0 ? (
        <PanelErrorBoundary title="时间轴" compact>
          <TimelineBar />
        </PanelErrorBoundary>
      ) : null}
      sidebar={
        <PanelErrorBoundary key={presetId} title="参数与读数">
          <RightSidebar
            schemas={schemas}
            values={paramValues}
            onValueChange={handleParamChange}
            presetId={presetId}
          />
        </PanelErrorBoundary>
      }
    >
      <SimulatorCanvas presetId={presetId} onContextReady={handleContextReady} transformRef={transformRef} />
    </AppLayout>
  );
}

// ─── Builder Mode ───

function BuilderMode({
  modeSwitch,
}: {
  modeSwitch: TopBarModeSwitch;
}) {
  const selectedEntityId = useSimulationStore((s) => s.selectedEntityId);
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramGroups = useSimulationStore((s) => s.simulationState.scene.paramGroups);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const viewport = useSimulationStore((s) => s.viewportState.primary);
  const duration = useSimulationStore((s) => s.simulationState.timeline.duration);
  const switchPrimaryViewport = useSimulationStore((s) => s.switchPrimaryViewport);
  const selectEntity = useSimulationStore((s) => s.selectEntity);
  const initFromPreset = useSimulationStore((s) => s.initFromPreset);
  const renderLoopRef = useRef<ReturnType<typeof createRenderLoop> | null>(null);
  const initializedRef = useRef(false);
  const transformRef = useRef<{ scale: number; originX: number; originY: number }>({
    scale: 120,
    originX: 0,
    originY: 0,
  });

  const entityList = useMemo(() => Array.from(entities.values()), [entities]);
  const builderEntityList = useMemo(
    () => entityList.filter((entity) => !isP08BuilderInternalEntity(entity)),
    [entityList],
  );
  const selectedEntity = selectedEntityId
    ? builderEntityList.find((entity) => entity.id === selectedEntityId)
    : undefined;
  const selectedSchemas = useMemo(
    () => paramGroups.find((group) => group.key === `builder-${selectedEntityId}`)?.params ?? [],
    [paramGroups, selectedEntityId],
  );

  const loadScene = useCallback((
    nextEntities: Entity[],
    nextSelectedId: string | null,
  ) => {
    const storeState = useSimulationStore.getState();
    const preferredViewport =
      storeState.simulationState.scene.entities.size > 0 ||
      storeState.simulationState.scene.paramGroups.length > 0
        ? storeState.viewportState.primary
        : undefined;
    const config = createP08BuilderSceneLoadConfig(nextEntities, preferredViewport);
    simulator.loadScene(config);
    const state = simulator.getState();
    initFromPreset({
      simulationState: state,
      paramValues: { ...state.scene.paramValues },
      viewportState: {
        primary: config.defaultViewport,
        overlays: [],
        density: 'standard',
      },
    });
    selectEntity(nextSelectedId);
  }, [initFromPreset, selectEntity]);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    loadScene([], null);
    return () => {
      renderLoopRef.current?.stop();
      simulator.unload();
    };
  }, [loadScene]);

  const handleAddEntity = useCallback((kind: typeof P08_FIELD_BUILDER_PALETTE[number]['kind']) => {
    const nextEntity = createP08BuilderEntity(kind, builderEntityList.length);
    loadScene([...builderEntityList, nextEntity], nextEntity.id);
  }, [builderEntityList, loadScene]);

  const handleDeleteEntity = useCallback((entityId: string) => {
    const nextEntities = builderEntityList.filter((entity) => entity.id !== entityId);
    loadScene(nextEntities, selectedEntityId === entityId ? null : selectedEntityId);
  }, [builderEntityList, loadScene, selectedEntityId]);

  const handleParamChange = useCallback((key: string, value: number | boolean | string) => {
    simulator.updateParam(key, value);
    syncStoreFromSimulator();
  }, []);

  const handleContextReady = useCallback((ctx: CanvasRenderingContext2D) => {
    renderLoopRef.current?.stop();

    const canvas = ctx.canvas;
    const dpr = window.devicePixelRatio || 1;
    const canvasW = canvas.width / dpr;
    const canvasH = canvas.height / dpr;
    const origin = computeCenteredOrigin({
      entities: useSimulationStore.getState().simulationState.scene.entities.values(),
      scale: transformRef.current.scale,
      canvasWidth: canvasW,
      canvasHeight: canvasH,
    });
    transformRef.current.originX = origin.x;
    transformRef.current.originY = origin.y;

    const loop = createRenderLoop({
      canvas,
      getEntities: () => useSimulationStore.getState().simulationState.scene.entities,
      getRelations: () => useSimulationStore.getState().simulationState.scene.relations,
      getResult: () => simulator.getCurrentResult(),
      getViewport: () => useSimulationStore.getState().viewportState,
      getSelectedEntityId: () => useSimulationStore.getState().selectedEntityId,
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
  }, []);

  return (
    <AppLayout
      title="P-08 电磁场模拟器"
      modeSwitch={modeSwitch}
      pageStyle={getP08PageBackground(P08_FIELD_BUILDER_SCENE_ID)}
      timeline={duration > 0 ? (
        <PanelErrorBoundary title="时间轴" compact>
          <TimelineBar />
        </PanelErrorBoundary>
      ) : null}
      sidebar={
        <PanelErrorBoundary title="搭建面板">
          <P08BuilderSidebar
            viewport={viewport}
            selectedEntity={selectedEntity}
            schemas={selectedSchemas}
            values={paramValues}
            entities={builderEntityList}
            onSwitchViewport={switchPrimaryViewport}
            onSelectEntity={selectEntity}
            onAddEntity={handleAddEntity}
            onDeleteEntity={handleDeleteEntity}
            onValueChange={handleParamChange}
          />
        </PanelErrorBoundary>
      }
    >
      <P08BuilderCanvas
        sceneId={P08_FIELD_BUILDER_SCENE_ID}
        onContextReady={handleContextReady}
        transformRef={transformRef}
      />
    </AppLayout>
  );
}
