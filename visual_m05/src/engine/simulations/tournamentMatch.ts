import type { RandomSource } from '../random';
import type { TournamentEventId, TournamentMatchParams } from '../../types/simulation';
import { Fraction } from './fraction';

export type Player = 'A' | 'B' | 'C';

export interface TournamentRound {
  game: number;       // 1-indexed game number
  p1: Player;
  p2: Player;
  bye: Player | null; // 轮空者，仅在前期有
  winner: Player;
  loser: Player;
}

export interface TournamentTrial {
  rounds: TournamentRound[];
  champion: Player;
  totalGames: number;
}

export interface TournamentEventStat {
  id: TournamentEventId;
  label: string;
  occurCount: number;
  freq: number;
  theoreticalProb?: number;  // 仅在 p=0.5 三方对称时给出
  theoreticalLatex?: string; // 分式 LaTeX
  derivation?: { title: string; steps: string[] };
  runningFreq: number[];
}

export interface TournamentMatchResult {
  trials: TournamentTrial[];
  events: TournamentEventStat[];
  championDistribution: { A: number; B: number; C: number };  // 频率
  gamesDistribution: Record<number, number>;                  // games 数 -> 频率
  meanGames: number;
  sampleRounds: TournamentRound[];                            // 第 1 次试验的赛程，用于教学展示
}

const PLAYERS: Player[] = ['A', 'B', 'C'];

function probWinner(p1: Player, p2: Player, params: TournamentMatchParams): number {
  // 返回 p1 赢的概率
  if (p1 === 'A' && p2 === 'B') return params.pAB;
  if (p1 === 'B' && p2 === 'A') return 1 - params.pAB;
  if (p1 === 'A' && p2 === 'C') return params.pAC;
  if (p1 === 'C' && p2 === 'A') return 1 - params.pAC;
  if (p1 === 'B' && p2 === 'C') return params.pBC;
  if (p1 === 'C' && p2 === 'B') return 1 - params.pBC;
  return 0.5;
}

export function simulateOneTournament(params: TournamentMatchParams, rng: RandomSource): TournamentTrial {
  const losses: Record<Player, number> = { A: 0, B: 0, C: 0 };
  const rounds: TournamentRound[] = [];
  let playing: [Player, Player] = ['A', 'B'];
  let bye: Player | null = 'C';
  let game = 0;
  let champion: Player | null = null;

  while (!champion) {
    game++;
    const [p1, p2] = playing;
    const probP1 = probWinner(p1, p2, params);
    const winner: Player = rng() < probP1 ? p1 : p2;
    const loser: Player = winner === p1 ? p2 : p1;
    losses[loser]++;
    rounds.push({ game, p1, p2, bye, winner, loser });

    if (losses[loser] >= 2) {
      // loser 被淘汰，检查剩余玩家
      const remaining = PLAYERS.filter(p => losses[p] < 2);
      if (remaining.length === 1) {
        champion = remaining[0];
      } else {
        // 两人剩余，winner 与 bye（或非淘汰另一人）继续
        const others = remaining.filter(p => p !== winner);
        playing = [winner, others[0]];
        bye = null;
      }
    } else {
      // loser 进入轮空，原 bye 上场
      if (bye) {
        playing = [winner, bye];
        bye = loser;
      } else {
        // 后期无轮空者，winner 与 loser 继续（两人对决阶段）
        playing = [winner, loser];
      }
    }

    if (game > 50) {
      // 安全阀，理论上不会触发
      champion = winner;
    }
  }

  return { rounds, champion, totalGames: game };
}

// ─── 精确递归枚举所有可能赛程 + 概率（用 Fraction 精确有理数） ───
export interface ExactTrial {
  trial: TournamentTrial;
  probFraction: Fraction;  // 精确分数概率
  prob: number;            // 数值（toNumber 缓存，用于比较）
}

