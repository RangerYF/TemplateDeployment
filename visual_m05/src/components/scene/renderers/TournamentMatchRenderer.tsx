import { useState } from 'react';
import { COLORS } from '@/styles/tokens';
import type { TournamentMatchResult, TournamentRound, Player, TournamentEventStat } from '@/engine/simulations/tournamentMatch';
import { KatexInline } from '@/components/ui/KatexInline';

const VW = 920, VH = 580;

const PLAYER_COLOR: Record<string, string> = {
  A: '#00C06B',  // 甲 - 绿
  B: '#1890FF',  // 乙 - 蓝
  C: '#FAAD14',  // 丙 - 橙
};

const PLAYER_NAME: Record<string, string> = { A: '甲', B: '乙', C: '丙' };
const PLAYERS: Player[] = ['A', 'B', 'C'];

type PlayerLaneStateKind = 'play_win' | 'play_lose' | 'bye' | 'absent';

interface PlayerStateRow {
  state: { kind: PlayerLaneStateKind };
  cumulativeLosses: number;
}

/** 计算每位玩家在每场比赛中的状态 + 累计负场数 */
function computeLaneStates(rounds: TournamentRound[]): Record<Player, PlayerStateRow[]> {
  const out: Record<Player, PlayerStateRow[]> = { A: [], B: [], C: [] };
  const losses: Record<Player, number> = { A: 0, B: 0, C: 0 };

  for (const r of rounds) {
    for (const p of PLAYERS) {
      if (losses[p] >= 2) {
        out[p].push({ state: { kind: 'absent' }, cumulativeLosses: losses[p] });
        continue;
      }
      if (r.p1 === p || r.p2 === p) {
        if (r.winner === p) {
          out[p].push({ state: { kind: 'play_win' }, cumulativeLosses: losses[p] });
        } else {
          losses[p] += 1;
          out[p].push({ state: { kind: 'play_lose' }, cumulativeLosses: losses[p] });
        }
      } else {
        out[p].push({ state: { kind: 'bye' }, cumulativeLosses: losses[p] });
      }
    }
  }
  return out;
}

