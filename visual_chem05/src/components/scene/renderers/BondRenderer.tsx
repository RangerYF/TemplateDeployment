/**
 * BondRenderer - Renders chemical bonds between atoms.
 *
 * Solid bonds are rendered as thin cylinders.
 * Dashed bonds are rendered as dashed lines.
 * Filtered by visibleBondTypes from the store.
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { AtomInstance, BondInstance } from '@/engine/types';
import { useCrystalStore } from '@/store';

interface BondRendererProps {
  bonds: BondInstance[];
  atoms: AtomInstance[];
}

// Shared geometries / materials
const cylinderGeometry = new THREE.CylinderGeometry(1, 1, 1, 8, 1);
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// B-018: Hydrogen bond color by strength
// ---------------------------------------------------------------------------

/**
 * Returns a hex color string for a hydrogen bond based on its length (in Å).
 * Strong H-bonds (short, ~1.5–2.0 Å) → dark green  #2F855A
 * Medium H-bonds       (~2.0–2.5 Å)  → mid  green  #48BB78  (current default)
 * Weak H-bonds  (long, ~2.5–3.5 Å)  → light green  #9AE6B4
 *
 * Linear interpolation is applied between the three anchor points.
 */
function hBondStrengthColor(
  start: [number, number, number],
  end: [number, number, number],
): string {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);

  // Anchor colors as [r, g, b] 0-255
  const strong: [number, number, number] = [0x2f, 0x85, 0x5a]; // #2F855A
  const medium: [number, number, number] = [0x48, 0xbb, 0x78]; // #48BB78
  const weak: [number, number, number]   = [0x9a, 0xe6, 0xb4]; // #9AE6B4

  let r: number, g: number, b: number;

  if (length <= 2.0) {
    // Clamp to strong end
    [r, g, b] = strong;
  } else if (length <= 2.5) {
    // Interpolate strong → medium over [2.0, 2.5]
    const t = (length - 2.0) / 0.5;
    r = Math.round(strong[0] + t * (medium[0] - strong[0]));
    g = Math.round(strong[1] + t * (medium[1] - strong[1]));
    b = Math.round(strong[2] + t * (medium[2] - strong[2]));
  } else if (length <= 3.5) {
    // Interpolate medium → weak over [2.5, 3.5]
    const t = (length - 2.5) / 1.0;
    r = Math.round(medium[0] + t * (weak[0] - medium[0]));
    g = Math.round(medium[1] + t * (weak[1] - medium[1]));
    b = Math.round(medium[2] + t * (weak[2] - medium[2]));
  } else {
    // Clamp to weak end
    [r, g, b] = weak;
  }

  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

/**
 * Compute the transform for a cylinder stretched between two points.
 * Returns { position, quaternion, scaleY } suitable for a unit cylinder.
 */
function cylinderTransform(
  start: [number, number, number],
  end: [number, number, number],
  radius: number,
) {
  const s = new THREE.Vector3(start[0], start[1], start[2]);
  const e = new THREE.Vector3(end[0], end[1], end[2]);
  const direction = new THREE.Vector3().subVectors(e, s);
  const length = direction.length();
  const midpoint = new THREE.Vector3().addVectors(s, e).multiplyScalar(0.5);

  const quaternion = new THREE.Quaternion();
  if (length > 1e-6) {
    quaternion.setFromUnitVectors(UP, direction.clone().normalize());
  }

  return {
    position: midpoint.toArray() as [number, number, number],
    quaternion,
    scale: [radius, length, radius] as [number, number, number],
  };
}

// ---------------------------------------------------------------------------
// Solid bond (cylinder)
// ---------------------------------------------------------------------------

