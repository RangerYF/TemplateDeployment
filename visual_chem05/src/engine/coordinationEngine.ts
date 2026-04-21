/**
 * Coordination Engine
 *
 * Finds nearest neighbors and coordination shells for atoms in a crystal structure.
 */

import type { AtomInstance } from './types';
import { vec3Distance } from './latticeMatrix';

export interface NeighborInfo {
  atomIndex: number;
  element: string;
  distance: number; // Angstroms
  label: string;
}

/**
 * Find all neighbors of a given atom within a cutoff distance.
 * Groups by same-element and different-element neighbors.
 */
export function findNeighbors(
  atoms: AtomInstance[],
  centerIdx: number,
  cutoff: number = 4.0,
): NeighborInfo[] {
  const center = atoms[centerIdx];
  if (!center) return [];

  const neighbors: NeighborInfo[] = [];

  for (const atom of atoms) {
    if (atom.index === centerIdx) continue;
    const dist = vec3Distance(center.position, atom.position);
    if (dist > 0.1 && dist <= cutoff) {
      neighbors.push({
        atomIndex: atom.index,
        element: atom.element,
        distance: dist,
        label: atom.label,
      });
    }
  }

  // Sort by distance
  neighbors.sort((a, b) => a.distance - b.distance);
  return neighbors;
}

/**
 * Find the coordination shell: nearest neighbors at approximately the same distance.
 * Uses a gap-detection heuristic: if the next neighbor is >30% farther than the first,
 * it's in a different shell.
 */
export function findCoordinationShell(
  atoms: AtomInstance[],
  centerIdx: number,
  cutoff: number = 6.0,
): NeighborInfo[] {
  const allNeighbors = findNeighbors(atoms, centerIdx, cutoff);
  if (allNeighbors.length === 0) return [];

  const firstDist = allNeighbors[0].distance;
  const shell: NeighborInfo[] = [];

  for (const n of allNeighbors) {
    // Allow 30% tolerance for same shell
    if (n.distance <= firstDist * 1.3) {
      shell.push(n);
    } else {
      break;
    }
  }

  return shell;
}

/**
 * Separate neighbors into hetero (different element) and homo (same element).
 */
export function classifyNeighbors(
  neighbors: NeighborInfo[],
  centerElement: string,
): { hetero: NeighborInfo[]; homo: NeighborInfo[] } {
  const hetero: NeighborInfo[] = [];
  const homo: NeighborInfo[] = [];

  for (const n of neighbors) {
    if (n.element === centerElement) {
      homo.push(n);
    } else {
      hetero.push(n);
    }
  }

  return { hetero, homo };
}

/**
 * Determine the void type based on coordination number.
 */
export function getVoidType(coordNum: number): string | null {
  if (coordNum === 4) return '四面体空隙';
  if (coordNum === 6) return '八面体空隙';
  if (coordNum === 8) return '立方体空隙';
  return null;
}

/**
 * Calculate r/R ratio from the center atom and its neighbors.
 */
export function calculateRadiusRatio(
  centerRadius: number,
  neighborRadius: number,
): number {
  if (neighborRadius === 0) return 0;
  return centerRadius / neighborRadius;
}

/**
 * Compute coordination info string for display.
 */
export function getCoordinationGeometry(coordNum: number): string {
  switch (coordNum) {
    case 2: return '线形';
    case 3: return '平面三角形';
    case 4: return '正四面体';
    case 6: return '正八面体';
    case 8: return '立方体';
    case 12: return '立方密堆积/六方密堆积';
    default: return `配位数 ${coordNum}`;
  }
}
