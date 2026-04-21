/**
 * 确定性2D布局生成器
 * 基于分子拓扑结构（不使用PCA投影）生成干净的2D化学式坐标
 * 71个内置分子使用拓扑布局，导入分子返回null回退到PCA
 *
 * 布局策略：
 * - 双原子：水平线
 * - 星形拓扑（无机/小分子）：中心原子 + 径向配体，角度由VSEPR决定
 * - 链式拓扑（有机）：重原子骨架锯齿形 + 分支/H扩散
 * - 环形拓扑（芳香族）：正多边形 + 取代基向外辐射
 */

import type { MoleculeModel } from './types';
import { ALL_MOLECULES, type MoleculeMetadata } from '@/data/moleculeMetadata';

/** 标准键长单位 */
const L = 1.2;
const DEG = Math.PI / 180;
const S3 = Math.sqrt(3) / 2; // sin(60°)

/**
 * 生成内置分子的确定性2D坐标
 * @param forElectronFormula true=电子式布局(sp³十字形直线), false=结构简式/键线式(sp³锯齿形)
 * @returns [x,y][] 每个原子的坐标（索引对应model.atoms） | null（导入分子回退PCA）
 */
export function generateLayout2D(
  moleculeId: string,
  model: MoleculeModel,
  forElectronFormula = true,
): [number, number][] | null {
  if (moleculeId.startsWith('IMP-')) return null;

  const n = model.atoms.length;
  if (n === 0) return [];
  if (n === 1) return [[0, 0]];
  if (n === 2) return [[-L / 2, 0], [L / 2, 0]];

  // P₄O₁₀ 笼状分子专用布局：4P 正方形 + 6 桥接O + 4 端基O=P
  // 原子顺序: P0 P1 P2 P3 | O4(P0-P1) O5(P0-P2) O6(P0-P3) O7(P1-P2) O8(P1-P3) O9(P2-P3) | O10(=P0) O11(=P1) O12(=P2) O13(=P3)
  if (moleculeId === 'MOL-074' && n === 14) {
    const S = 2 * L;     // 正方形半边长（加大避免标签重叠）
    const D = 0.8 * L;   // 对角桥接O偏移量（两对角O间距≈2.7）
    const T = L;         // 端基O=P键长
    return [
      [-S, -S],          // 0: P  左上
      [S, -S],           // 1: P  右上
      [-S, S],           // 2: P  左下
      [S, S],            // 3: P  右下
      [0, -S],           // 4: O  桥 P0-P1（上边中点）
      [-S, 0],           // 5: O  桥 P0-P2（左边中点）
      [-D, D],           // 6: O  桥 P0-P3（对角↘偏左）
      [D, -D],           // 7: O  桥 P1-P2（对角↗偏右）
      [S, 0],            // 8: O  桥 P1-P3（右边中点）
      [0, S],            // 9: O  桥 P2-P3（下边中点）
      [-S - T, -S],      // 10: O═P0 端基（左外）
      [S + T, -S],       // 11: O═P1 端基（右外）
      [-S - T, S],       // 12: O═P2 端基（左外）
      [S + T, S],        // 13: O═P3 端基（右外）
    ];
  }

  // 普鲁士蓝 Fe₄[Fe(CN)₆]₃ 专用布局：3 Fe²⁺ + 4 Fe³⁺ + 18 CN
  // 原子顺序: Fe²⁺(0,1,2) Fe³⁺(3,4,5,6) N(7-24) C(25-42)
  // 链: Fe²⁺→C≡N→Fe³⁺，C紧邻Fe²⁺，N紧邻Fe³⁺
  if (moleculeId === 'MOL-091' && n === 43) {
    const S = L;
    const fan = 0.6 * S;       // 3条CN桥的横向展开
    const cD = 1.2 * S;        // C 距 Fe²⁺ 的距离
    const nD = 2.8 * S;        // N 距 Fe²⁺ 的距离（靠近 Fe³⁺）
    const feGap = 4 * S;       // Fe²⁺ 与 Fe³⁺ 的间距
    const colGap = 6 * S;      // 左右列间距
    const dangleX = 12 * S;    // Fe²⁺(1) dangling 位置
    const cR = 1.2 * S;        // 游离CN的C距离
    const nR = 2.5 * S;        // 游离CN的N距离

    const pos: [number, number][] = new Array(43);

    // Fe 原子
    pos[0]  = [0, 0];                // Fe²⁺ 左列中心
    pos[1]  = [dangleX, 0];          // Fe²⁺ 游离（右侧）
    pos[2]  = [colGap, 0];           // Fe²⁺ 右列中心
    pos[3]  = [0, feGap];            // Fe³⁺ 左列下
    pos[4]  = [colGap, -feGap];      // Fe³⁺ 右列上
    pos[5]  = [colGap, feGap];       // Fe³⁺ 右列下
    pos[6]  = [0, -feGap];           // Fe³⁺ 左列上

    // Fe²⁺(0)→Fe³⁺(3) 向下桥接：C25,C26,C27 / N7,N8,N9
    pos[25] = [-fan, cD]; pos[26] = [0, cD]; pos[27] = [fan, cD];
    pos[7]  = [-fan, nD]; pos[8]  = [0, nD]; pos[9]  = [fan, nD];

    // Fe²⁺(0)→Fe³⁺(6) 向上桥接：C28,C29,C30 / N10,N11,N12
    pos[28] = [-fan, -cD]; pos[29] = [0, -cD]; pos[30] = [fan, -cD];
    pos[10] = [-fan, -nD]; pos[11] = [0, -nD]; pos[12] = [fan, -nD];

    // Fe²⁺(2)→Fe³⁺(5) 向下桥接：C37,C38,C39 / N19,N20,N21
    pos[37] = [colGap - fan, cD]; pos[38] = [colGap, cD]; pos[39] = [colGap + fan, cD];
    pos[19] = [colGap - fan, nD]; pos[20] = [colGap, nD]; pos[21] = [colGap + fan, nD];

    // Fe²⁺(2)→Fe³⁺(4) 向上桥接：C40,C41,C42 / N22,N23,N24
    pos[40] = [colGap - fan, -cD]; pos[41] = [colGap, -cD]; pos[42] = [colGap + fan, -cD];
    pos[22] = [colGap - fan, -nD]; pos[23] = [colGap, -nD]; pos[24] = [colGap + fan, -nD];

    // Fe²⁺(1) 游离6条CN（六角放射）：C31-C36 / N13-N18
    const hexAngles = [0, Math.PI / 3, 2 * Math.PI / 3, Math.PI, 4 * Math.PI / 3, 5 * Math.PI / 3];
    for (let k = 0; k < 6; k++) {
      const a = hexAngles[k];
      const cos = Math.cos(a), sin = Math.sin(a);
      pos[31 + k] = [dangleX + cR * cos, cR * sin];
      pos[13 + k] = [dangleX + nR * cos, nR * sin];
    }

    return pos;
  }

  // 超大分子布局算法无法处理，回退PCA使用SDF原始坐标
  const heavyCount = model.atoms.filter(a => a.element !== 'H').length;
  if (heavyCount > 20) return null;

  const meta = ALL_MOLECULES.find(m => m.id === moleculeId);
  const adj = buildAdj(model);
  const isH = model.atoms.map(a => a.element === 'H');
  const heavyAdj = adj.map((nb, i) => isH[i] ? [] : nb.filter(j => !isH[j]));

  // 1. 检测环（苯/甲苯/萘/苯胺等）
  const ringSet = findRingAtoms(heavyAdj, n, isH);
  if (ringSet.size > 0) {
    // 笼状分子（如P₄O₁₀, ringSet≥8）：拓扑布局无法表达3D笼状结构，回退PCA
    if (ringSet.size >= 8) return null;
    return doRingLayout(model, adj, heavyAdj, isH, ringSet, forElectronFormula);
  }

  // 2. 检测星形拓扑（所有原子直接连接中心）
  const ci = findCentral(model, adj, isH, meta);
  if (isStar(adj, ci, n)) {
    return doStarLayout(model, adj, ci, meta);
  }

  // 3. 链式拓扑（有机链/分支分子）
  return doChainLayout(model, adj, heavyAdj, isH, forElectronFormula);
}

