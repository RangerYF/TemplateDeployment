import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { computeInscribedSphere } from '@/engine/math/inscribedSphere';
import { registerRenderer } from './index';

function createCircleGeometry(radius: number, segments = 64): THREE.BufferGeometry {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i < segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
  }
  return new THREE.BufferGeometry().setFromPoints(points);
}

const GREAT_CIRCLE_ROTATIONS: [number, number, number][] = [
  [0, 0, 0],
  [Math.PI / 2, 0, 0],
  [0, Math.PI / 2, 0],
];

function InSphereRenderer({ entity }: { entity: Entity }) {
  const isEntity = entity as Entity<'inSphere'>;
  const { geometryId } = isEntity.properties;

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
    return computeInscribedSphere(
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
        <mesh renderOrder={-2}>
          <sphereGeometry args={[sphere.radius, 64, 32]} />
          <meshBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {GREAT_CIRCLE_ROTATIONS.map((rotation, i) => (
          <lineLoop key={i} geometry={circleGeo} rotation={rotation}>
            <lineBasicMaterial color="#d97706" transparent opacity={0.7} depthWrite={false} />
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
            color: '#d97706',
            background: 'rgba(255,255,255,0.9)',
            padding: '1px 5px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          r = {sphere.radius.toFixed(2)}
        </div>
      </Html>
    </group>
  );
}

registerRenderer('inSphere', InSphereRenderer);

export { InSphereRenderer };
