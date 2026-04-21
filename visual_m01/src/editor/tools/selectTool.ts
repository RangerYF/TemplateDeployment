import type { Tool, ToolPointerEvent } from './types';
import type { PointProperties, FaceProperties, GeometryProperties } from '../entities/types';
import { useEntityStore } from '../store/entityStore';
import { useSelectionStore } from '../store/selectionStore';
import { useToolStore } from '../store/toolStore';
import { useHistoryStore } from '../store/historyStore';
import { MovePointCommand } from '../commands/movePoint';
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
  },

  onPointerDown(event: ToolPointerEvent) {
    if (event.hitEntityId) {
      // 选中命中的实体
      useSelectionStore.getState().select(event.hitEntityId);

      // 如果命中的是 Point Entity → 进入拖拽预备
      if (event.hitEntityType === 'point') {
        const entity = useEntityStore.getState().getEntity(event.hitEntityId);
        if (entity && entity.type === 'point') {
          dragPointId = event.hitEntityId;
          dragBeforeState = (entity.properties as PointProperties).positionOverride;
          isDragging = false;
          // 立即禁用 OrbitControls，防止拖拽点时视图跟着动
          useToolStore.getState().setIsDragging(true);
          // 缓存面约束平面
          const constraint = (entity.properties as PointProperties).constraint;
          dragFacePlane = constraint.type === 'face' ? computeFacePlane(constraint.faceId) : null;
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
        if (dragFacePlane) {
          newPos = projectToPlane(newPos, dragFacePlane);
        }
        transientDragState.pointId = dragPointId;
        transientDragState.position = newPos;
      }
    }
  },

  onPointerUp(_event: ToolPointerEvent) {
    if (isDragging && dragPointId) {
      // 从 transientDragState 取最终位置，提交到 store
      const afterState = transientDragState.position ?? undefined;
      if (afterState) {
        // 先写入 store 使状态一致
        useEntityStore.getState().updateProperties(dragPointId, { positionOverride: afterState });
      }
      // 提交 undo command
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

    // 重置拖拽状态
    transientDragState.pointId = null;
    transientDragState.position = null;
    isDragging = false;
    useToolStore.getState().setIsDragging(false);
    dragPointId = null;
    dragBeforeState = undefined;
    dragFacePlane = null;
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