// ═══════════════════════════════
//  工具函数
// ═══════════════════════════════

function buildAdj(model: MoleculeModel): number[][] {
  const a: number[][] = Array.from({ length: model.atoms.length }, () => []);
  for (const b of model.bonds) {
    a[b.from].push(b.to);
    a[b.to].push(b.from);
  }
  return a;
}

function findCentral(
  model: MoleculeModel, adj: number[][], isH: boolean[],
  meta?: MoleculeMetadata,
): number {
  if (meta?.central_atom) {
    const i = model.atoms.findIndex(a => a.element === meta!.central_atom);
    if (i >= 0) return i;
  }
  let best = 0, bestDeg = -1;
  for (let i = 0; i < model.atoms.length; i++) {
    if (isH[i]) continue;
    if (adj[i].length > bestDeg) { bestDeg = adj[i].length; best = i; }
  }
  return best;
}

/** 星形拓扑检测：所有原子直接或间接(第二壳层)连接中心
 *  允许 H₃PO₄ 类分子：中心P → 配体O → 末端H
 */
function isStar(adj: number[][], ci: number, n: number): boolean {
  const directLigs = new Set(adj[ci]);
  for (let i = 0; i < n; i++) {
    if (i === ci) continue;
    if (directLigs.has(i)) continue; // 直接配体
    // 第二壳层：是否连接到某个直接配体
    const isSecondShell = adj[i].some(j => directLigs.has(j));
    if (!isSecondShell) return false;
  }
  return true;
}

