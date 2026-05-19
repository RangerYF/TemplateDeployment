import { COLORS } from '@/styles/tokens';
import type { LineChartResult } from '@/engine/simulations/lineChart';
import { px, py, ChartAxes, YGrid, ChartTitle, DashedHLine, VW, VH, ML, MT, MR, PW, PH } from '@/utils/svgChartUtils';

export function LineChartRenderer({
  result, datasetName, showTrend, showMarkers,
}: {
  result: LineChartResult;
  datasetName: string;
  showTrend: boolean;
  showMarkers: boolean;
}) {
  const n = result.points.length;
  if (n === 0) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <rect width={VW} height={VH} fill={COLORS.bg} />
        <text x={VW / 2} y={VH / 2} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>暂无数据</text>
      </svg>
    );
  }

  const yPad = (result.max - result.min) * 0.1 || 1;
  const yMin = result.min - yPad;
  const yMax = result.max + yPad;
  const xMin = 0;
  const xMax = Math.max(n - 1, 1);

  const linePoints = result.points.map(p => `${px(p.i, xMin, xMax).toFixed(1)},${py(p.v, yMin, yMax).toFixed(1)}`).join(' ');
  const meanY = py(result.mean, yMin, yMax);
  const trendX1 = px(result.trendStart.i, xMin, xMax);
  const trendY1 = py(result.trendStart.v, yMin, yMax);
  const trendX2 = px(result.trendEnd.i, xMin, xMax);
  const trendY2 = py(result.trendEnd.v, yMin, yMax);

  // X-axis ticks
  const tickStep = n <= 10 ? 1 : n <= 30 ? Math.ceil(n / 10) : Math.ceil(n / 12);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`折线统计图 — ${datasetName} (n=${n})`} />
      <ChartAxes xLabel="序号" yLabel="数据值" />
      <YGrid yMin={yMin} yMax={yMax} format={(v) => v.toFixed(1)} />

      {/* X ticks */}
      {Array.from({ length: Math.ceil(n / tickStep) + 1 }, (_, idx) => {
        const i = idx * tickStep;
        if (i > n - 1) return null;
        return (
          <text key={i} x={px(i, xMin, xMax)} y={MT + PH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>
            {i + 1}
          </text>
        );
      })}

      {/* Mean reference line */}
      <DashedHLine x1={ML} x2={ML + PW} y={meanY} color={COLORS.warning} />
      <text x={ML + PW - 60} y={meanY - 4} fontSize={11} fill={COLORS.warning}>
        均值 {result.mean.toFixed(2)}
      </text>

      {/* Trend line */}
      {showTrend && (
        <line x1={trendX1} y1={trendY1} x2={trendX2} y2={trendY2}
          stroke={COLORS.error} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      )}

      {/* Polyline */}
      <polyline points={linePoints} fill="none" stroke={COLORS.primary} strokeWidth={2} vectorEffect="non-scaling-stroke" />

      {/* Markers */}
      {showMarkers && n <= 100 && result.points.map((p, i) => (
        <circle key={i} cx={px(p.i, xMin, xMax)} cy={py(p.v, yMin, yMax)} r={3} fill={COLORS.primary} />
      ))}

      {/* Legend */}
      <g transform={`translate(${ML + 8}, ${MT + 8})`}>
        <line x1={0} y1={6} x2={20} y2={6} stroke={COLORS.primary} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        <text x={26} y={10} fontSize={11} fill={COLORS.textSecondary}>数据折线</text>
        <line x1={120} y1={6} x2={140} y2={6} stroke={COLORS.warning} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
        <text x={146} y={10} fontSize={11} fill={COLORS.textSecondary}>均值</text>
        {showTrend && (
          <>
            <line x1={200} y1={6} x2={220} y2={6} stroke={COLORS.error} strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            <text x={226} y={10} fontSize={11} fill={COLORS.textSecondary}>
              趋势 (斜率 {result.trendSlope.toFixed(3)})
            </text>
          </>
        )}
      </g>

      {/* Stats footer */}
      <text x={ML} y={VH - 6} fontSize={11} fill={COLORS.textMuted}>
        n={n} · 均值={result.mean.toFixed(2)} · 范围=[{result.min.toFixed(1)}, {result.max.toFixed(1)}] · 斜率={result.trendSlope.toFixed(4)}
      </text>
      <text x={VW - MR} y={VH - 6} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>
        趋势方程: y = {result.trendSlope.toFixed(3)}·i + {result.trendIntercept.toFixed(2)}
      </text>
    </svg>
  );
}
