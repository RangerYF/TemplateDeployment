import { COLORS } from '@/styles/tokens';
import type { StemLeafResult } from '@/engine/simulations/stemLeaf';

const VW = 900, VH = 580;
const TABLE_X = 60, TABLE_Y = 60;
const STEM_COL_W = 56, SEP_W = 8, LEAF_COL_X = TABLE_X + STEM_COL_W + SEP_W;
const LEAF_CHAR_W = 14;
const MAX_TABLE_H = VH - TABLE_Y - 100;
const STATS_X = 680, STATS_Y = TABLE_Y;

export function StemLeafRenderer({ result }: { result: StemLeafResult }) {
  if (result.n === 0) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <rect width={VW} height={VH} fill={COLORS.bg} />
        <text x={VW / 2} y={VH / 2} textAnchor="middle" fontSize={14} fill={COLORS.textMuted}>暂无数据</text>
      </svg>
    );
  }

  const numRows = result.rows.length;
  const rowHeight = Math.min(32, Math.max(16, Math.floor(MAX_TABLE_H / Math.max(numRows, 1))));
  const tableH = numRows * rowHeight;
  const maxLeaves = Math.max(...result.rows.map(r => r.leaves.length));

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* Title */}
      <text x={TABLE_X + (STATS_X - TABLE_X) / 2} y={36} textAnchor="middle" fontSize={14} fontWeight="bold" fill={COLORS.text}>
        茎叶图 (n={result.n})
      </text>

      {/* Header */}
      <text x={TABLE_X + STEM_COL_W / 2} y={TABLE_Y - 8} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>茎</text>
      <text x={LEAF_COL_X + maxLeaves * LEAF_CHAR_W / 2} y={TABLE_Y - 8} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>叶</text>

      {/* Table background */}
      <rect x={TABLE_X - 4} y={TABLE_Y} width={STEM_COL_W + SEP_W + Math.max(maxLeaves * LEAF_CHAR_W, 40) + 8} height={tableH}
        fill={COLORS.bgMuted} rx={4} />

      {/* Rows */}
      {result.rows.map((row, i) => {
        const ry = TABLE_Y + i * rowHeight;
        const isOdd = i % 2 === 1;
        const stemLabel = row.subLabel ? `${row.stem}${row.subLabel}` : row.stem;
        return (
          <g key={i}>
            {isOdd && (
              <rect x={TABLE_X - 4} y={ry} width={STEM_COL_W + SEP_W + Math.max(maxLeaves * LEAF_CHAR_W, 40) + 8} height={rowHeight}
                fill={COLORS.primaryLight} opacity={0.3} />
            )}
            {/* Stem */}
            <text x={TABLE_X + STEM_COL_W - 6} y={ry + rowHeight * 0.65}
              textAnchor="end" fontSize={Math.min(13, rowHeight * 0.6)} fontWeight="600" fill={COLORS.primary}>
              {stemLabel}
            </text>
            {/* Separator */}
            <line x1={TABLE_X + STEM_COL_W} y1={ry + 2} x2={TABLE_X + STEM_COL_W} y2={ry + rowHeight - 2}
              stroke={COLORS.border} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
            {/* Leaves */}
            <text x={LEAF_COL_X + 4} y={ry + rowHeight * 0.65}
              fontSize={Math.min(12, rowHeight * 0.55)} fill={COLORS.text} fontFamily="monospace">
              {row.leaves.join('  ')}
            </text>
          </g>
        );
      })}

      {/* Table border */}
      <rect x={TABLE_X - 4} y={TABLE_Y} width={STEM_COL_W + SEP_W + Math.max(maxLeaves * LEAF_CHAR_W, 40) + 8} height={tableH}
        fill="none" stroke={COLORS.border} strokeWidth={1} rx={4} vectorEffect="non-scaling-stroke" />

      {/* Key */}
      <text x={TABLE_X} y={TABLE_Y + tableH + 24} fontSize={11} fill={COLORS.textMuted}>
        说明: {result.keyExample}
      </text>

      {/* Stats panel */}
      <rect x={STATS_X} y={STATS_Y} width={VW - STATS_X - 20} height={200} rx={8}
        fill={COLORS.bg} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={STATS_X + 10} y={STATS_Y + 22} fontSize={13} fontWeight="bold" fill={COLORS.text}>统计量</text>
      {[
        ['数据量', `${result.n}`],
        ['均值', result.mean.toFixed(result.precision === 0 ? 1 : result.precision + 1)],
        ['中位数', result.median.toFixed(result.precision === 0 ? 1 : result.precision + 1)],
        ['最小值', result.min.toFixed(result.precision)],
        ['最大值', result.max.toFixed(result.precision)],
        ['极差', result.range.toFixed(result.precision)],
      ].map(([label, value], i) => (
        <g key={i}>
          <text x={STATS_X + 10} y={STATS_Y + 46 + i * 24} fontSize={11} fill={COLORS.textMuted}>{label}</text>
          <text x={VW - 30} y={STATS_Y + 46 + i * 24} textAnchor="end" fontSize={12} fontWeight="bold" fill={COLORS.text}>{value}</text>
        </g>
      ))}
    </svg>
  );
}
