import type { RandomSource } from '../random';

export interface MeetingProblemPoint {
  x: number;
  y: number;
  met: boolean;
}

export interface MeetingProblemResult {
  points: MeetingProblemPoint[];
  metCount: number;
  totalCount: number;
  meetFreq: number;
  theoreticalProb: number;
  runningMeetFreq: number[];
  T: number;
  t: number;
}

export function runMeetingProblem(T: number, t: number, n: number, rng: RandomSource = Math.random): MeetingProblemResult {
  const points: MeetingProblemPoint[] = [];
  const runningMeetFreq: number[] = [];
  let metCount = 0;

  for (let i = 0; i < n; i++) {
    const x = rng() * T; // person A arrival time
    const y = rng() * T; // person B arrival time
    const met = Math.abs(x - y) <= t;
    points.push({ x, y, met });
    if (met) metCount++;
    runningMeetFreq.push(metCount / (i + 1));
  }

  const ratio = t / T;
  const theoreticalProb = 1 - (1 - ratio) * (1 - ratio);

  return {
    points,
    metCount,
    totalCount: n,
    meetFreq: metCount / n,
    theoreticalProb,
    runningMeetFreq,
    T,
    t,
  };
}
