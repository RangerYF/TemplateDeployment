import { useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { computeInscribedSphere } from '@/engine/math/inscribedSphere';
import { useBuilderResult } from '@/editor/builderCache';
import type { Vec3 } from '@/engine/types';
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

function computeTangentPoints(
  center: Vec3,
  faces: number[][],
  vertices: { position: Vec3 }[],
): Vec3[] {
  const sc = new THREE.Vector3(...center);
  const tangents: Vec3[] = [];
  for (const face of faces) {
    if (face.length < 3) continue;
    const v0 = new THREE.Vector3(...vertices[face[0]].position);
    const v1 = new THREE.Vector3(...vertices[face[1]].position);
    const v2 = new THREE.Vector3(...vertices[face[2]].position);
    const e1 = new THREE.Vector3().subVectors(v1, v0);
    const e2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();
    const toCenter = new THREE.Vector3().subVectors(sc, v0);
    const dist = toCenter.dot(normal);
    const tp = sc.clone().addScaledVector(normal, -dist);
    tangents.push([tp.x, tp.y, tp.z]);
  }
  return tangents;
}

function InSphereRenderer({ entity }: { entity: Entity }) {
  const isEntity = entity as Entity<'inSphere'>;
  const { geometryId, showAuxLines } = isEntity.properties;

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

  const builderResult = useBuilderResult(geometryId);

  const auxLineTargets = useMemo<Vec3[]>(() => {
    if (!showAuxLines || !sphere || !builderResult) return [];
    if (builderResult.kind === 'polyhedron') {
      return computeTangentPoints(sphere.center, builderResult.faces, builderResult.vertices);
    }
    return [];
  }, [showAuxLines, sphere, builderResult]);

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
        {/* 球心标记 */}
        <mesh>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>
      </group>
      {/* 球心标签 */}
      <Html
        position={[
          sphere.center[0] + 0.08,
          sphere.center[1] + 0.08,
          sphere.center[2],
        ]}
        center
        distanceFactor={8}
        style={{ pointerEvents: 'none' }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#d97706',
            background: 'rgba(255,255,255,0.9)',
            padding: '0px 3px',
            borderRadius: 2,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          O
        </div>
      </Html>
      {/* 半径标签 */}
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
      {/* 辅助虚线：球心到每个面的切点 */}
      {auxLineTargets.map((target, i) => (
        <Line
          key={i}
          points={[sphere.center, target]}
          color="#fbbf24"
          lineWidth={1.5}
          dashed
          dashSize={0.06}
          gapSize={0.04}
        />
      ))}
    </group>
  );
}

registerRenderer('inSphere', InSphereRenderer);

export { InSphereRenderer };
