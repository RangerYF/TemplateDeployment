import { math } from './exactMath';

export interface ConstraintContext {
  points: Record<string, { x: number; y: number }>;
}

export interface ParsedConstraint {
  fn: (x: number, y: number, ctx: ConstraintContext) => number;
  label: string;
}

const BUILTIN_FUNCS = [
  'dist', 'mag', 'dot', 'cross', 'angle', 'distLine',
] as const;

function resolvePoint(
  name: string, x: number, y: number, ctx: ConstraintContext, depth = 0,
): { x: number; y: number } | null {
  if (depth > 3) return null;
  const s = name.trim();
  if (s === 'P') return { x, y };
  if (s === 'O') return { x: 0, y: 0 };
  if (ctx.points[s]) return ctx.points[s];

  const negM = s.match(/^-(\w+)$/);
  if (negM) {
    const p = resolvePoint(negM[1], x, y, ctx, depth + 1);
    return p ? { x: -p.x, y: -p.y } : null;
  }

  const scaleM = s.match(/^([+-]?\d*\.?\d+)\s*\*\s*(\w+)$/);
  if (scaleM) {
    const k = parseFloat(scaleM[1]);
    const p = resolvePoint(scaleM[2], x, y, ctx, depth + 1);
    return p ? { x: k * p.x, y: k * p.y } : null;
  }

  const addM = s.match(/^(.+?)\s*\+\s*(\w+)$/);
  if (addM) {
    const a = resolvePoint(addM[1], x, y, ctx, depth + 1);
    const b = resolvePoint(addM[2], x, y, ctx, depth + 1);
    return a && b ? { x: a.x + b.x, y: a.y + b.y } : null;
  }

  return null;
}

function resolveVec(
  expr: string, x: number, y: number, ctx: ConstraintContext,
): { x: number; y: number } | null {
  const subMatch = expr.match(/^(\w+)\s*-\s*(\w+)$/);
  if (subMatch) {
    const a = resolvePoint(subMatch[1], x, y, ctx);
    const b = resolvePoint(subMatch[2], x, y, ctx);
    if (!a || !b) return null;
    return { x: a.x - b.x, y: a.y - b.y };
  }
  return resolvePoint(expr, x, y, ctx);
}

