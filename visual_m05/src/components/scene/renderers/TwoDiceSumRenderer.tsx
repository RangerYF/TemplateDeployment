import { COLORS } from '@/styles/tokens';
import type { NDiceSumResult } from '@/engine/simulations/twoDiceSum';
import { ChartAxes, YGrid, ChartTitle } from '@/utils/svgChartUtils';
import { TrialDataTable } from './TrialDataTable';

const VW = 1140, VH = 540;
const ML = 68, MT = 44, MR = 280, MB = 52;
const PW = VW - ML - MR, PH = VH - MT - MB;
const TABLE_X = ML + PW + 16;
const TABLE_W = MR - 32;

export function TwoDiceSumRenderer({ result, displayN }: { result: NDiceSumResult; displayN?: number }) {
  const totalN = result.trials.length;
  const displayedN = displayN !== undefined ? Math.max(0, Math.min(displayN, totalN)) : totalN;

  // Recompute frequencies from partial trials
  const numBars = result.maxSum - result.minSum + 1;
  let frequencies: number[];
  if (displayedN === totalN) {
    frequencies = result.frequencies;
  } else {
    const counts = new Array(numBars).fill(0) as number[];
    const slice = result.trials.slice(0, displayedN);
    for (const sum of slice) counts[sum - result.minSum]++;
    frequencies = displayedN > 0 ? counts.map(c => c / displayedN) : new Array(numBars).fill(0);
  }

  const allVals = [...frequencies, ...result.theoreticalProbs];
  const maxY = Math.max(...allVals) * 1.25;
  const groupW = PW / numBars;
  const singleW = Math.max(1.5, groupW * 0.37);
  const gap = Math.max(0.5, groupW * 0.04);
  const expectedSum = result.diceCount * 3.5;
  const step = numBars <= 11 ? 1 : numBars <= 20 ? 2 : Math.ceil(numBars / 12);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`${result.diceCount}个骰子点数和分布 (n=${displayedN})`} vw={VW} ml={ML} mr={MR} mt={MT} />
      <ChartAxes ml={ML} mt={MT} mr={MR} mb={MB} vw={VW} vh={VH} xLabel="点数之和" yLabel="频率 / 概率" />
      <YGrid yMin={0} yMax={maxY} ml={ML} mt={MT} mr={MR} mb={MB} vw={VW} vh={VH} format={(v) => v.toFixed(3)} />

      {/* 右侧频数轴 (v0.4 反馈 #5) */}
      <line x1={ML + PW} y1={MT} x2={ML + PW} y2={MT + PH} stroke={COLORS.borderStrong} strokeWidth={1.5} shapeRendering="crispEdges" />
      {Array.from({ length: 6 }, (_, i) => i / 5).map(v => {
        const y = MT + PH - v * PH;
        return (
          <text key={`r-${v}`} x={ML + PW + 3} y={y + 3} fontSize={9} fill={COLORS.textMuted}>
            {Math.round(v * maxY * displayedN)}
          </text>
        );
      })}
      <text x={ML + PW + 3} y={MT - 6} fontSize={10} fill={COLORS.textSecondary}>频数</text>

      {/* Bars */}
      {frequencies.map((obsFreq, i) => {
        const sum = result.minSum + i;
        const theorProb = result.theoreticalProbs[i];
        // 让两根柱子在 group 内居中（v0.4 修复 #1）
        const pairW = 2 * singleW + gap;
        const bx1 = ML + i * groupW + (groupW - pairW) / 2;
        const bh1 = PH * obsFreq / maxY;
        const bh2 = PH * theorProb / maxY;
        const bx2 = bx1 + singleW + gap;

        return (
          <g key={sum}>
            {/* Observed */}
            <rect x={bx1} y={MT + PH - bh1} width={singleW} height={Math.max(bh1, 1)} rx={2} fill={COLORS.primary} vectorEffect="non-scaling-stroke" />
            {/* Theoretical */}
            <rect x={bx2} y={MT + PH - bh2} width={singleW} height={Math.max(bh2, 1)} rx={2} fill="none" stroke={COLORS.error} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            {/* X label */}
            {i % step === 0 && (
              <text x={ML + i * groupW + groupW / 2} y={MT + PH + 16} textAnchor="middle" fontSize={numBars > 20 ? 9 : 11} fill={COLORS.textSecondary}>{sum}</text>
            )}
          </g>
        );
      })}

      {/* Right-side experiment data table */}
      <TrialDataTable
        x={TABLE_X}
        y={MT}
        width={TABLE_W}
        title="实验数据表（按点数和）"
        totalObserved={displayedN}
        rowHeight={18}
        rows={frequencies.map((freq, i) => ({
          label: `点数和 ${result.minSum + i}`,
          count: Math.round(freq * displayedN),
          freq,
          theoreticalProb: result.theoreticalProbs[i],
        }))}
      />

      {/* Legend - below table */}
      <g transform={`translate(${TABLE_X}, ${MT + 200 + (numBars * 18)})`}>
        <rect x={0} y={0} width={14} height={10} rx={2} fill={COLORS.primary} vectorEffect="non-scaling-stroke" />
        <text x={20} y={9} fontSize={11} fill={COLORS.textSecondary}>观测频率</text>
        <rect x={80} y={0} width={14} height={10} rx={2} fill="none" stroke={COLORS.error} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        <text x={100} y={9} fontSize={11} fill={COLORS.textSecondary}>理论概率</text>
        <text x={0} y={28} fontSize={11} fill={COLORS.textMuted}>期望 E = {expectedSum.toFixed(1)}</text>
      </g>
    </svg>
  );
}
