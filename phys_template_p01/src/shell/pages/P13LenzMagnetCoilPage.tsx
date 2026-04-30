import { useEffect, useMemo, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import { COLORS, SHADOWS } from '@/styles/tokens';
import {
  LENZ_AXIS_DIRECTION_LABELS,
  LENZ_CURRENT_DIRECTION_LABELS,
  LENZ_FLUX_CHANGE_LABELS,
  LENZ_INTERACTION_LABELS,
  LENZ_MOTION_LABELS,
  LENZ_POLE_LABELS,
  analyzeLenzMagnetCoil,
  listLenzReferenceCases,
  type P13LenzAnalysisResult,
  type P13LenzMotion,
  type P13LenzPole,
} from '@/domains/em/p13/lenz-magnet-coil';

const pageStyle = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: '#FCFCFD',
  blockBg: COLORS.bg,
  blockSoft: COLORS.bgMuted,
  border: COLORS.border,
  borderStrong: COLORS.borderStrong,
  text: COLORS.text,
  muted: COLORS.textMuted,
  secondary: COLORS.textSecondary,
  primary: '#B96A16',
  primarySoft: '#FFF4E8',
  flux: '#4F46E5',
  change: '#0EA5E9',
  current: '#F97316',
  field: '#16A34A',
  force: '#DC2626',
  motion: '#2563EB',
};

const TOTAL_ANALYSIS_STEPS = 5;

interface Props {
  onBack: () => void;
}

