import type { Tool, ToolPointerEvent } from './types';
import type { PointProperties, FaceProperties, GeometryProperties, SegmentProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useToolStore } from '../store/toolStore';
import { useHistoryStore } from '../store/historyStore';
import { MovePointCommand } from '../commands/movePoint';
import { UpdatePropertiesCommand } from '../commands/updateProperties';
import { DeleteEntityCascadeCommand } from '../commands/deleteEntityCascade';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { getBuilderResult } from '../builderCache';
import { transientDragState } from '../store/dragState';


/**
 * SelectTool — 默认工具
 * 职责：选中实体、拖拽移动 Point、Delete 删除
 */

let isDragging = false;
let dragPointId: string | null = null;
let dragBeforeState: [number, number, number] | undefined = undefined;
/** 面约束拖拽：缓存面平面参数 */
let dragFacePlane: { normal: [number, number, number]; d: number } | null = null;
/** 线段约束拖拽：缓存端点位置和初始 t */
let dragSegmentInfo: { startPos: [number, number, number]; endPos: [number, number, number]; initialT: number } | null = null;

function computeFacePlane(faceId: string): { normal: [number, number, number]; d: number } | null {
  const store = useEntityStore.getState();
  const face = store.getEntity(faceId);
  if (!face || face.type !== 'face') return null;
  const faceProps = face.properties as FaceProperties;
  const geometryEntity = store.getEntity(faceProps.geometryId);
  if (!geometryEntity || geometryEntity.type !== 'geometry') return null;
  const geoProps = geometryEntity.properties as GeometryProperties;
  const result = getBuilderResult(faceProps.geometryId, geoProps.geometryType, geoProps.params);
  if (!result) return null;

  const positions: [number, number, number][] = [];
  for (let i = 0; i < Math.min(3, faceProps.pointIds.length); i++) {
    const pe = store.getEntity(faceProps.pointIds[i]);
    if (!pe || pe.type !== 'point') return null;
    const pos = computePointPosition(pe.properties as PointProperties, result);
    if (!pos) return null;
    positions.push(pos as [number, number, number]);
  }
  if (positions.length < 3) return null;

  const [p0, p1, p2] = positions;
  // 计算法向量 = (p1-p0) × (p2-p0)
  const e1 = [p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]];
  const e2 = [p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2]];
  const nx = e1[1] * e2[2] - e1[2] * e2[1];
  const ny = e1[2] * e2[0] - e1[0] * e2[2];
  const nz = e1[0] * e2[1] - e1[1] * e2[0];
  const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
  if (len < 1e-12) return null;
  const normal: [number, number, number] = [nx / len, ny / len, nz / len];
  const d = normal[0] * p0[0] + normal[1] * p0[1] + normal[2] * p0[2];
  return { normal, d };
}

function projectToPlane(
  point: [number, number, number],
  plane: { normal: [number, number, number]; d: number },
): [number, number, number] {
  const dist = plane.normal[0] * point[0] + plane.normal[1] * point[1] + plane.normal[2] * point[2] - plane.d;
  return [
    point[0] - dist * plane.normal[0],
    point[1] - dist * plane.normal[1],
    point[2] - dist * plane.normal[2],
  ];
}

function computeSegmentEndpoints(segmentId: string): { startPos: [number, number, number]; endPos: [number, number, number] } | null {
  const store = useEntityStore.getState();
  const seg = store.getEntity(segmentId);
  if (!seg || seg.type !== 'segment') return null;
  const segProps = seg.properties as SegmentProperties;
  const startPt = store.getEntity(segProps.startPointId);
  const endPt = store.getEntity(segProps.endPointId);
  if (!startPt || startPt.type !== 'point' || !endPt || endPt.type !== 'point') return null;
  const geoEntity = store.getEntity(segProps.geometryId);
  if (!geoEntity || geoEntity.type !== 'geometry') return null;
  const geoProps = geoEntity.properties as GeometryProperties;
  const result = getBuilderResult(segProps.geometryId, geoProps.geometryType, geoProps.params);
  if (!result) return null;
  const startPos = computePointPosition(startPt.properties as PointProperties, result);
  const endPos = computePointPosition(endPt.properties as PointProperties, result);
  if (!startPos || !endPos) return null;
  return { startPos: startPos as [number, number, number], endPos: endPos as [number, number, number] };
}

function projectToSegment(
  point: [number, number, number],
  startPos: [number, number, number],
  endPos: [number, number, number],
): { t: number; position: [number, number, number] } {
  const sx = endPos[0] - startPos[0], sy = endPos[1] - startPos[1], sz = endPos[2] - startPos[2];
  const lenSq = sx * sx + sy * sy + sz * sz;
  let t = 0.5;
  if (lenSq > 0) {
    t = Math.max(0.01, Math.min(0.99,
      ((point[0] - startPos[0]) * sx + (point[1] - startPos[1]) * sy + (point[2] - startPos[2]) * sz) / lenSq,
    ));
  }
  return {
    t,
    position: [
      startPos[0] + t * (endPos[0] - startPos[0]),
      startPos[1] + t * (endPos[1] - startPos[1]),
      startPos[2] + t * (endPos[2] - startPos[2]),
    ],
  };
}