/** 把 params 中的浮点胜率提前转成 Fraction，避免反复转换 */
interface FractionParams {
  pAB: Fraction; pAC: Fraction; pBC: Fraction;
  qAB: Fraction; qAC: Fraction; qBC: Fraction;  // 1 - p
}
function toFractionParams(params: TournamentMatchParams): FractionParams {
  const pAB = Fraction.fromDecimal(params.pAB);
  const pAC = Fraction.fromDecimal(params.pAC);
  const pBC = Fraction.fromDecimal(params.pBC);
  return { pAB, pAC, pBC, qAB: pAB.complement(), qAC: pAC.complement(), qBC: pBC.complement() };
}

/** 返回某场比赛中 p1 胜 p2 的精确分数概率 */
function probWinnerFrac(p1: Player, p2: Player, fp: FractionParams): Fraction {
  if (p1 === 'A' && p2 === 'B') return fp.pAB;
  if (p1 === 'B' && p2 === 'A') return fp.qAB;
  if (p1 === 'A' && p2 === 'C') return fp.pAC;
  if (p1 === 'C' && p2 === 'A') return fp.qAC;
  if (p1 === 'B' && p2 === 'C') return fp.pBC;
  if (p1 === 'C' && p2 === 'B') return fp.qBC;
  return new Fraction(1n, 2n);
}

export function enumerateAllTrials(params: TournamentMatchParams): ExactTrial[] {
  const fp = toFractionParams(params);
  const results: ExactTrial[] = [];

  function recurse(
    rounds: TournamentRound[],
    losses: Record<Player, number>,
    playing: [Player, Player],
    bye: Player | null,
    accProb: Fraction,
    game: number,
  ) {
    const [p1, p2] = playing;
    const probP1 = probWinnerFrac(p1, p2, fp);
    const branches: Array<{ winner: Player; loser: Player; p: Fraction }> = [
      { winner: p1, loser: p2, p: probP1 },
      { winner: p2, loser: p1, p: probP1.complement() },
    ];
    for (const { winner, loser, p } of branches) {
      if (p.isZero()) continue;
      const newLosses = { ...losses, [loser]: losses[loser] + 1 };
      const newRound: TournamentRound = { game, p1, p2, bye, winner, loser };
      const newRounds = [...rounds, newRound];
      const newAccProb = accProb.multiply(p);

      if (newLosses[loser] >= 2) {
        const remaining = PLAYERS.filter(pl => newLosses[pl] < 2);
        if (remaining.length === 1) {
          results.push({
            trial: { rounds: newRounds, champion: remaining[0], totalGames: game },
            probFraction: newAccProb,
            prob: newAccProb.toNumber(),
          });
        } else {
          const others = remaining.filter(pl => pl !== winner);
          recurse(newRounds, newLosses, [winner, others[0]], null, newAccProb, game + 1);
        }
      } else {
        if (bye) {
          recurse(newRounds, newLosses, [winner, bye], loser, newAccProb, game + 1);
        } else {
          recurse(newRounds, newLosses, [winner, loser], null, newAccProb, game + 1);
        }
      }
    }
  }

  recurse([], { A: 0, B: 0, C: 0 }, ['A', 'B'], 'C', Fraction.one, 1);
  return results;
}

/** 累加所有满足 predicate 的赛程概率（用 Fraction 精确求和） */
function computeExactProbFrac(allTrials: ExactTrial[], predicate: (t: TournamentTrial) => boolean): Fraction {
  let sum = Fraction.zero;
  for (const et of allTrials) {
    if (predicate(et.trial)) sum = sum.add(et.probFraction);
  }
  return sum;
}

// ─── 推导自动生成（枚举每条满足赛程，逐场展开） ─────────────

const PLAYER_NAME_MAP: Record<Player, string> = { A: '甲', B: '乙', C: '丙' };