// ═══════════════════════════════
//  星形布局 — 无机 / 小分子
// ═══════════════════════════════

function doStarLayout(
  model: MoleculeModel, adj: number[][], ci: number,
  meta?: MoleculeMetadata,
): [number, number][] {
  const n = model.atoms.length;
  const pos: [number, number][] = new Array(n);
  pos[ci] = [0, 0];

  const ligs = adj[ci];
  const nl = ligs.length;
  const vsepr = meta?.vsepr || '';
  const geom = meta?.geometry || '';
  const ba = meta?.bond_angles
    ? (Object.values(meta.bond_angles)[0] as number)
    : null;

  let angles: number[];

  // sp³ 杂化分子：电子式使用上下左右正交方向（教科书标准画法）
  // 按 右→下→左 分配键，上方留给孤电子对
  const isSp3 = meta?.hybridization === 'sp³';

  if (nl === 1) {
    angles = [0];
  } else if (nl === 2) {
    const isBent = vsepr.includes('E') || geom.includes('V') || (ba !== null && ba < 170);
    if (isBent && isSp3) {
      // sp³ V形（如 H₂O）：左右水平，孤对占上下
      angles = [0, Math.PI];
    } else if (isBent) {
      const half = ((ba || 104.5) * DEG) / 2;
      // 非sp³ V形（如 SO₂）：保持V形展示
      angles = [-Math.PI / 2 + half, -Math.PI / 2 - half];
    } else {
      // 直线形
      angles = [0, Math.PI];
    }
  } else if (nl === 3) {
    if (isSp3) {
      // sp³ 三角锥（如 NH₃）：右、下、左，孤对占上
      angles = [0, Math.PI / 2, Math.PI];
    } else {
      // 平面三角 → Y形：一个在上，两个在下
      angles = [Math.PI / 2, Math.PI / 2 + 2 * Math.PI / 3, Math.PI / 2 - 2 * Math.PI / 3];
    }
  } else if (nl === 4) {
    // 四面体/平面正方 → 十字形
    angles = [Math.PI / 2, 0, -Math.PI / 2, Math.PI];
  } else if (nl === 5) {
    // 三角双锥/四方锥 → 五角形
    angles = Array.from({ length: 5 }, (_, i) => Math.PI / 2 - i * 2 * Math.PI / 5);
  } else {
    // 八面体等 → 均匀分布
    angles = Array.from({ length: nl }, (_, i) => Math.PI / 2 - i * 2 * Math.PI / nl);
  }

  for (let i = 0; i < nl; i++) {
    pos[ligs[i]] = [Math.cos(angles[i]) * L, Math.sin(angles[i]) * L];
  }

  // 放置第二壳层原子（如 H₃PO₄ 中 O 上的 H）
  const placed = new Set<number>([ci, ...ligs]);
  const isH = model.atoms.map(a => a.element === 'H');
  spreadOutward(model, adj, pos, placed, isH, new Set(), true);

  return pos;
}

