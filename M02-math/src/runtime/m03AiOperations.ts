import { createEntity, updateEntityParams } from '@/editor/entities/types';
import { createLine, updateLineParams } from '@/editor/entities/line';
import { createImplicitCurve, updateImplicitCurveParams } from '@/editor/entities/implicitCurve';
import { createMovablePoint } from '@/editor/entities/movablePoint';
import { parseImplicitEquation } from '@/engine/implicitCurveEngine';
import { pointOnConic } from '@/engine/locusEngine';
import { intersectLineConic } from '@/engine/intersectionEngine';
import { useEntityStore, type EntityStoreSnapshot, type DisplayOptions } from '@/editor/store/entityStore';
import { useM03InteractionStore, type M03InteractionSnapshot } from '@/editor/store/m03InteractionStore';
import { useLocusStore, type LocusStoreSnapshot, type LocusPreset } from '@/editor/store/locusStore';
import { useOpticalStore, type OpticalStoreSnapshot } from '@/editor/store/opticalStore';
import { useHistoryStore } from '@/editor/store/historyStore';
import type { Command } from '@/editor/commands/types';
import {
  DEFAULT_M03_VIEWPORT,
  ENTITY_COLORS,
  type AnyEntity,
  type CircleParams,
  type ConicEntity,
  type ConicType,
  type EllipseParams,
  type HyperbolaParams,
  type ImplicitCurveEntity,
  type LineEntity,
  type LineParams,
  type MovablePointEntity,
  type ParabolaParams,
  type ViewportState,
} from '@/types';
import { isConicEntity } from '@/types';

export interface M03BridgeOperationResult {
  ok: boolean;
  errors: string[];
  applied: number;
  rolledBack?: boolean;
}

type AiOperation = Record<string, unknown> & { type?: unknown };
type M03StateSnapshot = {
  entity: EntityStoreSnapshot;
  interaction: M03InteractionSnapshot;
  locus: LocusStoreSnapshot;
  optical: OpticalStoreSnapshot;
};

const MAX_ENTITIES = 12;
const MAX_HISTORY = 50;
const DISPLAY_KEYS = new Set<keyof DisplayOptions>([
  'showGrid',
  'showFoci',
  'showDirectrices',
  'showAsymptotes',
  'showLabels',
  'showIntersections',
  'showVertices',
  'showAxesOfSymmetry',
  'showTangent',
  'showNormal',
  'showFocalChord',
]);

const DEFAULT_LABELS: Record<ConicType, string> = {
  ellipse: '椭圆',
  hyperbola: '双曲线',
  parabola: '抛物线',
  circle: '圆',
};

const NAMED_COLORS: Record<string, string> = {
  blue: '#2563EB',
  green: '#16A34A',
  red: '#DC2626',
  yellow: '#D97706',
  orange: '#EA580C',
  purple: '#7C3AED',
  violet: '#7C3AED',
  pink: '#DB2777',
  cyan: '#0891B2',
  teal: '#0D9488',
  black: '#111827',
  gray: '#6B7280',
  grey: '#6B7280',
  white: '#F9FAFB',
  蓝色: '#2563EB',
  蓝: '#2563EB',
  绿色: '#16A34A',
  绿: '#16A34A',
  红色: '#DC2626',
  红: '#DC2626',
  黄色: '#D97706',
  黄: '#D97706',
  橙色: '#EA580C',
  橙: '#EA580C',
  紫色: '#7C3AED',
  紫: '#7C3AED',
  粉色: '#DB2777',
  粉: '#DB2777',
  青色: '#0891B2',
  青: '#0891B2',
  黑色: '#111827',
  黑: '#111827',
  灰色: '#6B7280',
  灰: '#6B7280',
  白色: '#F9FAFB',
  白: '#F9FAFB',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null;
}

function cloneM03State(): M03StateSnapshot {
  return {
    entity: structuredClone(useEntityStore.getState().getSnapshot()),
    interaction: structuredClone(useM03InteractionStore.getState().getSnapshot()),
    locus: structuredClone(useLocusStore.getState().getSnapshot()),
    optical: structuredClone(useOpticalStore.getState().getSnapshot()),
  };
}

