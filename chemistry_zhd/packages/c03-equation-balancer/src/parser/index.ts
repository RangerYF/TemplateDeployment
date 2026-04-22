import type { ParseResult, ParsedEquation, Molecule, ParseError } from './types';

// 已知元素符号（Z=1~118）
const KNOWN_ELEMENTS = new Set([
  'H','He','Li','Be','B','C','N','O','F','Ne',
  'Na','Mg','Al','Si','P','S','Cl','Ar',
  'K','Ca','Sc','Ti','V','Cr','Mn','Fe','Co','Ni','Cu','Zn',
  'Ga','Ge','As','Se','Br','Kr',
  'Rb','Sr','Y','Zr','Nb','Mo','Tc','Ru','Rh','Pd','Ag','Cd',
  'In','Sn','Sb','Te','I','Xe',
  'Cs','Ba',
  'La','Ce','Pr','Nd','Pm','Sm','Eu','Gd','Tb','Dy','Ho','Er','Tm','Yb','Lu',
  'Hf','Ta','W','Re','Os','Ir','Pt','Au','Hg','Tl','Pb','Bi','Po','At','Rn',
  'Fr','Ra',
  'Ac','Th','Pa','U','Np','Pu','Am','Cm','Bk','Cf','Es','Fm','Md','No','Lr',
  'Rf','Db','Sg','Bh','Hs','Mt','Ds','Rg','Cn','Nh','Fl','Mc','Lv','Ts','Og',
]);

/** Unicode 下标数字 → ASCII 数字 */
function normalizeSubscripts(s: string): string {
  return s.replace(/[₀₁₂₃₄₅₆₇₈₉]/g, (c) => String(c.codePointAt(0)! - 0x2080));
}

/** 解析括号展开后的分子片段，返回错误信息或 null（成功） */
function parseFragment(fragment: string, multiplier: number, atoms: Record<string, number>): string | null {
  const re = /([A-Z][a-z]?)|\(([^()]*)\)(\d*)|(\d+)/g;
  let match: RegExpExecArray | null;

  while ((match = re.exec(fragment)) !== null) {
    if (match[1]) {
      const sym = match[1];
      const numMatch = /^\d+/.exec(fragment.slice(re.lastIndex));
      const count = numMatch ? parseInt(numMatch[0], 10) : 1;
      if (numMatch) re.lastIndex += numMatch[0].length;
      if (!KNOWN_ELEMENTS.has(sym)) return `未知元素符号: ${sym}`;
      atoms[sym] = (atoms[sym] ?? 0) + count * multiplier;
    } else if (match[2] !== undefined) {
      const inner = match[2];
      const cnt = match[3] ? parseInt(match[3], 10) : 1;
      const err = parseFragment(inner, multiplier * cnt, atoms);
      if (err) return err;
    }
    // match[4]: 独立数字，忽略
  }
  return null;
}

/**
 * 解析单个分子字符串，例如 "2Ca(OH)2" / "Fe2+" / "SO42-"
 *
 * 电荷提取规则：末尾 [1-9]?[+-] 视为电荷后缀。
 *   Fe2+  → atoms={Fe:1}, charge=+2
 *   SO42- → atoms={S:1,O:4}, charge=-2
 *   OH-   → atoms={O:1,H:1}, charge=-1
 *   H2O   → atoms={H:2,O:1}, charge=0
 *
 * 特殊：e / e- 表示电子（0 个原子，charge=-1）
 */
