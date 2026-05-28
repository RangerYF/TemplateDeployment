import { create, all, type MathJsStatic } from 'mathjs';

const math = create(all) as MathJsStatic;

export interface VecConstraintContext {
  vectors: Record<string, { dx: number; dy: number }>;
  freeVecLabel: string;
  freeVecStart: { x: number; y: number };
}

export interface ParsedVecConstraint {
  fn: (x: number, y: number, ctx: VecConstraintContext) => number;
  label: string;
  referencedVecs: string[];
}

// ─── Step 1: Extract \vec{name} ───

const VEC_TAG_RE = /\\vec\{(\w+)\}/g;
const VEC_MARKER_L = '«';
const VEC_MARKER_R = '»';

function extractVecTags(expr: string): { processed: string; vecNames: Set<string> } {
  const vecNames = new Set<string>();
  VEC_TAG_RE.lastIndex = 0;
  const processed = expr.replace(VEC_TAG_RE, (_, name: string) => {
    vecNames.add(name);
    return `${VEC_MARKER_L}${name}${VEC_MARKER_R}`;
  });
  return { processed, vecNames };
}

// ─── Step 2: LaTeX → arithmetic ───

function latexToArith(expr: string): string {
  let s = expr;
  s = s.replace(/\\sqrt\{([^}]+)\}/g, 'sqrt($1)');
  s = s.replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '(($1)/($2))');
  s = s.replace(/\\pi/g, 'pi');
  s = s.replace(/\\,/g, '');

  // \cdot between two «name» markers → dot(name1,name2)
  const dotBetweenVecs = new RegExp(
    `${VEC_MARKER_L}(\\w+)${VEC_MARKER_R}\\s*\\\\cdot\\s*${VEC_MARKER_L}(\\w+)${VEC_MARKER_R}`,
    'g',
  );
  s = s.replace(dotBetweenVecs, 'dot($1,$2)');

  // remaining \cdot → *
  s = s.replace(/\\cdot/g, '*');

  // Unicode fallbacks
  s = s.replace(/√\(/g, 'sqrt(');
  s = s.replace(/√(\d+)/g, 'sqrt($1)');
  s = s.replace(/π/g, 'pi');
  s = s.replace(/²/g, '^2');
  s = s.replace(/·/g, '*');

  return s;
}

// ─── Step 3: implicit multiplication ───

function insertImplicitMul(expr: string): string {
  let s = expr;
  // number followed by «
  s = s.replace(/(\d)\s*«/g, '$1*«');
  // » followed by «
  s = s.replace(/»\s*«/g, '»*«');
  // ) followed by ( or «
  s = s.replace(/\)\s*\(/g, ')*(');
  s = s.replace(/\)\s*«/g, ')*«');
  // } followed by anything that is not an operator
  s = s.replace(/\}\s*\(/g, '}*(');
  // number followed by letter (but not inside function names)
  s = s.replace(/(\d)\s*(sqrt|pi|dot|mag|cross)/g, '$1*$2');
  return s;
}

// ─── Step 4: |expr| → mag(expr) ───

function convertAbsToMag(expr: string): string {
  let s = expr;
  let prev = '';
  while (prev !== s) {
    prev = s;
    s = s.replace(/\|([^|]+)\|/g, 'mag($1)');
  }
  return s;
}

// ─── Step 5: restore vec markers ───

function restoreVecMarkers(expr: string): string {
  return expr.replace(new RegExp(`${VEC_MARKER_L}(\\w+)${VEC_MARKER_R}`, 'g'), '$1');
}

// ─── Step 6: extract vector function calls ───

interface VecFuncCall {
  placeholder: string;
  funcName: string;
  args: string[];
}

const VEC_FUNC_NAMES = ['mag', 'dot', 'cross'] as const;

function splitTopLevelArgs(s: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === '(') depth++;
    else if (s[i] === ')') depth--;
    else if (s[i] === ',' && depth === 0) {
      args.push(s.slice(start, i));
      start = i + 1;
    }
  }
  args.push(s.slice(start));
  return args;
}

