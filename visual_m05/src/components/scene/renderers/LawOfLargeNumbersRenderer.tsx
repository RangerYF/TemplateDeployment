import { COLORS } from '@/styles/tokens';
import type { LawOfLargeNumbersResult } from '@/engine/simulations/lawOfLargeNumbers';
import { px as spx2, py as spy2, toPolylinePoints, ChartAxes, ChartTitle } from '@/utils/svgChartUtils';

const VW = 900, VH = 480;
const ML = 68, MT = 44, MR = 100, MB = 52;
const PW = VW - ML - MR, PH = VH - MT - MB;

const SCENARIO_LABELS: Record<string, string> = {
  coinFlip: '抛硬币（正面朝上）',
  diceRoll: '掷骰子（点1出现）',
  ballDraw: '摸球（3红/8总）',
};

export function LawOfLargeNumbersRenderer({ result, scenario }: { result: LawOfLargeNumbersResult; scenario: string }) {
  const p = result.theoreticalProb;
  const yMin = Math.max(0, p - 0.5), yMax = Math.min(1, p + 0.5);
  const n = result.maxN;
  const theoryY = spy2(p, yMin, yMax, MT, PH);
  const yTicks = Array.from({ length: 6 }, (_, i) => yMin + (yMax - yMin) * i / 5);
  const xTickVals = [0, 1, 2, 3, 4, 5].map(i => ({ v: Math.round(n * i / 5), x: spx2(n * i / 5, 0, n - 1, ML, PW) }));

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`大数定律演示 — ${SCENARIO_LABELS[scenario] ?? scenario}`} vw={VW} ml={ML} mr={MR} mt={MT} />
      <ChartAxes ml={ML} mt={MT} mr={MR} mb={MB} vw={VW} vh={VH} xLabel="试验次数 n" yLabel="事件频率" />

      {/* Y grid */}
      {yTicks.map((v, i) => {
        const y = spy2(v, yMin, yMax, MT, PH);
        return (
          <g key={i}>
            <line x1={ML} y1={y} x2={ML + PW} y2={y} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={y + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{v.toFixed(3)}</text>
          </g>
        );
      })}

      {/* X ticks */}
      {xTickVals.map(({ v, x }) => (
        <text key={v} x={x} y={MT + PH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{v}</text>
      ))}

      {/* Theory line */}
      <line x1={ML} y1={theoryY} x2={ML + PW} y2={theoryY} stroke={COLORS.error} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={ML + PW + 4} y={theoryY + 4} fontSize={11} fontWeight="bold" fill={COLORS.error}>p={p.toFixed(4)}</text>

      {/* Frequency curves */}
      {result.curves.map((curve, ci) => {
        const xFn = (i: number) => spx2(i, 0, n - 1, ML, PW);
        const yFn = (v: number) => spy2(Math.max(yMin, Math.min(yMax, v)), yMin, yMax, MT, PH);
        const pts = toPolylinePoints(curve.frequencies, xFn, yFn);
        return (
          <polyline key={ci} points={pts} fill="none" stroke={curve.color} strokeWidth={1.5} opacity={0.85} vectorEffect="non-scaling-stroke" />
        );
      })}

      {/* Legend */}
      <line x1={ML + PW + 4} y1={MT + 30} x2={ML + PW + 24} y2={MT + 30} stroke={COLORS.error} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={ML + PW + 28} y={MT + 34} fontSize={10} fill={COLORS.textSecondary}>理论值</text>
      {result.curves.map((curve, i) => (
        <line key={i} x1={ML + PW + 4} y1={MT + 48 + i * 16} x2={ML + PW + 24} y2={MT + 48 + i * 16} stroke={curve.color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}
