import { P13PanelCard, P13_SHELL_COLORS } from './P13WorkbenchShell';

interface TimeSeriesPoint {
  time: number;
  value: number;
}

interface P13TimeSeriesChartProps {
  title: string;
  unit: string;
  color: string;
  formula?: string;
  samples: TimeSeriesPoint[];
  currentTime: number;
  currentValue: number;
}

const CHART_WIDTH = 360;
const CHART_HEIGHT = 188;
const PADDING = { left: 50, right: 16, top: 16, bottom: 34 };

function formatTick(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 100) return value.toFixed(0);
  if (abs >= 10) return value.toFixed(1);
  if (abs >= 1) return value.toFixed(2);
  return value.toFixed(3);
}

function formatTimeTick(value: number, xMax: number): string {
  if (xMax < 0.2) {
    return `${(value * 1000).toFixed(xMax < 0.02 ? 2 : 1)}ms`;
  }
  return `${value.toFixed(1)}s`;
}

export function P13TimeSeriesChart({
  title,
  unit,
  color,
  formula,
  samples,
  currentTime,
  currentValue,
}: P13TimeSeriesChartProps) {
  const safeSamples = samples.length > 0 ? samples : [{ time: 0, value: 0 }];
  const xMax = safeSamples[safeSamples.length - 1]!.time || 1;
  const values = safeSamples.map((sample) => sample.value);
  const rawMin = Math.min(0, ...values);
  const rawMax = Math.max(0, ...values);
  const rawSpan = rawMax - rawMin;
  const paddedSpan = rawSpan <= 1e-6 ? 1 : rawSpan * 0.12;
  const yMin = rawSpan <= 1e-6 ? rawMin - 0.5 : rawMin - paddedSpan;
  const yMax = rawSpan <= 1e-6 ? rawMax + 0.5 : rawMax + paddedSpan;

  const innerWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  const scaleX = (time: number) => PADDING.left + (time / xMax) * innerWidth;
  const scaleY = (value: number) => {
    const ratio = (value - yMin) / Math.max(1e-6, yMax - yMin);
    return CHART_HEIGHT - PADDING.bottom - (ratio * innerHeight);
  };

  const polylinePoints = safeSamples
    .map((sample) => `${scaleX(sample.time)},${scaleY(sample.value)}`)
    .join(' ');

  const zeroY = scaleY(0);
  const currentX = scaleX(Math.min(xMax, Math.max(0, currentTime)));
  const currentY = scaleY(currentValue);
  const xTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return ratio * xMax;
  });
  const yTicks = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    return yMin + ((yMax - yMin) * ratio);
  });

  return (
    <P13PanelCard title={title} subtitle={formula ? `公式口径：${formula}` : undefined}>
      <svg
        viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
        style={{ width: '100%', display: 'block' }}
        aria-label={`${title} 图表`}
      >
        <rect
          x="0"
          y="0"
          width={CHART_WIDTH}
          height={CHART_HEIGHT}
          rx="18"
          fill="#FFFFFF"
        />

        {yTicks.map((tick) => {
          const y = scaleY(tick);
          return (
            <g key={`y-${tick}`}>
              <line
                x1={PADDING.left}
                y1={y}
                x2={CHART_WIDTH - PADDING.right}
                y2={y}
                stroke="#E5E7EB"
                strokeDasharray="4 4"
              />
              <text
                x={PADDING.left - 8}
                y={y + 4}
                fill={P13_SHELL_COLORS.muted}
                fontSize="10"
                textAnchor="end"
              >
                {formatTick(tick)}
              </text>
            </g>
          );
        })}

        {xTicks.map((tick) => {
          const x = scaleX(tick);
          return (
            <g key={`x-${tick}`}>
              <line
                x1={x}
                y1={PADDING.top}
                x2={x}
                y2={CHART_HEIGHT - PADDING.bottom}
                stroke="#F3F4F6"
              />
              <text
                x={x}
                y={CHART_HEIGHT - 10}
                fill={P13_SHELL_COLORS.muted}
                fontSize="10"
                textAnchor="middle"
              >
                {formatTimeTick(tick, xMax)}
              </text>
            </g>
          );
        })}

        <line
          x1={PADDING.left}
          y1={zeroY}
          x2={CHART_WIDTH - PADDING.right}
          y2={zeroY}
          stroke="#CBD5E1"
          strokeWidth="1.5"
        />
        <line
          x1={PADDING.left}
          y1={PADDING.top}
          x2={PADDING.left}
          y2={CHART_HEIGHT - PADDING.bottom}
          stroke="#CBD5E1"
          strokeWidth="1.5"
        />

        <polyline
          points={polylinePoints}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        <line
          x1={currentX}
          y1={PADDING.top}
          x2={currentX}
          y2={CHART_HEIGHT - PADDING.bottom}
          stroke={color}
          strokeDasharray="6 4"
          opacity="0.6"
        />
        <circle cx={currentX} cy={currentY} r="5" fill={color} />

        <text
          x={PADDING.left}
          y="12"
          fill={P13_SHELL_COLORS.secondary}
          fontSize="11"
        >
          单位：{unit}
        </text>
      </svg>
    </P13PanelCard>
  );
}
