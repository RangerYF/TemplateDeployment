import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Slider } from '@/components/ui/slider';
import {
  computeSolenoidCenterField,
  computeSolenoidUniformity,
  describeSolenoidMode,
  describeSolenoidView,
  findSolenoidEntity,
  getSolenoidCurrent,
  getSolenoidDirectionLabel,
  getSolenoidFieldSign,
  getSolenoidLength,
  getSolenoidRadius,
  getSolenoidTurns,
  getTeachingStepDescription,
  getTeachingStepTitle,
  type TeachingStep,
} from '@/domains/em/logic/solenoid-teaching';
import { getSolenoidCurrentDirectionLabel } from '@/domains/em/logic/current-direction';
import { useSimulationStore } from '@/store';
import { COLORS } from '@/styles/tokens';
import { SolenoidStage } from './solenoid/SolenoidStage';

interface SolenoidBFieldTeachingWorkspaceProps {
  onBack: () => void;
  onValueChange: (key: string, value: number | boolean | string) => void;
}

function formatMilliTesla(valueTesla: number): string {
  return `${(valueTesla * 1000).toFixed(2)} mT`;
}

function GlassCard({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        borderRadius: 28,
        border: '1px solid rgba(255,255,255,0.54)',
        background: 'linear-gradient(180deg, rgba(255,255,255,0.84) 0%, rgba(247,250,255,0.62) 100%)',
        backdropFilter: 'blur(18px)',
        boxShadow: '0 24px 56px rgba(20, 28, 48, 0.08)',
        padding: 22,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#6182A7' }}>
        {eyebrow}
      </div>
      <div style={{ marginTop: 8, fontSize: 20, fontWeight: 760, color: COLORS.text }}>
        {title}
      </div>
      <div style={{ marginTop: 16, display: 'grid', gap: 16 }}>
        {children}
      </div>
    </section>
  );
}

function SegmentButton({
  active,
  label,
  subLabel,
  onClick,
}: {
  active: boolean;
  label: string;
  subLabel?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        borderRadius: 18,
        border: active ? '1px solid rgba(56, 134, 255, 0.72)' : '1px solid rgba(191, 204, 225, 0.82)',
        background: active
          ? 'linear-gradient(180deg, rgba(233,244,255,0.98) 0%, rgba(217,236,255,0.92) 100%)'
          : 'rgba(255,255,255,0.7)',
        color: COLORS.text,
        padding: '12px 14px',
        textAlign: 'left',
        transition: 'all 180ms ease',
        boxShadow: active ? '0 12px 24px rgba(56, 134, 255, 0.16)' : 'none',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 700 }}>{label}</div>
      {subLabel && (
        <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.6, color: COLORS.textMuted }}>
          {subLabel}
        </div>
      )}
    </button>
  );
}

function SectionText({
  title,
  description,
  value,
}: {
  title: string;
  description: string;
  value?: string;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{title}</div>
        {value && (
          <div
            style={{
              padding: '4px 10px',
              borderRadius: 999,
              background: 'rgba(53, 118, 228, 0.08)',
              color: '#245FD6',
              fontSize: 12,
              fontWeight: 700,
            }}
          >
            {value}
          </div>
        )}
      </div>
      <div style={{ marginTop: 6, fontSize: 12, lineHeight: 1.7, color: COLORS.textMuted }}>
        {description}
      </div>
    </div>
  );
}

