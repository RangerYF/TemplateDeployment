import type { RegressionModelType } from '../../types/simulation';

export interface LinearRegressionResult {
  points: Array<{ x: number; y: number }>;
  /** 兼容旧版：线性模型的截距，其他模型对应"线性化后的截距" */
  a: number;
  /** 兼容旧版：线性模型的斜率，其他模型对应"线性化后的斜率" */
  b: number;
  /** Pearson 相关系数（线性化后的） */
  r: number;
  xMean: number;
  yMean: number;
  /** 仅线性模型用：直线两端点；非线性模型留空数组（用 curvePoints 取代） */
  predictedPoints: Array<{ x: number; y: number }>;
  residuals: Array<{ x: number; actual: number; predicted: number; residual: number }>;
  /** 原始坐标系下的曲线采样点（所有模型都填，便于渲染） */
  curvePoints: Array<{ x: number; y: number }>;
  /** 模型类型 */
  modelType: RegressionModelType;
  /** 决定系数 R²（基于原始 y 与预测 y） */
  r2: number;
  /** 原始方程（人类可读，例 "ŷ = 2.5·e^(0.3x)"） */
  equation: string;
  /** LaTeX 版方程（用于 KaTeX 渲染） */
  equationLatex: string;
  /** 线性化方程（教学用，例 "ln(ŷ) = 0.916 + 0.300x"），仅非线性模型有 */
  linearizedEquation?: string;
  /** 二次模型用：c（常数项） */
  c?: number;
  /** 数据无效原因（log/power 要求正数等），有则不计算 */
  invalidReason?: string;
  /** 自动推荐：所有模型的对比结果 */
  modelComparison?: Array<{ modelType: RegressionModelType; r2: number; equation: string; valid: boolean }>;
  /** 自动推荐的最佳模型类型 */
  bestModelType?: RegressionModelType;
}

interface Point2D { x: number; y: number; }

/** 计算 R²（决定系数）：基于原始 y 与模型预测 y */
function calculateR2(points: Point2D[], predict: (x: number) => number): number {
  const n = points.length;
  if (n < 2) return 0;
  const yMean = points.reduce((s, p) => s + p.y, 0) / n;
  let ssRes = 0, ssTot = 0;
  for (const p of points) {
    const yPred = predict(p.x);
    if (!Number.isFinite(yPred)) return 0;
    ssRes += (p.y - yPred) ** 2;
    ssTot += (p.y - yMean) ** 2;
  }
  return ssTot > 0 ? 1 - ssRes / ssTot : 0;
}

/** 在 [xMin, xMax] 之间采样 N 个点画曲线 */
function sampleCurve(xMin: number, xMax: number, predict: (x: number) => number, samples = 80): Point2D[] {
  const result: Point2D[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = predict(x);
    if (Number.isFinite(y)) result.push({ x, y });
  }
  return result;
}

/** 通用最小二乘线性回归（(X, Y) → 直线 Y = a + bX） */
function linearLeastSquares(pairs: Array<{ X: number; Y: number }>): { a: number; b: number; r: number } {
  const n = pairs.length;
  if (n < 2) return { a: 0, b: 0, r: 0 };
  const xMean = pairs.reduce((s, p) => s + p.X, 0) / n;
  const yMean = pairs.reduce((s, p) => s + p.Y, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const p of pairs) {
    sxy += (p.X - xMean) * (p.Y - yMean);
    sxx += (p.X - xMean) ** 2;
    syy += (p.Y - yMean) ** 2;
  }
  const b = sxx !== 0 ? sxy / sxx : 0;
  const a = yMean - b * xMean;
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  return { a, b, r };
}

function formatNum(v: number, d = 3): string {
  if (!Number.isFinite(v)) return 'NaN';
  return v.toFixed(d);
}

// ─── 各模型计算 ──────────────────────────────────────────────────