/** 某场比赛的胜方概率符号 + 数值，例 "p_{AB}=\frac{1}{2}" */
function roundProbExpr(round: TournamentRound, fp: FractionParams): { symbol: string; value: Fraction } {
  const isP1Win = round.winner === round.p1;
  const probSymbol = (() => {
    // 用 p_{XY} 或 1-p_{XY}
    const { p1, p2, winner } = round;
    // 按字母序选 pAB/pAC/pBC 作为基准
    const key = ((): { sym: string; isP1: boolean } => {
      if ((p1 === 'A' && p2 === 'B') || (p1 === 'B' && p2 === 'A')) {
        return { sym: 'p_{AB}', isP1: (p1 === 'A') === (winner === p1) ? true : false };
      }
      if ((p1 === 'A' && p2 === 'C') || (p1 === 'C' && p2 === 'A')) {
        return { sym: 'p_{AC}', isP1: (p1 === 'A') === (winner === p1) ? true : false };
      }
      // B vs C
      return { sym: 'p_{BC}', isP1: (p1 === 'B') === (winner === p1) ? true : false };
    })();
    return key.isP1 ? key.sym : `(1-${key.sym})`;
  })();
  void isP1Win;  // 标记已用
  const value = probWinnerFrac(round.winner, round.loser, fp);
  return { symbol: probSymbol, value };
}

/** 把一条赛程展开为「逐场描述 + 累乘式 + 结果分式」 */
function describeOneTrial(et: ExactTrial, fp: FractionParams, idx: number): string[] {
  const lines: string[] = [];
  // 标题行：赛程 N（共 K 场）
  lines.push(`\\textbf{赛程 ${idx}}: ${et.trial.totalGames} \\text{ 场, 冠军 } ${PLAYER_NAME_MAP[et.trial.champion]}`);
  // 逐场描述
  const factorSymbols: string[] = [];
  const factorValues: string[] = [];
  for (const r of et.trial.rounds) {
    const { symbol, value } = roundProbExpr(r, fp);
    const desc = `\\text{第${r.game}场 } ${PLAYER_NAME_MAP[r.p1]} \\text{vs} ${PLAYER_NAME_MAP[r.p2]}: ${PLAYER_NAME_MAP[r.winner]}\\text{胜}\\,(${symbol}=${value.toLatex()})`;
    lines.push(`\\quad ${desc}`);
    factorSymbols.push(symbol);
    factorValues.push(value.toLatex());
  }
  // 累乘式
  lines.push(`\\quad P_{${idx}} = ${factorSymbols.join(' \\cdot ')} = ${factorValues.join(' \\cdot ')} = ${et.probFraction.toLatex()}`);
  return lines;
}

function genDerivationAuto(
  _id: TournamentEventId,
  label: string,
  params: TournamentMatchParams,
  allTrials: ExactTrial[],
  predicate: (t: TournamentTrial) => boolean,
): { title: string; steps: string[] } {
  const fp = toFractionParams(params);
  const matched = allTrials.filter(t => predicate(t.trial));
  const steps: string[] = [];

  // 头部：说明事件 + 总公式
  steps.push(`\\text{记 } p_{AB}=${fp.pAB.toLatex()},\\, p_{AC}=${fp.pAC.toLatex()},\\, p_{BC}=${fp.pBC.toLatex()} \\text{（当前参数）}`);

  if (matched.length === 0) {
    steps.push(`\\text{枚举所有满足"${label}"的赛程：} 0 \\text{ 条}`);
    steps.push(`\\therefore P(${label}) = 0`);
    return { title: `P(${label}) 的推导`, steps };
  }

  steps.push(`\\text{枚举所有满足"${label}"的赛程：共 } ${matched.length} \\text{ 条，逐条计算后求和}`);

  // 按总场数分组
  const byGames = new Map<number, ExactTrial[]>();
  for (const t of matched) {
    const arr = byGames.get(t.trial.totalGames) ?? [];
    arr.push(t);
    byGames.set(t.trial.totalGames, arr);
  }

  let trialIdx = 0;
  let total = Fraction.zero;
  const allProbStrs: string[] = [];
  for (const games of Array.from(byGames.keys()).sort((a, b) => a - b)) {
    const group = byGames.get(games)!;
    if (byGames.size > 1) {
      steps.push(`\\rule{0pt}{14pt}\\textbf{【情形：${games} 场结束（${group.length} 条赛程）】}`);
    }
    for (const et of group) {
      trialIdx++;
      const lines = describeOneTrial(et, fp, trialIdx);
      steps.push(...lines);
      total = total.add(et.probFraction);
      allProbStrs.push(`P_{${trialIdx}}`);
    }
  }

  // 求和
  steps.push(`\\rule{0pt}{16pt}\\therefore P(\\text{${label}}) = ${allProbStrs.join(' + ')}`);
  // 数值求和（用分式逐个展示再合计）
  const allProbValues = matched.map(t => t.probFraction.toLatex());
  steps.push(`= ${allProbValues.join(' + ')}`);
  steps.push(`= ${total.toLatex()}` + (total.den === 1n ? '' : ` \\approx ${total.toNumber().toFixed(4)}`));

  return { title: `P(${label}) 的精确推导`, steps };
}

