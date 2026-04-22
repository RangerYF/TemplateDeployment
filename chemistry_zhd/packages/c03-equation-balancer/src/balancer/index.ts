import type { ParsedEquation } from '../parser/types';
import { Fraction, lcm } from './rational';

export type BalanceResult =
  | { ok: true; coefficients: number[]; note?: string }
  | { ok: false; kind: 'no_solution' | 'multiple_solutions'; message: string };

/**
 * 当存在多个自由变量时，尝试用穷举法找到一组全正整数解。
 * k=2 时遍历 [1,12]²，k=3 时遍历 [1,6]³，其他情形返回 null。
 */
function searchMultipleSolution(
  A: Fraction[][], pivotCols: number[], freeCols: number[], n: number, rank: number
): number[] | null {
  const k = freeCols.length;
  const limit = k === 2 ? 12 : 6;

  function tryVals(vals: number[]): number[] | null {
    const sol: Fraction[] = Array(n).fill(Fraction.ZERO);
    for (let j = 0; j < k; j++) sol[freeCols[j]] = new Fraction(vals[j]);
    for (let r = 0; r < rank; r++) {
      let s = Fraction.ZERO;
      for (let j = 0; j < k; j++) s = s.sub(A[r][freeCols[j]].mul(new Fraction(vals[j])));
      sol[pivotCols[r]] = s;
    }
    if (sol.some(f => !f.isPositive())) return null;
    let dLcm = 1;
    for (const f of sol) dLcm = lcm(dLcm, f.den);
    const intSol = sol.map(f => Math.round(f.num * dLcm / f.den));
    if (intSol.some(v => v <= 0)) return null;
    let g = intSol.reduce((acc, v) => { let a = Math.abs(acc), b = Math.abs(v); while (b) { [a,b]=[b,a%b]; } return a; });
    if (g === 0) g = 1;
    return intSol.map(v => v / g);
  }

  if (k === 2) {
    for (let t0 = 1; t0 <= limit; t0++)
      for (let t1 = 1; t1 <= limit; t1++) {
        const r = tryVals([t0, t1]); if (r) return r;
      }
  } else if (k === 3) {
    for (let t0 = 1; t0 <= limit; t0++)
      for (let t1 = 1; t1 <= limit; t1++)
        for (let t2 = 1; t2 <= limit; t2++) {
          const r = tryVals([t0, t1, t2]); if (r) return r;
        }
  }
  return null;
}

/**
 * 使用矩阵消元（Gauss-Jordan）对化学方程式进行配平。
 *
 * 矩阵行 = 元素守恒行（每元素一行）+ 可选的电荷守恒行（离子方程式）。
 * 列 = 各分子（反应物系数为正，产物系数为负）。
 * 求零空间基向量，化为最小正整数解。
 */
