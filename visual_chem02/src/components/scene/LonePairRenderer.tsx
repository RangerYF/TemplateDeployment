/**
 * 孤电子对渲染器
 * 使用半透明椭球体表示孤电子对
 */

import * as THREE from 'three';
import { useMemo } from 'react';
import type { LonePair3D, Atom3D } from '@/engine/types';

interface LonePairRendererProps {
  lonePair: LonePair3D;
  atoms: Atom3D[];
}

export function LonePairRenderer({ lonePair, atoms }: LonePairRendererProps) {
  const centerAtom = atoms[lonePair.centerAtomIndex];

  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    const dir = new THREE.Vector3(...lonePair.direction).normalize();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return q;
  }, [lonePair.direction]);

  if (!centerAtom) return null;

  return (
    <group position={lonePair.position} quaternion={quaternion}>
      {/* 两个小球代表一对孤电子 */}
      <mesh position={[0.06, 0, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color="#B0E0FF"
          transparent
          opacity={0.6}
          roughness={0.5}
        />
      </mesh>
      <mesh position={[-0.06, 0, 0]}>
        <sphereGeometry args={[0.12, 16, 16]} />
        <meshStandardMaterial
          color="#B0E0FF"
          transparent
          opacity={0.6}
          roughness={0.5}
        />
      </mesh>
    </group>
  );
}