function loadM03State(snapshot: M03StateSnapshot): void {
  useEntityStore.getState().loadSnapshot(snapshot.entity);
  useM03InteractionStore.getState().loadSnapshot(snapshot.interaction);
  useLocusStore.getState().loadSnapshot(snapshot.locus);
  useOpticalStore.getState().loadSnapshot(snapshot.optical);
}

function createSnapshotCommand(before: M03StateSnapshot, after: M03StateSnapshot): Command {
  return {
    type: 'aiPipeline',
    label: 'AI 解析几何搭建',
    execute() {
      loadM03State(after);
    },
    undo() {
      loadM03State(before);
    },
  };
}

function replacePipelineHistory(before: M03StateSnapshot, after: M03StateSnapshot, baseUndoStack: Command[]): void {
  const nextUndoStack = [
    ...baseUndoStack,
    createSnapshotCommand(before, after),
  ].slice(-MAX_HISTORY);

  useHistoryStore.setState({
    undoStack: nextUndoStack,
    redoStack: [],
    canUndo: nextUndoStack.length > 0,
    canRedo: false,
  });
}

function uniqueLabel(preferred: string): string {
  const existing = new Set(
    useEntityStore.getState().entities
      .map((entity) => entity.label)
      .filter((label): label is string => Boolean(label)),
  );
  if (!existing.has(preferred)) return preferred;
  for (let i = 2; i < 100; i++) {
    const candidate = `${preferred}${i}`;
    if (!existing.has(candidate)) return candidate;
  }
  return `${preferred}${existing.size + 1}`;
}

function normalizeColor(value: unknown, fallback: string): string {
  const color = asString(value);
  if (!color) return fallback;
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  const normalized = color.toLowerCase().replace(/\s+/g, '');
  return NAMED_COLORS[normalized] ?? NAMED_COLORS[color] ?? fallback;
}

function ensureCapacity(extra = 1): void {
  if (useEntityStore.getState().entities.length + extra > MAX_ENTITIES) {
    throw new Error(`实体数量已达上限 ${MAX_ENTITIES}`);
  }
}

function getEntityByRef(operation: AiOperation): AnyEntity {
  const entityId = asString(operation.entityId);
  const label = asString(operation.label) ?? asString(operation.fromLabel);
  const entities = useEntityStore.getState().entities;
  const entity = entityId
    ? entities.find((item) => item.id === entityId)
    : label
      ? entities.find((item) => item.label === label)
      : entities.find((item) => item.id === useEntityStore.getState().activeEntityId);
  if (!entity) throw new Error('未找到目标实体');
  return entity;
}

function getConicByRef(operation: AiOperation): ConicEntity {
  const entity = getEntityByRef(operation);
  if (!isConicEntity(entity)) throw new Error('目标实体不是圆锥曲线');
  return entity;
}

function getLineByRef(operation: AiOperation): LineEntity {
  const entity = getEntityByRef(operation);
  if (entity.type !== 'line') throw new Error('目标实体不是直线');
  return entity;
}

function getImplicitByRef(operation: AiOperation): ImplicitCurveEntity {
  const entity = getEntityByRef(operation);
  if (entity.type !== 'implicit-curve') throw new Error('目标实体不是隐式曲线');
  return entity;
}

function getEntityByExplicitRef(entityIdValue: unknown, labelValue: unknown, fallbackActive = false): AnyEntity {
  const entityId = asString(entityIdValue);
  const label = asString(labelValue);
  const entities = useEntityStore.getState().entities;
  const entity = entityId
    ? entities.find((item) => item.id === entityId)
    : label
      ? entities.find((item) => item.label === label)
      : fallbackActive
        ? entities.find((item) => item.id === useEntityStore.getState().activeEntityId)
        : null;
  if (!entity) throw new Error('未找到目标实体');
  return entity;
}

function getLineByExplicitRef(entityIdValue: unknown, labelValue: unknown): LineEntity {
  const entity = getEntityByExplicitRef(entityIdValue, labelValue);
  if (entity.type !== 'line') throw new Error('目标实体不是直线');
  return entity;
}

