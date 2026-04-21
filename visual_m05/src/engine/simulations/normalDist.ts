export interface NormalDistResult {
  mu: number;
  sigma: number;
  pdfPoints: Array<{ x: number; y: number }>;
  sigma1Range: [number, number];
  sigma2Range: [number, number];
  sigma3Range: [number, number];
  maxY: number;
}

export function computeNormalDist(mu: number, sigma: number): NormalDistResult {
  const xMin = mu - 4 * sigma;
  const xMax = mu + 4 * sigma;
  const steps = 200;
  const pdfPoints: Array<{ x: number; y: number }> = [];

  for (let i = 0; i <= steps; i++) {
    const x = xMin + (xMax - xMin) * i / steps;
    const y = (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * Math.pow((x - mu) / sigma, 2));
    pdfPoints.push({ x, y });
  }

  const maxY = 1 / (sigma * Math.sqrt(2 * Math.PI));

  return {
    mu,
    sigma,
    pdfPoints,
    sigma1Range: [mu - sigma, mu + sigma],
    sigma2Range: [mu - 2 * sigma, mu + 2 * sigma],
    sigma3Range: [mu - 3 * sigma, mu + 3 * sigma],
    maxY,
  };
}