function parseMolecule(raw: string): { ok: true; mol: Molecule } | { ok: false; message: string } {
  raw = raw.trim();
  if (!raw) return { ok: false, message: '空分子' };

  // 1. 提取前导整数系数
  const coeffMatch = /^(\d+)/.exec(raw);
  const coeff = coeffMatch ? parseInt(coeffMatch[1], 10) : 1;
  const rawFormula = coeffMatch ? raw.slice(coeffMatch[1].length) : raw;

  if (!rawFormula) return { ok: false, message: `系数后无分子式: "${raw}"` };

  // 2. 剥离末尾状态符号（如 (s)(g)(l)(aq)↑↓），避免干扰电荷提取
  //    rawFormula 保持原样用于显示；formulaNoState 用于电荷 / 原子解析
  const STATE_RE = /(\(s\)|\(g\)|\(l\)|\(aq\)|↑|↓)$/;
  const stateM = STATE_RE.exec(rawFormula);
  const formulaNoState = stateM
    ? rawFormula.slice(0, rawFormula.length - stateM[0].length)
    : rawFormula;

  // 3. 提取末尾电荷（如 2+ / + / 2- / -）
  //
  // 歧义处理：MnO4- 中的 4 是 O 的下标（charge=-1），而 Fe2+ 中的 2 是电荷值。
  // 规则：末尾 digit+sign 中的 digit 视为电荷值，当且仅当：
  //   (a) sign 前有两个连续数字（如 SO42-，42 结尾，2 是电荷）；或
  //   (b) 公式中只有一个大写字母（单元素，如 Fe2+、Ca2+）。
  // 否则（单个数字 + 多元素，如 MnO4-、NO3-），digit 是下标，charge = ±1。
  let charge = 0;
  let formulaForAtoms = formulaNoState;
  const chargeMatch = /([1-9]?)([+-])$/.exec(formulaNoState);
  if (chargeMatch) {
    const digitPart = chargeMatch[1];
    const signPart = chargeMatch[2];
    if (!digitPart) {
      // 无数字，仅符号 → charge = ±1
      charge = signPart === '+' ? 1 : -1;
      formulaForAtoms = formulaNoState.slice(0, formulaNoState.length - 1);
    } else {
      const hasDoubleDigit = /\d\d[+-]$/.test(formulaNoState);
      const upperCount = (formulaNoState.match(/[A-Z]/g) ?? []).length;
      if (hasDoubleDigit || upperCount <= 1) {
        // 末尾两数字 or 单元素 → digit 是电荷值
        const mag = parseInt(digitPart, 10);
        charge = signPart === '+' ? mag : -mag;
        formulaForAtoms = formulaNoState.slice(0, formulaNoState.length - chargeMatch[0].length);
      } else {
        // 单数字 + 多元素 → digit 是下标，charge = ±1，仅去掉符号
        charge = signPart === '+' ? 1 : -1;
        formulaForAtoms = formulaNoState.slice(0, formulaNoState.length - 1);
      }
    }
  }

  // 4. 特殊：电子 e / e-
  if (formulaForAtoms === 'e' || formulaForAtoms === 'E') {
    return { ok: true, mol: { coeff, rawFormula, atoms: {}, charge: charge || -1 } };
  }

  if (!formulaForAtoms) return { ok: false, message: `无法识别 "${rawFormula}"` };

  // 5. 解析原子
  const atoms: Record<string, number> = {};
  const err = parseFragment(formulaForAtoms, 1, atoms);
  if (err) return { ok: false, message: err };
  if (Object.keys(atoms).length === 0) {
    return { ok: false, message: `无法解析分子式: "${rawFormula}"` };
  }

  return { ok: true, mol: { coeff, rawFormula, atoms, charge } };
}

export function parseEquation(input: string): ParseResult {
  // 规范化 Unicode 下标
  const normalized = normalizeSubscripts(input.trim());

  // 分割左右两侧（支持 = / → / -> / ⇌）
  const arrowRe = /\s*(?:=|→|⇌|->)\s*/;
  const parts = normalized.split(arrowRe);
  if (parts.length !== 2) {
    return {
      ok: false,
      error: { kind: 'syntax', message: '方程式必须包含且只包含一个反应箭头（= 或 →）' },
    };
  }

  const [leftStr, rightStr] = parts;

  function parseSide(s: string): { ok: true; mols: Molecule[] } | { ok: false; message: string } {
    // 用 \+(?=\s*(?:[A-Z0-9(]|[eE](?:[+-]|$))) 区分"分隔符+"与"电荷+"：
    // 只在 + 后紧跟（可选空格后）大写字母、数字、( 或电子 e-/E- 时才视为分隔符，
    // 这样 Fe2+、OH-、H+ 中的 + 不会被截断，同时支持 Fe3+ + e- = Fe2+ 这类半反应。
    const tokens = s
      .split(/\+(?=\s*(?:[A-Z0-9(]|[eE](?:[+-]|$)))/)
      .map((t) => t.trim())
      .filter(Boolean);
    if (tokens.length === 0) return { ok: false, message: '方程式某侧为空' };
    const mols: Molecule[] = [];
    for (const t of tokens) {
      const r = parseMolecule(t);
      if (!r.ok) return { ok: false, message: r.message };
      mols.push(r.mol);
    }
    return { ok: true, mols };
  }

  const left = parseSide(leftStr);
  if (!left.ok) return { ok: false, error: { kind: 'syntax', message: left.message } };

  const right = parseSide(rightStr);
  if (!right.ok) return { ok: false, error: { kind: 'syntax', message: right.message } };

  const equationType: 'molecular' | 'ionic' =
    [...left.mols, ...right.mols].some((m) => m.charge !== 0) ? 'ionic' : 'molecular';

  return {
    ok: true,
    equation: { reactants: left.mols, products: right.mols, equationType },
  };
}
