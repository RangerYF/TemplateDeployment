import { useMemo } from 'react';
import * as THREE from 'three';
import { Line, Html } from '@react-three/drei';
import type { Entity } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { usePointPosition } from './usePointPosition';
import { computeCircumscribedCircle } from '@/engine/math/circumscribedCircle';
import { registerRenderer } from './index';

const CIRCLE_SEGMENTS = 64;
const CIRCLE_COLOR = '#f59e0b';

function CircumCircleRenderer({ entity }: { entity: Entity }) {
  const ccEntity = entity as Entity<'circumCircle'>;
  const [pid0, pid1, pid2] = ccEntity.properties.pointIds;

  // 获取三个 Point Entity
  const p0 = useEntityStore((s) => {
    const e = s.entities[pid0];
    return e?.type === 'point' ? (e as Entity<'point'>) : undefined;
  });
  const p1 = useEntityStore((s) => {
    const e = s.entities[pid1];
    return e?.type === 'point' ? (e as Entity<'point'>) : undefined;
  });
  const p2 = useEntityStore((s) => {
    const e = s.entities[pid2];
    return e?.type === 'point' ? (e as Entity<'point'>) : undefined;
  });

  // 获取三个点的实时位置（含 positionOverride）
  const pos0 = usePointPosition(p0);
  const pos1 = usePointPosition(p1);
  const pos2 = usePointPosition(p2);

  // 计算外接圆
  const circle = useMemo(() => {
    if (!pos0 || !pos1 || !pos2) return null;
    return computeCircumscribedCircle(pos0, pos1, pos2);
  }, [pos0, pos1, pos2]);

  const circlePoints = useMemo(() => {
    if (!circle) return [];
    const { center, radius, normal } = circle;
    const n = new THREE.Vector3(...normal);
    const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
    const u = new THREE.Vector3().crossVectors(n, up).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    const points: [number, number, number][] = [];
    for (let i = 0; i <= CIRCLE_SEGMENTS; i++) {
      const angle = (i * 2 * Math.PI) / CIRCLE_SEGMENTS;
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      points.push([
        center[0] + radius * (cos * u.x + sin * v.x),
        center[1] + radius * (cos * u.y + sin * v.y),
        center[2] + radius * (cos * u.z + sin * v.z),
      ]);
    }
    return points;
  }, [circle]);

  if (!circle) return null;

  return (
    <group>
      {/* 圆环线（内联自 CircumCircle） */}
      <Line points={circlePoints} color={CIRCLE_COLOR} lineWidth={2} />
      {/* 半径值标签 */}
      <Html
        position={circle.center}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            fontSize: 11,
            color: '#f59e0b',
            background: 'rgba(255,255,255,0.9)',
            padding: '1px 5px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            transform: 'translateY(-14px)',
          }}
        >
          r = {circle.radius.toFixed(2)}
        </div>
      </Html>
    </group>
  );
}

registerRenderer('circumCircle', CircumCircleRenderer);

export { CircumCircleRenderer };