function getConicByExplicitRef(entityIdValue: unknown, labelValue: unknown, fallbackActive = false): ConicEntity {
  const entity = getEntityByExplicitRef(entityIdValue, labelValue, fallbackActive);
  if (!isConicEntity(entity)) throw new Error('目标实体不是圆锥曲线');
  return entity;
}

function validConicType(value: unknown): ConicType {
  if (value === 'ellipse' || value === 'hyperbola' || value === 'parabola' || value === 'circle') return value;
  throw new Error('conicType 必须是 ellipse、hyperbola、parabola 或 circle');
}

function numberFromRecord(record: Record<string, unknown>, key: string, fallback: number): number {
  return asNumber(record[key]) ?? fallback;
}

function conicParams(type: ConicType, raw: unknown): EllipseParams | HyperbolaParams | ParabolaParams | CircleParams {
  const value = isRecord(raw) ? raw : {};
  if (type === 'ellipse') {
    const a = numberFromRecord(value, 'a', 5);
    const b = numberFromRecord(value, 'b', 3);
    if (!(a > 0 && b > 0 && a > b)) throw new Error('椭圆要求 a > b > 0');
    return { a, b, cx: numberFromRecord(value, 'cx', 0), cy: numberFromRecord(value, 'cy', 0) };
  }
  if (type === 'hyperbola') {
    const a = numberFromRecord(value, 'a', 3);
    const b = numberFromRecord(value, 'b', 3);
    if (!(a > 0 && b > 0)) throw new Error('双曲线要求 a、b 大于 0');
    return { a, b, cx: numberFromRecord(value, 'cx', 0), cy: numberFromRecord(value, 'cy', 0) };
  }
  if (type === 'parabola') {
    const p = numberFromRecord(value, 'p', 2);
    if (!(p > 0)) throw new Error('抛物线要求 p 大于 0');
    const orientation = value.orientation === 'v' ? 'v' : 'h';
    return { p, cx: numberFromRecord(value, 'cx', 0), cy: numberFromRecord(value, 'cy', 0), orientation };
  }
  const r = numberFromRecord(value, 'r', 4);
  if (!(r > 0)) throw new Error('圆要求 r 大于 0');
  return { r, cx: numberFromRecord(value, 'cx', 0), cy: numberFromRecord(value, 'cy', 0) };
}

function conicPatch(entity: ConicEntity, raw: unknown) {
  if (!isRecord(raw)) return {};
  const next = conicParams(entity.type, { ...entity.params, ...raw });
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key in next) patch[key] = value;
  }
  return patch;
}

function lineParams(raw: unknown): LineParams {
  const value = isRecord(raw) ? raw : {};
  const vertical = asBoolean(value.vertical) ?? false;
  if (vertical) {
    return { vertical: true, x: numberFromRecord(value, 'x', 0), k: 0, b: 0 };
  }
  return {
    vertical: false,
    k: numberFromRecord(value, 'k', 1),
    b: numberFromRecord(value, 'b', 0),
    x: numberFromRecord(value, 'x', 0),
  };
}

function linePatch(entity: LineEntity, raw: unknown): Partial<LineParams> {
  if (!isRecord(raw)) return {};
  const merged = lineParams({ ...entity.params, ...raw });
  const patch: Partial<LineParams> = {};
  for (const key of ['vertical', 'k', 'b', 'x'] as const) {
    if (raw[key] !== undefined) patch[key] = merged[key] as never;
  }
  return patch;
}

