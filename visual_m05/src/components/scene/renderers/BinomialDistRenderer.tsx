import { COLORS } from '@/styles/tokens';
import type { BinomialDistResult } from '@/engine/simulations/binomialDist';
import { px, ChartAxes, YGrid, ChartTitle, DashedVLine, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

export function BinomialDistRenderer({ result }: { result: BinomialDistResult }) {
  const maxProb = Math.max(...result.pmfPoints.map(p => p.prob)) * 1.2;
  const n = result.n;
  const barSlotW = PW / (n + 1);
  const barW = Math.max(barSlotW * 0.7, 4);
  const meanX = px(result.mean, 0, n);
  const skipStep = n <= 20 ? 1 : Math.ceil(n / 20);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`二项分布 B(${n}, ${result.p})`} />
      <ChartAxes xLabel="k（成功次数）" yLabel="P(X=k)" />
      <YGrid yMin={0} yMax={maxProb} format={(v) => v.toFixed(3)} />

      {/* Bars */}
      {result.pmfPoints.map(({ k, prob }) => {
        const bh = PH * prob / maxProb;
        const bx = ML + k * barSlotW + (barSlotW - barW) / 2;
        const by = MT + PH - bh;
        return (
          <g key={k}>
            <rect x={bx} y={by} width={barW} height={Math.max(bh, 1)} rx={2} fill={COLORS.primary} opacity={0.85} vectorEffect="non-scaling-stroke" />
            {k % skipStep === 0 && (
              <text x={ML + k * barSlotW + barSlotW / 2} y={MT + PH + 14} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>{k}</text>
            )}
          </g>
        );
      })}

      {/* Mean line */}
      <DashedVLine x={meanX} y1={MT} y2={MT + PH} color={COLORS.error} />
      <text x={meanX + 4} y={MT + 14} fontSize={11} fill={COLORS.error}>E(X)={result.mean.toFixed(2)}</text>

      {/* Stats — right-aligned panel */}
      <rect x={ML + PW - 230} y={MT + 2} width={220} height={56} rx={6} fill={COLORS.bg} opacity={0.9} />
      <text x={ML + PW - 220} y={MT + 16} fontSize={11} fill={COLORS.textMuted}>E(X)=np = {result.mean.toFixed(4)}</text>
      <text x={ML + PW - 220} y={MT + 32} fontSize={11} fill={COLORS.textMuted}>D(X)=np(1-p) = {result.variance.toFixed(4)}</text>
      <text x={ML + PW - 220} y={MT + 48} fontSize={11} fill={COLORS.textMuted}>σ = {result.stdDev.toFixed(4)}</text>
    </svg>
  );
}
