/**
 * 电子云渲染器
 * σ 键电子云：沿键轴半透明椭球
 * π 键电子云：双键/三键额外的哑铃形椭球
 *    - sp²杂化：π电子云在分子平面内（垂直于分子平面的法向量）
 *    - sp杂化：π电子云沿键轴方向
 * 孤电子对：小椭球
 *
 * 性能关键：所有几何数据在 useMemo 中预计算，避免每帧创建 THREE 对象
 */

import { useMemo } from 'react';
import * as THREE from 'three';
import type { MoleculeModel, Vec3 } from '@/engine/types';
import { vec3Normalize, vec3Cross, vec3Length } from '@/engine/types';

const SIGMA_COLOR = '#4FC3F7';
const PI_COLOR = '#CE93D8';
const LONE_PAIR_COLOR = '#90CAF9';

interface CloudItem {
  pos: Vec3;
  quaternion: THREE.Quaternion;
  scale: Vec3;
  color: string;
  opacity: number;
}

interface Props {
  model: MoleculeModel;
}

/**
 * 计算键的中点处分子平面的法向量
 * 通过找到键两端原子的相邻键来确定局部平面
 */
function computeBondMidplaneNormal(
  fromIndex: number,
  toIndex: number,
  bonds: MoleculeModel['bonds'],
  atoms: MoleculeModel['atoms'],
): Vec3 | null {
  const bondDir: Vec3 = [
    atoms[toIndex].position[0] - atoms[fromIndex].position[0],
    atoms[toIndex].position[1] - atoms[fromIndex].position[1],
    atoms[toIndex].position[2] - atoms[fromIndex].position[2],
  ];

  // 收集from原子和to原子的相邻键（除了这条键本身）
  const otherDirs: Vec3[] = [];
  for (const bond of bonds) {
    if (bond.from === fromIndex && bond.to !== toIndex) {
      otherDirs.push([
        atoms[bond.to].position[0] - atoms[fromIndex].position[0],
        atoms[bond.to].position[1] - atoms[fromIndex].position[1],
        atoms[bond.to].position[2] - atoms[fromIndex].position[2],
      ]);
    } else if (bond.to === fromIndex && bond.from !== toIndex) {
      otherDirs.push([
        atoms[bond.from].position[0] - atoms[fromIndex].position[0],
        atoms[bond.from].position[1] - atoms[fromIndex].position[1],
        atoms[bond.from].position[2] - atoms[fromIndex].position[2],
      ]);
    }
    if (bond.from === toIndex && bond.to !== fromIndex) {
      otherDirs.push([
        atoms[bond.to].position[0] - atoms[toIndex].position[0],
        atoms[bond.to].position[1] - atoms[toIndex].position[1],
        atoms[bond.to].position[2] - atoms[toIndex].position[2],
      ]);
    } else if (bond.to === toIndex && bond.from !== fromIndex) {
      otherDirs.push([
        atoms[bond.from].position[0] - atoms[toIndex].position[0],
        atoms[bond.from].position[1] - atoms[toIndex].position[1],
        atoms[bond.from].position[2] - atoms[toIndex].position[2],
      ]);
    }
  }

  if (otherDirs.length >= 1) {
    // 使用键方向和相邻键方向的叉积来确定平面法向量
    const normal = vec3Cross(bondDir, otherDirs[0]);
    if (vec3Length(normal) > 0.01) {
      return vec3Normalize(normal);
    }
  }

  // 如果找不到相邻键，使用全局Z轴作为备选
  return [0, 0, 1];
}