function extractVecFuncCalls(expr: string): { processed: string; calls: VecFuncCall[] } {
  const calls: VecFuncCall[] = [];
  let processed = expr;
  let counter = 0;

  for (const fname of VEC_FUNC_NAMES) {
    const regex = new RegExp(`${fname}\\s*\\(`, 'g');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(processed)) !== null) {
      const startIdx = match.index;
      const argsStart = startIdx + match[0].length;
      let depth = 1;
      let i = argsStart;
      while (i < processed.length && depth > 0) {
        if (processed[i] === '(') depth++;
        else if (processed[i] === ')') depth--;
        i++;
      }
      const argsStr = processed.slice(argsStart, i - 1);
      const placeholder = `__vf${counter++}__`;
      const args = splitTopLevelArgs(argsStr);
      calls.push({ placeholder, funcName: fname, args });
      processed = processed.slice(0, startIdx) + placeholder + processed.slice(i);
      regex.lastIndex = startIdx + placeholder.length;
    }
  }

  return { processed, calls };
}

// ─── Runtime: resolve vector arg ───

function resolveVecArg(
  expr: string,
  x: number, y: number,
  ctx: VecConstraintContext,
  depth = 0,
): { dx: number; dy: number } | null {
  if (depth > 4) return null;
  const s = expr.trim();

  // bare vector name
  if (/^[a-zA-Z_]\w*$/.test(s)) {
    if (s === ctx.freeVecLabel) {
      return { dx: x - ctx.freeVecStart.x, dy: y - ctx.freeVecStart.y };
    }
    if (ctx.vectors[s]) return ctx.vectors[s];
    return null;
  }

  // negation: -name
  const negM = s.match(/^-\s*([a-zA-Z_]\w*)$/);
  if (negM) {
    const v = resolveVecArg(negM[1], x, y, ctx, depth + 1);
    return v ? { dx: -v.dx, dy: -v.dy } : null;
  }

  // scalar * vec: k*name
  const scaleMulL = s.match(/^([+-]?\d*\.?\d+)\s*\*\s*(.+)$/);
  if (scaleMulL) {
    const k = parseFloat(scaleMulL[1]);
    const v = resolveVecArg(scaleMulL[2], x, y, ctx, depth + 1);
    return v ? { dx: k * v.dx, dy: k * v.dy } : null;
  }

  // addition: last + at top level (not inside parens)
  {
    let parenDepth = 0;
    let lastPlus = -1;
    for (let i = 0; i < s.length; i++) {
      if (s[i] === '(') parenDepth++;
      else if (s[i] === ')') parenDepth--;
      else if (s[i] === '+' && parenDepth === 0 && i > 0) lastPlus = i;
    }
    if (lastPlus > 0) {
      const a = resolveVecArg(s.slice(0, lastPlus), x, y, ctx, depth + 1);
      const b = resolveVecArg(s.slice(lastPlus + 1), x, y, ctx, depth + 1);
      return a && b ? { dx: a.dx + b.dx, dy: a.dy + b.dy } : null;
    }
  }

  // subtraction: last - at top level (skip leading -)
  {
    let parenDepth = 0;
    let lastMinus = -1;
    for (let i = 1; i < s.length; i++) {
      if (s[i] === '(') parenDepth++;
      else if (s[i] === ')') parenDepth--;
      else if (s[i] === '-' && parenDepth === 0) lastMinus = i;
    }
    if (lastMinus > 0) {
      const a = resolveVecArg(s.slice(0, lastMinus), x, y, ctx, depth + 1);
      const b = resolveVecArg(s.slice(lastMinus + 1), x, y, ctx, depth + 1);
      return a && b ? { dx: a.dx - b.dx, dy: a.dy - b.dy } : null;
    }
  }

  // parenthesized: (expr)
  if (s.startsWith('(') && s.endsWith(')')) {
    return resolveVecArg(s.slice(1, -1), x, y, ctx, depth + 1);
  }

  return null;
}

// ─── Runtime: function evaluators ───

type VecEvalFn = (args: string[], x: number, y: number, ctx: VecConstraintContext) => number;

function evalVecMag(args: string[], x: number, y: number, ctx: VecConstraintContext): number {
  if (args.length !== 1) return NaN;
  const v = resolveVecArg(args[0].trim(), x, y, ctx);
  if (!v) return NaN;
  return Math.sqrt(v.dx ** 2 + v.dy ** 2);
}

function evalVecDot(args: string[], x: number, y: number, ctx: VecConstraintContext): number {
  if (args.length !== 2) return NaN;
  const a = resolveVecArg(args[0].trim(), x, y, ctx);
  const b = resolveVecArg(args[1].trim(), x, y, ctx);
  if (!a || !b) return NaN;
  return a.dx * b.dx + a.dy * b.dy;
}