function conicPointByKind(entity: ConicEntity, kind: string | null): [number, number] | null {
  if (!kind) return null;
  const normalized = kind.toLowerCase().replace(/[\s_-]+/g, '');
  if (entity.type === 'ellipse') {
    const { a, b, cx, cy } = entity.params;
    if (['rightvertex', 'right', '右顶点', '右端点'].includes(normalized)) return [cx + a, cy];
    if (['leftvertex', 'left', '左顶点', '左端点'].includes(normalized)) return [cx - a, cy];
    if (['topvertex', 'top', '上顶点'].includes(normalized)) return [cx, cy + b];
    if (['bottomvertex', 'bottom', '下顶点'].includes(normalized)) return [cx, cy - b];
  }
  if (entity.type === 'circle') {
    const { r, cx, cy } = entity.params;
    if (['rightvertex', 'right', '右顶点', '右端点'].includes(normalized)) return [cx + r, cy];
    if (['leftvertex', 'left', '左顶点', '左端点'].includes(normalized)) return [cx - r, cy];
    if (['topvertex', 'top', '上顶点'].includes(normalized)) return [cx, cy + r];
    if (['bottomvertex', 'bottom', '下顶点'].includes(normalized)) return [cx, cy - r];
  }
  if (entity.type === 'hyperbola') {
    const { a, cx, cy } = entity.params;
    if (['rightvertex', 'right', '右顶点', '右支顶点'].includes(normalized)) return [cx + a, cy];
    if (['leftvertex', 'left', '左顶点', '左支顶点'].includes(normalized)) return [cx - a, cy];
  }
  if (entity.type === 'parabola') {
    const { cx, cy } = entity.params;
    if (['vertex', '顶点'].includes(normalized)) return [cx, cy];
  }
  return null;
}

function conicPointForOperation(entity: ConicEntity, operation: AiOperation): { x: number; y: number; t: number | null } {
  const pointKind = asString(operation.pointKind ?? operation.point);
  const byKind = conicPointByKind(entity, pointKind);
  if (byKind) return { x: byKind[0], y: byKind[1], t: null };

  const t = asNumber(operation.t);
  if (t !== null) {
    const clamped = Math.max(0, Math.min(1, t));
    const [x, y] = pointOnConic(entity, clamped);
    return { x, y, t: clamped };
  }

  const x = asNumber(operation.x);
  const y = asNumber(operation.y);
  if (x !== null && y !== null) return { x, y, t: null };

  const defaultT = entity.type === 'hyperbola' || entity.type === 'parabola' ? 0.62 : 0.16;
  const [px, py] = pointOnConic(entity, defaultT);
  return { x: px, y: py, t: defaultT };
}

function tangentDirectionAt(entity: ConicEntity, x: number, y: number): [number, number] {
  if (entity.type === 'ellipse') {
    const { a, b, cx, cy } = entity.params;
    const theta = Math.atan2((y - cy) / b, (x - cx) / a);
    return [-a * Math.sin(theta), b * Math.cos(theta)];
  }
  if (entity.type === 'hyperbola') {
    const { a, b, cx, cy } = entity.params;
    const t = Math.asinh((y - cy) / b);
    const sign = x >= cx ? 1 : -1;
    return [sign * a * Math.sinh(t), b * Math.cosh(t)];
  }
  if (entity.type === 'parabola') {
    const { p, cx, cy, orientation = 'h' } = entity.params;
    if (orientation === 'v') return [1, (x - cx) / p];
    return [(y - cy) / p, 1];
  }
  const { r, cx, cy } = entity.params;
  const theta = Math.atan2((y - cy) / r, (x - cx) / r);
  return [-r * Math.sin(theta), r * Math.cos(theta)];
}

function lineParamsThroughPointAndDirection(x: number, y: number, dx: number, dy: number): LineParams {
  if (Math.abs(dx) < 1e-10) {
    return { vertical: true, x, k: 0, b: 0 };
  }
  const k = dy / dx;
  return { vertical: false, k, b: y - k * x, x: 0 };
}

function addPinnedPoint(entityId: string, x: number, y: number): void {
  const snapshot = useM03InteractionStore.getState().getSnapshot();
  const exists = snapshot.pinnedPoints.some(
    (item) => item.entityId === entityId && Math.abs(item.mathX - x) < 1e-4 && Math.abs(item.mathY - y) < 1e-4,
  );
  if (exists) return;
  const label = `C${snapshot.pinnedPoints.length + 1}`;
  useM03InteractionStore.getState().loadSnapshot({
    ...snapshot,
    pinnedPoints: [
      ...snapshot.pinnedPoints,
      {
        id: `${entityId}@${x.toFixed(6)},${y.toFixed(6)}`,
        mathX: x,
        mathY: y,
        entityId,
        label,
      },
    ],
  });
}

