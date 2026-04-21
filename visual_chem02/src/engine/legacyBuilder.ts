/**
 * 旧版分子 3D 模型构建器（Legacy）
 *
 * 用于 hasSdf: false 的分子（离子等）的后备构建。
 * 策略：
 * 1. 中心原子型 → VSEPR 模板放置
 * 2. 双原子 → 直线放置
 * 3. 有机 → 图遍历 + 递推
 * 4. 芳香族 → 正六边形模板
 */

import type { MoleculeData } from '@/data/molecules';
import { getElement } from '@/data/elements';
import { findVseprTemplate } from '@/data/vsepr';
import type { Atom3D, Bond3D, LonePair3D, MoleculeModel, Vec3 } from './types';
import {
  vec3Add, vec3Sub, vec3Scale, vec3Length,
  vec3Normalize, vec3Cross, vec3Dot,
} from './types';
import { computeFormalCharges } from './moleculeBuilder';

const PM_SCALE = 1 / 100;

export function buildMoleculeModelLegacy(data: MoleculeData): MoleculeModel {
  const positions = computeAtomPositions(data);

  const atoms: Atom3D[] = data.atoms.map((atomDef, i) => {
    const elem = getElement(atomDef.element);
    return {
      index: i,
      element: atomDef.element,
      position: positions[i],
      label: atomDef.label,
      radius: elem.ballRadius,
      spaceFillRadius: elem.spaceFillRadius,
      color: elem.cpkColor,
    };
  });

  const bonds: Bond3D[] = data.bonds.map(bondDef => ({
    from: bondDef.from,
    to: bondDef.to,
    order: bondDef.order,
    type: bondDef.type,
    length: bondDef.length,
    fromPos: positions[bondDef.from],
    toPos: positions[bondDef.to],
  }));

  const lonePairs = computeAllLonePairs(data.atoms, data.bonds, positions, data.charge ?? 0);

  // 计算形式电荷（含电荷修正）
  computeFormalCharges(atoms, bonds, data.charge ?? 0);

  const center = computeCenter(positions);
  const centeredPositions = positions.map(p => vec3Sub(p, center) as Vec3);

  for (let i = 0; i < atoms.length; i++) {
    atoms[i].position = centeredPositions[i];
  }
  for (const bond of bonds) {
    bond.fromPos = centeredPositions[bond.from];
    bond.toPos = centeredPositions[bond.to];
  }
  for (const lp of lonePairs) {
    lp.position = vec3Sub(lp.position, center) as Vec3;
  }

  const radius = computeBoundingRadius(centeredPositions);

  return { atoms, bonds, lonePairs, center: [0, 0, 0], radius };
}

function computeAtomPositions(data: MoleculeData): Vec3[] {
  const n = data.atoms.length;
  if (n === 0) return [];

  if (n === 2 && data.bonds.length === 1) {
    const d = data.bonds[0].length * PM_SCALE / 2;
    return [[-d, 0, 0], [d, 0, 0]];
  }

  if (data.bond_pairs != null && data.central_atom != null) {
    return placeByVsepr(data);
  }

  if (data.category === 'aromatic') {
    return placeAromatic(data);
  }

  return placeByGraphTraversal(data);
}

function placeByVsepr(data: MoleculeData): Vec3[] {
  const positions: Vec3[] = new Array(data.atoms.length).fill(null).map(() => [0, 0, 0]);
  const bp = data.bond_pairs ?? 0;
  const lp = data.lone_pairs ?? 0;

  const template = findVseprTemplate(bp, lp);
  if (!template) return placeByGraphTraversal(data);

  const centralIdx = data.atoms.findIndex(a => a.element === data.central_atom);
  if (centralIdx < 0) return placeByGraphTraversal(data);

  positions[centralIdx] = [0, 0, 0];

  const centralBonds = data.bonds.filter(b => b.from === centralIdx || b.to === centralIdx);
  const bondedIndices = centralBonds.map(b => b.from === centralIdx ? b.to : b.from);

  const actualAngle = getFirstBondAngle(data);

  for (let i = 0; i < bondedIndices.length && i < template.positions.length; i++) {
    const dir = template.positions[i];
    const bond = centralBonds[i];
    const length = bond.length * PM_SCALE;

    let adjustedDir = dir;
    if (actualAngle && i < 2 && Math.abs(actualAngle - template.idealAngle) > 1) {
      adjustedDir = adjustDirectionForAngle(template.positions, i, actualAngle);
    }

    positions[bondedIndices[i]] = vec3Scale(vec3Normalize(adjustedDir), length);
  }

  return positions;
}

