import type { Tool, ToolPointerEvent } from './types';
import type { Entity, PointProperties, SegmentProperties, FaceProperties, GeometryProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useHistoryStore } from '../store/historyStore';
import { useToolStore } from '../store/toolStore';
import type { ToolStep } from '../store/toolStore';
import { CreateEntityCommand } from '../commands/createEntity';
import { BatchCommand } from '../commands/batch';
import { buildGeometry } from '@/engine/builders';
import type { Vec3 } from '@/engine/types';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { useNotificationStore } from '@/components/scene/notificationStore';
import {
  lineLineIntersection,
  linePlaneIntersection,
  planePlaneIntersectionLine,
  clipLineToPolyhedron,
  planeFromPoints,
} from '@/engine/math/intersectionCalculator';
import { sub } from '@/editor/crossSectionHelper';

const STEP_LABELS = ['选择线段或面', '选择第二条线段或面'];

const DEFAULT_LABELS = ['M', 'N', 'P', 'Q', 'R', 'S', 'T'];

function subscript(n: number): string {
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return String(n).split('').map((d) => subs[Number(d)]).join('');
}

function getNextPointLabel(): string {
  const entities = useEntityStore.getState().entities;
  const existing = Object.values(entities)
    .filter((e) => e.type === 'point')
    .map((e) => (e.properties as PointProperties).label);
  for (const l of DEFAULT_LABELS) {
    if (!existing.includes(l)) return l;
  }
  let i = 1;
  while (existing.includes(`M${subscript(i)}`)) i++;
  return `M${subscript(i)}`;
}

let firstEntityId: string | null = null;
let firstEntityType: 'segment' | 'face' | null = null;
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
  useToolStore.getState().setToolSteps(buildSteps(STEP_LABELS, activeIdx));
}

function addPendingSelection(entityId: string) {
  pendingSelectedIds.push(entityId);
  useSelectionStore.getState().addToSelection(entityId);
}

// ─── 辅助函数 ───

function getSegmentEndpoints(segment: Entity<'segment'>): { start: Vec3; end: Vec3 } | null {
  const entityStore = useEntityStore.getState();
  const props = segment.properties as SegmentProperties;

  if (props.startPointId && props.endPointId) {
    const startEntity = entityStore.getEntity(props.startPointId);
    const endEntity = entityStore.getEntity(props.endPointId);
    if (startEntity?.type === 'point' && endEntity?.type === 'point') {
      const geometryEntity = entityStore.getEntity(props.geometryId);
      if (!geometryEntity || geometryEntity.type !== 'geometry') return null;
      const geoProps = geometryEntity.properties as GeometryProperties;
      const result = buildGeometry(geoProps.geometryType, geoProps.params);
      if (!result) return null;
      const startPos = computePointPosition(startEntity.properties as PointProperties, result);
      const endPos = computePointPosition(endEntity.properties as PointProperties, result);
      if (startPos && endPos) return { start: startPos, end: endPos };
    }
  }

  if (props.curvePoints && props.curvePoints.length === 2) {
    return { start: props.curvePoints[0], end: props.curvePoints[1] };
  }

  return null;
}

