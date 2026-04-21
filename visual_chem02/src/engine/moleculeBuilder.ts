/**
 * 分子 3D 模型构建器（SDF 版）
 *
 * 新架构：SDF 文件提供 3D 坐标 → 结合元数据 → 输出 MoleculeModel
 * 对于无 SDF 数据的分子（离子），回退到 legacyBuilder
 */

import type { MoleculeMetadata } from '@/data/moleculeMetadata';
import { getElement } from '@/data/elements';
import { parseSdf } from './sdfParser';
import type { Atom3D, Bond3D, LonePair3D, MoleculeModel, Vec3, SdfParseResult } from './types';
import {
  vec3Add, vec3Sub, vec3Scale, vec3Length,
  vec3Normalize, vec3Cross,
} from './types';
import type { BondType } from '@/data/bondTypes';

/**
 * 从 SDF 文本 + 元数据构建 MoleculeModel
 * SDF 坐标单位 Angstrom (1Å = 100pm)，与 PM_SCALE=1/100 的场景单位 1:1 对应
 */
export function buildMoleculeModelFromSdf(
  sdfText: string,
  meta: MoleculeMetadata,
): MoleculeModel {
  const sdf = parseSdf(sdfText);
  return buildFromParsedSdf(sdf, meta);
}

export function buildFromParsedSdf(
  sdf: SdfParseResult,
  meta: MoleculeMetadata,
): MoleculeModel {
  // 构建覆盖映射
  const overrideMap = new Map<string, BondType>();
  if (meta.bondTypeOverrides) {
    for (const o of meta.bondTypeOverrides) {
      overrideMap.set(`${o.from}-${o.to}`, o.type);
      overrideMap.set(`${o.to}-${o.from}`, o.type);
    }
  }

  // SDF 坐标已经是 Angstrom，1Å = 场景 1 单位（与旧 PM_SCALE=1/100 一致）
  const positions: Vec3[] = sdf.atoms.map(a => [a.x, a.y, a.z]);

  const atoms: Atom3D[] = sdf.atoms.map((sdfAtom, i) => {
    const elem = getElement(sdfAtom.element);
    return {
      index: i,
      element: sdfAtom.element,
      position: positions[i],
      radius: elem.ballRadius,
      spaceFillRadius: elem.spaceFillRadius,
      color: elem.cpkColor,
    };
  });

  const bonds: Bond3D[] = sdf.bonds.map(sdfBond => {
    const key = `${sdfBond.from}-${sdfBond.to}`;
    const overrideType = overrideMap.get(key);
    const type: BondType = overrideType ?? sdfOrderToBondType(sdfBond.order);
    const fromPos = positions[sdfBond.from];
    const toPos = positions[sdfBond.to];
    const length = vec3Length(vec3Sub(toPos, fromPos)) * 100; // 转回 pm 显示
    return {
      from: sdfBond.from,
      to: sdfBond.to,
      order: sdfBond.order === 4 ? 1 : sdfBond.order,
      type,
      length,
      fromPos,
      toPos,
    };
  });

  // 计算所有原子的孤电子对（价电子公式 + 分子电荷修正）
  const lonePairs = computeAllLonePairs(sdf.atoms, bonds, positions, meta.charge ?? 0);

  // 计算形式电荷：FC = VE - 非键电子 - 键级和（含电荷修正）
  computeFormalCharges(atoms, bonds, meta.charge ?? 0);

  // 配合物：用氧化态模型覆盖形式电荷
  if (meta.formalChargeOverrides) {
    for (const [idx, charge] of Object.entries(meta.formalChargeOverrides)) {
      const i = Number(idx);
      if (i >= 0 && i < atoms.length) atoms[i].formalCharge = charge;
    }
  }

  // 居中
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

function sdfOrderToBondType(order: number): BondType {
  switch (order) {
    case 1: return 'single';
    case 2: return 'double';
    case 3: return 'triple';
    case 4: return 'delocalized';
    default: return 'single';
  }
}

// ═══════════════════════════════
//  全原子孤电子对计算
// ═══════════════════════════════

/** 主族元素 + 部分过渡金属价电子数 */
const VALENCE_ELECTRONS: Record<string, number> = {
  H: 1,
  B: 3, C: 4, N: 5, O: 6, F: 7,
  Al: 3, Si: 4, P: 5, S: 6, Cl: 7,
  Se: 6, Br: 7,
  I: 7, Xe: 8,
  Mn: 7,  // 用于 MnO₄⁻ 形式电荷计算
};

/**
 * 为所有原子计算孤电子对
 * 1) 逐原子：lpCount = floor((valence − ΣbondOrders) / 2)
 * 2) 分子级修正：用总电子数（含离子电荷）校准，将差额分配到需要的原子
 * 3D方向：放在远离键方向的空隙中
 */
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

  // 第一步：逐原子计算初始孤电子对
  const perAtomLp = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (bondCount[i] === 0) continue;
    const ve = VALENCE_ELECTRONS[atoms[i].element];
    if (ve === undefined) continue;
    perAtomLp[i] = Math.max(0, Math.floor((ve - bondOrderSum[i]) / 2));
  }

  // 第二步：分子级修正（处理离子电荷和配位键导致的偏差）
  let totalVE = 0;
  let allKnown = true;
  for (let i = 0; i < n; i++) {
    const ve = VALENCE_ELECTRONS[atoms[i].element];
    if (ve === undefined) { allKnown = false; break; }
    totalVE += ve;
  }
  if (allKnown) {
    const adjustedVE = totalVE - charge; // 阴离子加电子，阳离子减电子
    const totalBondElectrons = bonds.reduce((s, b) => s + b.order, 0) * 2;
    const targetLpElectrons = adjustedVE - totalBondElectrons;
    const targetLpCount = Math.max(0, Math.floor(targetLpElectrons / 2));
    const currentSum = perAtomLp.reduce((s, v) => s + v, 0);
    let deficit = targetLpCount - currentSum;

    // 将差额分配到可接受更多孤电子对的原子（键级低、电负性高的优先）
    if (deficit > 0) {
      const candidates = [];
      for (let i = 0; i < n; i++) {
        if (bondCount[i] === 0) continue;
        const ve = VALENCE_ELECTRONS[atoms[i].element];
        if (ve === undefined || atoms[i].element === 'H') continue;
        // 八隅体容量：最多 4 对（含成键对）
        const maxLp = Math.max(0, 4 - bondOrderSum[i]);
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

  // 第三步：生成 3D 方向
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

/** 计算孤电子对3D方向：放在远离键方向的空隙中 */
function computeLpDirs3D(bondDirs: Vec3[], count: number): Vec3[] {
  if (count === 0) return [];

  if (bondDirs.length === 0) {
    const t: Vec3[] = [[0,1,0],[0,-1/3,Math.sqrt(8/9)],[Math.sqrt(2/3),-1/3,-Math.sqrt(2/9)],[-Math.sqrt(2/3),-1/3,-Math.sqrt(2/9)]];
    return t.slice(0, count);
  }

  // 平均键方向 → 反方向即孤电子对主方向
  const avg: Vec3 = [0, 0, 0];
  for (const d of bondDirs) { avg[0] += d[0]; avg[1] += d[1]; avg[2] += d[2]; }
  const avgLen = vec3Length(avg);

  if (avgLen < 0.01) {
    // 对称排列：用前两条键的法向量
    if (bondDirs.length >= 2) {
      const normal = vec3Normalize(vec3Cross(bondDirs[0], bondDirs[1]));
      if (count === 1) return [normal];
      return [normal, vec3Scale(normal, -1) as Vec3].slice(0, count);
    }
    return [[0, 1, 0] as Vec3];
  }

  const anti = vec3Scale(vec3Normalize(avg), -1) as Vec3;
  if (count === 1) return [anti];

  // 多个孤电子对：围绕反方向锥面展开
  // 优先用分子平面法向量作为展开基，确保孤电子对在平面外（如 H₂O 的 sp³ 排列）
  let perp: Vec3;
  if (bondDirs.length >= 2) {
    const planeNormal = vec3Cross(bondDirs[0], bondDirs[1]);
    const pnLen = vec3Length(planeNormal);
    perp = pnLen > 0.01 ? vec3Normalize(planeNormal) : findPerp3D(anti);
  } else {
    perp = findPerp3D(anti);
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

function findPerp3D(v: Vec3): Vec3 {
  const abs = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
  const minIdx = abs.indexOf(Math.min(...abs));
  const other: Vec3 = [0, 0, 0];
  other[minIdx] = 1;
  return vec3Normalize(vec3Cross(v, other));
}

/**
 * 计算每个原子的形式电荷：FC = VE(自由原子) - 非键电子数 - 键级和
 * 考虑分子整体电荷来正确分配非键电子（孤电子对）
 *
 * @param charge 分子整体电荷（阳离子为正，阴离子为负）
 */
export function computeFormalCharges(
  atoms: Atom3D[],
  bonds: { from: number; to: number; order: number }[],
  charge: number = 0,
): void {
  const n = atoms.length;
  const bondOrderSum = new Array(n).fill(0);
  const bondCount = new Array(n).fill(0);
  for (const b of bonds) {
    bondOrderSum[b.from] += b.order;
    bondOrderSum[b.to] += b.order;
    bondCount[b.from]++;
    bondCount[b.to]++;
  }

  // 检查所有元素是否有已知价电子数
  let totalVE = 0;
  let allKnown = true;
  const veArr = new Array(n).fill(0);
  const unknownIndices: number[] = [];
  for (let i = 0; i < n; i++) {
    const ve = VALENCE_ELECTRONS[atoms[i].element];
    if (ve === undefined) {
      allKnown = false;
      unknownIndices.push(i);
    } else {
      veArr[i] = ve;
      totalVE += ve;
    }
  }

  // 含过渡金属：电荷分配到金属原子，其余按中性计算
  if (!allKnown) {
    for (let i = 0; i < n; i++) atoms[i].formalCharge = 0;
    // 金属原子承担整体电荷
    if (unknownIndices.length === 1) {
      atoms[unknownIndices[0]].formalCharge = charge;
    }
    // 非金属原子按中性分子计算
    for (let i = 0; i < n; i++) {
      if (unknownIndices.includes(i)) continue;
      const ve = veArr[i];
      const lpCount = Math.max(0, Math.floor((ve - bondOrderSum[i]) / 2));
      atoms[i].formalCharge = ve - 2 * lpCount - bondOrderSum[i];
    }
    return;
  }

  // 全部主族元素：用电子总数分配非键电子
  const adjustedVE = totalVE - charge; // 阴离子多电子，阳离子少电子
  const totalBondE = bonds.reduce((s, b) => s + b.order, 0) * 2;
  const totalNonBondE = Math.max(0, adjustedVE - totalBondE);

  // 每个原子满足八隅体所需的非键电子数（无键原子跳过，避免配合物中孤立金属抢电子）
  const target = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (bondCount[i] === 0) continue; // 无键原子不参与分配
    const octet = atoms[i].element === 'H' ? 2 : 8;
    target[i] = Math.max(0, octet - 2 * bondOrderSum[i]);
  }

  // 按端基原子优先分配（键数少的先满足八隅体）
  const sorted = Array.from({ length: n }, (_, i) => i)
    .sort((a, b) => bondCount[a] - bondCount[b] || veArr[b] - veArr[a]);
  const actualNB = new Array(n).fill(0);
  let pool = totalNonBondE;
  for (const i of sorted) {
    const give = Math.min(target[i], pool);
    actualNB[i] = give;
    pool -= give;
  }

  // 第二遍：剩余电子分配给可扩展八隅体的原子（第三周期+有d轨道）
  // 例如 H₂SO₃ 的 S 有1对孤电子对（超八隅体），需要接收额外2个非键电子
  if (pool > 0) {
    const expandable = new Set(['Si', 'P', 'S', 'Cl', 'Se', 'Br', 'I', 'Xe']);
    // 优先给中心原子（键数最多的）
    for (let j = sorted.length - 1; j >= 0; j--) {
      if (pool <= 0) break;
      const i = sorted[j];
      if (!expandable.has(atoms[i].element)) continue;
      actualNB[i] += pool;
      pool = 0;
    }
  }

  // FC = VE(自由原子) - 非键电子 - 键级和
  for (let i = 0; i < n; i++) {
    atoms[i].formalCharge = veArr[i] - actualNB[i] - bondOrderSum[i];
  }
}

function computeCenter(positions: Vec3[]): Vec3 {
  if (positions.length === 0) return [0, 0, 0];
  const sum = positions.reduce((acc, p) => vec3Add(acc, p), [0, 0, 0] as Vec3);
  return vec3Scale(sum, 1 / positions.length);
}

function computeBoundingRadius(positions: Vec3[]): number {
  return Math.max(1, ...positions.map(p => vec3Length(p))) * 1.2;
}

/**
 * 从 SDF 文本构建导入分子的 MoleculeModel（无元数据）
 */
export function buildImportedMoleculeModel(sdfText: string): MoleculeModel {
  const dummyMeta: MoleculeMetadata = {
    id: 'IMPORT', name_cn: '导入分子', name_en: 'Imported',
    formula: '', level: '', category: 'polyatomic', subcategory: 'organic',
    sdfFile: '', hasSdf: true,
  };
  return buildMoleculeModelFromSdf(sdfText, dummyMeta);
}
