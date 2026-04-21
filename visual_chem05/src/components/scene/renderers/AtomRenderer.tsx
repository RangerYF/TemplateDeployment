/**
 * AtomRenderer - Renders crystal atoms as 3D spheres.
 *
 * Each atom is a <mesh> with sphereGeometry, colored by element.
 * Supports click-to-highlight and neighbor highlighting.
 */

import { useRef, useCallback } from 'react';
import * as THREE from 'three';
import type { AtomInstance } from '@/engine/types';
import { useCrystalStore } from '@/store';

interface AtomRendererProps {
  atoms: AtomInstance[];
}

const HIGHLIGHT_EMISSIVE = new THREE.Color('#FFD700'); // yellow for selected
const NEIGHBOR_EMISSIVE = new THREE.Color('#00E5FF'); // cyan for neighbors
const DEFAULT_EMISSIVE = new THREE.Color('#000000');

const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);

export function AtomRenderer({ atoms }: AtomRendererProps) {
  const highlightedAtomIdx = useCrystalStore((s) => s.highlightedAtomIdx);
  const highlightedNeighbors = useCrystalStore((s) => s.highlightedNeighbors);
  const setHighlightedAtom = useCrystalStore((s) => s.setHighlightedAtom);

  const neighborSet = useRef(new Set<number>());
  neighborSet.current = new Set(highlightedNeighbors);

  const handleClick = useCallback(
    (idx: number) => {
      // Toggle: clicking the same atom deselects
      setHighlightedAtom(highlightedAtomIdx === idx ? null : idx);
    },
    [highlightedAtomIdx, setHighlightedAtom],
  );

  return (
    <group>
      {atoms.map((atom) => {
        const isHighlighted = atom.index === highlightedAtomIdx;
        const isNeighbor = neighborSet.current.has(atom.index);

        let emissive = DEFAULT_EMISSIVE;
        let emissiveIntensity = 0;

        if (isHighlighted) {
          emissive = HIGHLIGHT_EMISSIVE;
          emissiveIntensity = 0.6;
        } else if (isNeighbor) {
          emissive = NEIGHBOR_EMISSIVE;
          emissiveIntensity = 0.4;
        }

        const r = atom.radius;

        return (
          <mesh
            key={atom.index}
            position={atom.position as unknown as [number, number, number]}
            scale={[r, r, r]}
            geometry={sphereGeometry}
            onClick={(e) => {
              e.stopPropagation();
              handleClick(atom.index);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
              document.body.style.cursor = 'pointer';
            }}
            onPointerOut={() => {
              document.body.style.cursor = 'auto';
            }}
          >
            <meshStandardMaterial
              color={atom.color}
              metalness={0.1}
              roughness={0.6}
              emissive={emissive}
              emissiveIntensity={emissiveIntensity}
            />
          </mesh>
        );
      })}
    </group>
  );
}
