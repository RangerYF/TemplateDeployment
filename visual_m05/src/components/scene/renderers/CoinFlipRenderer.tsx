import { COLORS } from '@/styles/tokens';
import type { CoinFlipResult } from '@/engine/simulations/coinFlip';
import { px, py, toPolylinePoints, ChartAxes, DashedHLine, ChartTitle } from '@/utils/svgChartUtils';

const VW = 800, VH = 580;
const ML = 68, MR = 80;
const PW = VW - ML - MR;

// Top section
const T1_MT = 40, T1_H = 220;
// Bottom section
const T2_MT = 310, T2_H = VH - T2_MT - 20 - 20;

export function CoinFlipRenderer({ result, displayN }: { result: CoinFlipResult; displayN?: number }) {
  const totalN = result.runningHeadsFreq.length;
  const displayedN = displayN !== undefined ? Math.max(0, Math.min(displayN, totalN)) : totalN;

  // Recompute bar heights from partial trials
  const displayTrials = result.trials.slice(0, displayedN);
  const heads = displayTrials.filter(t => t === 'H').length;
  const hFreq = displayedN > 0 ? heads / displayedN : 0;
  const tFreq = displayedN > 0 ? 1 - hFreq : 0;
  const freqs = [hFreq, tFreq];
  const labels = ['正面 (H)', '反面 (T)'];
  const colors = [COLORS.primary, COLORS.info];

  const barW = PW * 0.18;

  // Top Y grid
  const topGridLines = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  // Bottom line chart — slice to displayedN but keep x-axis fixed to totalN
  const runningSlice = result.runningHeadsFreq.slice(0, displayedN);
  const xFn = (i: number) => px(i, 0, Math.max(totalN - 1, 1), ML, PW);
  const yFn = (v: number) => py(Math.max(0, Math.min(1, v)), 0, 1, T2_MT, T2_H);
  const points = toPolylinePoints(runningSlice, xFn, yFn);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      {/* Background */}
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* TOP: Bar chart */}
      <ChartTitle title={`掷硬币频率对比 (n=${displayedN})`} vw={VW} ml={ML} mr={MR} mt={T1_MT} />
      <ChartAxes ml={ML} mt={T1_MT} mr={MR} mb={0} vw={VW} vh={T1_MT + T1_H} xLabel="结果" yLabel="频率" />

      {/* Y grid (top) */}
      {topGridLines.map((v) => {
        const y = py(v, 0, 1, T1_MT, T1_H);
        return (
          <g key={v}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{v.toFixed(1)}</text>
          </g>
        );
      })}

      {/* Theory line 0.5 */}
      <DashedHLine x1={ML} x2={ML + PW} y={py(0.5, 0, 1, T1_MT, T1_H)} color={COLORS.error} />
      <text x={ML + PW + 4} y={py(0.5, 0, 1, T1_MT, T1_H) + 4} fontSize={11} fill={COLORS.error}>理论 0.5</text>

      {/* Bars */}
      {freqs.map((freq, i) => {
        const realBx = ML + (i === 0 ? PW * 0.15 : PW * 0.55);
        const bh = T1_H * freq;
        const by = T1_MT + T1_H - bh;
        return (
          <g key={i}>
            <rect x={realBx} y={by} width={barW} height={Math.max(bh, 1)} rx={3} fill={colors[i]} vectorEffect="non-scaling-stroke" />
            <text x={realBx + barW / 2} y={by - 5} textAnchor="middle" fontSize={12} fontWeight="bold" fill={COLORS.text}>{freq.toFixed(3)}</text>
            <text x={realBx + barW / 2} y={T1_MT + T1_H + 16} textAnchor="middle" fontSize={12} fill={COLORS.textSecondary}>{labels[i]}</text>
          </g>
        );
      })}

      {/* Divider */}
      <line x1={ML} y1={288} x2={ML + PW} y2={288} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />

      {/* BOTTOM: Running frequency */}
      <text x={ML + PW / 2} y={T2_MT - 10} textAnchor="middle" fontSize={14} fontWeight="bold" fill={COLORS.text}>频率收敛过程</text>
      <ChartAxes ml={ML} mt={T2_MT} mr={MR} mb={0} vw={VW} vh={T2_MT + T2_H} xLabel="试验次数" yLabel="正面频率" />

      {/* Y grid (bottom) */}
      {[0, 0.25, 0.5, 0.75, 1.0].map((v) => {
        const y = py(v, 0, 1, T2_MT, T2_H);
        return (
          <g key={v}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{v.toFixed(2)}</text>
          </g>
        );
      })}

      {/* X ticks (bottom) — always based on totalN for stable axis */}
      {[0, 1, 2, 3, 4, 5].map((i) => {
        const v = Math.round(totalN * i / 5);
        const x = px(v, 0, Math.max(totalN - 1, 1), ML, PW);
        return <text key={i} x={x} y={T2_MT + T2_H + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{v}</text>;
      })}

      {/* Theory line 0.5 */}
      <DashedHLine x1={ML} x2={ML + PW} y={py(0.5, 0, 1, T2_MT, T2_H)} color={COLORS.error} />
      <text x={ML + PW + 4} y={py(0.5, 0, 1, T2_MT, T2_H) + 4} fontSize={11} fill={COLORS.error}>p=0.5</text>

      {/* Running frequency line */}
      {points.length > 0 && (
        <polyline points={points} fill="none" stroke={COLORS.primary} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      )}
    </svg>
  );
}