export function ElectronCloudRenderer({ model }: Props) {
  const clouds = useMemo(() => {
    const items: CloudItem[] = [];
    const yAxis = new THREE.Vector3(0, 1, 0);

    for (const bond of model.bonds) {
      const dx = bond.toPos[0] - bond.fromPos[0];
      const dy = bond.toPos[1] - bond.fromPos[1];
      const dz = bond.toPos[2] - bond.fromPos[2];
      const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (length < 0.01) continue;

      const midPos: Vec3 = [
        (bond.fromPos[0] + bond.toPos[0]) / 2,
        (bond.fromPos[1] + bond.toPos[1]) / 2,
        (bond.fromPos[2] + bond.toPos[2]) / 2,
      ];
      const dir = new THREE.Vector3(dx / length, dy / length, dz / length);
      const q = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);

      // σ 键椭球
      items.push({
        pos: midPos,
        quaternion: q,
        scale: [0.35, length * 0.5, 0.35],
        color: SIGMA_COLOR,
        opacity: 0.2,
      });

      // π 键（双键、三键）
      // π电子云方向：垂直于键轴，且位于分子平面内
      if (bond.order >= 2) {
        addPiCloud(items, midPos, dir, length, q, 0, bond.from, bond.to, model.bonds, model.atoms);
      }
      if (bond.order >= 3) {
        addPiCloud(items, midPos, dir, length, q, Math.PI / 2, bond.from, bond.to, model.bonds, model.atoms);
      }
    }

    // 计算每个原子的成键数，用于过滤末端原子（末端原子不杂化，不显示电子云孤对）
    const bondCountMap = new Map<number, number>();
    for (const bond of model.bonds) {
      bondCountMap.set(bond.from, (bondCountMap.get(bond.from) ?? 0) + 1);
      bondCountMap.set(bond.to, (bondCountMap.get(bond.to) ?? 0) + 1);
    }

    // 孤电子对（跳过末端原子：bondCount=1 的原子不参与杂化）
    for (const lp of model.lonePairs) {
      if ((bondCountMap.get(lp.centerAtomIndex) ?? 0) <= 1) continue;
      const dirLen = vec3Length(lp.direction);
      if (dirLen < 0.01) continue;
      const nd = vec3Normalize(lp.direction);
      const dir3 = new THREE.Vector3(nd[0], nd[1], nd[2]);
      const q = new THREE.Quaternion().setFromUnitVectors(yAxis, dir3);
      items.push({
        pos: lp.position,
        quaternion: q,
        scale: [0.2, 0.3, 0.2],
        color: LONE_PAIR_COLOR,
        opacity: 0.2,
      });
    }

    return items;
  }, [model]);

  return (
    <group>
      {clouds.map((c, i) => (
        <mesh key={i} position={c.pos} quaternion={c.quaternion} scale={c.scale}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color={c.color} transparent opacity={c.opacity} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function addPiCloud(
  items: CloudItem[],
  midPos: Vec3,
  dir: THREE.Vector3,
  length: number,
  q: THREE.Quaternion,
  rotateAngle: number,
  fromIndex: number,
  toIndex: number,
  bonds: MoleculeModel['bonds'],
  atoms: MoleculeModel['atoms'],
) {
  const bondDir: Vec3 = [dir.x, dir.y, dir.z];

  // 计算键中点处分子平面的法向量（用于确定π电子云方向）
  const planeNormal = computeBondMidplaneNormal(fromIndex, toIndex, bonds, atoms);

  // π电子云方向：垂直于键轴（bondDir），且位于分子平面内
  // 即：垂直于键轴和分子平面法向量的叉积方向
  let piDir = vec3Cross(bondDir, planeNormal ?? [0, 0, 1]);
  if (vec3Length(piDir) < 0.01) {
    // 如果叉积太小（键方向平行于平面法向量），使用备用方向
    piDir = vec3Cross(bondDir, [0, 1, 0]);
    if (vec3Length(piDir) < 0.01) {
      piDir = vec3Cross(bondDir, [1, 0, 0]);
    }
  }
  piDir = vec3Normalize(piDir);

  // 对于第二个π键（如三键），旋转90度
  if (rotateAngle !== 0) {
    const p3 = new THREE.Vector3(piDir[0], piDir[1], piDir[2]);
    p3.applyAxisAngle(dir, rotateAngle);
    piDir = [p3.x, p3.y, p3.z];
  }

  const offset = 0.35;
  items.push(
    {
      pos: [midPos[0] + piDir[0] * offset, midPos[1] + piDir[1] * offset, midPos[2] + piDir[2] * offset],
      // π电子云椭球：长轴沿键方向，短轴在π平面内
      quaternion: q,
      scale: [0.12, length * 0.4, 0.2],
      color: PI_COLOR,
      opacity: 0.15,
    },
    {
      pos: [midPos[0] - piDir[0] * offset, midPos[1] - piDir[1] * offset, midPos[2] - piDir[2] * offset],
      quaternion: q,
      scale: [0.12, length * 0.4, 0.2],
      color: PI_COLOR,
      opacity: 0.15,
    },
  );
}
