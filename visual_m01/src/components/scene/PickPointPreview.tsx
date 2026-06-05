import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { pickPointPreviewState } from './pickPointPreviewState';

const POINT_COLOR = '#ef4444';
const POINT_RADIUS = 0.04;

export function PickPointPreview() {
  const groupRef = useRef<THREE.Group>(null!);
  const visibleRef = useRef(false);

  useFrame(() => {
    if (!groupRef.current) return;
    const { active, position } = pickPointPreviewState;
    if (active && position) {
      groupRef.current.position.set(position[0], position[1], position[2]);
      if (!visibleRef.current) {
        groupRef.current.visible = true;
        visibleRef.current = true;
      }
    } else if (visibleRef.current) {
      groupRef.current.visible = false;
      visibleRef.current = false;
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      <mesh>
        <sphereGeometry args={[POINT_RADIUS, 12, 12]} />
        <meshBasicMaterial color={POINT_COLOR} />
      </mesh>
      <PickPointLabel />
    </group>
  );
}

function PickPointLabel() {
  const ref = useRef<HTMLDivElement>(null);

  useFrame(() => {
    if (!ref.current) return;
    const { active, distance } = pickPointPreviewState;
    if (active && pickPointPreviewState.position) {
      ref.current.textContent = distance.toFixed(2);
      ref.current.style.display = 'block';
    } else {
      ref.current.style.display = 'none';
    }
  });

  return (
    <Html
      center
      style={{ pointerEvents: 'none' }}
      position={[0, 0.1, 0]}
    >
      <div
        ref={ref}
        style={{
          background: 'rgba(0,0,0,0.7)',
          color: '#fff',
          padding: '1px 5px',
          borderRadius: 3,
          fontSize: 11,
          whiteSpace: 'nowrap',
          display: 'none',
        }}
      />
    </Html>
  );
}
