import type { Tool, ToolPointerEvent } from './types';
import type { Entity, PointProperties, AngleMeasurementProperties, GeometryProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useHistoryStore } from '../store/historyStore';
import { useToolStore } from '../store/toolStore';
import type { ToolStep } from '../store/toolStore';
import { CreateEntityCommand } from '../commands/createEntity';
import { buildGeometry } from '@/engine/builders';
import type { Vec3 } from '@/engine/types';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import {
  calculateDihedralAngle,
  calculateLineFaceAngle,
  calculateLineLineAngle,
} from '@/engine/math/angleCalculator';

/**
 * AngleTool — 角度度量工具（统一两步交互）
 *
 * 步骤1：选择第一条线段或面
 * 步骤2：选择第二条线段或面
 *
 * 组合结果：
 *   线段 + 线段 → 线线角
 *   线段 + 面   → 线面角
 *   面   + 线段 → 线面角（自动交换顺序）
 *   面   + 面   → 二面角（需要共享棱，否则提示错误）
 */

const STEP_LABELS = ['选择线段或面', '选择第二条线段或面'];

let firstEntityId: string | null = null;
let firstEntityType: 'segment' | 'face' | null = null;
let pendingSelectedIds: string[] = [];

function buildSteps(activeIdx: number): ToolStep[] {
  return STEP_LABELS.map((label, i) => ({
    label,
    status: i < activeIdx ? 'done' as const : i === activeIdx ? 'active' as const : 'pending' as const,
  }));
}

function resetState() {
  firstEntityId = null;
  firstEntityType = null;
  const toolStore = useToolStore.getState();
  toolStore.setToolStepInfo(null);
  toolStore.setToolSteps(null);
  if (pendingSelectedIds.length > 0) {
    useSelectionStore.getState().clear();
    pendingSelectedIds = [];
  }
}

function setStep(idx: number) {
  useToolStore.getState().setToolSteps(buildSteps(idx));
}

function addPendingSelection(entityId: string) {
  pendingSelectedIds.push(entityId);
  useSelectionStore.getState().addToSelection(entityId);
}

function showNotification(message: string) {
  import('@/components/scene/notificationStore').then(({ useNotificationStore }) => {
    useNotificationStore.getState().show(message);
  });
}

// ─── 辅助函数 ───

function getSegmentEndpoints(segment: Entity<'segment'>): { start: Vec3; end: Vec3 } | null {
  const entityStore = useEntityStore.getState();
  const props = segment.properties;

  const startEntity = entityStore.getEntity(props.startPointId);
  const endEntity = entityStore.getEntity(props.endPointId);
  if (!startEntity || !endEntity) return null;
  if (startEntity.type !== 'point' || endEntity.type !== 'point') return null;

  const geometryEntity = entityStore.getEntity(props.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;

  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!result) return null;

  const startPos = computePointPosition(startEntity.properties as PointProperties, result);
  const endPos = computePointPosition(endEntity.properties as PointProperties, result);
  if (!startPos || !endPos) return null;
  return { start: startPos, end: endPos };
}

function getFacePointPositions(face: Entity<'face'>): Vec3[] | null {
  const entityStore = useEntityStore.getState();
  const faceProps = face.properties;

  const geometryEntity = entityStore.getEntity(faceProps.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;

  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!result) return null;

  const positions: Vec3[] = [];
  for (const pointId of faceProps.pointIds) {
    const pointEntity = entityStore.getEntity(pointId);
    if (!pointEntity || pointEntity.type !== 'point') return null;
    const pos = computePointPosition(pointEntity.properties as PointProperties, result);
    if (!pos) return null;
    positions.push(pos);
  }
  return positions;
}

/**
 * 查找两个面共享的棱线（两端点都在两个面的 pointIds 中）
 */
function findSharedEdge(face1: Entity<'face'>, face2: Entity<'face'>): Entity<'segment'> | null {
  const entityStore = useEntityStore.getState();
  const f1Points = face1.properties.pointIds;
  const f2Points = face2.properties.pointIds;

  // 找两个面共享的点
  const sharedPointIds = f1Points.filter((pid: string) => f2Points.includes(pid));
  if (sharedPointIds.length < 2) return null;

  // 在所有 segment 中找两端点都在 sharedPointIds 中的
  const segments = entityStore.getEntitiesByType('segment');
  for (const seg of segments) {
    const { startPointId, endPointId } = seg.properties;
    if (sharedPointIds.includes(startPointId) && sharedPointIds.includes(endPointId)) {
      return seg;
    }
  }
  return null;
}

// ─── 角度创建 ───