function getFirstBondAngle(data: MoleculeData): number | null {
  if (!data.bond_angles) return null;
  const angles = Object.values(data.bond_angles);
  return angles.length > 0 ? angles[0] : null;
}

function adjustDirectionForAngle(
  templatePositions: Vec3[],
  _index: number,
  targetAngle: number,
): Vec3 {
  if (templatePositions.length < 2) return templatePositions[0] ?? [1, 0, 0];
  const halfAngle = (targetAngle * Math.PI / 180) / 2;
  const sinA = Math.sin(halfAngle);
  const cosA = Math.cos(halfAngle);
  if (_index === 0) return [sinA, cosA, 0];
  return [-sinA, cosA, 0];
}

function placeAromatic(data: MoleculeData): Vec3[] {
  const positions: Vec3[] = new Array(data.atoms.length).fill(null).map(() => [0, 0, 0] as Vec3);
  const ringCarbons: number[] = [];
  for (let i = 0; i < data.atoms.length; i++) {
    if (data.atoms[i].element === 'C') ringCarbons.push(i);
  }

  if (data.id === 'MOL-057') {
    placeNaphthalene(data, positions, ringCarbons);
  } else {
    const firstSix = ringCarbons.slice(0, 6);
    placeHexagonRing(positions, firstSix, data.bonds[0]?.length ?? 139);
    for (let i = 6; i < ringCarbons.length; i++) {
      const ci = ringCarbons[i];
      const bond = data.bonds.find(b =>
        (b.from === ci && ringCarbons.slice(0, 6).includes(b.to)) ||
        (b.to === ci && ringCarbons.slice(0, 6).includes(b.from))
      );
      if (bond) {
        const parentIdx = bond.from === ci ? bond.to : bond.from;
        const parentPos = positions[parentIdx];
        const dir = vec3Normalize(parentPos);
        positions[ci] = vec3Add(parentPos, vec3Scale(dir, bond.length * PM_SCALE));
      }
    }
  }

  placeSubstituents(data, positions, ringCarbons);
  return positions;
}

function placeHexagonRing(positions: Vec3[], indices: number[], bondLengthPm: number) {
  const r = bondLengthPm * PM_SCALE;
  for (let i = 0; i < indices.length; i++) {
    const angle = (Math.PI / 2) + (i * 2 * Math.PI / 6);
    positions[indices[i]] = [r * Math.cos(angle), r * Math.sin(angle), 0];
  }
}

function placeNaphthalene(data: MoleculeData, positions: Vec3[], ringCarbons: number[]) {
  const r = (data.bonds[0]?.length ?? 139) * PM_SCALE;
  const ring1 = [0, 1, 2, 3, 4, 9];
  const dx = r * Math.sqrt(3);
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 2) + (i * 2 * Math.PI / 6);
    positions[ring1[i]] = [r * Math.cos(angle) - dx / 2, r * Math.sin(angle), 0];
  }
  const ring2Positions = [5, 6, 7, 8];
  for (let i = 0; i < 4; i++) {
    const angle = (Math.PI / 2) + ((i + 1) * 2 * Math.PI / 6);
    positions[ring2Positions[i]] = [r * Math.cos(angle) + dx / 2, r * Math.sin(angle), 0];
  }
  void ringCarbons;
}

