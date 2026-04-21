import { COLORS } from '@/styles/tokens';
import type { HypergeometricDistResult } from '@/engine/simulations/hypergeometricDist';
import { px, py, ChartAxes, YGrid, ChartTitle, DashedVLine, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

export function HypergeometricDistRenderer({
  result,
  showCdf,
}: {
  result: HypergeometricDistResult;
  showCdf?: boolean;
}) {
  const { N, M, n, pmfPoints, cdfPoints, mean, variance, stdDev, kMin, kMax } = result;
  const kRange = kMax - kMin;
  const maxProb = Math.max(...pmfPoints.map(p => p.prob)) * 1.3;
  const numBars = kRange + 1;
  const barSlotW = numBars > 0 ? PW / numBars : PW;
  const barW = Math.max(barSlotW * 0.65, 4);

  // position helpers relative to kMin
  const bx = (k: number) => ML + (k - kMin) * barSlotW + (barSlotW - barW) / 2;
  const meanX = px(mean - kMin, 0, kRange || 1);

  // CDF line points
  const cdfLine = cdfPoints.map(({ k, cumProb }) => ({
    x: ML + (k - kMin) * barSlotW + barSlotW / 2,
    y: py(cumProb, 0, 1),
  }));

  const STATS_X = 12;
  const STATS_Y = MT + PH + 36;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`超几何分布 H(N=${N}, M=${M}, n=${n})`} />
      <ChartAxes xLabel="k（抽中目标数）" yLabel={showCdf ? 'P(X≤k)' : 'P(X=k)'} />
      <YGrid yMin={0} yMax={showCdf ? 1 : maxProb} format={(v) => v.toFixed(3)} tickCount={5} />

      {/* PMF Bars */}
      {pmfPoints.map(({ k, prob }) => {
        const bh = PH * prob / maxProb;
        const by = MT + PH - bh;
        return (
          <g key={k}>
            <rect
              x={bx(k)} y={by} width={barW} height={Math.max(bh, 1)}
              rx={2} fill={COLORS.primary} opacity={0.82}
              vectorEffect="non-scaling-stroke"
            />
            <text x={bx(k) + barW / 2} y={by - 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill={COLORS.text}>
              {prob > 0.01 ? prob.toFixed(3) : ''}
            </text>
            <text x={bx(k) + barW / 2} y={MT + PH + 14} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{k}</text>
          </g>
        );
      })}

      {/* CDF overlay line */}
      {showCdf && cdfLine.length > 1 && (
        <polyline
          points={cdfLine.map(pt => `${pt.x},${pt.y}`).join(' ')}
          fill="none"
          stroke={COLORS.error}
          strokeWidth={2}
          vectorEffect="non-scaling-stroke"
        />
      )}
      {showCdf && cdfLine.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={COLORS.error} vectorEffect="non-scaling-stroke" />
      ))}

      {/* Mean line */}
      <DashedVLine x={meanX} y1={MT} y2={MT + PH} color="#FA8C16" />
      <text x={meanX + 4} y={MT + 16} fontSize={11} fill="#FA8C16">E(X)={mean.toFixed(3)}</text>

      {/* Stats — two rows to avoid overflow */}
      <text x={STATS_X} y={STATS_Y} fontSize={11} fill={COLORS.textMuted}>
        {`E(X)=nM/N=${mean.toFixed(4)}   D(X)=${variance.toFixed(4)}   σ=${stdDev.toFixed(4)}`}
      </text>
      <text x={STATS_X} y={STATS_Y + 16} fontSize={11} fill={COLORS.textMuted}>
        {`k ∈ [${kMin}, ${kMax}]`}
      </text>
    </svg>
  );
}
