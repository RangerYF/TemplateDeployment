/**
 * Crystal expansion engine.
 *
 * Takes a CrystalStructure definition (single unit cell in fractional coords)
 * and expands it into a full CrystalScene of Cartesian atom/bond instances
 * over a given range of unit cells, ready for 3D rendering.
 */

import type {
  CrystalStructure,
  CrystalScene,
  AtomInstance,
  BondInstance,
  ExpansionRange,
  RenderMode,
  Vec3,
  Matrix3,
  BondType,
} from './types';
import { BOND_COLORS, BOND_RADII } from './types';
import { getElement, getIonicRadius } from '../data/elements';
import {
  buildLatticeMatrix,
  fracToCart,
  buildUnitCellVertices,
  buildUnitCellEdges,
  vec3Distance,
} from './latticeMatrix';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Teaching-friendly radius for ball-and-stick mode.
 *
 * We keep the relative ordering from crystallographic radii, but compress the
 * range so bonds remain visible and small atoms like H/Ti are still clickable.
 * Priority:
 * 1. ionic radius when a charge is available
 * 2. covalent radius otherwise
 */
function ballAndStickRadius(element: string, charge: string | undefined): number {
  const baseRadius = charge ? getIonicRadius(element, charge) : getElement(element).covalentRadius;

  // Scale down from physical radii into a teaching-oriented ball-and-stick size.
  // Example outcomes:
  // Ti4+ 0.605 Å -> 0.22 (small)
  // Na+  1.02  Å -> 0.36 (medium)
  // Cl-  1.81  Å -> 0.62 (large)
  return clamp(baseRadius * 0.35, 0.22, 0.62);
}

/** Compute display radius for an atom depending on render mode. */
function atomDisplayRadius(
  element: string,
  charge: string | undefined,
  renderMode: RenderMode,
  radiusOverride?: number,
): number {
  if (radiusOverride !== undefined) return radiusOverride;

  const el = getElement(element);

  switch (renderMode) {
    case 'ballAndStick':
      return ballAndStickRadius(element, charge);
    case 'spaceFilling':
      // Prefer ionic radius when charge is given, otherwise vdW
      if (charge) {
        return getIonicRadius(element, charge);
      }
      return el.vdwRadius;
    case 'polyhedral':
      return el.covalentRadius * 0.35;
    case 'wireframe':
      return 0.1;
    default:
      return ballAndStickRadius(element, charge);
  }
}

/** Bond cylinder radius based on render mode. */
function bondDisplayRadius(bondType: BondType, renderMode: RenderMode): number {
  const base = BOND_RADII[bondType];
  switch (renderMode) {
    case 'wireframe':
      return 0.02;
    case 'spaceFilling':
      return base * 0.5;
    default:
      return base;
  }
}

/** Encode cell index into a string key for fast lookup. */
function cellKey(i: number, j: number, k: number, siteIdx: number): string {
  return `${i},${j},${k},${siteIdx}`;
}

// ---------------------------------------------------------------------------
// Main expansion function
// ---------------------------------------------------------------------------

