/**
 * Single-step simulation engine for classical probability experiments.
 * Runs one trial at a time and builds cumulative results from accumulated trials.
 */
import type { CoinFlipResult } from './simulations/coinFlip';
import type { DiceRollResult } from './simulations/diceRoll';
import type { NDiceSumResult } from './simulations/twoDiceSum';
import { computeTheoreticalProbs } from './simulations/twoDiceSum';
import type { BallDrawResult } from './simulations/ballDraw';
import type { MeetingProblemPoint, MeetingProblemResult } from './simulations/meetingProblem';
import type {
  DiceRollParams,
  TwoDiceSumParams,
  BallDrawParams,
  MeetingProblemParams,
  SimulationParams,
  SimulationResult,
  SimulationType,
} from '../types/simulation';

export type AnimatableType = 'coinFlip' | 'diceRoll' | 'twoDiceSum' | 'ballDraw' | 'meetingProblem';
export type MultiAnimatableType = 'monteCarloPi' | 'buffonsNeedle';

export function isAnimatable(type: SimulationType): type is AnimatableType {
  return type === 'coinFlip' || type === 'diceRoll' || type === 'twoDiceSum' || type === 'ballDraw' || type === 'meetingProblem';
}

export function isMultiAnimatable(type: SimulationType): type is MultiAnimatableType {
  return type === 'monteCarloPi' || type === 'buffonsNeedle';
}

/** Run one trial and return the raw trial value to push to accumulated list */
export function runOneTrial(type: AnimatableType, params: SimulationParams): unknown {
  switch (type) {
    case 'coinFlip':
      return Math.random() < 0.5 ? 'H' : 'T';

    case 'diceRoll': {
      const p = params as DiceRollParams;
      const faces: number[] = [];
      for (let d = 0; d < p.diceCount; d++) {
        faces.push(Math.floor(Math.random() * 6) + 1);
      }
      return faces;
    }

    case 'twoDiceSum': {
      const p = params as TwoDiceSumParams;
      const faces: number[] = [];
      let sum = 0;
      for (let d = 0; d < p.diceCount; d++) {
        const face = Math.floor(Math.random() * 6) + 1;
        faces.push(face);
        sum += face;
      }
      return { faces, sum };
    }

    case 'ballDraw': {
      const p = params as BallDrawParams;
      const total = p.redCount + p.whiteCount;
      let reds = 0;
      if (p.replace) {
        for (let j = 0; j < p.drawCount; j++) {
          if (Math.random() < p.redCount / total) reds++;
        }
      } else {
        const bag = [
          ...Array(p.redCount).fill('R') as 'R'[],
          ...Array(p.whiteCount).fill('W') as 'W'[],
        ];
        for (let j = 0; j < p.drawCount; j++) {
          const idx = Math.floor(Math.random() * bag.length);
          if (bag[idx] === 'R') reds++;
          bag.splice(idx, 1);
        }
      }
      return reds;
    }

    case 'meetingProblem': {
      const p = params as MeetingProblemParams;
      const x = Math.random() * p.T;
      const y = Math.random() * p.T;
      const met = Math.abs(x - y) <= p.t;
      return { x, y, met } satisfies MeetingProblemPoint;
    }
  }
}