function addPinnedIntersection(lineId: string, conicId: string, x: number, y: number): void {
  const snapshot = useM03InteractionStore.getState().getSnapshot();
  const exists = snapshot.pinnedIntersections.some(
    (item) => Math.abs(item.mathX - x) < 1e-4 && Math.abs(item.mathY - y) < 1e-4,
  );
  if (exists) return;
  const label = `X${snapshot.pinnedIntersections.length + 1}`;
  useM03InteractionStore.getState().loadSnapshot({
    ...snapshot,
    pinnedIntersections: [
      ...snapshot.pinnedIntersections,
      {
        id: `${lineId}|${conicId}@${x.toFixed(6)},${y.toFixed(6)}`,
        mathX: x,
        mathY: y,
        lineId,
        conicId,
        label,
      },
    ],
  });
}

function executeAddConic(operation: AiOperation): void {
  ensureCapacity();
  const type = validConicType(operation.conicType ?? operation.entityType);
  const params = conicParams(type, operation.params);
  const count = useEntityStore.getState().entities.length;
  const label = uniqueLabel(asString(operation.label) ?? DEFAULT_LABELS[type]);
  const color = normalizeColor(operation.color, ENTITY_COLORS[count % ENTITY_COLORS.length] ?? '#374151');
  const entity = createEntity(type, params as never, { label, color });
  useEntityStore.getState().addEntity(entity);
  useEntityStore.getState().setActiveEntityId(entity.id);
}

function executeUpdateConicParams(operation: AiOperation): void {
  const entity = getConicByRef(operation);
  const patch = conicPatch(entity, operation.params);
  if (Object.keys(patch).length === 0) throw new Error('updateConicParams 没有可更新的参数');
  const updated = updateEntityParams(entity, patch as never);
  useEntityStore.getState().updateEntity(entity.id, updated);
}

function executeAddLine(operation: AiOperation): void {
  ensureCapacity();
  const count = useEntityStore.getState().entities.length;
  const label = uniqueLabel(asString(operation.label) ?? '直线');
  const color = normalizeColor(operation.color, ENTITY_COLORS[count % ENTITY_COLORS.length] ?? '#374151');
  const entity = createLine(lineParams(operation.params), { label, color });
  useEntityStore.getState().addEntity(entity);
  useEntityStore.getState().setActiveEntityId(entity.id);
}

function executeUpdateLine(operation: AiOperation): void {
  const entity = getLineByRef(operation);
  const patch = linePatch(entity, operation.params);
  if (Object.keys(patch).length === 0) throw new Error('updateLine 没有可更新的参数');
  const updated = updateLineParams(entity, patch);
  useEntityStore.getState().updateEntity(entity.id, updated);
}

function executeAddImplicitCurve(operation: AiOperation): void {
  ensureCapacity();
  const expression = asString(operation.expression) ?? asString(operation.exprStr);
  if (!expression) throw new Error('addImplicitCurve 缺少 expression');
  const parsed = parseImplicitEquation(expression, []);
  if (!parsed) throw new Error('隐式曲线表达式无法解析');
  const count = useEntityStore.getState().entities.length;
  const label = uniqueLabel(asString(operation.label) ?? '隐式曲线');
  const color = normalizeColor(operation.color, ENTITY_COLORS[count % ENTITY_COLORS.length] ?? '#374151');
  const entity = createImplicitCurve(parsed.exprStr, parsed.namedParams, { label, color });
  useEntityStore.getState().addEntity(entity);
  useEntityStore.getState().setActiveEntityId(entity.id);
}

function executeUpdateImplicitCurve(operation: AiOperation): void {
  const entity = getImplicitByRef(operation);
  const expression = asString(operation.expression) ?? asString(operation.exprStr);
  if (!expression) throw new Error('updateImplicitCurve 缺少 expression');
  const parsed = parseImplicitEquation(expression, []);
  if (!parsed) throw new Error('隐式曲线表达式无法解析');
  const updated = updateImplicitCurveParams(entity, {
    exprStr: parsed.exprStr,
    namedParams: parsed.namedParams,
  });
  useEntityStore.getState().updateEntity(entity.id, updated);
}

function executeSetDisplayOptions(operation: AiOperation): void {
  let changed = false;
  for (const key of DISPLAY_KEYS) {
    const value = asBoolean(operation[key]);
    if (value !== null) {
      useEntityStore.getState().setDisplayOption(key, value);
      changed = true;
    }
  }
  if (!changed) throw new Error('setDisplayOptions 没有可应用的显示设置');
}

