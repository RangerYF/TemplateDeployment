import { COLORS } from '@/styles/tokens';
import type { RandomWalk1DResult } from '@/engine/simulations/randomWalk';
import { theoreticalRW1DProb } from '@/engine/simulations/randomWalk';

const VW = 920, VH = 580;
const PATH_COLORS = ['#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2'];

export function RandomWalk1DRenderer({ result, displayN }: { result: RandomWalk1DResult; displayN?: number }) {
  // 上部：路径图  下部：终点分布
  const PATH_X = 60, PATH_Y = 60, PATH_W = VW - 100, PATH_H = 220;
  const DIST_X = 60, DIST_Y = 340, DIST_W = VW - 100, DIST_H = 200;

  // 动画支持：displayN 表示已生成到第几步（[0, steps]），未传则显示完整路径
  const currentStep = displayN !== undefined ? Math.max(0, Math.min(displayN, result.steps)) : result.steps;
  const isAnimating = displayN !== undefined && currentStep < result.steps;

  // 截断路径到当前步数（含起点 idx=0）
  const displayedPaths = result.samplePaths.map(p => ({
    positions: p.positions.slice(0, currentStep + 1),
  }));

  // 路径图 Y 范围（用全路径范围，避免动画时 y 轴跳动）
  const allPathPositions = result.samplePaths.flatMap(p => p.positions);
  const yMin = Math.min(...allPathPositions, -1);
  const yMax = Math.max(...allPathPositions, 1);
  const yPad = Math.max(2, (yMax - yMin) * 0.1);
  const pyMin = yMin - yPad, pyMax = yMax + yPad;
  const ppx = (i: number) => PATH_X + (i / result.steps) * PATH_W;
  const ppy = (v: number) => PATH_Y + PATH_H - ((v - pyMin) / (pyMax - pyMin)) * PATH_H;

  // 终点分布：覆盖所有出现位置 + 一些理论范围
  const allEnds = result.endPositions;
  const minEnd = Math.min(...allEnds);
  const maxEnd = Math.max(...allEnds);
  // 让 x 轴对称围绕期望
  const distRange = Math.max(Math.abs(minEnd), Math.abs(maxEnd), Math.ceil(result.expectedStd * 3));
  const distXMin = result.expectedEnd - distRange;
  const distXMax = result.expectedEnd + distRange;

  // 收集每个 even/odd 位置的模拟频率 + 理论概率
  const validPositions: number[] = [];
  // 1D 随机游走 n 步后位置奇偶性必须与 n 同奇偶
  const positionParity = result.steps % 2;
  for (let k = Math.ceil(distXMin); k <= Math.floor(distXMax); k++) {
    if (((k % 2) + 2) % 2 === positionParity) validPositions.push(k);
  }
  const observedAt = new Map(result.endDistribution);
  const theoryAt: number[] = validPositions.map(k => theoreticalRW1DProb(result.steps, result.pRight, k));
  const maxBarY = Math.max(
    0.01,
    ...validPositions.map(k => observedAt.get(k) ?? 0),
    ...theoryAt,
  ) * 1.2;

  const dpx = (v: number) => DIST_X + ((v - distXMin) / (distXMax - distXMin)) * DIST_W;
  const dpy = (v: number) => DIST_Y + DIST_H - (v / maxBarY) * DIST_H;
  const barW = Math.max(2, (DIST_W / validPositions.length) * 0.4);

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* 标题 */}
      <text x={20} y={28} fontSize={14} fontWeight="bold" fill={COLORS.text}>
        一维随机游走 · 步数 {result.steps} · 向右概率 p={result.pRight.toFixed(3)}
      </text>
      <text x={VW - 20} y={28} textAnchor="end" fontSize={12} fill={COLORS.textMuted}>
        累计模拟 {result.endPositions.length} 次 · 终点均值 {result.meanEnd.toFixed(2)}（理论 {result.expectedEnd.toFixed(2)}）
      </text>

      {/* 上半：路径图 */}
      <text x={PATH_X} y={PATH_Y - 8} fontSize={13} fontWeight={600} fill={COLORS.text}>
        前 {result.samplePaths.length} 条路径{isAnimating ? ` · 步 ${currentStep}/${result.steps}` : ''}
      </text>
      <line x1={PATH_X} y1={PATH_Y + PATH_H} x2={PATH_X + PATH_W} y2={PATH_Y + PATH_H} stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />
      <line x1={PATH_X} y1={PATH_Y} x2={PATH_X} y2={PATH_Y + PATH_H} stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />

      {/* 零线 */}
      <line x1={PATH_X} y1={ppy(0)} x2={PATH_X + PATH_W} y2={ppy(0)}
        stroke={COLORS.textMuted} strokeWidth={1} strokeDasharray="4 4" shapeRendering="crispEdges" />

      {/* 期望线 ±2σ 区间 */}
      {[-2, -1, 1, 2].map(k => {
        const v = k * Math.sqrt(result.steps * result.pRight * (1 - result.pRight)) * 2 + result.expectedEnd;
        if (v < pyMin || v > pyMax) return null;
        return (
          <line key={k} x1={PATH_X} y1={ppy(v)} x2={PATH_X + PATH_W} y2={ppy(v)}
            stroke={COLORS.error} strokeWidth={0.8} strokeDasharray="2 4" opacity={0.4} shapeRendering="crispEdges" />
        );
      })}

      {/* 路径折线 */}
      {displayedPaths.map((path, idx) => {
        if (path.positions.length < 2) return null;
        const points = path.positions.map((v, i) => `${ppx(i).toFixed(1)},${ppy(v).toFixed(1)}`).join(' ');
        const lastPos = path.positions[path.positions.length - 1];
        return (
          <g key={idx}>
            <polyline points={points} fill="none"
              stroke={PATH_COLORS[idx % PATH_COLORS.length]} strokeWidth={1.5} opacity={0.85}
              vectorEffect="non-scaling-stroke" />
            {/* 动画时显示当前游走点（路径末端） */}
            {isAnimating && (
              <circle cx={ppx(path.positions.length - 1)} cy={ppy(lastPos)} r={4}
                fill={PATH_COLORS[idx % PATH_COLORS.length]} stroke={COLORS.white} strokeWidth={1.5} />
            )}
          </g>
        );
      })}

      {/* Y 轴标签 */}
      {Array.from({ length: 5 }, (_, i) => pyMin + (pyMax - pyMin) * i / 4).map(v => (
        <text key={v} x={PATH_X - 6} y={ppy(v) + 4} textAnchor="end" fontSize={10} fill={COLORS.textMuted}>
          {Math.round(v)}
        </text>
      ))}
      {/* X 轴标签 */}
      {Array.from({ length: 6 }, (_, i) => Math.round(result.steps * i / 5)).map(s => (
        <text key={s} x={ppx(s)} y={PATH_Y + PATH_H + 14} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>
          {s}
        </text>
      ))}
      <text x={PATH_X + PATH_W / 2} y={PATH_Y + PATH_H + 30} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>步数</text>
      <text x={PATH_X - 30} y={PATH_Y + PATH_H / 2} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}
        transform={`rotate(-90, ${PATH_X - 30}, ${PATH_Y + PATH_H / 2})`}>
        位置
      </text>

      {/* 下半：终点分布 */}
      <text x={DIST_X} y={DIST_Y - 8} fontSize={13} fontWeight={600} fill={COLORS.text}>
        {result.steps} 步后终点位置频率分布（vs 二项分布理论概率）
      </text>
      <line x1={DIST_X} y1={DIST_Y + DIST_H} x2={DIST_X + DIST_W} y2={DIST_Y + DIST_H} stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />
      <line x1={DIST_X} y1={DIST_Y} x2={DIST_X} y2={DIST_Y + DIST_H} stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />

      {/* 柱状 */}
      {validPositions.map((k, idx) => {
        const obs = observedAt.get(k) ?? 0;
        const theory = theoryAt[idx];
        const bxCenter = dpx(k);
        const bx1 = bxCenter - barW - 1;
        const bx2 = bxCenter + 1;
        const bh1 = (obs / maxBarY) * DIST_H;
        const bh2 = (theory / maxBarY) * DIST_H;
        return (
          <g key={k}>
            <rect x={bx1} y={DIST_Y + DIST_H - bh1} width={barW} height={Math.max(bh1, 0.5)} rx={1} fill={COLORS.primary} opacity={0.85} />
            <rect x={bx2} y={DIST_Y + DIST_H - bh2} width={barW} height={Math.max(bh2, 0.5)} rx={1} fill="none" stroke={COLORS.error} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
          </g>
        );
      })}

      {/* X 刻度 */}
      {Array.from({ length: 9 }, (_, i) => Math.round(distXMin + (distXMax - distXMin) * i / 8)).map(k => (
        <text key={`xk-${k}`} x={dpx(k)} y={DIST_Y + DIST_H + 14} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>{k}</text>
      ))}
      <text x={DIST_X + DIST_W / 2} y={DIST_Y + DIST_H + 30} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>终点位置</text>

      {/* Y 刻度 */}
      {Array.from({ length: 5 }, (_, i) => maxBarY * i / 4).map(v => (
        <text key={v} x={DIST_X - 6} y={dpy(v) + 4} textAnchor="end" fontSize={10} fill={COLORS.textMuted}>
          {(v * 100).toFixed(1)}%
        </text>
      ))}

      {/* 图例 */}
      <g transform={`translate(${VW - 240}, ${DIST_Y + 4})`}>
        <rect x={0} y={0} width={12} height={8} fill={COLORS.primary} opacity={0.85} />
        <text x={16} y={8} fontSize={10} fill={COLORS.textSecondary}>模拟频率</text>
        <rect x={86} y={0} width={12} height={8} fill="none" stroke={COLORS.error} strokeWidth={1.2} />
        <text x={102} y={8} fontSize={10} fill={COLORS.textSecondary}>理论概率（二项分布）</text>
      </g>
    </svg>
  );
}
