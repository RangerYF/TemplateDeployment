import { describe, it, expect } from 'vitest';
import { parseEquation } from '../parser';
import { balance } from '../balancer';

/**
 * 回归测试：保证快捷输入栏新增的常见物质能被 parser 正确解析
 * （原子组成 + 电荷），并能参与真实反应的配平。
 *
 * 注意：快捷输入栏与 COMMON_HIGH_SCHOOL_SPECIES 只是 UI / 提示层，
 * 配平正确性完全由 parser + balancer 保证。本测试锁定 parser 对这些
 * 化学式的解析结果，防止后续修改 parser 时回归——尤其是“下标 vs 电荷”
 * 的歧义处理（如 SiO32-、AlO2-、Cr2O72-、S2-）。
 */

// [插入字符串, 期望原子组成, 期望净电荷]
const SPECIES: Array<[string, Record<string, number>, number]> = [
  // 单质
  ['Cl2', { Cl: 2 }, 0], ['Br2', { Br: 2 }, 0], ['I2', { I: 2 }, 0], ['Ag', { Ag: 1 }, 0],
  // 氧化物
  ['Na2O', { Na: 2, O: 1 }, 0], ['Na2O2', { Na: 2, O: 2 }, 0], ['Fe3O4', { Fe: 3, O: 4 }, 0],
  ['SiO2', { Si: 1, O: 2 }, 0], ['H2O2', { H: 2, O: 2 }, 0], ['P2O5', { P: 2, O: 5 }, 0],
  ['MnO2', { Mn: 1, O: 2 }, 0], ['N2O4', { N: 2, O: 4 }, 0],
  // 酸
  ['H2CO3', { H: 2, C: 1, O: 3 }, 0], ['H3PO4', { H: 3, P: 1, O: 4 }, 0],
  ['H2SiO3', { H: 2, Si: 1, O: 3 }, 0], ['HClO', { H: 1, Cl: 1, O: 1 }, 0],
  ['HF', { H: 1, F: 1 }, 0],
  // 碱
  ['Ba(OH)2', { Ba: 1, O: 2, H: 2 }, 0], ['Mg(OH)2', { Mg: 1, O: 2, H: 2 }, 0],
  ['Fe(OH)3', { Fe: 1, O: 3, H: 3 }, 0], ['Fe(OH)2', { Fe: 1, O: 2, H: 2 }, 0],
  ['NH3·H2O', { N: 1, H: 5, O: 1 }, 0],
  // 盐
  ['BaSO4', { Ba: 1, S: 1, O: 4 }, 0], ['CuSO4', { Cu: 1, S: 1, O: 4 }, 0],
  ['FeCl3', { Fe: 1, Cl: 3 }, 0], ['FeCl2', { Fe: 1, Cl: 2 }, 0],
  ['KClO3', { K: 1, Cl: 1, O: 3 }, 0], ['NH4Cl', { N: 1, H: 4, Cl: 1 }, 0],
  ['NH4NO3', { N: 2, H: 4, O: 3 }, 0], ['Na2SiO3', { Na: 2, Si: 1, O: 3 }, 0],
  ['K2Cr2O7', { K: 2, Cr: 2, O: 7 }, 0], ['Al2(SO4)3', { Al: 2, S: 3, O: 12 }, 0],
  // 离子（下标 vs 电荷歧义重点覆盖）
  ['Ba2+', { Ba: 1 }, 2], ['Ag+', { Ag: 1 }, 1], ['Zn2+', { Zn: 1 }, 2],
  ['S2-', { S: 1 }, -2], ['SO32-', { S: 1, O: 3 }, -2], ['SiO32-', { Si: 1, O: 3 }, -2],
  ['AlO2-', { Al: 1, O: 2 }, -1], ['ClO-', { Cl: 1, O: 1 }, -1],
  ['Cr2O72-', { Cr: 2, O: 7 }, -2], ['Br-', { Br: 1 }, -1], ['I-', { I: 1 }, -1],
  // 有机物
  ['HCHO', { H: 2, C: 1, O: 1 }, 0], ['HCOOH', { H: 2, C: 1, O: 2 }, 0],
  ['C6H5OH', { C: 6, H: 6, O: 1 }, 0],
];

describe('快捷输入物质解析', () => {
  it.each(SPECIES)('解析 %s 的原子与电荷正确', (formula, atoms, charge) => {
    const r = parseEquation(`${formula} = ${formula}`);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const mol = r.equation.reactants[0];
    expect(mol.atoms).toEqual(atoms);
    expect(mol.charge).toBe(charge);
  });
});

describe('新增物质参与真实反应配平', () => {
  const REACTIONS: Array<[string, number[]]> = [
    ['Fe2O3 + CO = Fe + CO2', [1, 3, 2, 3]],
    ['KClO3 = KCl + O2', [2, 2, 3]],
    ['Cl2 + NaOH = NaCl + NaClO + H2O', [1, 2, 1, 1, 1]],
    ['Na2O2 + CO2 = Na2CO3 + O2', [2, 2, 2, 1]],
    ['Cu + HNO3 = Cu(NO3)2 + NO + H2O', [3, 8, 3, 2, 4]],
    ['BaCl2 + Na2SO4 = BaSO4 + NaCl', [1, 1, 1, 2]],
    ['Cr2O72- + Fe2+ + H+ = Cr3+ + Fe3+ + H2O', [1, 6, 14, 2, 6, 7]],
  ];
  it.each(REACTIONS)('%s 配平正确', (eq, expected) => {
    const p = parseEquation(eq);
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    const b = balance(p.equation);
    expect(b.ok).toBe(true);
    if (!b.ok) return;
    expect(b.coefficients).toEqual(expected);
  });
});
