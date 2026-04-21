import type { RandomSource } from '../random';

export interface LawOfLargeNumbersCurve {
  frequencies: number[]; // frequency at each step
  color: string;
}

export interface LawOfLargeNumbersResult {
  curves: LawOfLargeNumbersCurve[];
  theoreticalProb: number;
  maxN: number;
}

const CURVE_COLORS = ['#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1'];

export function runLawOfLargeNumbers(
  scenario: 'coinFlip' | 'diceRoll' | 'ballDraw',
  maxN: number,
  numCurves: number,
  rng: RandomSource = Math.random,
): LawOfLargeNumbersResult {
  let theoreticalProb: number;
  let getEvent: () => boolean;

  switch (scenario) {
    case 'coinFlip':
      theoreticalProb = 0.5;
      getEvent = () => rng() < 0.5;
      break;
    case 'diceRoll':
      theoreticalProb = 1 / 6;
      getEvent = () => Math.floor(rng() * 6) === 0;
      break;
    case 'ballDraw':
      theoreticalProb = 3 / 8;
      getEvent = () => rng() < 3 / 8;
      break;
  }

  const curves: LawOfLargeNumbersCurve[] = [];

  for (let c = 0; c < numCurves; c++) {
    const frequencies: number[] = [];
    let count = 0;
    for (let i = 0; i < maxN; i++) {
      if (getEvent()) count++;
      frequencies.push(count / (i + 1));
    }
    curves.push({
      frequencies,
      color: CURVE_COLORS[c % CURVE_COLORS.length],
    });
  }

  return { curves, theoreticalProb, maxN };
}
