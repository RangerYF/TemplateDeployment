import { COLORS } from '@/styles/tokens';
import { useTitrationStore } from '@/store';
import {
  VW, VH, ML, MT, PW, PH,
  px, py,
  ChartAxes, ChartTitle, YGrid, XTicks,
} from '@/utils/svgChartUtils';
import { IndicatorBands } from './IndicatorBands';
import { CurveAnnotations } from './CurveAnnotations';

const Y_MIN = 0;
const Y_MAX = 14;

export function TitrationCurveChart() {
  const curve = useTitrationStore((s) => s.curveData);
  const indicatorIds = useTitrationStore((s) => s.selectedIndicatorIds);

  if (!curve) return null;

  const xMin = 0;
  const xMax = curve.maxVolume;

  // Build polyline points string
  const polylinePoints = curve.points
    .map((p) => `${px(p.volume, xMin, xMax).toFixed(1)},${py(p.pH, Y_MIN, Y_MAX).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full h-full"
      style={{ fontFamily: "'Inter', 'PingFang SC', sans-serif" }}
    >
      {/* Grid */}
      <YGrid tickCount={14} yMin={Y_MIN} yMax={Y_MAX} format={(v) => v.toFixed(0)} />
      <XTicks tickCount={8} xMin={xMin} xMax={xMax} format={(v) => v.toFixed(0)} />

      {/* Axes */}
      <ChartAxes xLabel="滴加体积 / mL" yLabel="pH" />
      <ChartTitle title="pH 滴定曲线" />

      {/* Indicator bands (below curve) */}
      <IndicatorBands selectedIds={indicatorIds} yMin={Y_MIN} yMax={Y_MAX} />

      {/* Annotations */}
      <CurveAnnotations curve={curve} xMin={xMin} xMax={xMax} yMin={Y_MIN} yMax={Y_MAX} />

      {/* The curve itself */}
      <polyline
        points={polylinePoints}
        fill="none"
        stroke={COLORS.primary}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Plot area border (clip visual) */}
      <rect
        x={ML} y={MT} width={PW} height={PH}
        fill="none" stroke={COLORS.border} strokeWidth={0.5}
        rx={2}
      />
    </svg>
  );
}