function executeSetViewport(operation: AiOperation): void {
  const viewport: ViewportState = {
    xMin: asNumber(operation.xMin) ?? NaN,
    xMax: asNumber(operation.xMax) ?? NaN,
    yMin: asNumber(operation.yMin) ?? NaN,
    yMax: asNumber(operation.yMax) ?? NaN,
  };
  if (!Number.isFinite(viewport.xMin) || !Number.isFinite(viewport.xMax) || viewport.xMin >= viewport.xMax) {
    throw new Error('setViewport 要求 xMin < xMax');
  }
  if (!Number.isFinite(viewport.yMin) || !Number.isFinite(viewport.yMax) || viewport.yMin >= viewport.yMax) {
    throw new Error('setViewport 要求 yMin < yMax');
  }
  useEntityStore.getState().setViewport(viewport);
}

function executeSetActiveEntity(operation: AiOperation): void {
  const entity = getEntityByRef(operation);
  useEntityStore.getState().setActiveEntityId(entity.id);
}

function executeSetEntityStyle(operation: AiOperation): void {
  const entity = getEntityByRef(operation);
  const patch: Partial<AnyEntity> = {};
  const color = normalizeColor(operation.color, entity.color);
  if (color !== entity.color) patch.color = color;
  const visible = asBoolean(operation.visible);
  if (visible !== null) patch.visible = visible;
  const newLabel = asString(operation.newLabel);
  if (newLabel) patch.label = uniqueLabel(newLabel);
  if (Object.keys(patch).length === 0) throw new Error('setEntityStyle 没有可应用的样式设置');
  useEntityStore.getState().updateEntity(entity.id, { ...entity, ...patch } as AnyEntity);
}

function executeLoadPresetConicScene(operation: AiOperation): void {
  const presetId = asString(operation.presetId);
  const presetType =
    presetId === 'standard-hyperbola' ? 'hyperbola'
      : presetId === 'standard-parabola' ? 'parabola'
        : presetId === 'standard-circle' ? 'circle'
          : 'ellipse';
  const params =
    presetType === 'ellipse' ? { a: 5, b: 3, cx: 0, cy: 0 }
      : presetType === 'hyperbola' ? { a: 3, b: 3, cx: 0, cy: 0 }
        : presetType === 'parabola' ? { p: 2, cx: 0, cy: 0, orientation: 'h' as const }
          : { r: 4, cx: 0, cy: 0 };
  const label =
    presetType === 'ellipse' ? '标准椭圆'
      : presetType === 'hyperbola' ? '直角双曲线'
        : presetType === 'parabola' ? '标准抛物线'
          : '标准圆';
  const entity = createEntity(presetType, params as never, { label, color: ENTITY_COLORS[0] });
  useEntityStore.getState().replaceAllEntities([entity]);
  useEntityStore.getState().setActiveEntityId(entity.id);
  useEntityStore.getState().setViewport({ ...DEFAULT_M03_VIEWPORT });
}

function executeSetLocusDemo(operation: AiOperation): void {
  const preset = asString(operation.preset) as LocusPreset | null;
  if (preset !== 'sum-of-distances' && preset !== 'focus-directrix') {
    throw new Error('setLocusDemo preset 必须是 sum-of-distances 或 focus-directrix');
  }
  const entity = getConicByRef(operation);
  const locus = useLocusStore.getState();
  locus.clearTrace();
  locus.setPreset(preset, entity.id);

  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const [x, y] = pointOnConic(entity, t);
    locus.pushTrace({ x, y, t });
  }
  const previewT = entity.type === 'hyperbola' || entity.type === 'parabola' ? 0.62 : 0.16;
  const [x, y] = pointOnConic(entity, previewT);
  locus.setCurrentPoint({ x, y, t: previewT });
  locus.incrementRenderTick();
}

function executeSetOpticalDemo(operation: AiOperation): void {
  const enabled = asBoolean(operation.enabled);
  if (enabled === null) throw new Error('setOpticalDemo 缺少 enabled');
  const rayCount = asNumber(operation.rayCount);
  if (rayCount !== null) {
    useOpticalStore.getState().setRayCount(Math.max(3, Math.min(24, Math.round(rayCount))));
  }
  useOpticalStore.getState().setEnabled(enabled);
}

