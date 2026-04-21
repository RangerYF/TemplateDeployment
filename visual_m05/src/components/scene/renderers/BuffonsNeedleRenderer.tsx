import { COLORS } from '@/styles/tokens';
import type { BuffonsNeedleResult } from '@/engine/simulations/buffonsNeedle';
import { px as spx, py as spy, toPolylinePoints } from '@/utils/svgChartUtils';

const VW = 960, VH = 500;

// Left: needle visualization
const VIZ_X = 40, VIZ_Y = 52, VIZ_W = 400, VIZ_H = 340;

// Right: convergence chart
const RML = VIZ_X + VIZ_W + 60, RMR = 20, RMT = 52, RMB = 52;
const RPW = VW - RML - RMR, RPH = VH - RMT - RMB;
const Y_MIN = 2.5, Y_MAX = 4.0;

export function BuffonsNeedleRenderer({ result, displayN }: { result: BuffonsNeedleResult; displayN?: number }) {
  const { d, l } = result;
  const totalCount = result.needles.length;
  const displayedN = displayN !== undefined ? Math.max(1, Math.min(displayN, totalCount)) : totalCount;
  const displayedNeedles = result.needles.slice(0, displayedN);
  const runningEstimates = result.runningPiEstimates.slice(0, displayedN);

  // Needle visualization: 5 lines = 4 gaps
  const numLines = 5;
  const numGaps = numLines - 1;
  const lineSpacePx = VIZ_H / numGaps;

  const needlesToDraw = displayedNeedles.length > 400
    ? displayedNeedles.filter((_, i) => i % Math.ceil(displayedNeedles.length / 400) === 0)
    : displayedNeedles;

  const needleElements = needlesToDraw.map((needle, i) => {
    const centerX = VIZ_X + 15 + ((i * 137.508) % (VIZ_W - 30));
    const gapIdx = i % numGaps;
    const centerY = VIZ_Y + gapIdx * lineSpacePx + (needle.x / d) * lineSpacePx;
    const halfL = (l / d) * lineSpacePx / 2;
    const dx = halfL * Math.cos(needle.angle);
    const dy = halfL * Math.sin(needle.angle);
    return { key: i, x1: centerX - dx, y1: centerY - dy, x2: centerX + dx, y2: centerY + dy, crosses: needle.crossesLine };
  });

  // Convergence chart
  const xFn = (i: number) => spx(i, 0, totalCount - 1, RML, RPW);
  const yFn = (v: number) => spy(Math.max(Y_MIN, Math.min(Y_MAX, v)), Y_MIN, Y_MAX, RMT, RPH);
  const linePoints = toPolylinePoints(runningEstimates, xFn, yFn);
  const piY = spy(Math.PI, Y_MIN, Y_MAX, RMT, RPH);
  const yTicks = [2.5, 3.0, 3.5, 4.0];
  const xTickVals = [0, 1, 2, 3, 4, 5].map(i => ({
    label: Math.round(totalCount * i / 5),
    x: spx(totalCount * i / 5, 0, totalCount - 1, RML, RPW),
  }));


  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* LEFT: Needle visualization */}
      <text x={VIZ_X + VIZ_W / 2} y={VIZ_Y - 10} textAnchor="middle" fontSize={14} fontWeight="bold" fill={COLORS.text}>
        投针模拟 (针长={l.toFixed(1)}, 线距={d})
      </text>

      <rect x={VIZ_X} y={VIZ_Y} width={VIZ_W} height={VIZ_H} fill={COLORS.bg} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />

      {/* Parallel lines */}
      {Array.from({ length: numLines }, (_, i) => {
        const y = VIZ_Y + i * lineSpacePx;
        return <line key={i} x1={VIZ_X} y1={y} x2={VIZ_X + VIZ_W} y2={y} stroke={COLORS.textTertiary} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />;
      })}

      {/* Needles */}
      {needleElements.map(({ key, x1, y1, x2, y2, crosses }) => (
        <line key={key} x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={crosses ? COLORS.error : 'rgba(100,100,100,0.45)'}
          strokeWidth={crosses ? 1.5 : 1}
          vectorEffect="non-scaling-stroke" />
      ))}

      {/* Legend */}
      <line x1={VIZ_X} y1={VIZ_Y + VIZ_H + 18} x2={VIZ_X + 20} y2={VIZ_Y + VIZ_H + 18} stroke={COLORS.error} strokeWidth={2} vectorEffect="non-scaling-stroke" />
      <text x={VIZ_X + 24} y={VIZ_Y + VIZ_H + 22} fontSize={14} fill={COLORS.textSecondary}>穿越线段</text>
      <line x1={VIZ_X + 110} y1={VIZ_Y + VIZ_H + 18} x2={VIZ_X + 130} y2={VIZ_Y + VIZ_H + 18} stroke="rgba(100,100,100,0.5)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={VIZ_X + 134} y={VIZ_Y + VIZ_H + 22} fontSize={14} fill={COLORS.textSecondary}>未穿越</text>

      {/* RIGHT: Convergence chart */}
      <text x={RML + RPW / 2} y={RMT - 10} textAnchor="middle" fontSize={14} fontWeight="bold" fill={COLORS.text}>
        π 估计值收敛过程
      </text>

      {/* Axes */}
      <line x1={RML} y1={RMT} x2={RML} y2={RMT + RPH} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <line x1={RML} y1={RMT + RPH} x2={VW - RMR} y2={RMT + RPH} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      <text x={RML + RPW / 2} y={RMT + RPH + 36} textAnchor="middle" fontSize={14} fill={COLORS.textSecondary}>投针数</text>
      <text x={0} y={0} textAnchor="middle" fontSize={14} fill={COLORS.textSecondary} transform={`translate(${RML - 40}, ${RMT + RPH / 2}) rotate(-90)`}>π 估计值</text>

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

      {/* π reference line */}
      <line x1={RML} y1={piY} x2={VW - RMR} y2={piY} stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
      <text x={VW - RMR + 4} y={piY + 4} fontSize={14} fill={COLORS.error}>π</text>

      {/* Running π estimate line */}
      <polyline points={linePoints} fill="none" stroke={COLORS.primary} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />

      {/* Principle text below needle visualization */}
      <text x={VIZ_X} y={VIZ_Y + VIZ_H + 44} fontSize={14} fill={COLORS.textSecondary}>
        原理: 针长l{'<'}线距d时，穿越概率 P = 2l/(πd)
      </text>
      <text x={VIZ_X} y={VIZ_Y + VIZ_H + 64} fontSize={14} fill={COLORS.textSecondary}>
        由此可得 π = 2l/(Pd)，通过大量投针估计P来逼近π
      </text>
    </svg>
  );
}
