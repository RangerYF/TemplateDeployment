import type { FunctionParam } from '@/types';

// ─── Template definition ─────────────────────────────────────────────────────

export interface FunctionTemplate {
  id: string;
  /** Short Chinese label shown in the library button. */
  label: string;
  /** Pretty math expression shown in TemplateParamPanel header. */
  displayExpr: string;
  /** Default parameter specs (value, range, step, hint). */
  defaultParams: FunctionParam[];
  /**
   * Builds the math.js-compatible expression string from current param values.
   * Parentheses around each coefficient ensure negative numbers are handled
   * correctly (e.g. `(-2)*x^2` rather than `-2*x^2` which can parse oddly).
   */
  buildExpr: (values: Record<string, number>) => string;
}

// ─── Template definitions ────────────────────────────────────────────────────

export const FUNCTION_TEMPLATES: FunctionTemplate[] = [
  {
    id: 'linear',
    label: '线性',
    displayExpr: 'y = ax + b',
    defaultParams: [
      { name: 'a', label: 'a', value: 1,  min: -10, max: 10, step: 0.1, hint: '斜率' },
      { name: 'b', label: 'b', value: 0,  min: -20, max: 20, step: 0.1, hint: '截距' },
    ],
    buildExpr: (v) => `(${v.a})*x + (${v.b})`,
  },
  {
    id: 'quadratic',
    label: '二次',
    displayExpr: 'y = ax² + bx + c',
    defaultParams: [
      { name: 'a', label: 'a', value: 1,  min: -5,  max: 5,  step: 0.1, hint: '开口方向/宽度' },
      { name: 'b', label: 'b', value: 0,  min: -10, max: 10, step: 0.1, hint: '一次项系数' },
      { name: 'c', label: 'c', value: 0,  min: -20, max: 20, step: 0.1, hint: 'y轴截距' },
    ],
    buildExpr: (v) => `(${v.a})*x^2 + (${v.b})*x + (${v.c})`,
  },
  {
    id: 'cubic',
    label: '三次',
    displayExpr: 'y = ax³ + bx² + cx + d',
    defaultParams: [
      { name: 'a', label: 'a', value: 1,  min: -3,  max: 3,  step: 0.1, hint: '三次项系数' },
      { name: 'b', label: 'b', value: 0,  min: -5,  max: 5,  step: 0.1, hint: '二次项系数' },
      { name: 'c', label: 'c', value: 0,  min: -10, max: 10, step: 0.1, hint: '一次项系数' },
      { name: 'd', label: 'd', value: 0,  min: -20, max: 20, step: 0.1, hint: '常数项' },
    ],
    buildExpr: (v) => `(${v.a})*x^3 + (${v.b})*x^2 + (${v.c})*x + (${v.d})`,
  },
  {
    id: 'sine',
    label: '正弦',
    displayExpr: 'y = A·sin(ω·x)',
    defaultParams: [
      { name: 'A',     label: 'A',  value: 1, min: -5, max: 5, step: 0.1, hint: '振幅' },
      { name: 'omega', label: 'ω',  value: 1, min: -5, max: 5, step: 0.1, hint: '角频率 (周期=2π/ω)' },
    ],
    buildExpr: (v) => `(${v.A})*sin((${v.omega})*x)`,
  },
  {
    id: 'cosine',
    label: '余弦',
    displayExpr: 'y = A·cos(ω·x)',
    defaultParams: [
      { name: 'A',     label: 'A',  value: 1, min: -5, max: 5, step: 0.1, hint: '振幅' },
      { name: 'omega', label: 'ω',  value: 1, min: -5, max: 5, step: 0.1, hint: '角频率 (周期=2π/ω)' },
    ],
    buildExpr: (v) => `(${v.A})*cos((${v.omega})*x)`,
  },
  {
    id: 'exponential',
    label: '指数',
    displayExpr: 'y = a · b^x',
    defaultParams: [
      { name: 'a', label: 'a', value: 1,          min: -10, max: 10,  step: 0.1, hint: '系数' },
      { name: 'b', label: 'b', value: Math.E,     min: 0.01, max: 20, step: 0.1, hint: '底数 (默认 e≈2.718)' },
    ],
    // pow(b, x) = b^x  — works for any positive base including e
    buildExpr: (v) => `(${v.a})*pow(${v.b}, x)`,
  },
  {
    id: 'logarithm',
    label: '对数',
    displayExpr: 'y = a · log_b(x)',
    defaultParams: [
      { name: 'a', label: 'a', value: 1,      min: -5,  max: 5,  step: 0.1, hint: '系数' },
      { name: 'b', label: 'b', value: Math.E, min: 1.001, max: 100, step: 0.1, hint: '底数 (默认 e=自然对数)' },
    ],
    // math.js log(x, base) = log_base(x); log(x, e) = ln(x)
    buildExpr: (v) => `(${v.a})*log(x, ${v.b})`,
  },
  {
    id: 'power',
    label: '幂函数',
    displayExpr: 'y = a·xⁿ',
    defaultParams: [
      { name: 'a', label: 'a', value: 1, min: -5,  max: 5,  step: 0.1, hint: '系数' },
      { name: 'n', label: 'n', value: 2, min: -10, max: 10, step: 0.5, hint: '指数' },
    ],
    buildExpr: (v) => `(${v.a})*x^(${v.n})`,
  },
];

/** Find a template by id. Returns undefined if not found. */
export function getTemplate(id: string): FunctionTemplate | undefined {
  return FUNCTION_TEMPLATES.find((t) => t.id === id);
}

/**
 * Build a math.js expression from a template + current param values.
 * Returns null if the template id is not registered.
 */
export function buildTemplateExpr(
  templateId: string | null,
  params: FunctionParam[],
): string | null {
  if (!templateId) return null;
  const tmpl = getTemplate(templateId);
  if (!tmpl) return null;
  const values = Object.fromEntries(params.map((p) => [p.name, p.value]));
  return tmpl.buildExpr(values);
}

/**
 * Build a clean readable expression for display in the function list.
 * Strips generated parentheses like `(1)*` and replaces `*` with `·`.
 * Capped at 26 characters with an ellipsis.
 */
export function buildReadableExpr(exprStr: string): string {
  const s = exprStr
    .replace(/\(1\)\*/g, '')          // (1)* → ''  (coefficient of 1 is implicit)
    .replace(/\((-?\d+(?:\.\d+)?)\)\*/g, '$1·')  // (-2)* → -2·
    .replace(/\*/g, '·')              // remaining * → ·
    .replace(/\bpow\(([^,]+),\s*x\)/g, '$1^x')   // pow(b, x) → b^x
    .replace(/\blog\(x,\s*([^)]+)\)/g, 'log($1,x)')  // log(x, b) → log(b,x) for display
    .trim();
  return s.length > 26 ? s.slice(0, 25) + '…' : s;
}