export function expandCrystal(
  structure: CrystalStructure,
  range: ExpansionRange,
  renderMode: RenderMode,
): CrystalScene {
  const matrix = buildLatticeMatrix(structure.lattice);
  const atoms: AtomInstance[] = [];
  const bonds: BondInstance[] = [];

  // Map from (cell + siteIndex) -> atom index in the atoms array
  const atomIndexMap = new Map<string, number>();

  // -----------------------------------------------------------------------
  // 1. Generate atoms
  // -----------------------------------------------------------------------
  const [xMin, xMax] = range.x;
  const [yMin, yMax] = range.y;
  const [zMin, zMax] = range.z;

  for (let ci = xMin; ci <= xMax; ci++) {
    for (let cj = yMin; cj <= yMax; cj++) {
      for (let ck = zMin; ck <= zMax; ck++) {
        for (let si = 0; si < structure.atomSites.length; si++) {
          const site = structure.atomSites[si];
          const el = getElement(site.element);

          // Fractional coords shifted by cell index
          const frac: Vec3 = [
            site.fracCoords[0] + ci,
            site.fracCoords[1] + cj,
            site.fracCoords[2] + ck,
          ];

          const position = fracToCart(frac, matrix);

          const color = site.colorOverride ?? el.color;
          const radius = atomDisplayRadius(
            site.element,
            site.charge,
            renderMode,
            site.radiusOverride,
          );

          const key = cellKey(ci, cj, ck, si);
          const atomIdx = atoms.length;
          atomIndexMap.set(key, atomIdx);

          atoms.push({
            index: atomIdx,
            element: site.element,
            label: site.label ?? site.element,
            position,
            color,
            radius,
            cellIndex: [ci, cj, ck],
            siteIndex: si,
            isPrimary: ci === 0 && cj === 0 && ck === 0,
            charge: site.charge,
          });
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // 2. Generate bonds
  // -----------------------------------------------------------------------
  const bondGeneration =
    structure.bondGeneration ??
    (structure.bonds.length > 0 ? 'explicit' : structure.neighborCutoff ? 'cutoff' : 'explicit');

  if (bondGeneration === 'explicit' && structure.bonds.length > 0) {
    generateExplicitBonds(
      structure,
      atoms,
      bonds,
      atomIndexMap,
      range,
      matrix,
      renderMode,
    );
  } else if (structure.neighborCutoff !== undefined && structure.neighborCutoff > 0) {
    const fallbackBondType =
      structure.fallbackBondType ??
      (structure.category === 'metallic' ? 'metallic' : 'covalent-sigma');

    if (bondGeneration === 'shell') {
      generateShellBonds(
        atoms,
        bonds,
        structure.neighborCutoff,
        fallbackBondType,
        renderMode,
      );
    } else {
      generateDistanceBonds(
        atoms,
        bonds,
        structure.neighborCutoff,
        fallbackBondType,
        renderMode,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 3. Unit cell geometry
  // -----------------------------------------------------------------------
  const unitCellVertices = buildUnitCellVertices(matrix);
  const unitCellEdges = buildUnitCellEdges();

  return {
    atoms,
    bonds,
    unitCellVertices,
    unitCellEdges,
    latticeVectors: matrix,
  };
}

// ---------------------------------------------------------------------------
// Explicit bond generation (from BondDefinition list)
// ---------------------------------------------------------------------------

function generateExplicitBonds(
  structure: CrystalStructure,
  atoms: AtomInstance[],
  bonds: BondInstance[],
  atomIndexMap: Map<string, number>,
  range: ExpansionRange,
  _matrix: Matrix3,
  renderMode: RenderMode,
): void {
  const [xMin, xMax] = range.x;
  const [yMin, yMax] = range.y;
  const [zMin, zMax] = range.z;

  for (let ci = xMin; ci <= xMax; ci++) {
    for (let cj = yMin; cj <= yMax; cj++) {
      for (let ck = zMin; ck <= zMax; ck++) {
        for (const bondDef of structure.bonds) {
          const [si1, si2] = bondDef.siteIndices;
          const offset = bondDef.cellOffset ?? [0, 0, 0];

          // First atom in current cell
          const key1 = cellKey(ci, cj, ck, si1);

          // Second atom in offset cell
          const ci2 = ci + offset[0];
          const cj2 = cj + offset[1];
          const ck2 = ck + offset[2];

          // Only generate bond if both atoms exist in our expansion range
          if (
            ci2 < xMin || ci2 > xMax ||
            cj2 < yMin || cj2 > yMax ||
            ck2 < zMin || ck2 > zMax
          ) {
            continue;
          }

          const key2 = cellKey(ci2, cj2, ck2, si2);

          const idx1 = atomIndexMap.get(key1);
          const idx2 = atomIndexMap.get(key2);

          if (idx1 === undefined || idx2 === undefined) continue;

          const atom1 = atoms[idx1];
          const atom2 = atoms[idx2];

          const bondColor = BOND_COLORS[bondDef.bondType];

          bonds.push({
            startPosition: atom1.position,
            endPosition: atom2.position,
            bondType: bondDef.bondType,
            color: bondColor.color,
            radius: bondDisplayRadius(bondDef.bondType, renderMode),
            dashed: bondColor.dashed,
            startAtomIndex: idx1,
            endAtomIndex: idx2,
          });
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Distance-based bond generation (metallic / cutoff mode)
// ---------------------------------------------------------------------------

function generateDistanceBonds(
  atoms: AtomInstance[],
  bonds: BondInstance[],
  cutoff: number,
  bondType: BondType,
  renderMode: RenderMode,
): void {
  const bondColor = BOND_COLORS[bondType];
  const n = atoms.length;

  // Simple O(n^2) distance check — fine for typical crystal expansions (< few thousand atoms)
  // Use a set to avoid duplicate bonds
  const seen = new Set<string>();

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dist = vec3Distance(atoms[i].position, atoms[j].position);
      if (dist <= cutoff && dist > 0.01) {
        // Deduplicate by sorted index pair
        const pairKey = `${i}-${j}`;
        if (seen.has(pairKey)) continue;
        seen.add(pairKey);

        bonds.push({
          startPosition: atoms[i].position,
          endPosition: atoms[j].position,
          bondType,
          color: bondColor.color,
          radius: bondDisplayRadius(bondType, renderMode),
          dashed: bondColor.dashed,
          startAtomIndex: i,
          endAtomIndex: j,
        });
      }
    }
  }
}

function generateShellBonds(
  atoms: AtomInstance[],
  bonds: BondInstance[],
  cutoff: number,
  bondType: BondType,
  renderMode: RenderMode,
): void {
  const bondColor = BOND_COLORS[bondType];
  const seen = new Set<string>();

  for (let i = 0; i < atoms.length; i += 1) {
    const neighbors: { index: number; distance: number }[] = [];

    for (let j = 0; j < atoms.length; j += 1) {
      if (i === j) continue;
      const distance = vec3Distance(atoms[i].position, atoms[j].position);
      if (distance > 0.01 && distance <= cutoff) {
        neighbors.push({ index: j, distance });
      }
    }

    neighbors.sort((a, b) => a.distance - b.distance);
    if (neighbors.length === 0) {
      continue;
    }

    const shellLimit = neighbors[0].distance * 1.15;
    for (const neighbor of neighbors) {
      if (neighbor.distance > shellLimit) {
        break;
      }

      const startAtomIndex = Math.min(i, neighbor.index);
      const endAtomIndex = Math.max(i, neighbor.index);
      const pairKey = `${startAtomIndex}-${endAtomIndex}`;
      if (seen.has(pairKey)) {
        continue;
      }
      seen.add(pairKey);

      bonds.push({
        startPosition: atoms[startAtomIndex].position,
        endPosition: atoms[endAtomIndex].position,
        bondType,
        color: bondColor.color,
        radius: bondDisplayRadius(bondType, renderMode),
        dashed: bondColor.dashed,
        startAtomIndex,
        endAtomIndex,
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Utility: default expansion range (1x1x1 = single cell)
// ---------------------------------------------------------------------------

export function singleCellRange(): ExpansionRange {
  return { x: [0, 0], y: [0, 0], z: [0, 0] };
}

export function superCellRange(nx: number, ny: number, nz: number): ExpansionRange {
  return {
    x: [0, nx - 1],
    y: [0, ny - 1],
    z: [0, nz - 1],
  };
}

/**
 * Centered expansion: e.g. expand=1 gives range [-1, 1] in each direction (3x3x3).
 */
export function centeredRange(expand: number): ExpansionRange {
  return {
    x: [-expand, expand],
    y: [-expand, expand],
    z: [-expand, expand],
  };
}