function executePinConicPoint(operation: AiOperation): void {
  const entity = getConicByExplicitRef(operation.entityId, operation.label ?? operation.entityLabel, true);
  const point = conicPointForOperation(entity, operation);
  addPinnedPoint(entity.id, point.x, point.y);
  useEntityStore.getState().setActiveEntityId(entity.id);
}

function executePinLineConicIntersections(operation: AiOperation): void {
  const line = getLineByExplicitRef(operation.lineId, operation.lineLabel);
  const conic = getConicByExplicitRef(operation.conicId, operation.conicLabel);
  const result = intersectLineConic(line.params, conic);
  if (result.pts.length === 0) throw new Error('直线与圆锥曲线没有交点');

  const which = asString(operation.which) ?? 'all';
  const selected = which === 'first'
    ? result.pts.slice(0, 1)
    : which === 'second'
      ? result.pts.slice(1, 2)
      : result.pts;
  if (selected.length === 0) throw new Error('指定的交点不存在');

  for (const [x, y] of selected) {
    addPinnedIntersection(line.id, conic.id, x, y);
  }
  useEntityStore.getState().setActiveEntityId(line.id);
}

function executeAddMovablePoint(operation: AiOperation): void {
  ensureCapacity();
  const entity = getConicByExplicitRef(operation.entityId, operation.label ?? operation.entityLabel, true);
  const point = conicPointForOperation(entity, operation);
  const store = useEntityStore.getState();
  const existingMovable = store.entities.find(
    (item): item is MovablePointEntity => item.type === 'movable-point',
  );
  const duplicateMovables = store.entities.filter(
    (item): item is MovablePointEntity => item.type === 'movable-point',
  );
  for (const duplicate of duplicateMovables) {
    if (existingMovable && duplicate.id !== existingMovable.id) {
      store.removeEntity(duplicate.id);
    }
  }

  const count = store.entities.length;
  const nextParams = {
    constraintEntityId: entity.id,
    t: point.t ?? 0,
    mathX: point.x,
    mathY: point.y,
    branch: point.x < ((entity.params as { cx?: number }).cx ?? 0) ? 'left' as const : 'right' as const,
  };
  const showTrajectory = asBoolean(operation.showTrajectory);
  const showProjections = asBoolean(operation.showProjections);

  if (existingMovable) {
    const updated: MovablePointEntity = {
      ...existingMovable,
      label: asString(operation.pointLabel) ?? asString(operation.newLabel) ?? existingMovable.label ?? 'P',
      color: normalizeColor(operation.color, existingMovable.color),
      params: {
        ...existingMovable.params,
        ...nextParams,
        showTrajectory: showTrajectory ?? existingMovable.params.showTrajectory,
        showProjections: showProjections ?? existingMovable.params.showProjections,
      },
    };
    useEntityStore.getState().updateEntity(existingMovable.id, updated);
    useEntityStore.getState().setActiveEntityId(existingMovable.id);
    useEntityStore.getState().setActiveTool('movable-point');
    return;
  }

  const movable = createMovablePoint(
    nextParams,
    {
      label: asString(operation.pointLabel) ?? asString(operation.newLabel) ?? 'P',
      color: normalizeColor(operation.color, ENTITY_COLORS[count % ENTITY_COLORS.length] ?? '#D97706'),
    },
  ) as MovablePointEntity;
  movable.params.showTrajectory = showTrajectory ?? movable.params.showTrajectory;
  movable.params.showProjections = showProjections ?? movable.params.showProjections;
  useEntityStore.getState().addEntity(movable);
  useEntityStore.getState().setActiveEntityId(movable.id);
  useEntityStore.getState().setActiveTool('movable-point');
}