// ─── 兼容旧接口：toFractionLatex（仅用于 stats 输出） ──────
export function toFractionLatex(value: number, _tol = 1e-9, _maxDenom = 10000): string {
  return Fraction.fromDecimal(value).toLatex();
}

// ─── Event predicates ───
export interface TournamentEventDef {
  id: TournamentEventId;
  label: string;
  predicate: (trial: TournamentTrial) => boolean;
  theoreticalProb?: number;     // 当 p=0.5 时的理论概率
  theoreticalLatex?: string;    // 理论概率的 LaTeX 分式（如 "\\frac{7}{16}"）
  derivation?: {                 // 推导过程（LaTeX 步骤）
    title: string;
    steps: string[];             // 每个元素是一行 LaTeX
  };
}

export const TOURNAMENT_EVENTS: TournamentEventDef[] = [
  {
    id: 'champion_A', label: '甲最终获胜',
    predicate: t => t.champion === 'A',
    theoreticalProb: 9 / 32, theoreticalLatex: '\\frac{9}{32}',
    derivation: {
      title: '甲最终获胜的概率',
      steps: [
        'P(\\text{甲冠军}) = P(\\text{甲 0 负冠军}) + P(\\text{甲 1 负冠军})',
        'P(\\text{甲 0 负冠军}) = P(\\text{甲连胜四场}) = \\left(\\frac{1}{2}\\right)^4 = \\frac{1}{16} = \\frac{2}{32}',
        '\\text{由对称性 } P(\\text{甲}) = P(\\text{乙}), \\text{且 } P(\\text{甲}) + P(\\text{乙}) + P(\\text{丙}) = 1',
        'P(\\text{甲}) = \\frac{1 - P(\\text{丙})}{2} = \\frac{1 - \\frac{7}{16}}{2} = \\frac{9}{32}',
      ],
    },
  },
  {
    id: 'champion_B', label: '乙最终获胜',
    predicate: t => t.champion === 'B',
    theoreticalProb: 9 / 32, theoreticalLatex: '\\frac{9}{32}',
    derivation: {
      title: '乙最终获胜的概率',
      steps: [
        '\\text{由甲、乙的对称性（两人均在第 1 场出战）}',
        'P(\\text{乙冠军}) = P(\\text{甲冠军}) = \\frac{9}{32}',
      ],
    },
  },
  {
    id: 'champion_C', label: '丙最终获胜',
    predicate: t => t.champion === 'C',
    theoreticalProb: 7 / 16, theoreticalLatex: '\\frac{7}{16}',
    derivation: {
      title: '丙最终获胜的概率',
      steps: [
        '\\text{丙第 1 场轮空，第 2 场必上场。分两种情况：}',
        '\\textbf{情况 1: 丙 0 负冠军 (3 连胜)}',
        '\\text{丙第 2/3/4 场全胜（淘汰甲乙）}',
        'P_1 = \\left(\\frac{1}{2}\\right)^3 = \\frac{1}{8} = \\frac{2}{16}',
        '\\textbf{情况 2: 丙 1 负冠军}',
        '\\text{此时总场数 = 5；丙在某场输 1 次，其他全胜}',
        '\\text{枚举得 } P_2 = \\frac{5}{16}',
        'P(\\text{丙}) = P_1 + P_2 = \\frac{2}{16} + \\frac{5}{16} = \\frac{7}{16}',
      ],
    },
  },
  {
    id: 'A_wins_4_straight', label: '甲连胜四场',
    predicate: t => t.totalGames === 4 && t.rounds.every(r => r.winner === 'A'),
    theoreticalProb: 1 / 16, theoreticalLatex: '\\frac{1}{16}',
    derivation: {
      title: '甲连胜四场的概率',
      steps: [
        '\\text{甲连胜四场} \\iff \\text{第 1-4 场全是甲胜}',
        '\\text{每场比赛甲胜的概率为 } \\frac{1}{2}',
        '\\text{各场比赛相互独立，故}',
        'P = \\left(\\frac{1}{2}\\right)^4 = \\frac{1}{16}',
      ],
    },
  },
  {
    id: 'B_wins_4_straight', label: '乙连胜四场',
    predicate: t => t.totalGames === 4 && t.rounds.every(r => r.winner === 'B'),
    theoreticalProb: 1 / 16, theoreticalLatex: '\\frac{1}{16}',
    derivation: {
      title: '乙连胜四场的概率',
      steps: [
        '\\text{乙连胜四场} \\iff \\text{第 1-4 场全是乙胜}',
        'P = \\left(\\frac{1}{2}\\right)^4 = \\frac{1}{16}',
      ],
    },
  },
  {
    id: 'games_eq_3', label: '恰好需要 3 场比赛',
    predicate: t => t.totalGames === 3,
    theoreticalProb: 0, theoreticalLatex: '0',
    derivation: {
      title: '恰好需要 3 场比赛的概率',
      steps: [
        '\\text{淘汰一人至少需要 2 负，所以总场数} \\geq 4',
        'P(\\text{3 场结束}) = 0',
      ],
    },
  },
  {
    id: 'games_eq_4', label: '恰好需要 4 场比赛',
    predicate: t => t.totalGames === 4,
    theoreticalProb: 1 / 4, theoreticalLatex: '\\frac{1}{4}',
    derivation: {
      title: '恰好需要 4 场比赛的概率',
      steps: [
        '\\text{4 场结束} \\iff \\text{冠军 0 负}',
        '\\text{枚举所有"冠军 0 负"的赛程：}',
        '\\quad \\text{甲 4 连胜：} \\left(\\frac{1}{2}\\right)^4 = \\frac{1}{16}',
        '\\quad \\text{乙 4 连胜：} \\frac{1}{16}',
        '\\quad \\text{丙 0 负冠军 (3 连胜，对称 2 种)：} 2 \\times \\frac{1}{16}',
        'P = \\frac{4}{16} = \\frac{1}{4}',
      ],
    },
  },
  {
    id: 'games_eq_5', label: '恰好需要 5 场比赛',
    predicate: t => t.totalGames === 5,
    theoreticalProb: 3 / 4, theoreticalLatex: '\\frac{3}{4}',
    derivation: {
      title: '恰好需要 5 场比赛的概率',
      steps: [
        '\\text{总场数 = 总输场次 (淘汰 2 人各 2 负) + 冠军输场次}',
        '\\text{冠军 0 负} \\Rightarrow \\text{4 场结束；冠军 1 负} \\Rightarrow \\text{5 场结束}',
        'P(\\text{5 场}) = 1 - P(\\text{4 场}) = 1 - \\frac{1}{4} = \\frac{3}{4}',
      ],
    },
  },
  {
    id: 'games_eq_6', label: '恰好需要 6 场比赛',
    predicate: t => t.totalGames === 6,
    theoreticalProb: 0, theoreticalLatex: '0',
    derivation: {
      title: '恰好需要 6 场比赛的概率',
      steps: [
        '\\text{冠军最多 1 负（2 负即被淘汰），总场数} \\leq 5',
        'P(\\text{6 场}) = 0',
      ],
    },
  },
  {
    id: 'games_eq_7', label: '恰好需要 7 场比赛',
    predicate: t => t.totalGames === 7,
    theoreticalProb: 0, theoreticalLatex: '0',
    derivation: {
      title: '恰好需要 7 场比赛的概率',
      steps: ['P(\\text{7 场}) = 0 \\quad (\\text{同上})'],
    },
  },
  {
    id: 'games_le_5', label: '不超过 5 场比赛',
    predicate: t => t.totalGames <= 5,
    theoreticalProb: 1, theoreticalLatex: '1',
    derivation: {
      title: '不超过 5 场的概率',
      steps: [
        '\\text{总场数} \\in \\{4, 5\\}',
        'P(\\leq 5) = P(4) + P(5) = \\frac{1}{4} + \\frac{3}{4} = 1',
      ],
    },
  },
  {
    id: 'games_ge_5', label: '至少 5 场比赛',
    predicate: t => t.totalGames >= 5,
    theoreticalProb: 3 / 4, theoreticalLatex: '\\frac{3}{4}',
    derivation: {
      title: '至少 5 场的概率',
      steps: [
        '\\text{总场数} \\in \\{4, 5\\}, \\text{至少 5 场} \\iff \\text{= 5 场}',
        'P(\\geq 5) = P(5) = \\frac{3}{4}',
      ],
    },
  },
];

