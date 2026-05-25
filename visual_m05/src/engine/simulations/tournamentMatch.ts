import type { RandomSource } from '../random';
import type { TournamentEventId, TournamentMatchParams } from '../../types/simulation';

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

  const isSymmetric = params.pAB === 0.5 && params.pAC === 0.5 && params.pBC === 0.5;

  const events: TournamentEventStat[] = trackedDefs.map(def => ({
    id: def.id,
    label: def.label,
    occurCount: eventCounts[def.id],
    freq: params.n > 0 ? eventCounts[def.id] / params.n : 0,
    theoreticalProb: isSymmetric ? def.theoreticalProb : undefined,
    theoreticalLatex: isSymmetric ? def.theoreticalLatex : undefined,
    derivation: isSymmetric ? def.derivation : undefined,
    runningFreq: runningFreqs[def.id],
  }));

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
