import type { RandomSource } from '../random';

export interface CoinFlipResult {
  trials: ('H' | 'T')[];
  headsCount: number;
  tailsCount: number;
  headsFreq: number;
  tailsFreq: number;
  runningHeadsFreq: number[];
}

export function runCoinFlip(n: number, rng: RandomSource = Math.random): CoinFlipResult {
  const trials: ('H' | 'T')[] = [];
  let heads = 0;
  const runningHeadsFreq: number[] = [];

  for (let i = 0; i < n; i++) {
    const result = rng() < 0.5 ? 'H' : 'T';
    trials.push(result);
    if (result === 'H') heads++;
    runningHeadsFreq.push(heads / (i + 1));
  }

  return {
    trials,
    headsCount: heads,
    tailsCount: n - heads,
    headsFreq: heads / n,
    tailsFreq: (n - heads) / n,
    runningHeadsFreq,
  };
}
