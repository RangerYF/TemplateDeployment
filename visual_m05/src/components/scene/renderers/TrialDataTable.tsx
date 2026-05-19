/**
 * 共享子组件：在古典模型渲染器的右侧绘制"实验数据表"。
 * 表格随 displayN 实时更新，展示频数/频率/理论概率等数据处理过程。
 */
import { COLORS } from '@/styles/tokens';

export interface DataTableRow {
  label: string;
  count: number;
  freq: number;
  theoreticalProb?: number;
  color?: string;
}

export interface TrialDataTableProps {
  x: number;
  y: number;
  width: number;
  rows: DataTableRow[];
  title: string;
  /** 当前已观测数量（用于显示在标题中） */
  totalObserved: number;
  /** 列宽配置，默认值适配大多数场景 */
  rowHeight?: number;
  /** 显示理论概率列（若任一行有 theoreticalProb 则默认 true） */
  showTheory?: boolean;
}

export function TrialDataTable({
  x, y, width, rows, title, totalObserved,
  rowHeight = 24,
  showTheory,
}: TrialDataTableProps) {
  const hasTheory = showTheory ?? rows.some(r => r.theoreticalProb !== undefined);
  const headerH = 26;
  const summaryH = 30;
  const tableH = headerH + rows.length * rowHeight + summaryH + 12;

  // Column layout
  const labelW = 0.36 * width;
  const countW = 0.18 * width;
  const freqW = 0.20 * width;

  return (
    <g transform={`translate(${x}, ${y})`}>
      {/* Background */}
      <rect x={0} y={0} width={width} height={tableH} rx={8}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />

      {/* Title */}
      <text x={8} y={16} fontSize={12} fontWeight="bold" fill={COLORS.text}>
        {title}
      </text>
      <text x={width - 8} y={16} textAnchor="end" fontSize={10} fill={COLORS.textMuted}>
        当前 n = {totalObserved}
      </text>

      {/* Header */}
      <g transform={`translate(0, ${headerH})`}>
        <rect x={0} y={0} width={width} height={20}
          fill={COLORS.bgMuted} stroke={COLORS.border} strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
        <text x={6} y={14} fontSize={10} fontWeight="bold" fill={COLORS.textSecondary}>结果</text>
        <text x={labelW + countW - 6} y={14} textAnchor="end" fontSize={10} fontWeight="bold" fill={COLORS.textSecondary}>频数</text>
        <text x={labelW + countW + freqW - 6} y={14} textAnchor="end" fontSize={10} fontWeight="bold" fill={COLORS.textSecondary}>频率</text>
        {hasTheory && (
          <text x={width - 6} y={14} textAnchor="end" fontSize={10} fontWeight="bold" fill={COLORS.textSecondary}>理论</text>
        )}
      </g>

      {/* Rows */}
      {rows.map((row, i) => {
        const ry = headerH + 20 + i * rowHeight;
        const isOdd = i % 2 === 1;
        return (
          <g key={row.label} transform={`translate(0, ${ry})`}>
            {isOdd && (
              <rect x={0} y={0} width={width} height={rowHeight} fill={COLORS.bgMuted} opacity={0.4} />
            )}
            {row.color && (
              <rect x={6} y={rowHeight / 2 - 5} width={10} height={10} rx={2} fill={row.color} />
            )}
            <text x={row.color ? 22 : 6} y={rowHeight / 2 + 4} fontSize={11} fill={COLORS.text}>
              {row.label}
            </text>
            <text x={labelW + countW - 6} y={rowHeight / 2 + 4} textAnchor="end" fontSize={11} fontWeight={600} fill={COLORS.text}>
              {row.count}
            </text>
            <text x={labelW + countW + freqW - 6} y={rowHeight / 2 + 4} textAnchor="end" fontSize={11} fontWeight={600} fill={COLORS.primary}>
              {row.freq.toFixed(4)}
            </text>
            {hasTheory && row.theoreticalProb !== undefined && (
              <text x={width - 6} y={rowHeight / 2 + 4} textAnchor="end" fontSize={11} fill={COLORS.error}>
                {row.theoreticalProb.toFixed(4)}
              </text>
            )}
          </g>
        );
      })}

      {/* Summary footer */}
      <g transform={`translate(0, ${headerH + 20 + rows.length * rowHeight + 4})`}>
        <line x1={0} y1={0} x2={width} y2={0} stroke={COLORS.border} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />
        <text x={6} y={16} fontSize={10} fill={COLORS.textMuted}>合计</text>
        <text x={labelW + countW - 6} y={16} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.text}>
          {rows.reduce((s, r) => s + r.count, 0)}
        </text>
        <text x={labelW + countW + freqW - 6} y={16} textAnchor="end" fontSize={11} fontWeight="bold" fill={COLORS.text}>
          1.0000
        </text>
      </g>
    </g>
  );
}
