import type { RandomSource } from '../random';

export interface MonteCarloPiPoint {
  x: number;
  y: number;
  inside: boolean;
}

export interface MonteCarloPiResult {
  points: MonteCarloPiPoint[];
  insideCount: number;
  outsideCount: number;
  piEstimate: number;
  runningPiEstimates: number[];
}

export function runMonteCarloPi(n: number, rng: RandomSource = Math.random): MonteCarloPiResult {
  const points: MonteCarloPiPoint[] = [];
  let insideCount = 0;
  const runningPiEstimates: number[] = [];

  for (let i = 0; i < n; i++) {
    const x = rng() * 2 - 1; // [-1, 1]
    const y = rng() * 2 - 1;
    const inside = x * x + y * y <= 1;
    points.push({ x, y, inside });
    if (inside) insideCount++;
    runningPiEstimates.push(4 * insideCount / (i + 1));
  }

  return {
    points,
    insideCount,
    outsideCount: n - insideCount,
    piEstimate: 4 * insideCount / n,
    runningPiEstimates,
  };
}
