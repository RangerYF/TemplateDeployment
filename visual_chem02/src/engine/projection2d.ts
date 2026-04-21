/**
 * 2D → 2D 投影引擎
 * PCA 投影到最大方差平面，返回 2D 坐标用于 SVG 渲染
 * 新增：buildProjected2DFromPositions — 接受预计算的2D坐标构建完整Projected2D
 */

import type { MoleculeModel, Vec3 } from './types';

export interface Projected2DAtom {
  index: number;
  x: number;
  y: number;
  element: string;
  label: string;      // 元素符号 + 氢计数(如 CH₃)
  hCount: number;      // 连接的氢原子数
  lonePairs: number;   // 孤电子对数
  merged: boolean;     // 此H原子已合并到父原子标签中（结构简式/键线式用）
  formalCharge: number; // 形式电荷（0 = 无标注）
  unpairedElectrons?: number; // 未成对电子数（自由基用，如 NO₂ 的 N 上有1个）
  aldehydeOxygen?: boolean; // 醛基氧：已合并到CHO标签中，不单独显示
  carboxylicOH?: boolean; // 羧酸羟基氧：已合并到COOH标签中，不单独显示
}

export interface Projected2DBond {
  from: number;
  to: number;
  order: number;       // 1=单,2=双,3=三
  type: string;
  length: number;      // 键长 (pm)
}

export interface Projected2D {
  atoms: Projected2DAtom[];
  bonds: Projected2DBond[];
}

// ═══════════════════════════════
//  公共API
// ═══════════════════════════════

/**
 * 从预计算的2D坐标构建完整Projected2D（用于拓扑布局）
 * mergeMode: 'default' = 仅合并bondCount≥4的H, 'all' = 合并所有H, 'none' = 不合并
 * lewisFormalCharges: 电子式模式下的形式电荷覆盖（用于SO₂、O₃等）
 */
export function buildProjected2DFromPositions(
  positions: [number, number][],
  model: MoleculeModel,
  mergeMode: 'default' | 'all' | 'none' = 'default',
  _structuralSimplified: boolean = false,
  lewisFormalCharges?: Record<number, number>,
): Projected2D {
  const projected2d = positions.map(p => ({ x: p[0], y: p[1] }));
  return buildProjected2DImpl(projected2d, model, mergeMode, lewisFormalCharges);
}

/** PCA 投影 3D→2D（仅用于导入分子的回退方案） */
export function project3Dto2D(model: MoleculeModel): Projected2D {
  const positions = model.atoms.map(a => a.position);
  const n = positions.length;

  if (n === 0) return { atoms: [], bonds: [] };

  // 计算重心
  const cx = positions.reduce((s, p) => s + p[0], 0) / n;
  const cy = positions.reduce((s, p) => s + p[1], 0) / n;
  const cz = positions.reduce((s, p) => s + p[2], 0) / n;

  // 中心化坐标
  const centered = positions.map(p => [p[0] - cx, p[1] - cy, p[2] - cz] as Vec3);

  // 计算协方差矩阵 3x3 (row-major)
  const cov = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (const p of centered) {
    cov[0] += p[0] * p[0]; cov[1] += p[0] * p[1]; cov[2] += p[0] * p[2];
    cov[3] += p[1] * p[0]; cov[4] += p[1] * p[1]; cov[5] += p[1] * p[2];
    cov[6] += p[2] * p[0]; cov[7] += p[2] * p[1]; cov[8] += p[2] * p[2];
  }

  // 求前两个主成分
  const pc1 = powerIteration(cov);
  const lambda1 = eigenvalue(cov, pc1);

  // 从协方差中去除 pc1 分量
  const covDeflated = [...cov];
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      covDeflated[i * 3 + j] -= lambda1 * pc1[i] * pc1[j];
    }
  }
  const pc2 = powerIteration(covDeflated);

  // 投影到 pc1, pc2
  const projected2d = centered.map(p => ({
    x: p[0] * pc1[0] + p[1] * pc1[1] + p[2] * pc1[2],
    y: p[0] * pc2[0] + p[1] * pc2[1] + p[2] * pc2[2],
  }));

  // 退化处理：单原子分子
  if (n === 1) {
    projected2d[0] = { x: 0, y: 0 };
  }

  return buildProjected2DImpl(projected2d, model, 'default', undefined);
}

