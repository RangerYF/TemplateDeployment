/**
 * 化学键渲染器
 * 支持单键、双键、三键、离域键
 * 使用分段染色（两半各取所连原子颜色）
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import { Html } from '@react-three/drei';
import type { Bond3D, Atom3D } from '@/engine/types';
import { vec3Sub, vec3Add, vec3Scale, vec3Length, vec3Normalize, vec3Cross } from '@/engine/types';
import { BOND_RENDER_CONFIG, type BondType } from '@/data/bondTypes';

interface BondRendererProps {
  bond: Bond3D;
  atoms: Atom3D[];
  displayMode: import('@/store/uiStore').DisplayMode;
  showBondLength?: boolean;
  onDoubleClick?: () => void;
}

export function BondRenderer({ bond, atoms, displayMode, showBondLength, onDoubleClick }: BondRendererProps) {
  const config = BOND_RENDER_CONFIG[bond.type];
  const isElectronCloud = displayMode === 'electron-cloud';

  const geometry = useMemo(() => {
    const from = new THREE.Vector3(...bond.fromPos);
    const to = new THREE.Vector3(...bond.toPos);
    const mid = from.clone().add(to).multiplyScalar(0.5);
    const dir = to.clone().sub(from);
    const length = dir.length();
    dir.normalize();

    return { from, to, mid, dir, length };
  }, [bond.fromPos, bond.toPos]);

  const fromColor = atoms[bond.from]?.color ?? '#808080';
  const toColor = atoms[bond.to]?.color ?? '#808080';

  // electron-cloud 模式下使用更细的圆柱
  const radiusScale = isElectronCloud ? 0.5 : 1;

  if (displayMode === 'space-filling') return null;

  const radius = config.cylinderRadius * radiusScale;

  // 隐形双击目标球（放在键中点）
  const clickTarget = onDoubleClick ? (
    <mesh
      position={[geometry.mid.x, geometry.mid.y, geometry.mid.z]}
      onDoubleClick={(e) => { e.stopPropagation(); onDoubleClick(); }}
    >
      <sphereGeometry args={[0.15, 8, 8]} />
      <meshBasicMaterial transparent opacity={0} />
    </mesh>
  ) : null;

  // 键长标注
  const bondLengthLabel = showBondLength ? (
    <Html
      position={[geometry.mid.x, geometry.mid.y + 0.2, geometry.mid.z]}
      center
      style={{ pointerEvents: 'none' }}
    >
      <div style={{
        fontSize: '12px',
        color: '#666',
        background: 'rgba(255,255,255,0.85)',
        padding: '1px 4px',
        borderRadius: '3px',
        whiteSpace: 'nowrap',
        fontFamily: 'system-ui, sans-serif',
      }}>
        {Math.round(bond.length)} pm
      </div>
    </Html>
  ) : null;

  if (config.cylinders === 1) {
    return (
      <group>
        <SingleCylinder
          from={geometry.from}
          to={geometry.mid}
          radius={radius}
          color={fromColor}
          opacity={config.opacity}
          dashed={config.dashed}
        />
        <SingleCylinder
          from={geometry.mid}
          to={geometry.to}
          radius={radius}
          color={toColor}
          opacity={config.opacity}
          dashed={config.dashed}
        />
        {clickTarget}
        {bondLengthLabel}
      </group>
    );
  }

  // 多根圆柱（双键、三键）
  const offsets = computeMultiBondOffsets(bond, atoms, config.cylinders, config.spacing);

  return (
    <group>
      {offsets.map((offset, i) => {
        const fromOff = new THREE.Vector3(...vec3Add(bond.fromPos, offset));
        const toOff = new THREE.Vector3(...vec3Add(bond.toPos, offset));
        const midOff = fromOff.clone().add(toOff).multiplyScalar(0.5);
        // 离域键：第一根实线，第二根虚线半透明
        const isDelocalizedDashed = bond.type === ('delocalized' as BondType) && i === 1;
        const cylOpacity = isDelocalizedDashed ? 0.5 : config.opacity;
        const cylDashed = isDelocalizedDashed;
        return (
          <group key={i}>
            <SingleCylinder from={fromOff} to={midOff} radius={radius} color={fromColor} opacity={cylOpacity} dashed={cylDashed} />
            <SingleCylinder from={midOff} to={toOff} radius={radius} color={toColor} opacity={cylOpacity} dashed={cylDashed} />
          </group>
        );
      })}
      {clickTarget}
      {bondLengthLabel}
    </group>
  );
}

function SingleCylinder({
  from,
  to,
  radius,
  color,
  opacity,
  dashed,
}: {
  from: THREE.Vector3;
  to: THREE.Vector3;
  radius: number;
  color: string;
  opacity: number;
  dashed: boolean;
}) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from);
  const length = dir.length();

  // 计算旋转：默认圆柱沿 Y 轴，需要旋转到 from→to 方向
  const quaternion = useMemo(() => {
    const q = new THREE.Quaternion();
    q.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    return q;
  }, [dir]);

  if (length < 0.001) return null;

  if (dashed) {
    return (
      <group position={[mid.x, mid.y, mid.z]} quaternion={quaternion}>
        {/* 虚线用多个小圆柱 */}
        {Array.from({ length: Math.max(1, Math.floor(length / 0.08)) }).map((_, i, arr) => {
          const t = (i + 0.25) / arr.length;
          const y = (t - 0.5) * length;
          const segLen = length / arr.length * 0.5;
          return (
            <mesh key={i} position={[0, y, 0]}>
              <cylinderGeometry args={[radius, radius, segLen, 8]} />
              <meshStandardMaterial
                color={color}
                transparent={opacity < 1}
                opacity={opacity}
                roughness={0.4}
              />
            </mesh>
          );
        })}
      </group>
    );
  }

  return (
    <mesh position={[mid.x, mid.y, mid.z]} quaternion={quaternion}>
      <cylinderGeometry args={[radius, radius, length, 12]} />
      <meshStandardMaterial
        color={color}
        transparent={opacity < 1}
        opacity={opacity}
        roughness={0.4}
        metalness={0.05}
      />
    </mesh>
  );
}