export function getEventDef(id: TournamentEventId): TournamentEventDef | undefined {
  return TOURNAMENT_EVENTS.find(e => e.id === id);
}

export function runTournamentMatch(
  params: TournamentMatchParams,
  rng: RandomSource = Math.random,
): TournamentMatchResult {
  const trials: TournamentTrial[] = [];
  const trackedDefs = params.trackedEvents
    .map(id => getEventDef(id))
    .filter((e): e is TournamentEventDef => !!e);

  const eventCounts: Record<string, number> = {};
  const runningFreqs: Record<string, number[]> = {};
  const championCounts: Record<Player, number> = { A: 0, B: 0, C: 0 };
  const gamesCounts: Record<number, number> = {};
  let gamesSum = 0;

  for (const def of trackedDefs) {
    eventCounts[def.id] = 0;
    runningFreqs[def.id] = [];
  }

  for (let i = 0; i < params.n; i++) {
    const trial = simulateOneTournament(params, rng);
    trials.push(trial);

    championCounts[trial.champion]++;
    gamesCounts[trial.totalGames] = (gamesCounts[trial.totalGames] ?? 0) + 1;
    gamesSum += trial.totalGames;

    for (const def of trackedDefs) {
      if (def.predicate(trial)) eventCounts[def.id]++;
      runningFreqs[def.id].push(eventCounts[def.id] / (i + 1));
    }
  }

  // 精确递归枚举所有可能赛程（任意胜率下都能算精确理论概率）
  const allExactTrials = enumerateAllTrials(params);

  const events: TournamentEventStat[] = trackedDefs.map(def => {
    const exactFrac = computeExactProbFrac(allExactTrials, def.predicate);
    return {
      id: def.id,
      label: def.label,
      occurCount: eventCounts[def.id],
      freq: params.n > 0 ? eventCounts[def.id] / params.n : 0,
      theoreticalProb: exactFrac.toNumber(),
      theoreticalLatex: exactFrac.toLatex(),
      derivation: genDerivationAuto(def.id, def.label, params, allExactTrials, def.predicate),
      // ^ 第一个参数仅占位（保留 id 便于将来按事件 ID 做特殊处理）
      runningFreq: runningFreqs[def.id],
    };
  });

  const total = Math.max(params.n, 1);
  const championDistribution = {
    A: championCounts.A / total,
    B: championCounts.B / total,
    C: championCounts.C / total,
  };
  const gamesDistribution: Record<number, number> = {};
  for (const [g, c] of Object.entries(gamesCounts)) {
    gamesDistribution[Number(g)] = c / total;
  }

  return {
    trials,
    events,
    championDistribution,
    gamesDistribution,
    meanGames: params.n > 0 ? gamesSum / params.n : 0,
    sampleRounds: trials.length > 0 ? trials[0].rounds : [],
  };
}