function evalDist(
  args: string[], x: number, y: number, ctx: ConstraintContext,
): number {
  if (args.length !== 2) return NaN;
  const a = resolvePoint(args[0].trim(), x, y, ctx);
  const b = resolvePoint(args[1].trim(), x, y, ctx);
  if (!a || !b) return NaN;
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function evalMag(
  args: string[], x: number, y: number, ctx: ConstraintContext,
): number {
  if (args.length !== 1) return NaN;
  const v = resolveVec(args[0].trim(), x, y, ctx);
  if (!v) return NaN;
  return Math.sqrt(v.x ** 2 + v.y ** 2);
}

function evalDot(
  args: string[], x: number, y: number, ctx: ConstraintContext,
): number {
  if (args.length !== 2) return NaN;
  const a = resolveVec(args[0].trim(), x, y, ctx);
  const b = resolveVec(args[1].trim(), x, y, ctx);
  if (!a || !b) return NaN;
  return a.x * b.x + a.y * b.y;
}

function evalCross(
  args: string[], x: number, y: number, ctx: ConstraintContext,
): number {
  if (args.length !== 2) return NaN;
  const a = resolveVec(args[0].trim(), x, y, ctx);
  const b = resolveVec(args[1].trim(), x, y, ctx);
  if (!a || !b) return NaN;
  return a.x * b.y - a.y * b.x;
}

function evalAngle(
  args: string[], x: number, y: number, ctx: ConstraintContext,
): number {
  if (args.length !== 3) return NaN;
  const a = resolvePoint(args[0].trim(), x, y, ctx);
  const v = resolvePoint(args[1].trim(), x, y, ctx);
  const b = resolvePoint(args[2].trim(), x, y, ctx);
  if (!a || !v || !b) return NaN;
  const va = { x: a.x - v.x, y: a.y - v.y };
  const vb = { x: b.x - v.x, y: b.y - v.y };
  const magA = Math.sqrt(va.x ** 2 + va.y ** 2);
  const magB = Math.sqrt(vb.x ** 2 + vb.y ** 2);
  if (magA < 1e-10 || magB < 1e-10) return 0;
  const cos = Math.max(-1, Math.min(1, (va.x * vb.x + va.y * vb.y) / (magA * magB)));
  return Math.acos(cos) * 180 / Math.PI;
}

function evalDistLine(
  args: string[], x: number, y: number, ctx: ConstraintContext,
): number {
  if (args.length !== 3) return NaN;
  const p = resolvePoint(args[0].trim(), x, y, ctx);
  const a = resolvePoint(args[1].trim(), x, y, ctx);
  const b = resolvePoint(args[2].trim(), x, y, ctx);
  if (!p || !a || !b) return NaN;
  const abx = b.x - a.x, aby = b.y - a.y;
  const len = Math.sqrt(abx ** 2 + aby ** 2);
  if (len < 1e-10) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  return Math.abs((p.x - a.x) * aby - (p.y - a.y) * abx) / len;
}

type BuiltinEval = (args: string[], x: number, y: number, ctx: ConstraintContext) => number;

const EVALUATORS: Record<string, BuiltinEval> = {
  dist: evalDist,
  mag: evalMag,
  dot: evalDot,
  cross: evalCross,
  angle: evalAngle,
  distLine: evalDistLine,
};

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

interface FuncCall {
  placeholder: string;
  funcName: string;
  args: string[];
}

function extractFuncCalls(expr: string): { processed: string; calls: FuncCall[] } {
  const calls: FuncCall[] = [];
  let processed = expr;
  let counter = 0;

  for (const fname of BUILTIN_FUNCS) {
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
      const placeholder = `__f${counter++}__`;
      const args = splitTopLevelArgs(argsStr);
      calls.push({ placeholder, funcName: fname, args });
      processed = processed.slice(0, startIdx) + placeholder + processed.slice(i);
      regex.lastIndex = startIdx + placeholder.length;
    }
  }

  return { processed, calls };
}

export function parseExpression(
  input: string,
): ((x: number, y: number, ctx: ConstraintContext) => number) | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const { processed, calls } = extractFuncCalls(trimmed);
  let compiled: { evaluate: (scope: Record<string, number>) => number };
  try {
    let normalized = processed;
    normalized = normalized.replace(/√\(/g, 'sqrt(');
    normalized = normalized.replace(/√(\d+)/g, 'sqrt($1)');
    normalized = normalized.replace(/π/g, 'pi');
    normalized = normalized.replace(/²/g, '^2');
    compiled = math.compile(normalized);
  } catch {
    return null;
  }
  return (x, y, ctx) => {
    const scope: Record<string, number> = { x, y };
    for (const call of calls) {
      const evaluator = EVALUATORS[call.funcName];
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

export function parseConstraint(input: string, _ctx: ConstraintContext): ParsedConstraint | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const eqParts = trimmed.split('=');
  if (eqParts.length !== 2) return null;

  const lhsRaw = eqParts[0].trim();
  const rhsRaw = eqParts[1].trim();

  const lhsExtract = extractFuncCalls(lhsRaw);
  const rhsExtract = extractFuncCalls(rhsRaw);

  const allCalls = [...lhsExtract.calls, ...rhsExtract.calls];
  const mathExpr = `(${lhsExtract.processed}) - (${rhsExtract.processed})`;

  let compiled: { evaluate: (scope: Record<string, number>) => number };
  try {
    let normalized = mathExpr;
    normalized = normalized.replace(/√\(/g, 'sqrt(');
    normalized = normalized.replace(/√(\d+)/g, 'sqrt($1)');
    normalized = normalized.replace(/π/g, 'pi');
    normalized = normalized.replace(/²/g, '^2');
    compiled = math.compile(normalized);
  } catch {
    return null;
  }

  const fn = (x: number, y: number, ctx: ConstraintContext): number => {
    const scope: Record<string, number> = { x, y };
    for (const call of allCalls) {
      const evaluator = EVALUATORS[call.funcName];
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

  return { fn, label: trimmed };
}