/** 线性 y = a + bx */
function fitLinear(points: Point2D[]): Partial<LinearRegressionResult> {
  const { a, b, r } = linearLeastSquares(points.map(p => ({ X: p.x, Y: p.y })));
  const predict = (x: number) => a + b * x;
  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  const sign = a >= 0 ? '+' : '';
  return {
    a, b, r,
    predictedPoints: [{ x: xMin, y: predict(xMin) }, { x: xMax, y: predict(xMax) }],
    curvePoints: [{ x: xMin, y: predict(xMin) }, { x: xMax, y: predict(xMax) }],
    r2: calculateR2(points, predict),
    equation: `ŷ = ${formatNum(b)}x ${sign}${formatNum(a)}`,
    equationLatex: `\\hat{y} = ${formatNum(b)}x ${sign}${formatNum(a)}`,
    residuals: points.map(p => ({
      x: p.x, actual: p.y, predicted: predict(p.x), residual: p.y - predict(p.x),
    })),
  };
}

/** 指数 y = a·e^(bx) ⇔ ln(y) = ln(a) + bx，要求 y > 0 */
function fitExponential(points: Point2D[]): Partial<LinearRegressionResult> {
  const valid = points.every(p => p.y > 0);
  if (!valid) return { invalidReason: '指数模型要求所有 y > 0' };
  const linPts = points.map(p => ({ X: p.x, Y: Math.log(p.y) }));
  const { a: lnA, b, r } = linearLeastSquares(linPts);
  const a = Math.exp(lnA);
  const predict = (x: number) => a * Math.exp(b * x);
  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  return {
    a, b, r,
    predictedPoints: [],
    curvePoints: sampleCurve(xMin, xMax, predict),
    r2: calculateR2(points, predict),
    equation: `ŷ = ${formatNum(a)}·e^(${formatNum(b)}x)`,
    equationLatex: `\\hat{y} = ${formatNum(a)} \\cdot e^{${formatNum(b)}x}`,
    linearizedEquation: `ln(ŷ) = ${formatNum(lnA)} ${b >= 0 ? '+' : ''}${formatNum(b)}x`,
    residuals: points.map(p => ({
      x: p.x, actual: p.y, predicted: predict(p.x), residual: p.y - predict(p.x),
    })),
  };
}

/** 幂函数 y = a·x^b ⇔ ln(y) = ln(a) + b·ln(x)，要求 x>0 且 y>0 */
function fitPower(points: Point2D[]): Partial<LinearRegressionResult> {
  const valid = points.every(p => p.x > 0 && p.y > 0);
  if (!valid) return { invalidReason: '幂函数模型要求所有 x > 0 且 y > 0' };
  const linPts = points.map(p => ({ X: Math.log(p.x), Y: Math.log(p.y) }));
  const { a: lnA, b, r } = linearLeastSquares(linPts);
  const a = Math.exp(lnA);
  const predict = (x: number) => a * Math.pow(x, b);
  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  return {
    a, b, r,
    predictedPoints: [],
    curvePoints: sampleCurve(xMin, xMax, predict),
    r2: calculateR2(points, predict),
    equation: `ŷ = ${formatNum(a)}·x^(${formatNum(b)})`,
    equationLatex: `\\hat{y} = ${formatNum(a)} \\cdot x^{${formatNum(b)}}`,
    linearizedEquation: `ln(ŷ) = ${formatNum(lnA)} ${b >= 0 ? '+' : ''}${formatNum(b)}·ln(x)`,
    residuals: points.map(p => ({
      x: p.x, actual: p.y, predicted: predict(p.x), residual: p.y - predict(p.x),
    })),
  };
}

/** 对数 y = a + b·ln(x)，要求 x>0 */
function fitLog(points: Point2D[]): Partial<LinearRegressionResult> {
  const valid = points.every(p => p.x > 0);
  if (!valid) return { invalidReason: '对数模型要求所有 x > 0' };
  const linPts = points.map(p => ({ X: Math.log(p.x), Y: p.y }));
  const { a, b, r } = linearLeastSquares(linPts);
  const predict = (x: number) => a + b * Math.log(x);
  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  const sign = a >= 0 ? '+' : '';
  return {
    a, b, r,
    predictedPoints: [],
    curvePoints: sampleCurve(xMin, xMax, predict),
    r2: calculateR2(points, predict),
    equation: `ŷ = ${formatNum(b)}·ln(x) ${sign}${formatNum(a)}`,
    equationLatex: `\\hat{y} = ${formatNum(b)} \\ln(x) ${sign}${formatNum(a)}`,
    residuals: points.map(p => ({
      x: p.x, actual: p.y, predicted: predict(p.x), residual: p.y - predict(p.x),
    })),
  };
}

