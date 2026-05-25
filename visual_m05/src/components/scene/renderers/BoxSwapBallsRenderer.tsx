import { COLORS } from '@/styles/tokens';
import type { BoxSwapBallsResult } from '@/engine/simulations/boxSwapBalls';

const VW = 920, VH = 580;

export function BoxSwapBallsRenderer({ result }: { result: BoxSwapBallsResult }) {
  // ─── Top: sample swap snapshots (first trial) ───
  const SNAP_X = 20, SNAP_Y = 50;
  const SNAP_BOX_W = 75, SNAP_BOX_H = 75, SNAP_GAP_X = 20, SNAP_GAP_Y = 36;
  const maxSnap = Math.min(result.sampleSnapshots.length, 6);

  // ─── Bottom-left: distribution bar chart ───
  const DIST_X = 30, DIST_Y = 290;
  const DIST_W = 380, DIST_H = 250;

  // ─── Bottom-right: trajectory line (mean black in A over operations) ───
  const TRAJ_X = 450, TRAJ_Y = 290;
  const TRAJ_W = 450, TRAJ_H = 250;

  const maxK = 2 * result.initBlack;

  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* ── Header ── */}
      <text x={20} y={28} fontSize={14} fontWeight="bold" fill={COLORS.text}>
        双盒互换球 · 初始每盒 {result.initBlack} 黑 + {result.initRed} 红 · 操作 {result.operations} 次
      </text>
      <text x={VW - 20} y={28} textAnchor="end" fontSize={12} fill={COLORS.textMuted}>
        累计模拟 {result.trials.length} 轮 · 甲盒黑球均值 {result.meanBlackInA.toFixed(3)}
      </text>

      {/* ── Sample snapshots ── */}
      <text x={SNAP_X} y={SNAP_Y - 6} fontSize={12} fill={COLORS.textSecondary}>
        第 1 次模拟的操作快照（共 {result.sampleSnapshots.length} 步）：
      </text>
      {Array.from({ length: maxSnap }).map((_, idx) => {
        const snap = result.sampleSnapshots[idx];
        const sx = SNAP_X + idx * (SNAP_BOX_W * 2 + SNAP_GAP_X + 20);
        return (
          <g key={idx}>
            {/* Step label */}
            <text x={sx + SNAP_BOX_W + 10} y={SNAP_Y + 14} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>
              步骤 {idx + 1}：取 {snap.pickedFromA === 'B' ? '黑' : '红'} ↔ {snap.pickedFromB === 'B' ? '黑' : '红'}
            </text>

            {/* Box A */}
            <rect x={sx} y={SNAP_Y + 22} width={SNAP_BOX_W} height={SNAP_BOX_H} rx={6}
              fill={COLORS.bgMuted} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={sx + SNAP_BOX_W / 2} y={SNAP_Y + 38} textAnchor="middle" fontSize={11} fontWeight="bold" fill={COLORS.text}>甲</text>
            {renderBoxBalls(snap.boxA.black, snap.boxA.red, sx + 8, SNAP_Y + 44, SNAP_BOX_W - 16)}

            {/* Box B */}
            <rect x={sx + SNAP_BOX_W + 8} y={SNAP_Y + 22} width={SNAP_BOX_W} height={SNAP_BOX_H} rx={6}
              fill={COLORS.bgMuted} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <text x={sx + SNAP_BOX_W + 8 + SNAP_BOX_W / 2} y={SNAP_Y + 38} textAnchor="middle" fontSize={11} fontWeight="bold" fill={COLORS.text}>乙</text>
            {renderBoxBalls(snap.boxB.black, snap.boxB.red, sx + SNAP_BOX_W + 16, SNAP_Y + 44, SNAP_BOX_W - 16)}

            {/* Arrow */}
            <text x={sx + SNAP_BOX_W + 4} y={SNAP_Y + SNAP_BOX_H / 2 + 30} textAnchor="middle" fontSize={14} fill={COLORS.primary}>⇄</text>
          </g>
        );
      })}
      {result.sampleSnapshots.length > maxSnap && (
        <text x={SNAP_X} y={SNAP_Y + 22 + SNAP_BOX_H + SNAP_GAP_Y} fontSize={11} fill={COLORS.textMuted}>
          … 共 {result.sampleSnapshots.length} 次操作（图中仅显示前 {maxSnap} 次）
        </text>
      )}

      {/* ── Distribution bar chart ── */}
      <rect x={DIST_X} y={DIST_Y} width={DIST_W} height={DIST_H} rx={8}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={DIST_X + 12} y={DIST_Y + 20} fontSize={13} fontWeight="bold" fill={COLORS.text}>
        甲盒黑球数频率分布
      </text>
      {(() => {
        const innerX = DIST_X + 30;
        const innerY = DIST_Y + 36;
        const innerW = DIST_W - 50;
        const innerH = DIST_H - 70;
        const maxFreq = Math.max(0.05, ...result.distribution);
        const barCount = maxK + 1;
        const barW = (innerW / barCount) * 0.65;
        const gap = (innerW / barCount) * 0.35;
        return (
          <>
            <line x1={innerX} y1={innerY + innerH} x2={innerX + innerW} y2={innerY + innerH}
              stroke={COLORS.borderStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={innerX} y1={innerY} x2={innerX} y2={innerY + innerH}
              stroke={COLORS.borderStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />

            {/* Theory line for k=initBlack */}
            {result.theoreticalProbBn !== undefined && (() => {
              const theory = result.theoreticalProbBn;
              const theoryY = innerY + innerH - (theory / maxFreq) * innerH;
              return (
                <>
                  <line x1={innerX} y1={theoryY} x2={innerX + innerW} y2={theoryY}
                    stroke={COLORS.error} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
                  <text x={innerX + innerW - 4} y={theoryY - 4} textAnchor="end" fontSize={10} fill={COLORS.error}>
                    P(B<tspan fontSize={9} dy={2}>n</tspan><tspan dy={-2}>)≈{theory.toFixed(4)}</tspan>
                  </text>
                </>
              );
            })()}

            {result.distribution.map((freq, k) => {
              const bx = innerX + k * (barW + gap) + gap / 2;
              const bh = (freq / maxFreq) * innerH;
              const by = innerY + innerH - bh;
              const isCenter = k === result.initBlack;
              return (
                <g key={k}>
                  <rect x={bx} y={by} width={barW} height={Math.max(bh, 1)} rx={3}
                    fill={isCenter ? COLORS.primary : COLORS.info} opacity={0.85} />
                  <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize={11} fontWeight="bold" fill={COLORS.text}>
                    {(freq * 100).toFixed(1)}%
                  </text>
                  <text x={bx + barW / 2} y={innerY + innerH + 14} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>
                    {k === 0 ? (
                      <>A<tspan fontSize={10} dy={3}>n</tspan><tspan dy={-3}> (0黑)</tspan></>
                    ) : k === result.initBlack ? (
                      <>B<tspan fontSize={10} dy={3}>n</tspan><tspan dy={-3}> ({k}黑)</tspan></>
                    ) : k === maxK ? (
                      <>C<tspan fontSize={10} dy={3}>n</tspan><tspan dy={-3}> ({k}黑)</tspan></>
                    ) : `${k}黑`}
                  </text>
                </g>
              );
            })}
            <text x={innerX - 6} y={innerY + 4} textAnchor="end" fontSize={10} fill={COLORS.textMuted}>
              {(maxFreq * 100).toFixed(0)}%
            </text>
            <text x={innerX - 6} y={innerY + innerH + 4} textAnchor="end" fontSize={10} fill={COLORS.textMuted}>0%</text>
          </>
        );
      })()}

      {/* ── Trajectory line (mean black in A over operations) ── */}
      <rect x={TRAJ_X} y={TRAJ_Y} width={TRAJ_W} height={TRAJ_H} rx={8}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={TRAJ_X + 12} y={TRAJ_Y + 20} fontSize={13} fontWeight="bold" fill={COLORS.text}>
        甲盒黑球数均值随操作变化
      </text>
      {(() => {
        const innerX = TRAJ_X + 40;
        const innerY = TRAJ_Y + 36;
        const innerW = TRAJ_W - 60;
        const innerH = TRAJ_H - 70;
        const stableMean = result.initBlack;  // 长期均值
        const yMax = Math.max(stableMean * 1.6, ...result.trajectoryMeans) * 1.05;
        const yMin = 0;
        const n = result.trajectoryMeans.length;
        const xMax = Math.max(n - 1, 1);
        const px = (i: number) => innerX + (i / xMax) * innerW;
        const py = (v: number) => innerY + innerH - ((v - yMin) / (yMax - yMin)) * innerH;
        const points = result.trajectoryMeans.map((v, i) => `${px(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
        const stableY = py(stableMean);
        const ticks = Math.min(n, 10);
        return (
          <>
            <line x1={innerX} y1={innerY + innerH} x2={innerX + innerW} y2={innerY + innerH}
              stroke={COLORS.borderStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={innerX} y1={innerY} x2={innerX} y2={innerY + innerH}
              stroke={COLORS.borderStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />

            {/* Stable mean reference */}
            <line x1={innerX} y1={stableY} x2={innerX + innerW} y2={stableY}
              stroke={COLORS.warning} strokeWidth={1.5} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" />
            <text x={innerX + innerW - 4} y={stableY - 4} textAnchor="end" fontSize={10} fill={COLORS.warning}>
              稳态均值={stableMean}
            </text>

            <polyline points={points} fill="none" stroke={COLORS.primary} strokeWidth={2} vectorEffect="non-scaling-stroke" />

            {/* X ticks */}
            {Array.from({ length: ticks + 1 }, (_, i) => {
              const step = Math.floor((n - 1) * i / ticks);
              if (i > 0 && step === Math.floor((n - 1) * (i - 1) / ticks)) return null;
              const x = px(step);
              return (
                <text key={i} x={x} y={innerY + innerH + 14} textAnchor="middle" fontSize={10} fill={COLORS.textMuted}>
                  {step}
                </text>
              );
            })}
            <text x={innerX + innerW / 2} y={TRAJ_Y + TRAJ_H - 4} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>
              操作步骤
            </text>
            <text x={innerX - 28} y={innerY + 4} fontSize={10} fill={COLORS.textMuted}>{yMax.toFixed(2)}</text>
            <text x={innerX - 28} y={innerY + innerH + 4} fontSize={10} fill={COLORS.textMuted}>0</text>
          </>
        );
      })()}

      {/* Footer */}
      {result.theoreticalProbBn !== undefined && (
        <text x={VW / 2} y={VH - 4} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>
          理论公式：P(B<tspan fontSize={10} dy={3}>n</tspan><tspan dy={-3}>) = 3/5 + (2/5)·(-1/9)</tspan><tspan fontSize={10} dy={-3}>n</tspan><tspan dy={3}>（仅适用 1黑+2红 配置）</tspan>
        </text>
      )}
    </svg>
  );
}

function renderBoxBalls(black: number, red: number, x: number, y: number, w: number) {
  const balls: { color: 'B' | 'R' }[] = [
    ...Array(black).fill({ color: 'B' as const }),
    ...Array(red).fill({ color: 'R' as const }),
  ];
  const cols = Math.min(balls.length, 3);
  const r = Math.min(7, w / (cols * 2 + 1));
  return (
    <>
      {balls.map((b, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const cx = x + r + col * (r * 2 + 2);
        const cy = y + r + row * (r * 2 + 2);
        return (
          <circle key={i} cx={cx} cy={cy} r={r}
            fill={b.color === 'B' ? '#1A1A2E' : '#FF4D4F'}
            stroke={b.color === 'B' ? '#000' : '#aa2222'} strokeWidth={0.8} />
        );
      })}
    </>
  );
}