/** 缩放/居中到 SVG viewBox */
export function layoutForSVG(
  projected: Projected2D,
  width: number,
  height: number,
  padding = 60,
): Projected2D {
  const atoms = projected.atoms;
  if (atoms.length === 0) return projected;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const a of atoms) {
    if (a.x < minX) minX = a.x;
    if (a.x > maxX) maxX = a.x;
    if (a.y < minY) minY = a.y;
    if (a.y > maxY) maxY = a.y;
  }

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  // 限制最大缩放，避免小分子原子间距过大（键长≈96px）
  const maxScale = 80;
  const scale = Math.min(usableW / rangeX, usableH / rangeY, maxScale);

  return {
    atoms: atoms.map(a => ({
      ...a,
      x: (a.x - (minX + maxX) / 2) * scale,
      y: -(a.y - (minY + maxY) / 2) * scale, // 翻转 Y 轴
    })),
    bonds: projected.bonds,
  };
}

// ═══════════════════════════════
//  内部共享逻辑
// ═══════════════════════════════

/** 从2D坐标 + 模型数据构建完整的Projected2D（标签/合并/孤电子对）
 *  mergeMode: 'none' = 不合并(电子式), 'default' = 仅≥4键合并, 'all' = 全部合并(结构简式/键线式)
 *  lewisFormalCharges: 电子式模式下的形式电荷覆盖
 */