/** 二次 y = ax² + bx + c，用法方程 3x3 求解（最小二乘） */
function fitQuadratic(points: Point2D[]): Partial<LinearRegressionResult> {
  const n = points.length;
  if (n < 3) return { invalidReason: '二次模型至少需要 3 个数据点' };
  // 构造法方程 X^T X · β = X^T y, X = [1, x, x²]
  const s0 = n;
  let s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  let sy = 0, syx = 0, syx2 = 0;
  for (const p of points) {
    s1 += p.x;
    s2 += p.x ** 2;
    s3 += p.x ** 3;
    s4 += p.x ** 4;
    sy += p.y;
    syx += p.y * p.x;
    syx2 += p.y * p.x ** 2;
  }
  // 解 [[s0,s1,s2],[s1,s2,s3],[s2,s3,s4]] · [c, b, a] = [sy, syx, syx2]
  // 用 Cramer 法则
  const det = (
    s0 * (s2 * s4 - s3 * s3)
    - s1 * (s1 * s4 - s3 * s2)
    + s2 * (s1 * s3 - s2 * s2)
  );
  if (Math.abs(det) < 1e-12) return { invalidReason: '数据点过于共线，无法拟合二次模型' };
  const detC = (
    sy * (s2 * s4 - s3 * s3)
    - s1 * (syx * s4 - s3 * syx2)
    + s2 * (syx * s3 - s2 * syx2)
  );
  const detB = (
    s0 * (syx * s4 - s3 * syx2)
    - sy * (s1 * s4 - s3 * s2)
    + s2 * (s1 * syx2 - syx * s2)
  );
  const detA = (
    s0 * (s2 * syx2 - syx * s3)
    - s1 * (s1 * syx2 - syx * s2)
    + sy * (s1 * s3 - s2 * s2)
  );
  const c = detC / det;
  const b = detB / det;
  const a = detA / det;
  const predict = (x: number) => a * x * x + b * x + c;
  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  const bSign = b >= 0 ? '+' : '';
  const cSign = c >= 0 ? '+' : '';
  return {
    a, b, r: 0, c,
    predictedPoints: [],
    curvePoints: sampleCurve(xMin, xMax, predict),
    r2: calculateR2(points, predict),
    equation: `ŷ = ${formatNum(a)}x² ${bSign}${formatNum(b)}x ${cSign}${formatNum(c)}`,
    equationLatex: `\\hat{y} = ${formatNum(a)}x^2 ${bSign}${formatNum(b)}x ${cSign}${formatNum(c)}`,
    residuals: points.map(p => ({
      x: p.x, actual: p.y, predicted: predict(p.x), residual: p.y - predict(p.x),
    })),
  };
}

/** 倒数 y = a + b/x，要求 x ≠ 0 */
function fitReciprocal(points: Point2D[]): Partial<LinearRegressionResult> {
  const valid = points.every(p => Math.abs(p.x) > 1e-12);
  if (!valid) return { invalidReason: '倒数模型要求所有 x ≠ 0' };
  const linPts = points.map(p => ({ X: 1 / p.x, Y: p.y }));
  const { a, b, r } = linearLeastSquares(linPts);
  const predict = (x: number) => a + b / x;
  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  const sign = a >= 0 ? '+' : '';
  // 倒数模型在 x=0 附近会爆，避开
  let safeXMin = xMin, safeXMax = xMax;
  if (xMin < 0 && xMax > 0) {
    // 跨过 0：把范围限定到非 0 一侧（取较大的那侧）
    if (Math.abs(xMax) > Math.abs(xMin)) safeXMin = 0.01 * Math.max(0.001, xMax);
    else safeXMax = -0.01 * Math.max(0.001, Math.abs(xMin));
  }
  return {
    a, b, r,
    predictedPoints: [],
    curvePoints: sampleCurve(safeXMin, safeXMax, predict),
    r2: calculateR2(points, predict),
    equation: `ŷ = ${formatNum(a)} ${b >= 0 ? '+' : ''}${formatNum(b)}/x`,
    equationLatex: `\\hat{y} = ${formatNum(a)} ${b >= 0 ? '+' : ''}\\frac{${formatNum(b)}}{x}`,
    linearizedEquation: `ŷ = ${formatNum(a)} ${sign}${formatNum(b)}·(1/x)`,
    residuals: points.map(p => ({
      x: p.x, actual: p.y, predicted: predict(p.x), residual: p.y - predict(p.x),
    })),
  };
}