function placeSubstituents(data: MoleculeData, positions: Vec3[], ringCarbons: number[]) {
  const ringSet = new Set(ringCarbons);
  for (let i = 0; i < data.atoms.length; i++) {
    if (ringSet.has(i)) continue;
    if (positions[i][0] !== 0 || positions[i][1] !== 0 || positions[i][2] !== 0) continue;
    const bond = data.bonds.find(b => b.from === i || b.to === i);
    if (!bond) continue;
    const parentIdx = bond.from === i ? bond.to : bond.from;
    const parentPos = positions[parentIdx];
    if (ringSet.has(parentIdx)) {
      const dir = vec3Normalize(parentPos);
      positions[i] = vec3Add(parentPos, vec3Scale(dir, bond.length * PM_SCALE));
    } else {
      placeSubstituentOnAtom(data, positions, parentIdx, i, bond.length * PM_SCALE);
    }
  }
}

function placeByGraphTraversal(data: MoleculeData): Vec3[] {
  const n = data.atoms.length;
  const positions: Vec3[] = new Array(n).fill(null).map(() => [0, 0, 0] as Vec3);
  const placed = new Array(n).fill(false);

  const adj: { neighbor: number; bond: typeof data.bonds[0] }[][] = Array.from({ length: n }, () => []);
  for (const bond of data.bonds) {
    adj[bond.from].push({ neighbor: bond.to, bond });
    adj[bond.to].push({ neighbor: bond.from, bond });
  }

  let startIdx = 0;
  for (let i = 0; i < n; i++) {
    if (data.atoms[i].element !== 'H') { startIdx = i; break; }
  }

  positions[startIdx] = [0, 0, 0];
  placed[startIdx] = true;

  const queue: number[] = [startIdx];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const neighbors = adj[current];
    const unplaced = neighbors.filter(n => !placed[n.neighbor]);
    if (unplaced.length === 0) continue;

    const totalBonds = neighbors.length;
    const hasDouble = neighbors.some(n => n.bond.order >= 2);
    const bondAngle = hasDouble && totalBonds <= 3 ? 120 : (totalBonds <= 2 ? 180 : 109.5);

    const placedNeighbors = neighbors.filter(n => placed[n.neighbor]);
    const usedDirections: Vec3[] = placedNeighbors.map(n =>
      vec3Normalize(vec3Sub(positions[n.neighbor], positions[current]))
    );

    const newDirections = generateDirections(usedDirections, unplaced.length, bondAngle, hasDouble);

    for (let i = 0; i < unplaced.length; i++) {
      const { neighbor, bond } = unplaced[i];
      const dir = newDirections[i] ?? [1, 0, 0] as Vec3;
      const dist = bond.length * PM_SCALE;
      positions[neighbor] = vec3Add(positions[current], vec3Scale(dir, dist));
      placed[neighbor] = true;
      queue.push(neighbor);
    }
  }

  return positions;
}

