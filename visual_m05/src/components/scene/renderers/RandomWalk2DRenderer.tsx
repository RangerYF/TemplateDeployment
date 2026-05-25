import { COLORS } from '@/styles/tokens';
import type { RandomWalk2DResult } from '@/engine/simulations/randomWalk';

const VW = 920, VH = 580;
const PATH_COLORS = ['#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2'];

export function RandomWalk2DRenderer({ result, displayN }: { result: RandomWalk2DResult; displayN?: number }) {
  // 左侧：2D 路径图（正方形）  右侧：终点距离分布柱状图
  const MAP_X = 60, MAP_Y = 60, MAP_SIZE = 460;
  const DIST_X = 580, DIST_Y = 60, DIST_W = VW - DIST_X - 20, DIST_H = 460;

  // 动画支持：displayN 表示已生成到第几步
  const currentStep = displayN !== undefined ? Math.max(0, Math.min(displayN, result.steps)) : result.steps;
  const isAnimating = displayN !== undefined && currentStep < result.steps;
  // 路径截断（含起点 idx=0）
  const displayedPaths = result.samplePaths.map(p => ({
    positions: p.positions.slice(0, currentStep + 1),
  }));

  // 路径范围：基于 sample paths 的 bounds 扩展，让图居中
  const { xMin, xMax, yMin, yMax } = result.bounds;
  const range = Math.max(Math.abs(xMin), Math.abs(xMax), Math.abs(yMin), Math.abs(yMax), 5);
  const mapXMin = -range, mapXMax = range, mapYMin = -range, mapYMax = range;
  const mpx = (x: number) => MAP_X + ((x - mapXMin) / (mapXMax - mapXMin)) * MAP_SIZE;
  const mpy = (y: number) => MAP_Y + MAP_SIZE - ((y - mapYMin) / (mapYMax - mapYMin)) * MAP_SIZE;

  // 终点距离分布
  const distances = result.endDistances;
  const maxDist = Math.max(...distances, result.expectedEndDist * 1.5);
  const binCount = 30;
  const binWidth = maxDist / binCount;
  const bins = new Array(binCount).fill(0);
  for (const d of distances) {
    const idx = Math.min(binCount - 1, Math.floor(d / binWidth));
    bins[idx]++;
  }
  const maxBinFreq = Math.max(...bins.map(c => c / distances.length)) * 1.2 || 0.1;
  const dpx = (i: number) => DIST_X + (i / binCount) * DIST_W;
  const dpy = (freq: number) => DIST_Y + DIST_H - (freq / maxBinFreq) * DIST_H;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* 标题 */}
      <text x={20} y={28} fontSize={14} fontWeight="bold" fill={COLORS.text}>
        二维随机游走 · 步数 {result.steps} · 4 方向等概率
      </text>
      <text x={VW - 20} y={28} textAnchor="end" fontSize={12} fill={COLORS.textMuted}>
        累计模拟 {result.n} 次 · 终点距离均值 {result.meanEndDist.toFixed(2)}（理论 √(πn/2)={result.expectedEndDist.toFixed(2)}）
      </text>

      {/* 左：路径地图 */}
      <text x={MAP_X} y={MAP_Y - 8} fontSize={13} fontWeight={600} fill={COLORS.text}>
        前 {result.samplePaths.length} 条路径轨迹{isAnimating ? ` · 步 ${currentStep}/${result.steps}` : ''}
      </text>
      <rect x={MAP_X} y={MAP_Y} width={MAP_SIZE} height={MAP_SIZE} fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} />

      {/* 网格 */}
      {Array.from({ length: 11 }, (_, i) => i).map(i => {
        const v = mapXMin + (mapXMax - mapXMin) * i / 10;
        const x = mpx(v);
        const y = mpy(v);
        return (
          <g key={i}>
            <line x1={x} y1={MAP_Y} x2={x} y2={MAP_Y + MAP_SIZE} stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="2 4" opacity={0.5} shapeRendering="crispEdges" />
            <line x1={MAP_X} y1={y} x2={MAP_X + MAP_SIZE} y2={y} stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="2 4" opacity={0.5} shapeRendering="crispEdges" />
          </g>
        );
      })}

      {/* 坐标轴 */}
      <line x1={MAP_X} y1={mpy(0)} x2={MAP_X + MAP_SIZE} y2={mpy(0)} stroke={COLORS.textMuted} strokeWidth={1} shapeRendering="crispEdges" />
      <line x1={mpx(0)} y1={MAP_Y} x2={mpx(0)} y2={MAP_Y + MAP_SIZE} stroke={COLORS.textMuted} strokeWidth={1} shapeRendering="crispEdges" />

      {/* 路径折线 */}
      {displayedPaths.map((path, idx) => {
        if (path.positions.length < 2) return null;
        const points = path.positions.map(p => `${mpx(p.x).toFixed(1)},${mpy(p.y).toFixed(1)}`).join(' ');
        const endP = path.positions[path.positions.length - 1];
        return (
          <g key={idx}>
            <polyline points={points} fill="none"
              stroke={PATH_COLORS[idx % PATH_COLORS.length]} strokeWidth={1.2} opacity={isAnimating ? 0.85 : 0.7}
              vectorEffect="non-scaling-stroke" />
            {/* 终点 / 当前游走位置标记 */}
            <circle cx={mpx(endP.x)} cy={mpy(endP.y)} r={isAnimating ? 5 : 4}
              fill={PATH_COLORS[idx % PATH_COLORS.length]} stroke={COLORS.white} strokeWidth={1.5} />
          </g>
        );
      })}

      {/* 起点标记 */}
      <circle cx={mpx(0)} cy={mpy(0)} r={5} fill={COLORS.error} stroke={COLORS.white} strokeWidth={2} />
      <text x={mpx(0) + 10} y={mpy(0) - 6} fontSize={10} fontWeight={600} fill={COLORS.error}>起点 (0,0)</text>

      {/* 坐标标签 */}
      <text x={MAP_X + MAP_SIZE / 2} y={MAP_Y + MAP_SIZE + 18} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>X 坐标</text>
      <text x={MAP_X - 16} y={MAP_Y + MAP_SIZE / 2} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}
        transform={`rotate(-90, ${MAP_X - 16}, ${MAP_Y + MAP_SIZE / 2})`}>
        Y 坐标
      </text>

      {/* 右：终点距离分布 */}
      <text x={DIST_X} y={DIST_Y - 8} fontSize={13} fontWeight={600} fill={COLORS.text}>
        终点距离 √(x²+y²) 频率分布
      </text>
      <line x1={DIST_X} y1={DIST_Y + DIST_H} x2={DIST_X + DIST_W} y2={DIST_Y + DIST_H} stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />
      <line x1={DIST_X} y1={DIST_Y} x2={DIST_X} y2={DIST_Y + DIST_H} stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />

      {bins.map((count, i) => {
        const freq = count / distances.length;
        const bx = dpx(i);
        const bw = (DIST_W / binCount) - 1;
        const by = dpy(freq);
        return (
          <rect key={i} x={bx} y={by} width={Math.max(bw, 1)} height={Math.max(DIST_Y + DIST_H - by, 0.5)}
            fill={COLORS.primary} opacity={0.85} stroke={COLORS.primaryHover} strokeWidth={0.5}
            vectorEffect="non-scaling-stroke" />
        );
      })}

      {/* 期望线 */}
      <line x1={dpx(result.expectedEndDist / binWidth)} y1={DIST_Y} x2={dpx(result.expectedEndDist / binWidth)} y2={DIST_Y + DIST_H}
        stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="6 4" shapeRendering="crispEdges" />
      <text x={dpx(result.expectedEndDist / binWidth) + 4} y={DIST_Y + 14} fontSize={10} fontWeight={600} fill={COLORS.error}>
        理论 {result.expectedEndDist.toFixed(2)}
      </text>

      {/* X 刻度 */}
      {Array.from({ length: 6 }, (_, i) => Math.round((maxDist * i / 5) * 10) / 10).map((v) => (
        <text key={v} x={dpx((v / maxDist) * binCount)} y={DIST_Y + DIST_H + 14} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>{v.toFixed(1)}</text>
      ))}
      <text x={DIST_X + DIST_W / 2} y={DIST_Y + DIST_H + 30} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>距离</text>

      {/* Y 刻度 */}
      {Array.from({ length: 5 }, (_, i) => maxBinFreq * i / 4).map(v => (
        <text key={v} x={DIST_X - 6} y={dpy(v) + 4} textAnchor="end" fontSize={10} fill={COLORS.textMuted}>
          {(v * 100).toFixed(1)}%
        </text>
      ))}
    </svg>
  );
}
