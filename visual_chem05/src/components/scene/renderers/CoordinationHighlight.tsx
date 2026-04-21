/**
 * CoordinationHighlight - Visualises the coordination shell around
 * a highlighted (clicked) atom.
 *
 * Renders:
 * 1. Lines from the central atom to each coordination neighbor.
 * 2. A semi-transparent polyhedron (convex hull) connecting neighbors.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';
import type { AtomInstance } from '@/engine/types';

interface CoordinationHighlightProps {
  atoms: AtomInstance[];
  centerIdx: number | null;
  neighborIndices: number[];
}

const LINE_COLOR = '#FFD700';
const POLY_COLOR = '#FFD700';
const POLY_OPACITY = 0.15;

// ---------------------------------------------------------------------------
// Radial lines from center to each neighbor
// ---------------------------------------------------------------------------

function RadialLines({
  center,
  neighbors,
}: {
  center: [number, number, number];
  neighbors: [number, number, number][];
}) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const n of neighbors) {
      positions.push(center[0], center[1], center[2]);
      positions.push(n[0], n[1], n[2]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(positions, 3),
    );
    return geo;
  }, [center, neighbors]);

  const material = useMemo(
    () =>
      new THREE.LineDashedMaterial({
        color: LINE_COLOR,
        dashSize: 0.12,
        gapSize: 0.08,
        linewidth: 1,
      }),
    [],
  );

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      onUpdate={(line) => line.computeLineDistances()}
    />
  );
}

// ---------------------------------------------------------------------------
// Semi-transparent convex polyhedron
// ---------------------------------------------------------------------------

function CoordinationPolyhedron({
  neighborPositions,
}: {
  neighborPositions: [number, number, number][];
}) {
  const geometry = useMemo(() => {
    if (neighborPositions.length < 4) return null;
    const points = neighborPositions.map(
      (p) => new THREE.Vector3(p[0], p[1], p[2]),
    );
    try {
      return new ConvexGeometry(points);
    } catch {
      // ConvexGeometry may fail for degenerate cases
      return null;
    }
  }, [neighborPositions]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={POLY_COLOR}
        transparent
        opacity={POLY_OPACITY}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CoordinationHighlight({
  atoms,
  centerIdx,
  neighborIndices,
}: CoordinationHighlightProps) {
  if (centerIdx === null || neighborIndices.length === 0) return null;

  const centerAtom = atoms[centerIdx];
  if (!centerAtom) return null;

  const center = centerAtom.position as [number, number, number];

  const neighborPositions = useMemo(
    () =>
      neighborIndices
        .map((i) => atoms[i]?.position as [number, number, number] | undefined)
        .filter((p): p is [number, number, number] => p !== undefined),
    [neighborIndices, atoms],
  );

  return (
    <group>
      <RadialLines center={center} neighbors={neighborPositions} />
      <CoordinationPolyhedron neighborPositions={neighborPositions} />
    </group>
  );
}
