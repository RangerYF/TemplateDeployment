const CHART_COLORS = [
  '#ef4444', // 红
  '#3b82f6', // 蓝
  '#22c55e', // 绿
  '#f59e0b', // 橙
  '#8b5cf6', // 紫
  '#06b6d4', // 青
  '#ec4899', // 粉
  '#6366f1', // 靛
]

export function getChartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}