// ═══════════════════════════════
//  环形检测与布局
// ═══════════════════════════════

function findRingAtoms(heavyAdj: number[][], n: number, isH: boolean[]): Set<number> {
  const ring = new Set<number>();
  for (let u = 0; u < n; u++) {
    if (isH[u] || heavyAdj[u].length < 2) continue;
    for (let i = 0; i < heavyAdj[u].length; i++) {
      for (let j = i + 1; j < heavyAdj[u].length; j++) {
        if (bfsReachable(heavyAdj, heavyAdj[u][i], heavyAdj[u][j], u, n)) {
          ring.add(u);
          ring.add(heavyAdj[u][i]);
          ring.add(heavyAdj[u][j]);
        }
      }
    }
  }
  return ring;
}

/** BFS检测: 从s到t是否可达（排除ex节点） */
function bfsReachable(adj: number[][], s: number, t: number, ex: number, n: number): boolean {
  if (s === t) return true;
  const vis = new Array(n).fill(false);
  vis[ex] = true;
  vis[s] = true;
  const q = [s];
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj[u]) {
      if (v === t) return true;
      if (!vis[v]) { vis[v] = true; q.push(v); }
    }
  }
  return false;
}

function doRingLayout(
  model: MoleculeModel, adj: number[][], heavyAdj: number[][],
  isH: boolean[], ringSet: Set<number>, forElectronFormula: boolean,
): [number, number][] {
  const n = model.atoms.length;
  const pos: [number, number][] = new Array(n);
  const placed = new Set<number>();

  // 检测融合环（萘等）：共享原子在环子图中度数=3
  const shared = [...ringSet].filter(i =>
    heavyAdj[i].filter(j => ringSet.has(j)).length === 3
  );

  if (shared.length === 2 && heavyAdj[shared[0]].includes(shared[1])) {
    // 融合双环
    layoutFusedHex(pos, placed, heavyAdj, ringSet, shared);
  } else {
    // 单环
    const ring = orderRingAtoms(heavyAdj, ringSet);
    if (ring.length >= 3) {
      const R = L / (2 * Math.sin(Math.PI / ring.length));
      for (let i = 0; i < ring.length; i++) {
        const a = Math.PI / 2 - i * 2 * Math.PI / ring.length;
        pos[ring[i]] = [Math.cos(a) * R, Math.sin(a) * R];
        placed.add(ring[i]);
      }
    }
  }

  // 放置环外原子（取代基+H）
  spreadOutward(model, adj, pos, placed, isH, ringSet, forElectronFormula);
  return pos;
}

/** 沿环遍历得到有序环原子列表 */
function orderRingAtoms(heavyAdj: number[][], ringSet: Set<number>): number[] {
  const start = [...ringSet][0];
  if (start === undefined) return [];
  const order = [start];
  const vis = new Set([start]);
  let cur = start;
  while (true) {
    const next = heavyAdj[cur].find(j => ringSet.has(j) && !vis.has(j));
    if (next === undefined) break;
    order.push(next);
    vis.add(next);
    cur = next;
  }
  return order;
}