function createAngle(
  id1: string, type1: 'segment' | 'face',
  id2: string, type2: 'segment' | 'face',
): boolean {
  const entityStore = useEntityStore.getState();

  if (type1 === 'segment' && type2 === 'segment') {
    return createLineLineAngle(
      entityStore.getEntity(id1) as Entity<'segment'>,
      entityStore.getEntity(id2) as Entity<'segment'>,
    );
  }

  if (type1 === 'segment' && type2 === 'face') {
    return createLineFaceAngle(
      entityStore.getEntity(id1) as Entity<'segment'>,
      entityStore.getEntity(id2) as Entity<'face'>,
    );
  }

  if (type1 === 'face' && type2 === 'segment') {
    // 交换顺序：线段在前
    return createLineFaceAngle(
      entityStore.getEntity(id2) as Entity<'segment'>,
      entityStore.getEntity(id1) as Entity<'face'>,
    );
  }

  if (type1 === 'face' && type2 === 'face') {
    return createDihedralAngle(
      entityStore.getEntity(id1) as Entity<'face'>,
      entityStore.getEntity(id2) as Entity<'face'>,
    );
  }

  return false;
}

function createDihedralAngle(face1: Entity<'face'>, face2: Entity<'face'>): boolean {
  const sharedEdge = findSharedEdge(face1, face2);
  if (!sharedEdge) {
    showNotification('这两个面没有公共棱，无法计算二面角');
    return false;
  }

  const edgeEndpoints = getSegmentEndpoints(sharedEdge);
  if (!edgeEndpoints) return false;

  const face1Points = getFacePointPositions(face1);
  const face2Points = getFacePointPositions(face2);
  if (!face1Points || !face2Points) return false;

  const angleResult = calculateDihedralAngle(edgeEndpoints.start, edgeEndpoints.end, face1Points, face2Points);

  const props: AngleMeasurementProperties = {
    geometryId: face1.properties.geometryId,
    kind: 'dihedral',
    entityIds: [face1.id, face2.id],
    angleRadians: angleResult.radians,
    angleLatex: angleResult.latex,
    angleDegrees: angleResult.degrees,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('angleMeasurement', props));
  return true;
}

function createLineFaceAngle(segment: Entity<'segment'>, face: Entity<'face'>): boolean {
  const endpoints = getSegmentEndpoints(segment);
  if (!endpoints) return false;

  const facePoints = getFacePointPositions(face);
  if (!facePoints) return false;

  const angleResult = calculateLineFaceAngle(endpoints.start, endpoints.end, facePoints);

  const props: AngleMeasurementProperties = {
    geometryId: segment.properties.geometryId,
    kind: 'lineFace',
    entityIds: [segment.id, face.id],
    angleRadians: angleResult.radians,
    angleLatex: angleResult.latex,
    angleDegrees: angleResult.degrees,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('angleMeasurement', props));
  return true;
}

function createLineLineAngle(seg1: Entity<'segment'>, seg2: Entity<'segment'>): boolean {
  const ep1 = getSegmentEndpoints(seg1);
  const ep2 = getSegmentEndpoints(seg2);
  if (!ep1 || !ep2) return false;

  const angleResult = calculateLineLineAngle(ep1.start, ep1.end, ep2.start, ep2.end);

  const props: AngleMeasurementProperties = {
    geometryId: seg1.properties.geometryId,
    kind: 'lineLine',
    entityIds: [seg1.id, seg2.id],
    angleRadians: angleResult.radians,
    angleLatex: angleResult.latex,
    angleDegrees: angleResult.degrees,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('angleMeasurement', props));
  return true;
}

// ─── Tool 定义 ───

export const angleTool: Tool = {
  id: 'angle',
  label: '角度',

  onActivate() {
    resetState();
    setStep(0);
  },

  onDeactivate() {
    resetState();
  },

  onPointerDown(event: ToolPointerEvent) {
    if (!event.hitEntityId) return;

    // 只接受线段和面
    if (event.hitEntityType !== 'segment' && event.hitEntityType !== 'face') return;

    const hitType = event.hitEntityType as 'segment' | 'face';

    if (!firstEntityId) {
      // 步骤1：选择第一个元素
      firstEntityId = event.hitEntityId;
      firstEntityType = hitType;
      addPendingSelection(event.hitEntityId);
      setStep(1);
    } else {
      // 步骤2：选择第二个元素
      if (event.hitEntityId === firstEntityId) return; // 不选同一个

      const success = createAngle(firstEntityId, firstEntityType!, event.hitEntityId, hitType);

      if (success) {
        resetState();
        useToolStore.getState().setActiveTool('select');
      } else {
        // 创建失败（如两面无公共棱） → 重置第二步，让用户重选
        // 保留第一步选中状态
        setStep(1);
      }
    }
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      resetState();
      useToolStore.getState().setActiveTool('select');
    } else if (event.key === 'Backspace') {
      if (firstEntityId) {
        // 撤销第一步
        firstEntityId = null;
        firstEntityType = null;
        pendingSelectedIds = [];
        useSelectionStore.getState().clear();
        setStep(0);
      }
    }
  },
};
