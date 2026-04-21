import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { computeCircumscribedSphere } from '@/engine/math/circumscribedSphere';
import { registerRenderer } from './index';

/** 生成单位圆（XY平面）的 BufferGeometry，用于 LineLoop */
function createCircleGeometry(radius: number, segments = 64): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

// 3条大圆的旋转：XY平面（赤道）、XZ平面、YZ平面
const GREAT_CIRCLE_ROTATIONS: [number, number, number][] = [
  [0, 0, 0],                    // XY 平面（赤道）
  [Math.PI / 2, 0, 0],          // XZ 平面
  [0, Math.PI / 2, 0],          // YZ 平面
];

function CircumSphereRenderer({ entity }: { entity: Entity }) {
  const csEntity = entity as Entity<'circumSphere'>;
  const { geometryId } = csEntity.properties;

  const geometryType = useEntityStore((s) => {
    const e = s.entities[geometryId];
    return e?.type === 'geometry' ? (e.properties as GeometryProperties).geometryType : undefined;
  });
  const geometryParams = useEntityStore((s) => {
    const e = s.entities[geometryId];
    return e?.type === 'geometry' ? (e.properties as GeometryProperties).params : undefined;
  });

  const sphere = useMemo(() => {
    if (!geometryType || !geometryParams) return null;
    return computeCircumscribedSphere(
      geometryType,
      geometryParams as unknown as Record<string, number>,
    );
  }, [geometryType, geometryParams]);

  const circleGeo = useMemo(() => {
    if (!sphere) return null;
    return createCircleGeometry(sphere.radius);
  }, [sphere]);

  if (!sphere || !circleGeo) return null;

  return (
    <group>
      <group position={sphere.center}>
        {GREAT_CIRCLE_ROTATIONS.map((rotation, i) => (
          <lineLoop key={i} geometry={circleGeo} rotation={rotation}>
            <lineBasicMaterial color="#7c3aed" transparent opacity={0.7} depthWrite={false} />
          </lineLoop>
        ))}
      </group>
      <Html
        position={[
          sphere.center[0],
          sphere.center[1] + sphere.radius + 0.2,
          sphere.center[2],
        ]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            fontSize: 11,
            color: '#8b5cf6',
            background: 'rgba(255,255,255,0.9)',
            padding: '1px 5px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          R = {sphere.radius.toFixed(2)}
        </div>
      </Html>
    </group>
  );
}

registerRenderer('circumSphere', CircumSphereRenderer);

export { CircumSphereRenderer };
