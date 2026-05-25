import { COLORS } from '@/styles/tokens';
import type { MarkovChainResult } from '@/engine/simulations/markovChain';

const VW = 920, VH = 580;
const STATE_COLORS = ['#00C06B', '#1890FF', '#FAAD14', '#FF4D4F', '#722ED1', '#13C2C2'];

export function MarkovChainRenderer({ result, displayN }: { result: MarkovChainResult; displayN?: number }) {
  // 动画支持：displayN 表示已演化到第几步（[0, steps]），未传则显示完整
  const currentStep = displayN !== undefined ? Math.max(0, Math.min(displayN, result.steps)) : result.steps;
  const isAnimating = displayN !== undefined && currentStep < result.steps;
  // 当前显示的分布（按步截断）
  const displayDistribution = result.distribution.slice(0, currentStep + 1);
  const currentEndDist = displayDistribution.length > 0
    ? displayDistribution[displayDistribution.length - 1]
    : result.finalDistribution;
  // 校验失败时显示提示
  if (!result.valid) {
    return (
      <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
        <rect width={VW} height={VH} fill={COLORS.bg} />
        <text x={VW / 2} y={VH / 2 - 16} textAnchor="middle" fontSize={16} fontWeight={600} fill={COLORS.error}>
          参数无效
        </text>
        <text x={VW / 2} y={VH / 2 + 8} textAnchor="middle" fontSize={13} fill={COLORS.textMuted}>
          {result.invalidReason ?? '请检查转移矩阵与初始分布'}
        </text>
      </svg>
    );
  }

  const N = result.states.length;

  // ─── 顶部：转移矩阵 + 状态颜色图例 ─────────────────────
  const MAT_X = 40, MAT_Y = 50, CELL = 36;
  const matW = N * CELL + 60;  // 含行标头
  const matH = N * CELL + 60;  // 含列标头

  // ─── 中间：状态分布演化折线图 ─────────────────────────
  const EVO_X = MAT_X + matW + 30;
  const EVO_Y = 50;
  const EVO_W = VW - EVO_X - 20;
  const EVO_H = 240;

  // ─── 底部：终点分布柱状 + 稳态对比 ─────────────────────
  const DIST_X = 40, DIST_Y = 340;
  const DIST_W = VW - 80, DIST_H = 200;

  // 演化图坐标映射
  const xEvo = (t: number) => EVO_X + (t / Math.max(result.steps, 1)) * EVO_W;
  const yEvo = (p: number) => EVO_Y + EVO_H - p * EVO_H;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* 标题 */}
      <text x={20} y={28} fontSize={14} fontWeight="bold" fill={COLORS.text}>
        马尔可夫链：{result.states.join(' / ')} · {isAnimating ? `步 ${currentStep}/${result.steps}` : `${result.steps} 步演化`}
      </text>

      {/* ─── 左：转移矩阵 ─── */}
      <text x={MAT_X} y={MAT_Y - 8} fontSize={12} fontWeight={600} fill={COLORS.text}>
        转移矩阵 P
      </text>
      <rect x={MAT_X - 4} y={MAT_Y - 4} width={matW} height={matH} rx={6}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} />

      {/* 列标头：目标状态 */}
      {result.states.map((s, j) => (
        <text key={`col-${j}`} x={MAT_X + 50 + j * CELL + CELL / 2} y={MAT_Y + 18}
          textAnchor="middle" fontSize={11} fontWeight={600} fill={STATE_COLORS[j % STATE_COLORS.length]}>
          {s}
        </text>
      ))}

      {/* 行标头：源状态 + 矩阵单元 */}
      {result.states.map((s, i) => (
        <g key={`row-${i}`}>
          <text x={MAT_X + 8} y={MAT_Y + 30 + i * CELL + CELL / 2 + 4}
            fontSize={11} fontWeight={600} fill={STATE_COLORS[i % STATE_COLORS.length]}>
            {s} →
          </text>
          {result.states.map((_, j) => {
            const v = result.transition[i]?.[j] ?? 0;
            const cellX = MAT_X + 50 + j * CELL;
            const cellY = MAT_Y + 30 + i * CELL;
            // 颜色强度：转移概率越高背景越深
            const fillOpacity = Math.min(0.9, v);
            const bgColor = i === j ? COLORS.primaryLight : COLORS.info;
            return (
              <g key={`cell-${i}-${j}`}>
                <rect x={cellX} y={cellY} width={CELL - 2} height={CELL - 2} rx={3}
                  fill={bgColor} opacity={fillOpacity * 0.6}
                  stroke={COLORS.border} strokeWidth={0.5} />
                <text x={cellX + CELL / 2 - 1} y={cellY + CELL / 2 + 4}
                  textAnchor="middle" fontSize={11} fontWeight={v > 0.4 ? 600 : 400}
                  fill={v < 0.001 ? COLORS.textMuted : COLORS.text}>
                  {v.toFixed(2)}
                </text>
              </g>
            );
          })}
        </g>
      ))}

      <text x={MAT_X} y={MAT_Y + matH + 14} fontSize={10} fill={COLORS.textMuted}>
        每行表示从该状态出发的转移概率（行和应为 1）
      </text>

      {/* ─── 中间：状态分布演化折线 ─── */}
      <text x={EVO_X} y={EVO_Y - 8} fontSize={12} fontWeight={600} fill={COLORS.text}>
        状态分布随时间演化
      </text>
      <rect x={EVO_X - 4} y={EVO_Y - 4} width={EVO_W + 8} height={EVO_H + 30} rx={6}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} />

      {/* Y 网格 */}
      {[0, 0.25, 0.5, 0.75, 1].map((v) => {
        const y = yEvo(v);
        return (
          <g key={`yg-${v}`}>
            <line x1={EVO_X} y1={y} x2={EVO_X + EVO_W} y2={y}
              stroke={COLORS.border} strokeWidth={0.6} strokeDasharray="3 3" />
            <text x={EVO_X - 4} y={y + 4} textAnchor="end" fontSize={10} fill={COLORS.textMuted}>
              {(v * 100).toFixed(0)}%
            </text>
          </g>
        );
      })}

      {/* X 刻度 */}
      {Array.from({ length: 6 }, (_, i) => Math.round((result.steps * i) / 5)).map((t, i) => (
        <text key={`xt-${i}`} x={xEvo(t)} y={EVO_Y + EVO_H + 14} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>
          {t}
        </text>
      ))}
      <text x={EVO_X + EVO_W / 2} y={EVO_Y + EVO_H + 26} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>
        步数
      </text>

      {/* 各状态分布折线（按当前步截断） */}
      {result.states.map((s, i) => {
        const color = STATE_COLORS[i % STATE_COLORS.length];
        const points = displayDistribution
          .map((dist, t) => `${xEvo(t).toFixed(1)},${yEvo(dist[i]).toFixed(1)}`)
          .join(' ');
        const lastPoint = displayDistribution[displayDistribution.length - 1];
        return (
          <g key={`evo-${i}`}>
            <polyline points={points} fill="none" stroke={color} strokeWidth={2} opacity={0.9}
              vectorEffect="non-scaling-stroke" />
            {/* 当前位置标记（动画时） */}
            {isAnimating && lastPoint && (
              <circle cx={xEvo(currentStep)} cy={yEvo(lastPoint[i])} r={4}
                fill={color} stroke={COLORS.white} strokeWidth={1.5} />
            )}
            {/* 稳态参考虚线 */}
            {result.steadyState && (
              <line x1={EVO_X} y1={yEvo(result.steadyState[i])}
                x2={EVO_X + EVO_W} y2={yEvo(result.steadyState[i])}
                stroke={color} strokeWidth={1} strokeDasharray="5 4" opacity={0.45} />
            )}
            {/* 图例 */}
            <g transform={`translate(${EVO_X + EVO_W - 110 + (i % 3) * 36}, ${EVO_Y + 6 + Math.floor(i / 3) * 14})`}>
              <line x1={0} y1={4} x2={14} y2={4} stroke={color} strokeWidth={2} />
              <text x={18} y={8} fontSize={10} fill={color} fontWeight={600}>{s}</text>
            </g>
          </g>
        );
      })}

      {/* ─── 底部：当前步分布柱状对比稳态 ─── */}
      <text x={DIST_X} y={DIST_Y - 8} fontSize={12} fontWeight={600} fill={COLORS.text}>
        第 {currentStep} 步分布 vs 理论稳态
      </text>
      <rect x={DIST_X - 4} y={DIST_Y - 4} width={DIST_W + 8} height={DIST_H + 30} rx={6}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} />

      {(() => {
        const innerX = DIST_X + 30;
        const innerY = DIST_Y + 8;
        const innerW = DIST_W - 50;
        const innerH = DIST_H - 30;
        const maxY = Math.max(0.05, ...currentEndDist, ...(result.steadyState ?? [])) * 1.2;
        const groupW = innerW / N;
        const barW = groupW * 0.35;
        const gap = groupW * 0.1;
        const yMap = (p: number) => innerY + innerH - (p / maxY) * innerH;
        return (
          <>
            {/* 网格 */}
            {[0, 0.25, 0.5, 0.75, 1].map((v) => {
              const y = yMap(maxY * v);
              return (
                <g key={`dyg-${v}`}>
                  <line x1={innerX} y1={y} x2={innerX + innerW} y2={y}
                    stroke={COLORS.border} strokeWidth={0.5} strokeDasharray="3 3" />
                  <text x={innerX - 4} y={y + 4} textAnchor="end" fontSize={9} fill={COLORS.textMuted}>
                    {(maxY * v * 100).toFixed(0)}%
                  </text>
                </g>
              );
            })}
            <line x1={innerX} y1={innerY + innerH} x2={innerX + innerW} y2={innerY + innerH}
              stroke={COLORS.borderStrong} strokeWidth={1} shapeRendering="crispEdges" />

            {result.states.map((s, i) => {
              const color = STATE_COLORS[i % STATE_COLORS.length];
              const sim = currentEndDist[i] ?? 0;
              const theory = result.steadyState?.[i] ?? 0;
              const baseX = innerX + i * groupW + groupW / 2 - barW - gap / 2;
              const simY = yMap(sim);
              const theoryY = yMap(theory);
              return (
                <g key={`bar-${i}`}>
                  {/* 模拟柱 */}
                  <rect x={baseX} y={simY} width={barW} height={innerY + innerH - simY}
                    fill={color} opacity={0.85} rx={2} />
                  <text x={baseX + barW / 2} y={simY - 4} textAnchor="middle" fontSize={10} fontWeight={600} fill={color}>
                    {(sim * 100).toFixed(1)}%
                  </text>
                  {/* 理论柱（描边） */}
                  {result.steadyState && (
                    <>
                      <rect x={baseX + barW + gap} y={theoryY} width={barW} height={innerY + innerH - theoryY}
                        fill="none" stroke={color} strokeWidth={1.5} strokeDasharray="3 2" rx={2} />
                      <text x={baseX + barW + gap + barW / 2} y={theoryY - 4} textAnchor="middle" fontSize={9} fill={color}>
                        {(theory * 100).toFixed(1)}%
                      </text>
                    </>
                  )}
                  {/* 状态名 */}
                  <text x={innerX + i * groupW + groupW / 2} y={innerY + innerH + 14} textAnchor="middle"
                    fontSize={11} fontWeight={600} fill={color}>
                    {s}
                  </text>
                </g>
              );
            })}

            {/* 图例 */}
            <g transform={`translate(${innerX + innerW - 180}, ${innerY + 4})`}>
              <rect x={0} y={0} width={12} height={8} fill={COLORS.text} opacity={0.85} />
              <text x={16} y={8} fontSize={10} fill={COLORS.textSecondary}>当前步分布</text>
              <rect x={86} y={0} width={12} height={8} fill="none" stroke={COLORS.text} strokeWidth={1.5} strokeDasharray="3 2" />
              <text x={102} y={8} fontSize={10} fill={COLORS.textSecondary}>理论稳态</text>
            </g>
          </>
        );
      })()}

      {/* Footer */}
      <text x={VW / 2} y={VH - 8} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>
        稳态分布 π 满足 πP = π；通过反复左乘转移矩阵迭代到收敛得到
      </text>
    </svg>
  );
}
