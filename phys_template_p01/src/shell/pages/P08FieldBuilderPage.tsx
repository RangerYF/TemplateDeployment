import { useCallback, useEffect, useMemo, useRef } from 'react';
import { simulator } from '@/core/engine/simulator';
import { entityRegistry } from '@/core/registries/entity-registry';
import { createRenderLoop } from '@/renderer/render-loop';
import { computeCenteredOrigin } from '@/renderer/fit-entities';
import { screenToWorld } from '@/renderer/coordinate';
import type { Entity, ParamSchema, ParamValues, ViewportType } from '@/core/types';
import { CanvasContainer } from '@/shell/canvas/CanvasContainer';
import { MainLayout } from '@/shell/layout/MainLayout';
import { PanelErrorBoundary } from '@/shell/components/PanelErrorBoundary';
import { FieldInfoCards } from '@/shell/panels/FieldInfoCards';
import { InfoPanel } from '@/shell/panels/InfoPanel';
import { P08DisplayControls } from '@/shell/panels/P08DisplayControls';
import { P08ResultOverlay } from '@/shell/panels/P08ResultOverlay';
import { TimelineBar } from '@/shell/timeline/TimelineBar';
import { useSimulationStore } from '@/store';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import {
  P08_FIELD_BUILDER_PALETTE,
  P08_FIELD_BUILDER_SCENE_ID,
  createP08BuilderEntity,
  createP08BuilderSceneLoadConfig,
  getEntityDisplayName,
  getEntityMetaText,
  isP08BuilderInternalEntity,
} from '@/domains/em/builder/p08-field-builder-scene';
import { getP08SceneSummary } from '@/shell/panels/p08SceneSummary';

interface P08FieldBuilderPageProps {
  onBack: () => void;
}

function syncStoreFromSimulator(): void {
  const simState = simulator.getState();
  const result = simulator.getCurrentResult();
  const store = useSimulationStore.getState();

  store.setParamValues({ ...simState.scene.paramValues });
  store.setSimulationState({
    status: simState.status,
    timeline: simState.timeline,
    scene: simState.scene,
    currentResult: result,
    resultHistory: simState.resultHistory,
  });
}

export function P08FieldBuilderPage({ onBack }: P08FieldBuilderPageProps) {
  const selectedEntityId = useSimulationStore((s) => s.selectedEntityId);
  const entities = useSimulationStore((s) => s.simulationState.scene.entities);
  const paramGroups = useSimulationStore((s) => s.simulationState.scene.paramGroups);
  const paramValues = useSimulationStore((s) => s.paramValues);
  const viewport = useSimulationStore((s) => s.viewportState.primary);
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
    <MainLayout
      leftPanel={(
        <PanelErrorBoundary title="场搭建器">
          <BuilderSidePanel
            viewport={viewport}
            selectedEntity={selectedEntity}
            schemas={selectedSchemas}
            values={paramValues}
            entities={builderEntityList}
            onBack={onBack}
            onSwitchViewport={switchPrimaryViewport}
            onSelectEntity={selectEntity}
            onAddEntity={handleAddEntity}
            onDeleteEntity={handleDeleteEntity}
            onValueChange={handleParamChange}
          />
        </PanelErrorBoundary>
      )}
      canvas={(
        <P08FieldBuilderCanvas
          sceneId={P08_FIELD_BUILDER_SCENE_ID}
          onContextReady={handleContextReady}
          transformRef={transformRef}
        />
      )}
      rightPanel={(
        <PanelErrorBoundary title="信息面板">
          <InfoPanel presetId={P08_FIELD_BUILDER_SCENE_ID} />
        </PanelErrorBoundary>
      )}
      timeline={(
        <PanelErrorBoundary title="时间轴" compact>
          <TimelineBar />
        </PanelErrorBoundary>
      )}
    />
  );
}

