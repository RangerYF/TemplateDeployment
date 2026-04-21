import { COLORS } from '@/styles/tokens';
import type { LinearRegressionResult } from '@/engine/simulations/linearRegression';
import { ChartAxes, ChartTitle, VW, VH, ML, MT, PW, PH } from '@/utils/svgChartUtils';

export function LinearRegressionRenderer({ result, xLabel, yLabel, showResiduals }: {
  result: LinearRegressionResult; xLabel: string; yLabel: string; showResiduals: boolean;
}) {
  const xVals = result.points.map(p => p.x);
  const yVals = result.points.map(p => p.y);
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
  const xPad = (xMax - xMin) * 0.1, yPad = (yMax - yMin) * 0.15;
  const xMinP = xMin - xPad, xMaxP = xMax + xPad;
  const yMinP = yMin - yPad, yMaxP = yMax + yPad;

  const spx = (v: number) => ML + ((v - xMinP) / (xMaxP - xMinP)) * PW;
  const spy = (v: number) => MT + PH - ((v - yMinP) / (yMaxP - yMinP)) * PH;

  const sign = result.b >= 0 ? '+' : '';
  const title = `ŷ = ${result.b.toFixed(3)}x ${sign}${result.a.toFixed(3)}  (r=${result.r.toFixed(4)})`;
  const ticks = 5;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <ChartTitle title={`线性回归: ${title}`} />
      <ChartAxes xLabel={xLabel} yLabel={yLabel} />

      {/* Grid */}
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const vy = yMinP + (yMaxP - yMinP) * i / ticks;
        const vx = xMinP + (xMaxP - xMinP) * i / ticks;
        const gy = spy(vy), gx = spx(vx);
        return (
          <g key={i}>
            <line x1={ML} y1={gy} x2={ML + PW} y2={gy} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ML - 6} y={gy + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{vy.toFixed(0)}</text>
            <line x1={gx} y1={MT} x2={gx} y2={MT + PH} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={gx} y={MT + PH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{vx.toFixed(0)}</text>
          </g>
        );
      })}

      {/* Residual lines */}
      {showResiduals && result.residuals.map((res, i) => (
        <line key={i}
          x1={spx(res.x)} y1={spy(res.actual)}
          x2={spx(res.x)} y2={spy(res.predicted)}
          stroke={COLORS.warning} strokeWidth={1} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
      ))}

      {/* Regression line */}
      <line
        x1={spx(result.predictedPoints[0].x)} y1={spy(result.predictedPoints[0].y)}
        x2={spx(result.predictedPoints[1].x)} y2={spy(result.predictedPoints[1].y)}
        stroke={COLORS.primary} strokeWidth={2} vectorEffect="non-scaling-stroke" />

      {/* Data points */}
      {result.points.map((pt, i) => (
        <circle key={i} cx={spx(pt.x)} cy={spy(pt.y)} r={5} fill={COLORS.info} stroke={COLORS.white} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      ))}

      {/* Mean point */}
      <circle cx={spx(result.xMean)} cy={spy(result.yMean)} r={7} fill={COLORS.error} stroke={COLORS.white} strokeWidth={2} vectorEffect="non-scaling-stroke" />

      {/* Stats */}
      <text x={ML + 10} y={MT + 14} fontSize={11} fill={COLORS.textMuted}>r={result.r.toFixed(4)}  r²={(result.r ** 2).toFixed(4)}</text>

      {/* Legend */}
      <line x1={ML + PW - 140} y1={MT + 10} x2={ML + PW - 124} y2={MT + 10} stroke={COLORS.primary} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={ML + PW - 120} y={MT + 14} fontSize={11} fill={COLORS.textSecondary}>回归直线</text>
      <circle cx={ML + PW - 136} cy={MT + 26} r={4} fill={COLORS.info} />
      <text x={ML + PW - 129} y={MT + 30} fontSize={11} fill={COLORS.textSecondary}>数据点</text>
      <circle cx={ML + PW - 136} cy={MT + 42} r={5} fill={COLORS.error} />
      <text x={ML + PW - 129} y={MT + 46} fontSize={11} fill={COLORS.textSecondary}>均值点(x̄,ȳ)</text>
    </svg>
  );
}