export function balance(eq: ParsedEquation): BalanceResult {
  const { reactants, products } = eq;
  const n = reactants.length + products.length;
  const allMols = [...reactants, ...products];

  // 收集所有元素
  const elemSet = new Set<string>();
  for (const mol of allMols) {
    for (const e of Object.keys(mol.atoms)) elemSet.add(e);
  }
  const elements = [...elemSet];
  const numElems = elements.length;

  // 是否需要电荷守恒行
  const hasCharge = allMols.some((mol) => mol.charge !== 0);
  const totalRows = numElems + (hasCharge ? 1 : 0);

  // 构建 totalRows × n 矩阵（有理数）
  const A: Fraction[][] = Array.from({ length: totalRows }, () =>
    Array.from({ length: n }, () => Fraction.ZERO)
  );

  for (let j = 0; j < n; j++) {
    const sign = j < reactants.length ? 1 : -1;
    // 原子守恒行
    for (let i = 0; i < numElems; i++) {
      const cnt = allMols[j].atoms[elements[i]] ?? 0;
      A[i][j] = new Fraction(sign * cnt);
    }
    // 电荷守恒行（最后一行）
    if (hasCharge) {
      A[numElems][j] = new Fraction(sign * allMols[j].charge);
    }
  }

  // Gauss-Jordan 消元
  const pivotCols: number[] = [];
  let row = 0;
  const pivotRows = A.length; // = totalRows

  for (let col = 0; col < n && row < pivotRows; col++) {
    // 找主元
    let pivotRow = -1;
    for (let r = row; r < pivotRows; r++) {
      if (!A[r][col].isZero()) { pivotRow = r; break; }
    }
    if (pivotRow === -1) continue;

    // 交换
    [A[row], A[pivotRow]] = [A[pivotRow], A[row]];

    // 归一化主元行
    const pivot = A[row][col];
    for (let c = 0; c < n; c++) A[row][c] = A[row][c].div(pivot);

    // 消去其他行
    for (let r = 0; r < pivotRows; r++) {
      if (r === row) continue;
      const factor = A[r][col];
      if (factor.isZero()) continue;
      for (let c = 0; c < n; c++) {
        A[r][c] = A[r][c].sub(factor.mul(A[row][c]));
      }
    }

    pivotCols.push(col);
    row++;
  }

  const rank = pivotCols.length;
  const freeCols: number[] = [];
  for (let c = 0; c < n; c++) {
    if (!pivotCols.includes(c)) freeCols.push(c);
  }

  // 零空间维度 = n - rank
  if (freeCols.length === 0) {
    // 仅零解：各元素/电荷无法同时守恒
    return {
      ok: false,
      kind: 'no_solution',
      message: '方程式无法配平（请检查左右两侧元素是否匹配）',
    };
  }
  if (freeCols.length > 1) {
    const found = searchMultipleSolution(A, pivotCols, freeCols, n, rank);
    if (found) {
      // 验证原子守恒
      for (let i = 0; i < numElems; i++) {
        let sum = 0;
        for (let j = 0; j < n; j++) {
          const sign = j < reactants.length ? 1 : -1;
          sum += sign * (allMols[j].atoms[elements[i]] ?? 0) * found[j];
        }
        if (sum !== 0) return { ok: false, kind: 'no_solution', message: '配平验证失败，方程式可能书写有误' };
      }
      if (hasCharge) {
        let chargeSum = 0;
        for (let j = 0; j < n; j++) {
          const sign = j < reactants.length ? 1 : -1;
          chargeSum += sign * allMols[j].charge * found[j];
        }
        if (chargeSum !== 0) return { ok: false, kind: 'no_solution', message: '配平后电荷不守恒，请检查离子化合价书写' };
      }
      return { ok: true, coefficients: found, note: '此方程式有多组配平解，以下为其中一组' };
    }
    return {
      ok: false,
      kind: 'multiple_solutions',
      message: '方程式存在多组配平解，可能将多个独立反应合并书写，请分开输入',
    };
  }

  // 唯一自由变量 → 取 1，回代
  const freeCol = freeCols[0];
  const solution: Fraction[] = new Array(n).fill(Fraction.ZERO);
  solution[freeCol] = Fraction.ONE;

  for (let r = 0; r < rank; r++) {
    const pc = pivotCols[r];
    solution[pc] = A[r][freeCol].neg().mul(solution[freeCol]);
  }

  // 验证所有系数为正
  if (solution.some((f) => !f.isPositive())) {
    const neg = solution.map((f) => f.neg());
    if (neg.some((f) => !f.isPositive())) {
      return {
        ok: false,
        kind: 'no_solution',
        message: '配平系数出现非正数，请检查反应方向或方程式书写',
      };
    }
    solution.splice(0, solution.length, ...neg);
  }

  // 化为最小正整数
  let denomLcm = 1;
  for (const f of solution) denomLcm = lcm(denomLcm, f.den);
  const intSolution = solution.map((f) => Math.round(f.num * denomLcm / f.den));

  let g = intSolution.reduce((acc, v) => {
    let a = Math.abs(acc), b = Math.abs(v);
    while (b) { [a, b] = [b, a % b]; }
    return a;
  });
  if (g === 0) g = 1;

  const coefficients = intSolution.map((v) => v / g);

  // 最终验证：原子守恒
  for (let i = 0; i < numElems; i++) {
    let sum = 0;
    for (let j = 0; j < n; j++) {
      const sign = j < reactants.length ? 1 : -1;
      sum += sign * (allMols[j].atoms[elements[i]] ?? 0) * coefficients[j];
    }
    if (sum !== 0) {
      return { ok: false, kind: 'no_solution', message: '配平验证失败，方程式可能书写有误' };
    }
  }

  // 最终验证：电荷守恒（离子方程式）
  if (hasCharge) {
    let chargeSum = 0;
    for (let j = 0; j < n; j++) {
      const sign = j < reactants.length ? 1 : -1;
      chargeSum += sign * allMols[j].charge * coefficients[j];
    }
    if (chargeSum !== 0) {
      return {
        ok: false,
        kind: 'no_solution',
        message: '配平后电荷不守恒，请检查离子化合价书写',
      };
    }
  }

  return { ok: true, coefficients };
}
