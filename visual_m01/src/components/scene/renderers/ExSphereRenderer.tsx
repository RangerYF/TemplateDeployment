import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Entity, GeometryProperties } from '@/editor/entities/types';
import { useEntityStore } from '@/editor/store';
import { computeEscribedSpheres } from '@/engine/math/escribedSphere';
import { buildGeometry } from '@/engine/builders';
import type { PolyhedronResult } from '@/engine/types';
import { registerRenderer } from './index';

const SPHERE_COLOR = '#10b981';
const WIRE_COLOR = '#059669';

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

function ExSphereRenderer({ entity }: { entity: Entity }) {
  const esEntity = entity as Entity<'exSphere'>;
  const { geometryId, faceIndex } = esEntity.properties;

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
    const all = computeEscribedSpheres(
      geometryType,
      geometryParams as unknown as Record<string, number>,
    );
    return all?.find((s) => s.faceIndex === faceIndex) ?? null;
  }, [geometryType, geometryParams, faceIndex]);

  const faceVertsList = useMemo(() => {
    if (!geometryType || !geometryParams) return null;
    const result = buildGeometry(geometryType, geometryParams as never);
    if (!result || result.kind !== 'polyhedron') return null;
    const poly = result as PolyhedronResult;
    return poly.faces.map((face) =>
      face.map((vi) => new THREE.Vector3(...poly.vertices[vi].position)),
    );
  }, [geometryType, geometryParams]);

  if (!sphere) return null;

  return (
    <ExSphereItem sphere={sphere} faceVertsList={faceVertsList} />
  );
}

interface ExtPlane {
  triGeo: THREE.BufferGeometry;
  borderVerts: THREE.Vector3[];
}

function ExSphereItem({
  sphere,
  faceVertsList,
}: {
  sphere: { faceIndex: number; center: [number, number, number]; radius: number; faceLabel: string };
  faceVertsList: THREE.Vector3[][] | null;
}) {
  const circleGeo = useMemo(() => createCircleGeometry(sphere.radius), [sphere.radius]);

  const extendedPlanes = useMemo(() => {
    if (!faceVertsList) return [];
    const sCenter = new THREE.Vector3(...sphere.center);
    const planes: ExtPlane[] = [];

    for (let i = 0; i < faceVertsList.length; i++) {
      if (i === sphere.faceIndex) continue;
      const verts = faceVertsList[i];
      if (verts.length < 3) continue;

      const centroid = new THREE.Vector3();
      for (const v of verts) centroid.add(v);
      centroid.divideScalar(verts.length);

      const e1 = new THREE.Vector3().subVectors(verts[1], verts[0]);
      const e2 = new THREE.Vector3().subVectors(verts[2], verts[0]);
      const normal = new THREE.Vector3().crossVectors(e1, e2).normalize();

      const toCenter = new THREE.Vector3().subVectors(sCenter, verts[0]);
      const dist = toCenter.dot(normal);
      const tangentPoint = sCenter.clone().addScaledVector(normal, -dist);

      const maxR = Math.max(...verts.map((v) => v.distanceTo(centroid)));
      const tDist = tangentPoint.distanceTo(centroid);
      const scale = Math.max(2.5, (tDist + sphere.radius * 0.3) / Math.max(maxR, 0.01) + 0.5);

      const extVerts = verts.map((v) => {
        const dir = new THREE.Vector3().subVectors(v, centroid);
        return centroid.clone().addScaledVector(dir, scale);
      });

      const positions: number[] = [];
      const indices: number[] = [];
      for (const ev of extVerts) positions.push(ev.x, ev.y, ev.z);
      for (let j = 1; j < extVerts.length - 1; j++) indices.push(0, j, j + 1);

      const triGeo = new THREE.BufferGeometry();
      triGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      triGeo.setIndex(indices);
      triGeo.computeVertexNormals();

      planes.push({ triGeo, borderVerts: extVerts });
    }

    return planes;
  }, [faceVertsList, sphere.faceIndex, sphere.center, sphere.radius]);

  const borderGeos = useMemo(
    () => extendedPlanes.map((ep) => new THREE.BufferGeometry().setFromPoints(ep.borderVerts)),
    [extendedPlanes],
  );

  return (
    <group>
      <group position={sphere.center}>
        <mesh renderOrder={-2}>
          <sphereGeometry args={[sphere.radius, 64, 32]} />
          <meshBasicMaterial
            color={SPHERE_COLOR}
            transparent
            opacity={0.08}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        {GREAT_CIRCLE_ROTATIONS.map((rotation, i) => (
          <lineLoop key={i} geometry={circleGeo} rotation={rotation}>
            <lineBasicMaterial color={WIRE_COLOR} transparent opacity={0.5} depthWrite={false} />
          </lineLoop>
        ))}
      </group>

      {extendedPlanes.map((ep, i) => (
        <group key={i}>
          <mesh geometry={ep.triGeo} renderOrder={-3}>
            <meshBasicMaterial
              color={SPHERE_COLOR}
              transparent
              opacity={0.08}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
          <lineLoop geometry={borderGeos[i]}>
            <lineBasicMaterial color={WIRE_COLOR} transparent opacity={0.3} depthWrite={false} />
          </lineLoop>
        </group>
      ))}

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
            color: WIRE_COLOR,
            background: 'rgba(255,255,255,0.9)',
            padding: '1px 5px',
            borderRadius: 3,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          旁{sphere.faceLabel} r = {sphere.radius.toFixed(2)}
        </div>
      </Html>
    </group>
  );
}

registerRenderer('exSphere', ExSphereRenderer);

export { ExSphereRenderer };