/** 融合双六元环布局（萘） */
function layoutFusedHex(
  pos: [number, number][], placed: Set<number>,
  heavyAdj: number[][], ringSet: Set<number>,
  shared: number[],
) {
  const [s0, s1] = shared;
  const s = S3 * L;

  // 从s0出发，找两条到s1的路径（分别经过左环和右环）
  const s0Neighbors = heavyAdj[s0].filter(j => ringSet.has(j) && j !== s1);
  if (s0Neighbors.length < 2) return;

  const path1 = walkRingPath(heavyAdj, s0Neighbors[0], s1, s0, ringSet);
  const path2 = walkRingPath(heavyAdj, s0Neighbors[1], s1, s0, ringSet);

  // 选较短路径为左环（确保每环4个中间原子 → 共6原子）
  const [leftPath, rightPath] = path1.length <= path2.length
    ? [path1, path2] : [path2, path1];

  // 左六元环顶点位置（从s0开始逆时针）
  const leftPositions: [number, number][] = [
    [s, L / 2],       // s0
    [0, L],            // 顶
    [-s, L / 2],       // 左上
    [-s, -L / 2],      // 左下
    [0, -L],           // 底
    [s, -L / 2],       // s1
  ];

  // 右六元环顶点位置（从s0开始顺时针）
  const rightPositions: [number, number][] = [
    [s, L / 2],        // s0 (共享)
    [2 * s, L],        // 顶
    [3 * s, L / 2],    // 右上
    [3 * s, -L / 2],   // 右下
    [2 * s, -L],       // 底
    [s, -L / 2],       // s1 (共享)
  ];

  // 分配左环：s0, path1[0..], s1
  const leftRing = [s0, ...leftPath, s1];
  for (let i = 0; i < leftRing.length && i < leftPositions.length; i++) {
    if (!placed.has(leftRing[i])) {
      pos[leftRing[i]] = leftPositions[i];
      placed.add(leftRing[i]);
    }
  }

  // 分配右环：s0, path2[0..], s1
  const rightRing = [s0, ...rightPath, s1];
  for (let i = 0; i < rightRing.length && i < rightPositions.length; i++) {
    if (!placed.has(rightRing[i])) {
      pos[rightRing[i]] = rightPositions[i];
      placed.add(rightRing[i]);
    }
  }
}

/** 沿环从start走到end（排除exclude），返回中间原子 */
function walkRingPath(
  heavyAdj: number[][], start: number, end: number,
  exclude: number, ringSet: Set<number>,
): number[] {
  const path = [start];
  const vis = new Set([exclude, start]);
  let cur = start;
  while (cur !== end) {
    const next = heavyAdj[cur].find(j => ringSet.has(j) && !vis.has(j));
    if (next === undefined) break;
    if (next === end) break;
    path.push(next);
    vis.add(next);
    cur = next;
  }
  return path;
}

// ═══════════════════════════════
//  杂化判定
// ═══════════════════════════════

/** 根据σ键数+键级判定原子杂化方式（仅用于布局角度）
 *  4+个σ键 → sp³（如 P in H₃PO₄, Cl in HClO₄）
 *  3个σ键+π键 → sp²（如 C=C-C）
 *  2个σ键+2π键 → sp（如 C≡C, O=C=O）
 */
function getAtomHybridization(atomIndex: number, model: MoleculeModel): 'sp' | 'sp2' | 'sp3' {
  let maxOrder = 0;
  let doubleBondCount = 0;
  let hasDelocalized = false;
  let sigmaCount = 0;
  for (const bond of model.bonds) {
    if (bond.from === atomIndex || bond.to === atomIndex) {
      sigmaCount++;
      if (bond.order > maxOrder) maxOrder = bond.order;
      if (bond.order >= 2) doubleBondCount++;
      if (bond.type === 'delocalized') hasDelocalized = true;
    }
  }
  // 4+个σ键一定是 sp³ 布局（四面体），无论是否有双键
  if (sigmaCount >= 4) return 'sp3';
  if (maxOrder >= 3 || doubleBondCount >= 2) return 'sp';
  if (maxOrder >= 2 || hasDelocalized) return 'sp2';
  return 'sp3';
}

/** 角度归一化到 [-π, π) */
function normAngle(a: number): number {
  let r = a % (2 * Math.PI);
  if (r >= Math.PI) r -= 2 * Math.PI;
  if (r < -Math.PI) r += 2 * Math.PI;
  return r;
}

// ═══════════════════════════════
//  链式布局 — 有机分子
// ═══════════════════════════════

