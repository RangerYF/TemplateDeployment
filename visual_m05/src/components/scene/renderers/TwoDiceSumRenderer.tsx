import { COLORS } from '@/styles/tokens';
import type { NDiceSumResult } from '@/engine/simulations/twoDiceSum';
import { ChartAxes, YGrid, ChartTitle } from '@/utils/svgChartUtils';

const VW = 900, VH = 500;
const ML = 68, MT = 44, MR = 100, MB = 52;
const PW = VW - ML - MR, PH = VH - MT - MB;

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

      {/* Bars */}
      {frequencies.map((obsFreq, i) => {
        const sum = result.minSum + i;
        const theorProb = result.theoreticalProbs[i];
        const bx1 = ML + i * groupW + gap;
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

      {/* Legend */}
      <rect x={VW - MR + 8} y={MT + 8} width={14} height={10} rx={2} fill={COLORS.primary} vectorEffect="non-scaling-stroke" />
      <text x={VW - MR + 26} y={MT + 17} fontSize={11} fill={COLORS.textSecondary}>观测频率</text>
      <rect x={VW - MR + 8} y={MT + 28} width={14} height={10} rx={2} fill="none" stroke={COLORS.error} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={VW - MR + 26} y={MT + 37} fontSize={11} fill={COLORS.textSecondary}>理论概率</text>
      <text x={VW - MR + 8} y={MT + 58} fontSize={11} fill={COLORS.textMuted}>E={expectedSum.toFixed(1)}</text>
    </svg>
  );
}
