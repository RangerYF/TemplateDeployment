/**
 * PolyhedronRenderer - Renders coordination polyhedra in polyhedral mode.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { AtomInstance, PolyhedronDef } from '@/engine/types';

interface PolyhedronRendererProps {
  atoms: AtomInstance[];
  polyhedra: PolyhedronDef[];
}

// Color mapping by polyhedron type
const POLY_COLORS: Record<string, string> = {
  tetrahedron: '#4FC3F7',
  octahedron: '#FFB74D',
  cube: '#81C784',
  trigonalPrism: '#CE93D8',
  other: '#90A4AE',
};

function SinglePolyhedron({
  center,
  neighbors,
  polyType,
}: {
  center: AtomInstance;
  neighbors: THREE.Vector3[];
  polyType: string;
}) {
  const { faceGeo, edgeGeo } = useMemo(() => {
    if (neighbors.length < 3) return { faceGeo: null, edgeGeo: null };
    try {
      const convex = new ConvexGeometry(neighbors);
      const edges = new THREE.EdgesGeometry(convex);
      return { faceGeo: convex, edgeGeo: edges };
    } catch {
      return { faceGeo: null, edgeGeo: null };
    }
  }, [neighbors]);

  if (!faceGeo || !edgeGeo) return null;

  const color = POLY_COLORS[polyType] ?? POLY_COLORS.other;

  // Suppress unused-var lint for center (kept for future label usage)
  void center;

  return (
    <group>
      {/* Semi-transparent faces */}
      <mesh geometry={faceGeo}>
        <meshStandardMaterial
          color={color}
          transparent
          opacity={0.25}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* Wireframe edges */}
      <lineSegments geometry={edgeGeo}>
        <lineBasicMaterial color={color} linewidth={1} />
      </lineSegments>
    </group>
  );
}

export function PolyhedronRenderer({ atoms, polyhedra }: PolyhedronRendererProps) {
  const polyhedronInstances = useMemo(() => {
    const instances: {
      center: AtomInstance;
      neighbors: THREE.Vector3[];
      polyType: string;
    }[] = [];

    for (const polyDef of polyhedra) {
      // Find all atoms matching this site index (across all cells)
      const centers = atoms.filter((a) => a.siteIndex === polyDef.centerSiteIndex);

      for (const center of centers) {
        const centerPos = new THREE.Vector3(...center.position);
        const neighborVecs: THREE.Vector3[] = [];

        for (const atom of atoms) {
          if (atom.index === center.index) continue;
          const pos = new THREE.Vector3(...atom.position);
          const dist = centerPos.distanceTo(pos);
          if (dist > 0.1 && dist <= polyDef.neighborCutoff) {
            neighborVecs.push(pos);
          }
        }

        if (neighborVecs.length >= 3) {
          instances.push({
            center,
            neighbors: neighborVecs,
            polyType: polyDef.polyhedronType,
          });
        }
      }
    }

    return instances;
  }, [atoms, polyhedra]);

  return (
    <group>
      {polyhedronInstances.map((inst, i) => (
        <SinglePolyhedron
          key={i}
          center={inst.center}
          neighbors={inst.neighbors}
          polyType={inst.polyType}
        />
      ))}
    </group>
  );
}
