import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { useThree, useFrame } from '@react-three/fiber';
import { useToolStore, useEntityStore } from '@/editor/store';
import { useSelectionStore } from '@/editor/store/selectionStore';
import type { ToolPointerEvent } from '@/editor/tools/types';
import { transientDragState } from '@/editor/store/dragState';
import { useContextMenuStore } from '@/components/scene/contextMenuStore';
import type { SegmentProperties, PointProperties, GeometryProperties } from '@/editor/entities/types';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { getBuilderResult } from '@/editor/builderCache';

const DRAG_THRESHOLD = 4;

/**
 * ToolEventDispatcher
 * 将 R3F pointer 事件转换为 ToolPointerEvent 分发到活跃 Tool
 *
 * 拖拽处理：pointerDown 命中 mesh 后，切换到 window 级 DOM 事件监听，
 * 确保鼠标移到空白区域时仍能持续接收 pointermove/pointerup。
 */
export function ToolEventDispatcher({ children }: { children: React.ReactNode }) {
  const { camera, gl } = useThree();
  const getActiveTool = useToolStore((s) => s.getActiveTool);

  // 拖拽平面状态（用于将鼠标移动投影到 3D 空间）
  const dragPlaneRef = useRef<THREE.Plane | null>(null);
  // 缓存高频使用的 Three.js 对象，避免每次 pointermove 都 new 导致 GC 抖动
  const reusableRaycaster = useRef(new THREE.Raycaster());
  const reusableNdc = useRef(new THREE.Vector2());
  const reusablePlaneHit = useRef(new THREE.Vector3());
  const pointerDownRef = useRef<{ x: number; y: number; hitEntityId?: string } | null>(null);
  // RAF 节流：缓存最新 pointermove 事件，每帧只派发一次
  const pendingMoveRef = useRef<PointerEvent | null>(null);
  const rafIdRef = useRef<number>(0);
  const lastSyncedPos = useRef<[number, number, number] | null>(null);
  // 用于在 window 事件中清理监听器
  const windowHandlersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: (e: PointerEvent) => void;
  } | null>(null);

  /** 从 intersections 中找到目标命中对象（支持 Ctrl 穿透） */
  const findTargetHit = useCallback(
    (intersections: THREE.Intersection[], penetrate: boolean) => {
      // 收集所有有 entityId 的命中（排除 locked 实体）
      const entities = useEntityStore.getState().entities;
      const entityHits = intersections.filter((h) => {
        const eid = h.object?.userData?.entityId;
        if (!eid) return false;
        const e = entities[eid];
        return e && !e.locked;
      });
      if (entityHits.length === 0) return null;

      if (!penetrate) {
        return entityHits[0];
      }
      // 穿透模式：跳过最前方实体的所有交点，找到不同 entityId 的第一个命中
      const frontId = entityHits[0].object.userData.entityId;
      const behindHit = entityHits.find((h) => h.object.userData.entityId !== frontId);
      return behindHit ?? entityHits[0];
    },
    [],
  );

  const buildToolEvent = useCallback(
    (event: ThreeEvent<PointerEvent>): ToolPointerEvent => {
      const penetrate = event.nativeEvent.ctrlKey || event.nativeEvent.metaKey;
      const targetHit = findTargetHit(event.intersections, penetrate);
      return {
        nativeEvent: event.nativeEvent,
        intersection: targetHit ?? undefined,
        hitEntityId: targetHit?.object?.userData?.entityId,
        hitEntityType: targetHit?.object?.userData?.entityType,
      };
    },
    [findTargetHit],
  );

  /** 将屏幕坐标投影到拖拽平面 */
  const projectToDragPlane = useCallback(
    (clientX: number, clientY: number): { point: THREE.Vector3 } | null => {
      if (!dragPlaneRef.current) return null;

      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();
      const ndc = reusableNdc.current.set(
        ((clientX - rect.left) / rect.width) * 2 - 1,
        -((clientY - rect.top) / rect.height) * 2 + 1,
      );

      const raycaster = reusableRaycaster.current;
      raycaster.setFromCamera(ndc, camera);
      const planeHit = reusablePlaneHit.current;
      const hit = raycaster.ray.intersectPlane(dragPlaneRef.current, planeHit);
      return hit ? { point: planeHit.clone() } : null;
    },
    [camera, gl],
  );

  /** 清理 window 级监听器 */
  const cleanupWindowHandlers = useCallback(() => {
    if (windowHandlersRef.current) {
      window.removeEventListener('pointermove', windowHandlersRef.current.move);
      window.removeEventListener('pointerup', windowHandlersRef.current.up);
      windowHandlersRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      const tool = getActiveTool();
      if (!tool?.onPointerDown) return;

      const toolEvent = buildToolEvent(event);
      tool.onPointerDown(toolEvent);

      // 记录 pointerDown 位置
      pointerDownRef.current = {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY,
        hitEntityId: toolEvent.hitEntityId,
      };

      // 如果命中了一个 point，建立拖拽平面
      if (toolEvent.hitEntityType === 'point' && event.intersections[0]) {
        const hitPoint = event.intersections[0].point;
        const normal = camera.getWorldDirection(new THREE.Vector3());
        dragPlaneRef.current = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, hitPoint);
      } else {
        dragPlaneRef.current = null;
      }

      // 设置 window 级事件监听（确保拖拽到空白区域时仍能接收事件）
      cleanupWindowHandlers();

      const flushMove = () => {
        const e = pendingMoveRef.current;
        if (!e) return;
        pendingMoveRef.current = null;

        const activeTool = getActiveTool();
        if (!activeTool?.onPointerMove || !pointerDownRef.current) return;

        const intersection = projectToDragPlane(e.clientX, e.clientY);
        const moveEvent: ToolPointerEvent = {
          nativeEvent: e,
          intersection: intersection ?? undefined,
          hitEntityId: pointerDownRef.current.hitEntityId,
          hitEntityType: undefined,
        };
        activeTool.onPointerMove(moveEvent);
      };

      const handleWindowMove = (e: PointerEvent) => {
        if (!pointerDownRef.current) return;

        // 检查是否超过拖拽阈值
        const dx = e.clientX - pointerDownRef.current.x;
        const dy = e.clientY - pointerDownRef.current.y;
        if (Math.sqrt(dx * dx + dy * dy) < DRAG_THRESHOLD) return;

        // RAF 节流：缓存最新事件，每帧只处理一次
        pendingMoveRef.current = e;
        if (!rafIdRef.current) {
          rafIdRef.current = requestAnimationFrame(() => {
            rafIdRef.current = 0;
            flushMove();
          });
        }
      };

      const handleWindowUp = (e: PointerEvent) => {
        // 取消 pending RAF，立即 flush 最后一次移动
        if (rafIdRef.current) {
          cancelAnimationFrame(rafIdRef.current);
          rafIdRef.current = 0;
        }
        flushMove();

        const activeTool = getActiveTool();
        if (activeTool?.onPointerUp) {
          const upEvent: ToolPointerEvent = {
            nativeEvent: e,
            intersection: undefined,
            hitEntityId: pointerDownRef.current?.hitEntityId,
            hitEntityType: undefined,
          };
          activeTool.onPointerUp(upEvent);
        }

        pendingMoveRef.current = null;
        pointerDownRef.current = null;
        dragPlaneRef.current = null;
        cleanupWindowHandlers();
      };

      window.addEventListener('pointermove', handleWindowMove);
      window.addEventListener('pointerup', handleWindowUp);
      windowHandlersRef.current = { move: handleWindowMove, up: handleWindowUp };
    },
    [getActiveTool, buildToolEvent, camera, projectToDragPlane, cleanupWindowHandlers],
  );

  const handlePointerMove = useCallback(
    (event: ThreeEvent<PointerEvent>) => {
      // 拖拽中不更新 hover（由 window 级事件处理）
      if (pointerDownRef.current) return;

      const penetrate = event.nativeEvent.ctrlKey || event.nativeEvent.metaKey;
      const targetHit = findTargetHit(event.intersections, penetrate);
      const entityId = targetHit?.object?.userData?.entityId ?? null;
      useSelectionStore.getState().setHovered(entityId);
    },
    [findTargetHit],
  );

  const handlePointerLeave = useCallback(() => {
    if (!pointerDownRef.current) {
      useSelectionStore.getState().setHovered(null);
    }
  }, []);

  /** Ctrl+右键穿透：统一处理被面放行的 contextmenu 事件 */
  const handleContextMenu = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      const penetrate = event.nativeEvent.ctrlKey || event.nativeEvent.metaKey;
      if (!penetrate) return;

      event.nativeEvent.preventDefault();

      const targetHit = findTargetHit(event.intersections, true);
      if (!targetHit) return;

      const entityId = targetHit.object?.userData?.entityId as string | undefined;
      const entityType = targetHit.object?.userData?.entityType as string | undefined;
      if (!entityId || !entityType) return;

      const screenPosition = { x: event.nativeEvent.clientX, y: event.nativeEvent.clientY };
      const openMenu = useContextMenuStore.getState().openMenu;

      if (entityType === 'segment') {
        const store = useEntityStore.getState();
        const seg = store.getEntity(entityId);
        if (!seg || seg.type !== 'segment') return;
        const segProps = seg.properties as SegmentProperties;

        let hitT = 0.5;
        const startPt = store.getEntity(segProps.startPointId);
        const endPt = store.getEntity(segProps.endPointId);
        if (startPt?.type === 'point' && endPt?.type === 'point') {
          const geoEntity = store.getEntity(segProps.geometryId);
          if (geoEntity?.type === 'geometry') {
            const geoProps = geoEntity.properties as GeometryProperties;
            const result = getBuilderResult(segProps.geometryId, geoProps.geometryType, geoProps.params);
            if (result) {
              const startPos = computePointPosition(startPt.properties as PointProperties, result);
              const endPos = computePointPosition(endPt.properties as PointProperties, result);
              if (startPos && endPos) {
                const hit = targetHit.point;
                const sx = endPos[0] - startPos[0], sy = endPos[1] - startPos[1], sz = endPos[2] - startPos[2];
                const lenSq = sx * sx + sy * sy + sz * sz;
                if (lenSq > 0) {
                  hitT = Math.max(0, Math.min(1,
                    ((hit.x - startPos[0]) * sx + (hit.y - startPos[1]) * sy + (hit.z - startPos[2]) * sz) / lenSq,
                  ));
                }
              }
            }
          }
        }

        openMenu({ screenPosition, targetEntityId: entityId, targetEntityType: 'segment', hitT });
      } else if (entityType === 'face') {
        openMenu({
          screenPosition,
          targetEntityId: entityId,
          targetEntityType: 'face',
          hitPoint: [targetHit.point.x, targetHit.point.y, targetHit.point.z],
        });
      }
    },
    [findTargetHit],
  );

  // 每帧将 transientDragState 同步到 store，让线段/面跟着动
  useFrame(() => {
    const { pointId, position } = transientDragState;
    if (!pointId || !position) {
      lastSyncedPos.current = null;
      return;
    }
    const last = lastSyncedPos.current;
    if (!last || last[0] !== position[0] || last[1] !== position[1] || last[2] !== position[2]) {
      lastSyncedPos.current = [position[0], position[1], position[2]];
      useEntityStore.getState().updateProperties(pointId, { positionOverride: position });
    }
  });

  return (
    <group
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      onContextMenu={handleContextMenu}
    >
      {children}
    </group>
  );
}