function buildProjected2DImpl(
  projected2d: { x: number; y: number }[],
  model: MoleculeModel,
  mergeMode: 'default' | 'all' | 'none',
  lewisFormalCharges?: Record<number, number>,
): Projected2D {
  const n = model.atoms.length;

  if (n === 0) return { atoms: [], bonds: [] };

  // 统计每个原子的键数和连接的H数
  const bondCounts = new Array(n).fill(0);
  const hCounts = new Array(n).fill(0);
  for (const b of model.bonds) {
    bondCounts[b.from]++;
    bondCounts[b.to]++;
    if (model.atoms[b.to].element === 'H') hCounts[b.from]++;
    if (model.atoms[b.from].element === 'H') hCounts[b.to]++;
  }

  // 预计算每个原子的邻居列表
  const neighbors: Map<number, Array<{ idx: number; order: number }>> = new Map();
  for (let i = 0; i < n; i++) neighbors.set(i, []);
  for (let i = 0; i < model.bonds.length; i++) {
    const b = model.bonds[i];
    neighbors.get(b.from)!.push({ idx: b.to, order: b.order });
    neighbors.get(b.to)!.push({ idx: b.from, order: b.order });
  }

  // 预计算每个原子是否有非H邻居
  const hasNonHNeighbor = new Array(n).fill(false);
  for (const b of model.bonds) {
    if (model.atoms[b.from].element !== 'H' && model.atoms[b.to].element !== 'H') {
      hasNonHNeighbor[b.from] = true;
      hasNonHNeighbor[b.to] = true;
    }
  }

  // 检测官能团中的H需要合并
  // -OH（羟基）: O-H，O有非H邻居 → H合并，O显示为"OH"
  // -NH₂（氨基）: N-H，N有非H邻居 → H合并，N显示为"NH₂"
  // -CHO（醛基）: C-H，C连接O（双键） → H合并，C显示为"CHO"
  // 普通C-H: C有非H邻居 → H合并
  const mergedH = new Set<number>();

  if (mergeMode !== 'none') {
    for (const b of model.bonds) {
      const fromEl = model.atoms[b.from].element;
      const toEl = model.atoms[b.to].element;

      // N-H（氨基）-NH₂
      if ((fromEl === 'H' && toEl === 'N') || (fromEl === 'N' && toEl === 'H')) {
        const nIdx = fromEl === 'N' ? b.from : b.to;
        const hIdx = fromEl === 'H' ? b.from : b.to;
        if (hasNonHNeighbor[nIdx] && mergeMode === 'all') {
          mergedH.add(hIdx);
        }
        continue;
      }

      // O-H（羟基）-OH
      if ((fromEl === 'H' && toEl === 'O') || (fromEl === 'O' && toEl === 'H')) {
        const oIdx = fromEl === 'O' ? b.from : b.to;
        const hIdx = fromEl === 'H' ? b.from : b.to;
        if (hasNonHNeighbor[oIdx] && mergeMode === 'all') {
          mergedH.add(hIdx);
        }
        continue;
      }

      // C-H
      if ((fromEl === 'H' && toEl === 'C') || (fromEl === 'C' && toEl === 'H')) {
        const cIdx = fromEl === 'C' ? b.from : b.to;
        const hIdx = fromEl === 'H' ? b.from : b.to;
        const shouldMerge = mergeMode === 'all'
          || (mergeMode === 'default' && bondCounts[cIdx] >= 4 && hasNonHNeighbor[cIdx]);
        if (shouldMerge) {
          mergedH.add(hIdx);
        }
        continue;
      }
    }
  }

  // 标记醛基C和羧酸C（用于CHO/COOH标签）
  // 特判：小分子直接跳过这些特殊检测
  // - 甲醛(HCHO): C连接O(双键) + 2H → 显示HCHO
  // - 碳酸根(CO₃²⁻): C连接O(双键) + 2个单键O(无H) → 不是羧酸
  // - 醛基：C连接O(双键) + H（直接连在C上），且没有单键O（如乙醛CH₃CHO）
  // - 羧酸：C连接O(双键) + O(单键连H-OH)（如甲酸、乙酸）
  const aldehydeC = new Set<number>();
  const carboxylicAcidC = new Set<number>();
  const carboxylicAcidOH = new Set<number>(); // 羧酸羟基氧（不单独显示）

  // 统计有H邻居的氧原子（用于检测羧酸羟基）
  const oxygenWithH = new Set<number>();
  for (const b of model.bonds) {
    const fromEl = model.atoms[b.from].element;
    const toEl = model.atoms[b.to].element;
    if (fromEl === 'O' && toEl === 'H') oxygenWithH.add(b.from);
    if (fromEl === 'H' && toEl === 'O') oxygenWithH.add(b.to);
  }

  // 特判：检测碳酸根(CO₃²⁻) - C连接双键O + 2个单键O(无H)
  const isCarbonateIon = (cNbrs: Array<{ idx: number; order: number }>): boolean => {
    const hasDoubleO = cNbrs.some(nb => model.atoms[nb.idx].element === 'O' && nb.order === 2);
    if (!hasDoubleO) return false;
    const singleBondedOs = cNbrs.filter(nb => model.atoms[nb.idx].element === 'O' && nb.order === 1);
    if (singleBondedOs.length !== 2) return false;
    // 所有单键O都没有H → 碳酸根
    return singleBondedOs.every(nb => !oxygenWithH.has(nb.idx));
  };

  for (let i = 0; i < n; i++) {
    if (model.atoms[i].element !== 'C') continue;
    const cNbrs = neighbors.get(i)!;
    const hasDoubleO = cNbrs.some(nb => model.atoms[nb.idx].element === 'O' && nb.order === 2);
    const bondedHCount = cNbrs.filter(nb => model.atoms[nb.idx].element === 'H').length;

    // 特判：甲醛 - C连接双键O + 2个H（C上直接连H）
    if (hasDoubleO && bondedHCount >= 2) {
      // 甲醛：醛基碳上有2个H，显示为HCHO
      aldehydeC.add(i);
      // 标记醛基氧为已合并
      cNbrs.forEach(nb => {
        if (model.atoms[nb.idx].element === 'O' && nb.order === 2) {
          mergedH.add(nb.idx);
        }
      });
      continue;
    }

    // 跳过碳酸根 - 不显示为羧酸
    if (isCarbonateIon(cNbrs)) {
      continue;
    }

    // 检测羧酸：双键O + 单键O(连接H-OH)
    const hasCarboxylOH = cNbrs.some(nb => {
      if (model.atoms[nb.idx].element !== 'O' || nb.order !== 1) return false;
      return oxygenWithH.has(nb.idx);
    });

    if (hasDoubleO && hasCarboxylOH) {
      // 羧酸：双键氧 + 羟基氧
      carboxylicAcidC.add(i);
      // 标记双键氧为已合并
      cNbrs.forEach(nb => {
        if (model.atoms[nb.idx].element === 'O' && nb.order === 2) {
          mergedH.add(nb.idx);
        }
      });
      // 标记羧酸羟基氧（H合并，氧本身不显示）
      cNbrs.forEach(nb => {
        if (model.atoms[nb.idx].element === 'O' && nb.order === 1 && oxygenWithH.has(nb.idx)) {
          mergedH.add(nb.idx);
          carboxylicAcidOH.add(nb.idx);
        }
      });
      continue;
    }

    // 检测醛基（乙醛等）：双键O + H（直接连在C上），没有单键O
    const hasSingleBondedO = cNbrs.some(nb => {
      if (model.atoms[nb.idx].element !== 'O' || nb.order !== 1) return false;
      return true;
    });

    if (hasDoubleO && bondedHCount >= 1 && !hasSingleBondedO) {
      // 醛基：双键氧 + H（C上直接连H），没有单键氧
      aldehydeC.add(i);
      // 标记醛基氧为已合并
      cNbrs.forEach(nb => {
        if (model.atoms[nb.idx].element === 'O' && nb.order === 2) {
          mergedH.add(nb.idx);
        }
      });
    }
  }

  // 统计孤电子对
  const lonePairCounts = new Array(n).fill(0);
  for (const lp of model.lonePairs) {
    lonePairCounts[lp.centerAtomIndex]++;
  }

  const atoms: Projected2DAtom[] = model.atoms.map((atom, i) => {
    const el = atom.element;
    let label = el;

    // 醛基C显示为HCHO或CHO
    // - 甲醛（CH₂O）：C连接双键O + 2个H → 显示HCHO
    // - 其他醛基：C连接双键O + 1个H → 显示CHO
    if (el === 'C' && aldehydeC.has(i) && mergeMode !== 'none') {
      const cNbrs = neighbors.get(i)!;
      const bondedH = cNbrs.filter(nb => model.atoms[nb.idx].element === 'H').length;
      label = bondedH >= 2 ? 'HCHO' : 'CHO';
    }

    // 羧酸C显示为COOH
    if (el === 'C' && carboxylicAcidC.has(i) && mergeMode !== 'none') {
      label = 'COOH';
    }

    // 羟基O显示为OH（但羧酸的羟基氧要跳过）
    if (el === 'O' && mergeMode !== 'none') {
      const oNbrs = neighbors.get(i)!;
      const bondedC = oNbrs.find(nb => model.atoms[nb.idx].element === 'C' && carboxylicAcidC.has(nb.idx));
      // 羧酸羟基氧不显示（已合并到COOH）
      if (!bondedC) {
        const bondedH = oNbrs.find(nb => model.atoms[nb.idx].element === 'H' && mergedH.has(nb.idx));
        if (bondedH) {
          label = 'OH';
        }
      }
    }

    // 氨基N显示为NH₂（只有当N有非H邻居时才显示，如-NH₂）
    // NH₃（氨气）没有非H邻居，显示为N
    if (el === 'N' && hasNonHNeighbor[i]) {
      const nNbrs = neighbors.get(i)!;
      const bondedH = nNbrs.filter(nb => model.atoms[nb.idx].element === 'H' && mergedH.has(nb.idx));
      if (bondedH.length > 0 && mergeMode !== 'none') {
        label = 'NH₂';
      }
    }

    // 其他原子：C-H合并显示CH₃、H₂、H₃等
    if (el !== 'H' && hCounts[i] > 0) {
      const mergedHCount = model.bonds
        .filter(b => {
          if (b.from === i && model.atoms[b.to].element === 'H') return mergedH.has(b.to);
          if (b.to === i && model.atoms[b.from].element === 'H') return mergedH.has(b.from);
          return false;
        }).length;
      if (mergedHCount > 0 && !aldehydeC.has(i) && el !== 'O' && el !== 'N') {
        label = el + (mergedHCount === 1 ? 'H' : `H${subscript(mergedHCount)}`);
      }
    }
    // 电子式模式使用Lewis形式电荷（如SO₂、O₃）
    const formalCharge = lewisFormalCharges !== undefined
      ? (lewisFormalCharges[i] ?? 0)
      : (atom.formalCharge ?? 0);

    // 检查是否是醛基氧（已合并到CHO中）
    const isAldehydeOxygen = mergeMode !== 'none' && el === 'O' && (() => {
      const oNbrs = neighbors.get(i)!;
      const bondedC = oNbrs.find(nb => model.atoms[nb.idx].element === 'C');
      return bondedC && aldehydeC.has(bondedC.idx);
    })();

    // 检查是否是羧酸羟基氧（已合并到COOH中）
    const isCarboxylicOH = mergeMode !== 'none' && el === 'O' && carboxylicAcidOH.has(i);

    return {
      index: i,
      x: projected2d[i]?.x ?? 0,
      y: projected2d[i]?.y ?? 0,
      element: el,
      label,
      hCount: hCounts[i],
      lonePairs: lonePairCounts[i],
      merged: mergedH.has(i),
      formalCharge,
      aldehydeOxygen: isAldehydeOxygen,
      carboxylicOH: isCarboxylicOH,
    };
  });

  const bonds: Projected2DBond[] = model.bonds.map(b => ({
    from: b.from,
    to: b.to,
    order: b.order,
    type: b.type,
    length: b.length,
  }));

  return { atoms, bonds };
}

