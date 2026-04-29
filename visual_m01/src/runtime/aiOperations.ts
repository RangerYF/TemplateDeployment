import { buildGeometry } from '@/engine/builders';
import { createCrossSectionFromPoints } from '@/editor/crossSectionHelper';
import {
  calculateDihedralAngle,
  calculateLineFaceAngle,
  calculateLineLineAngle,
} from '@/engine/math/angleCalculator';
import {
  calculateLineFaceDistance,
  calculateLineLineDistance,
  calculatePointFaceDistance,
  calculatePointLineDistance,
  calculatePointPointDistance,
} from '@/engine/math/distanceCalculator';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import type { Vec3 } from '@/engine/types';
import {
  ChangeGeometryTypeCommand,
  CreateEntityCommand,
  RenameEntityCommand,
  UpdateGeometryParamsCommand,
  UpdatePropertiesCommand,
} from '@/editor/commands';
import type { Command } from '@/editor/commands';
import type {
  Entity,
  AngleMeasurementProperties,
  DistanceMeasurementProperties,
  GeometryProperties,
  FaceProperties,
  PointProperties,
  SegmentProperties,
} from '@/editor/entities/types';
import { initEditorWithSnapshot, resetEditor } from '@/editor/init';
import { useEntityStore } from '@/editor/store/entityStore';
import { useHistoryStore } from '@/editor/store/historyStore';
import { loadSceneData } from '@/data/projects';
import { DEFAULT_PARAMS, GEOMETRY_LIST, type GeometryParams, type GeometryType } from '@/types/geometry';

export interface BridgeOperationResult {
  ok: boolean;
  errors: string[];
  applied: number;
  rolledBack?: boolean;
}

type AiOperation = Record<string, unknown> & { type?: unknown };
type EntitySnapshot = ReturnType<ReturnType<typeof useEntityStore.getState>['getSnapshot']>;

const GEOMETRY_TYPES = new Set<GeometryType>(GEOMETRY_LIST.map((item) => item.type));
const MAX_HISTORY = 50;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString).filter((item): item is string => Boolean(item)) : [];
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function cloneSnapshot(): EntitySnapshot {
  return structuredClone(useEntityStore.getState().getSnapshot());
}

function createSnapshotCommand(before: EntitySnapshot, after: EntitySnapshot): Command {
  return {
    type: 'aiPipeline',
    label: 'AI 构图',
    execute() {
      useEntityStore.getState().loadSnapshot(after);
    },
    undo() {
      useEntityStore.getState().loadSnapshot(before);
    },
  };
}