function ValueSlider({
  label,
  value,
  unit,
  description,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  unit: string;
  description: string;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <div
      style={{
        padding: 16,
        borderRadius: 20,
        border: '1px solid rgba(201, 211, 228, 0.8)',
        background: 'rgba(255,255,255,0.74)',
      }}
    >
      <SectionText
        title={label}
        description={description}
        value={`${value.toFixed(step >= 1 ? 0 : 1)} ${unit}`}
      />
      <div style={{ marginTop: 16 }}>
        <Slider
          value={[value]}
          min={min}
          max={max}
          step={step}
          onValueChange={([next]) => {
            if (next !== undefined) onChange(next);
          }}
        />
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'blue' | 'amber' | 'slate';
}) {
  const tones = {
    blue: {
      background: 'linear-gradient(180deg, rgba(235,245,255,0.96) 0%, rgba(221,236,255,0.92) 100%)',
      border: 'rgba(90, 152, 255, 0.38)',
      color: '#1A5ED8',
    },
    amber: {
      background: 'linear-gradient(180deg, rgba(255,245,233,0.96) 0%, rgba(255,235,208,0.92) 100%)',
      border: 'rgba(219, 146, 48, 0.34)',
      color: '#A85A0C',
    },
    slate: {
      background: 'linear-gradient(180deg, rgba(247,249,252,0.94) 0%, rgba(239,243,248,0.92) 100%)',
      border: 'rgba(188, 198, 214, 0.42)',
      color: COLORS.text,
    },
  } satisfies Record<string, { background: string; border: string; color: string }>;
  const palette = tones[tone ?? 'slate'];

  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px solid ${palette.border}`,
        background: palette.background,
        padding: '16px 18px',
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#6E809D' }}>{label}</div>
      <div style={{ marginTop: 8, fontSize: 24, fontWeight: 760, color: palette.color }}>{value}</div>
    </div>
  );
}

function HintPill({ text }: { text: string }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        borderRadius: 16,
        background: 'rgba(244,247,252,0.9)',
        border: '1px solid rgba(213,220,232,0.84)',
        fontSize: 12,
        lineHeight: 1.7,
        color: COLORS.textMuted,
      }}
    >
      {text}
    </div>
  );
}

export function SolenoidBFieldTeachingWorkspace({
  onBack,
  onValueChange,
}: SolenoidBFieldTeachingWorkspaceProps) {
  const entities = useSimulationStore((state) => state.simulationState.scene.entities);
  const paramValues = useSimulationStore((state) => state.paramValues);
  const solenoidTeaching = useSimulationStore((state) => state.solenoidTeaching);
  const setSolenoidDisplayMode = useSimulationStore((state) => state.setSolenoidDisplayMode);
  const setSolenoidViewMode = useSimulationStore((state) => state.setSolenoidViewMode);
  const setSolenoidHoverSample = useSimulationStore((state) => state.setSolenoidHoverSample);

  const solenoid = useMemo(() => findSolenoidEntity(entities), [entities]);
  const current = getSolenoidCurrent(solenoid, paramValues);
  const turns = getSolenoidTurns(solenoid, paramValues);
  const length = getSolenoidLength(solenoid);
  const radius = getSolenoidRadius(solenoid);
  const directionSign = getSolenoidFieldSign(solenoid);
  const directionLabel = getSolenoidDirectionLabel(solenoid);
  const currentDirectionLabel = solenoid ? getSolenoidCurrentDirectionLabel(solenoid) : '上侧向右';

  const centerField = computeSolenoidCenterField(current, turns, length);
  const turnDensity = turns / Math.max(length, 1e-6);
  const uniformity = computeSolenoidUniformity(turns);

  const [teachingMode, setTeachingMode] = useState(true);
  const [teachingStep, setTeachingStep] = useState<TeachingStep>(3);
  const [teachingPlaying, setTeachingPlaying] = useState(false);

  useEffect(() => {
    if (!teachingMode || !teachingPlaying) return undefined;
    const timer = window.setInterval(() => {
      setTeachingStep((step) => (step === 3 ? 1 : ((step + 1) as TeachingStep)));
    }, 2800);
    return () => window.clearInterval(timer);
  }, [teachingMode, teachingPlaying]);

  const modeSummary = describeSolenoidMode(solenoidTeaching.displayMode);
  const viewSummary = describeSolenoidView(solenoidTeaching.viewMode);

  const hoverDetails = solenoidTeaching.hoverSample;
  const autoHints = teachingMode
    ? [
        teachingStep === 3 ? '内部磁场趋于均匀，箭头与粒子速度会在轴心区域明显稳定。'
          : teachingStep === 2 ? '多个线圈叠加后，中心区域场强增强，端部回流仍然可见。'
            : '单个线圈更接近偶极场，外部闭合回路占主导。',
        '外部磁场形成闭合回路，并从一端弯曲返回另一端。',
      ]
    : [
        '切换电流方向时，磁场方向会按右手定则整体反转。',
        '内部颜色更深、粒子更快，表示 B ≈ μ₀nI 下中心区域更强。',
      ];

  return (
    <div
      style={{
        minHeight: '100vh',
        padding: 24,
        background: `
          radial-gradient(circle at top left, rgba(244,247,251,0.98) 0%, rgba(236,241,248,0.94) 34%, rgba(229,235,244,1) 100%),
          linear-gradient(135deg, rgba(255,255,255,0.45), rgba(232,238,247,0.58))
        `,
        fontFamily: '"Avenir Next", "SF Pro Display", "PingFang SC", "Segoe UI", sans-serif',
      }}
    >
      <div style={{ maxWidth: 1640, margin: '0 auto', display: 'grid', gap: 18 }}>
        <section
          style={{
            borderRadius: 32,
            border: '1px solid rgba(255,255,255,0.58)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.86) 0%, rgba(248,250,254,0.74) 100%)',
            backdropFilter: 'blur(18px)',
            boxShadow: '0 28px 64px rgba(23, 32, 50, 0.08)',
            padding: '24px 26px',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ maxWidth: 860 }}>
              <button
                onClick={onBack}
                style={{
                  border: 'none',
                  background: 'transparent',
                  padding: 0,
                  color: COLORS.textSecondary,
                  fontSize: 12,
                  cursor: 'pointer',
                }}
              >
                ← 返回 P-08
              </button>
              <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#5F81A9' }}>
                P-08 · SOLENOID MAGNETIC FIELD STUDIO
              </div>
              <h1 style={{ marginTop: 10, fontSize: 34, fontWeight: 800, color: COLORS.text }}>
                螺线管磁场可视化页面
              </h1>
              <div style={{ marginTop: 10, fontSize: 14, lineHeight: 1.9, color: COLORS.textMuted }}>
                这版重构把主画面收回到“现代版教材插图”方向：浅色背景、放大的螺线管主体、规则的内部平行箭头和外部闭合回路，让学生第一眼就能看懂磁场结构。
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: 12,
                minWidth: 500,
                flex: '1 1 500px',
              }}
            >
              <MetricCard label="CENTER FIELD" value={formatMilliTesla(centerField)} tone="blue" />
              <MetricCard label="TURN DENSITY" value={`${turnDensity.toFixed(0)} 匝/m`} tone="amber" />
              <MetricCard label="RIGHT-HAND RULE" value={`B ${directionLabel}`} tone="slate" />
            </div>
          </div>
        </section>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '288px minmax(0, 2.3fr) 304px',
            gap: 18,
            minHeight: 0,
          }}
        >
          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <GlassCard eyebrow="VISUALIZE" title="显示模式与视角">
              <SectionText
                title="磁场显示模式"
                description="教材模式是默认主模式；其他模式也只做克制增强，不再使用炫光或粒子特效。"
              />
              <div style={{ display: 'grid', gap: 10 }}>
                {([
                  {
                    key: 'textbook',
                    label: '教材模式',
                    subLabel: '内部平行直线，外部闭合回路，默认用于课堂讲解。',
                  },
                  {
                    key: 'particles',
                    label: '方向点模式',
                    subLabel: '只增加少量运动点，帮助追踪磁场方向，不做粒子秀。',
                  },
                  {
                    key: 'volume',
                    label: '强度阴影',
                    subLabel: '用浅色阴影提示内部更强、更均匀，保持教材插图风格。',
                  },
                ] as const).map((item) => (
                  <SegmentButton
                    key={item.key}
                    active={solenoidTeaching.displayMode === item.key}
                    label={item.label}
                    subLabel={item.subLabel}
                    onClick={() => setSolenoidDisplayMode(item.key)}
                  />
                ))}
              </div>

              <SectionText
                title="视角预设"
                description="默认是最清楚的斜侧教材视角；预设按钮用于切换到更强调某一物理关系的观察方式。"
              />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                {([
                  { key: 'front', label: '正视图' },
                  { key: 'side', label: '侧视图' },
                  { key: 'section', label: '轴向剖面' },
                  { key: 'orbit', label: '自由轨道' },
                ] as const).map((item) => (
                  <SegmentButton
                    key={item.key}
                    active={solenoidTeaching.viewMode === item.key}
                    label={item.label}
                    onClick={() => setSolenoidViewMode(item.key)}
                  />
                ))}
              </div>
            </GlassCard>

            <GlassCard eyebrow="PARAMS" title="实验参数">
              <ValueSlider
                label="电流 I"
                value={current}
                unit="A"
                description="电流增大时，内部磁场增强，教材线条更密，粒子与体积场响应也会更强。"
                min={0.5}
                max={10}
                step={0.5}
                onChange={(value) => onValueChange('current', value)}
              />
              <ValueSlider
                label="匝数 N"
                value={turns}
                unit="匝"
                description="匝数越多，匝密度 n 越大，中心区域越接近均匀场。"
                min={50}
                max={2000}
                step={50}
                onChange={(value) => onValueChange('turns', value)}
              />

              <SectionText
                title="电流方向"
                description="UI 切换后，线圈电流方向与磁场方向会按右手定则同步反转。"
              />
              <div style={{ display: 'grid', gap: 10 }}>
                <SegmentButton
                  active={currentDirectionLabel === '上侧向右'}
                  label="上侧向右"
                  subLabel="内部 B 自动指向右"
                  onClick={() => onValueChange('currentDirectionMode', 'rightward')}
                />
                <SegmentButton
                  active={currentDirectionLabel === '上侧向左'}
                  label="上侧向左"
                  subLabel="内部 B 自动指向左"
                  onClick={() => onValueChange('currentDirectionMode', 'leftward')}
                />
              </div>
            </GlassCard>
          </div>

          <div
            style={{
              borderRadius: 32,
              border: '1px solid rgba(255,255,255,0.6)',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(244,247,252,0.70) 100%)',
              backdropFilter: 'blur(18px)',
              boxShadow: '0 28px 68px rgba(18, 25, 42, 0.12)',
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: 'auto minmax(0, 1fr) auto',
            }}
          >
            <div
              style={{
                padding: '18px 20px 14px',
                borderBottom: '1px solid rgba(186, 199, 220, 0.32)',
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 18,
              }}
            >
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.14em', color: '#5F81A9' }}>
                  TEXTBOOK VIEW
                </div>
                <div style={{ marginTop: 8, fontSize: 22, fontWeight: 780, color: COLORS.text }}>
                  教材友好的螺线管磁场主图
                </div>
                <div style={{ marginTop: 8, fontSize: 13, lineHeight: 1.8, color: COLORS.textMuted }}>
                  {modeSummary} {viewSummary}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, minWidth: 350 }}>
                <MetricCard label="I" value={`${current.toFixed(1)} A`} tone="slate" />
                <MetricCard label="N" value={`${turns} 匝`} tone="slate" />
                <MetricCard label="B DIR" value={directionLabel} tone="blue" />
              </div>
            </div>

            <div style={{ padding: 16, minHeight: 0 }}>
              <SolenoidStage
                current={current}
                turns={turns}
                length={length}
                radius={radius}
                directionSign={directionSign}
                displayMode={solenoidTeaching.displayMode}
                viewMode={solenoidTeaching.viewMode}
                teachingStep={teachingMode ? teachingStep : 3}
                hoverSample={solenoidTeaching.hoverSample}
                onHoverSample={setSolenoidHoverSample}
              />
            </div>

            <div
              style={{
                padding: '16px 20px 20px',
                borderTop: '1px solid rgba(186, 199, 220, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <HintPill text="内部磁场：颜色更深、粒子更快、线条更密。" />
                <HintPill text="外部磁场：闭合回路返回，强度逐渐衰减。" />
                <HintPill text="剖面模式：heatmap + arrows 同时显示 inside/outside 差异。" />
              </div>
              <div style={{ fontSize: 12, color: COLORS.textMuted }}>
                鼠标拖拽旋转，滚轮缩放，释放后保留惯性
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <GlassCard eyebrow="TEACHING" title="教学模式">
              <div
                style={{
                  padding: 16,
                  borderRadius: 20,
                  border: '1px solid rgba(201, 211, 228, 0.8)',
                  background: 'rgba(255,255,255,0.74)',
                  display: 'grid',
                  gap: 12,
                }}
              >
                <SectionText
                  title="教学引导"
                  description="把磁场从单个线圈推进到多匝叠加，再过渡到均匀场，适合讲完整个形成过程。"
                  value={teachingMode ? '已开启' : '已关闭'}
                />
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                  <SegmentButton
                    active={teachingMode}
                    label="教学模式"
                    subLabel="显示步骤提示"
                    onClick={() => setTeachingMode(true)}
                  />
                  <SegmentButton
                    active={!teachingMode}
                    label="自由观察"
                    subLabel="保持完整螺线管"
                    onClick={() => {
                      setTeachingMode(false);
                      setTeachingPlaying(false);
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {[1, 2, 3].map((step) => (
                  <SegmentButton
                    key={step}
                    active={teachingStep === step}
                    label={getTeachingStepTitle(step as TeachingStep)}
                    subLabel={getTeachingStepDescription(step as TeachingStep)}
                    onClick={() => {
                      setTeachingMode(true);
                      setTeachingStep(step as TeachingStep);
                    }}
                  />
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
                <SegmentButton
                  active={teachingPlaying}
                  label={teachingPlaying ? '播放中' : '自动演示'}
                  subLabel="按 1 → 2 → 3 顺序轮播"
                  onClick={() => {
                    setTeachingMode(true);
                    setTeachingPlaying((value) => !value);
                  }}
                />
                <SegmentButton
                  active={!teachingPlaying}
                  label="暂停"
                  subLabel="停在当前步骤讲解"
                  onClick={() => setTeachingPlaying(false)}
                />
              </div>
            </GlassCard>

            <GlassCard eyebrow="READOUTS" title="实时信息">
              <div style={{ display: 'grid', gap: 12 }}>
                <MetricCard label="中心磁场 B₀" value={formatMilliTesla(centerField)} tone="blue" />
                <MetricCard label="场均匀度" value={`${(uniformity * 100).toFixed(0)}%`} tone="amber" />
                <MetricCard label="当前电流方向" value={currentDirectionLabel} tone="slate" />
              </div>

              <div
                style={{
                  padding: 16,
                  borderRadius: 20,
                  border: '1px solid rgba(201, 211, 228, 0.8)',
                  background: 'rgba(255,255,255,0.74)',
                }}
              >
                <SectionText
                  title="Hover 采样"
                  description="悬停舞台任一点，会显示局部 B 的大小、方向和区域属性。"
                />
                <div style={{ marginTop: 12, display: 'grid', gap: 6, fontSize: 13, lineHeight: 1.8, color: COLORS.textMuted }}>
                  {hoverDetails ? (
                    <>
                      <span>B 大小：{formatMilliTesla(hoverDetails.magnitude)}</span>
                      <span>方向：{hoverDetails.directionLabel}</span>
                      <span>区域：{hoverDetails.region}</span>
                    </>
                  ) : (
                    <span>将鼠标移入舞台，查看 inside / outside 的局部磁场信息。</span>
                  )}
                </div>
              </div>
            </GlassCard>

            <GlassCard eyebrow="GUIDANCE" title="自动提示">
              <HintPill text={autoHints[0] ?? ''} />
              <HintPill text={autoHints[1] ?? ''} />
              <HintPill text="电流方向切换后，内部 B 方向、外部回流箭头和 hover 方向标签会实时反转。" />
              <HintPill text="所有模式都保留教材线条结构，只在点运动或浅色阴影上做轻量增强。" />
            </GlassCard>
          </div>
        </div>
      </div>
    </div>
  );
}