/** Get a human-readable display string for the last trial result */
export function getTrialDisplay(type: AnimatableType, trial: unknown): string {
  switch (type) {
    case 'coinFlip':
      return trial === 'H' ? '正面 (H)' : '反面 (T)';
    case 'diceRoll': {
      const faces = trial as number[];
      return faces.join('  ');
    }
    case 'twoDiceSum': {
      const t = trial as { faces: number[]; sum: number };
      return `${t.faces.join('  ')} = ${t.sum}`;
    }
    case 'ballDraw':
      return `红球 ${trial as number} 个`;
    case 'meetingProblem': {
      const pt = trial as MeetingProblemPoint;
      return pt.met ? '相遇' : '未相遇';
    }
  }
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

/** Build a full SimulationResult from accumulated single-mode trials */
export function buildPartialResult(
  type: AnimatableType,
  params: SimulationParams,
  trials: unknown[],
): SimulationResult {
  const n = trials.length;
  let data: unknown;

  switch (type) {
    case 'coinFlip': {
      const flips = trials as ('H' | 'T')[];
      let heads = 0;
      const runningHeadsFreq: number[] = [];
      for (let i = 0; i < flips.length; i++) {
        if (flips[i] === 'H') heads++;
        runningHeadsFreq.push(heads / (i + 1));
      }
      data = {
        trials: flips,
        headsCount: heads,
        tailsCount: n - heads,
        headsFreq: n > 0 ? heads / n : 0,
        tailsFreq: n > 0 ? (n - heads) / n : 0,
        runningHeadsFreq,
      } satisfies CoinFlipResult;
      break;
    }

    case 'diceRoll': {
      const p = params as DiceRollParams;
      const roundTrials = trials as number[][];
      const counts = [0, 0, 0, 0, 0, 0];
      const flatTrials: number[] = [];
      const runningFreq: number[][] = Array.from({ length: 6 }, () => []);
      let totalObs = 0;

      for (const faces of roundTrials) {
        for (const face of faces) {
          flatTrials.push(face);
          counts[face - 1]++;
          totalObs++;
        }
        for (let f = 0; f < 6; f++) {
          runningFreq[f].push(totalObs > 0 ? counts[f] / totalObs : 0);
        }
      }

      data = {
        trials: flatTrials,
        frequencies: totalObs > 0 ? counts.map(c => c / totalObs) : new Array(6).fill(0),
        runningFreq,
        diceCount: p.diceCount,
        totalObs,
        event: p.event,
        gteValue: p.gteValue,
        eventCount: 0,
        eventProb: 1,
        runningEventFreq: new Array(n).fill(1),
      } satisfies DiceRollResult;
      break;
    }

    case 'twoDiceSum': {
      const p = params as TwoDiceSumParams;
      const rawTrials = trials as { faces: number[]; sum: number }[];
      const sums = rawTrials.map(t => t.sum);
      const minSum = p.diceCount;
      const maxSum = p.diceCount * 6;
      const range = maxSum - minSum + 1;
      const counts = new Array(range).fill(0) as number[];
      for (const sum of sums) counts[sum - minSum]++;

      data = {
        trials: sums,
        frequencies: n > 0 ? counts.map(c => c / n) : new Array(range).fill(0),
        theoreticalProbs: computeTheoreticalProbs(p.diceCount),
        diceCount: p.diceCount,
        minSum,
        maxSum,
      } satisfies NDiceSumResult;
      break;
    }

    case 'ballDraw': {
      const p = params as BallDrawParams;
      const redCounts = trials as number[];
      const maxRed = Math.min(p.drawCount, p.redCount);
      const counts = new Array(maxRed + 1).fill(0) as number[];
      for (const reds of redCounts) if (reds <= maxRed) counts[reds]++;

      const total = p.redCount + p.whiteCount;
      let theoreticalProbs: number[];
      if (p.replace) {
        const prob = p.redCount / total;
        theoreticalProbs = Array.from({ length: maxRed + 1 }, (_, k) =>
          combination(p.drawCount, k) * Math.pow(prob, k) * Math.pow(1 - prob, p.drawCount - k)
        );
      } else {
        theoreticalProbs = Array.from({ length: maxRed + 1 }, (_, k) =>
          combination(p.redCount, k) * combination(total - p.redCount, p.drawCount - k) / combination(total, p.drawCount)
        );
      }

      data = {
        trials: redCounts,
        frequencies: n > 0 ? counts.map(c => c / n) : new Array(maxRed + 1).fill(0),
        theoreticalProbs,
        maxPossible: maxRed,
      } satisfies BallDrawResult;
      break;
    }

    case 'meetingProblem': {
      const p = params as MeetingProblemParams;
      const points = trials as MeetingProblemPoint[];
      const runningMeetFreq: number[] = [];
      let mc = 0;
      for (let i = 0; i < points.length; i++) {
        if (points[i].met) mc++;
        runningMeetFreq.push(mc / (i + 1));
      }
      const ratio = p.t / p.T;
      const theoreticalProb = 1 - (1 - ratio) * (1 - ratio);

      data = {
        points,
        metCount: mc,
        totalCount: n,
        meetFreq: n > 0 ? mc / n : 0,
        theoreticalProb,
        runningMeetFreq,
        T: p.T,
        t: p.t,
      } satisfies MeetingProblemResult;
      break;
    }
  }

  // Build stats for ResultsPanel display
  const stats: Record<string, number | string> = {};
  switch (type) {
    case 'coinFlip': {
      const d = data as CoinFlipResult;
      stats['已投掷次数'] = n;
      stats['正面次数'] = d.headsCount;
      stats['反面次数'] = d.tailsCount;
      stats['正面频率'] = n > 0 ? d.headsFreq.toFixed(4) : '—';
      stats['理论概率'] = '0.5000';
      break;
    }
    case 'diceRoll': {
      const d = data as DiceRollResult;
      const p = params as DiceRollParams;
      stats['已投掷轮数'] = n;
      stats['骰子数量'] = p.diceCount;
      stats['总观测次数'] = d.totalObs;
      for (let i = 0; i < 6; i++) {
        stats[`面${i + 1}频率`] = d.totalObs > 0 ? d.frequencies[i].toFixed(4) : '—';
      }
      stats['理论概率'] = (1 / 6).toFixed(4);
      break;
    }
    case 'twoDiceSum': {
      const d = data as NDiceSumResult;
      const p = params as TwoDiceSumParams;
      stats['已投掷轮数'] = n;
      stats['骰子数量'] = p.diceCount;
      stats['点数和范围'] = `${d.minSum} ~ ${d.maxSum}`;
      if (n > 0) {
        const maxIdx = d.frequencies.indexOf(Math.max(...d.frequencies));
        stats['最高频率点数和'] = d.minSum + maxIdx;
      }
      break;
    }
    case 'ballDraw': {
      const d = data as BallDrawResult;
      const p = params as BallDrawParams;
      stats['已模拟次数'] = n;
      stats['红球总数'] = p.redCount;
      stats['白球总数'] = p.whiteCount;
      stats['每次取球'] = p.drawCount;
      stats['取球方式'] = p.replace ? '有放回' : '无放回';
      if (n > 0) {
        for (let k = 0; k <= d.maxPossible; k++) {
          stats[`${k}个红球频率`] = d.frequencies[k].toFixed(4);
        }
      }
      break;
    }
    case 'meetingProblem': {
      const d = data as MeetingProblemResult;
      stats['模拟次数'] = n;
      stats['相遇次数'] = d.metCount;
      stats['模拟概率'] = n > 0 ? d.meetFreq.toFixed(4) : '—';
      stats['理论概率'] = d.theoreticalProb.toFixed(4);
      break;
    }
  }

  return { type, data, stats, timestamp: Date.now() };
}
