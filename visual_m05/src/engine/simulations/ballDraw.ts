import type { RandomSource } from '../random';

export interface BallDrawResult {
  trials: number[]; // number of red balls drawn each trial
  frequencies: number[]; // frequencies for each possible outcome
  theoreticalProbs: number[]; // theoretical probabilities
  maxPossible: number;
}

function combination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  let result = 1;
  for (let i = 0; i < Math.min(k, n - k); i++) {
    result = result * (n - i) / (i + 1);
  }
  return Math.round(result);
}

export function runBallDraw(
  redCount: number,
  whiteCount: number,
  drawCount: number,
  replace: boolean,
  n: number,
  rng: RandomSource = Math.random,
): BallDrawResult {
  const total = redCount + whiteCount;
  const maxRed = Math.min(drawCount, redCount);
  const trials: number[] = [];
  const counts = new Array(maxRed + 1).fill(0);

  for (let i = 0; i < n; i++) {
    let reds = 0;
    if (replace) {
      // With replacement - binomial
      for (let j = 0; j < drawCount; j++) {
        if (rng() < redCount / total) reds++;
      }
    } else {
      // Without replacement - hypergeometric simulation
      const bag = [...Array(redCount).fill('R'), ...Array(whiteCount).fill('W')];
      for (let j = 0; j < drawCount; j++) {
        const idx = Math.floor(rng() * bag.length);
        if (bag[idx] === 'R') reds++;
        bag.splice(idx, 1);
      }
    }
    trials.push(reds);
    counts[reds]++;
  }

  // Theoretical probabilities
  let theoreticalProbs: number[];
  if (replace) {
    // Binomial
    const p = redCount / total;
    theoreticalProbs = Array.from({ length: maxRed + 1 }, (_, k) =>
      combination(drawCount, k) * Math.pow(p, k) * Math.pow(1 - p, drawCount - k)
    );
  } else {
    // Hypergeometric
    theoreticalProbs = Array.from({ length: maxRed + 1 }, (_, k) =>
      combination(redCount, k) * combination(total - redCount, drawCount - k) / combination(total, drawCount)
    );
  }

  return {
    trials,
    frequencies: counts.map(c => c / n),
    theoreticalProbs,
    maxPossible: maxRed,
  };
}