function evalVecCross(args: string[], x: number, y: number, ctx: VecConstraintContext): number {
  if (args.length !== 2) return NaN;
  const a = resolveVecArg(args[0].trim(), x, y, ctx);
  const b = resolveVecArg(args[1].trim(), x, y, ctx);
  if (!a || !b) return NaN;
  return a.dx * b.dy - a.dy * b.dx;
}

const VEC_EVALUATORS: Record<string, VecEvalFn> = {
  mag: evalVecMag,
  dot: evalVecDot,
  cross: evalVecCross,
};

// ─── Public API ───

const VEC_TAG_TEST = /\\vec\{(\w+)\}/;

export function isVecExpression(expr: string): boolean {
  return VEC_TAG_TEST.test(expr);
}

export function validateVecExpr(expr: string, existingVecLabels: Set<string>): string[] {
  const { vecNames } = extractVecTags(expr);
  return [...vecNames].filter((name) => !existingVecLabels.has(name));
}

export function parseVecConstraint(
  input: string,
  knownVecLabels: Set<string>,
): ParsedVecConstraint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const eqParts = trimmed.split('=');
  if (eqParts.length !== 2) return null;

  function preprocess(raw: string): { text: string; calls: VecFuncCall[]; vecs: Set<string> } {
    const { processed: s1, vecNames } = extractVecTags(raw);
    const s2 = latexToArith(s1);
    const s3 = insertImplicitMul(s2);
    const s4 = convertAbsToMag(s3);
    const s5 = restoreVecMarkers(s4);
    const { processed: text, calls } = extractVecFuncCalls(s5);
    return { text, calls, vecs: vecNames };
  }

  const lhs = preprocess(eqParts[0].trim());
  const rhs = preprocess(eqParts[1].trim());
  const allCalls = [...lhs.calls, ...rhs.calls];
  const referencedVecs = new Set([...lhs.vecs, ...rhs.vecs]);

  // Also extract vec names from function args (for non-LaTeX / plain mode)
  for (const call of allCalls) {
    for (const arg of call.args) {
      const ids = arg.match(/[a-zA-Z_]\w*/g) ?? [];
      for (const id of ids) {
        if (knownVecLabels.has(id)) referencedVecs.add(id);
      }
    }
  }

  const mathExpr = `(${lhs.text}) - (${rhs.text})`;
  let compiled: { evaluate: (scope: Record<string, number>) => number };
  try {
    compiled = math.compile(mathExpr);
  } catch {
    return null;
  }

  const fn = (x: number, y: number, ctx: VecConstraintContext): number => {
    const scope: Record<string, number> = {};
    for (const call of allCalls) {
      const evaluator = VEC_EVALUATORS[call.funcName];
      if (!evaluator) { scope[call.placeholder] = NaN; continue; }
      scope[call.placeholder] = evaluator(call.args, x, y, ctx);
    }
    try {
      const result = compiled.evaluate(scope);
      return typeof result === 'number' ? result : Number(result);
    } catch {
      return NaN;
    }
  };

  return {
    fn,
    label: trimmed,
    referencedVecs: [...referencedVecs],
  };
}

export function parseVecExpression(
  input: string,
  knownVecLabels: Set<string>,
): ((x: number, y: number, ctx: VecConstraintContext) => number) | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const { processed: s1, vecNames } = extractVecTags(trimmed);
  const s2 = latexToArith(s1);
  const s3 = insertImplicitMul(s2);
  const s4 = convertAbsToMag(s3);
  const s5 = restoreVecMarkers(s4);
  const { processed: text, calls } = extractVecFuncCalls(s5);

  for (const call of calls) {
    for (const arg of call.args) {
      const ids = arg.match(/[a-zA-Z_]\w*/g) ?? [];
      for (const id of ids) {
        if (knownVecLabels.has(id)) vecNames.add(id);
      }
    }
  }

  let compiled: { evaluate: (scope: Record<string, number>) => number };
  try {
    compiled = math.compile(text);
  } catch {
    return null;
  }

  return (x: number, y: number, ctx: VecConstraintContext): number => {
    const scope: Record<string, number> = {};
    for (const call of calls) {
      const evaluator = VEC_EVALUATORS[call.funcName];
      if (!evaluator) { scope[call.placeholder] = NaN; continue; }
      scope[call.placeholder] = evaluator(call.args, x, y, ctx);
    }
    try {
      const result = compiled.evaluate(scope);
      return typeof result === 'number' ? result : Number(result);
    } catch {
      return NaN;
    }
  };
}