function doChainLayout(
  model: MoleculeModel, adj: number[][], heavyAdj: number[][],
  isH: boolean[], forElectronFormula: boolean,
): [number, number][] {
  const n = model.atoms.length;
  const pos: [number, number][] = new Array(n);
  const placed = new Set<number>();

  const heavyIdx = model.atoms.map((_, i) => i).filter(i => !isH[i]);
  if (heavyIdx.length === 0) {
    return model.atoms.map((_, i) => [i * L, 0] as [number, number]);
  }

  // 找最长重原子路径（树直径）作为主链
  const backbone = treeDiameter(heavyAdj, heavyIdx, n);

  // 基于杂化的主链布局：
  // 电子式：sp³/sp → 直线, sp² → ±60° 锯齿
  // 结构简式/键线式：sp³/sp² → ±60° 锯齿, sp → 直线
  let x = 0, y = 0;
  let currentAngle = 0;
  let turnDir = 1;
  for (let i = 0; i < backbone.length; i++) {
    pos[backbone[i]] = [x, y];
    placed.add(backbone[i]);
    if (i < backbone.length - 1) {
      x += Math.cos(currentAngle) * L;
      y += Math.sin(currentAngle) * L;
      // 下一个原子的杂化决定转弯角度（仅非末端原子需转弯）
      if (i + 1 < backbone.length - 1) {
        const hyb = getAtomHybridization(backbone[i + 1], model);
        const shouldZigzag = forElectronFormula
          ? (hyb === 'sp2')                     // 电子式：仅sp²锯齿
          : (hyb === 'sp2' || hyb === 'sp3');   // 结构/键线式：sp²和sp³均锯齿
        if (shouldZigzag) {
          currentAngle += turnDir * 60 * DEG;
          turnDir *= -1;
        }
        // sp: 不转弯，保持直线
      }
    }
  }

  // 扩散放置分支和H
  spreadOutward(model, adj, pos, placed, isH, new Set(), forElectronFormula);
  return pos;
}

/** 树直径算法：两次BFS找最长路径 */
function treeDiameter(heavyAdj: number[][], heavyIdx: number[], n: number): number[] {
  const start = heavyIdx[0];

  // BFS 1: 从任意点出发找最远点A
  const d1 = bfsDist(heavyAdj, start, n);
  let A = start, maxD = 0;
  for (const i of heavyIdx) {
    if (d1[i] > maxD) { maxD = d1[i]; A = i; }
  }

  // BFS 2: 从A出发找最远点B + 记录parent
  const { dist: d2, parent } = bfsParent(heavyAdj, A, n);
  let B = A;
  maxD = 0;
  for (const i of heavyIdx) {
    if (d2[i] > maxD) { maxD = d2[i]; B = i; }
  }

  // 重建路径 A→B
  const path: number[] = [];
  let c = B;
  while (c !== -1) { path.push(c); c = parent[c]; }
  return path.reverse();
}

function bfsDist(adj: number[][], s: number, n: number): number[] {
  const d = new Array(n).fill(-1);
  d[s] = 0;
  const q = [s];
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj[u]) {
      if (d[v] === -1) { d[v] = d[u] + 1; q.push(v); }
    }
  }
  return d;
}

function bfsParent(adj: number[][], s: number, n: number) {
  const dist = new Array(n).fill(-1);
  const parent = new Array(n).fill(-1);
  dist[s] = 0;
  const q = [s];
  while (q.length) {
    const u = q.shift()!;
    for (const v of adj[u]) {
      if (dist[v] === -1) { dist[v] = dist[u] + 1; parent[v] = u; q.push(v); }
    }
  }
  return { dist, parent };
}

// ═══════════════════════════════
//  通用扩散放置（分支 + H原子）
// ═══════════════════════════════

