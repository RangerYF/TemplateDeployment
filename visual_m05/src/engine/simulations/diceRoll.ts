import type { RandomSource } from '../random';

export type DiceEvent = 'all' | 'odd' | 'even' | 'gte';

export interface DiceRollResult {
  /** 每轮各骰子面值（diceCount 个一组，扁平存储）*/
  trials: number[];
  /** 6个面的观测频率（所有骰子合并统计）*/
  frequencies: number[];
  /** runningFreq[face][trial轮] — 每轮结束后各面的累计频率 */
  runningFreq: number[][];
  diceCount: number;
  totalObs: number; // n * diceCount
  /** 事件筛选 */
  event: DiceEvent;
  gteValue: number;
  /** 目标事件发生次数（按轮统计，diceCount>1时每轮任一骰子满足即算） */
  eventCount: number;
  /** 目标事件理论概率 */
  eventProb: number;
  /** 每轮结束后事件累计频率 */
  runningEventFreq: number[];
}

function matchesEvent(face: number, event: DiceEvent, gteValue: number): boolean {
  if (event === 'all') return true;
  if (event === 'odd') return face % 2 === 1;
  if (event === 'even') return face % 2 === 0;
  if (event === 'gte') return face >= gteValue;
  return true;
}

function theoreticalEventProb(diceCount: number, event: DiceEvent, gteValue: number): number {
  // P(at least one die satisfies event in a round)
  let pSingleDie: number;
  if (event === 'all') pSingleDie = 1;
  else if (event === 'odd') pSingleDie = 3 / 6;
  else if (event === 'even') pSingleDie = 3 / 6;
  else if (event === 'gte') pSingleDie = Math.max(0, Math.min(6, 7 - gteValue)) / 6;
  else pSingleDie = 1;
  if (diceCount === 1) return pSingleDie;
  // P(at least one) = 1 - P(none)
  return 1 - Math.pow(1 - pSingleDie, diceCount);
}

export function runDiceRoll(
  n: number,
  diceCount: number,
  event: DiceEvent = 'all',
  gteValue: number = 5,
  rng: RandomSource = Math.random,
): DiceRollResult {
  const counts = [0, 0, 0, 0, 0, 0];
  const runningFreq: number[][] = Array.from({ length: 6 }, () => []);
  const runningEventFreq: number[] = [];
  const trials: number[] = [];
  let totalObs = 0;
  let eventCount = 0;

  for (let i = 0; i < n; i++) {
    let roundHit = false;
    for (let d = 0; d < diceCount; d++) {
      const face = Math.floor(rng() * 6); // 0-5
      trials.push(face + 1);
      counts[face]++;
      totalObs++;
      if (matchesEvent(face + 1, event, gteValue)) roundHit = true;
    }
    if (roundHit) eventCount++;
    runningEventFreq.push(eventCount / (i + 1));
    // 记录本轮结束后各面频率
    for (let f = 0; f < 6; f++) {
      runningFreq[f].push(counts[f] / totalObs);
    }
  }

  return {
    trials,
    frequencies: counts.map(c => c / totalObs),
    runningFreq,
    diceCount,
    totalObs,
    event,
    gteValue,
    eventCount,
    eventProb: theoreticalEventProb(diceCount, event, gteValue),
    runningEventFreq,
  };
}