function getFacePointPositions(face: Entity<'face'>): Vec3[] | null {
  const entityStore = useEntityStore.getState();
  const faceProps = face.properties as FaceProperties;
  const geometryEntity = entityStore.getEntity(faceProps.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;

  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!result) return null;

  if (faceProps.pointIds.length > 0) {
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

  const src = faceProps.source;
  if (src.type === 'surface' && src.surfaceType === 'disk' && result.kind === 'surface') {
    const surfaceFace = result.faces[src.faceIndex];
    if (surfaceFace?.samplePoints && surfaceFace.samplePoints.length >= 3) {
      return surfaceFace.samplePoints.slice(0, 3);
    }
  }

  return null;
}

// ─── 去重辅助 ───

const DEDUP_EPS = 1e-4;

function distSq(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function findExistingPointAt(pos: Vec3, geometryId: string): { id: string; label: string } | null {
  const entityStore = useEntityStore.getState();
  const entities = entityStore.entities;
  const geometryEntity = entityStore.getEntity(geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;

  const geoProps = geometryEntity.properties as GeometryProperties;
  const buildResult = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!buildResult) return null;

  const epsSq = DEDUP_EPS * DEDUP_EPS;
  for (const e of Object.values(entities)) {
    if (e.type !== 'point') continue;
    const pp = e.properties as PointProperties;
    if (pp.geometryId !== geometryId) continue;
    const ePos = computePointPosition(pp, buildResult);
    if (!ePos) continue;
    if (distSq(ePos, pos) < epsSq) {
      return { id: e.id, label: pp.label };
    }
  }
  return null;
}

function findExistingSegmentBetween(pointId1: string, pointId2: string): string | null {
  const entities = useEntityStore.getState().entities;
  for (const e of Object.values(entities)) {
    if (e.type !== 'segment') continue;
    const sp = e.properties as SegmentProperties;
    if (
      (sp.startPointId === pointId1 && sp.endPointId === pointId2) ||
      (sp.startPointId === pointId2 && sp.endPointId === pointId1)
    ) {
      return e.id;
    }
  }
  return null;
}

// ─── 交点创建 ───

function createSegSegIntersection(segId1: string, segId2: string): boolean {
  const entityStore = useEntityStore.getState();
  const seg1 = entityStore.getEntity(segId1) as Entity<'segment'> | undefined;
  const seg2 = entityStore.getEntity(segId2) as Entity<'segment'> | undefined;
  if (!seg1 || seg1.type !== 'segment' || !seg2 || seg2.type !== 'segment') return false;

  const ep1 = getSegmentEndpoints(seg1);
  const ep2 = getSegmentEndpoints(seg2);
  if (!ep1 || !ep2) return false;

  const d1 = sub(ep1.end, ep1.start);
  const d2 = sub(ep2.end, ep2.start);

  const result = lineLineIntersection(ep1.start, d1, ep2.start, d2);
  if (!result) {
    useNotificationStore.getState().show('两线段不共面或平行，无交点');
    return false;
  }

  if (result.t1 < -1e-6 || result.t1 > 1 + 1e-6 || result.t2 < -1e-6 || result.t2 > 1 + 1e-6) {
    useNotificationStore.getState().show('两线段的延长线相交，但交点不在线段范围内');
    return false;
  }

  const geometryId = (seg1.properties as SegmentProperties).geometryId;
  const existing = findExistingPointAt(result.point, geometryId);
  if (existing) {
    useSelectionStore.getState().select(existing.id);
    useNotificationStore.getState().show(`交点已存在：${existing.label}`, 3000);
    return true;
  }

  const label = getNextPointLabel();
  const pos: [number, number, number] = [result.point[0], result.point[1], result.point[2]];

  const command = new CreateEntityCommand('point', {
    builtIn: false,
    geometryId,
    constraint: { type: 'free' as const, position: pos },
    label,
  });
  useHistoryStore.getState().execute(command);

  const pointId = command.getCreatedId();
  if (pointId) useSelectionStore.getState().select(pointId);
  useNotificationStore.getState().show(`已创建交点 ${label}`, 3000);
  return true;
}

function createSegFaceIntersection(segId: string, faceId: string): boolean {
  const entityStore = useEntityStore.getState();
  const seg = entityStore.getEntity(segId) as Entity<'segment'> | undefined;
  const face = entityStore.getEntity(faceId) as Entity<'face'> | undefined;
  if (!seg || seg.type !== 'segment' || !face || face.type !== 'face') return false;

  const ep = getSegmentEndpoints(seg);
  const facePoints = getFacePointPositions(face);
  if (!ep || !facePoints || facePoints.length < 3) return false;

  const plane = planeFromPoints(facePoints);
  if (!plane) return false;

  const lineDir = sub(ep.end, ep.start);
  const result = linePlaneIntersection(ep.start, lineDir, plane.normal, plane.d);
  if (!result) {
    useNotificationStore.getState().show('线段与面平行，无交点');
    return false;
  }

  if (result.t < -1e-6 || result.t > 1 + 1e-6) {
    useNotificationStore.getState().show('线段延长线与面相交，但交点不在线段范围内');
    return false;
  }

  const geometryId = (seg.properties as SegmentProperties).geometryId;
  const existing = findExistingPointAt(result.point, geometryId);
  if (existing) {
    useSelectionStore.getState().select(existing.id);
    useNotificationStore.getState().show(`交点已存在：${existing.label}`, 3000);
    return true;
  }

  const label = getNextPointLabel();
  const pos: [number, number, number] = [result.point[0], result.point[1], result.point[2]];

  const command = new CreateEntityCommand('point', {
    builtIn: false,
    geometryId,
    constraint: { type: 'free' as const, position: pos },
    label,
  });
  useHistoryStore.getState().execute(command);

  const pointId = command.getCreatedId();
  if (pointId) useSelectionStore.getState().select(pointId);
  useNotificationStore.getState().show(`已创建交点 ${label}`, 3000);
  return true;
}

function createFaceFaceIntersection(faceId1: string, faceId2: string): boolean {
  const entityStore = useEntityStore.getState();
  const face1 = entityStore.getEntity(faceId1) as Entity<'face'> | undefined;
  const face2 = entityStore.getEntity(faceId2) as Entity<'face'> | undefined;
  if (!face1 || face1.type !== 'face' || !face2 || face2.type !== 'face') return false;

  const facePoints1 = getFacePointPositions(face1);
  const facePoints2 = getFacePointPositions(face2);
  if (!facePoints1 || facePoints1.length < 3 || !facePoints2 || facePoints2.length < 3) return false;

  const plane1 = planeFromPoints(facePoints1);
  const plane2 = planeFromPoints(facePoints2);
  if (!plane1 || !plane2) return false;

  const line = planePlaneIntersectionLine(plane1.normal, plane1.d, plane2.normal, plane2.d);
  if (!line) {
    useNotificationStore.getState().show('两面平行或重合，无交线');
    return false;
  }

  const geometryId = (face1.properties as FaceProperties).geometryId;
  const geometryEntity = entityStore.getEntity(geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return false;

  const geoProps = geometryEntity.properties as GeometryProperties;
  const buildResult = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!buildResult || buildResult.kind !== 'polyhedron') {
    useNotificationStore.getState().show('仅支持多面体的面面交线');
    return false;
  }

  const clipped = clipLineToPolyhedron(line.point, line.direction, buildResult);
  if (!clipped) {
    useNotificationStore.getState().show('交线不经过几何体内部');
    return false;
  }

  const existing1 = findExistingPointAt(clipped[0], geometryId);
  const existing2 = findExistingPointAt(clipped[1], geometryId);

  if (existing1 && existing2) {
    const existingSeg = findExistingSegmentBetween(existing1.id, existing2.id);
    if (existingSeg) {
      useSelectionStore.getState().select(existingSeg);
      useNotificationStore.getState().show(`交线已存在：${existing1.label}${existing2.label}`, 3000);
      return true;
    }
  }

  const commands: import('../commands/types').Command[] = [];

  const point1Id: string | null = existing1?.id ?? null;
  let point1Label = existing1?.label ?? '';
  let cmd1: CreateEntityCommand<'point'> | null = null;
  if (!existing1) {
    point1Label = getNextPointLabel();
    const pos1: [number, number, number] = [clipped[0][0], clipped[0][1], clipped[0][2]];
    cmd1 = new CreateEntityCommand('point', {
      builtIn: false, geometryId,
      constraint: { type: 'free' as const, position: pos1 },
      label: point1Label,
    });
    commands.push(cmd1);
  }

  let point2Label = existing2?.label ?? '';
  let cmd2: CreateEntityCommand<'point'> | null = null;
  if (!existing2) {
    point2Label = getNextPointLabel();
    const pos2: [number, number, number] = [clipped[1][0], clipped[1][1], clipped[1][2]];
    cmd2 = new CreateEntityCommand('point', {
      builtIn: false, geometryId,
      constraint: { type: 'free' as const, position: pos2 },
      label: point2Label,
    });
    commands.push(cmd2);
  }

  const deferredSegment: import('../commands/types').Command & { _inner?: CreateEntityCommand<'segment'> } = {
    type: 'createIntersectionSegment',
    label: '创建交线',
    execute() {
      const startId = cmd1 ? cmd1.getCreatedId()! : point1Id!;
      const endId = cmd2 ? cmd2.getCreatedId()! : existing2!.id;
      if (!this._inner) {
        this._inner = new CreateEntityCommand('segment', {
          builtIn: false, geometryId,
          startPointId: startId, endPointId: endId,
          style: { color: '#ff0000', dashed: true },
        });
      }
      this._inner.execute();
    },
    undo() { this._inner?.undo(); },
  };
  commands.push(deferredSegment);

  const batch = new BatchCommand('创建交线', commands);
  useHistoryStore.getState().execute(batch);

  const segId = (deferredSegment as { _inner?: CreateEntityCommand<'segment'> })._inner?.getCreatedId();
  if (segId) useSelectionStore.getState().select(segId);
  useNotificationStore.getState().show(`已创建交线 ${point1Label}${point2Label}`, 3000);
  return true;
}

// ─── Tool 定义 ───

export const intersectionTool: Tool = {
  id: 'intersection',
  label: '求交点',

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
      if (event.hitEntityType === 'segment') {
        firstEntityId = event.hitEntityId;
        firstEntityType = 'segment';
        addPendingSelection(event.hitEntityId);
        setStep(1);
      } else if (event.hitEntityType === 'face') {
        firstEntityId = event.hitEntityId;
        firstEntityType = 'face';
        addPendingSelection(event.hitEntityId);
        setStep(1);
      }
    } else {
      if (event.hitEntityId === firstEntityId) return;

      let success = false;
      let tried = false;

      if (firstEntityType === 'segment') {
        if (event.hitEntityType === 'segment') {
          tried = true;
          success = createSegSegIntersection(firstEntityId, event.hitEntityId);
        } else if (event.hitEntityType === 'face') {
          tried = true;
          success = createSegFaceIntersection(firstEntityId, event.hitEntityId);
        }
      } else if (firstEntityType === 'face') {
        if (event.hitEntityType === 'segment') {
          tried = true;
          success = createSegFaceIntersection(event.hitEntityId, firstEntityId);
        } else if (event.hitEntityType === 'face') {
          tried = true;
          success = createFaceFaceIntersection(firstEntityId, event.hitEntityId);
        }
      }

      if (tried && success) {
        resetState();
        useToolStore.getState().setActiveTool('select');
      } else if (tried) {
        firstEntityId = null;
        firstEntityType = null;
        pendingSelectedIds = [];
        useSelectionStore.getState().clear();
        setStep(0);
      } else {
        useNotificationStore.getState().show('请选择线段或面');
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
