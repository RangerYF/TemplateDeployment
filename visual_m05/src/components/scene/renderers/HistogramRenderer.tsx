import { COLORS } from '@/styles/tokens';
import type { HistogramResult } from '@/engine/simulations/histogram';
import { px, ChartAxes, YGrid, ChartTitle, VW, VH, ML, MT, PH } from '@/utils/svgChartUtils';

export function HistogramRenderer({ result, datasetName }: { result: HistogramResult; datasetName: string }) {
  const maxFreq = Math.max(...result.bins.map(b => b.freq)) * 1.2;
  const xMin = result.min, xMax = result.max;

  const meanX = px(result.mean, xMin, xMax);
  const medianX = px(result.median, xMin, xMax);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`频率直方图 — ${datasetName}`} />
      <ChartAxes xLabel="数据值" yLabel="频率/组距" />
      <YGrid yMin={0} yMax={maxFreq} format={(v) => v.toFixed(3)} />

      {/* Bins */}
      {result.bins.map((bin, i) => {
        const bx = px(bin.start, xMin, xMax);
        const bxEnd = px(bin.end, xMin, xMax);
        const bw = bxEnd - bx - 1;
        const bh = PH * bin.freq / maxFreq;
        const by = MT + PH - bh;
        return (
          <g key={i}>
            <rect x={bx} y={by} width={Math.max(bw, 1)} height={Math.max(bh, 1)} fill={COLORS.primary} opacity={0.85} vectorEffect="non-scaling-stroke" />
            <rect x={bx} y={by} width={Math.max(bw, 1)} height={Math.max(bh, 1)} fill="none" stroke={COLORS.primaryHover} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {bh > 16 && (
              <text x={bx + bw / 2} y={by + 12} textAnchor="middle" fontSize={10} fontWeight="bold" fill={COLORS.white}>{bin.count}</text>
            )}
          </g>
        );
      })}

      {/* X axis ticks — skip labels when too dense */}
      {(() => {
        const totalTicks = result.binCount + 1;
        const step = totalTicks <= 12 ? 1 : totalTicks <= 24 ? 2 : Math.ceil(totalTicks / 10);
        return Array.from({ length: totalTicks }, (_, i) => {
          if (i % step !== 0 && i !== totalTicks - 1) return null;
          const v = xMin + i * result.binWidth;
          const x = px(v, xMin, xMax);
          return <text key={i} x={x} y={MT + PH + 16} textAnchor="middle" fontSize={totalTicks > 20 ? 9 : 11} fill={COLORS.textMuted}>{v.toFixed(0)}</text>;
        });
      })()}

      {/* Mean line */}
      <line x1={meanX} y1={MT} x2={meanX} y2={MT + PH} stroke={COLORS.error} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      {/* Median line */}
      <line x1={medianX} y1={MT} x2={medianX} y2={MT + PH} stroke={COLORS.warning} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />

      {/* Legend */}
      <line x1={ML + 10} y1={MT + 10} x2={ML + 26} y2={MT + 10} stroke={COLORS.error} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={ML + 30} y={MT + 14} fontSize={11} fill={COLORS.textSecondary}>均值 {result.mean.toFixed(1)}</text>
      <line x1={ML + 110} y1={MT + 10} x2={ML + 126} y2={MT + 10} stroke={COLORS.warning} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={ML + 130} y={MT + 14} fontSize={11} fill={COLORS.textSecondary}>中位数 {result.median.toFixed(1)}</text>

      {/* Stats footer — split into two rows to avoid overflow */}
      <text x={ML} y={VH - 18} fontSize={11} fill={COLORS.textMuted}>
        n={result.data.length}  均值={result.mean.toFixed(2)}  标准差={result.stdDev.toFixed(2)}
      </text>
      <text x={ML} y={VH - 4} fontSize={11} fill={COLORS.textMuted}>
        范围=[{result.min.toFixed(0)}, {result.max.toFixed(0)}]  组距={result.binWidth.toFixed(1)}
      </text>
    </svg>
  );
}