function replacePipelineHistory(
  before: EntitySnapshot,
  after: EntitySnapshot,
  baseUndoStack: Command[],
): void {
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

function normalizeGeometryType(value: unknown): GeometryType | null {
  if (typeof value !== 'string') return null;
  return GEOMETRY_TYPES.has(value as GeometryType) ? value as GeometryType : null;
}

function createVisibilityCommand(entityIds: string[], visible: boolean): Command {
  const before = useEntityStore.getState().getSnapshot();
  const after = {
    ...before,
    entities: { ...before.entities },
  };

  for (const id of entityIds) {
    const entity = after.entities[id];
    if (entity) {
      after.entities[id] = { ...entity, visible };
    }
  }

  return {
    type: 'setVisible',
    label: '设置显示状态',
    execute() {
      useEntityStore.getState().loadSnapshot(after);
    },
    undo() {
      useEntityStore.getState().loadSnapshot(before);
    },
  };
}

function getActiveGeometryOrThrow(): Entity<'geometry'> {
  const geometry = useEntityStore.getState().getActiveGeometry();
  if (!geometry) {
    throw new Error('当前场景没有主几何体');
  }
  return geometry;
}

function findPointByLabelOrThrow(label: string): Entity<'point'> {
  const point = useEntityStore.getState().findPointByLabel(label);
  if (point) return point;
  throw new Error(`未找到点 ${label}`);
}

function findSegmentByLabelsOrThrow(labels: string[]): Entity<'segment'> {
  if (labels.length !== 2) {
    throw new Error('线段操作需要 2 个点名');
  }
  const pointA = findPointByLabelOrThrow(labels[0]);
  const pointB = findPointByLabelOrThrow(labels[1]);
  const segment = useEntityStore.getState().findSegmentByPoints(pointA.id, pointB.id);
  if (!segment) {
    throw new Error(`未找到线段 ${labels.join('')}`);
  }
  return segment;
}

function findFaceByLabelsOrThrow(labels: string[]): Entity<'face'> {
  if (labels.length < 3) {
    throw new Error('面操作至少需要 3 个点名');
  }
  const points = labels.map(findPointByLabelOrThrow);
  const pointIds = new Set(points.map((point) => point.id));
  const faces = useEntityStore.getState().getEntitiesByType('face');
  const face = faces.find((item) => {
    const ids = (item.properties as FaceProperties).pointIds;
    return ids.length === pointIds.size && ids.every((id) => pointIds.has(id));
  });
  if (!face) {
    throw new Error(`未找到由 ${labels.join('、')} 构成的面`);
  }
  return face;
}

function getGeometryBuildResult(geometryId: string) {
  const geometry = useEntityStore.getState().getEntity(geometryId);
  if (!geometry || geometry.type !== 'geometry') {
    throw new Error('未找到几何体');
  }
  const props = geometry.properties as GeometryProperties;
  const result = buildGeometry(props.geometryType, props.params as never);
  if (!result) {
    throw new Error('几何体无法计算');
  }
  return result;
}

function getPointPositionOrThrow(point: Entity<'point'>): Vec3 {
  const result = getGeometryBuildResult((point.properties as PointProperties).geometryId);
  const position = computePointPosition(point.properties as PointProperties, result);
  if (!position) {
    throw new Error(`无法计算点 ${(point.properties as PointProperties).label} 的位置`);
  }
  return position;
}

function getSegmentEndpointsOrThrow(segment: Entity<'segment'>): { start: Vec3; end: Vec3 } {
  const props = segment.properties as SegmentProperties;
  const start = useEntityStore.getState().getEntity(props.startPointId);
  const end = useEntityStore.getState().getEntity(props.endPointId);
  if (!start || start.type !== 'point' || !end || end.type !== 'point') {
    throw new Error('线段缺少端点');
  }
  return {
    start: getPointPositionOrThrow(start as Entity<'point'>),
    end: getPointPositionOrThrow(end as Entity<'point'>),
  };
}

function getFacePointPositionsOrThrow(face: Entity<'face'>): Vec3[] {
  const positions: Vec3[] = [];
  for (const pointId of (face.properties as FaceProperties).pointIds) {
    const point = useEntityStore.getState().getEntity(pointId);
    if (!point || point.type !== 'point') {
      throw new Error('面缺少顶点');
    }
    positions.push(getPointPositionOrThrow(point as Entity<'point'>));
  }
  if (positions.length < 3) {
    throw new Error('面至少需要 3 个顶点');
  }
  return positions;
}

function resolveSegmentFromOperation(operation: AiOperation, labels: string[], offset = 0): Entity<'segment'> {
  const entityIds = asStringArray(operation.entityIds);
  if (entityIds[offset]) {
    const entity = useEntityStore.getState().getEntity(entityIds[offset]);
    if (entity?.type === 'segment') return entity as Entity<'segment'>;
  }
  return findSegmentByLabelsOrThrow(labels.slice(offset * 2, offset * 2 + 2));
}

function resolveFaceFromOperation(operation: AiOperation, labels: string[], offset = 0): Entity<'face'> {
  const entityIds = asStringArray(operation.entityIds);
  if (entityIds[offset]) {
    const entity = useEntityStore.getState().getEntity(entityIds[offset]);
    if (entity?.type === 'face') return entity as Entity<'face'>;
  }
  const faceLabels = Array.isArray(operation.faceLabels)
    ? asStringArray(operation.faceLabels)
    : labels.slice(offset);
  return findFaceByLabelsOrThrow(faceLabels);
}

function executeSetGeometry(operation: AiOperation): void {
  const geometryType = normalizeGeometryType(operation.geometryType);
  if (!geometryType) {
    throw new Error('setGeometry 缺少合法 geometryType');
  }

  const params = {
    ...DEFAULT_PARAMS[geometryType],
    ...(isRecord(operation.params) ? operation.params : {}),
  } as GeometryParams[typeof geometryType];
  const builderResult = buildGeometry(geometryType, params);
  if (!builderResult) {
    throw new Error(`暂不支持构建几何体：${geometryType}`);
  }

  const store = useEntityStore.getState();
  const existingGeometry = store.getActiveGeometry();
  if (!existingGeometry) {
    resetEditor();
    const geometry = useEntityStore.getState().createEntity('geometry', {
      geometryType,
      params,
    } as GeometryProperties);
    useEntityStore.getState().setActiveGeometryId(geometry.id);
    useEntityStore.getState().createBuiltInEntities(geometry.id, builderResult);
    return;
  }

  useHistoryStore.getState().execute(
    new ChangeGeometryTypeCommand(existingGeometry.id, geometryType, params, builderResult),
  );
}

function executeUpdateGeometryParams(operation: AiOperation): void {
  const geometry = getActiveGeometryOrThrow();
  const props = geometry.properties as GeometryProperties;
  const paramsPatch = isRecord(operation.params) ? operation.params : {};
  const nextParams = { ...props.params, ...paramsPatch } as GeometryProperties['params'];
  const builderResult = buildGeometry(props.geometryType, nextParams as never);
  if (!builderResult) {
    throw new Error('几何体参数无效，无法重建模型');
  }

  const oldBuiltIn = useEntityStore.getState().getBuiltInEntities(geometry.id);
  useHistoryStore.getState().execute(
    new UpdateGeometryParamsCommand(
      geometry.id,
      props.params,
      nextParams,
      true,
      oldBuiltIn,
      builderResult,
    ),
  );
}

async function executeLoadPresetScene(operation: AiOperation): Promise<void> {
  const presetId = asString(operation.presetId);
  if (!presetId) {
    throw new Error('loadPresetScene 缺少 presetId');
  }
  const sceneData = await loadSceneData(presetId);
  if (!sceneData) {
    throw new Error(`未找到预置场景：${presetId}`);
  }
  resetEditor();
  initEditorWithSnapshot(sceneData);
}

function executeAddSegmentByLabels(operation: AiOperation): void {
  const labels = asStringArray(operation.labels);
  if (labels.length !== 2) {
    throw new Error('addSegmentByLabels 需要 2 个点名');
  }
  const pointA = findPointByLabelOrThrow(labels[0]);
  const pointB = findPointByLabelOrThrow(labels[1]);
  const existing = useEntityStore.getState().findSegmentByPoints(pointA.id, pointB.id);
  if (existing) return;

  const geometryId = (pointA.properties as PointProperties).geometryId;
  const style = isRecord(operation.style) ? operation.style : {};
  useHistoryStore.getState().execute(
    new CreateEntityCommand('segment', {
      builtIn: false,
      geometryId,
      startPointId: pointA.id,
      endPointId: pointB.id,
      style: {
        color: typeof style.color === 'string' ? style.color : '#ff0000',
        dashed: typeof style.dashed === 'boolean' ? style.dashed : false,
      },
      label: asString(operation.label) ?? undefined,
    }),
  );
}

function executeAddPointOnEdge(operation: AiOperation): void {
  const labels = asStringArray(operation.edgeLabels);
  if (labels.length !== 2) {
    throw new Error('addPointOnEdge 需要 edgeLabels 指定 2 个端点');
  }

  const pointA = findPointByLabelOrThrow(labels[0]);
  const pointB = findPointByLabelOrThrow(labels[1]);
  const propsA = pointA.properties as PointProperties;
  const propsB = pointB.properties as PointProperties;
  if (propsA.constraint.type !== 'vertex' || propsB.constraint.type !== 'vertex') {
    throw new Error('addPointOnEdge 暂只支持在几何体顶点之间取点');
  }
  if (propsA.geometryId !== propsB.geometryId) {
    throw new Error('两个端点不属于同一个几何体');
  }

  const t = Math.max(0, Math.min(1, asNumber(operation.t, 0.5)));
  const existing = useEntityStore.getState().findPointOnEdge(
    propsA.geometryId,
    propsA.constraint.vertexIndex,
    propsB.constraint.vertexIndex,
    t,
  );
  if (existing) return;

  useHistoryStore.getState().execute(
    new CreateEntityCommand('point', {
      builtIn: false,
      geometryId: propsA.geometryId,
      constraint: {
        type: 'edge',
        edgeStart: propsA.constraint.vertexIndex,
        edgeEnd: propsB.constraint.vertexIndex,
        t,
      },
      label: asString(operation.label) ?? 'P',
    }),
  );
}

function executeAddMidpointByLabels(operation: AiOperation): void {
  const labels = asStringArray(operation.labels);
  if (labels.length !== 2) {
    throw new Error('addMidpointByLabels 需要 2 个点名');
  }

  const pointA = findPointByLabelOrThrow(labels[0]);
  const pointB = findPointByLabelOrThrow(labels[1]);
  const propsA = pointA.properties as PointProperties;
  const propsB = pointB.properties as PointProperties;
  const label = asString(operation.label) ?? 'M';

  if (useEntityStore.getState().findPointByLabel(label)) return;

  if (
    propsA.constraint.type === 'vertex'
    && propsB.constraint.type === 'vertex'
    && propsA.geometryId === propsB.geometryId
  ) {
    const existing = useEntityStore.getState().findPointOnEdge(
      propsA.geometryId,
      propsA.constraint.vertexIndex,
      propsB.constraint.vertexIndex,
      0.5,
    );
    if (existing) return;

    useHistoryStore.getState().execute(
      new CreateEntityCommand('point', {
        builtIn: false,
        geometryId: propsA.geometryId,
        constraint: {
          type: 'edge',
          edgeStart: propsA.constraint.vertexIndex,
          edgeEnd: propsB.constraint.vertexIndex,
          t: 0.5,
        },
        label,
      }),
    );
    return;
  }

  if (propsA.geometryId !== propsB.geometryId) {
    throw new Error('两个点不属于同一个几何体');
  }

  const posA = getPointPositionOrThrow(pointA);
  const posB = getPointPositionOrThrow(pointB);
  useHistoryStore.getState().execute(
    new CreateEntityCommand('point', {
      builtIn: false,
      geometryId: propsA.geometryId,
      constraint: {
        type: 'free',
        position: [
          (posA[0] + posB[0]) / 2,
          (posA[1] + posB[1]) / 2,
          (posA[2] + posB[2]) / 2,
        ],
      },
      label,
    }),
  );
}

function executeAddCenterPoint(operation: AiOperation): void {
  const geometry = getActiveGeometryOrThrow();
  const label = asString(operation.label) ?? 'O';
  if (useEntityStore.getState().findPointByLabel(label)) return;

  const points = useEntityStore.getState().getRelatedEntities(geometry.id)
    .filter((entity): entity is Entity<'point'> => entity.type === 'point');
  if (points.length === 0) {
    throw new Error('当前几何体没有可用于计算中心的点');
  }

  const positions = points.map(getPointPositionOrThrow);
  const center = positions.reduce<Vec3>(
    (acc, item) => [acc[0] + item[0], acc[1] + item[1], acc[2] + item[2]],
    [0, 0, 0],
  ).map((value) => value / positions.length) as Vec3;

  useHistoryStore.getState().execute(
    new CreateEntityCommand('point', {
      builtIn: false,
      geometryId: geometry.id,
      constraint: { type: 'free', position: center },
      label,
    }),
  );
}

function executeAddFaceCenterPoint(operation: AiOperation): void {
  const label = asString(operation.label) ?? 'O1';
  if (useEntityStore.getState().findPointByLabel(label)) return;

  const entityIds = asStringArray(operation.entityIds);
  const faceLabels = asStringArray(operation.faceLabels);
  const face = entityIds[0]
    ? useEntityStore.getState().getEntity(entityIds[0])
    : findFaceByLabelsOrThrow(faceLabels);

  if (!face || face.type !== 'face') {
    throw new Error('addFaceCenterPoint 需要指定一个面');
  }

  const positions = getFacePointPositionsOrThrow(face as Entity<'face'>);
  const center = positions.reduce<Vec3>(
    (acc, item) => [acc[0] + item[0], acc[1] + item[1], acc[2] + item[2]],
    [0, 0, 0],
  ).map((value) => value / positions.length) as Vec3;

  useHistoryStore.getState().execute(
    new CreateEntityCommand('point', {
      builtIn: false,
      geometryId: (face.properties as FaceProperties).geometryId,
      constraint: { type: 'free', position: center },
      label,
    }),
  );
}

function executeAddCircumsphere(): void {
  const geometry = getActiveGeometryOrThrow();
  const props = geometry.properties as GeometryProperties;
  if (props.geometryType === 'sphere') {
    throw new Error('球体本身不需要添加外接球');
  }
  const existing = useEntityStore.getState().getCircumSphere();
  if (existing) return;

  useHistoryStore.getState().execute(
    new CreateEntityCommand('circumSphere', { geometryId: geometry.id }),
  );
}

function executeAddCrossSectionByLabels(operation: AiOperation): void {
  const labels = asStringArray(operation.labels);
  if (labels.length < 3) {
    throw new Error('addCrossSectionByLabels 至少需要 3 个点名');
  }

  const points = labels.map(findPointByLabelOrThrow);
  const geometryId = (points[0].properties as PointProperties).geometryId;
  const result = createCrossSectionFromPoints(geometryId, points.map((point) => point.id));
  if (!result.success) {
    throw new Error(result.message);
  }
}

function executeAddAuxiliaryFaceByLabels(operation: AiOperation): void {
  const labels = asStringArray(operation.labels);
  if (labels.length < 3) {
    throw new Error('addAuxiliaryFaceByLabels 至少需要 3 个点名');
  }

  const points = labels.map(findPointByLabelOrThrow);
  const geometryId = (points[0].properties as PointProperties).geometryId;
  if (points.some((point) => (point.properties as PointProperties).geometryId !== geometryId)) {
    throw new Error('辅助面上的点必须属于同一个几何体');
  }

  const pointIds = points.map((point) => point.id);
  const existing = useEntityStore.getState().getEntitiesByType('face').find((face) => {
    const ids = (face.properties as FaceProperties).pointIds;
    return ids.length === pointIds.length && ids.every((id) => pointIds.includes(id));
  });
  if (existing) return;

  useHistoryStore.getState().execute(
    new CreateEntityCommand('face', {
      builtIn: false,
      geometryId,
      pointIds,
      source: { type: 'custom' },
    }),
  );
}

function executeAddDistanceMeasurement(operation: AiOperation): void {
  const kind = asString(operation.kind);
  const labels = asStringArray(operation.labels);
  const entityIds = asStringArray(operation.entityIds);
  const store = useEntityStore.getState();

  let props: DistanceMeasurementProperties | null = null;

  if (kind === 'pointPoint') {
    const p1 = entityIds[0] ? store.getEntity(entityIds[0]) : findPointByLabelOrThrow(labels[0]);
    const p2 = entityIds[1] ? store.getEntity(entityIds[1]) : findPointByLabelOrThrow(labels[1]);
    if (!p1 || p1.type !== 'point' || !p2 || p2.type !== 'point') {
      throw new Error('pointPoint 距离需要两个点');
    }
    const result = calculatePointPointDistance(
      getPointPositionOrThrow(p1 as Entity<'point'>),
      getPointPositionOrThrow(p2 as Entity<'point'>),
    );
    props = {
      geometryId: (p1.properties as PointProperties).geometryId,
      kind: 'pointPoint',
      entityIds: [p1.id, p2.id],
      distanceValue: result.value,
      distanceLatex: result.latex,
      distanceApprox: result.approxStr,
    };
  } else if (kind === 'pointLine') {
    const point = entityIds[0] ? store.getEntity(entityIds[0]) : findPointByLabelOrThrow(labels[0]);
    const segment = entityIds[1] ? store.getEntity(entityIds[1]) : findSegmentByLabelsOrThrow(labels.slice(1, 3));
    if (!point || point.type !== 'point' || !segment || segment.type !== 'segment') {
      throw new Error('pointLine 距离需要一个点和一条线段');
    }
    const endpoints = getSegmentEndpointsOrThrow(segment as Entity<'segment'>);
    const result = calculatePointLineDistance(
      getPointPositionOrThrow(point as Entity<'point'>),
      endpoints.start,
      endpoints.end,
    );
    props = {
      geometryId: (point.properties as PointProperties).geometryId,
      kind: 'pointLine',
      entityIds: [point.id, segment.id],
      distanceValue: result.value,
      distanceLatex: result.latex,
      distanceApprox: result.approxStr,
    };
  } else if (kind === 'pointFace') {
    const point = entityIds[0] ? store.getEntity(entityIds[0]) : findPointByLabelOrThrow(labels[0]);
    const face = entityIds[1] ? store.getEntity(entityIds[1]) : findFaceByLabelsOrThrow(labels.slice(1));
    if (!point || point.type !== 'point' || !face || face.type !== 'face') {
      throw new Error('pointFace 距离需要一个点和一个面');
    }
    const result = calculatePointFaceDistance(
      getPointPositionOrThrow(point as Entity<'point'>),
      getFacePointPositionsOrThrow(face as Entity<'face'>),
    );
    props = {
      geometryId: (point.properties as PointProperties).geometryId,
      kind: 'pointFace',
      entityIds: [point.id, face.id],
      distanceValue: result.value,
      distanceLatex: result.latex,
      distanceApprox: result.approxStr,
    };
  } else if (kind === 'lineLine') {
    const seg1 = entityIds[0] ? store.getEntity(entityIds[0]) : findSegmentByLabelsOrThrow(labels.slice(0, 2));
    const seg2 = entityIds[1] ? store.getEntity(entityIds[1]) : findSegmentByLabelsOrThrow(labels.slice(2, 4));
    if (!seg1 || seg1.type !== 'segment' || !seg2 || seg2.type !== 'segment') {
      throw new Error('lineLine 距离需要两条线段');
    }
    const ep1 = getSegmentEndpointsOrThrow(seg1 as Entity<'segment'>);
    const ep2 = getSegmentEndpointsOrThrow(seg2 as Entity<'segment'>);
    const result = calculateLineLineDistance(ep1.start, ep1.end, ep2.start, ep2.end);
    props = {
      geometryId: (seg1.properties as SegmentProperties).geometryId,
      kind: 'lineLine',
      entityIds: [seg1.id, seg2.id],
      distanceValue: result.value,
      distanceLatex: result.latex,
      distanceApprox: result.approxStr,
    };
  } else if (kind === 'lineFace') {
    const segment = entityIds[0] ? store.getEntity(entityIds[0]) : findSegmentByLabelsOrThrow(labels.slice(0, 2));
    const face = entityIds[1] ? store.getEntity(entityIds[1]) : findFaceByLabelsOrThrow(labels.slice(2));
    if (!segment || segment.type !== 'segment' || !face || face.type !== 'face') {
      throw new Error('lineFace 距离需要一条线段和一个面');
    }
    const endpoints = getSegmentEndpointsOrThrow(segment as Entity<'segment'>);
    const result = calculateLineFaceDistance(
      endpoints.start,
      endpoints.end,
      getFacePointPositionsOrThrow(face as Entity<'face'>),
    );
    props = {
      geometryId: (segment.properties as SegmentProperties).geometryId,
      kind: 'lineFace',
      entityIds: [segment.id, face.id],
      distanceValue: result.value,
      distanceLatex: result.latex,
      distanceApprox: result.approxStr,
    };
  } else {
    throw new Error('addDistanceMeasurement 缺少合法 kind');
  }

  useHistoryStore.getState().execute(new CreateEntityCommand('distanceMeasurement', props));
}

function executeAddAngleMeasurement(operation: AiOperation): void {
  const kind = asString(operation.kind);
  const labels = asStringArray(operation.labels);
  let props: AngleMeasurementProperties | null = null;

  if (kind === 'lineLine') {
    const seg1 = resolveSegmentFromOperation(operation, labels, 0);
    const seg2 = resolveSegmentFromOperation(operation, labels, 1);
    const ep1 = getSegmentEndpointsOrThrow(seg1);
    const ep2 = getSegmentEndpointsOrThrow(seg2);
    const result = calculateLineLineAngle(ep1.start, ep1.end, ep2.start, ep2.end);
    props = {
      geometryId: (seg1.properties as SegmentProperties).geometryId,
      kind: 'lineLine',
      entityIds: [seg1.id, seg2.id],
      angleRadians: result.radians,
      angleLatex: result.latex,
      angleDegrees: result.degrees,
    };
  } else if (kind === 'lineFace') {
    const segment = resolveSegmentFromOperation(operation, labels, 0);
    const entityIds = asStringArray(operation.entityIds);
    const entityFace = entityIds[1] ? useEntityStore.getState().getEntity(entityIds[1]) : null;
    const face = entityFace?.type === 'face'
      ? entityFace as Entity<'face'>
      : resolveFaceFromOperation(operation, labels.slice(2), 0);
    const endpoints = getSegmentEndpointsOrThrow(segment);
    const result = calculateLineFaceAngle(
      endpoints.start,
      endpoints.end,
      getFacePointPositionsOrThrow(face),
    );
    props = {
      geometryId: (segment.properties as SegmentProperties).geometryId,
      kind: 'lineFace',
      entityIds: [segment.id, face.id],
      angleRadians: result.radians,
      angleLatex: result.latex,
      angleDegrees: result.degrees,
    };
  } else if (kind === 'dihedral') {
    const entityIds = asStringArray(operation.entityIds);
    const store = useEntityStore.getState();
    const face1 = entityIds[0] ? store.getEntity(entityIds[0]) : null;
    const face2 = entityIds[1] ? store.getEntity(entityIds[1]) : null;
    if (!face1 || face1.type !== 'face' || !face2 || face2.type !== 'face') {
      throw new Error('dihedral 角度暂需要两个面 entityIds');
    }
    const sharedPointIds = (face1.properties as FaceProperties).pointIds.filter((id) =>
      (face2.properties as FaceProperties).pointIds.includes(id),
    );
    if (sharedPointIds.length < 2) {
      throw new Error('两个面没有公共棱，无法计算二面角');
    }
    const sharedSegment = useEntityStore.getState().getEntitiesByType('segment').find((segment) => {
      const props = segment.properties as SegmentProperties;
      return sharedPointIds.includes(props.startPointId) && sharedPointIds.includes(props.endPointId);
    });
    if (!sharedSegment) {
      throw new Error('未找到两个面的公共棱');
    }
    const endpoints = getSegmentEndpointsOrThrow(sharedSegment);
    const result = calculateDihedralAngle(
      endpoints.start,
      endpoints.end,
      getFacePointPositionsOrThrow(face1 as Entity<'face'>),
      getFacePointPositionsOrThrow(face2 as Entity<'face'>),
    );
    props = {
      geometryId: (face1.properties as FaceProperties).geometryId,
      kind: 'dihedral',
      entityIds: [face1.id, face2.id],
      angleRadians: result.radians,
      angleLatex: result.latex,
      angleDegrees: result.degrees,
    };
  } else {
    throw new Error('addAngleMeasurement 缺少合法 kind');
  }

  useHistoryStore.getState().execute(new CreateEntityCommand('angleMeasurement', props));
}

function executeSetStyle(operation: AiOperation): void {
  const entityIds = asStringArray(operation.entityIds);
  const labels = asStringArray(operation.labels);
  const targets: Entity<'segment'>[] = [];

  if (entityIds.length > 0) {
    for (const id of entityIds) {
      const entity = useEntityStore.getState().getEntity(id);
      if (entity?.type === 'segment') targets.push(entity as Entity<'segment'>);
    }
  } else if (labels.length === 2) {
    targets.push(findSegmentByLabelsOrThrow(labels));
  }

  if (targets.length === 0) {
    throw new Error('setStyle 未找到可设置样式的线段');
  }

  const style = isRecord(operation.style) ? operation.style : {};
  for (const segment of targets) {
    const oldProps = segment.properties as SegmentProperties;
    const nextStyle = {
      ...oldProps.style,
      ...(typeof style.color === 'string' ? { color: style.color } : {}),
      ...(typeof style.dashed === 'boolean' ? { dashed: style.dashed } : {}),
    };
    useHistoryStore.getState().execute(
      new UpdatePropertiesCommand<'segment'>(
        segment.id,
        { style: oldProps.style },
        { style: nextStyle },
        '设置线段样式',
      ),
    );
  }
}

function executeSetLabel(operation: AiOperation): void {
  const entityId = asString(operation.entityId);
  const fromLabel = asString(operation.fromLabel);
  const nextLabel = asString(operation.label);
  if (!nextLabel) {
    throw new Error('setLabel 缺少 label');
  }

  const entity = entityId
    ? useEntityStore.getState().getEntity(entityId)
    : fromLabel
      ? useEntityStore.getState().findPointByLabel(fromLabel)
      : null;
  if (!entity || !('label' in entity.properties)) {
    throw new Error('setLabel 未找到可改名实体');
  }
  const oldLabel = typeof entity.properties.label === 'string' ? entity.properties.label : '';
  useHistoryStore.getState().execute(new RenameEntityCommand(entity.id, oldLabel, nextLabel));
}

function executeSetVisible(operation: AiOperation): void {
  const entityIds = asStringArray(operation.entityIds);
  const labels = asStringArray(operation.labels);
  const visible = typeof operation.visible === 'boolean' ? operation.visible : true;
  const resolved = new Set<string>(entityIds);

  for (const label of labels) {
    const point = useEntityStore.getState().findPointByLabel(label);
    if (point) resolved.add(point.id);
  }

  if (resolved.size === 0) {
    throw new Error('setVisible 未找到目标实体');
  }
  useHistoryStore.getState().execute(createVisibilityCommand([...resolved], visible));
}

export async function applyAiOperations(operations: unknown): Promise<BridgeOperationResult> {
  const items = Array.isArray(operations) ? operations : [];
  const errors: string[] = [];
  let applied = 0;
  const before = cloneSnapshot();
  const historyBefore = useHistoryStore.getState();

  for (const item of items) {
    if (!isRecord(item)) {
      errors.push('操作必须是对象');
      useEntityStore.getState().loadSnapshot(before);
      useHistoryStore.setState({
        undoStack: historyBefore.undoStack,
        redoStack: historyBefore.redoStack,
        canUndo: historyBefore.canUndo,
        canRedo: historyBefore.canRedo,
      });
      return { ok: false, errors, applied, rolledBack: true };
    }

    try {
      switch ((item as AiOperation).type) {
        case 'setGeometry':
          executeSetGeometry(item);
          break;
        case 'updateGeometryParams':
          executeUpdateGeometryParams(item);
          break;
        case 'loadPresetScene':
          await executeLoadPresetScene(item);
          break;
        case 'addSegmentByLabels':
          executeAddSegmentByLabels(item);
          break;
        case 'addPointOnEdge':
          executeAddPointOnEdge(item);
          break;
        case 'addMidpointByLabels':
          executeAddMidpointByLabels(item);
          break;
        case 'addCenterPoint':
          executeAddCenterPoint(item);
          break;
        case 'addFaceCenterPoint':
          executeAddFaceCenterPoint(item);
          break;
        case 'addCircumsphere':
          executeAddCircumsphere();
          break;
        case 'addCrossSectionByLabels':
          executeAddCrossSectionByLabels(item);
          break;
        case 'addAuxiliaryFaceByLabels':
          executeAddAuxiliaryFaceByLabels(item);
          break;
        case 'addDistanceMeasurement':
          executeAddDistanceMeasurement(item);
          break;
        case 'addAngleMeasurement':
          executeAddAngleMeasurement(item);
          break;
        case 'setStyle':
          executeSetStyle(item);
          break;
        case 'setLabel':
          executeSetLabel(item);
          break;
        case 'setVisible':
          executeSetVisible(item);
          break;
        default:
          throw new Error(`暂不支持的操作类型：${String((item as AiOperation).type || '')}`);
      }
      applied += 1;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '操作执行失败');
      useEntityStore.getState().loadSnapshot(before);
      useHistoryStore.setState({
        undoStack: historyBefore.undoStack,
        redoStack: historyBefore.redoStack,
        canUndo: historyBefore.canUndo,
        canRedo: historyBefore.canRedo,
      });
      return {
        ok: false,
        errors,
        applied,
        rolledBack: true,
      };
    }
  }

  if (applied > 0) {
    const after = cloneSnapshot();
    replacePipelineHistory(before, after, historyBefore.undoStack);
  }

  return {
    ok: errors.length === 0,
    errors,
    applied,
  };
}
