import { useEffect, useMemo, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import type {
  P13DoubleRodAnalysisStep,
  P13DoubleRodState,
} from '@/domains/em/p13/types';
import {
  P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS,
  P13_DOUBLE_ROD_DRIVEN_PRESET_ID,
  P13_DOUBLE_ROD_PARAM_CONFIG,
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
  P13ModelRailChip,
  P13PanelCard,
  P13WorkbenchShell,
  P13_SHELL_COLORS,
} from './p13/P13WorkbenchShell';
import {
  DEFAULT_P13_DISPLAY_OPTIONS,
  P13DisplayOptionsPanel,
  P13StageAxes,
  P13StageGrid,
  type P13DisplayOptions,
} from './p13/P13DisplayOptions';
import { scaleArrowLength } from './p13/P13StagePrimitives';
import { P13TimeSeriesChart } from './p13/P13TimeSeriesChart';

interface Props {
  onBack: () => void;
  onSelectPreset: (presetId: string) => void;
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
const VARIANT = 'with-external-force' as const;

export function P13DoubleRodDrivenPage({ onBack, onSelectPreset }: Props) {
  const meta = getDoubleRodVariantMeta(VARIANT);
  const [params, setParams] = useState(() => normalizeDoubleRodParams(VARIANT));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [displayOptions, setDisplayOptions] = useState<P13DisplayOptions>(DEFAULT_P13_DISPLAY_OPTIONS);

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

  const badges = [
    { label: '模型', value: meta.code, tone: 'primary' as const },
    {
      label: '棒1外力',
      value: `${formatNumber(params.externalForce1, 2)} N`,
      tone: 'warning' as const,
    },
    {
      label: '当前速度差',
      value: `Δv = ${formatNumber(currentState.relativeVelocity, 3)} m/s`,
      tone: 'muted' as const,
    },
    {
      label: '当前电流',
      value: `${formatNumber(currentState.current, 3)} A`,
      tone: 'muted' as const,
    },
  ];

  return (
    <P13WorkbenchShell
      title={`${meta.code} ${meta.title}`}
      subtitle={meta.pageSubtitle}
      onBack={onBack}
      badges={badges}
      modelRail={<DoubleRodModelRail activeVariant={VARIANT} onSelectPreset={onSelectPreset} />}
      leftPanel={
        <div className="space-y-4">
          <P13PanelCard
            title="参数区"
            subtitle="棒1持续受恒定外力推动；当前先按无摩擦理想模型处理，聚焦“外力如何通过感应电流把运动传给棒2”。"
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
            <P13MetricLine label="回路电流" value={meta.currentFormula} />
            <P13MetricLine label="棒1外力" value="F外 持续向右" />
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

          <P13PanelCard title="当前联动值">
            <P13MetricLine label="v1 / v2" value={`${formatNumber(currentState.velocity1, 3)} / ${formatNumber(currentState.velocity2, 3)} m/s`} emphasis />
            <P13MetricLine label="Δv = v1 - v2" value={`${formatNumber(currentState.relativeVelocity, 3)} m/s`} emphasis />
            <P13MetricLine label="ε = BLΔv" value={`${formatNumber(currentState.emf, 3)} V`} emphasis />
            <P13MetricLine label="i = ε / (R1 + R2)" value={`${formatNumber(currentState.current, 3)} A`} emphasis />
            <P13MetricLine label="F外 / F1 / F2" value={`${formatNumber(currentState.externalForceOnRod1, 3)} / ${formatNumber(currentState.ampereForceOnRod1, 3)} / ${formatNumber(currentState.ampereForceOnRod2, 3)} N`} />
            <P13MetricLine label="a1 / a2" value={`${formatNumber(currentState.acceleration1, 3)} / ${formatNumber(currentState.acceleration2, 3)} m/s²`} />
          </P13PanelCard>

          <P13DisplayOptionsPanel
            options={displayOptions}
            onChange={setDisplayOptions}
          />
        </div>
      }
      stagePanel={
        <P13PanelCard
          title="视觉演示区"
          subtitle="外力持续推动棒1，感应电流产生的安培力把驱动逐步传给棒2；长期后两棒保持同加速度前进。"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <P13LegendBadge label="棒1速度 v1" color={P13_SHELL_COLORS.velocity} />
              <P13LegendBadge label="棒2速度 v2" color={P13_SHELL_COLORS.field} />
              <P13LegendBadge label="电流 i" color={P13_SHELL_COLORS.current} />
              <P13LegendBadge label="安培力 F1/F2" color={P13_SHELL_COLORS.force} />
              <P13LegendBadge label="外力 F外" color={P13_SHELL_COLORS.primary} />
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

          <DrivenDoubleRodStage
            result={result}
            state={currentState}
            analysisStep={analysisStep}
            displayOptions={displayOptions}
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
        <div className="grid gap-4 lg:grid-cols-2">
          <P13TimeSeriesChart
            title="双棒速度 v-t 图"
            unit="m/s"
            formula="v1、v2 同图，观察暂态后两棒如何转入同加速度前进"
            currentTime={currentTime}
            series={[
              {
                label: 'v1',
                color: P13_SHELL_COLORS.velocity,
                samples: result.samples.map((sample) => ({
                  time: sample.time,
                  value: sample.velocity1,
                })),
                currentValue: currentState.velocity1,
              },
              {
                label: 'v2',
                color: P13_SHELL_COLORS.field,
                samples: result.samples.map((sample) => ({
                  time: sample.time,
                  value: sample.velocity2,
                })),
                currentValue: currentState.velocity2,
              },
            ]}
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
          subtitle="顺序保持一致：相对运动 → 感应电动势 → 回路电流 → 两棒安培力。"
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
          title="结果区"
          subtitle="这支模型的长期口径不是“共速”，而是“同加速度 + 稳定速度差”。"
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

          <P13MetricLine
            label="理论稳定速度差 Δv*"
            value={`${formatNumber(result.summary.theoreticalRelativeVelocity ?? 0, 4)} m/s`}
            emphasis
          />
          <P13MetricLine
            label="理论共同加速度 a"
            value={`${formatNumber(result.summary.theoreticalCommonAcceleration ?? 0, 4)} m/s²`}
            emphasis
          />
          <P13MetricLine
            label="理论稳定电流"
            value={`${formatNumber(result.summary.theoreticalTerminalCurrent, 4)} A`}
            emphasis
          />
          <P13MetricLine label="当前 v1 / v2" value={`${formatNumber(currentState.velocity1, 4)} / ${formatNumber(currentState.velocity2, 4)} m/s`} />
          <P13MetricLine label="当前速度差 Δv" value={`${formatNumber(currentState.relativeVelocity, 4)} m/s`} />
          <P13MetricLine label="当前电流" value={`${formatNumber(currentState.current, 4)} A`} />
          <P13MetricLine label="当前 a1 / a2" value={`${formatNumber(currentState.acceleration1, 4)} / ${formatNumber(currentState.acceleration2, 4)} m/s²`} />
          <P13MetricLine label="观测窗末 v1 / v2" value={`${formatNumber(result.summary.finalVelocity1, 4)} / ${formatNumber(result.summary.finalVelocity2, 4)} m/s`} />
          <P13MetricLine label="总电阻" value={`${formatNumber(result.summary.totalResistance, 2)} Ω`} />
          <div
            className="mt-4 rounded-2xl px-3 py-3 text-xs leading-6"
            style={{
              color: P13_SHELL_COLORS.secondary,
              backgroundColor: P13_SHELL_COLORS.blockSoft,
            }}
          >
            简化说明：{result.summary.simplificationNote}
          </div>
        </P13PanelCard>
      }
    />
  );
}

function DoubleRodModelRail({
  activeVariant,
  onSelectPreset,
}: {
  activeVariant: 'basic-frictionless' | 'with-external-force';
  onSelectPreset: (presetId: string) => void;
}) {
  const entries = [
    getDoubleRodVariantMeta('basic-frictionless'),
    getDoubleRodVariantMeta('with-external-force'),
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((entry) => {
        const isActive = entry.variant === activeVariant;
        return (
          <P13ModelRailChip
            key={entry.code}
            code={entry.code}
            title={entry.shortTitle}
            state={isActive ? 'active' : 'available'}
            onSelect={!isActive ? () => onSelectPreset(entry.presetId) : undefined}
          />
        );
      })}
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

function DrivenDoubleRodStage({
  result,
  state,
  analysisStep,
  displayOptions,
}: {
  result: ReturnType<typeof simulateDoubleRodModel>;
  state: P13DoubleRodState;
  analysisStep: number;
  displayOptions: P13DisplayOptions;
}) {
  const railLeft = 104;
  const railRight = 656;
  const topY = 118;
  const bottomY = 292;
  const minPosition = result.samples.reduce(
    (min, sample) => Math.min(min, sample.position1, sample.position2),
    Math.min(state.position1, state.position2),
  );
  const maxPosition = result.samples.reduce(
    (max, sample) => Math.max(max, sample.position1, sample.position2),
    Math.max(state.position1, state.position2),
  );
  const travelRange = Math.max(0.8, maxPosition - minPosition);
  const scaleX = (position: number) => {
    const raw = railLeft + 28 + (((position - minPosition) / travelRange) * (railRight - railLeft - 56));
    return clamp(raw, railLeft + 28, railRight - 28);
  };
  const rod1X = scaleX(state.position1);
  const rod2X = scaleX(state.position2);
  const showRelativeMotion = displayOptions.showVectors && analysisStep >= 1;
  const showEmf = displayOptions.showVectors && analysisStep >= 2;
  const showCurrent = displayOptions.showVectors && analysisStep >= 3;
  const showForce = displayOptions.showVectors && analysisStep >= 4;
  const currentDirection = state.currentDirection;
  const maxSpeedMagnitude = result.samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample.velocity1), Math.abs(sample.velocity2)),
    Math.max(Math.abs(state.velocity1), Math.abs(state.velocity2)),
  );
  const maxForceMagnitude = result.samples.reduce(
    (max, sample) =>
      Math.max(
        max,
        Math.abs(sample.ampereForceOnRod1),
        Math.abs(sample.ampereForceOnRod2),
        Math.abs(sample.externalForceOnRod1),
      ),
    Math.max(Math.abs(state.ampereForceOnRod1), Math.abs(state.ampereForceOnRod2), Math.abs(state.externalForceOnRod1)),
  );
  const velocityArrowLength1 = scaleArrowLength(state.velocity1, maxSpeedMagnitude, 34, 96);
  const velocityArrowLength2 = scaleArrowLength(state.velocity2, maxSpeedMagnitude, 34, 96);
  const forceArrowLength1 = scaleArrowLength(state.ampereForceOnRod1, maxForceMagnitude, 30, 88);
  const forceArrowLength2 = scaleArrowLength(state.ampereForceOnRod2, maxForceMagnitude, 30, 88);
  const externalForceArrowLength = scaleArrowLength(state.externalForceOnRod1, maxForceMagnitude, 34, 92);

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }}>
      <defs>
        <marker id="double-rod-driven-v1" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="double-rod-driven-v2" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.field} />
        </marker>
        <marker id="double-rod-driven-emf" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.emf} />
        </marker>
        <marker id="double-rod-driven-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
        <marker id="double-rod-driven-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
        <marker id="double-rod-driven-external" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.primary} />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      <rect x="86" y="72" width="588" height="260" rx="28" fill="#F7FBFF" stroke="#D7E7F9" />

      {displayOptions.showGrid && <P13StageGrid left={96} top={86} right={664} bottom={318} />}
      {displayOptions.showGrid &&
        Array.from({ length: 8 }).map((_, row) =>
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
      {displayOptions.showAxes && <P13StageAxes originX={104} originY={330} />}

      {displayOptions.showLabels && (
        <>
          <text x="42" y="44" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
            双棒 + 棒1受恒外力
          </text>
          <text x="42" y="64" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            F外 持续推动棒1，安培力把驱动传给棒2
          </text>
        </>
      )}

      <line x1={railLeft} y1={topY} x2={railRight} y2={topY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      <line x1={railLeft} y1={bottomY} x2={railRight} y2={bottomY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      <line x1={rod2X} y1={topY} x2={rod2X} y2={bottomY} stroke="#0F172A" strokeWidth="11" strokeLinecap="round" />
      <line x1={rod1X} y1={topY} x2={rod1X} y2={bottomY} stroke="#111827" strokeWidth="11" strokeLinecap="round" />

      {displayOptions.showLabels && (
        <>
          <text x={rod2X - 32} y="206" fill={P13_SHELL_COLORS.field} fontSize="12" fontWeight="600">
            棒2
          </text>
          <text x={rod1X + 16} y="206" fill={P13_SHELL_COLORS.velocity} fontSize="12" fontWeight="600">
            棒1
          </text>
        </>
      )}

      {showCurrent && currentDirection !== 'none' && (
        <>
          <line
            x1={currentDirection === 'counterclockwise' ? rod1X - 12 : rod2X + 12}
            y1={topY - 14}
            x2={currentDirection === 'counterclockwise' ? rod2X + 12 : rod1X - 12}
            y2={topY - 14}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-driven-current)"
          />
          <line
            x1={rod2X - 18}
            y1={currentDirection === 'counterclockwise' ? topY + 12 : bottomY - 12}
            x2={rod2X - 18}
            y2={currentDirection === 'counterclockwise' ? bottomY - 12 : topY + 12}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-driven-current)"
          />
          <line
            x1={currentDirection === 'counterclockwise' ? rod2X + 12 : rod1X - 12}
            y1={bottomY + 14}
            x2={currentDirection === 'counterclockwise' ? rod1X - 12 : rod2X + 12}
            y2={bottomY + 14}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-driven-current)"
          />
          <line
            x1={rod1X + 18}
            y1={currentDirection === 'counterclockwise' ? bottomY - 12 : topY + 12}
            x2={rod1X + 18}
            y2={currentDirection === 'counterclockwise' ? topY + 12 : bottomY - 12}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#double-rod-driven-current)"
          />
          <line
            x1={rod1X}
            y1={currentDirection === 'counterclockwise' ? bottomY - 16 : topY + 16}
            x2={rod1X}
            y2={currentDirection === 'counterclockwise' ? topY + 16 : bottomY - 16}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="5"
            markerEnd="url(#double-rod-driven-current)"
          />
          <line
            x1={rod2X}
            y1={currentDirection === 'counterclockwise' ? topY + 16 : bottomY - 16}
            x2={rod2X}
            y2={currentDirection === 'counterclockwise' ? bottomY - 16 : topY + 16}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="5"
            markerEnd="url(#double-rod-driven-current)"
          />
        </>
      )}

      {showRelativeMotion && state.motionDirection1 !== 'none' && (
        <line
          x1={rod1X}
          y1="90"
          x2={rod1X + (state.motionDirection1 === 'right' ? velocityArrowLength1 : -velocityArrowLength1)}
          y2="90"
          stroke={P13_SHELL_COLORS.velocity}
          strokeWidth="4"
          markerEnd="url(#double-rod-driven-v1)"
        />
      )}

      {showRelativeMotion && state.motionDirection2 !== 'none' && (
        <line
          x1={rod2X}
          y1="330"
          x2={rod2X + (state.motionDirection2 === 'right' ? velocityArrowLength2 : -velocityArrowLength2)}
          y2="330"
          stroke={P13_SHELL_COLORS.field}
          strokeWidth="4"
          markerEnd="url(#double-rod-driven-v2)"
        />
      )}

      {showEmf && state.emfDirection !== 'none' && (
        <line
          x1={rod1X - 20}
          y1={state.emfDirection === 'up' ? bottomY - 12 : topY + 12}
          x2={rod1X - 20}
          y2={state.emfDirection === 'up' ? topY + 12 : bottomY - 12}
          stroke={P13_SHELL_COLORS.emf}
          strokeWidth="4"
          markerEnd="url(#double-rod-driven-emf)"
        />
      )}

      {showForce && state.ampereForceDirectionOnRod1 !== 'none' && (
        <line
          x1={rod1X}
          y1="336"
          x2={rod1X + (state.ampereForceDirectionOnRod1 === 'right' ? forceArrowLength1 : -forceArrowLength1)}
          y2="336"
          stroke={P13_SHELL_COLORS.force}
          strokeWidth="4"
          markerEnd="url(#double-rod-driven-force)"
        />
      )}

      {showForce && state.ampereForceDirectionOnRod2 !== 'none' && (
        <line
          x1={rod2X}
          y1="72"
          x2={rod2X + (state.ampereForceDirectionOnRod2 === 'right' ? forceArrowLength2 : -forceArrowLength2)}
          y2="72"
          stroke={P13_SHELL_COLORS.force}
          strokeWidth="4"
          markerEnd="url(#double-rod-driven-force)"
        />
      )}

      {showForce && state.externalForceOnRod1 > 0 && (
        <line
          x1={rod1X}
          y1="50"
          x2={rod1X + externalForceArrowLength}
          y2="50"
          stroke={P13_SHELL_COLORS.primary}
          strokeWidth="4"
          markerEnd="url(#double-rod-driven-external)"
        />
      )}

      {displayOptions.showLabels && (
        <>
          <text x={rod1X + 12} y="38" fill={P13_SHELL_COLORS.primary} fontSize="12" fontWeight="600">
            F外：向右
          </text>
          <rect x="484" y="202" width="214" height="126" rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
          <text x="500" y="226" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前状态
          </text>
          <text x="500" y="248" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            v1 = {formatNumber(state.velocity1, 4)} m/s
          </text>
          <text x="500" y="268" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            v2 = {formatNumber(state.velocity2, 4)} m/s
          </text>
          <text x="500" y="288" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            i = {formatNumber(state.current, 4)} A
          </text>
          <text x="500" y="308" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            F外 = {formatNumber(state.externalForceOnRod1, 3)} N
          </text>
        </>
      )}
    </svg>
  );
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

export const P13_DOUBLE_ROD_DRIVEN_PAGE_PRESET_ID = P13_DOUBLE_ROD_DRIVEN_PRESET_ID;
