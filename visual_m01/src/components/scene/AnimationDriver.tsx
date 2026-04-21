import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useAnimationStore, transientAnimationState } from '@/editor/store/animationStore';
import { useEntityStore } from '@/editor/store/entityStore';
import type { PointProperties, GeometryProperties } from '@/editor/entities/types';
import { computePointPosition } from '@/components/scene/renderers/usePointPosition';
import { getBuilderResult } from '@/editor/builderCache';

/** store 同步间隔（毫秒），度量等依赖 store 的组件以此频率更新 */
const STORE_SYNC_INTERVAL = 50; // ~20fps

/**
 * 动点动画驱动器
 *
 * 性能策略：
 * - 每帧：更新 transientAnimationState（模块级变量），PointEntityRenderer 的
 *   useFrame 直接读取，实现 60fps 流畅视觉更新
 * - 节流（~20fps）：同步 t 值到 entityStore，触发度量重算
 */
export function AnimationDriver() {
  const lastSyncRef = useRef(0);
  const localTRef = useRef(0);

  useFrame((_, delta) => {
    const { playingPointId, speed, direction } = useAnimationStore.getState();
    if (!playingPointId) return;

    const store = useEntityStore.getState();
    const entity = store.entities[playingPointId];
    if (!entity || entity.type !== 'point') {
      useAnimationStore.getState().pause();
      return;
    }

    const props = entity.properties as PointProperties;
    const { constraint } = props;
    if (constraint.type !== 'edge' && constraint.type !== 'curve') {
      useAnimationStore.getState().pause();
      return;
    }

    // 切换几何体时自动停止动画
    const activeGeoId = store.activeGeometryId;
    if (activeGeoId && props.geometryId !== activeGeoId) {
      useAnimationStore.getState().pause();
      return;
    }

    // 首次进入或 pointId 变化时，从 store 读取当前 t
    if (transientAnimationState.pointId !== playingPointId) {
      localTRef.current = constraint.t;
    }

    // 每帧更新本地 t
    const step = speed * 0.5 * delta;
    let newT = direction === 'forward' ? localTRef.current + step : localTRef.current - step;
    let newDirection = direction;

    if (newT >= 0.99) {
      newT = 0.99;
      newDirection = 'backward';
    } else if (newT <= 0.01) {
      newT = 0.01;
      newDirection = 'forward';
    }

    if (newDirection !== direction) {
      useAnimationStore.setState({ direction: newDirection });
    }

    localTRef.current = newT;

    // 计算 3D 位置，写入 transient 状态（PointEntityRenderer useFrame 直接读取）
    const geoEntity = store.getEntity(props.geometryId);
    if (geoEntity?.type === 'geometry') {
      const geoProps = geoEntity.properties as GeometryProperties;
      const result = getBuilderResult(props.geometryId, geoProps.geometryType, geoProps.params);
      if (result) {
        const tempProps = { ...props, constraint: { ...constraint, t: newT } };
        const pos = computePointPosition(tempProps, result);
        if (pos) {
          transientAnimationState.pointId = playingPointId;
          transientAnimationState.position = pos as [number, number, number];
          transientAnimationState.t = newT;
        }
      }
    }

    // 节流同步到 entityStore（给度量组件用）
    const now = performance.now();
    if (now - lastSyncRef.current >= STORE_SYNC_INTERVAL) {
      lastSyncRef.current = now;
      store.updateProperties(playingPointId, {
        constraint: { ...constraint, t: newT },
      });
    }
  });

  return null;
}
