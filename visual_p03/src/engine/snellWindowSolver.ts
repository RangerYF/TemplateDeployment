/**
 * snellWindowSolver.ts
 * 3D computation helpers for the Snell's Window (opt-006) experiment.
 *
 * Ported from phys_template_p03/src/module-refraction-3d.tsx.
 * All functions return THREE.Vector3 arrays representing geometry in the
 * coordinate system where y=0 is the water surface and y<0 is underwater.
 */

import * as THREE from 'three';
import type { SnellSourceShape } from '@/data/refractionData';

// ---------------------------------------------------------------------------
// Source sample points
// ---------------------------------------------------------------------------

/**
 * Generate 3D sample emitter positions for the underwater light source.
 *
 * - point:   a single point at (0, -depth, 0)
 * - line:    `lineSamples` points evenly spaced along the x-axis
 * - polygon: center + vertices + midpoints on the circumscribed circle
 */
export function sourceSamplePoints(
  shape: SnellSourceShape | undefined,
  size: number,
  sides: number,
  depth: number,
  lineSamples: number = 7,
): THREE.Vector3[] {
  if (shape === 'line') {
    const count = Math.max(2, Math.min(20, lineSamples));
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0 : i / (count - 1) - 0.5;
      pts.push(new THREE.Vector3(t * size, -depth, 0));
    }
    return pts;
  }

  if (shape === 'polygon') {
    const safeSides = Math.round(Math.min(8, Math.max(3, sides || 5)));
    const radius = size / 2;
    const pts = [new THREE.Vector3(0, -depth, 0)];
    for (let i = 0; i < safeSides; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / safeSides;
      pts.push(new THREE.Vector3(Math.cos(a) * radius, -depth, Math.sin(a) * radius));
    }
    for (let i = 0; i < safeSides; i++) {
      const a = -Math.PI / 2 + (Math.PI * 2 * (i + 0.5)) / safeSides;
      pts.push(new THREE.Vector3(Math.cos(a) * radius * 0.48, -depth, Math.sin(a) * radius * 0.48));
    }
    return pts;
  }

  // Default: point source
  return [new THREE.Vector3(0, -depth, 0)];
}

// ---------------------------------------------------------------------------
// Source outer boundary points (used for window patches)
// ---------------------------------------------------------------------------

/**
 * Returns the outer boundary vertices of the source shape.
 * Used for computing per-emitter Snell's window patches.
 */
export function sourceOuterPoints(
  shape: SnellSourceShape | undefined,
  size: number,
  sides: number,
  depth: number,
): THREE.Vector3[] {
  if (shape === 'line') {
    return [
      new THREE.Vector3(-size / 2, -depth, 0),
      new THREE.Vector3(size / 2, -depth, 0),
    ];
  }

  if (shape === 'polygon') {
    const safeSides = Math.round(Math.min(8, Math.max(3, sides || 5)));
    const radius = size / 2;
    return Array.from({ length: safeSides }, (_, i) => {
      const a = -Math.PI / 2 + (Math.PI * 2 * i) / safeSides;
      return new THREE.Vector3(Math.cos(a) * radius, -depth, Math.sin(a) * radius);
    });
  }

  return [new THREE.Vector3(0, -depth, 0)];
}