// --- helpers ---

function subscript(n: number): string {
  const subs = '₀₁₂₃₄₅₆₇₈₉';
  return String(n).split('').map(d => subs[parseInt(d)]).join('');
}

/** 幂迭代求最大特征向量，尝试多个初始向量避免退化 */
function powerIteration(cov: number[], iterations = 30): [number, number, number] {
  const starts: [number, number, number][] = [
    [1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0.577, 0.577, 0.577],
  ];

  let bestVec: [number, number, number] = [1, 0, 0];
  let bestEigenvalue = 0;

  for (const start of starts) {
    let v: [number, number, number] = [...start];
    for (let iter = 0; iter < iterations; iter++) {
      const nv = matVecMul3(cov, v);
      const len = Math.sqrt(nv[0] ** 2 + nv[1] ** 2 + nv[2] ** 2);
      if (len < 1e-10) break;
      v = [nv[0] / len, nv[1] / len, nv[2] / len];
    }
    const ev = eigenvalue(cov, v);
    if (ev > bestEigenvalue) {
      bestEigenvalue = ev;
      bestVec = v;
    }
  }

  return bestVec;
}

function matVecMul3(m: number[], v: [number, number, number]): [number, number, number] {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ];
}

function eigenvalue(cov: number[], v: [number, number, number]): number {
  const Av = matVecMul3(cov, v);
  return Av[0] * v[0] + Av[1] * v[1] + Av[2] * v[2];
}