export function TournamentMatchRenderer({ result }: { result: TournamentMatchResult }) {
  // 推导浮层状态 (v0.4 反馈 #8)
  const [expandedEvent, setExpandedEvent] = useState<TournamentEventStat | null>(null);

  // ─── Top: sample tournament swim-lane chart (first trial) ───
  const sampleRounds = result.sampleRounds;
  const sampleChampion = result.trials.length > 0 ? result.trials[0].champion : null;
  const laneStates = computeLaneStates(sampleRounds);

  // 泳道布局
  const LANE_X0 = 86;
  const LANE_W = VW - LANE_X0 - 60;
  const LANE_Y: Record<Player, number> = { A: 58, B: 96, C: 134 };
  const X_AXIS_Y = 170;
  const NODE_R = 12;
  const slotsCount = Math.max(sampleRounds.length, 4);
  const slotW = LANE_W / slotsCount;
  const slotX = (gameIdx0Based: number) => LANE_X0 + (gameIdx0Based + 0.5) * slotW;

  // ─── Bottom-left: champion bar chart ───
  const CHAMP_X = 30, CHAMP_Y = 270;
  const CHAMP_W = 280, CHAMP_H = 240;
  const CHAMP_BAR_H = 36;

  // ─── Bottom-middle: games distribution ───
  const GAMES_X = 350, GAMES_Y = 270;
  const GAMES_W = 240, GAMES_H = 240;

  // ─── Bottom-right: tracked events ───
  const EVENTS_X = 620, EVENTS_Y = 270;
  const EVENTS_W = VW - EVENTS_X - 20;
  const EVENTS_H = 240;

  const gamesEntries = Object.entries(result.gamesDistribution)
    .map(([k, v]) => ({ games: Number(k), freq: v }))
    .sort((a, b) => a.games - b.games);
  const maxGamesFreq = Math.max(0.01, ...gamesEntries.map(e => e.freq));

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
    <svg width="100%" height="100%" viewBox={`0 0 ${VW} ${VH}`} preserveAspectRatio="xMidYMid meet">
      <rect width={VW} height={VH} fill={COLORS.bg} />

      {/* ── Sample tournament header ── */}
      <text x={20} y={28} fontSize={14} fontWeight="bold" fill={COLORS.text}>
        示例赛程树状图（第 1 次模拟，共 {sampleRounds.length} 场）
      </text>
      <text x={VW - 20} y={28} textAnchor="end" fontSize={12} fill={COLORS.textMuted}>
        累计模拟 {result.trials.length} 次 · 平均场数 {result.meanGames.toFixed(2)}
      </text>

      {/* 三条泳道横线 + 玩家姓名标签 */}
      {PLAYERS.map(p => (
        <g key={`lane-${p}`}>
          <line
            x1={LANE_X0 - 10} y1={LANE_Y[p]}
            x2={LANE_X0 + LANE_W + 30} y2={LANE_Y[p]}
            stroke={COLORS.border} strokeWidth={1} strokeDasharray="2 4"
            vectorEffect="non-scaling-stroke"
          />
          <rect x={20} y={LANE_Y[p] - 14} width={56} height={28} rx={6}
            fill={PLAYER_COLOR[p]} opacity={0.15} />
          <text x={48} y={LANE_Y[p] + 5} textAnchor="middle" fontSize={14} fontWeight={700} fill={PLAYER_COLOR[p]}>
            {PLAYER_NAME[p]}
          </text>
        </g>
      ))}

      {/* 跨场连线：胜者→下一场(实线) / 败者→下一场轮空(虚线) / 轮空→下一场(点线) */}
      {PLAYERS.map(p => {
        const states = laneStates[p];
        const segments = [];
        for (let i = 0; i < states.length - 1; i++) {
          const cur = states[i].state.kind;
          const nxt = states[i + 1].state.kind;
          if (cur === 'absent' || nxt === 'absent') continue;
          const x1 = slotX(i);
          const x2 = slotX(i + 1);
          const y = LANE_Y[p];
          let dasharray: string | undefined;
          let opacity = 0.6;
          let strokeWidth = 1.5;
          if (cur === 'play_win' && nxt !== 'bye') {
            // 胜者晋级到下一场对决
            dasharray = undefined;
            opacity = 0.9;
            strokeWidth = 2.5;
          } else if (cur === 'play_lose' && nxt === 'bye') {
            // 败者下场轮空
            dasharray = '5 4';
            opacity = 0.55;
          } else if (cur === 'bye' && (nxt === 'play_win' || nxt === 'play_lose')) {
            // 轮空者上场
            dasharray = '1 4';
            opacity = 0.55;
          } else {
            // 其它（兜底）
            dasharray = '5 4';
            opacity = 0.45;
          }
          segments.push(
            <line key={`${p}-seg-${i}`}
              x1={x1 + NODE_R} y1={y} x2={x2 - NODE_R} y2={y}
              stroke={PLAYER_COLOR[p]} strokeWidth={strokeWidth}
              strokeDasharray={dasharray} opacity={opacity}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        return <g key={`segs-${p}`}>{segments}</g>;
      })}

      {/* 同场对决垂直连线 */}
      {sampleRounds.map((r, idx) => {
        const x = slotX(idx);
        const y1 = LANE_Y[r.p1];
        const y2 = LANE_Y[r.p2];
        return (
          <line key={`vs-${idx}`} x1={x} y1={Math.min(y1, y2) + NODE_R} x2={x} y2={Math.max(y1, y2) - NODE_R}
            stroke={COLORS.textMuted} strokeWidth={1.5} strokeDasharray="3 3"
            vectorEffect="non-scaling-stroke" />
        );
      })}

      {/* 节点：出战胜/出战负/轮空/淘汰 */}
      {PLAYERS.map(p => {
        const states = laneStates[p];
        return (
          <g key={`nodes-${p}`}>
            {states.map((row, idx) => {
              const x = slotX(idx);
              const y = LANE_Y[p];
              const kind = row.state.kind;
              if (kind === 'absent') {
                // 仅在淘汰发生的下一场显示 ✗ 一次
                const prev = idx > 0 ? states[idx - 1].state.kind : 'bye';
                if (prev !== 'absent') {
                  return (
                    <g key={idx}>
                      <circle cx={x} cy={y} r={NODE_R} fill={COLORS.bgMuted} stroke={COLORS.error} strokeWidth={1.5}
                        vectorEffect="non-scaling-stroke" />
                      <text x={x} y={y + 4} textAnchor="middle" fontSize={13} fontWeight={700} fill={COLORS.error}>✗</text>
                    </g>
                  );
                }
                return null;
              }
              if (kind === 'bye') {
                return <circle key={idx} cx={x} cy={y} r={5} fill={COLORS.textMuted} opacity={0.4} />;
              }
              const isWin = kind === 'play_win';
              const isChampMoment = isWin && idx === states.length - 1 && p === sampleChampion;
              return (
                <g key={idx}>
                  <circle cx={x} cy={y} r={NODE_R}
                    fill={isWin ? PLAYER_COLOR[p] : COLORS.bg}
                    stroke={PLAYER_COLOR[p]} strokeWidth={isWin ? 1 : 2}
                    vectorEffect="non-scaling-stroke" />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={11} fontWeight={700}
                    fill={isWin ? COLORS.white : PLAYER_COLOR[p]}>
                    {isWin ? '胜' : '负'}
                  </text>
                  {/* 负场累计提示 */}
                  {!isWin && (
                    <text x={x} y={y + NODE_R + 11} textAnchor="middle" fontSize={9} fill={COLORS.error}>
                      累{row.cumulativeLosses}负
                    </text>
                  )}
                  {/* 冠军星标 */}
                  {isChampMoment && (
                    <text x={x + NODE_R + 4} y={y + 6} fontSize={18} fill="#FAAD14">★</text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* X 轴：场次标签 */}
      {sampleRounds.map((r, idx) => (
        <text key={`x-${idx}`} x={slotX(idx)} y={X_AXIS_Y} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>
          第 {r.game} 场
        </text>
      ))}

      {/* 冠军终局文本 */}
      {sampleChampion && (
        <text x={slotX(sampleRounds.length - 1) + 26} y={LANE_Y[sampleChampion] - NODE_R - 6} fontSize={11} fontWeight={700} fill="#FAAD14">
          {PLAYER_NAME[sampleChampion]} 冠军
        </text>
      )}

      {/* 图例 */}
      <g transform={`translate(20, 198)`}>
        <circle cx={6} cy={6} r={6} fill={COLORS.text} />
        <text x={16} y={10} fontSize={10} fill={COLORS.textSecondary}>出战胜</text>
        <circle cx={70} cy={6} r={6} fill={COLORS.bg} stroke={COLORS.text} strokeWidth={1.5} />
        <text x={80} y={10} fontSize={10} fill={COLORS.textSecondary}>出战负</text>
        <circle cx={132} cy={6} r={3} fill={COLORS.textMuted} opacity={0.5} />
        <text x={140} y={10} fontSize={10} fill={COLORS.textSecondary}>轮空</text>
        <text x={175} y={10} fontSize={10} fill={COLORS.error}>✗ 淘汰</text>
        <text x={216} y={10} fontSize={10} fill="#FAAD14">★ 冠军</text>
        <line x1={264} y1={6} x2={288} y2={6} stroke={COLORS.text} strokeWidth={2.5} vectorEffect="non-scaling-stroke" />
        <text x={294} y={10} fontSize={10} fill={COLORS.textSecondary}>胜者晋级</text>
        <line x1={356} y1={6} x2={380} y2={6} stroke={COLORS.text} strokeWidth={1.5} strokeDasharray="5 4" opacity={0.6} vectorEffect="non-scaling-stroke" />
        <text x={386} y={10} fontSize={10} fill={COLORS.textSecondary}>败者轮空</text>
        <line x1={448} y1={6} x2={472} y2={6} stroke={COLORS.text} strokeWidth={1.5} strokeDasharray="1 4" opacity={0.6} vectorEffect="non-scaling-stroke" />
        <text x={478} y={10} fontSize={10} fill={COLORS.textSecondary}>轮空替补上场</text>
        <line x1={560} y1={2} x2={560} y2={10} stroke={COLORS.textMuted} strokeWidth={1.5} strokeDasharray="3 3" vectorEffect="non-scaling-stroke" />
        <text x={568} y={10} fontSize={10} fill={COLORS.textSecondary}>同场对决</text>
      </g>

      {/* ── Champion frequency ── */}
      <rect x={CHAMP_X} y={CHAMP_Y - 10} width={CHAMP_W} height={CHAMP_H + 10} rx={8}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={CHAMP_X + 12} y={CHAMP_Y + 10} fontSize={13} fontWeight="bold" fill={COLORS.text}>
        最终获胜频率分布
      </text>
      {(['A', 'B', 'C'] as const).map((player, i) => {
        const freq = result.championDistribution[player];
        const y = CHAMP_Y + 30 + i * (CHAMP_BAR_H + 16);
        const barMaxW = CHAMP_W - 100;
        const barW = barMaxW * freq;
        return (
          <g key={player}>
            <text x={CHAMP_X + 12} y={y + CHAMP_BAR_H / 2 + 4} fontSize={13} fontWeight={600} fill={PLAYER_COLOR[player]}>
              {PLAYER_NAME[player]}
            </text>
            <rect x={CHAMP_X + 36} y={y} width={barMaxW} height={CHAMP_BAR_H} rx={4} fill={COLORS.bgMuted} />
            <rect x={CHAMP_X + 36} y={y} width={Math.max(barW, 1)} height={CHAMP_BAR_H} rx={4} fill={PLAYER_COLOR[player]} opacity={0.85} />
            <text x={CHAMP_X + 40 + Math.max(barW, 20) + 4} y={y + CHAMP_BAR_H / 2 + 4} fontSize={12} fontWeight="bold" fill={COLORS.text}>
              {(freq * 100).toFixed(1)}%
            </text>
          </g>
        );
      })}

      {/* ── Games distribution ── */}
      <rect x={GAMES_X} y={GAMES_Y - 10} width={GAMES_W} height={GAMES_H + 10} rx={8}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={GAMES_X + 12} y={GAMES_Y + 10} fontSize={13} fontWeight="bold" fill={COLORS.text}>
        总场数分布
      </text>
      {(() => {
        const innerX = GAMES_X + 16;
        const innerY = GAMES_Y + 28;
        const innerW = GAMES_W - 32;
        const innerH = GAMES_H - 56;
        const barCount = gamesEntries.length;
        const barW = barCount > 0 ? (innerW / barCount) * 0.7 : 0;
        const gap = barCount > 0 ? (innerW / barCount) * 0.3 : 0;
        return (
          <>
            <line x1={innerX} y1={innerY + innerH} x2={innerX + innerW} y2={innerY + innerH}
              stroke={COLORS.borderStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            <line x1={innerX} y1={innerY} x2={innerX} y2={innerY + innerH}
              stroke={COLORS.borderStrong} strokeWidth={1} vectorEffect="non-scaling-stroke" />
            {gamesEntries.map((e, i) => {
              const bx = innerX + i * (barW + gap) + gap / 2;
              const bh = (e.freq / maxGamesFreq) * innerH;
              const by = innerY + innerH - bh;
              return (
                <g key={e.games}>
                  <rect x={bx} y={by} width={barW} height={Math.max(bh, 1)} rx={3} fill={COLORS.primary} opacity={0.85} />
                  <text x={bx + barW / 2} y={by - 4} textAnchor="middle" fontSize={10} fontWeight="bold" fill={COLORS.text}>
                    {(e.freq * 100).toFixed(1)}%
                  </text>
                  <text x={bx + barW / 2} y={innerY + innerH + 14} textAnchor="middle" fontSize={11} fill={COLORS.textSecondary}>
                    {e.games}场
                  </text>
                </g>
              );
            })}
          </>
        );
      })()}

      {/* ── Tracked events ── */}
      <rect x={EVENTS_X} y={EVENTS_Y - 10} width={EVENTS_W} height={EVENTS_H + 10} rx={8}
        fill={COLORS.bgPage} stroke={COLORS.border} strokeWidth={1} vectorEffect="non-scaling-stroke" />
      <text x={EVENTS_X + 12} y={EVENTS_Y + 10} fontSize={13} fontWeight="bold" fill={COLORS.text}>
        追踪事件频率 vs 理论
      </text>
      {result.events.slice(0, 6).map((ev, i) => {
        const ROW_H = 38;
        const y = EVENTS_Y + 30 + i * ROW_H;
        const maxBarW = EVENTS_W - 140;
        const obsW = maxBarW * ev.freq;
        const theorW = ev.theoreticalProb !== undefined ? maxBarW * ev.theoreticalProb : 0;
        return (
          <g key={ev.id}>
            <text x={EVENTS_X + 12} y={y + 4} fontSize={11} fill={COLORS.text}>{ev.label}</text>
            {/* 推导按钮 📖 */}
            {ev.derivation && (
              <g style={{ cursor: 'pointer' }} onClick={() => setExpandedEvent(ev)}>
                <rect x={EVENTS_X + EVENTS_W - 30} y={y - 6} width={22} height={14} rx={3}
                  fill={COLORS.primaryLight} stroke={COLORS.primary} strokeWidth={0.8} />
                <text x={EVENTS_X + EVENTS_W - 19} y={y + 4} textAnchor="middle" fontSize={9} fontWeight={600} fill={COLORS.primary}>推导</text>
              </g>
            )}
            <rect x={EVENTS_X + 12} y={y + 8} width={maxBarW} height={6} rx={2} fill={COLORS.bgMuted} />
            <rect x={EVENTS_X + 12} y={y + 8} width={Math.max(obsW, 1)} height={6} rx={2} fill={COLORS.primary} />
            {ev.theoreticalProb !== undefined && (
              <line x1={EVENTS_X + 12 + theorW} y1={y + 5} x2={EVENTS_X + 12 + theorW} y2={y + 17}
                stroke={COLORS.error} strokeWidth={2} vectorEffect="non-scaling-stroke" />
            )}
            {/* 模拟频率（用 SVG text） */}
            <text x={EVENTS_X + 12} y={y + 26} fontSize={9} fill={COLORS.textSecondary}>
              模拟 {(ev.freq * 100).toFixed(1)}%
            </text>
            {/* 理论概率分式（用 foreignObject + KaTeX） */}
            {ev.theoreticalLatex && (
              <foreignObject x={EVENTS_X + 80} y={y + 16} width={EVENTS_W - 110} height={20}>
                <div style={{ fontSize: 11, color: COLORS.error, lineHeight: '14px' }}>
                  · 理论 <KatexInline math={ev.theoreticalLatex} />
                </div>
              </foreignObject>
            )}
          </g>
        );
      })}
      {result.events.length === 0 && (
        <text x={EVENTS_X + EVENTS_W / 2} y={EVENTS_Y + EVENTS_H / 2} textAnchor="middle" fontSize={12} fill={COLORS.textMuted}>
          请在参数面板勾选要追踪的事件
        </text>
      )}

      {/* Legend for theory tick */}
      <text x={EVENTS_X + 12} y={EVENTS_Y + EVENTS_H + 4} fontSize={10} fill={COLORS.textMuted}>
        ▍ 红线 = 理论概率（仅当三方对称胜率 0.5 时显示）
      </text>

      {/* Footer hint */}
      <text x={VW / 2} y={VH - 8} textAnchor="middle" fontSize={11} fill={COLORS.textMuted}>
        规则：累计负两场被淘汰；甲乙先比赛，丙轮空；胜者与轮空者比赛，败者下场轮空。
      </text>

    </svg>

    {/* 推导浮层 (v0.4 反馈 #8) */}
    {expandedEvent && expandedEvent.derivation && (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 20,
        }}
        onClick={() => setExpandedEvent(null)}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: 'min(640px, 92%)',
            maxHeight: '88%',
            overflowY: 'auto',
            backgroundColor: COLORS.bg,
            borderRadius: 12,
            padding: '24px 28px',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 700, color: COLORS.text }}>
                {expandedEvent.derivation.title}
              </div>
              <div style={{ fontSize: 13, color: COLORS.textMuted, marginTop: 4 }}>
                事件：{expandedEvent.label}
                {expandedEvent.theoreticalLatex && (
                  <span style={{ marginLeft: 8 }}>
                    · 理论概率 <KatexInline math={`P = ${expandedEvent.theoreticalLatex}`} />
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => setExpandedEvent(null)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: 22, color: COLORS.textMuted, padding: '0 8px',
              }}
              aria-label="关闭"
            >×</button>
          </div>
          <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
            {expandedEvent.derivation.steps.map((step, i) => (
              <div key={i} style={{ margin: '14px 0', fontSize: 14, color: COLORS.text, textAlign: 'center' }}>
                <KatexInline math={step} displayMode />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18, fontSize: 12, color: COLORS.textMuted, textAlign: 'center' }}>
            模拟频率 {(expandedEvent.freq * 100).toFixed(2)}% · 模拟次数 {expandedEvent.occurCount}
          </div>
          <div style={{ marginTop: 16, textAlign: 'right' }}>
            <button
              onClick={() => setExpandedEvent(null)}
              style={{
                padding: '6px 16px', borderRadius: 6,
                backgroundColor: COLORS.primary, color: COLORS.white,
                border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}
            >关闭</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
