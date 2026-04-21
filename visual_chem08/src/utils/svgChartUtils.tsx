import { COLORS } from '@/styles/tokens';

/** Standard chart layout constants */
export const VW = 800;  // viewBox width
export const VH = 500;  // viewBox height
export const ML = 68;   // margin left
export const MT = 44;   // margin top
export const MR = 24;   // margin right
export const MB = 52;   // margin bottom
export const PW = VW - ML - MR;  // plot width
export const PH = VH - MT - MB;  // plot height

/** Map data value to SVG x coordinate */
export function px(v: number, vMin: number, vMax: number, plotLeft = ML, plotWidth = PW): number {
  if (vMax === vMin) return plotLeft + plotWidth / 2;
  return plotLeft + ((v - vMin) / (vMax - vMin)) * plotWidth;
}

/** Map data value to SVG y coordinate (inverted — data y=0 is at bottom) */
export function py(v: number, vMin: number, vMax: number, plotTop = MT, plotHeight = PH): number {
  if (vMax === vMin) return plotTop + plotHeight / 2;
  return plotTop + plotHeight - ((v - vMin) / (vMax - vMin)) * plotHeight;
}

/** Common chart axes JSX (Y axis + X axis lines) */
export function ChartAxes({
  ml = ML, mt = MT, mr = MR, mb = MB,
  vw = VW, vh = VH,
  xLabel, yLabel,
}: {
  ml?: number; mt?: number; mr?: number; mb?: number;
  vw?: number; vh?: number;
  xLabel?: string; yLabel?: string;
}) {
  const pw = vw - ml - mr;
  const ph = vh - mt - mb;
  return (
    <>
      {/* Y axis */}
      <line x1={ml} y1={mt} x2={ml} y2={mt + ph} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {/* X axis */}
      <line x1={ml} y1={mt + ph} x2={ml + pw} y2={mt + ph} stroke={COLORS.borderStrong} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {/* X label */}
      {xLabel && (
        <text x={ml + pw / 2} y={vh - 4} textAnchor="middle" fontSize={14} fill={COLORS.textSecondary}>
          {xLabel}
        </text>
      )}
      {/* Y label (rotated) */}
      {yLabel && (
        <text
          x={0} y={0}
          textAnchor="middle" fontSize={14} fill={COLORS.textSecondary}
          transform={`translate(14, ${mt + ph / 2}) rotate(-90)`}
        >
          {yLabel}
        </text>
      )}
    </>
  );
}

/** Horizontal dashed reference line */
export function DashedHLine({
  x1, x2, y, color, strokeWidth = 1.5,
}: {
  x1: number; x2: number; y: number; color: string; strokeWidth?: number;
}) {
  return (
    <line
      x1={x1} y1={y} x2={x2} y2={y}
      stroke={color} strokeWidth={strokeWidth}
      strokeDasharray="6 4"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** Vertical dashed line */
export function DashedVLine({
  x, y1, y2, color, strokeWidth = 1.5,
}: {
  x: number; y1: number; y2: number; color: string; strokeWidth?: number;
}) {
  return (
    <line
      x1={x} y1={y1} x2={x} y2={y2}
      stroke={color} strokeWidth={strokeWidth}
      strokeDasharray="6 4"
      vectorEffect="non-scaling-stroke"
    />
  );
}

/** Y-axis grid lines + tick labels */
export function YGrid({
  tickCount = 5, yMin, yMax,
  ml = ML, mt = MT, mr = MR, mb = MB,
  vw = VW, vh = VH,
  format = (v: number) => v.toFixed(1),
}: {
  tickCount?: number; yMin: number; yMax: number;
  ml?: number; mt?: number; mr?: number; mb?: number;
  vw?: number; vh?: number;
  format?: (v: number) => string;
}) {
  const pw = vw - ml - mr;
  const ph = vh - mt - mb;
  return (
    <>
      {Array.from({ length: tickCount + 1 }, (_, i) => {
        const v = yMin + (yMax - yMin) * i / tickCount;
        const y = mt + ph - ph * i / tickCount;
        return (
          <g key={i}>
            <line x1={ml} y1={y} x2={ml + pw} y2={y}
              stroke={COLORS.border} strokeWidth={0.8}
              strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
            <text x={ml - 6} y={y + 4} textAnchor="end" fontSize={12} fill={COLORS.textMuted}>
              {format(v)}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** X-axis tick labels */
export function XTicks({
  tickCount = 5, xMin, xMax,
  ml = ML, mb = MB,
  vw = VW, vh = VH,
  format = (v: number) => v.toFixed(0),
}: {
  tickCount?: number; xMin: number; xMax: number;
  ml?: number; mb?: number;
  vw?: number; vh?: number;
  format?: (v: number) => string;
}) {
  const plotWidth = vw - ml - 24; // MR=24
  const plotBottom = vh - mb;
  return (
    <>
      {Array.from({ length: tickCount + 1 }, (_, i) => {
        const v = xMin + (xMax - xMin) * i / tickCount;
        const x = ml + (plotWidth) * i / tickCount;
        return (
          <g key={i}>
            <line x1={x} y1={plotBottom} x2={x} y2={plotBottom + 4}
              stroke={COLORS.borderStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={x} y={plotBottom + 16} textAnchor="middle" fontSize={12} fill={COLORS.textMuted}>
              {format(v)}
            </text>
          </g>
        );
      })}
    </>
  );
}

/** Chart title */
export function ChartTitle({ title, vw = VW, ml = ML, mr = MR, mt = MT }: {
  title: string; vw?: number; ml?: number; mr?: number; mt?: number;
}) {
  return (
    <text
      x={ml + (vw - ml - mr) / 2} y={mt - 10}
      textAnchor="middle" fontSize={16} fontWeight="bold" fill={COLORS.text}
    >
      {title}
    </text>
  );
}
