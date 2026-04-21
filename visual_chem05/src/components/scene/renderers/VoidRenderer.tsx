/**
 * VoidRenderer - Renders tetrahedral and octahedral void positions
 * within sphere packing structures.
 *
 * Voids are shown as small semi-transparent spheres at computed positions:
 *   - Tetrahedral voids (red-ish, smaller)
 *   - Octahedral voids (blue-ish, slightly larger)
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { PackingType, Vec3 } from '@/engine/types';

interface VoidRendererProps {
  packingType: PackingType;
  layerCount: number;
  voidType: 'tetrahedral' | 'octahedral' | 'all';
}

const SPHERE_RADIUS = 0.5;

const TETRA_VOID_COLOR = '#EF5350'; // red-ish
const TETRA_VOID_RADIUS = 0.12;
const TETRA_VOID_OPACITY = 0.65;

const OCTA_VOID_COLOR = '#42A5F5'; // blue-ish
const OCTA_VOID_RADIUS = 0.18;
const OCTA_VOID_OPACITY = 0.65;

const sphereGeometry = new THREE.SphereGeometry(1, 16, 16);

// ---------------------------------------------------------------------------
// Void position generators
// ---------------------------------------------------------------------------

/**
 * For FCC packing:
 *   - Octahedral voids: at edge midpoints and body center (e.g., [0.5, 0, 0])
 *   - Tetrahedral voids: at 1/4 and 3/4 positions along body diagonal
 */
function generateFCCVoids(
  layers: number,
  type: 'tetrahedral' | 'octahedral' | 'all',
): { tetra: Vec3[]; octa: Vec3[] } {
  const d = SPHERE_RADIUS * 2;
  const tetra: Vec3[] = [];
  const octa: Vec3[] = [];

  for (let y = 0; y < layers; y++) {
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        if (type === 'octahedral' || type === 'all') {
          // Octahedral void at edge center positions
          octa.push([
            x * d + SPHERE_RADIUS,
            y * d + SPHERE_RADIUS,
            z * d,
          ]);
          octa.push([
            x * d + SPHERE_RADIUS,
            y * d,
            z * d + SPHERE_RADIUS,
          ]);
          octa.push([
            x * d,
            y * d + SPHERE_RADIUS,
            z * d + SPHERE_RADIUS,
          ]);
        }

        if (type === 'tetrahedral' || type === 'all') {
          // Tetrahedral voids at 1/4, 3/4 along body diagonal
          const quarter = SPHERE_RADIUS * 0.5;
          tetra.push([
            x * d + quarter,
            y * d + quarter,
            z * d + quarter,
          ]);
          tetra.push([
            x * d + 3 * quarter,
            y * d + 3 * quarter,
            z * d + 3 * quarter,
          ]);
        }
      }
    }
  }

  return { tetra, octa };
}

/**
 * For BCC packing:
 *   - Octahedral voids: at face centers and edge midpoints
 *   - Tetrahedral voids: along edges at 1/4 positions
 */
function generateBCCVoids(
  layers: number,
  type: 'tetrahedral' | 'octahedral' | 'all',
): { tetra: Vec3[]; octa: Vec3[] } {
  const d = SPHERE_RADIUS * 2;
  const tetra: Vec3[] = [];
  const octa: Vec3[] = [];

  for (let y = 0; y < layers; y++) {
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        if (type === 'octahedral' || type === 'all') {
          // Octahedral voids at face-center positions
          octa.push([x * d + SPHERE_RADIUS, y * d, z * d]);
          octa.push([x * d, y * d + SPHERE_RADIUS, z * d]);
          octa.push([x * d, y * d, z * d + SPHERE_RADIUS]);
        }

        if (type === 'tetrahedral' || type === 'all') {
          // Tetrahedral voids at edge 1/4 positions
          const q = SPHERE_RADIUS * 0.5;
          tetra.push([x * d + q, y * d + SPHERE_RADIUS, z * d]);
          tetra.push([x * d + SPHERE_RADIUS, y * d + q, z * d]);
          tetra.push([x * d, y * d + q, z * d + SPHERE_RADIUS]);
        }
      }
    }
  }

  return { tetra, octa };
}

