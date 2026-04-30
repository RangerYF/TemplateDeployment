import { useEffect, useMemo, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import type {
  P13DoubleRodAnalysisStep,
  P13DoubleRodState,
} from '@/domains/em/p13/types';
import {
  P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS,
  P13_DOUBLE_ROD_CURRENT_DIRECTION_LABELS,
  P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS,
  P13_DOUBLE_ROD_PARAM_CONFIG,
  P13_DOUBLE_ROD_VERTICAL_DIRECTION_LABELS,
  type P13DoubleRodParamKey,
  buildDoubleRodAnalysisSteps,
  getDoubleRodVariantMeta,
  normalizeDoubleRodParams,
  sampleDoubleRodStateAtTime,
  simulateDoubleRodModel,
} from '@/domains/em/p13/double-rod';
import {
  P13LegendBadge,
  P13MetricLine,
  P13PanelCard,
  P13WorkbenchShell,
  P13_SHELL_COLORS,
} from './p13/P13WorkbenchShell';
import { P13TimeSeriesChart } from './p13/P13TimeSeriesChart';

interface Props {
  onBack: () => void;
}

const PRIMARY_BUTTON_STYLE = {
  color: '#FFFFFF',
  backgroundColor: P13_SHELL_COLORS.primary,
  border: `1px solid ${P13_SHELL_COLORS.primary}`,
};

const SECONDARY_BUTTON_STYLE = {
  color: P13_SHELL_COLORS.secondary,
  backgroundColor: P13_SHELL_COLORS.blockBg,
  border: `1px solid ${P13_SHELL_COLORS.border}`,
};

const PLAYBACK_REALTIME_SECONDS = 6;
const VARIANT = 'basic-frictionless' as const;

export function P13DoubleRodBasicPage({ onBack }: Props) {
  const meta = getDoubleRodVariantMeta(VARIANT);
  const [params, setParams] = useState(() => normalizeDoubleRodParams(VARIANT));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);

  useEffect(() => {
    simulator.unload();
  }, []);

  const result = useMemo(
    () => simulateDoubleRodModel(VARIANT, params),
    [params],
  );
  const currentState = useMemo(
    () => sampleDoubleRodStateAtTime(result, currentTime),
    [result, currentTime],
  );
  const analysisSteps = useMemo(
    () => buildDoubleRodAnalysisSteps(result, currentState),
    [result, currentState],
  );
  const playbackPhysicalRate = useMemo(
    () => Math.max(result.duration / PLAYBACK_REALTIME_SECONDS, 1e-6),
    [result.duration],
  );

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(true);
    setAnalysisStep(0);
  }, [result]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setCurrentTime((previous) =>
        Math.min(result.duration, previous + (elapsed * playbackPhysicalRate)),
      );
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [isPlaying, playbackPhysicalRate, result.duration]);

  useEffect(() => {
    if (currentTime >= result.duration - 1e-6) {
      setCurrentTime(result.duration);
      setIsPlaying(false);
    }
  }, [currentTime, result.duration]);

  function updateNumericParam(key: P13DoubleRodParamKey, value: number): void {
    setParams((previous) => normalizeDoubleRodParams(VARIANT, { ...previous, [key]: value }));
  }

  function togglePlayback(): void {
    if (currentTime >= result.duration - 1e-6) {
      setCurrentTime(0);
    }
    setIsPlaying((previous) => !previous || currentTime >= result.duration - 1e-6);
  }

  function resetPlayback(): void {
    setCurrentTime(0);
    setIsPlaying(false);
    setAnalysisStep(0);
  }

  const currentCoastSpeed = computeCurrentCoastSpeed(currentState, result.params.mass1, result.params.mass2);

  const badges = [
    { label: '模型', value: meta.code, tone: 'primary' as const },
    {
      label: '总电阻',
      value: `${formatNumber(currentState.totalResistance, 2)} Ω`,
      tone: 'muted' as const,
    },
    {
      label: '相对速度',
      value: `Δv = ${formatNumber(currentState.relativeVelocity, 3)} m/s`,
      tone: 'muted' as const,
    },
    {
      label: '当前电流',
      value: `${formatNumber(currentState.current, 3)} A`,
      tone: 'warning' as const,
    },
  ];

  return (
    <P13WorkbenchShell
      title={`${meta.code} ${meta.title}`}
      subtitle={meta.pageSubtitle}
      onBack={onBack}
      badges={badges}
      modelRail={<DoubleRodModelRail />}
      leftPanel={
        <div className="space-y-4">
          <P13PanelCard
            title="参数区"
            subtitle="仅开放 EMI-021 的课堂理想参数，不引入摩擦、自感和接触电阻变化。"
          >
            <div className="space-y-4">
              {meta.visibleParamKeys.map((key) => {
                const config = P13_DOUBLE_ROD_PARAM_CONFIG[key];
                return (
                  <ParameterSlider
                    key={key}
                    label={config.label}
                    unit={config.unit}
                    min={config.min}
                    max={config.max}
                    step={config.step}
                    value={params[key]}
                    onChange={(value) => updateNumericParam(key, value)}
                  />
                );
              })}
            </div>
          </P13PanelCard>

          <P13PanelCard title="模型约定">
            <P13MetricLine label="磁场方向" value="垂直纸面向内 ×" />
            <P13MetricLine label="回路电动势" value="ε = BL(v1 - v2)" />
            <P13MetricLine label="回路电流" value="i = ε / (R1 + R2)" />
            <P13MetricLine label="安培力" value="F1 = -F2 = BIL" />
            <div
              className="mt-3 rounded-2xl px-3 py-3 text-xs leading-6"
              style={{
                color: P13_SHELL_COLORS.secondary,
                backgroundColor: P13_SHELL_COLORS.blockSoft,
              }}
            >
              {result.summary.adoptedConvention}
            </div>
          </P13PanelCard>

          <P13PanelCard title="当前耦合量">
            <P13MetricLine label="v1" value={`${formatNumber(currentState.velocity1, 3)} m/s`} emphasis />
            <P13MetricLine label="v2" value={`${formatNumber(currentState.velocity2, 3)} m/s`} emphasis />
            <P13MetricLine label="Δv = v1 - v2" value={`${formatNumber(currentState.relativeVelocity, 3)} m/s`} emphasis />
            <P13MetricLine label="ε = BLΔv" value={`${formatNumber(currentState.emf, 3)} V`} emphasis />
            <P13MetricLine label="i = ε / (R1 + R2)" value={`${formatNumber(currentState.current, 3)} A`} emphasis />
            <P13MetricLine label="F1 / F2" value={`${formatNumber(currentState.ampereForceOnRod1, 3)} N / ${formatNumber(currentState.ampereForceOnRod2, 3)} N`} />
            <P13MetricLine label="a1 / a2" value={`${formatNumber(currentState.acceleration1, 3)} / ${formatNumber(currentState.acceleration2, 3)} m/s²`} />
          </P13PanelCard>
        </div>
      }
      stagePanel={
        <P13PanelCard
          title="视觉演示区"
          subtitle="双棒回路按同一时刻联动刷新：相对速度、感应电动势、电流方向和两棒安培力方向同步显示。"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <P13LegendBadge label="棒1速度 v1" color={P13_SHELL_COLORS.velocity} />
              <P13LegendBadge label="棒2速度 v2" color={P13_SHELL_COLORS.field} />
              <P13LegendBadge label="电动势 ε" color={P13_SHELL_COLORS.emf} />
              <P13LegendBadge label="电流 i" color={P13_SHELL_COLORS.current} />
              <P13LegendBadge label="安培力 F1/F2" color={P13_SHELL_COLORS.force} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={togglePlayback}
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={PRIMARY_BUTTON_STYLE}
              >
                {isPlaying ? '暂停' : currentTime >= result.duration - 1e-6 ? '重播' : '播放'}
              </button>
              <button
                onClick={resetPlayback}
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={SECONDARY_BUTTON_STYLE}
              >
                回到起点
              </button>
            </div>
          </div>

          <DoubleRodStage
            result={result}
            state={currentState}
            analysisStep={analysisStep}
          />

          <div className="mt-4">
            <div
              className="mb-2 flex items-center justify-between text-xs"
              style={{ color: P13_SHELL_COLORS.muted }}
            >
              <span>时间推进</span>
              <span>
                t = {formatPhysicalTime(currentTime)} / {formatPhysicalTime(result.duration)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={result.duration}
              step={result.timeStep}
              value={currentTime}
              className="w-full"
              onChange={(event) => {
                setIsPlaying(false);
                setCurrentTime(Number(event.target.value));
              }}
            />
          </div>
        </P13PanelCard>
      }
      chartPanel={
        <div className="grid gap-4 xl:grid-cols-3">
          <P13TimeSeriesChart
            title="v1-t 图"
            unit="m/s"
            color={P13_SHELL_COLORS.velocity}
            formula="m1 dv1/dt = -B²L²(v1-v2)/(R1+R2)"
            samples={result.samples.map((sample) => ({
              time: sample.time,
              value: sample.velocity1,
            }))}
            currentTime={currentTime}
            currentValue={currentState.velocity1}
          />
          <P13TimeSeriesChart
            title="v2-t 图"
            unit="m/s"
            color={P13_SHELL_COLORS.field}
            formula="m2 dv2/dt = +B²L²(v1-v2)/(R1+R2)"
            samples={result.samples.map((sample) => ({
              time: sample.time,
              value: sample.velocity2,
            }))}
            currentTime={currentTime}
            currentValue={currentState.velocity2}
          />
          <P13TimeSeriesChart
            title="i-t 图"
            unit="A"
            color={P13_SHELL_COLORS.current}
            formula={meta.currentFormula}
            samples={result.samples.map((sample) => ({
              time: sample.time,
              value: sample.current,
            }))}
            currentTime={currentTime}
            currentValue={currentState.current}
          />
        </div>
      }
      analysisPanel={
        <P13PanelCard
          title="分步分析入口"
          subtitle="按课堂链路：相对运动 → 感应电动势 → 回路电流 → 两棒安培力。"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={() => {
                setIsPlaying(false);
                setAnalysisStep(1);
              }}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={PRIMARY_BUTTON_STYLE}
            >
              开始分析
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setAnalysisStep((previous) =>
                  Math.min(P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS, previous + 1),
                );
              }}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                ...SECONDARY_BUTTON_STYLE,
                opacity: analysisStep >= P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS ? 0.45 : 1,
              }}
              disabled={analysisStep >= P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS}
            >
              下一步
            </button>
            <button
              onClick={() => setAnalysisStep(0)}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={SECONDARY_BUTTON_STYLE}
            >
              重置
            </button>
          </div>

          <div className="space-y-3">
            {analysisSteps.map((step, index) => (
              <AnalysisStepCard
                key={step.key}
                step={step}
                index={index}
                active={analysisStep > 0 && index === analysisStep - 1}
                visible={index < analysisStep}
              />
            ))}
          </div>
        </P13PanelCard>
      }
      resultPanel={
        <P13PanelCard
          title="终态结果区"
          subtitle="终态共速按动量守恒给出，并和当前状态、观测窗末态并排对比。"
        >
          <div
            className="mb-4 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: P13_SHELL_COLORS.primarySoft,
              border: `1px solid ${P13_SHELL_COLORS.primaryBorder}`,
            }}
          >
            <div className="text-sm font-semibold" style={{ color: P13_SHELL_COLORS.primary }}>
              {meta.terminalHeadline}
            </div>
            <p className="mt-1 text-xs leading-5" style={{ color: P13_SHELL_COLORS.secondary }}>
              {result.summary.terminalExplanation}
            </p>
          </div>

          <P13MetricLine label="当前共速（按动量）" value={`${formatNumber(currentCoastSpeed, 4)} m/s`} emphasis />
          <P13MetricLine label="理论终态共速" value={`${formatNumber(result.summary.theoreticalTerminalVelocity, 4)} m/s`} emphasis />
          <P13MetricLine label="当前电流" value={`${formatNumber(currentState.current, 4)} A`} emphasis />
          <P13MetricLine label="理论终态电流" value={`${formatNumber(result.summary.theoreticalTerminalCurrent, 4)} A`} emphasis />
          <P13MetricLine label="当前速度差 |v1-v2|" value={`${formatNumber(Math.abs(currentState.relativeVelocity), 4)} m/s`} />
          <P13MetricLine label="观测窗末 v1" value={`${formatNumber(result.samples[result.samples.length - 1]?.velocity1 ?? 0, 4)} m/s`} />
          <P13MetricLine label="观测窗末 v2" value={`${formatNumber(result.samples[result.samples.length - 1]?.velocity2 ?? 0, 4)} m/s`} />
          <P13MetricLine label="时间常数 τ" value={formatPhysicalTime(result.summary.timeConstant)} />
          <P13MetricLine label="初始总动量 p0" value={`${formatNumber(result.summary.initialMomentum, 4)} kg·m/s`} />
          <P13MetricLine label="当前总动量 p" value={`${formatNumber(currentState.momentum, 4)} kg·m/s`} />
          <div
            className="mt-4 rounded-2xl px-3 py-3 text-xs leading-6"
            style={{
              color: P13_SHELL_COLORS.secondary,
              backgroundColor: P13_SHELL_COLORS.blockSoft,
            }}
          >
            动量守恒口径：v_terminal = (m1·v1_0 + m2·v2_0) / (m1 + m2)。模型内实时展示的“当前共速（按动量）”与该理论值一致。
          </div>
        </P13PanelCard>
      }
    />
  );
}