export function P13LenzMagnetCoilPage({ onBack }: Props) {
  const [pole, setPole] = useState<P13LenzPole>('N');
  const [motion, setMotion] = useState<P13LenzMotion>('insert');
  const [turns, setTurns] = useState(100);
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    simulator.unload();
  }, []);

  useEffect(() => {
    setAnalysisStep(0);
  }, [pole, motion, turns]);

  const analysis = useMemo(
    () => analyzeLenzMagnetCoil({ pole, motion, turns }),
    [pole, motion, turns],
  );
  const referenceCases = useMemo(() => listLenzReferenceCases(100), []);
  const canAdvance = analysisStep < TOTAL_ANALYSIS_STEPS;

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: pageStyle.pageBg }}
    >
      <header
        className="flex flex-wrap items-center justify-between gap-3 px-5 py-3"
        style={{
          borderBottom: `1px solid ${pageStyle.border}`,
          backgroundColor: pageStyle.panelBg,
        }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors hover:bg-gray-100"
            style={{
              color: pageStyle.secondary,
              border: `1px solid ${pageStyle.border}`,
              backgroundColor: pageStyle.blockBg,
            }}
          >
            ← 返回 P-13
          </button>
          <div>
            <h1 className="text-base font-semibold" style={{ color: pageStyle.text }}>
              EMI-001 磁棒-线圈楞次定律
            </h1>
            <p className="text-xs" style={{ color: pageStyle.muted }}>
              Phase 2 首个专用教学模型：只做四种情况的方向判断与逐步分析，不提前引入终态数值、builder 或图表系统。
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <HeaderBadge label="当前场景" value={`${LENZ_POLE_LABELS[pole]}${LENZ_MOTION_LABELS[motion]}`} />
          <HeaderBadge label="线圈匝数" value={`n = ${analysis.turns}`} />
          <HeaderBadge label="感应电流" value={LENZ_CURRENT_DIRECTION_LABELS[analysis.inducedCurrentDirection]} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside
          className="flex w-[300px] shrink-0 flex-col overflow-y-auto p-4"
          style={{
            borderRight: `1px solid ${pageStyle.border}`,
            backgroundColor: pageStyle.panelSoft,
          }}
        >
          <PanelCard title="场景约定">
            <p className="text-sm leading-6" style={{ color: pageStyle.secondary }}>
              磁棒位于线圈右侧，所选磁极就是靠近线圈的一端。判断电流方向时固定采用“从右看线圈”的课堂口径。
            </p>
          </PanelCard>

          <PanelCard title="模型参数">
            <div className="space-y-4">
              <OptionGroup
                label="线圈侧磁极"
                value={pole}
                options={[
                  { value: 'N', label: 'N 极' },
                  { value: 'S', label: 'S 极' },
                ]}
                onChange={(value) => setPole(value as P13LenzPole)}
              />
              <OptionGroup
                label="运动方向"
                value={motion}
                options={[
                  { value: 'insert', label: '插入' },
                  { value: 'withdraw', label: '拔出' },
                ]}
                onChange={(value) => setMotion(value as P13LenzMotion)}
              />

              <div>
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span style={{ color: pageStyle.secondary }}>线圈匝数 n</span>
                  <span className="font-medium" style={{ color: pageStyle.text }}>
                    {analysis.turns}
                  </span>
                </div>
                <input
                  value={turns}
                  min={10}
                  max={500}
                  step={10}
                  type="range"
                  className="w-full"
                  onChange={(event) => setTurns(Number(event.target.value))}
                />
                <p className="mt-2 text-xs leading-5" style={{ color: pageStyle.muted }}>
                  本阶段用离散教学逻辑判断方向。n 会影响“感应强弱”的解释口径，但不改变四种情况的方向结论。
                </p>
              </div>
            </div>
          </PanelCard>

          <PanelCard title="逐步分析">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setAnalysisStep(1)}
                className="rounded-lg px-3 py-2 text-sm font-medium"
                style={primaryButtonStyle}
              >
                开始分析
              </button>
              <button
                onClick={() => setAnalysisStep((prev) => Math.min(TOTAL_ANALYSIS_STEPS, prev + 1))}
                disabled={!canAdvance}
                className="rounded-lg px-3 py-2 text-sm font-medium disabled:cursor-not-allowed"
                style={{
                  ...secondaryButtonStyle,
                  opacity: canAdvance ? 1 : 0.45,
                }}
              >
                下一步
              </button>
              <button
                onClick={() => setAnalysisStep(0)}
                className="rounded-lg px-3 py-2 text-sm font-medium"
                style={secondaryButtonStyle}
              >
                重置分析
              </button>
            </div>
            <p className="mt-3 text-xs leading-5" style={{ color: pageStyle.muted }}>
              当前已展示 {analysisStep} / {TOTAL_ANALYSIS_STEPS} 步。修改参数后会自动回到未开始状态，避免旧结论残留。
            </p>
          </PanelCard>

          <PanelCard title="当前结论">
            <SummaryLine label="原磁通量" value={LENZ_AXIS_DIRECTION_LABELS[analysis.originalFluxDirection]} />
            <SummaryLine label="磁通量变化" value={LENZ_FLUX_CHANGE_LABELS[analysis.fluxChangeTrend]} />
            <SummaryLine label="感应电流" value={LENZ_CURRENT_DIRECTION_LABELS[analysis.inducedCurrentDirection]} />
            <SummaryLine label="感应磁场" value={LENZ_AXIS_DIRECTION_LABELS[analysis.inducedFieldDirection]} />
            <SummaryLine
              label="安培力"
              value={`${LENZ_INTERACTION_LABELS[analysis.interaction]}，${LENZ_AXIS_DIRECTION_LABELS[analysis.ampereForceDirection]}`}
            />
          </PanelCard>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-y-auto p-4">
          <section
            className="rounded-3xl border p-4"
            style={{
              backgroundColor: pageStyle.panelBg,
              borderColor: pageStyle.border,
              boxShadow: SHADOWS.sm,
            }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                  教学演示区
                </h2>
                <p className="text-xs" style={{ color: pageStyle.muted }}>
                  左侧为磁棒-线圈轴向示意，右侧为“从右看线圈”的电流方向提示。颜色与右侧分析步骤一一对应。
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <LegendBadge color={pageStyle.flux} label="原磁通量" />
                <LegendBadge color={pageStyle.change} label="磁通量变化" />
                <LegendBadge color={pageStyle.current} label="感应电流" />
                <LegendBadge color={pageStyle.field} label="感应磁场" />
                <LegendBadge color={pageStyle.force} label="安培力" />
              </div>
            </div>

            <LenzTeachingStage analysis={analysis} analysisStep={analysisStep} />
          </section>

          <section
            className="mt-4 rounded-3xl border p-4"
            style={{
              backgroundColor: pageStyle.panelBg,
              borderColor: pageStyle.border,
              boxShadow: SHADOWS.sm,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                  公式口径
                </h3>
                <p className="mt-1 text-sm leading-6" style={{ color: pageStyle.secondary }}>
                  方向判断遵循法拉第电磁感应定律与楞次定律：先判断原磁通量方向，再判断“增大/减小”，最后决定线圈需要生成什么方向的感应磁场。
                </p>
              </div>
              <div
                className="rounded-2xl px-4 py-3 text-sm"
                style={{
                  backgroundColor: pageStyle.blockSoft,
                  color: pageStyle.text,
                }}
              >
                <div className="font-medium">ε = -nΔΦ/Δt</div>
                <div className="mt-1 text-xs" style={{ color: pageStyle.muted }}>
                  当前 n = {analysis.turns}，方向不变，只强化感应效应。
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside
          className="flex w-[360px] shrink-0 flex-col overflow-y-auto p-4"
          style={{
            borderLeft: `1px solid ${pageStyle.border}`,
            backgroundColor: pageStyle.panelSoft,
          }}
        >
          <PanelCard title="分析步骤">
            <div className="space-y-3">
              {analysis.steps.map((step, index) => {
                const isVisible = index < analysisStep;
                const isActive = analysisStep > 0 && index === analysisStep - 1;
                return (
                  <div
                    key={step.key}
                    className="rounded-2xl border p-4"
                    style={{
                      borderColor: isVisible ? `${step.accentColor}55` : pageStyle.border,
                      backgroundColor: isVisible ? `${step.accentColor}12` : pageStyle.blockBg,
                      boxShadow: isActive ? `0 0 0 1px ${step.accentColor}22 inset` : 'none',
                    }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
                          style={{
                            color: isVisible ? step.accentColor : pageStyle.muted,
                            backgroundColor: isVisible ? `${step.accentColor}18` : pageStyle.blockSoft,
                          }}
                        >
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                            {step.title}
                          </div>
                          <div className="text-xs" style={{ color: pageStyle.muted }}>
                            {isVisible ? '已揭示' : '等待分析'}
                          </div>
                        </div>
                      </div>
                      {isVisible && (
                        <span
                          className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
                          style={{
                            color: step.accentColor,
                            backgroundColor: `${step.accentColor}18`,
                          }}
                        >
                          {step.shortValue}
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm leading-6" style={{ color: pageStyle.secondary }}>
                      {isVisible ? step.description : '点击“开始分析”并逐步推进后，这里的判断理由会按顺序展开。'}
                    </p>
                  </div>
                );
              })}
            </div>
          </PanelCard>

          <PanelCard title="四种情况速览">
            <div className="space-y-2">
              {referenceCases.map((item) => {
                const isCurrent = item.pole === pole && item.motion === motion;
                return (
                  <div
                    key={`${item.pole}-${item.motion}`}
                    className="rounded-2xl border px-3 py-3"
                    style={{
                      borderColor: isCurrent ? `${pageStyle.primary}55` : pageStyle.border,
                      backgroundColor: isCurrent ? pageStyle.primarySoft : pageStyle.blockBg,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                        {LENZ_POLE_LABELS[item.pole]}{LENZ_MOTION_LABELS[item.motion]}
                      </div>
                      {isCurrent && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{
                            color: pageStyle.primary,
                            backgroundColor: '#FFE7C8',
                          }}
                        >
                          当前
                        </span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs" style={{ color: pageStyle.secondary }}>
                      <div>磁通量：{LENZ_FLUX_CHANGE_LABELS[item.fluxChangeTrend]}</div>
                      <div>电流：{LENZ_CURRENT_DIRECTION_LABELS[item.inducedCurrentDirection]}</div>
                      <div>感应磁场：{LENZ_AXIS_DIRECTION_LABELS[item.inducedFieldDirection]}</div>
                      <div>安培力：{LENZ_INTERACTION_LABELS[item.interaction]}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </PanelCard>
        </aside>
      </div>
    </div>
  );
}

function LenzTeachingStage({
  analysis,
  analysisStep,
}: {
  analysis: P13LenzAnalysisResult;
  analysisStep: number;
}) {
  const magnetX = analysis.motion === 'insert' ? 430 : 530;
  const visibleTurns = Math.max(5, Math.min(12, Math.round(analysis.turns / 40)));
  const showOriginalFlux = analysisStep >= 1;
  const showFluxChange = analysisStep >= 2;
  const showCurrent = analysisStep >= 3;
  const showInducedField = analysisStep >= 4;
  const showForce = analysisStep >= 5;

  return (
    <svg viewBox="0 0 760 390" className="h-[390px] w-full">
      <defs>
        <marker
          id="lenz-arrow-flux"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={pageStyle.flux} />
        </marker>
        <marker
          id="lenz-arrow-change"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={pageStyle.change} />
        </marker>
        <marker
          id="lenz-arrow-motion"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={pageStyle.motion} />
        </marker>
        <marker
          id="lenz-arrow-field"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={pageStyle.field} />
        </marker>
        <marker
          id="lenz-arrow-force"
          markerWidth="10"
          markerHeight="10"
          refX="8"
          refY="5"
          orient="auto"
          markerUnits="userSpaceOnUse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill={pageStyle.force} />
        </marker>
      </defs>

      <rect
        x="10"
        y="10"
        width="740"
        height="370"
        rx="24"
        fill="#FFFDF9"
        stroke={pageStyle.border}
      />

      <text x="40" y="42" fill={pageStyle.text} fontSize="15" fontWeight="600">
        侧视图：磁棒在线圈右侧
      </text>
      <text x="500" y="42" fill={pageStyle.text} fontSize="15" fontWeight="600">
        从右看线圈
      </text>

      <line
        x1="50"
        y1="210"
        x2="460"
        y2="210"
        stroke="#94A3B8"
        strokeWidth="3"
      />

      {Array.from({ length: visibleTurns }).map((_, index) => (
        <ellipse
          key={index}
          cx={230 + index * 7}
          cy="210"
          rx="16"
          ry="78"
          fill="none"
          stroke="#B96A16"
          strokeWidth="3"
          opacity={0.9 - index * 0.04}
        />
      ))}
      <text x="206" y="320" fill={pageStyle.secondary} fontSize="12">
        线圈 n = {analysis.turns}
      </text>

      <rect
        x={magnetX}
        y="165"
        width="150"
        height="90"
        rx="18"
        fill="#F8FAFC"
        stroke="#CBD5E1"
        strokeWidth="2"
      />
      <rect
        x={magnetX}
        y="165"
        width="75"
        height="90"
        rx="18"
        fill={analysis.pole === 'N' ? '#FEE2E2' : '#DBEAFE'}
      />
      <rect
        x={magnetX + 75}
        y="165"
        width="75"
        height="90"
        rx="18"
        fill={analysis.pole === 'N' ? '#DBEAFE' : '#FEE2E2'}
      />
      <text
        x={magnetX + 38}
        y="218"
        fill={pageStyle.text}
        fontSize="28"
        fontWeight="700"
        textAnchor="middle"
      >
        {analysis.pole}
      </text>
      <text
        x={magnetX + 112}
        y="218"
        fill={pageStyle.text}
        fontSize="28"
        fontWeight="700"
        textAnchor="middle"
      >
        {analysis.pole === 'N' ? 'S' : 'N'}
      </text>
      <text x={magnetX + 18} y="154" fill={pageStyle.secondary} fontSize="12">
        线圈侧磁极
      </text>

      <line
        x1={magnetX + 75}
        y1="132"
        x2={magnetX + (analysis.motion === 'insert' ? 10 : 140)}
        y2="132"
        stroke={pageStyle.motion}
        strokeWidth="4"
        markerEnd="url(#lenz-arrow-motion)"
      />
      <text x={magnetX + 10} y="116" fill={pageStyle.motion} fontSize="12" fontWeight="600">
        运动：{LENZ_MOTION_LABELS[analysis.motion]}
      </text>

      {showOriginalFlux && (
        <>
          <line
            x1={analysis.originalFluxDirection === 'left' ? 330 : 150}
            y1="120"
            x2={analysis.originalFluxDirection === 'left' ? 150 : 330}
            y2="120"
            stroke={pageStyle.flux}
            strokeWidth="4"
            markerEnd="url(#lenz-arrow-flux)"
          />
          <text x="156" y="102" fill={pageStyle.flux} fontSize="12" fontWeight="600">
            原磁通量：{LENZ_AXIS_DIRECTION_LABELS[analysis.originalFluxDirection]}
          </text>
        </>
      )}

      {showFluxChange && (
        <>
          <line
            x1={analysis.fluxChangeTrend === 'increase' ? 148 : 332}
            y1="148"
            x2={analysis.fluxChangeTrend === 'increase' ? 332 : 148}
            y2="148"
            stroke={pageStyle.change}
            strokeWidth="4"
            strokeDasharray="8 6"
            markerEnd="url(#lenz-arrow-change)"
          />
          <text x="156" y="166" fill={pageStyle.change} fontSize="12" fontWeight="600">
            磁通量变化：{LENZ_FLUX_CHANGE_LABELS[analysis.fluxChangeTrend]}
          </text>
        </>
      )}

      {showInducedField && (
        <>
          <line
            x1={analysis.inducedFieldDirection === 'left' ? 330 : 150}
            y1="286"
            x2={analysis.inducedFieldDirection === 'left' ? 150 : 330}
            y2="286"
            stroke={pageStyle.field}
            strokeWidth="4"
            markerEnd="url(#lenz-arrow-field)"
          />
          <text x="156" y="306" fill={pageStyle.field} fontSize="12" fontWeight="600">
            感应磁场：{LENZ_AXIS_DIRECTION_LABELS[analysis.inducedFieldDirection]}
          </text>
        </>
      )}

      {showForce && (
        <>
          <line
            x1={magnetX + 75}
            y1="90"
            x2={magnetX + (analysis.ampereForceDirection === 'left' ? 5 : 145)}
            y2="90"
            stroke={pageStyle.force}
            strokeWidth="4"
            markerEnd="url(#lenz-arrow-force)"
          />
          <text x={magnetX + 8} y="74" fill={pageStyle.force} fontSize="12" fontWeight="600">
            安培力：{LENZ_INTERACTION_LABELS[analysis.interaction]}，{LENZ_AXIS_DIRECTION_LABELS[analysis.ampereForceDirection]}
          </text>
        </>
      )}

      <rect
        x="486"
        y="70"
        width="220"
        height="250"
        rx="24"
        fill="#FFFFFF"
        stroke={pageStyle.border}
      />
      <circle
        cx="596"
        cy="190"
        r="78"
        fill={showCurrent ? '#FFF7ED' : '#F8FAFC'}
        stroke={showCurrent ? pageStyle.current : '#CBD5E1'}
        strokeWidth="3"
      />
      <text x="596" y="126" fill={pageStyle.secondary} fontSize="12" textAnchor="middle">
        观察方向固定为从右看
      </text>
      <text
        x="596"
        y="202"
        fill={showCurrent ? pageStyle.current : '#94A3B8'}
        fontSize="42"
        fontWeight="700"
        textAnchor="middle"
      >
        {showCurrent
          ? analysis.inducedCurrentDirection === 'counterclockwise'
            ? '↺'
            : '↻'
          : '·'}
      </text>
      <text
        x="596"
        y="236"
        fill={showCurrent ? pageStyle.current : pageStyle.muted}
        fontSize="15"
        fontWeight="600"
        textAnchor="middle"
      >
        {showCurrent ? LENZ_CURRENT_DIRECTION_LABELS[analysis.inducedCurrentDirection] : '等待第 3 步'}
      </text>
      <text x="596" y="274" fill={pageStyle.secondary} fontSize="12" textAnchor="middle">
        {showInducedField
          ? `对应感应磁场 ${LENZ_AXIS_DIRECTION_LABELS[analysis.inducedFieldDirection]}`
          : '先判断磁通量变化，再判断感应电流'}
      </text>
    </svg>
  );
}

function HeaderBadge({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-full px-3 py-1.5"
      style={{
        backgroundColor: '#FFF4E8',
        color: pageStyle.primary,
      }}
    >
      <span className="mr-1 opacity-80">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

function PanelCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="mb-4 rounded-3xl border p-4"
      style={{
        backgroundColor: pageStyle.panelBg,
        borderColor: pageStyle.border,
        boxShadow: SHADOWS.sm,
      }}
    >
      <h2 className="mb-3 text-sm font-semibold" style={{ color: pageStyle.text }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

function OptionGroup({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-sm font-medium" style={{ color: pageStyle.secondary }}>
        {label}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className="rounded-2xl px-3 py-2 text-sm font-medium"
              style={{
                color: active ? pageStyle.primary : pageStyle.secondary,
                backgroundColor: active ? pageStyle.primarySoft : pageStyle.blockSoft,
                border: `1px solid ${active ? '#F4C48B' : pageStyle.border}`,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 text-sm">
      <span style={{ color: pageStyle.secondary }}>{label}</span>
      <span className="text-right font-medium" style={{ color: pageStyle.text }}>
        {value}
      </span>
    </div>
  );
}

function LegendBadge({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="rounded-full px-2.5 py-1"
      style={{
        color,
        backgroundColor: `${color}16`,
      }}
    >
      {label}
    </span>
  );
}

const primaryButtonStyle = {
  color: '#FFFFFF',
  backgroundColor: pageStyle.primary,
  border: `1px solid ${pageStyle.primary}`,
};

const secondaryButtonStyle = {
  color: pageStyle.secondary,
  backgroundColor: pageStyle.blockBg,
  border: `1px solid ${pageStyle.border}`,
};