function generateDirections(usedDirs: Vec3[], count: number, bondAngle: number, planar: boolean): Vec3[] {
  const result: Vec3[] = [];
  const angleRad = bondAngle * Math.PI / 180;

  if (usedDirs.length === 0) {
    if (bondAngle === 180) {
      result.push([1, 0, 0], [-1, 0, 0]);
    } else if (bondAngle === 120 || planar) {
      for (let i = 0; i < count; i++) {
        const a = (i * 2 * Math.PI / Math.max(count, 3));
        result.push([Math.cos(a), Math.sin(a), 0]);
      }
    } else {
      const tetDirs: Vec3[] = [
        [0, 1, 0],
        [0, -1 / 3, Math.sqrt(8 / 9)],
        [Math.sqrt(2 / 3), -1 / 3, -Math.sqrt(2 / 9)],
        [-Math.sqrt(2 / 3), -1 / 3, -Math.sqrt(2 / 9)],
      ];
      for (let i = 0; i < count && i < tetDirs.length; i++) {
        result.push(tetDirs[i]);
      }
    }
    return result.slice(0, count);
  }

  if (usedDirs.length === 1) {
    const used = usedDirs[0];
    const perp = findPerpendicular(used);
    if (planar || bondAngle === 120) {
      for (let i = 0; i < count; i++) {
        const a = angleRad + i * angleRad;
        const dir = rotateAround(vec3Scale(used, -1), perp, a - Math.PI);
        result.push(vec3Normalize(dir));
      }
    } else if (bondAngle === 180) {
      result.push(vec3Scale(used, -1));
    } else {
      const baseAngle = Math.PI - angleRad;
      for (let i = 0; i < count; i++) {
        const phi = (i * 2 * Math.PI / count) + Math.PI / 4;
        const dir = coneDirection(vec3Scale(used, -1), baseAngle, phi);
        result.push(vec3Normalize(dir));
      }
    }
    return result.slice(0, count);
  }

  const avgUsed = vec3Normalize(
    usedDirs.reduce((acc, d) => vec3Add(acc, d), [0, 0, 0] as Vec3)
  );
  const antiAvg = vec3Scale(avgUsed, -1);

  if (count === 1) {
    result.push(vec3Normalize(antiAvg));
  } else {
    for (let i = 0; i < count; i++) {
      const phi = (i * 2 * Math.PI / count);
      const dir = coneDirection(antiAvg, Math.PI / 6, phi);
      result.push(vec3Normalize(dir));
    }
  }

  return result.slice(0, count);
}

function findPerpendicular(v: Vec3): Vec3 {
  const abs = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
  const minIdx = abs.indexOf(Math.min(...abs));
  const other: Vec3 = [0, 0, 0];
  other[minIdx] = 1;
  return vec3Normalize(vec3Cross(v, other));
}

function rotateAround(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = axis;
  const dot = vec3Dot(k, v);
  const cross = vec3Cross(k, v);
  return [
    v[0] * c + cross[0] * s + k[0] * dot * (1 - c),
    v[1] * c + cross[1] * s + k[1] * dot * (1 - c),
    v[2] * c + cross[2] * s + k[2] * dot * (1 - c),
  ];
}

function coneDirection(axis: Vec3, halfAngle: number, phi: number): Vec3 {
  const perp1 = findPerpendicular(axis);
  const perp2 = vec3Cross(axis, perp1);
  const sinH = Math.sin(halfAngle);
  const cosH = Math.cos(halfAngle);
  return vec3Add(
    vec3Scale(axis, cosH),
    vec3Add(
      vec3Scale(perp1, sinH * Math.cos(phi)),
      vec3Scale(perp2, sinH * Math.sin(phi)),
    ),
  );
}

function placeSubstituentOnAtom(
  data: MoleculeData,
  positions: Vec3[],
  parentIdx: number,
  childIdx: number,
  distance: number,
) {
  const adj = data.bonds
    .filter(b => b.from === parentIdx || b.to === parentIdx)
    .map(b => b.from === parentIdx ? b.to : b.from);

  const usedDirs: Vec3[] = [];
  for (const idx of adj) {
    if (idx === childIdx) continue;
    const dir = vec3Sub(positions[idx], positions[parentIdx]);
    if (vec3Length(dir) > 1e-10) {
      usedDirs.push(vec3Normalize(dir));
    }
  }

  const newDirs = generateDirections(usedDirs, 1, 109.5, false);
  if (newDirs.length > 0) {
    positions[childIdx] = vec3Add(positions[parentIdx], vec3Scale(newDirs[0], distance));
  } else {
    positions[childIdx] = vec3Add(positions[parentIdx], [distance, 0, 0]);
  }
}

// ═══════════════════════════════
//  全原子孤电子对计算
// ═══════════════════════════════