/**
 * For HCP packing:
 *   - Octahedral voids between layers
 *   - Tetrahedral voids above/below each sphere
 */
function generateHCPVoids(
  layers: number,
  type: 'tetrahedral' | 'octahedral' | 'all',
): { tetra: Vec3[]; octa: Vec3[] } {
  const d = SPHERE_RADIUS * 2;
  const rowSpacing = d * Math.sqrt(3) / 2;
  const layerHeight = d * Math.sqrt(2 / 3);
  const tetra: Vec3[] = [];
  const octa: Vec3[] = [];

  for (let y = 0; y < Math.max(1, layers - 1); y++) {
    const isB = y % 2 === 1;
    const xOff = isB ? SPHERE_RADIUS : 0;
    const zOff = isB ? rowSpacing / 3 : 0;
    const midY = y * layerHeight + layerHeight / 2;

    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 2; col++) {
        const baseX = col * d + (row % 2 === 1 ? SPHERE_RADIUS : 0) + xOff;
        const baseZ = row * rowSpacing + zOff;

        if (type === 'octahedral' || type === 'all') {
          octa.push([
            baseX + SPHERE_RADIUS * 0.67,
            midY,
            baseZ + rowSpacing * 0.33,
          ]);
        }

        if (type === 'tetrahedral' || type === 'all') {
          tetra.push([
            baseX + SPHERE_RADIUS * 0.33,
            midY - layerHeight * 0.15,
            baseZ + rowSpacing * 0.2,
          ]);
          tetra.push([
            baseX + SPHERE_RADIUS * 0.33,
            midY + layerHeight * 0.15,
            baseZ + rowSpacing * 0.2,
          ]);
        }
      }
    }
  }

  return { tetra, octa };
}

/**
 * SC packing: has octahedral voids at body center, no tetrahedral voids.
 */
function generateSCVoids(
  layers: number,
  type: 'tetrahedral' | 'octahedral' | 'all',
): { tetra: Vec3[]; octa: Vec3[] } {
  const d = SPHERE_RADIUS * 2;
  const tetra: Vec3[] = [];
  const octa: Vec3[] = [];

  if (type === 'octahedral' || type === 'all') {
    for (let y = 0; y < layers; y++) {
      for (let x = 0; x < 2; x++) {
        for (let z = 0; z < 2; z++) {
          // Body center of each cube
          octa.push([
            x * d + SPHERE_RADIUS,
            y * d + SPHERE_RADIUS,
            z * d + SPHERE_RADIUS,
          ]);
        }
      }
    }
  }

  return { tetra, octa };
}

const VOID_GENERATORS: Record<
  PackingType,
  (layers: number, type: 'tetrahedral' | 'octahedral' | 'all') => { tetra: Vec3[]; octa: Vec3[] }
> = {
  SC: generateSCVoids,
  BCC: generateBCCVoids,
  FCC: generateFCCVoids,
  HCP: generateHCPVoids,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function VoidRenderer({ packingType, layerCount, voidType }: VoidRendererProps) {
  const { tetra, octa } = useMemo(
    () => VOID_GENERATORS[packingType](layerCount, voidType),
    [packingType, layerCount, voidType],
  );

  return (
    <group>
      {/* Tetrahedral voids */}
      {tetra.map((pos, i) => (
        <mesh
          key={`t-${i}`}
          position={pos as unknown as [number, number, number]}
          scale={[TETRA_VOID_RADIUS, TETRA_VOID_RADIUS, TETRA_VOID_RADIUS]}
          geometry={sphereGeometry}
        >
          <meshStandardMaterial
            color={TETRA_VOID_COLOR}
            transparent
            opacity={TETRA_VOID_OPACITY}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Octahedral voids */}
      {octa.map((pos, i) => (
        <mesh
          key={`o-${i}`}
          position={pos as unknown as [number, number, number]}
          scale={[OCTA_VOID_RADIUS, OCTA_VOID_RADIUS, OCTA_VOID_RADIUS]}
          geometry={sphereGeometry}
        >
          <meshStandardMaterial
            color={OCTA_VOID_COLOR}
            transparent
            opacity={OCTA_VOID_OPACITY}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}
