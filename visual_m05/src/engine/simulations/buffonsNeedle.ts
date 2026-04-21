import type { RandomSource } from '../random';

export interface BuffonsNeedleResult {
  needles: Array<{ x: number; angle: number; crossesLine: boolean }>;
  crossCount: number;
  totalCount: number;
  piEstimate: number;
  theoreticalProb: number;
  runningPiEstimates: number[];
  l: number; // needle length
  d: number; // line spacing
}

export function runBuffonsNeedle(l: number, d: number, n: number, rng: RandomSource = Math.random): BuffonsNeedleResult {
  const needles: Array<{ x: number; angle: number; crossesLine: boolean }> = [];
  const runningPiEstimates: number[] = [];
  let crossCount = 0;

  // l must be <= d for formula to work cleanly
  const actualL = Math.min(l, d);
  const theoreticalProb = (2 * actualL) / (Math.PI * d);

  for (let i = 0; i < n; i++) {
    const x = rng() * d; // distance from center to nearest line
    const angle = rng() * Math.PI; // angle [0, π]
    const halfProj = (actualL / 2) * Math.sin(angle);
    const crossesLine = x <= halfProj || (d - x) <= halfProj;
    needles.push({ x, angle, crossesLine });
    if (crossesLine) crossCount++;
    runningPiEstimates.push(crossCount > 0 ? (2 * actualL * (i + 1)) / (crossCount * d) : 0);
  }

  const piEstimate = crossCount > 0 ? (2 * actualL * n) / (crossCount * d) : 0;

  return {
    needles,
    crossCount,
    totalCount: n,
    piEstimate,
    theoreticalProb,
    runningPiEstimates,
    l: actualL,
    d,
  };
}
