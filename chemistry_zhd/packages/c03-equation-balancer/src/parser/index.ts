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

/** 统一常见括号、全角符号与水合点写法 */
function normalizeFormulaText(s: string): string {
  return normalizeSubscripts(s)
    .replace(/[［【\[{（]/g, '(')
    .replace(/[］】\]}）]/g, ')')
    .replace(/[＋]/g, '+')
    .replace(/[＝]/g, '=')
    .replace(/[•]/g, '·');
}

function readNumber(text: string, startIndex: number): { value: number | null; nextIndex: number } {
  let index = startIndex;
  while (index < text.length && /\d/.test(text[index])) index += 1;
  if (index === startIndex) return { value: null, nextIndex: startIndex };
  return {
    value: parseInt(text.slice(startIndex, index), 10),
    nextIndex: index,
  };
}

function mergeAtoms(target: Record<string, number>, source: Record<string, number>, multiplier = 1): void {
  for (const [symbol, count] of Object.entries(source)) {
    target[symbol] = (target[symbol] ?? 0) + count * multiplier;
  }
}

function parseGroup(
  text: string,
  startIndex = 0,
  stopChar?: ')',
): { ok: true; atoms: Record<string, number>; nextIndex: number } | { ok: false; message: string } {
  const atoms: Record<string, number> = {};
  let index = startIndex;

  while (index < text.length) {
    const char = text[index];

    if (stopChar && char === stopChar) {
      return { ok: true, atoms, nextIndex: index + 1 };
    }

    if (char === '(') {
      const inner = parseGroup(text, index + 1, ')');
      if (!inner.ok) return inner;
      const multiplier = readNumber(text, inner.nextIndex);
      mergeAtoms(atoms, inner.atoms, multiplier.value ?? 1);
      index = multiplier.nextIndex;
      continue;
    }

    if (char === ')') {
      return { ok: false, message: '括号不匹配，请检查右括号位置' };
    }

    if (/[A-Z]/.test(char)) {
      let symbol = char;
      if (index + 1 < text.length && /[a-z]/.test(text[index + 1])) {
        symbol += text[index + 1];
        index += 1;
      }
      if (!KNOWN_ELEMENTS.has(symbol)) {
        return { ok: false, message: `未知元素符号: ${symbol}` };
      }
      const count = readNumber(text, index + 1);
      atoms[symbol] = (atoms[symbol] ?? 0) + (count.value ?? 1);
      index = count.nextIndex;
      continue;
    }

    if (/\d/.test(char)) {
      return { ok: false, message: `数字位置不合法: "${text.slice(index)}"` };
    }

    return { ok: false, message: `无法识别字符: "${char}"` };
  }

  if (stopChar) {
    return { ok: false, message: '括号不匹配，请补全右括号' };
  }
  return { ok: true, atoms, nextIndex: index };
}

function parseFormulaAtoms(formula: string): { ok: true; atoms: Record<string, number> } | { ok: false; message: string } {
  const atoms: Record<string, number> = {};
  const parts = formula.split(/[·.]/).map((part) => part.trim()).filter(Boolean);
  if (!parts.length) return { ok: false, message: `无法解析分子式: "${formula}"` };

  for (const part of parts) {
    const leading = /^(\d+)/.exec(part);
    const segmentMultiplier = leading ? parseInt(leading[1], 10) : 1;
    const segment = leading ? part.slice(leading[1].length) : part;
    if (!segment) {
      return { ok: false, message: `无效的水合物片段: "${part}"` };
    }
    const parsed = parseGroup(segment);
    if (!parsed.ok) return parsed;
    if (parsed.nextIndex !== segment.length) {
      return { ok: false, message: `无法完整解析分子式: "${segment}"` };
    }
    mergeAtoms(atoms, parsed.atoms, segmentMultiplier);
  }

  if (Object.keys(atoms).length === 0) {
    return { ok: false, message: `无法解析分子式: "${formula}"` };
  }
  return { ok: true, atoms };
}

function shouldUseTrailingDigitAsCharge(formulaNoState: string, digitPart: string): boolean {
  if (/\d\d[+-]$/.test(formulaNoState)) return true;
  const upperCount = (formulaNoState.match(/[A-Z]/g) ?? []).length;
  if (upperCount <= 1) return true;
  const body = formulaNoState.slice(0, -digitPart.length - 1);
  return body.startsWith('(') && body.endsWith(')');
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
      if (shouldUseTrailingDigitAsCharge(formulaNoState, digitPart)) {
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
  const parsedAtoms = parseFormulaAtoms(formulaForAtoms);
  if (!parsedAtoms.ok) return parsedAtoms;

  return { ok: true, mol: { coeff, rawFormula, atoms: parsedAtoms.atoms, charge } };
}

export function parseEquation(input: string): ParseResult {
  // 规范化 Unicode 下标
  const normalized = normalizeFormulaText(input.trim());

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
