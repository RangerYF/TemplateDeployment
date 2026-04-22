import { describe, it, expect } from 'vitest';
import { parseEquation } from '../parser';

describe('parseEquation', () => {
  it('解析 H2 + O2 = H2O', () => {
    const r = parseEquation('H2 + O2 = H2O');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.reactants).toHaveLength(2);
    expect(r.equation.products).toHaveLength(1);
    expect(r.equation.reactants[0].atoms).toEqual({ H: 2 });
    expect(r.equation.reactants[1].atoms).toEqual({ O: 2 });
    expect(r.equation.products[0].atoms).toEqual({ H: 2, O: 1 });
  });

  it('解析括号 Ca(OH)2 + HCl = CaCl2 + H2O', () => {
    const r = parseEquation('Ca(OH)2 + HCl = CaCl2 + H2O');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const caoh2 = r.equation.reactants[0].atoms;
    expect(caoh2['Ca']).toBe(1);
    expect(caoh2['O']).toBe(2);
    expect(caoh2['H']).toBe(2);
  });

  it('解析 Unicode 下标 H₂ + O₂ = H₂O', () => {
    const r = parseEquation('H₂ + O₂ = H₂O');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.reactants[0].atoms).toEqual({ H: 2 });
  });

  it('支持箭头 → 分隔符', () => {
    const r = parseEquation('H2 + O2 → H2O');
    expect(r.ok).toBe(true);
  });

  it('支持箭头 -> 分隔符', () => {
    const r = parseEquation('H2 + O2 -> H2O');
    expect(r.ok).toBe(true);
  });

  it('未知元素返回错误', () => {
    const r = parseEquation('Xx + O2 = XxO');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error.kind).toBe('syntax');
    expect(r.error.message).toMatch(/未知元素/);
  });

  it('无箭头返回语法错误', () => {
    const r = parseEquation('H2 + O2');
    expect(r.ok).toBe(false);
  });

  it('支持箭头 ⇌ 分隔符', () => {
    const r = parseEquation('N2 + H2 ⇌ NH3');
    expect(r.ok).toBe(true);
  });

  it('解析 H+ 电荷为 +1', () => {
    const r = parseEquation('H+ + OH- = H2O');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.reactants[0].charge).toBe(1);
    expect(r.equation.reactants[0].atoms).toEqual({ H: 1 });
  });

  it('解析 OH- 电荷为 -1', () => {
    const r = parseEquation('H+ + OH- = H2O');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.reactants[1].charge).toBe(-1);
    expect(r.equation.reactants[1].atoms).toEqual({ O: 1, H: 1 });
  });

  it('解析 Fe2+ 电荷为 +2，原子数正确', () => {
    const r = parseEquation('Fe2+ + 2OH- = Fe(OH)2');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.reactants[0].charge).toBe(2);
    expect(r.equation.reactants[0].atoms).toEqual({ Fe: 1 });
  });

  it('解析 SO42- 电荷为 -2，原子数正确', () => {
    const r = parseEquation('Ba2+ + SO42- = BaSO4');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.reactants[1].charge).toBe(-2);
    expect(r.equation.reactants[1].atoms).toEqual({ S: 1, O: 4 });
  });

  it('支持未带前置系数的电子 e- 作为独立项', () => {
    const r = parseEquation('Fe3+ + e- = Fe2+');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.reactants).toHaveLength(2);
    expect(r.equation.reactants[0].atoms).toEqual({ Fe: 1 });
    expect(r.equation.reactants[0].charge).toBe(3);
    expect(r.equation.reactants[1].atoms).toEqual({});
    expect(r.equation.reactants[1].charge).toBe(-1);
  });

  it('含离子的方程式 equationType 为 ionic', () => {
    const r = parseEquation('H+ + OH- = H2O');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.equationType).toBe('ionic');
  });

  it('普通分子方程式 equationType 为 molecular', () => {
    const r = parseEquation('H2 + O2 = H2O');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.equation.equationType).toBe('molecular');
  });
});