export const selectTool: Tool = {
  id: 'select',
  label: '选择',

  onActivate() {
    // 无特殊操作
  },

  onDeactivate() {
    // 取消进行中的拖拽（不提交 Command）
    if (isDragging && dragPointId && dragBeforeState !== undefined) {
      useEntityStore.getState().updateProperties(dragPointId, {
        positionOverride: dragBeforeState,
      });
    }
    transientDragState.pointId = null;
    transientDragState.position = null;
    isDragging = false;
    useToolStore.getState().setIsDragging(false);
    dragPointId = null;
    dragBeforeState = undefined;
    dragFacePlane = null;
    dragSegmentInfo = null;
  },

  onPointerDown(event: ToolPointerEvent) {
    if (event.hitEntityId) {
      // 选中命中的实体
      useSelectionStore.getState().select(event.hitEntityId);

      // 如果命中的是 Point Entity → 进入拖拽预备（内置顶点不可拖拽）
      if (event.hitEntityType === 'point') {
        const entity = useEntityStore.getState().getEntity(event.hitEntityId);
        const isBuiltIn = (entity?.properties as PointProperties)?.builtIn;
        const canDrag = entity && entity.type === 'point' && !isBuiltIn;
        if (canDrag) {
          dragPointId = event.hitEntityId;
          dragBeforeState = (entity.properties as PointProperties).positionOverride;
          isDragging = false;
          // 立即禁用 OrbitControls，防止拖拽点时视图跟着动
          useToolStore.getState().setIsDragging(true);
          // 缓存约束平面/线段信息
          const constraint = (entity.properties as PointProperties).constraint;
          dragFacePlane = constraint.type === 'face' ? computeFacePlane(constraint.faceId) : null;
          if (constraint.type === 'segment') {
            const endpoints = computeSegmentEndpoints(constraint.segmentId);
            dragSegmentInfo = endpoints ? { ...endpoints, initialT: constraint.t } : null;
          } else {
            dragSegmentInfo = null;
          }
        }
      }
    } else {
      // 点击空白 → 取消选中
      useSelectionStore.getState().clear();
    }
  },

  onPointerMove(event: ToolPointerEvent) {
    if (!dragPointId) return;

    if (!isDragging) {
      isDragging = true;
      useToolStore.getState().setIsDragging(true);
    }

    // 从 ToolEventDispatcher 传入的 dragPlanePoint 提取拖拽目标位置
    // 写入 transientDragState 而非 store，由 useFrame 直接移动 mesh，避免 React 重渲染
    if (event.intersection) {
      const inter = event.intersection as { point?: { x: number; y: number; z: number } };
      if (inter.point) {
        let newPos: [number, number, number] = [inter.point.x, inter.point.y, inter.point.z];
        if (dragSegmentInfo) {
          const proj = projectToSegment(newPos, dragSegmentInfo.startPos, dragSegmentInfo.endPos);
          newPos = proj.position;
        } else if (dragFacePlane) {
          newPos = projectToPlane(newPos, dragFacePlane);
        }
        transientDragState.pointId = dragPointId;
        transientDragState.position = newPos;
      }
    }
  },

  onPointerUp(_event: ToolPointerEvent) {
    if (isDragging && dragPointId) {
      if (dragSegmentInfo) {
        // 线段约束拖拽：更新 constraint.t，清除 positionOverride
        const finalPos = transientDragState.position;
        if (finalPos) {
          const proj = projectToSegment(finalPos, dragSegmentInfo.startPos, dragSegmentInfo.endPos);
          const entity = useEntityStore.getState().getEntity(dragPointId);
          if (entity?.type === 'point') {
            const oldConstraint = (entity.properties as PointProperties).constraint;
            if (oldConstraint.type !== 'segment') return;
            const newConstraint = { ...oldConstraint, t: proj.t };
            useEntityStore.getState().updateProperties(dragPointId, {
              constraint: newConstraint,
              positionOverride: undefined,
            });
            if (dragSegmentInfo.initialT !== proj.t) {
              const prevConstraint = { ...oldConstraint, t: dragSegmentInfo.initialT };
              useHistoryStore.getState().execute(
                new UpdatePropertiesCommand(
                  dragPointId,
                  { constraint: prevConstraint, positionOverride: dragBeforeState },
                  { constraint: newConstraint, positionOverride: undefined },
                ),
              );
            }
          }
        }
      } else {
        // 非约束拖拽：更新 positionOverride
        const afterState = transientDragState.position ?? undefined;
        if (afterState) {
          useEntityStore.getState().updateProperties(dragPointId, { positionOverride: afterState });
        }
        const finalAfterState = afterState ?? dragBeforeState;
        if (
          dragBeforeState !== finalAfterState &&
          JSON.stringify(dragBeforeState) !== JSON.stringify(finalAfterState)
        ) {
          const command = new MovePointCommand(
            dragPointId,
            dragBeforeState,
            finalAfterState,
          );
          useHistoryStore.getState().execute(command);
        }
      }
    }

    // 重置拖拽状态
    transientDragState.pointId = null;
    transientDragState.position = null;
    isDragging = false;
    useToolStore.getState().setIsDragging(false);
    dragPointId = null;
    dragBeforeState = undefined;
    dragFacePlane = null;
    dragSegmentInfo = null;
  },

  onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      const { selectedIds } = useSelectionStore.getState();
      if (selectedIds.length === 0) return;

      const selectedId = selectedIds[0];
      const entity = useEntityStore.getState().getEntity(selectedId);
      if (!entity) return;

      // 仅允许删除非内置实体
      if ('builtIn' in entity.properties && entity.properties.builtIn) {
        // 动态导入通知，避免 editor 层直接依赖 UI 层
        import('@/components/scene/notificationStore').then(({ useNotificationStore }) => {
          useNotificationStore.getState().show('无法删除几何体自带的点、线、面');
        });
        return;
      }

      const command = new DeleteEntityCascadeCommand(selectedId);
      useHistoryStore.getState().execute(command);
      useSelectionStore.getState().clear();
    }
  },
};
