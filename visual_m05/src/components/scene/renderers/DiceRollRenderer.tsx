import { COLORS } from '@/styles/tokens';
import type { DiceRollResult } from '@/engine/simulations/diceRoll';
import { py, ChartAxes, DashedHLine, YGrid, ChartTitle, MT, PH } from '@/utils/svgChartUtils';
import { TrialDataTable } from './TrialDataTable';

const FACE_COLORS = ['#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2'];

// 自定义画布尺寸，给右侧表格留位
const VW = 1100, VH = 500;
const ML = 68, MR = 280;
const PW = VW - ML - MR;
const TABLE_X = ML + PW + 16;
const TABLE_W = MR - 32;

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

  // Stats panel position（在右侧表格上方）
  const STATS_X = TABLE_X;
  const STATS_W = TABLE_W;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`掷骰子频率分布 · ${diceLabel} · ${displayedObs}次观测`} vw={VW} ml={ML} mr={MR} mt={MT} />
      <ChartAxes ml={ML} mt={MT} mr={MR} vw={VW} vh={VH} xLabel="骰子面" yLabel="频率" />
      <YGrid yMin={0} yMax={maxY} ml={ML} mt={MT} mr={MR} vw={VW} vh={VH} tickCount={5} format={(v) => v.toFixed(3)} />

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

      {/* Right-side experiment data table */}
      <TrialDataTable
        x={TABLE_X}
        y={MT}
        width={TABLE_W}
        title="实验数据表"
        totalObserved={displayedObs}
        rows={freqs.map((freq, f) => ({
          label: `点 ${f + 1}`,
          count: Math.round(freq * displayedObs),
          freq,
          theoreticalProb: theory,
          color: FACE_COLORS[f],
        }))}
      />

      {/* Event stats panel - below data table */}
      {hasEvent && (
        <g transform={`translate(${STATS_X}, ${MT + 220})`}>
          <rect x={0} y={0} width={STATS_W} height={120} rx={6} fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
          <text x={10} y={20} fontSize={12} fontWeight="bold" fill={COLORS.text}>事件统计</text>
          <text x={10} y={42} fontSize={11} fill={COLORS.textMuted}>目标事件</text>
          <text x={STATS_W - 8} y={42} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.primary}>{eventLabel}</text>
          <text x={10} y={62} fontSize={11} fill={COLORS.textMuted}>发生次数</text>
          <text x={STATS_W - 8} y={62} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.text}>{result.eventCount}</text>
          <text x={10} y={82} fontSize={11} fill={COLORS.textMuted}>观测频率</text>
          <text x={STATS_W - 8} y={82} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.primary}>{observedEventFreq.toFixed(4)}</text>
          <text x={10} y={106} fontSize={11} fill={COLORS.textMuted}>理论概率</text>
          <text x={STATS_W - 8} y={106} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.error}>{result.eventProb.toFixed(4)}</text>
        </g>
      )}
    </svg>
  );
}
