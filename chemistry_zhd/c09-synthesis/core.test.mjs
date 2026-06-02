import { describe, it, expect } from 'vitest';
import { renderSkeleton, MOLECULES, getMolecule, ROUTES, validateSynthesisData } from './core.mjs';

describe('renderSkeleton chain', () => {
  it('丁烷 4 碳链：3 段主键、返回 <svg>', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 4 });
    expect(svg.startsWith('<svg')).toBe(true);
    expect((svg.match(/<line/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('renderSkeleton 双键', () => {
  it('2-丁烯：a=2,b=3 双键 → 该段渲染两条平行线', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 4, bonds: [{ a: 2, b: 3, order: 2 }] });
    expect((svg.match(/<line/g) || []).length).toBeGreaterThanOrEqual(4);
  });
});

describe('renderSkeleton 取代基', () => {
  it('2-溴丁烷：Br 标注为红色', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 4, subs: [{ at: 2, label: 'Br', dir: 'up' }] });
    expect(svg).toContain('Br');
    expect(svg).toContain('#B91C1C');
  });
  it('乙酸：C2 同时有 =O 与 OH（羧基）', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 2, subs: [{ at: 2, dir: 'up', dbl: 'O' }, { at: 2, dir: 'down', label: 'OH' }] });
    expect(svg).toContain('O');
    expect((svg.match(/<line/g) || []).length).toBeGreaterThanOrEqual(3);
  });
});

describe('renderSkeleton 环', () => {
  it('环己烷：6 条环边', () => {
    const svg = renderSkeleton({ type: 'ring', size: 6 });
    expect((svg.match(/<line/g) || []).length).toBe(6);
  });
  it('苯（aromatic）：含内圈 circle', () => {
    const svg = renderSkeleton({ type: 'ring', size: 6, aromatic: true });
    expect(svg).toContain('<circle');
  });
  it('环己烯：含 1 条环内双键（>6 条线）', () => {
    const svg = renderSkeleton({ type: 'ring', size: 6, bonds: [{ a: 1, b: 2, order: 2 }] });
    expect((svg.match(/<line/g) || []).length).toBeGreaterThan(6);
  });
});

describe('renderSkeleton 单碳回退', () => {
  it('甲烷 atoms:1 → 文本回退含 text', () => {
    const svg = renderSkeleton({ type: 'chain', atoms: 1, _fallback: 'CH₄' });
    expect(svg).toContain('<text');
    expect(svg).toContain('CH');
  });
});

describe('MOLECULES', () => {
  it('含 23 个分子且每个能渲染无错', () => {
    const ids = Object.keys(MOLECULES);
    expect(ids.length).toBe(23);
    for (const id of ids) {
      const m = MOLECULES[id];
      expect(m.name && m.condensed && m.formula && m.category).toBeTruthy();
      const svg = renderSkeleton(Object.assign({}, m.skeleton, { _fallback: m.condensed }));
      expect(svg.startsWith('<svg')).toBe(true);
    }
  });
  it('getMolecule 未知 id 返回 null', () => {
    expect(getMolecule('nope')).toBeNull();
  });
});

describe('ROUTES 数据完整性', () => {
  it('校验全部通过：分子引用存在、步骤连续', () => {
    expect(validateSynthesisData()).toEqual([]);
  });
  it('至少 12 条路线', () => {
    expect(Object.keys(ROUTES).length).toBeGreaterThanOrEqual(12);
  });
});
