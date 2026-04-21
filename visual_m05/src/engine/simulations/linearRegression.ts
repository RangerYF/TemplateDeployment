export interface LinearRegressionResult {
  points: Array<{ x: number; y: number }>;
  a: number; // intercept
  b: number; // slope
  r: number; // correlation coefficient
  xMean: number;
  yMean: number;
  predictedPoints: Array<{ x: number; y: number }>;
  residuals: Array<{ x: number; actual: number; predicted: number; residual: number }>;
}

export function computeLinearRegression(points: Array<{ x: number; y: number }>): LinearRegressionResult {
  const n = points.length;
  const xMean = points.reduce((s, p) => s + p.x, 0) / n;
  const yMean = points.reduce((s, p) => s + p.y, 0) / n;

  let sxy = 0, sxx = 0, syy = 0;
  for (const p of points) {
    sxy += (p.x - xMean) * (p.y - yMean);
    sxx += (p.x - xMean) ** 2;
    syy += (p.y - yMean) ** 2;
  }

  const b = sxx !== 0 ? sxy / sxx : 0;
  const a = yMean - b * xMean;
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;

  const xMin = Math.min(...points.map(p => p.x));
  const xMax = Math.max(...points.map(p => p.x));
  const predictedPoints = [
    { x: xMin, y: a + b * xMin },
    { x: xMax, y: a + b * xMax },
  ];

  const residuals = points.map(p => ({
    x: p.x,
    actual: p.y,
    predicted: a + b * p.x,
    residual: p.y - (a + b * p.x),
  }));

  return { points, a, b, r, xMean, yMean, predictedPoints, residuals };
}
