import { describe, it, expect } from 'vitest';
import { formatEquation, formatFormulaForDisplay } from '../formatting';
import { parseEquation } from '../parser';

describe('formatting', () => {
  it('用 sub/sup 渲染 MnO42-', () => {
    expect(formatFormulaForDisplay('MnO42-')).toBe(
      '<span class="formula-token">MnO<sub>4</sub><sup>2−</sup></span>'
    );
  });

  it('用 sub/sup 渲染 MnO4-', () => {
    expect(formatFormulaForDisplay('MnO4-')).toBe(
      '<span class="formula-token">MnO<sub>4</sub><sup>−</sup></span>'
    );
  });

  it('用 sub/sup 渲染 H2O2', () => {
    expect(formatFormulaForDisplay('H2O2')).toBe(
      '<span class="formula-token">H<sub>2</sub>O<sub>2</sub></span>'
    );
  });

  it('方程式默认隐藏系数 1', () => {
    const parsed = parseEquation('MnO42- + H+ = MnO4- + MnO2 + H2O');
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const html = formatEquation(parsed.equation, [3, 4, 2, 1, 2]);
    expect(html).toContain('<span class="coeff">3</span>');
    expect(html).toContain('<span class="coeff">4</span>');
    expect(html).not.toContain('<span class="coeff">1</span><span class="formula-token">MnO<sub>2</sub>');
  });
});
