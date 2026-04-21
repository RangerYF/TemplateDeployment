import { useState, useEffect, useRef, useCallback } from 'react';
import { useSimulationStore } from '@/store';
import { simulator } from '@/core/engine/simulator';
import { presetRegistry } from '@/core/registries/preset-registry';
import { createRenderLoop } from '@/renderer/render-loop';
import { MainLayout } from './layout/MainLayout';
import { ParamPanel } from './panels/ParamPanel';
import { InfoPanel } from './panels/InfoPanel';
import { CanvasContainer } from './canvas/CanvasContainer';
import { TimelineBar } from './timeline/TimelineBar';
import { PresetGallery } from './pages/PresetGallery';

/**
 * 顶层应用组件
 * 双页面：预设选择 → 模拟器
 */
function getPresetIdFromHash(): string | null {
  const hash = window.location.hash.replace('#', '');
  return hash || null;
}

function setHash(presetId: string | null): void {
  window.location.hash = presetId ?? '';
}

export function App() {
  const [activePresetId, setActivePresetId] = useState<string | null>(getPresetIdFromHash);

  // 监听浏览器前进/后退
  useEffect(() => {
    function onHashChange() {
      const id = getPresetIdFromHash();
      if (!id) simulator.unload();
      setActivePresetId(id);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  if (!activePresetId) {
    return (
      <PresetGallery
        onSelectPreset={(id) => {
          setHash(id);
          setActivePresetId(id);
        }}
      />
    );
  }

  return (
    <SimulatorView
      key={activePresetId}
      presetId={activePresetId}
      onBack={() => {
        simulator.unload();
        setHash(null);
        setActivePresetId(null);
      }}
    />
  );
}

// ─── 模拟器视图（独立组件，避免 App 重渲染导致重挂载） ───

interface SimulatorViewProps {
  presetId: string;
  onBack: () => void;
}

function SimulatorView({ presetId: initialPresetId, onBack }: SimulatorViewProps) {
  const [currentPresetId, setCurrentPresetId] = useState(initialPresetId);
  const paramGroups = useSimulationStore(
    (s) => s.simulationState.scene.paramGroups,
  );
  const paramValues = useSimulationStore((s) => s.paramValues);
  const status = useSimulationStore((s) => s.simulationState.status);
  const renderLoopRef = useRef<ReturnType<typeof createRenderLoop> | null>(
    null,
  );
  const coordinateTransformRef = useRef<(() => import('@/core/types').CoordinateTransform) | null>(null);
  // 稳定回调：始终读取 ref 的最新值
  const getCoordinateTransformStable = useCallback(() => {
    return coordinateTransformRef.current?.() ?? { scale: 150, origin: { x: 0, y: 0 } };
  }, []);

  // 加载预设
  const loadPreset = useCallback((id: string) => {
    const preset = presetRegistry.get(id);
    if (!preset) return;

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
      supportedViewports: preset.supportedViewports,
    });
  }, []);

  useEffect(() => {
    loadPreset(initialPresetId);
  }, [initialPresetId, loadPreset]);

  // 播放驱动：status 为 running 时启动 rAF 循环驱动 simulator.step
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

      store.setSimulationState({
        status: simState.status,
        timeline: simState.timeline,
        currentResult: result,
      });

      if (simState.status === 'running') {
        rafId = requestAnimationFrame(tick);
      }
    }

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [status]);

  // 参数变更
  const handleParamChange = useCallback(
    (key: string, value: number | boolean | string) => {
      simulator.updateParam(key, value);
      const result = simulator.getCurrentResult();
      const store = useSimulationStore.getState();
      store.updateParam(key, value);
      store.setCurrentResult(result);
    },
    [],
  );

  // Canvas 就绪 → 启动渲染循环（纯渲染，不驱动模拟）
  const handleContextReady = useCallback(
    (ctx: CanvasRenderingContext2D) => {
      renderLoopRef.current?.stop();

      const canvas = ctx.canvas;
      const dpr = window.devicePixelRatio || 1;

      const getCoordinateTransform = () => ({
        scale: 150,
        origin: {
          x: canvas.width / (2 * dpr),
          y: canvas.height * 0.5 / dpr,
        },
      });

      // 保存到 ref 供 CanvasContainer 使用
      coordinateTransformRef.current = getCoordinateTransform;

      const loop = createRenderLoop({
        canvas,
        getEntities: () =>
          useSimulationStore.getState().simulationState.scene.entities,
        getResult: () => simulator.getCurrentResult(),
        getResultHistory: () => simulator.getResultHistory(),
        getViewport: () => useSimulationStore.getState().viewportState,
        getSelection: () =>
          useSimulationStore.getState().selection,
        getHoveredTarget: () =>
          useSimulationStore.getState().hoveredTarget,
        getCoordinateTransform,
      });

      renderLoopRef.current = loop;
      loop.start();
    },
    [],
  );

  // 清理渲染循环
  useEffect(() => {
    return () => {
      renderLoopRef.current?.stop();
    };
  }, []);

  // 分组预设信息
  const currentPreset = presetRegistry.get(currentPresetId);
  const groupPresets = currentPreset?.group
    ? presetRegistry
        .getByCategory(currentPreset.category)
        .filter((p) => p.group === currentPreset.group)
        .sort((a, b) => (a.groupOrder ?? 100) - (b.groupOrder ?? 100))
        .map((p) => ({ id: p.id, name: p.name }))
    : undefined;

  const handleSwitchPreset = useCallback(
    (newPresetId: string) => {
      const oldValues = { ...useSimulationStore.getState().paramValues };
      loadPreset(newPresetId);
      setCurrentPresetId(newPresetId);
      // 恢复同名参数
      const newPreset = presetRegistry.get(newPresetId);
      if (newPreset) {
        for (const group of newPreset.paramGroups) {
          for (const param of group.params) {
            if (param.key in oldValues && oldValues[param.key] !== undefined) {
              handleParamChange(param.key, oldValues[param.key]!);
            }
          }
        }
      }
      // 静默更新 URL hash（用 replaceState 避免触发 hashchange）
      history.replaceState(null, '', `#${newPresetId}`);
    },
    [loadPreset, handleParamChange],
  );

  const schemas = paramGroups.flatMap((g) =>
    g.params.map((p) => (p.group ? p : { ...p, group: g.label })),
  );

  return (
    <MainLayout
      leftPanel={
        <ParamPanel
          schemas={schemas}
          values={paramValues}
          onValueChange={handleParamChange}
          onBack={onBack}
          groupPresets={groupPresets}
          activePresetId={currentPresetId}
          onSwitchPreset={handleSwitchPreset}
        />
      }
      canvas={
        <CanvasContainer
          onContextReady={handleContextReady}
          getCoordinateTransform={getCoordinateTransformStable}
        />
      }
      rightPanel={<InfoPanel />}
      timeline={<TimelineBar />}
    />
  );
}
