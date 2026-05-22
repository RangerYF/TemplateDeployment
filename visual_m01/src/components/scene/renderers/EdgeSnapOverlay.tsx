import { useMemo } from 'react';
import { useToolStore, useEntityStore } from '@/editor/store';
import { useBuilderResult } from '@/editor/builderCache';
import type { PointProperties } from '@/editor/entities/types';

interface SnapPoint {
  key: string;
  position: [number, number, number];
  edgeStart: number;
  edgeEnd: number;
  t: number;
  color: string;
  radius: number;
}

const SNAP_T_VALUES = [
  { t: 1 / 3, color: '#3b82f6', radius: 0.04 },
  { t: 0.5, color: '#f59e0b', radius: 0.05 },
  { t: 2 / 3, color: '#3b82f6', radius: 0.04 },
];

const HITBOX_RADIUS = 0.12;

export function EdgeSnapOverlay() {
  const activeToolId = useToolStore((s) => s.activeToolId);

  const geometryEntity = useEntityStore((s) => {
    for (const e of Object.values(s.entities)) {
      if (e.type === 'geometry') return e;
    }
    return undefined;
  });

  const geometryId = geometryEntity?.id;
  const result = useBuilderResult(geometryId);

  const entities = useEntityStore((s) => s.entities);

  const snapPoints = useMemo(() => {
    if (activeToolId !== 'crossSection' || !result || result.kind !== 'polyhedron' || !geometryId) {
      return [];
    }

    const points: SnapPoint[] = [];

    for (const [startIdx, endIdx] of result.edges) {
      const va = result.vertices[startIdx]?.position;
      const vb = result.vertices[endIdx]?.position;
      if (!va || !vb) continue;

      for (const { t, color, radius } of SNAP_T_VALUES) {
        const existing = Object.values(entities).find((e) => {
          if (e.type !== 'point') return false;
          const p = e.properties as PointProperties;
          if (p.geometryId !== geometryId || p.constraint.type !== 'edge') return false;
          const c = p.constraint;
          if (c.edgeStart === startIdx && c.edgeEnd === endIdx && Math.abs(c.t - t) < 1e-6) return true;
          if (c.edgeStart === endIdx && c.edgeEnd === startIdx && Math.abs(c.t - (1 - t)) < 1e-6) return true;
          return false;
        });
        if (existing) continue;

        points.push({
          key: `${startIdx}-${endIdx}-${t}`,
          position: [
            va[0] + t * (vb[0] - va[0]),
            va[1] + t * (vb[1] - va[1]),
            va[2] + t * (vb[2] - va[2]),
          ],
          edgeStart: startIdx,
          edgeEnd: endIdx,
          t,
          color,
          radius,
        });
      }
    }

    return points;
  }, [activeToolId, result, geometryId, entities]);

  if (snapPoints.length === 0) return null;

  return (
    <group>
      {snapPoints.map((sp) => (
        <group key={sp.key} position={sp.position}>
          {/* 可见球 */}
          <mesh renderOrder={999}>
            <sphereGeometry args={[sp.radius, 16, 16]} />
            <meshBasicMaterial color={sp.color} depthTest={false} />
          </mesh>
          {/* 不可见的 hitbox — 与 PointEntityRenderer 一致 */}
          <mesh
            userData={{
              isSnapPoint: true,
              entityType: 'point',
              snapData: { geometryId, edgeStart: sp.edgeStart, edgeEnd: sp.edgeEnd, t: sp.t },
            }}
          >
            <sphereGeometry args={[HITBOX_RADIUS, 8, 8]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}
