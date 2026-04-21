import type { Tool, ToolPointerEvent } from './types';
import type { Entity, PointProperties, DistanceMeasurementProperties, GeometryProperties } from '../entities/types';
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
  calculatePointPointDistance,
  calculatePointLineDistance,
  calculatePointFaceDistance,
  calculateLineLineDistance,
  calculateLineFaceDistance,
} from '@/engine/math/distanceCalculator';

/**
 * DistanceTool — 距离度量工具（两步交互）
 *
 * 步骤1：选择点或线段
 * 步骤2：
 *   - 选了点 → 点击面 → 点面距离
 *   - 选了线段 → 点击另一条线段 → 线线距离
 */

const STEP_LABELS_POINT = ['选择点或线段', '点击点/线段/面测量距离'];
const STEP_LABELS_SEGMENT = ['选择点或线段', '点击线段/面测量距离'];

let firstEntityId: string | null = null;
let firstEntityType: 'point' | 'segment' | null = null;
let pendingSelectedIds: string[] = [];

function buildSteps(labels: string[], activeIdx: number): ToolStep[] {
  return labels.map((label, i) => ({
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

function setStep(activeIdx: number) {
  const labels = firstEntityType === 'segment' ? STEP_LABELS_SEGMENT :
    firstEntityType === 'point' ? STEP_LABELS_POINT :
    ['选择点或线段', '选择第二个元素'];
  useToolStore.getState().setToolSteps(buildSteps(labels, activeIdx));
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

function getPointPosition(pointEntity: Entity<'point'>): Vec3 | null {
  const entityStore = useEntityStore.getState();
  const geometryEntity = entityStore.getEntity(pointEntity.properties.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;

  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!result) return null;

  return computePointPosition(pointEntity.properties, result);
}

function getFacePointPositions(face: Entity<'face'>): Vec3[] | null {
  const entityStore = useEntityStore.getState();
  const geometryEntity = entityStore.getEntity(face.properties.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;

  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!result) return null;

  const positions: Vec3[] = [];
  for (const pointId of face.properties.pointIds) {
    const pointEntity = entityStore.getEntity(pointId);
    if (!pointEntity || pointEntity.type !== 'point') return null;
    const pos = computePointPosition(pointEntity.properties as PointProperties, result);
    if (!pos) return null;
    positions.push(pos);
  }
  return positions;
}

// ─── 距离创建 ───

function createPointPointDistance(pointId1: string, pointId2: string): boolean {
  const entityStore = useEntityStore.getState();
  const p1 = entityStore.getEntity(pointId1);
  const p2 = entityStore.getEntity(pointId2);
  if (!p1 || p1.type !== 'point' || !p2 || p2.type !== 'point') return false;

  const pos1 = getPointPosition(p1 as Entity<'point'>);
  const pos2 = getPointPosition(p2 as Entity<'point'>);
  if (!pos1 || !pos2) return false;

  const result = calculatePointPointDistance(pos1, pos2);

  const props: DistanceMeasurementProperties = {
    geometryId: (p1.properties as PointProperties).geometryId,
    kind: 'pointPoint',
    entityIds: [pointId1, pointId2],
    distanceValue: result.value,
    distanceLatex: result.latex,
    distanceApprox: result.approxStr,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('distanceMeasurement', props));
  return true;
}

function createPointLineDistance(pointId: string, segId: string): boolean {
  const entityStore = useEntityStore.getState();
  const pointEntity = entityStore.getEntity(pointId);
  const segEntity = entityStore.getEntity(segId);
  if (!pointEntity || pointEntity.type !== 'point') return false;
  if (!segEntity || segEntity.type !== 'segment') return false;

  const pointPos = getPointPosition(pointEntity as Entity<'point'>);
  const ep = getSegmentEndpoints(segEntity as Entity<'segment'>);
  if (!pointPos || !ep) return false;

  const result = calculatePointLineDistance(pointPos, ep.start, ep.end);

  const props: DistanceMeasurementProperties = {
    geometryId: (pointEntity.properties as PointProperties).geometryId,
    kind: 'pointLine',
    entityIds: [pointId, segId],
    distanceValue: result.value,
    distanceLatex: result.latex,
    distanceApprox: result.approxStr,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('distanceMeasurement', props));
  return true;
}

function createLineFaceDistance(segId: string, faceId: string): boolean {
  const entityStore = useEntityStore.getState();
  const segEntity = entityStore.getEntity(segId);
  const faceEntity = entityStore.getEntity(faceId);
  if (!segEntity || segEntity.type !== 'segment') return false;
  if (!faceEntity || faceEntity.type !== 'face') return false;

  const ep = getSegmentEndpoints(segEntity as Entity<'segment'>);
  const facePoints = getFacePointPositions(faceEntity as Entity<'face'>);
  if (!ep || !facePoints || facePoints.length < 3) return false;

  const result = calculateLineFaceDistance(ep.start, ep.end, facePoints);

  if (result.value === 0) {
    showNotification('线段与面不平行，无法测量线面距离');
    return false;
  }

  const props: DistanceMeasurementProperties = {
    geometryId: (segEntity as Entity<'segment'>).properties.geometryId,
    kind: 'lineFace',
    entityIds: [segId, faceId],
    distanceValue: result.value,
    distanceLatex: result.latex,
    distanceApprox: result.approxStr,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('distanceMeasurement', props));
  return true;
}

function createPointFaceDistance(pointId: string, faceId: string): boolean {
  const entityStore = useEntityStore.getState();
  const pointEntity = entityStore.getEntity(pointId);
  const faceEntity = entityStore.getEntity(faceId);
  if (!pointEntity || pointEntity.type !== 'point') return false;
  if (!faceEntity || faceEntity.type !== 'face') return false;

  const pointPos = getPointPosition(pointEntity as Entity<'point'>);
  const facePoints = getFacePointPositions(faceEntity as Entity<'face'>);
  if (!pointPos || !facePoints || facePoints.length < 3) return false;

  const result = calculatePointFaceDistance(pointPos, facePoints);

  const props: DistanceMeasurementProperties = {
    geometryId: (pointEntity.properties as PointProperties).geometryId,
    kind: 'pointFace',
    entityIds: [pointId, faceId],
    distanceValue: result.value,
    distanceLatex: result.latex,
    distanceApprox: result.approxStr,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('distanceMeasurement', props));
  return true;
}

function createLineLineDistance(segId1: string, segId2: string): boolean {
  const entityStore = useEntityStore.getState();
  const seg1 = entityStore.getEntity(segId1);
  const seg2 = entityStore.getEntity(segId2);
  if (!seg1 || seg1.type !== 'segment') return false;
  if (!seg2 || seg2.type !== 'segment') return false;

  const ep1 = getSegmentEndpoints(seg1 as Entity<'segment'>);
  const ep2 = getSegmentEndpoints(seg2 as Entity<'segment'>);
  if (!ep1 || !ep2) return false;

  const result = calculateLineLineDistance(ep1.start, ep1.end, ep2.start, ep2.end);

  const props: DistanceMeasurementProperties = {
    geometryId: (seg1 as Entity<'segment'>).properties.geometryId,
    kind: 'lineLine',
    entityIds: [segId1, segId2],
    distanceValue: result.value,
    distanceLatex: result.latex,
    distanceApprox: result.approxStr,
  };

  useHistoryStore.getState().execute(new CreateEntityCommand('distanceMeasurement', props));
  return true;
}

// ─── Tool 定义 ───

export const distanceTool: Tool = {
  id: 'distance',
  label: '距离',

  onActivate() {
    resetState();
    setStep(0);
  },

  onDeactivate() {
    resetState();
  },

  onPointerDown(event: ToolPointerEvent) {
    if (!event.hitEntityId) return;

    if (!firstEntityId) {
      // 步骤1：选第一个元素（点或线段）
      if (event.hitEntityType === 'point') {
        firstEntityId = event.hitEntityId;
        firstEntityType = 'point';
        addPendingSelection(event.hitEntityId);
        setStep(1);
      } else if (event.hitEntityType === 'segment') {
        firstEntityId = event.hitEntityId;
        firstEntityType = 'segment';
        addPendingSelection(event.hitEntityId);
        setStep(1);
      }
    } else {
      // 步骤2
      if (event.hitEntityId === firstEntityId) return;

      let success = false;
      let tried = false;

      if (firstEntityType === 'point') {
        if (event.hitEntityType === 'point') {
          tried = true;
          success = createPointPointDistance(firstEntityId, event.hitEntityId);
        } else if (event.hitEntityType === 'segment') {
          tried = true;
          success = createPointLineDistance(firstEntityId, event.hitEntityId);
        } else if (event.hitEntityType === 'face') {
          tried = true;
          success = createPointFaceDistance(firstEntityId, event.hitEntityId);
        }
      } else if (firstEntityType === 'segment') {
        if (event.hitEntityType === 'segment') {
          tried = true;
          success = createLineLineDistance(firstEntityId, event.hitEntityId);
        } else if (event.hitEntityType === 'face') {
          tried = true;
          success = createLineFaceDistance(firstEntityId, event.hitEntityId);
        }
      }

      if (tried && success) {
        resetState();
        useToolStore.getState().setActiveTool('select');
      } else if (tried) {
        showNotification('距离计算失败');
        setStep(1);
      } else {
        if (firstEntityType === 'point') {
          showNotification('请选择点、线段或面来测量距离');
        } else {
          showNotification('请选择线段或面来测量距离');
        }
      }
    }
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      resetState();
      useToolStore.getState().setActiveTool('select');
    } else if (event.key === 'Backspace') {
      if (firstEntityId) {
        firstEntityId = null;
        firstEntityType = null;
        pendingSelectedIds = [];
        useSelectionStore.getState().clear();
        setStep(0);
      }
    }
  },
};
