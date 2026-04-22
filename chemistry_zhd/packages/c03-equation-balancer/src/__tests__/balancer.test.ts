import { describe, it, expect } from 'vitest';
import { parseEquation } from '../parser';
import { balance } from '../balancer';

function coeffsFor(eq: string): number[] {
  const p = parseEquation(eq);
  if (!p.ok) throw new Error(`解析失败: ${p.error.message}`);
  const r = balance(p.equation);
  if (!r.ok) throw new Error(`配平失败: ${r.message}`);
  return r.coefficients;
}

describe('balance', () => {
  it('H2 + O2 = H2O → [2, 1, 2]', () => {
    expect(coeffsFor('H2 + O2 = H2O')).toEqual([2, 1, 2]);
  });

  it('Fe + O2 = Fe2O3 → [4, 3, 2]', () => {
    expect(coeffsFor('Fe + O2 = Fe2O3')).toEqual([4, 3, 2]);
  });

  it('Ca(OH)2 + HCl = CaCl2 + H2O → [1, 2, 1, 2]', () => {
    expect(coeffsFor('Ca(OH)2 + HCl = CaCl2 + H2O')).toEqual([1, 2, 1, 2]);
  });

  it('Na2O2 + H2O = NaOH + O2 → [2, 2, 4, 1]', () => {
    expect(coeffsFor('Na2O2 + H2O = NaOH + O2')).toEqual([2, 2, 4, 1]);
  });

  it('C + H2 = CH4 → [1, 2, 1]', () => {
    expect(coeffsFor('C + H2 = CH4')).toEqual([1, 2, 1]);
  });

  it('已配平方程式 2H2 + O2 = 2H2O 返回最小整数解 [2, 1, 2]', () => {
    // 输入系数被忽略，配平器总是返回最小解
    expect(coeffsFor('H2 + O2 = H2O')).toEqual([2, 1, 2]);
  });

  // ── 离子方程式 ──────────────────────────────────────────────────
  it('离子：H+ + OH- = H2O → [1, 1, 1]', () => {
    expect(coeffsFor('H+ + OH- = H2O')).toEqual([1, 1, 1]);
  });

  it('离子：Ca2+ + CO32- = CaCO3 → [1, 1, 1]', () => {
    expect(coeffsFor('Ca2+ + CO32- = CaCO3')).toEqual([1, 1, 1]);
  });

  it('离子：Fe2+ + 2OH- = Fe(OH)2 → [1, 2, 1]', () => {
    expect(coeffsFor('Fe2+ + OH- = Fe(OH)2')).toEqual([1, 2, 1]);
  });

  it('离子半反应：Fe3+ + e- = Fe2+ → [1, 1, 1]', () => {
    expect(coeffsFor('Fe3+ + e- = Fe2+')).toEqual([1, 1, 1]);
  });

  it('离子：MnO4- + Fe2+ + H+ = Mn2+ + Fe3+ + H2O → [1, 5, 8, 1, 5, 4]', () => {
    expect(coeffsFor('MnO4- + Fe2+ + H+ = Mn2+ + Fe3+ + H2O')).toEqual([1, 5, 8, 1, 5, 4]);
  });
});
