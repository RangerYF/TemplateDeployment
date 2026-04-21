import { COLORS } from '@/styles/tokens';
import type { MeetingProblemResult } from '@/engine/simulations/meetingProblem';
import { px as spx, py as spy, toPolylinePoints } from '@/utils/svgChartUtils';

const VW = 960, VH = 500;

// Left: scatter plot
const SQ_X = 60, SQ_Y = 52, SQ_SIZE = 340;

// Right: convergence chart
const RML = SQ_X + SQ_SIZE + 60, RMR = 20, RMT = 52, RMB = 52;
const RPW = VW - RML - RMR, RPH = VH - RMT - RMB;
const Y_MIN = 0, Y_MAX = 1;

export function MeetingProblemRenderer({ result, displayN }: { result: MeetingProblemResult; displayN?: number }) {
  const { T, t } = result;
  const totalN = result.points.length;
  const displayedN = displayN !== undefined ? Math.max(0, Math.min(displayN, totalN)) : totalN;
  const toSvgX = (v: number) => SQ_X + (v / T) * SQ_SIZE;
  const toSvgY = (v: number) => SQ_Y + SQ_SIZE - (v / T) * SQ_SIZE;

  // Meeting region polygon: |x - y| <= t
  const regionPts = [
    [0, 0], [0, t], [T - t, T], [T, T], [T, T - t], [t, 0],
  ].map(([x, y]) => `${toSvgX(x)},${toSvgY(y)}`).join(' ');

  const displayedPts = result.points.slice(0, displayedN);
  const sampledPts = displayedPts.length > 1500
    ? displayedPts.filter((_, i) => i % Math.ceil(displayedPts.length / 1500) === 0)
    : displayedPts;
  const runningFreq = result.runningMeetFreq.slice(0, displayedN);

  // Convergence chart
  const xFn = (i: number) => spx(i, 0, totalN - 1, RML, RPW);
  const yFn = (v: number) => spy(Math.max(Y_MIN, Math.min(Y_MAX, v)), Y_MIN, Y_MAX, RMT, RPH);
  const linePoints = toPolylinePoints(runningFreq, xFn, yFn);
  const theoY = spy(result.theoreticalProb, Y_MIN, Y_MAX, RMT, RPH);
  const yTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const xTickVals = [0, 1, 2, 3, 4, 5].map(i => ({
    label: Math.round(totalN * i / 5),
    x: spx(totalN * i / 5, 0, totalN - 1, RML, RPW),
  }));

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* LEFT: Scatter plot */}
      <text x={SQ_X + SQ_SIZE / 2} y={SQ_Y - 10} textAnchor="middle" fontSize={14} fontWeight="bold" fill={COLORS.text}>
        约会相遇模拟 (T={T}, 等待={t}分钟)
      </text>

      {/* Meeting region */}
      <polygon points={regionPts} fill="rgba(0,192,107,0.12)" vectorEffect="non-scaling-stroke" />

      {/* Boundary lines */}
      <line x1={toSvgX(0)} y1={toSvgY(t)} x2={toSvgX(T - t)} y2={toSvgY(T)} stroke={COLORS.primary} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />
      <line x1={toSvgX(t)} y1={toSvgY(0)} x2={toSvgX(T)} y2={toSvgY(T - t)} stroke={COLORS.primary} strokeWidth={1.5} strokeDasharray="5 4" vectorEffect="non-scaling-stroke" />

      {/* Square border */}
      <rect x={SQ_X} y={SQ_Y} width={SQ_SIZE} height={SQ_SIZE} fill="none" stroke={COLORS.borderStrong} strokeWidth={2} vectorEffect="non-scaling-stroke" />

      {/* Diagonal y=x */}
      <line x1={SQ_X} y1={SQ_Y + SQ_SIZE} x2={SQ_X + SQ_SIZE} y2={SQ_Y} stroke={COLORS.textTertiary} strokeWidth={1} vectorEffect="non-scaling-stroke" />

      {/* Scatter */}
      {sampledPts.map((pt, i) => (
        <circle key={i} cx={toSvgX(pt.x)} cy={toSvgY(pt.y)} r={1.8}
          fill={pt.met ? COLORS.primary : 'rgba(255,77,79,0.6)'} />
      ))}

      {/* Axis labels */}
      <text x={SQ_X + SQ_SIZE / 2} y={SQ_Y + SQ_SIZE + 32} textAnchor="middle" fontSize={14} fill={COLORS.textSecondary}>甲到达时间（分钟）</text>
      <text x={0} y={0} textAnchor="middle" fontSize={14} fill={COLORS.textSecondary} transform={`translate(${SQ_X - 36}, ${SQ_Y + SQ_SIZE / 2}) rotate(-90)`}>乙到达时间（分钟）</text>

      {/* Tick labels */}
      {[0, 1, 2, 3, 4].map((i) => {
        const v = T * i / 4;
        return (
          <g key={i}>
            <text x={toSvgX(v)} y={SQ_Y + SQ_SIZE + 16} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>{Math.round(v)}</text>
            <text x={SQ_X - 6} y={toSvgY(v) + 4} textAnchor="end" fontSize={14} fill={COLORS.textMuted}>{Math.round(v)}</text>
          </g>
        );
      })}

      {/* Legend */}
      <rect x={SQ_X} y={SQ_Y + SQ_SIZE + 42} width={14} height={10} rx={2} fill="rgba(0,192,107,0.2)" stroke={COLORS.primary} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={SQ_X + 18} y={SQ_Y + SQ_SIZE + 51} fontSize={14} fill={COLORS.textMuted}>相遇区域</text>

      {/* RIGHT: Convergence chart */}
      <text x={RML + RPW / 2} y={RMT - 10} textAnchor="middle" fontSize={14} fontWeight="bold" fill={COLORS.text}>
        相遇概率收敛过程
      </text>

      {/* Axes */}
      <line x1={RML} y1={RMT} x2={RML} y2={RMT + RPH} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={RML} y1={RMT + RPH} x2={VW - RMR} y2={RMT + RPH} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={RML + RPW / 2} y={RMT + RPH + 36} textAnchor="middle" fontSize={14} fill={COLORS.textSecondary}>模拟次数</text>
      <text x={0} y={0} textAnchor="middle" fontSize={14} fill={COLORS.textSecondary} transform={`translate(${RML - 40}, ${RMT + RPH / 2}) rotate(-90)`}>相遇频率</text>

      {/* Y ticks */}
      {yTicks.map((v) => {
        const y = spy(v, Y_MIN, Y_MAX, RMT, RPH);
        return (
          <g key={v}>
            <line x1={RML} y1={y} x2={VW - RMR} y2={y} stroke={COLORS.border} strokeWidth={0.8} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={RML - 6} y={y + 4} textAnchor="end" fontSize={14} fill={COLORS.textMuted}>{v.toFixed(1)}</text>
          </g>
        );
      })}

      {/* X ticks */}
      {xTickVals.map(({ label, x }) => (
        <text key={label} x={x} y={RMT + RPH + 16} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>{label}</text>
      ))}

      {/* Theoretical probability reference line */}
      <line x1={RML} y1={theoY} x2={VW - RMR} y2={theoY} stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={VW - RMR + 4} y={theoY + 4} fontSize={14} fill={COLORS.error}>P</text>

      {/* Running frequency line */}
      <polyline points={linePoints} fill="none" stroke={COLORS.primary} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

    </svg>
  );
}