const VALENCE_ELECTRONS: Record<string, number> = {
  H: 1,
  B: 3, C: 4, N: 5, O: 6, F: 7,
  Al: 3, Si: 4, P: 5, S: 6, Cl: 7,
  Se: 6, Br: 7,
  I: 7, Xe: 8,
};

/** 可扩展八隅体的元素（第三周期+有d轨道的原子） */
const EXPANDABLE_OCTET = new Set(['Si', 'P', 'S', 'Cl', 'Se', 'Br', 'I', 'Xe']);

function computeAllLonePairs(
  atoms: { element: string }[],
  bonds: { from: number; to: number; order: number }[],
  positions: Vec3[],
  charge: number = 0,
): LonePair3D[] {
  const n = atoms.length;
  const bondOrderSum = new Array(n).fill(0);
  const bondCount = new Array(n).fill(0);
  for (const b of bonds) {
    bondOrderSum[b.from] += b.order;
    bondOrderSum[b.to] += b.order;
    bondCount[b.from]++;
    bondCount[b.to]++;
  }

  // 逐原子初始计算
  const perAtomLp = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (bondCount[i] === 0) continue;
    const ve = VALENCE_ELECTRONS[atoms[i].element];
    if (ve === undefined) continue;
    perAtomLp[i] = Math.max(0, Math.floor((ve - bondOrderSum[i]) / 2));
  }

  // 分子级修正（离子电荷 + 配位键偏差）
  let totalVE = 0;
  let allKnown = true;
  for (let i = 0; i < n; i++) {
    const ve = VALENCE_ELECTRONS[atoms[i].element];
    if (ve === undefined) { allKnown = false; break; }
    totalVE += ve;
  }
  if (allKnown) {
    const adjustedVE = totalVE - charge;
    const totalBondElectrons = bonds.reduce((s, b) => s + b.order, 0) * 2;
    const targetLpElectrons = adjustedVE - totalBondElectrons;
    const targetLpCount = Math.max(0, Math.floor(targetLpElectrons / 2));
    const currentSum = perAtomLp.reduce((s, v) => s + v, 0);
    let deficit = targetLpCount - currentSum;

    if (deficit > 0) {
      const candidates = [];
      for (let i = 0; i < n; i++) {
        if (bondCount[i] === 0) continue;
        const ve = VALENCE_ELECTRONS[atoms[i].element];
        if (ve === undefined || atoms[i].element === 'H') continue;
        // 八隅体容量：普通原子最多4对，expandable原子可超八隅体
        const maxLp = EXPANDABLE_OCTET.has(atoms[i].element)
          ? 6  // 可扩展到6对（如XeF₂的Xe有3对孤电子对）
          : Math.max(0, 4 - bondOrderSum[i]);
        if (perAtomLp[i] < maxLp) {
          candidates.push({ idx: i, bondOrders: bondOrderSum[i], room: maxLp - perAtomLp[i] });
        }
      }
      candidates.sort((a, b) => a.bondOrders - b.bondOrders);
      for (const c of candidates) {
        if (deficit <= 0) break;
        const give = Math.min(deficit, c.room);
        perAtomLp[c.idx] += give;
        deficit -= give;
      }
    }
  }

  const result: LonePair3D[] = [];
  const LP_LEN = 0.8;

  for (let i = 0; i < n; i++) {
    if (perAtomLp[i] === 0) continue;

    const dirs: Vec3[] = [];
    for (const b of bonds) {
      if (b.from === i) {
        const d = vec3Sub(positions[b.to], positions[i]);
        if (vec3Length(d) > 1e-10) dirs.push(vec3Normalize(d));
      } else if (b.to === i) {
        const d = vec3Sub(positions[b.from], positions[i]);
        if (vec3Length(d) > 1e-10) dirs.push(vec3Normalize(d));
      }
    }

    for (const dir of computeLpDirs3D(dirs, perAtomLp[i])) {
      result.push({
        position: vec3Add(positions[i], vec3Scale(dir, LP_LEN)),
        direction: dir,
        centerAtomIndex: i,
      });
    }
  }

  return result;
}

