export interface Molecule {
  /** 前置系数（用户输入的；待配平时视为 1） */
  coeff: number;
  /** 原始化学式字符串（不含前置系数），包含电荷后缀，例如 "Fe2+" / "OH-" / "H2O" */
  rawFormula: string;
  /** 分子中各元素的原子数，例如 { H: 2, O: 1 } */
  atoms: Record<string, number>;
  /** 净电荷：+2 / -1 / 0 等；中性分子为 0 */
  charge: number;
}

export interface ParsedEquation {
  reactants: Molecule[];
  products: Molecule[];
  /** 由 parser 根据电荷自动判断 */
  equationType: 'molecular' | 'ionic';
}

export interface ParseError {
  kind: 'syntax' | 'unknown_element';
  message: string;
}

export type ParseResult = { ok: true; equation: ParsedEquation } | { ok: false; error: ParseError };
