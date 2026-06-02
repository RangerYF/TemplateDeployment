import { useMemo } from 'react';
import * as THREE from 'three';
import { Html, Line } from '@react-three/drei';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { computeCircumscribedSphere } from '@/engine/math/circumscribedSphere';
import { useBuilderResult } from '@/editor/builderCache';
import type { Vec3 } from '@/engine/types';
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
  const { geometryId, showAuxLines } = csEntity.properties;

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

  const builderResult = useBuilderResult(geometryId);

  const auxLineTargets = useMemo<Vec3[]>(() => {
    if (!showAuxLines || !builderResult) return [];
    if (builderResult.kind === 'polyhedron') {
      return builderResult.vertices.map((v) => v.position);
    }
    if (builderResult.kind === 'surface') {
      return builderResult.featurePoints.map((p) => p.position);
    }
    return [];
  }, [showAuxLines, builderResult]);

  if (!sphere || !circleGeo) return null;

  return (
    <group>
      <group position={sphere.center}>
        <mesh renderOrder={-2}>
          <sphereGeometry args={[sphere.radius, 64, 32]} />
          <meshBasicMaterial
            color="#8b5cf6"
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {GREAT_CIRCLE_ROTATIONS.map((rotation, i) => (
          <lineLoop key={i} geometry={circleGeo} rotation={rotation}>
            <lineBasicMaterial color="#7c3aed" transparent opacity={0.7} depthWrite={false} />
          </lineLoop>
        ))}
        {/* 球心标记 */}
        <mesh>
          <sphereGeometry args={[0.04, 16, 16]} />
          <meshBasicMaterial color="#8b5cf6" />
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
            color: '#8b5cf6',
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
      {/* 辅助虚线：球心到每个顶点 */}
      {auxLineTargets.map((target, i) => (
        <Line
          key={i}
          points={[sphere.center, target]}
          color="#a78bfa"
          lineWidth={1.5}
          dashed
          dashSize={0.06}
          gapSize={0.04}
        />
      ))}
    </group>
  );
}

registerRenderer('circumSphere', CircumSphereRenderer);

export { CircumSphereRenderer };