function computeLpDirs3D(bondDirs: Vec3[], count: number): Vec3[] {
  if (count === 0) return [];

  if (bondDirs.length === 0) {
    const t: Vec3[] = [[0,1,0],[0,-1/3,Math.sqrt(8/9)],[Math.sqrt(2/3),-1/3,-Math.sqrt(2/9)],[-Math.sqrt(2/3),-1/3,-Math.sqrt(2/9)]];
    return t.slice(0, count);
  }

  const avg: Vec3 = [0, 0, 0];
  for (const d of bondDirs) { avg[0] += d[0]; avg[1] += d[1]; avg[2] += d[2]; }
  const avgLen = vec3Length(avg);

  if (avgLen < 0.01) {
    if (bondDirs.length >= 2) {
      const cross = vec3Cross(bondDirs[0], bondDirs[1]);
      const crossLen = vec3Length(cross);

      if (crossLen < 0.01) {
        // 反平行键（线性分子如XeF₂）：在赤道平面均匀放置孤电子对
        const axis = vec3Normalize(bondDirs[0]);
        const perp = findPerpendicular(axis);
        const perp2 = vec3Normalize(vec3Cross(axis, perp));
        return Array.from({ length: count }, (_, i) => {
          const phi = i * 2 * Math.PI / count;
          const dir: Vec3 = [
            perp[0] * Math.cos(phi) + perp2[0] * Math.sin(phi),
            perp[1] * Math.cos(phi) + perp2[1] * Math.sin(phi),
            perp[2] * Math.cos(phi) + perp2[2] * Math.sin(phi),
          ];
          return vec3Normalize(dir);
        });
      }

      const normal = vec3Normalize(cross);
      if (count === 1) return [normal];
      return [normal, vec3Scale(normal, -1) as Vec3].slice(0, count);
    }
    return [[0, 1, 0] as Vec3];
  }

  const anti = vec3Scale(vec3Normalize(avg), -1) as Vec3;
  if (count === 1) return [anti];

  // 优先用分子平面法向量作为展开基，确保孤电子对在平面外（如 H₂O 的 sp³ 排列）
  let perp: Vec3;
  if (bondDirs.length >= 2) {
    const planeNormal = vec3Cross(bondDirs[0], bondDirs[1]);
    const pnLen = vec3Length(planeNormal);
    perp = pnLen > 0.01 ? vec3Normalize(planeNormal) : findPerpendicular(anti);
  } else {
    perp = findPerpendicular(anti);
  }
  const perp2 = vec3Normalize(vec3Cross(anti, perp));
  const tilt = count === 2 ? Math.PI / 6 : Math.PI / 4;

  return Array.from({ length: count }, (_, i) => {
    const phi = i * 2 * Math.PI / count;
    const dir: Vec3 = [
      anti[0] * Math.cos(tilt) + (perp[0] * Math.cos(phi) + perp2[0] * Math.sin(phi)) * Math.sin(tilt),
      anti[1] * Math.cos(tilt) + (perp[1] * Math.cos(phi) + perp2[1] * Math.sin(phi)) * Math.sin(tilt),
      anti[2] * Math.cos(tilt) + (perp[2] * Math.cos(phi) + perp2[2] * Math.sin(phi)) * Math.sin(tilt),
    ];
    return vec3Normalize(dir);
  });
}

function computeCenter(positions: Vec3[]): Vec3 {
  if (positions.length === 0) return [0, 0, 0];
  const sum = positions.reduce((acc, p) => vec3Add(acc, p), [0, 0, 0] as Vec3);
  return vec3Scale(sum, 1 / positions.length);
}

function computeBoundingRadius(positions: Vec3[]): number {
  return Math.max(1, ...positions.map(p => vec3Length(p))) * 1.2;
}