/** 调度函数：根据模型类型计算 */
function fitByType(points: Point2D[], modelType: RegressionModelType): Partial<LinearRegressionResult> {
  switch (modelType) {
    case 'linear': return fitLinear(points);
    case 'exponential': return fitExponential(points);
    case 'power': return fitPower(points);
    case 'log': return fitLog(points);
    case 'quadratic': return fitQuadratic(points);
    case 'reciprocal': return fitReciprocal(points);
  }
}

/** 主入口：支持模型类型 + 自动推荐 */
export function computeLinearRegression(
  points: Array<{ x: number; y: number }>,
  modelType: RegressionModelType = 'linear',
  autoRecommend = false,
): LinearRegressionResult {
  const n = points.length;
  const xMean = n > 0 ? points.reduce((s, p) => s + p.x, 0) / n : 0;
  const yMean = n > 0 ? points.reduce((s, p) => s + p.y, 0) / n : 0;

  const emptyBase: LinearRegressionResult = {
    points, a: 0, b: 0, r: 0, xMean, yMean,
    predictedPoints: [], residuals: [], curvePoints: [],
    modelType, r2: 0, equation: '', equationLatex: '',
  };

  if (n < 2) return emptyBase;

  // 计算所有 6 个模型（用于自动推荐 + 比较）
  const allModels: RegressionModelType[] = ['linear', 'exponential', 'power', 'log', 'quadratic', 'reciprocal'];
  const comparison: Array<{ modelType: RegressionModelType; r2: number; equation: string; valid: boolean }> = [];
  for (const m of allModels) {
    const r = fitByType(points, m);
    comparison.push({
      modelType: m,
      r2: r.invalidReason ? -Infinity : (r.r2 ?? 0),
      equation: r.invalidReason ? r.invalidReason : (r.equation ?? ''),
      valid: !r.invalidReason,
    });
  }

  // 选最佳模型
  const validModels = comparison.filter(m => m.valid);
  const bestModelType: RegressionModelType = validModels.length > 0
    ? validModels.reduce((best, cur) => cur.r2 > best.r2 ? cur : best).modelType
    : 'linear';

  // 实际使用的模型
  const effectiveModel = autoRecommend ? bestModelType : modelType;
  const fitResult = fitByType(points, effectiveModel);

  if (fitResult.invalidReason) {
    return {
      ...emptyBase,
      modelType: effectiveModel,
      invalidReason: fitResult.invalidReason,
      modelComparison: comparison,
      bestModelType,
    };
  }

  return {
    points,
    a: fitResult.a ?? 0,
    b: fitResult.b ?? 0,
    r: fitResult.r ?? 0,
    xMean,
    yMean,
    predictedPoints: fitResult.predictedPoints ?? [],
    residuals: fitResult.residuals ?? [],
    curvePoints: fitResult.curvePoints ?? [],
    modelType: effectiveModel,
    r2: fitResult.r2 ?? 0,
    equation: fitResult.equation ?? '',
    equationLatex: fitResult.equationLatex ?? '',
    linearizedEquation: fitResult.linearizedEquation,
    c: fitResult.c,
    modelComparison: comparison,
    bestModelType,
  };
}