/** 从已放置原子向外扩散，放置所有未放置的邻居 */
function spreadOutward(
  model: MoleculeModel, adj: number[][], pos: [number, number][],
  placed: Set<number>, isH: boolean[], ringSet: Set<number>,
  forElectronFormula = true,
) {
  const n = model.atoms.length;
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n; i++) {
      if (!placed.has(i)) continue;
      const unplaced = adj[i].filter(j => !placed.has(j));
      if (unplaced.length === 0) continue;

      const used = getUsedAngles(adj[i], pos, placed, i);
      // 重原子优先放置
      const sorted = [...unplaced].sort((a, b) => (isH[a] ? 1 : 0) - (isH[b] ? 1 : 0));

      for (const j of sorted) {
        let angle: number;
        const dist = isH[j] ? L * 0.8 : L;

        if (ringSet.has(i) && !isH[j]) {
          // 环上取代基：从环中心向外辐射
          angle = Math.atan2(pos[i][1], pos[i][0]);
        } else if (ringSet.has(i)) {
          // 环上H原子：保持贪心（环形几何不强制十字形）
          angle = bestAngle(used);
        } else {
          // 非环原子：按杂化方向放置
          angle = hybridAngle(i, model, used, forElectronFormula);
        }

        pos[j] = [
          pos[i][0] + Math.cos(angle) * dist,
          pos[i][1] + Math.sin(angle) * dist,
        ];
        placed.add(j);
        used.push(angle);
        changed = true;
      }
    }
  }

  // 防御性：确保所有原子都有位置
  for (let i = 0; i < n; i++) {
    if (!placed.has(i)) {
      pos[i] = [0, 0];
      placed.add(i);
    }
  }
}

/** 获取某原子已使用的键方向角度 */
function getUsedAngles(
  neighbors: number[], pos: [number, number][],
  placed: Set<number>, from: number,
): number[] {
  const angles: number[] = [];
  for (const j of neighbors) {
    if (placed.has(j) && pos[j] && pos[from]) {
      angles.push(Math.atan2(pos[j][1] - pos[from][1], pos[j][0] - pos[from][0]));
    }
  }
  return angles;
}

/**
 * 按杂化方向选择最佳放置角度
 * sp³ → 十字形（0°/90°/180°/270°）
 * sp² → 120° 三角网格（基于已有键方向）
 * sp  → 180° 线性
 */
function hybridAngle(atomIndex: number, model: MoleculeModel, used: number[], forElectronFormula = true): number {
  const hyb = getAtomHybridization(atomIndex, model);

  let idealDirs: number[];
  if (hyb === 'sp3' && forElectronFormula) {
    // 电子式十字形：右/下/左/上
    idealDirs = [0, Math.PI / 2, Math.PI, -Math.PI / 2];
  } else if (hyb === 'sp3' || hyb === 'sp2') {
    // 120° 三角：基于第一条已有键的方向构建
    if (used.length > 0) {
      const base = used[0];
      idealDirs = [base, base + 2 * Math.PI / 3, base - 2 * Math.PI / 3];
    } else {
      idealDirs = [0, 2 * Math.PI / 3, -2 * Math.PI / 3];
    }
  } else {
    // sp 线性
    if (used.length > 0) {
      idealDirs = [used[0], used[0] + Math.PI];
    } else {
      idealDirs = [0, Math.PI];
    }
  }

  // 从理想方向中选最远离已用方向的
  let bestDir = idealDirs[0];
  let bestMinDist = -1;
  for (const d of idealDirs) {
    const nd = normAngle(d);
    let minDist = Math.PI;
    for (const u of used) {
      let diff = Math.abs(nd - normAngle(u));
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < minDist) minDist = diff;
    }
    if (minDist > bestMinDist) {
      bestMinDist = minDist;
      bestDir = nd;
    }
  }
  return bestDir;
}

/** 找到与已用角度距离最大的最佳角度（贪心，用于环上H等不需要杂化约束的场景） */
function bestAngle(used: number[]): number {
  if (used.length === 0) return 0;

  // 候选角度：每30°一个
  const cands = [0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(d => d * DEG);
  let best = 0, bestMin = -1;

  for (const c of cands) {
    let minDist = Math.PI;
    for (const u of used) {
      let d = Math.abs(c - u);
      if (d > Math.PI) d = 2 * Math.PI - d;
      if (d < minDist) minDist = d;
    }
    if (minDist > bestMin) { bestMin = minDist; best = c; }
  }

  return best;
}