function executeAddConicTangentLine(operation: AiOperation): void {
  ensureCapacity();
  const entity = getConicByExplicitRef(operation.entityId, operation.label ?? operation.entityLabel, true);
  const point = conicPointForOperation(entity, operation);
  const [dx, dy] = tangentDirectionAt(entity, point.x, point.y);
  const params = lineParamsThroughPointAndDirection(point.x, point.y, dx, dy);
  const count = useEntityStore.getState().entities.length;
  const line = createLine(params, {
    label: uniqueLabel(asString(operation.lineLabel) ?? '切线'),
    color: normalizeColor(operation.color, ENTITY_COLORS[count % ENTITY_COLORS.length] ?? '#2563EB'),
  });
  useEntityStore.getState().addEntity(line);
  useEntityStore.getState().setActiveEntityId(line.id);
}

function executeAddConicNormalLine(operation: AiOperation): void {
  ensureCapacity();
  const entity = getConicByExplicitRef(operation.entityId, operation.label ?? operation.entityLabel, true);
  const point = conicPointForOperation(entity, operation);
  const [dx, dy] = tangentDirectionAt(entity, point.x, point.y);
  const params = lineParamsThroughPointAndDirection(point.x, point.y, -dy, dx);
  const count = useEntityStore.getState().entities.length;
  const line = createLine(params, {
    label: uniqueLabel(asString(operation.lineLabel) ?? '法线'),
    color: normalizeColor(operation.color, ENTITY_COLORS[count % ENTITY_COLORS.length] ?? '#7C3AED'),
  });
  useEntityStore.getState().addEntity(line);
  useEntityStore.getState().setActiveEntityId(line.id);
}

function executeOperation(operation: AiOperation): void {
  switch (operation.type) {
    case 'addConic':
      executeAddConic(operation);
      return;
    case 'updateConicParams':
      executeUpdateConicParams(operation);
      return;
    case 'addLine':
      executeAddLine(operation);
      return;
    case 'updateLine':
      executeUpdateLine(operation);
      return;
    case 'addImplicitCurve':
      executeAddImplicitCurve(operation);
      return;
    case 'updateImplicitCurve':
      executeUpdateImplicitCurve(operation);
      return;
    case 'setDisplayOptions':
      executeSetDisplayOptions(operation);
      return;
    case 'setViewport':
      executeSetViewport(operation);
      return;
    case 'setActiveEntity':
      executeSetActiveEntity(operation);
      return;
    case 'setEntityStyle':
      executeSetEntityStyle(operation);
      return;
    case 'loadPresetConicScene':
      executeLoadPresetConicScene(operation);
      return;
    case 'setLocusDemo':
      executeSetLocusDemo(operation);
      return;
    case 'setOpticalDemo':
      executeSetOpticalDemo(operation);
      return;
    case 'pinConicPoint':
      executePinConicPoint(operation);
      return;
    case 'pinLineConicIntersections':
      executePinLineConicIntersections(operation);
      return;
    case 'addMovablePoint':
      executeAddMovablePoint(operation);
      return;
    case 'addConicTangentLine':
      executeAddConicTangentLine(operation);
      return;
    case 'addConicNormalLine':
      executeAddConicNormalLine(operation);
      return;
    default:
      throw new Error(`不支持的 M03 operation: ${String(operation.type)}`);
  }
}

export async function applyM03AiOperations(input: unknown): Promise<M03BridgeOperationResult> {
  if (!Array.isArray(input)) {
    return { ok: false, errors: ['operations 必须是数组'], applied: 0 };
  }
  const operations = input as AiOperation[];
  const before = cloneM03State();
  const baseUndoStack = [...useHistoryStore.getState().undoStack];
  const errors: string[] = [];
  let applied = 0;

  try {
    for (const operation of operations) {
      if (!isRecord(operation) || typeof operation.type !== 'string') {
        throw new Error('operation 必须包含 type');
      }
      executeOperation(operation);
      applied += 1;
    }
    const after = cloneM03State();
    replacePipelineHistory(before, after, baseUndoStack);
    return { ok: true, errors: [], applied };
  } catch (error) {
    loadM03State(before);
    useHistoryStore.setState({
      undoStack: baseUndoStack,
      redoStack: [],
      canUndo: baseUndoStack.length > 0,
      canRedo: false,
    });
    errors.push(error instanceof Error ? error.message : 'M03 operation 执行失败');
    return { ok: false, errors, applied, rolledBack: true };
  }
}
