import { COLORS } from '@/styles/tokens';
import { useComparisonStore, CURVE_COLORS } from '@/store';
import { getPreset } from '@/data/titrationPresets';
import {
  VW, VH, ML, MT, PW, PH,
  px, py,
  ChartAxes, ChartTitle, YGrid, XTicks,
} from '@/utils/svgChartUtils';

const Y_MIN = 0;
const Y_MAX = 14;

export function ComparisonChart() {
  const selectedTypes = useComparisonStore((s) => s.selectedTypes);
  const curves = useComparisonStore((s) => s.curves);

  if (selectedTypes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: COLORS.textMuted }}>
        请在左侧选择至少一种滴定类型进行对比
      </div>
    );
  }

  // Find max volume across all curves
  const maxVol = Math.max(
    ...selectedTypes.map((t) => curves[t]?.maxVolume ?? 40),
  );
  const xMin = 0;
  const xMax = maxVol;

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      style={{ fontFamily: "'Inter', 'PingFang SC', sans-serif" }}
    >
      <YGrid tickCount={14} yMin={Y_MIN} yMax={Y_MAX} format={(v) => v.toFixed(0)} />
      <XTicks tickCount={8} xMin={xMin} xMax={xMax} format={(v) => v.toFixed(0)} />
      <ChartAxes xLabel="滴加体积 / mL" yLabel="pH" />
      <ChartTitle title="滴定曲线对比" />

      {/* pH=7 reference line */}
      <line
        x1={ML} y1={py(7, Y_MIN, Y_MAX)}
        x2={ML + PW} y2={py(7, Y_MIN, Y_MAX)}
        stroke={COLORS.textTertiary} strokeWidth={1}
        strokeDasharray="6 4" vectorEffect="non-scaling-stroke"
      />

      {/* Curves */}
      {selectedTypes.map((type, idx) => {
        const curve = curves[type];
        if (!curve) return null;
        const color = CURVE_COLORS[idx] || COLORS.primary;

        const polylinePoints = curve.points
          .map((p) => `${px(p.volume, xMin, xMax).toFixed(1)},${py(p.pH, Y_MIN, Y_MAX).toFixed(1)}`)
          .join(' ');

        return (
          <g key={type}>
            <polyline
              points={polylinePoints}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
            {/* Equivalence point dot */}
            <circle
              cx={px(curve.eqVolume, xMin, xMax)}
              cy={py(curve.eqPH, Y_MIN, Y_MAX)}
              r={4}
              fill={color}
            />
          </g>
        );
      })}

      {/* Legend */}
      {selectedTypes.map((type, idx) => {
        const preset = getPreset(type);
        const color = CURVE_COLORS[idx] || COLORS.primary;
        const legendY = MT + 8 + idx * 18;
        return (
          <g key={type}>
            <line
              x1={ML + PW - 140} y1={legendY}
              x2={ML + PW - 120} y2={legendY}
              stroke={color} strokeWidth={2.5}
            />
            <text
              x={ML + PW - 116} y={legendY + 4}
              fontSize={13} fill={COLORS.text}
            >
              {preset.label}
            </text>
          </g>
        );
      })}

      {/* Plot border */}
      <rect
        x={ML} y={MT} width={PW} height={PH}
        fill="none" stroke={COLORS.border} strokeWidth={0.5}
        rx={2}
      />
    </svg>
  );
}
