import { COLORS } from '@/styles/tokens';
import type { PieChartResult } from '@/engine/simulations/pieChart';

const VW = 900, VH = 540;
const CX = 280, CY = 270;
const R_OUTER = 200, R_INNER = 50;
const LEGEND_X = 540, LEGEND_Y = 80;
const LEGEND_ROW_H = 30;
const LEGEND_TOP_PAD = 16;  // 标题与第一行 slice 的纵向间距

function polarToCart(cx: number, cy: number, r: number, angle: number): [number, number] {
  return [cx + r * Math.cos(angle - Math.PI / 2), cy + r * Math.sin(angle - Math.PI / 2)];
}

function arcPath(cx: number, cy: number, r: number, startAngle: number, endAngle: number, innerR = 0): string {
  const [sx, sy] = polarToCart(cx, cy, r, startAngle);
  const [ex, ey] = polarToCart(cx, cy, r, endAngle);
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  if (innerR > 0) {
    const [isx, isy] = polarToCart(cx, cy, innerR, endAngle);
    const [iex, iey] = polarToCart(cx, cy, innerR, startAngle);
    return `M ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} L ${isx} ${isy} A ${innerR} ${innerR} 0 ${largeArc} 0 ${iex} ${iey} Z`;
  }
  return `M ${cx} ${cy} L ${sx} ${sy} A ${r} ${r} 0 ${largeArc} 1 ${ex} ${ey} Z`;
}

export function PieChartRenderer({ result, datasetName }: { result: PieChartResult; datasetName: string }) {
  if (result.total === 0 || result.slices.length === 0) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <rect width={VW} height={VH} fill={COLORS.bg} />
        <text x={VW / 2} y={VH / 2} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>暂无数据</text>
      </svg>
    );
  }

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />
      <text x={VW / 2} y={32} textAnchor="middle" fontSize={15} fontWeight="bold" fill={COLORS.text}>
        扇形统计图 — {datasetName} (n={result.total})
      </text>

      {/* Pie slices */}
      {result.slices.map((slice, i) => {
        const path = arcPath(CX, CY, R_OUTER, slice.startAngle, slice.endAngle, R_INNER);
        const midAngle = (slice.startAngle + slice.endAngle) / 2;
        const [lx, ly] = polarToCart(CX, CY, R_OUTER * 0.7, midAngle);
        const percent = (slice.freq * 100).toFixed(1);
        return (
          <g key={i}>
            <path d={path} fill={slice.color} stroke={COLORS.white} strokeWidth={2} />
            {slice.freq > 0.05 && (
              <text x={lx} y={ly} textAnchor="middle" fontSize={12} fontWeight="bold" fill={COLORS.white}>
                {percent}%
              </text>
            )}
          </g>
        );
      })}

      {/* Center label */}
      <text x={CX} y={CY - 6} textAnchor="middle" fontSize={13} fill={COLORS.textSecondary}>总数</text>
      <text x={CX} y={CY + 14} textAnchor="middle" fontSize={20} fontWeight="bold" fill={COLORS.text}>{result.total}</text>

      {/* Legend */}
      <rect x={LEGEND_X - 12} y={LEGEND_Y - 34} width={VW - LEGEND_X} height={result.slices.length * LEGEND_ROW_H + 70}
        rx={8} fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={LEGEND_X} y={LEGEND_Y - 14} fontSize={13} fontWeight="bold" fill={COLORS.text}>各分组占比</text>
      {/* 标题下方分隔线，明确划界 */}
      <line
        x1={LEGEND_X - 8} y1={LEGEND_Y - 4}
        x2={VW - 20} y2={LEGEND_Y - 4}
        stroke={COLORS.border} strokeWidth={0.8} vectorEffect="non-scaling-stroke"
      />

      {result.slices.map((slice, i) => {
        const y = LEGEND_Y + LEGEND_TOP_PAD + i * LEGEND_ROW_H;
        return (
          <g key={i}>
            <rect x={LEGEND_X} y={y - 8} width={14} height={14} rx={3} fill={slice.color} />
            <text x={LEGEND_X + 20} y={y + 4} fontSize={11} fill={COLORS.text}>
              {slice.label}
              <tspan fill={COLORS.textMuted} fontSize={10}>
                {' '}· 频数 {slice.count} · 频率 {(slice.freq * 100).toFixed(1)}%
              </tspan>
            </text>
          </g>
        );
      })}

      {/* Footer */}
      <text x={LEGEND_X} y={LEGEND_Y + LEGEND_TOP_PAD + result.slices.length * LEGEND_ROW_H + 12} fontSize={11} fill={COLORS.textMuted}>
        均值={result.mean.toFixed(2)} · 范围=[{result.min.toFixed(1)}, {result.max.toFixed(1)}]
      </text>
    </svg>
  );
}
