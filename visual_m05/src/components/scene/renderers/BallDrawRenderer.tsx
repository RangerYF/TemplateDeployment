import { COLORS } from '@/styles/tokens';
import type { BallDrawResult } from '@/engine/simulations/ballDraw';
import { ChartAxes, YGrid, ChartTitle, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

export function BallDrawRenderer({ result, replace, displayN }: { result: BallDrawResult; replace: boolean; displayN?: number }) {
  const totalN = result.trials.length;
  const displayedN = displayN !== undefined ? Math.max(0, Math.min(displayN, totalN)) : totalN;

  // Recompute frequencies from partial trials
  const numBars = result.maxPossible + 1;
  let frequencies: number[];
  if (displayedN === totalN) {
    frequencies = result.frequencies;
  } else {
    const counts = new Array(numBars).fill(0) as number[];
    const slice = result.trials.slice(0, displayedN);
    for (const reds of slice) if (reds < numBars) counts[reds]++;
    frequencies = displayedN > 0 ? counts.map(c => c / displayedN) : new Array(numBars).fill(0);
  }

  const allVals = [...frequencies, ...result.theoreticalProbs];
  const maxY = Math.max(...allVals) * 1.2;
  const groupW = PW / numBars;
  const singleW = Math.max(2, groupW * 0.38);
  const gap = Math.max(0.5, groupW * 0.04);
  const mode = replace ? '有放回' : '无放回';

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`摸球结果分布 (${mode}, n=${displayedN})`} />
      <ChartAxes xLabel="取到红球数" yLabel="频率 / 概率" />
      <YGrid yMin={0} yMax={maxY} format={(v) => v.toFixed(3)} />

      {frequencies.map((obsFreq, k) => {
        const theorProb = result.theoreticalProbs[k];
        const bx1 = ML + k * groupW + gap;
        const bh1 = PH * obsFreq / maxY;
        const bh2 = PH * theorProb / maxY;
        const bx2 = bx1 + singleW + gap;
        return (
          <g key={k}>
            <rect x={bx1} y={MT + PH - bh1} width={singleW} height={Math.max(bh1, 1)} rx={2} fill={COLORS.primary} vectorEffect="non-scaling-stroke" />
            <rect x={bx2} y={MT + PH - bh2} width={singleW} height={Math.max(bh2, 1)} rx={2} fill="none" stroke={COLORS.error} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            <text x={ML + k * groupW + groupW / 2} y={MT + PH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>{k}个红</text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={ML + PW - 160} y={MT + 8} width={14} height={10} rx={2} fill={COLORS.primary} vectorEffect="non-scaling-stroke" />
      <text x={ML + PW - 142} y={MT + 17} fontSize={11} fill={COLORS.textSecondary}>模拟频率</text>
      <rect x={ML + PW - 90} y={MT + 8} width={14} height={10} rx={2} fill="none" stroke={COLORS.error} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={ML + PW - 72} y={MT + 17} fontSize={11} fill={COLORS.textSecondary}>{replace ? '二项概率' : '超几何概率'}</text>
    </svg>
  );
}