function SolidBond({ bond }: { bond: BondInstance }) {
  const { position, quaternion, scale } = useMemo(
    () =>
      cylinderTransform(
        bond.startPosition,
        bond.endPosition,
        bond.radius,
      ),
    [bond.startPosition, bond.endPosition, bond.radius],
  );

  return (
    <mesh
      position={position}
      quaternion={quaternion}
      scale={scale}
      geometry={cylinderGeometry}
    >
      <meshStandardMaterial
        color={bond.color}
        metalness={0.1}
        roughness={0.7}
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Dashed bond (line)
// ---------------------------------------------------------------------------

function DashedBond({ bond }: { bond: BondInstance }) {
  const isHydrogen = bond.bondType === 'hydrogen';

  // B-018: derive color from bond length for hydrogen bonds
  const resolvedColor = useMemo(
    () =>
      isHydrogen
        ? hBondStrengthColor(bond.startPosition, bond.endPosition)
        : bond.color,
    [isHydrogen, bond.color, bond.startPosition, bond.endPosition],
  );

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array([
      bond.startPosition[0],
      bond.startPosition[1],
      bond.startPosition[2],
      bond.endPosition[0],
      bond.endPosition[1],
      bond.endPosition[2],
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.computeBoundingSphere();
    return geo;
  }, [bond.startPosition, bond.endPosition]);

  const material = useMemo(() => {
    const mat = new THREE.LineDashedMaterial({
      color: resolvedColor,
      dashSize: isHydrogen ? 0.2 : 0.15,
      gapSize: isHydrogen ? 0.12 : 0.1,
      linewidth: 1,
    });
    return mat;
  }, [resolvedColor, isHydrogen]);

  return (
    <lineSegments
      geometry={geometry}
      material={material}
      onUpdate={(line) => line.computeLineDistances()}
    />
  );
}

// ---------------------------------------------------------------------------
// Hydrogen bond directional arrow (B-015)
// ---------------------------------------------------------------------------

function HydrogenBondArrow({ bond }: { bond: BondInstance }) {
  // B-018: use strength-based color for the arrowhead
  const arrowColor = useMemo(
    () => hBondStrengthColor(bond.startPosition, bond.endPosition),
    [bond.startPosition, bond.endPosition],
  );

  const { position, quaternion } = useMemo(() => {
    const s = new THREE.Vector3(bond.startPosition[0], bond.startPosition[1], bond.startPosition[2]);
    const e = new THREE.Vector3(bond.endPosition[0], bond.endPosition[1], bond.endPosition[2]);
    const dir = new THREE.Vector3().subVectors(e, s);
    // Place arrow at 75% along the bond (donor -> acceptor direction)
    const pos = new THREE.Vector3().addVectors(s, dir.clone().multiplyScalar(0.75));
    const quat = new THREE.Quaternion();
    if (dir.length() > 1e-6) {
      quat.setFromUnitVectors(UP, dir.normalize());
    }
    return { position: pos.toArray() as [number, number, number], quaternion: quat };
  }, [bond.startPosition, bond.endPosition]);

  return (
    <mesh position={position} quaternion={quaternion}>
      <coneGeometry args={[0.06, 0.15, 8]} />
      <meshStandardMaterial color={arrowColor} />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Hydrogen bond angle label (B-016)
// ---------------------------------------------------------------------------

/**
 * Calculate the X-H...Y angle for a hydrogen bond.
 * bondH is the H-bond (H -> Y). We search allBonds for a covalent bond to H
 * (the donor covalent bond X-H) and compute the X-H...Y angle in degrees.
 * Returns null if the donor atom X cannot be found.
 */
function calcHBondAngle(
  bondH: BondInstance,
  allBonds: BondInstance[],
  atoms: AtomInstance[],
): number | null {
  // Identify which end of the H-bond is H and which is Y (acceptor)
  const startAtom = atoms[bondH.startAtomIndex];
  const endAtom = atoms[bondH.endAtomIndex];
  if (!startAtom || !endAtom) return null;

  let hIndex: number;
  let yIndex: number;

  if (startAtom.element === 'H') {
    hIndex = bondH.startAtomIndex;
    yIndex = bondH.endAtomIndex;
  } else if (endAtom.element === 'H') {
    hIndex = bondH.endAtomIndex;
    yIndex = bondH.startAtomIndex;
  } else {
    // Neither end is H; skip
    return null;
  }

  const hAtom = atoms[hIndex];
  const yAtom = atoms[yIndex];
  if (!hAtom || !yAtom) return null;

  // Find the donor atom X: a covalent bond connected to H (other than the H-bond itself)
  let xAtom: AtomInstance | null = null;
  for (const b of allBonds) {
    if (b.bondType !== 'covalent-sigma' && b.bondType !== 'covalent-pi') continue;
    if (b === bondH) continue;
    if (b.startAtomIndex === hIndex) {
      const candidate = atoms[b.endAtomIndex];
      if (candidate) { xAtom = candidate; break; }
    } else if (b.endAtomIndex === hIndex) {
      const candidate = atoms[b.startAtomIndex];
      if (candidate) { xAtom = candidate; break; }
    }
  }

  if (!xAtom) return null;

  // Vectors from H toward X and from H toward Y
  const H = new THREE.Vector3(...hAtom.position);
  const X = new THREE.Vector3(...xAtom.position);
  const Y = new THREE.Vector3(...yAtom.position);

  const HX = new THREE.Vector3().subVectors(X, H);
  const HY = new THREE.Vector3().subVectors(Y, H);

  const lenHX = HX.length();
  const lenHY = HY.length();
  if (lenHX < 1e-8 || lenHY < 1e-8) return null;

  const cosAngle = HX.dot(HY) / (lenHX * lenHY);
  const clampedCos = Math.max(-1, Math.min(1, cosAngle));
  const angleDeg = (Math.acos(clampedCos) * 180) / Math.PI;
  return Math.round(angleDeg);
}

interface HBondAngleLabelProps {
  bond: BondInstance;
  allBonds: BondInstance[];
  atoms: AtomInstance[];
}

function HBondAngleLabel({ bond, allBonds, atoms }: HBondAngleLabelProps) {
  const result = useMemo(
    () => calcHBondAngle(bond, allBonds, atoms),
    [bond, allBonds, atoms],
  );

  const midpoint = useMemo((): [number, number, number] => {
    return [
      (bond.startPosition[0] + bond.endPosition[0]) / 2,
      (bond.startPosition[1] + bond.endPosition[1]) / 2,
      (bond.startPosition[2] + bond.endPosition[2]) / 2,
    ];
  }, [bond.startPosition, bond.endPosition]);

  // B-018: match label background to the bond's strength color
  const labelBg = useMemo(() => {
    const hex = hBondStrengthColor(bond.startPosition, bond.endPosition);
    // Parse to add alpha
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r},${g},${b},0.85)`;
  }, [bond.startPosition, bond.endPosition]);

  if (result === null) return null;

  return (
    <Html
      position={midpoint}
      center
      distanceFactor={8}
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          background: labelBg,
          color: '#fff',
          fontSize: '11px',
          fontWeight: 600,
          padding: '1px 5px',
          borderRadius: '4px',
          whiteSpace: 'nowrap',
          lineHeight: 1.4,
          userSelect: 'none',
        }}
      >
        {result}°
      </div>
    </Html>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function BondRenderer({ bonds, atoms }: BondRendererProps) {
  const visibleBondTypes = useCrystalStore((s) => s.visibleBondTypes);

  const filteredBonds = useMemo(
    () => bonds.filter((b) => visibleBondTypes.has(b.bondType)),
    [bonds, visibleBondTypes],
  );

  return (
    <group>
      {filteredBonds.map((bond, i) =>
        bond.dashed ? (
          <group key={`d-${i}`}>
            <DashedBond bond={bond} />
            {bond.bondType === 'hydrogen' && (
              <>
                <HydrogenBondArrow bond={bond} />
                <HBondAngleLabel bond={bond} allBonds={bonds} atoms={atoms} />
              </>
            )}
          </group>
        ) : (
          <SolidBond key={`s-${i}`} bond={bond} />
        ),
      )}
    </group>
  );
}