function BuilderSidePanel({
  viewport,
  selectedEntity,
  schemas,
  values,
  entities,
  onBack,
  onSwitchViewport,
  onSelectEntity,
  onAddEntity,
  onDeleteEntity,
  onValueChange,
}: {
  viewport: ViewportType;
  selectedEntity: Entity | undefined;
  schemas: ParamSchema[];
  values: ParamValues;
  entities: Entity[];
  onBack: () => void;
  onSwitchViewport: (viewport: ViewportType) => void;
  onSelectEntity: (id: string | null) => void;
  onAddEntity: (kind: typeof P08_FIELD_BUILDER_PALETTE[number]['kind']) => void;
  onDeleteEntity: (entityId: string) => void;
  onValueChange: (key: string, value: number | boolean | string) => void;
}) {
  return (
    <aside
      className="flex h-full flex-col overflow-y-auto"
      style={{
        width: 320,
        minWidth: 300,
        borderRight: `1px solid ${COLORS.border}`,
        backgroundColor: COLORS.bg,
      }}
    >
      <div
        className="px-4 py-3"
        style={{ borderBottom: `1px solid ${COLORS.border}` }}
      >
        <button
          onClick={onBack}
          className="text-xs transition-colors hover:opacity-70"
          style={{ color: COLORS.textSecondary }}
        >
          ← 返回 P-08
        </button>
        <div className="mt-2 text-sm font-semibold" style={{ color: COLORS.text }}>
          P-08 场搭建器
        </div>
        <div className="mt-1 text-xs leading-6" style={{ color: COLORS.textMuted }}>
          拖拽实体、调核心参数并直接运行。当前只做课堂搭建 MVP，不含保存/模板扩展。
        </div>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <CardSection title="视角">
          <div className="flex gap-2">
            {([
              { key: 'field', label: '场' },
              { key: 'motion', label: '运动' },
              { key: 'force', label: '受力' },
            ] as const).map((item) => {
              const active = viewport === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => onSwitchViewport(item.key)}
                  className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    color: active ? COLORS.primary : COLORS.textSecondary,
                    backgroundColor: active ? COLORS.primaryLight : COLORS.bgMuted,
                    border: `1px solid ${active ? COLORS.primary : COLORS.border}`,
                  }}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </CardSection>

        <CardSection title="添加实体">
          <div className="grid gap-2 sm:grid-cols-2">
            {P08_FIELD_BUILDER_PALETTE.map((item) => (
              <button
                key={item.kind}
                onClick={() => onAddEntity(item.kind)}
                className="rounded-xl border px-3 py-2 text-left transition-all hover:-translate-y-0.5"
                style={{
                  borderColor: COLORS.border,
                  backgroundColor: COLORS.bgMuted,
                }}
              >
                <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                  {item.label}
                </div>
                <div className="mt-1 text-[11px] leading-5" style={{ color: COLORS.textMuted }}>
                  {item.description}
                </div>
              </button>
            ))}
          </div>
        </CardSection>

        <CardSection title={`场景实体（${entities.length}）`}>
          {entities.length === 0 ? (
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              先从上方添加实体。静电场、匀强场、长直导线、圆形电流、螺线管和带电粒子都可独立拖拽。
            </div>
          ) : (
            <div className="space-y-2">
              {entities.map((entity) => {
                const selected = selectedEntity?.id === entity.id;
                return (
                  <div
                    key={entity.id}
                    className="rounded-xl border px-3 py-2"
                    style={{
                      borderColor: selected ? COLORS.primary : COLORS.border,
                      backgroundColor: selected ? COLORS.primaryLight : COLORS.bg,
                    }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        onClick={() => onSelectEntity(entity.id)}
                        className="flex-1 text-left"
                      >
                        <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                          {getEntityDisplayName(entity)}
                        </div>
                        <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
                          {getEntityMetaText(entity)}
                        </div>
                      </button>
                      <button
                        onClick={() => onDeleteEntity(entity.id)}
                        className="rounded px-2 py-1 text-[11px]"
                        style={{ color: '#B42318', backgroundColor: '#FEE4E2' }}
                      >
                        删除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardSection>

        <CardSection title="选中对象">
          {!selectedEntity ? (
            <div className="text-xs" style={{ color: COLORS.textMuted }}>
              点击左侧列表或画布中的实体后，这里会显示可调参数。拖拽实体可直接改位置。
            </div>
          ) : (
            <div className="space-y-3">
              <div
                className="rounded-xl px-3 py-2"
                style={{ backgroundColor: COLORS.bgMuted }}
              >
                <div className="text-sm font-semibold" style={{ color: COLORS.text }}>
                  {getEntityDisplayName(selectedEntity)}
                </div>
                <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
                  {getEntityMetaText(selectedEntity)}
                </div>
              </div>
              {schemas.length === 0 ? (
                <div className="text-xs" style={{ color: COLORS.textMuted }}>
                  当前实体没有可调参数。
                </div>
              ) : (
                schemas.filter((schema) => isSchemaVisible(schema, values)).map((schema) => (
                  <BuilderParamControl
                    key={schema.key}
                    schema={schema}
                    value={values[schema.key] ?? schema.default}
                    onChange={(value) => onValueChange(schema.key, value)}
                  />
                ))
              )}
            </div>
          )}
        </CardSection>
      </div>
    </aside>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="rounded-2xl border p-3"
      style={{
        borderColor: COLORS.border,
        backgroundColor: COLORS.bg,
        boxShadow: SHADOWS.sm,
      }}
    >
      <div className="mb-3 text-xs font-semibold" style={{ color: COLORS.textSecondary }}>
        {title}
      </div>
      {children}
    </section>
  );
}

function BuilderParamControl({
  schema,
  value,
  onChange,
}: {
  schema: ParamSchema;
  value: number | boolean | string;
  onChange: (value: number | boolean | string) => void;
}) {
  if (schema.type === 'slider') {
    const numericValue = typeof value === 'number' ? value : schema.default;
    return (
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs">{schema.label}</Label>
          <span className="text-xs" style={{ color: COLORS.textMuted }}>
            {formatSliderValue(numericValue, schema.precision ?? 1)}
            {schema.unit}
          </span>
        </div>
        <Slider
          value={[numericValue]}
          min={schema.min}
          max={schema.max}
          step={schema.step}
          onValueChange={([nextValue]) => {
            if (nextValue != null) onChange(nextValue);
          }}
        />
      </div>
    );
  }

  if (schema.type === 'select') {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs">{schema.label}</Label>
        <Select
          value={typeof value === 'string' ? value : String(value)}
          options={schema.options}
          onChange={(event) => onChange(event.target.value)}
        />
      </div>
    );
  }

  if (schema.type === 'toggle') {
    return (
      <div className="flex items-center justify-between gap-3">
        <Label className="text-xs">{schema.label}</Label>
        <Switch
          checked={typeof value === 'boolean' ? value : schema.default}
          onCheckedChange={(checked) => onChange(checked)}
        />
      </div>
    );
  }

  return null;
}

function P08FieldBuilderCanvas({
  sceneId,
  onContextReady,
  transformRef,
}: {
  sceneId: string;
  onContextReady: (ctx: CanvasRenderingContext2D) => void;
  transformRef: React.MutableRefObject<{ scale: number; originX: number; originY: number }>;
}) {
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
      style={{ position: 'relative', flex: 1, display: 'flex', overflow: 'hidden' }}
      onClick={handleCanvasClick}
      onWheel={handleWheel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(event) => event.preventDefault()}
    >
      <CanvasContainer onContextReady={onContextReady} />
      <P08DisplayControls presetId={sceneId} />
      <FieldInfoCards entities={entities} presetId={sceneId} />
      <P08ResultOverlay presetId={sceneId} />
      {viewport === 'motion' && interactiveEntities.length === 0 && (
        <CanvasHint text="先添加带电粒子与场源，再切到运动视角查看轨迹与速度。" />
      )}
    </div>
  );
}

function isSchemaVisible(schema: ParamSchema, values: ParamValues): boolean {
  if (!schema.visibleWhen || schema.visibleWhen.length === 0) {
    return true;
  }

  return schema.visibleWhen.every((rule) => {
    const currentValue = values[rule.key];
    if (rule.equals !== undefined) {
      return currentValue === rule.equals;
    }
    if (rule.notEquals !== undefined) {
      return currentValue !== rule.notEquals;
    }
    return true;
  });
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

function formatSliderValue(value: number, precision: number): string {
  if (Math.abs(value) >= 1e4 || (Math.abs(value) > 0 && Math.abs(value) < 1e-2)) {
    return value.toExponential(2);
  }
  return value.toFixed(precision);
}
