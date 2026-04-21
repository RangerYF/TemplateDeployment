import { COLORS } from '@/styles/tokens';
import type { MonteCarloPiResult } from '@/engine/simulations/monteCarloPi';
import { px as spx, py as spy, toPolylinePoints } from '@/utils/svgChartUtils';

const VW = 960, VH = 480;

// Left scatter area
const SQ_X = 40, SQ_Y = 60, SQ_SIZE = 340;

// Right line chart
const RML = SQ_X + SQ_SIZE + 60, RMR = 20, RMT = 44, RMB = 52;
const RPW = VW - RML - RMR, RPH = VH - RMT - RMB;
const Y_MIN = 2.5, Y_MAX = 4.0;

export function MonteCarloPiRenderer({ result, displayN }: { result: MonteCarloPiResult; displayN?: number }) {
  const totalN = result.points.length;
  const displayedN = displayN !== undefined ? Math.max(1, Math.min(displayN, totalN)) : totalN;
  const displayedPts = result.points.slice(0, displayedN);
  const insideCount = displayedPts.filter(p => p.inside).length;
  const piEstimate = displayedN > 0 ? 4 * insideCount / displayedN : 0;
  const runningEstimates = result.runningPiEstimates.slice(0, displayedN);

  const n = displayedN;
  const sampledPts = displayedPts.length > 2000
    ? displayedPts.filter((_, i) => i % Math.ceil(displayedPts.length / 2000) === 0)
    : displayedPts;

  const xFn = (i: number) => spx(i, 0, totalN - 1, RML, RPW);
  const yFn = (v: number) => spy(Math.max(Y_MIN, Math.min(Y_MAX, v)), Y_MIN, Y_MAX, RMT, RPH);
  const linePoints = toPolylinePoints(runningEstimates, xFn, yFn);

  const piY = spy(Math.PI, Y_MIN, Y_MAX, RMT, RPH);
  const yTicks = [2.5, 3.0, 3.5, 4.0];
  const xTickVals = [0, 1, 2, 3, 4, 5].map(i => ({ label: Math.round(totalN * i / 5), x: spx(totalN * i / 5, 0, totalN - 1, RML, RPW) }));

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* LEFT: Scatter */}
      <text x={SQ_X + SQ_SIZE / 2} y={SQ_Y - 10} textAnchor="middle" fontSize={13} fontWeight="bold" fill={COLORS.text}>随机投点</text>

      {/* Background square */}
      <rect x={SQ_X} y={SQ_Y} width={SQ_SIZE} height={SQ_SIZE} fill={COLORS.bg} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

      {/* Unit circle boundary */}
      <circle
        cx={SQ_X + SQ_SIZE / 2} cy={SQ_Y + SQ_SIZE / 2} r={SQ_SIZE / 2}
        fill="none" stroke={COLORS.error} strokeWidth={2} vectorEffect="non-scaling-stroke"
      />

      {/* Scatter dots */}
      {sampledPts.map((pt, i) => {
        const cx = SQ_X + (pt.x + 1) / 2 * SQ_SIZE;
        const cy = SQ_Y + (1 - (pt.y + 1) / 2) * SQ_SIZE;
        return <circle key={i} cx={cx} cy={cy} r={1.5} fill={pt.inside ? COLORS.primary : COLORS.info} opacity={0.7} />;
      })}

      {/* Stats below scatter */}
      <text x={SQ_X + SQ_SIZE / 2} y={SQ_Y + SQ_SIZE + 24} textAnchor="middle" fontSize={14} fontWeight="bold" fill={COLORS.text}>π ≈ {piEstimate.toFixed(5)}</text>
      <text x={SQ_X + SQ_SIZE / 2} y={SQ_Y + SQ_SIZE + 42} textAnchor="middle" fontSize={12} fill={COLORS.textSecondary}>圆内: {insideCount} / 总: {n}</text>

      {/* Legend */}
      <circle cx={SQ_X + 8} cy={SQ_Y + SQ_SIZE + 58} r={4} fill={COLORS.primary} />
      <text x={SQ_X + 16} y={SQ_Y + SQ_SIZE + 62} fontSize={11} fill={COLORS.textMuted}>圆内</text>
      <circle cx={SQ_X + 58} cy={SQ_Y + SQ_SIZE + 58} r={4} fill={COLORS.info} />
      <text x={SQ_X + 66} y={SQ_Y + SQ_SIZE + 62} fontSize={11} fill={COLORS.textMuted}>圆外</text>

      {/* RIGHT: Convergence */}
      <text x={RML + RPW / 2} y={RMT - 10} textAnchor="middle" fontSize={13} fontWeight="bold" fill={COLORS.text}>π估计值收敛过程</text>

      {/* Axes */}
      <line x1={RML} y1={RMT} x2={RML} y2={RMT + RPH} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={RML} y1={RMT + RPH} x2={VW - RMR} y2={RMT + RPH} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={RML + RPW / 2} y={VH - 4} textAnchor="middle" fontSize={12} fill={COLORS.textSecondary}>投点数</text>
      <text x={0} y={0} textAnchor="middle" fontSize={12} fill={COLORS.textSecondary} transform={`translate(${RML - 40}, ${RMT + RPH / 2}) rotate(-90)`}>π估计值</text>

      {/* Y ticks */}
      {yTicks.map((v) => {
        const y = spy(v, Y_MIN, Y_MAX, RMT, RPH);
        return (
          <g key={v}>
            <line x1={RML} y1={y} x2={VW - RMR} y2={y} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={RML - 6} y={y + 4} textAnchor="end" fontSize={11} fill={COLORS.textMuted}>{v.toFixed(1)}</text>
          </g>
        );
      })}

      {/* X ticks */}
      {xTickVals.map(({ label, x }) => (
        <text key={label} x={x} y={RMT + RPH + 16} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>{label}</text>
      ))}

      {/* π reference line */}
      <line x1={RML} y1={piY} x2={VW - RMR} y2={piY} stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={VW - RMR + 2} y={piY + 4} fontSize={11} fill={COLORS.error}>π</text>

      {/* Running π estimate line */}
      <polyline points={linePoints} fill="none" stroke={COLORS.primary} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
