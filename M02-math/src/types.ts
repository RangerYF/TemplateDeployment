/**
 * A single named parameter for a function template (e.g. a, b, c in y=ax²+bx+c).
 * Stored in FunctionEntry.namedParams when templateId is set.
 */
export interface FunctionParam {
  name:  string;   // key used in buildExpr dict: 'a', 'omega', etc.
  label: string;   // display label: 'a', 'ω', etc.
  value: number;
  min:   number;
  max:   number;
  step:  number;
  /** Optional semantic description shown in TemplateParamPanel. */
  hint?: string;
}

// Transform parameters: a·f(b(x-h))+k
export interface Transform {
  a: number;   // vertical scale   (0.1 ~ 5)
  b: number;   // horizontal scale (-5 ~ 5, excluding 0)
  h: number;   // horizontal shift (-20 ~ 20)
  k: number;   // vertical shift   (-20 ~ 20)
}

export const DEFAULT_TRANSFORM: Transform = { a: 1, b: 1, h: 0, k: 0 };

export interface ViewportState {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const DEFAULT_VIEWPORT: ViewportState = {
  xMin: -10, xMax: 10, yMin: -6, yMax: 6,
};

export interface PiecewiseSegment {
  id: string;
  exprStr: string;
  domain: {
    xMin: number | null;        // null = -∞
    xMax: number | null;        // null = +∞
    xMinInclusive: boolean;
    xMaxInclusive: boolean;
  };
}

export interface FunctionEntry {
  id: string;
  label: string;
  mode: 'standard' | 'piecewise';
  exprStr: string;
  segments: PiecewiseSegment[];
  color: string;
  visible: boolean;
  transform: Transform;
  /** null = user-typed custom expression; string = one of FUNCTION_TEMPLATES ids */
  templateId: string | null;
  /** Named coefficients for template functions (e.g. a, b, c for quadratic). */
  namedParams: FunctionParam[];
}

/** All function curves default to the same dark colour; selection/hover adds highlight. */
export const FUNCTION_COLORS: readonly string[] = [
  '#374151', '#374151', '#374151',
  '#374151', '#374151', '#374151',
];

// ─── M03: 解析几何 — 圆锥曲线类型系统 ────────────────────────────────────────

export type ConicType = 'ellipse' | 'hyperbola' | 'parabola' | 'circle';

/** 椭圆参数: x²/a² + y²/b² = 1  (a > b > 0, 长轴沿 x 轴) */
export interface EllipseParams {
  a:  number;   // 半长轴
  b:  number;   // 半短轴
  cx: number;   // 中心 x
  cy: number;   // 中心 y
}

/** 双曲线参数: x²/a² - y²/b² = 1  (实轴沿 x 轴) */
export interface HyperbolaParams {
  a:  number;   // 半实轴
  b:  number;   // 半虚轴
  cx: number;   // 中心 x
  cy: number;   // 中心 y
}

/**
 * 抛物线参数.
 *
 * orientation 'h' (default): y² = 2p(x−cx)  开口向右, p > 0
 * orientation 'v':           x² = 2p(y−cy)  开口向上, p > 0
 */
export interface ParabolaParams {
  p:            number;          // 焦参数 (p > 0)
  cx:           number;          // 顶点 x
  cy:           number;          // 顶点 y
  orientation?: 'h' | 'v';      // default 'h'
}

/** 圆参数: (x-cx)² + (y-cy)² = r² */
export interface CircleParams {
  r:  number;   // 半径
  cx: number;   // 圆心 x
  cy: number;   // 圆心 y
}

export interface EllipseDerived {
  c:           number;                            // 焦距 √(a²-b²)
  e:           number;                            // 离心率 c/a
  foci:        [[number, number], [number, number]]; // F₁(-c,0) F₂(c,0)
  directrices: [number, number];                  // 准线 x = ±a²/c = ±a/e
}

export interface HyperbolaDerived {
  c:           number;
  e:           number;
  foci:        [[number, number], [number, number]];
  directrices: [number, number];                  // x = ±a²/c
  asymptotes:  [{ k: number; b: number }, { k: number; b: number }]; // y = ±(b/a)x + offset
}

export interface ParabolaDerived {
  focus:       [number, number];
  /**
   * orientation 'h': vertical directrix line  x = directrix
   * orientation 'v': horizontal directrix line y = directrix
   */
  directrix:   number;
  orientation: 'h' | 'v';
}

export interface CircleDerived {
  center:        [number, number];
  area:          number;
  circumference: number;
}

export interface BaseEntityMeta {
  id:      string;
  visible: boolean;
  color:   string;
  label?:  string;
}

export interface EllipseEntity  extends BaseEntityMeta { type: 'ellipse';   params: EllipseParams;   derived: EllipseDerived;   }
export interface HyperbolaEntity extends BaseEntityMeta { type: 'hyperbola'; params: HyperbolaParams; derived: HyperbolaDerived; }
export interface ParabolaEntity  extends BaseEntityMeta { type: 'parabola';  params: ParabolaParams;  derived: ParabolaDerived;  }
export interface CircleEntity    extends BaseEntityMeta { type: 'circle';    params: CircleParams;    derived: CircleDerived;    }

export type ConicEntity = EllipseEntity | HyperbolaEntity | ParabolaEntity | CircleEntity;

// ─── M03: 直线实体 ────────────────────────────────────────────────────────────

/**
 * 直线参数.
 *
 * vertical = false: y = k·x + b
 * vertical = true:  x = x₀  (k/b ignored)
 */
export interface LineParams {
  k:        number;    // slope
  b:        number;    // y-intercept
  vertical: boolean;   // if true → vertical line x = x
  x:        number;    // x-coordinate for vertical line
}

export interface LineEntity extends BaseEntityMeta {
  type:    'line';
  params:  LineParams;
  equationStr?: string | null;       // original symbolic equation (e.g. "y = kx + b")
  namedParams?: FunctionParam[];     // auto-detected free coefficients
}

// ─── M03: 自定义隐式曲线实体 ──────────────────────────────────────────────────

export interface ImplicitCurveParams {
  /** Normalized expression: f(x,y) where f(x,y)=0 is the curve. */
  exprStr: string;
  /** Auto-detected free variables (letters other than x, y). */
  namedParams: FunctionParam[];
}

export interface ImplicitCurveEntity extends BaseEntityMeta {
  type: 'implicit-curve';
  params: ImplicitCurveParams;
}

// ─── M03: 动点实体 ──────────────────────────────────────────────────────────

export interface MovablePointParams {
  constraintEntityId: string;
  t: number;
  mathX: number;
  mathY: number;
  branch?: 'right' | 'left';
  showTrajectory: boolean;
  showProjections: boolean;
}

export interface MovablePointEntity extends BaseEntityMeta {
  type: 'movable-point';
  params: MovablePointParams;
}

/** Union of all M03 entity types. */
export type AnyEntity = ConicEntity | LineEntity | ImplicitCurveEntity | MovablePointEntity;

/** Type guard: is the entity a conic (ellipse, hyperbola, parabola, circle)? */
export function isConicEntity(e: AnyEntity): e is ConicEntity {
  return e.type === 'ellipse' || e.type === 'hyperbola' || e.type === 'parabola' || e.type === 'circle';
}

/** M03 默认视口: ±12 / ±8 — 比 M02 宽，适合圆锥曲线展示 */
export const DEFAULT_M03_VIEWPORT: ViewportState = {
  xMin: -12, xMax: 12, yMin: -8, yMax: 8,
};

/** All entity curves default to the same dark colour; selection adds highlight. */
export const ENTITY_COLORS: readonly string[] = [
  '#374151', '#374151', '#374151',
  '#374151', '#374151', '#374151',
];

/**
 * One sampled point on a parametric curve (ellipse / hyperbola / parabola / circle).
 * `isBreak` is always false for parametric equations (no singularities); the field
 * is retained for compatibility with the shared `renderParametricCurve` renderer,
 * which re-uses the same pen-lift logic as M02's `renderCurve`.
 */
export interface ParametricPoint {
  x:        number;
  y:        number;
  /** Lift pen before drawing this point (asymptote / implicit-sampler break). */
  isBreak?: boolean;
}

// ─── M04 三角函数演示台 ───────────────────────────────────────────────────────

/** Trig-function transform: y = A · fn(ω·x + φ) + k */
export interface TrigTransform {
  A:     number;   // amplitude (0.1 ~ 5, excluding 0)
  omega: number;   // angular frequency (0.1 ~ 5)
  phi:   number;   // phase shift in radians (−π ~ π)
  k:     number;   // vertical shift (−5 ~ 5)
}

/** An exact or approximate trig value with its LaTeX representation. */
export interface ExactValue {
  latex:   string;   // KaTeX string, e.g. '\frac{\sqrt{3}}{2}'
  decimal: number;   // numeric value
  isExact: boolean;  // true = looked-up special-angle value; false = decimal approx
}

/** Trig values at a special angle, including the angle itself. */
export interface SpecialAngleValues {
  angleFraction: string;   // LaTeX fraction, e.g. '\frac{\pi}{3}'
  angleDecimal:  number;   // radians
  sin:           ExactValue;
  cos:           ExactValue;
  tan:           ExactValue;
}

/** Fully-computed triangle (all sides, angles, and secondary properties). */
export interface Triangle {
  a: number; b: number; c: number;   // sides
  A: number; B: number; C: number;   // angles (radians)
  area:         number;
  perimeter:    number;
  circumradius: number;
  inradius:     number;
}

export type SolveMode    = 'SSS' | 'SAS' | 'ASA' | 'AAS' | 'SSA';

export type SolveResult =
  | { valid: false; reason: string }
  | { valid: true; case: 'unique'; triangle: Triangle }
  | { valid: true; case: 'two-solutions'; triangle1: Triangle; triangle2: Triangle };
export type FnType       = 'sin' | 'cos' | 'tan';
export type FivePointStep = 0 | 1 | 2 | 3 | 4 | 5;
