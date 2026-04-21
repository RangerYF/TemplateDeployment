import { COLORS } from '@/styles/tokens';
import type { DiceRollResult } from '@/engine/simulations/diceRoll';
import { py, ChartAxes, DashedHLine, YGrid, ChartTitle, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

const FACE_COLORS = ['#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2'];

const EVENT_LABELS: Record<string, string> = {
  all: '所有点数', odd: '奇数点', even: '偶数点', gte: '≥n点',
};

export function DiceRollRenderer({ result, displayN }: { result: DiceRollResult; displayN?: number }) {
  const theory = 1 / 6;
  const totalRounds = result.runningFreq[0].length;
  const displayedRounds = displayN !== undefined ? Math.max(0, Math.min(displayN, totalRounds)) : totalRounds;

  // Use runningFreq snapshot at displayedRounds - 1 for bar heights
  const freqs: number[] = displayedRounds > 0
    ? Array.from({ length: 6 }, (_, f) => result.runningFreq[f][displayedRounds - 1])
    : new Array(6).fill(0);

  const maxY = Math.max(0.28, Math.max(...freqs) * 1.2);
  const barSlotW = PW / 6;
  const barW = barSlotW * 0.6;
  const theoryY = py(theory, 0, maxY);
  const diceLabel = result.diceCount === 1 ? '1个骰子' : `${result.diceCount}个骰子`;
  const displayedObs = displayedRounds * result.diceCount;

  // Event stats
  const hasEvent = result.event && result.event !== 'all';
  const eventLabel = result.event === 'gte'
    ? `≥${result.gteValue}点`
    : (EVENT_LABELS[result.event] ?? '');
  const observedEventFreq = displayedRounds > 0
    ? result.runningEventFreq[displayedRounds - 1]
    : 0;

  // Stats panel position
  const STATS_X = ML + PW + 20;
  const STATS_W = VW - STATS_X - 10;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`掷骰子频率分布 · ${diceLabel} · ${displayedObs}次观测`} />
      <ChartAxes xLabel="骰子面" yLabel="频率" />
      <YGrid yMin={0} yMax={maxY} tickCount={5} format={(v) => v.toFixed(3)} />

      {/* Theory line */}
      <DashedHLine x1={ML} x2={ML + PW} y={theoryY} color={COLORS.error} />
      <text x={ML + PW + 4} y={theoryY + 4} fontSize={11} fill={COLORS.error}>1/6≈{theory.toFixed(3)}</text>

      {/* Bars */}
      {freqs.map((freq, f) => {
        const bh = PH * freq / maxY;
        const bx = ML + f * barSlotW + (barSlotW - barW) / 2;
        const by = MT + PH - bh;
        return (
          <g key={f}>
            <rect x={bx} y={by} width={barW} height={Math.max(bh, 1)} rx={3} fill={FACE_COLORS[f]} vectorEffect="non-scaling-stroke" />
            <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill={COLORS.text}>{freq.toFixed(3)}</text>
            <text x={bx + barW / 2} y={MT + PH + 16} textAnchor="middle" fontSize={12} fill={COLORS.textSecondary}>点{f + 1}</text>
          </g>
        );
      })}

      {/* Legend */}
      <line x1={ML} y1={MT - 8} x2={ML + 20} y2={MT - 8} stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={ML + 24} y={MT - 4} fontSize={11} fill={COLORS.textSecondary}>理论概率 1/6</text>

      {/* Event stats panel */}
      {hasEvent && (
        <g>
          <rect x={STATS_X} y={MT} width={STATS_W} height={120} rx={6} fill={COLORS.bg} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={STATS_X + 10} y={MT + 20} fontSize={12} fontWeight="bold" fill={COLORS.text}>事件统计</text>
          <text x={STATS_X + 10} y={MT + 42} fontSize={11} fill={COLORS.textMuted}>目标事件</text>
          <text x={STATS_X + STATS_W - 8} y={MT + 42} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.primary}>{eventLabel}</text>
          <text x={STATS_X + 10} y={MT + 62} fontSize={11} fill={COLORS.textMuted}>发生次数</text>
          <text x={STATS_X + STATS_W - 8} y={MT + 62} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.text}>{result.eventCount}</text>
          <text x={STATS_X + 10} y={MT + 82} fontSize={11} fill={COLORS.textMuted}>观测频率</text>
          <text x={STATS_X + STATS_W - 8} y={MT + 82} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.primary}>{observedEventFreq.toFixed(4)}</text>
          <text x={STATS_X + 10} y={MT + 106} fontSize={11} fill={COLORS.textMuted}>理论概率</text>
          <text x={STATS_X + STATS_W - 8} y={MT + 106} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.error}>{result.eventProb.toFixed(4)}</text>
        </g>
      )}
    </svg>
  );
}
