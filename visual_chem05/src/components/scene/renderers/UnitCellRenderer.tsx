/**
 * UnitCellRenderer - Renders the unit cell wireframe edges
 * and optional xyz axis indicators.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { Vec3 } from '@/engine/types';
import { useCrystalStore } from '@/store';

interface UnitCellRendererProps {
  vertices: Vec3[];
  edges: [number, number][];
  latticeVectors: [Vec3, Vec3, Vec3];
}

const EDGE_COLOR = '#666666';
const AXIS_LENGTH = 2;
const AXIS_COLORS = {
  x: '#EF4444', // red
  y: '#22C55E', // green
  z: '#3B82F6', // blue
};

// ---------------------------------------------------------------------------
// Single edge as a line segment
// ---------------------------------------------------------------------------

function EdgeLine({ start, end }: { start: Vec3; end: Vec3 }) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      start[0], start[1], start[2],
      end[0], end[1], end[2],
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [start, end]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color: EDGE_COLOR, linewidth: 1 }),
    [],
  );

  return <lineSegments geometry={geometry} material={material} />;
}

// ---------------------------------------------------------------------------
// Axis indicator line
// ---------------------------------------------------------------------------

function AxisLine({
  direction,
  color,
}: {
  direction: [number, number, number];
  color: string;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      0, 0, 0,
      direction[0] * AXIS_LENGTH,
      direction[1] * AXIS_LENGTH,
      direction[2] * AXIS_LENGTH,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [direction]);

  const material = useMemo(
    () => new THREE.LineBasicMaterial({ color, linewidth: 2 }),
    [color],
  );

  return <lineSegments geometry={geometry} material={material} />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function UnitCellRenderer({
  vertices,
  edges,
  latticeVectors,
}: UnitCellRendererProps) {
  const showAxes = useCrystalStore((s) => s.showAxes);

  return (
    <group>
      {/* Unit cell wireframe edges */}
      {edges.map(([i, j], idx) => {
        const start = vertices[i];
        const end = vertices[j];
        if (!start || !end) return null;
        return <EdgeLine key={`e-${idx}`} start={start} end={end} />;
      })}

      {/* Lattice vector axes at origin */}
      {showAxes && (
        <>
          <AxisLine
            direction={[
              latticeVectors[0][0],
              latticeVectors[0][1],
              latticeVectors[0][2],
            ]}
            color={AXIS_COLORS.x}
          />
          <AxisLine
            direction={[
              latticeVectors[1][0],
              latticeVectors[1][1],
              latticeVectors[1][2],
            ]}
            color={AXIS_COLORS.y}
          />
          <AxisLine
            direction={[
              latticeVectors[2][0],
              latticeVectors[2][1],
              latticeVectors[2][2],
            ]}
            color={AXIS_COLORS.z}
          />
        </>
      )}
    </group>
  );
}