function computeMultiBondOffsets(
  bond: Bond3D,
  atoms: Atom3D[],
  count: number,
  spacing: number,
): [number, number, number][] {
  const bondDir = vec3Normalize(vec3Sub(bond.toPos, bond.fromPos));

  // 找到垂直于键轴的方向
  const up: [number, number, number] = [0, 1, 0];
  let perp = vec3Cross(bondDir, up);
  if (vec3Length(perp) < 0.01) {
    perp = vec3Cross(bondDir, [1, 0, 0]);
  }
  perp = vec3Normalize(perp);

  // 找到第三个参与原子以确定平面方向
  const fromAtom = atoms[bond.from];
  if (fromAtom) {
    // 尝试找相邻原子来确定分子平面
    const otherAtoms = atoms.filter((_, i) => i !== bond.from && i !== bond.to);
    if (otherAtoms.length > 0) {
      const toOther = vec3Normalize(vec3Sub(otherAtoms[0].position, fromAtom.position));
      const newPerp = vec3Cross(bondDir, toOther);
      if (vec3Length(newPerp) > 0.01) {
        perp = vec3Normalize(newPerp);
      }
    }
  }

  if (count === 2) {
    return [
      vec3Scale(perp, spacing / 2),
      vec3Scale(perp, -spacing / 2),
    ];
  }

  if (count === 3) {
    const perp2 = vec3Normalize(vec3Cross(bondDir, perp));
    return [
      vec3Scale(perp, spacing),
      vec3Scale(perp, -spacing / 2),
      vec3Scale(perp2, spacing * Math.sqrt(3) / 2),
    ];
  }

  return [[0, 0, 0]];
}
