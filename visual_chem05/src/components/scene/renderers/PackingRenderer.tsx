/**
 * PackingRenderer - Renders sphere packing demonstrations.
 *
 * Generates sphere positions for SC / BCC / FCC / HCP arrangements
 * and renders them as semi-transparent equal-radius spheres.
 * Layers are revealed incrementally via packingStep.
 * Optionally shows voids via VoidRenderer.
 */

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { useCrystalStore } from '@/store';
import type { PackingType, Vec3 } from '@/engine/types';
import { VoidRenderer } from './VoidRenderer';

const SPHERE_RADIUS = 0.5;
const SPHERE_COLOR = '#90CAF9';
const SPHERE_OPACITY = 0.55;

const sphereGeometry = new THREE.SphereGeometry(1, 32, 32);

// ---------------------------------------------------------------------------
// Position generators for each packing type
// ---------------------------------------------------------------------------

/** Generate SC positions. Each layer is one y-level. */
function generateSC(layers: number): Vec3[] {
  const positions: Vec3[] = [];
  const d = SPHERE_RADIUS * 2;
  for (let y = 0; y < layers; y++) {
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        positions.push([x * d, y * d, z * d]);
      }
    }
  }
  return positions;
}

/** Generate BCC positions: SC grid + body-centered atoms. */
function generateBCC(layers: number): Vec3[] {
  const positions: Vec3[] = [];
  const d = SPHERE_RADIUS * 2;
  for (let y = 0; y < layers; y++) {
    // Corner atoms
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        positions.push([x * d, y * d, z * d]);
      }
    }
    // Body center atoms (offset by half cell in each direction)
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        positions.push([
          x * d + SPHERE_RADIUS,
          y * d + SPHERE_RADIUS,
          z * d + SPHERE_RADIUS,
        ]);
      }
    }
  }
  return positions;
}

/** Generate FCC positions: SC grid + face-centered atoms. */
function generateFCC(layers: number): Vec3[] {
  const positions: Vec3[] = [];
  const d = SPHERE_RADIUS * 2;
  for (let y = 0; y < layers; y++) {
    // Corner atoms
    for (let x = 0; x < 3; x++) {
      for (let z = 0; z < 3; z++) {
        positions.push([x * d, y * d, z * d]);
      }
    }
    // Face centers on xy plane (top & bottom of cell)
    for (let x = 0; x < 2; x++) {
      for (let z = 0; z < 2; z++) {
        // xz face center
        positions.push([x * d + SPHERE_RADIUS, y * d, z * d + SPHERE_RADIUS]);
        // xy face center
        positions.push([x * d + SPHERE_RADIUS, y * d + SPHERE_RADIUS, z * d]);
        // yz face center
        positions.push([x * d, y * d + SPHERE_RADIUS, z * d + SPHERE_RADIUS]);
      }
    }
  }
  return positions;
}

/** Generate HCP positions: ABABAB hex layers. */
function generateHCP(layers: number): Vec3[] {
  const positions: Vec3[] = [];
  const d = SPHERE_RADIUS * 2;
  const rowSpacing = d * Math.sqrt(3) / 2;
  const layerHeight = d * Math.sqrt(2 / 3);

  for (let y = 0; y < layers; y++) {
    const isB = y % 2 === 1;
    const xOff = isB ? SPHERE_RADIUS : 0;
    const zOff = isB ? rowSpacing / 3 : 0;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        positions.push([
          col * d + (row % 2 === 1 ? SPHERE_RADIUS : 0) + xOff,
          y * layerHeight,
          row * rowSpacing + zOff,
        ]);
      }
    }
  }
  return positions;
}

const GENERATORS: Record<PackingType, (layers: number) => Vec3[]> = {
  SC: generateSC,
  BCC: generateBCC,
  FCC: generateFCC,
  HCP: generateHCP,
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function PackingRenderer() {
  const packingType = useCrystalStore((s) => s.packingType);
  const packingStep = useCrystalStore((s) => s.packingStep);
  const packingMaxSteps = useCrystalStore((s) => s.packingMaxSteps);
  const packingPlaying = useCrystalStore((s) => s.packingPlaying);
  const packingSpeed = useCrystalStore((s) => s.packingSpeed);
  const setPackingStep = useCrystalStore((s) => s.setPackingStep);
  const showVoids = useCrystalStore((s) => s.showVoids);
  const voidType = useCrystalStore((s) => s.voidType);

  useEffect(() => {
    if (!packingPlaying) {
      return undefined;
    }

    const intervalMs = Math.max(120, Math.round(700 / packingSpeed));
    const timer = window.setInterval(() => {
      const { packingStep: currentStep, packingMaxSteps: maxSteps } = useCrystalStore.getState();
      const nextStep = currentStep >= maxSteps ? 0 : currentStep + 1;
      setPackingStep(nextStep);
    }, intervalMs);

    return () => {
      window.clearInterval(timer);
    };
  }, [packingPlaying, packingSpeed, setPackingStep]);

  // Number of layers to show (at least 1)
  const clampedStep = Math.min(packingStep, packingMaxSteps);
  const layerCount = Math.max(1, clampedStep + 1);

  const positions = useMemo(
    () => GENERATORS[packingType](layerCount),
    [packingType, layerCount],
  );

  // Center the packing around origin
  const centroid = useMemo(() => {
    if (positions.length === 0) return [0, 0, 0] as Vec3;
    const sum: Vec3 = [0, 0, 0];
    for (const p of positions) {
      sum[0] += p[0];
      sum[1] += p[1];
      sum[2] += p[2];
    }
    return [
      sum[0] / positions.length,
      sum[1] / positions.length,
      sum[2] / positions.length,
    ] as Vec3;
  }, [positions]);

  return (
    <group position={[-centroid[0], -centroid[1], -centroid[2]]}>
      {/* Packing spheres */}
      {positions.map((pos, i) => (
        <mesh
          key={i}
          position={pos as unknown as [number, number, number]}
          scale={[SPHERE_RADIUS, SPHERE_RADIUS, SPHERE_RADIUS]}
          geometry={sphereGeometry}
        >
          <meshStandardMaterial
            color={SPHERE_COLOR}
            transparent
            opacity={SPHERE_OPACITY}
            metalness={0.05}
            roughness={0.8}
            depthWrite={false}
          />
        </mesh>
      ))}

      {/* Void positions */}
      {showVoids && (
        <VoidRenderer
          packingType={packingType}
          layerCount={layerCount}
          voidType={voidType}
        />
      )}
    </group>
  );
}