function DoubleRodModelRail() {
  const entries = [
    { code: 'EMI-021', title: '双棒基础', state: 'active' as const },
    { code: 'EMI-022', title: '双棒 + 摩擦', state: 'planned' as const },
    { code: 'EMI-023', title: '双棒 + 电容', state: 'planned' as const },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((entry) => (
        <div
          key={entry.code}
          className="rounded-2xl px-3 py-2 text-sm"
          style={{
            color: entry.state === 'active' ? P13_SHELL_COLORS.primary : P13_SHELL_COLORS.secondary,
            backgroundColor: entry.state === 'active' ? P13_SHELL_COLORS.primarySoft : '#F3F4F6',
            border: `1px solid ${entry.state === 'active' ? P13_SHELL_COLORS.primaryBorder : P13_SHELL_COLORS.border}`,
          }}
        >
          <span className="font-semibold">{entry.code}</span>
          <span className="mx-2 opacity-50">·</span>
          <span>{entry.title}</span>
          {entry.state === 'planned' && <span className="ml-2 text-xs opacity-70">未开放</span>}
        </div>
      ))}
    </div>
  );
}

function ParameterSlider({
  label,
  unit,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span style={{ color: P13_SHELL_COLORS.secondary }}>{label}</span>
        <span className="font-medium" style={{ color: P13_SHELL_COLORS.text }}>
          {formatByStep(value, step)} {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        className="w-full"
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div
        className="mt-1 flex items-center justify-between text-[11px]"
        style={{ color: P13_SHELL_COLORS.muted }}
      >
        <span>{formatByStep(min, step)}</span>
        <span>{formatByStep(max, step)}</span>
      </div>
    </div>
  );
}

function AnalysisStepCard({
  step,
  index,
  visible,
  active,
}: {
  step: P13DoubleRodAnalysisStep;
  index: number;
  visible: boolean;
  active: boolean;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        borderColor: visible ? `${step.accentColor}55` : P13_SHELL_COLORS.border,
        backgroundColor: visible ? `${step.accentColor}12` : P13_SHELL_COLORS.blockBg,
        boxShadow: active ? `0 0 0 1px ${step.accentColor}22 inset` : 'none',
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold"
            style={{
              color: visible ? step.accentColor : P13_SHELL_COLORS.muted,
              backgroundColor: visible ? `${step.accentColor}18` : P13_SHELL_COLORS.blockSoft,
            }}
          >
            {index + 1}
          </span>
          <div>
            <div className="text-sm font-semibold" style={{ color: P13_SHELL_COLORS.text }}>
              {step.title}
            </div>
            <div className="text-xs" style={{ color: P13_SHELL_COLORS.muted }}>
              {visible ? '已揭示' : '等待分析'}
            </div>
          </div>
        </div>

        {visible && (
          <span
            className="rounded-full px-2.5 py-1 text-[11px] font-semibold"
            style={{
              color: step.accentColor,
              backgroundColor: `${step.accentColor}16`,
            }}
          >
            {step.directionLabel}
          </span>
        )}
      </div>

      <p className="mt-3 text-sm leading-6" style={{ color: P13_SHELL_COLORS.secondary }}>
        {visible ? step.description : '从当前时刻开始逐步判断，这一步会在推进后显示。'}
      </p>
    </div>
  );
}

function DoubleRodStage({
  result,
  state,
  analysisStep,
}: {
  result: ReturnType<typeof simulateDoubleRodModel>;
  state: P13DoubleRodState;
  analysisStep: number;
}) {
  const centerX = 380;
  const topY = 118;
  const bottomY = 292;
  const maxObservedSeparation = result.samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample.separation)),
    Math.abs(state.separation),
  );
  const separationScale = Math.max(0.6, maxObservedSeparation);
  const separationRatio = state.separation / separationScale;
  const absSeparationPixels = clamp(Math.abs(separationRatio) * 280, 92, 320);
  const separationSign = state.separation >= 0 ? 1 : -1;
  const rod1X = centerX + (separationSign * absSeparationPixels * 0.5);
  const rod2X = centerX - (separationSign * absSeparationPixels * 0.5);
  const loopLeft = Math.min(rod1X, rod2X);
  const loopRight = Math.max(rod1X, rod2X);
  const showRelativeMotion = analysisStep >= 1;
  const showEmf = analysisStep >= 2;
  const showCurrent = analysisStep >= 3;
  const showForce = analysisStep >= 4;
  const currentDirection = state.currentDirection;

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }}>
      <defs>
        <marker id="double-rod-v1" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="double-rod-v2" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.field} />
        </marker>
        <marker id="double-rod-emf" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.emf} />
        </marker>
        <marker id="double-rod-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
        <marker id="double-rod-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      <rect x="86" y="72" width="588" height="260" rx="28" fill="#F7FBFF" stroke="#D7E7F9" />

      {Array.from({ length: 8 }).map((_, row) =>
        Array.from({ length: 13 }).map((__, column) => (
          <text
            key={`${row}-${column}`}
            x={114 + (column * 42)}
            y={102 + (row * 28)}
            fill="#90A4B8"
            fontSize="13"
            textAnchor="middle"
          >
            ×
          </text>
        )),
      )}

      <text x="42" y="44" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
        双棒无摩擦耦合回路
      </text>
      <text x="42" y="64" fill={P13_SHELL_COLORS.secondary} fontSize="12">
        ε = BL(v1 - v2)，F1 = -F2，动量守恒
      </text>

      <line x1={loopLeft} y1={topY} x2={loopRight} y2={topY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      <line x1={loopLeft} y1={bottomY} x2={loopRight} y2={bottomY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />

      <line x1={rod2X} y1={topY} x2={rod2X} y2={bottomY} stroke="#0F172A" strokeWidth="11" strokeLinecap="round" />
      <line x1={rod1X} y1={topY} x2={rod1X} y2={bottomY} stroke="#111827" strokeWidth="11" strokeLinecap="round" />

      <text x={rod2X - 32} y="206" fill={P13_SHELL_COLORS.field} fontSize="12" fontWeight="600">
        棒2
      </text>
      <text x={rod1X + 16} y="206" fill={P13_SHELL_COLORS.velocity} fontSize="12" fontWeight="600">
        棒1
      </text>

      {showCurrent && currentDirection !== 'none' && (
        <>
          <line
            x1={currentDirection === 'counterclockwise' ? rod1X - 12 : rod2X + 12}
            y1={topY - 14}
            x2={currentDirection === 'counterclockwise' ? rod2X + 12 : rod1X - 12}
            y2={topY - 14}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-current)"
          />
          <line
            x1={rod2X - 18}
            y1={currentDirection === 'counterclockwise' ? topY + 12 : bottomY - 12}
            x2={rod2X - 18}
            y2={currentDirection === 'counterclockwise' ? bottomY - 12 : topY + 12}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-current)"
          />
          <line
            x1={currentDirection === 'counterclockwise' ? rod2X + 12 : rod1X - 12}
            y1={bottomY + 14}
            x2={currentDirection === 'counterclockwise' ? rod1X - 12 : rod2X + 12}
            y2={bottomY + 14}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-current)"
          />
          <line
            x1={rod1X + 18}
            y1={currentDirection === 'counterclockwise' ? bottomY - 12 : topY + 12}
            x2={rod1X + 18}
            y2={currentDirection === 'counterclockwise' ? topY + 12 : bottomY - 12}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-current)"
          />
          <text x="474" y="94" fill={P13_SHELL_COLORS.current} fontSize="12" fontWeight="600">
            电流：{P13_DOUBLE_ROD_CURRENT_DIRECTION_LABELS[currentDirection]}
          </text>
        </>
      )}

      {showRelativeMotion && state.motionDirection1 !== 'none' && (
        <>
          <line
            x1={rod1X}
            y1="90"
            x2={rod1X + (state.motionDirection1 === 'right' ? 84 : -84)}
            y2="90"
            stroke={P13_SHELL_COLORS.velocity}
            strokeWidth="4"
            markerEnd="url(#double-rod-v1)"
          />
          <text
            x={rod1X + (state.motionDirection1 === 'right' ? 10 : -90)}
            y="72"
            fill={P13_SHELL_COLORS.velocity}
            fontSize="12"
            fontWeight="600"
          >
            v1：{P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.motionDirection1]}
          </text>
        </>
      )}

      {showRelativeMotion && state.motionDirection2 !== 'none' && (
        <>
          <line
            x1={rod2X}
            y1="330"
            x2={rod2X + (state.motionDirection2 === 'right' ? 84 : -84)}
            y2="330"
            stroke={P13_SHELL_COLORS.field}
            strokeWidth="4"
            markerEnd="url(#double-rod-v2)"
          />
          <text
            x={rod2X + (state.motionDirection2 === 'right' ? 10 : -90)}
            y="350"
            fill={P13_SHELL_COLORS.field}
            fontSize="12"
            fontWeight="600"
          >
            v2：{P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.motionDirection2]}
          </text>
        </>
      )}

      {showEmf && state.emfDirection !== 'none' && (
        <>
          <line
            x1={rod1X - 20}
            y1={state.emfDirection === 'up' ? bottomY - 12 : topY + 12}
            x2={rod1X - 20}
            y2={state.emfDirection === 'up' ? topY + 12 : bottomY - 12}
            stroke={P13_SHELL_COLORS.emf}
            strokeWidth="4"
            markerEnd="url(#double-rod-emf)"
          />
          <text
            x={rod1X - 62}
            y="206"
            fill={P13_SHELL_COLORS.emf}
            fontSize="12"
            fontWeight="600"
            transform={`rotate(-90 ${rod1X - 62} 206)`}
          >
            ε：{P13_DOUBLE_ROD_VERTICAL_DIRECTION_LABELS[state.emfDirection]}
          </text>
        </>
      )}

      {showForce && state.ampereForceDirectionOnRod1 !== 'none' && (
        <>
          <line
            x1={rod1X}
            y1="336"
            x2={rod1X + (state.ampereForceDirectionOnRod1 === 'right' ? 80 : -80)}
            y2="336"
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#double-rod-force)"
          />
          <text
            x={rod1X + (state.ampereForceDirectionOnRod1 === 'right' ? 10 : -98)}
            y="356"
            fill={P13_SHELL_COLORS.force}
            fontSize="12"
            fontWeight="600"
          >
            F1：{P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirectionOnRod1]}
          </text>
        </>
      )}

      {showForce && state.ampereForceDirectionOnRod2 !== 'none' && (
        <>
          <line
            x1={rod2X}
            y1="72"
            x2={rod2X + (state.ampereForceDirectionOnRod2 === 'right' ? 80 : -80)}
            y2="72"
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#double-rod-force)"
          />
          <text
            x={rod2X + (state.ampereForceDirectionOnRod2 === 'right' ? 10 : -98)}
            y="56"
            fill={P13_SHELL_COLORS.force}
            fontSize="12"
            fontWeight="600"
          >
            F2：{P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirectionOnRod2]}
          </text>
        </>
      )}

      <rect x="484" y="210" width="214" height="110" rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
      <text x="500" y="234" fill={P13_SHELL_COLORS.secondary} fontSize="12">
        当前状态
      </text>
      <text x="500" y="256" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
        v1 = {formatNumber(state.velocity1, 4)} m/s
      </text>
      <text x="500" y="276" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
        v2 = {formatNumber(state.velocity2, 4)} m/s
      </text>
      <text x="500" y="296" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
        i = {formatNumber(state.current, 4)} A
      </text>
      <text x="500" y="316" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
        Δx = {formatNumber(state.separation, 4)} m
      </text>
    </svg>
  );
}

function computeCurrentCoastSpeed(
  state: P13DoubleRodState,
  mass1: number,
  mass2: number,
): number {
  return ((mass1 * state.velocity1) + (mass2 * state.velocity2)) / (mass1 + mass2);
}

function formatByStep(value: number, step: number): string {
  const decimals = Math.max(0, (step.toString().split('.')[1] ?? '').length);
  return value.toFixed(decimals);
}

function formatNumber(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(decimals);
}

function formatPhysicalTime(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (Math.abs(value) < 0.2) return `${(value * 1000).toFixed(value < 0.02 ? 2 : 1)} ms`;
  return `${value.toFixed(value >= 10 ? 1 : 3)} s`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
