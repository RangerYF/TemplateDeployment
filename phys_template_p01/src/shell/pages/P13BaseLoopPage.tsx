import { useEffect, useMemo, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import type { MagneticFieldDirection } from '@/domains/em/types';
import {
  P13_BASE_LOOP_ANALYSIS_TOTAL_STEPS,
  P13_BASE_LOOP_CURRENT_DIRECTION_LABELS,
  P13_BASE_LOOP_FLUX_TREND_LABELS,
  P13_BASE_LOOP_META,
  P13_BASE_LOOP_PARAM_CONFIG,
  P13_BASE_LOOP_PHASE_LABELS,
  type P13BaseLoopAnalysisStep,
  type P13BaseLoopParams,
  type P13BaseLoopState,
  buildBaseLoopAnalysisSteps,
  normalizeBaseLoopParams,
  sampleBaseLoopStateAtTime,
  simulateBaseLoopModel,
} from '@/domains/em/p13/base-loop';
import {
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
const LOOP_START_X = -1;
const FIELD_X = 2;
const FIELD_Y = -2;
const FIELD_WIDTH = 4;
const FIELD_HEIGHT = 4;

export function P13BaseLoopPage({ onBack }: Props) {
  const [params, setParams] = useState(() => normalizeBaseLoopParams());
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [displayOptions, setDisplayOptions] = useState<P13DisplayOptions>(DEFAULT_P13_DISPLAY_OPTIONS);

  useEffect(() => {
    simulator.unload();
  }, []);

  const result = useMemo(() => simulateBaseLoopModel(params), [params]);
  const currentState = useMemo(
    () => sampleBaseLoopStateAtTime(result, currentTime),
    [currentTime, result],
  );
  const analysisSteps = useMemo(
    () => buildBaseLoopAnalysisSteps(result, currentState),
    [currentState, result],
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

  function updateNumericParam(
    key: keyof Pick<P13BaseLoopParams, 'initialVelocity' | 'mass' | 'resistance' | 'effectiveCutLength' | 'magneticField'>,
    value: number,
  ): void {
    setParams((previous) => normalizeBaseLoopParams({ ...previous, [key]: value }));
  }

  function updateDirection(value: MagneticFieldDirection): void {
    setParams((previous) => normalizeBaseLoopParams({ ...previous, direction: value }));
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
    { label: '模型', value: P13_BASE_LOOP_META.code, tone: 'primary' as const },
    {
      label: '当前阶段',
      value: P13_BASE_LOOP_PHASE_LABELS[currentState.phase],
      tone: 'muted' as const,
    },
    {
      label: '当前 ε',
      value: `${formatNumber(currentState.emf, 3)} V`,
      tone: 'warning' as const,
    },
    {
      label: '当前 I',
      value: `${formatNumber(currentState.current, 3)} A`,
      tone: 'muted' as const,
    },
  ];

  return (
    <P13WorkbenchShell
      title={`${P13_BASE_LOOP_META.code} ${P13_BASE_LOOP_META.title}`}
      subtitle={P13_BASE_LOOP_META.pageSubtitle}
      onBack={onBack}
      badges={badges}
      modelRail={<BaseLoopModelRail />}
      leftPanel={
        <div className="space-y-4">
          <P13PanelCard
            title="参数区"
            subtitle="真实动力学口径：输入初速度、线框质量、电阻、切割边长 L、磁场强度与磁场方向。"
          >
            <div className="space-y-4">
              <ParameterSlider
                label={P13_BASE_LOOP_PARAM_CONFIG.initialVelocity.label}
                unit={P13_BASE_LOOP_PARAM_CONFIG.initialVelocity.unit}
                min={P13_BASE_LOOP_PARAM_CONFIG.initialVelocity.min}
                max={P13_BASE_LOOP_PARAM_CONFIG.initialVelocity.max}
                step={P13_BASE_LOOP_PARAM_CONFIG.initialVelocity.step}
                value={params.initialVelocity}
                onChange={(value) => updateNumericParam('initialVelocity', value)}
              />
              <ParameterSlider
                label={P13_BASE_LOOP_PARAM_CONFIG.mass.label}
                unit={P13_BASE_LOOP_PARAM_CONFIG.mass.unit}
                min={P13_BASE_LOOP_PARAM_CONFIG.mass.min}
                max={P13_BASE_LOOP_PARAM_CONFIG.mass.max}
                step={P13_BASE_LOOP_PARAM_CONFIG.mass.step}
                value={params.mass}
                onChange={(value) => updateNumericParam('mass', value)}
              />
              <ParameterSlider
                label={P13_BASE_LOOP_PARAM_CONFIG.resistance.label}
                unit={P13_BASE_LOOP_PARAM_CONFIG.resistance.unit}
                min={P13_BASE_LOOP_PARAM_CONFIG.resistance.min}
                max={P13_BASE_LOOP_PARAM_CONFIG.resistance.max}
                step={P13_BASE_LOOP_PARAM_CONFIG.resistance.step}
                value={params.resistance}
                onChange={(value) => updateNumericParam('resistance', value)}
              />
              <ParameterSlider
                label={P13_BASE_LOOP_PARAM_CONFIG.effectiveCutLength.label}
                unit={P13_BASE_LOOP_PARAM_CONFIG.effectiveCutLength.unit}
                min={P13_BASE_LOOP_PARAM_CONFIG.effectiveCutLength.min}
                max={P13_BASE_LOOP_PARAM_CONFIG.effectiveCutLength.max}
                step={P13_BASE_LOOP_PARAM_CONFIG.effectiveCutLength.step}
                value={params.effectiveCutLength}
                onChange={(value) => updateNumericParam('effectiveCutLength', value)}
              />
              <ParameterSlider
                label={P13_BASE_LOOP_PARAM_CONFIG.magneticField.label}
                unit={P13_BASE_LOOP_PARAM_CONFIG.magneticField.unit}
                min={P13_BASE_LOOP_PARAM_CONFIG.magneticField.min}
                max={P13_BASE_LOOP_PARAM_CONFIG.magneticField.max}
                step={P13_BASE_LOOP_PARAM_CONFIG.magneticField.step}
                value={params.magneticField}
                onChange={(value) => updateNumericParam('magneticField', value)}
              />
              <DirectionSelect
                value={params.direction}
                onChange={updateDirection}
              />
            </div>
          </P13PanelCard>

          <P13PanelCard title="模型约定">
            <P13MetricLine label="磁通量" value="Φ = B · S重叠（带符号）" />
            <P13MetricLine label="感应电动势" value="ε = -dΦ / dt" />
            <P13MetricLine label="感应电流" value="I = ε / R" />
            <P13MetricLine label="安培力" value="F安 = BIL = B²L²v / R（实时反作用到速度）" />
            <P13MetricLine label="动力学" value="m·dv/dt = F安（仅在切割磁感线阶段不为 0）" />
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

          <P13PanelCard title="当前状态">
            <P13MetricLine label="当前速度 v" value={`${formatNumber(currentState.velocity, 3)} m/s`} emphasis />
            <P13MetricLine label="当前加速度 a" value={`${formatNumber(currentState.acceleration, 3)} m/s²`} />
            <P13MetricLine label="线框位置 x" value={`${formatNumber(currentState.positionX, 3)} m`} emphasis />
            <P13MetricLine label="切割边长 L" value={`${formatNumber(currentState.effectiveCutLength, 3)} m`} />
            <P13MetricLine label="重叠面积 S" value={`${formatNumber(currentState.overlapArea, 3)} m²`} emphasis />
            <P13MetricLine label="磁通量趋势" value={P13_BASE_LOOP_FLUX_TREND_LABELS[currentState.fluxTrend]} />
            <P13MetricLine label="电流方向" value={P13_BASE_LOOP_CURRENT_DIRECTION_LABELS[currentState.currentDirection]} />
            <P13MetricLine label="安培力方向" value={currentState.ampereForceDirection === 'left' ? '向左' : currentState.ampereForceDirection === 'right' ? '向右' : '无'} />
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
          subtitle="磁场固定不动；线框沿运动方向的深度固定为 1 m，调 L 时只改变竖向切割边长度。"
        >
          <BaseLoopStage state={currentState} analysisStep={analysisStep} displayOptions={displayOptions} />
        </P13PanelCard>
      }
      chartPanel={
        <div className="grid gap-4 lg:grid-cols-2">
          <P13TimeSeriesChart
            title="速度 v-t"
            unit="m/s"
            color={P13_SHELL_COLORS.velocity}
            formula="m·dv/dt = -B²L²v / R（仅在进入/离开阶段成立）"
            samples={result.samples.map((sample) => ({ time: sample.time, value: sample.velocity }))}
            currentTime={currentTime}
            currentValue={currentState.velocity}
          />
          <P13TimeSeriesChart
            title="磁通量 Φ-t"
            unit="Wb"
            color={P13_SHELL_COLORS.field}
            formula="Φ = B · S重叠"
            samples={result.samples.map((sample) => ({ time: sample.time, value: sample.flux }))}
            currentTime={currentTime}
            currentValue={currentState.flux}
          />
          <P13TimeSeriesChart
            title="感应电动势 ε-t"
            unit="V"
            color={P13_SHELL_COLORS.emf}
            formula="ε = -ΔΦ / Δt"
            samples={result.samples.map((sample) => ({ time: sample.time, value: sample.emf }))}
            currentTime={currentTime}
            currentValue={currentState.emf}
          />
          <P13TimeSeriesChart
            title="感应电流 I-t"
            unit="A"
            color={P13_SHELL_COLORS.current}
            formula="I = ε / R"
            samples={result.samples.map((sample) => ({ time: sample.time, value: sample.current }))}
            currentTime={currentTime}
            currentValue={currentState.current}
          />
        </div>
      }
      analysisPanel={
        <P13PanelCard
          title="分析受力"
          subtitle="按真实动力学顺序观察：运动状态 → 磁通量 → 感应电流 → 安培力与减速。"
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={PRIMARY_BUTTON_STYLE}
              onClick={() => setAnalysisStep((previous) => Math.min(P13_BASE_LOOP_ANALYSIS_TOTAL_STEPS, previous + 1))}
              disabled={analysisStep >= P13_BASE_LOOP_ANALYSIS_TOTAL_STEPS}
            >
              下一步
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={SECONDARY_BUTTON_STYLE}
              onClick={() => setAnalysisStep(0)}
            >
              重置分析
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={isPlaying ? PRIMARY_BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
              onClick={togglePlayback}
            >
              {isPlaying ? '暂停动画' : '播放动画'}
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={SECONDARY_BUTTON_STYLE}
              onClick={resetPlayback}
            >
              回到起点
            </button>
          </div>

          <div className="mt-4 space-y-3">
            {analysisSteps.map((step, index) => (
              <AnalysisStepCard
                key={step.key}
                step={step}
                index={index}
                visible={analysisStep >= index + 1}
                active={analysisStep === index + 1}
              />
            ))}
          </div>
        </P13PanelCard>
      }
      resultPanel={
        <P13PanelCard
          title="结果区"
          subtitle={P13_BASE_LOOP_META.terminalHeadline}
        >
          <P13MetricLine label="当前阶段" value={P13_BASE_LOOP_PHASE_LABELS[currentState.phase]} emphasis />
          <P13MetricLine label="当前 v" value={`${formatNumber(currentState.velocity, 4)} m/s`} emphasis />
          <P13MetricLine label="当前 Φ" value={`${formatNumber(currentState.flux, 4)} Wb`} emphasis />
          <P13MetricLine label="当前 ε" value={`${formatNumber(currentState.emf, 4)} V`} emphasis />
          <P13MetricLine label="当前 I" value={`${formatNumber(currentState.current, 4)} A`} emphasis />
          <P13MetricLine label="当前 F安" value={`${formatNumber(currentState.ampereForce, 4)} N`} emphasis />
          <P13MetricLine label="峰值 |Φ|" value={`${formatNumber(result.summary.peakFluxMagnitude, 4)} Wb`} />
          <P13MetricLine label="峰值 |ε|" value={`${formatNumber(result.summary.peakEmfMagnitude, 4)} V`} />
          <P13MetricLine label="峰值 |I|" value={`${formatNumber(result.summary.peakCurrentMagnitude, 4)} A`} />
          <P13MetricLine label="峰值 |F安|" value={`${formatNumber(result.summary.peakAmpereForceMagnitude, 4)} N`} />
          <P13MetricLine label="开始进入 t" value={formatPhysicalTime(result.summary.entryStartTime, '未进入')} />
          <P13MetricLine label="全进入 t" value={formatPhysicalTime(result.summary.fullyInsideTime, '未全进入')} />
          <P13MetricLine label="开始离场 t" value={formatPhysicalTime(result.summary.leaveStartTime, '未离场')} />
          <P13MetricLine label="完全离场 t" value={formatPhysicalTime(result.summary.exitTime, '未离开')} />
          <P13MetricLine label="停下时刻 t" value={formatPhysicalTime(result.summary.stopTime, '未停下')} />
          <P13MetricLine label="最终速度" value={`${formatNumber(result.summary.finalVelocity, 4)} m/s`} />
          <P13MetricLine label="局部阻尼时间常数 τ" value={formatDragTimeConstant(result.summary.dragTimeConstant)} />
          <div
            className="mt-3 rounded-2xl px-3 py-3 text-xs leading-6"
            style={{
              color: P13_SHELL_COLORS.secondary,
              backgroundColor: P13_SHELL_COLORS.blockSoft,
            }}
          >
            简化假设：{result.summary.simplificationNote}
          </div>
        </P13PanelCard>
      }
    />
  );
}

function BaseLoopModelRail() {
  return (
    <div className="flex flex-wrap gap-2">
      <P13ModelRailChip
        code={P13_BASE_LOOP_META.code}
        title={P13_BASE_LOOP_META.shortTitle}
        state="active"
      />
    </div>
  );
}

function DirectionSelect({
  value,
  onChange,
}: {
  value: MagneticFieldDirection;
  onChange: (value: MagneticFieldDirection) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <span style={{ color: P13_SHELL_COLORS.secondary }}>磁场方向</span>
        <span className="font-medium" style={{ color: P13_SHELL_COLORS.text }}>
          {value === 'into' ? '垂直纸面向内 ×' : '垂直纸面向外 ·'}
        </span>
      </div>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value === 'out' ? 'out' : 'into')}
        className="w-full rounded-xl border px-3 py-2 text-sm"
        style={{
          color: P13_SHELL_COLORS.text,
          backgroundColor: P13_SHELL_COLORS.blockBg,
          borderColor: P13_SHELL_COLORS.border,
        }}
      >
        <option value="into">垂直纸面向内 ×</option>
        <option value="out">垂直纸面向外 ·</option>
      </select>
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
  step: P13BaseLoopAnalysisStep;
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
        {visible ? step.description : '点击“下一步”后显示这一步的判断结果。'}
      </p>
    </div>
  );
}

function BaseLoopStage({
  state,
  analysisStep,
  displayOptions,
}: {
  state: P13BaseLoopState;
  analysisStep: number;
  displayOptions: P13DisplayOptions;
}) {
  const worldLeft = LOOP_START_X - 1.2;
  const worldRight = (FIELD_X + FIELD_WIDTH + state.frameDepth) + 1.2;
  const worldWidth = Math.max(6, worldRight - worldLeft);
  const scaleX = (x: number) => 56 + (((x - worldLeft) / worldWidth) * 648);
  const scaleY = (y: number) => 314 - (((y + 2.8) / 5.6) * 238);
  const loopLeft = state.positionX;
  const loopRight = state.positionX + state.frameDepth;
  const fieldLeft = scaleX(FIELD_X);
  const fieldRight = scaleX(FIELD_X + FIELD_WIDTH);
  const fieldTop = scaleY(FIELD_Y + FIELD_HEIGHT);
  const fieldBottom = scaleY(FIELD_Y);
  const loopScreenLeft = scaleX(loopLeft);
  const loopScreenRight = scaleX(loopRight);
  const loopScreenTop = scaleY(state.positionY + state.effectiveCutLength);
  const loopScreenBottom = scaleY(state.positionY);
  const loopCenterX = (loopScreenLeft + loopScreenRight) / 2;
  const loopCenterY = (loopScreenTop + loopScreenBottom) / 2;
  const showVelocity =
    displayOptions.showVectors && analysisStep >= 1 && state.motionDirection !== 'none';
  const showFlux = displayOptions.showLabels && analysisStep >= 2;
  const showCurrent = displayOptions.showVectors && analysisStep >= 3;
  const showForce =
    displayOptions.showVectors && analysisStep >= 4 && state.ampereForceDirection !== 'none';
  const currentDirection = state.currentDirection;

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }} aria-label="矩形线框穿场演示">
      <defs>
        <marker id="p13-base-loop-velocity" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="p13-base-loop-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
        <marker id="p13-base-loop-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      {displayOptions.showLabels && (
        <>
          <text x="36" y="40" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
            基础动生示意
          </text>
          <text x="36" y="60" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前阶段：{P13_BASE_LOOP_PHASE_LABELS[state.phase]}
          </text>
          <text x="500" y="60" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            运动深度 = 1.00 m · 切割边长 L = {formatNumber(state.effectiveCutLength, 2)} m
          </text>
        </>
      )}

      <rect
        x={fieldLeft}
        y={fieldTop}
        width={fieldRight - fieldLeft}
        height={fieldBottom - fieldTop}
        rx="16"
        fill={state.magneticFieldDirection === 'into' ? '#EEF4FF' : '#FFF4E8'}
        stroke={state.magneticFieldDirection === 'into' ? '#93C5FD' : '#FDBA74'}
      />
      {displayOptions.showGrid && (
        <>
          <P13StageGrid left={56} top={74} right={704} bottom={332} />
          <MagneticPattern
            left={fieldLeft}
            top={fieldTop}
            right={fieldRight}
            bottom={fieldBottom}
            direction={state.magneticFieldDirection}
          />
        </>
      )}

      {displayOptions.showAxes && <P13StageAxes originX={70} originY={330} />}

      <rect
        x={loopScreenLeft}
        y={loopScreenTop}
        width={loopScreenRight - loopScreenLeft}
        height={loopScreenBottom - loopScreenTop}
        rx="12"
        fill="none"
        stroke="#0F172A"
        strokeWidth="8"
      />

      {showCurrent && currentDirection !== 'none' && (
        <LoopCurrentArrows
          left={loopScreenLeft}
          top={loopScreenTop}
          right={loopScreenRight}
          bottom={loopScreenBottom}
          direction={currentDirection}
        />
      )}

      {showVelocity && (
        <>
          {(() => {
            const velocityDeltaX = state.motionDirection === 'left' ? -86 : 86;
            return (
              <>
                <line
                  x1={loopCenterX}
                  y1={loopCenterY}
                  x2={loopCenterX + velocityDeltaX}
                  y2={loopCenterY}
                  stroke={P13_SHELL_COLORS.velocity}
                  strokeWidth="4"
                  markerEnd="url(#p13-base-loop-velocity)"
                />
                {displayOptions.showLabels && (
                  <text
                    x={loopCenterX + (velocityDeltaX * 0.35)}
                    y={loopCenterY - 12}
                    fill={P13_SHELL_COLORS.velocity}
                    fontSize="12"
                    fontWeight="600"
                  >
                    {state.motionDirection === 'right' ? 'v：向右' : 'v：向左'}
                  </text>
                )}
              </>
            );
          })()}
        </>
      )}

      {showForce && state.ampereForceDirection !== 'none' && (
        <>
          {(() => {
            const forceDeltaX = state.ampereForceDirection === 'right' ? 82 : -82;
            return (
              <>
                <line
                  x1={loopCenterX}
                  y1={loopCenterY + 28}
                  x2={loopCenterX + forceDeltaX}
                  y2={loopCenterY + 28}
                  stroke={P13_SHELL_COLORS.force}
                  strokeWidth="4"
                  markerEnd="url(#p13-base-loop-force)"
                />
                {displayOptions.showLabels && (
                  <text
                    x={loopCenterX + (forceDeltaX * 0.45)}
                    y={loopCenterY + 18}
                    fill={P13_SHELL_COLORS.force}
                    fontSize="12"
                    fontWeight="600"
                  >
                    {state.ampereForceDirection === 'right' ? 'F安：向右' : 'F安：向左'}
                  </text>
                )}
              </>
            );
          })()}
        </>
      )}

      {showFlux && (
        <text x={fieldLeft + 12} y={fieldTop - 10} fill={P13_SHELL_COLORS.field} fontSize="12" fontWeight="600">
          Φ：{P13_BASE_LOOP_FLUX_TREND_LABELS[state.fluxTrend]}
        </text>
      )}

      {displayOptions.showLabels && (
        <>
          <rect x="488" y="194" width="220" height="148" rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
          <text x="504" y="232" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前读数
          </text>
          <text x="504" y="254" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            重叠面积：{formatNumber(state.overlapArea, 3)} m²
          </text>
          <text x="504" y="274" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            切割边长 L：{formatNumber(state.effectiveCutLength, 3)} m
          </text>
          <text x="504" y="294" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            磁通量：{formatNumber(state.flux, 4)} Wb
          </text>
          <text x="504" y="314" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            电动势：{formatNumber(state.emf, 4)} V
          </text>
          <text x="504" y="334" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            电流：{formatNumber(state.current, 4)} A
          </text>
        </>
      )}
    </svg>
  );
}

function MagneticPattern({
  left,
  top,
  right,
  bottom,
  direction,
}: {
  left: number;
  top: number;
  right: number;
  bottom: number;
  direction: MagneticFieldDirection;
}) {
  const symbols: Array<{ x: number; y: number }> = [];
  for (let x = left + 24; x < right - 16; x += 42) {
    for (let y = top + 24; y < bottom - 12; y += 34) {
      symbols.push({ x, y });
    }
  }

  return (
    <>
      {symbols.map((item, index) => (
        <text
          key={`${item.x}-${item.y}-${index}`}
          x={item.x}
          y={item.y}
          fill={direction === 'into' ? '#3B82F6' : '#C2410C'}
          fontSize="16"
          fontWeight="700"
          textAnchor="middle"
        >
          {direction === 'into' ? '×' : '·'}
        </text>
      ))}
    </>
  );
}

function LoopCurrentArrows({
  left,
  top,
  right,
  bottom,
  direction,
}: {
  left: number;
  top: number;
  right: number;
  bottom: number;
  direction: 'clockwise' | 'counterclockwise';
}) {
  const topY = top - 14;
  const bottomY = bottom + 14;
  const leftX = left - 14;
  const rightX = right + 14;

  return (
    <>
      <line
        x1={direction === 'counterclockwise' ? right : left}
        y1={topY}
        x2={direction === 'counterclockwise' ? left : right}
        y2={topY}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd="url(#p13-base-loop-current)"
      />
      <line
        x1={rightX}
        y1={direction === 'counterclockwise' ? top : bottom}
        x2={rightX}
        y2={direction === 'counterclockwise' ? bottom : top}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd="url(#p13-base-loop-current)"
      />
      <line
        x1={direction === 'counterclockwise' ? left : right}
        y1={bottomY}
        x2={direction === 'counterclockwise' ? right : left}
        y2={bottomY}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd="url(#p13-base-loop-current)"
      />
      <line
        x1={leftX}
        y1={direction === 'counterclockwise' ? bottom : top}
        x2={leftX}
        y2={direction === 'counterclockwise' ? top : bottom}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd="url(#p13-base-loop-current)"
      />
    </>
  );
}

function formatByStep(value: number, step: number): string {
  if (step >= 1) return value.toFixed(0);
  if (step >= 0.1) return value.toFixed(1);
  if (step >= 0.01) return value.toFixed(2);
  return value.toFixed(3);
}

function formatNumber(value: number, precision = 3): string {
  if (!Number.isFinite(value)) return '0';
  return value.toFixed(precision);
}

function formatPhysicalTime(value: number | null, fallback = '—'): string {
  if (value == null || !Number.isFinite(value)) return fallback;
  return `${value.toFixed(2)} s`;
}

function formatDragTimeConstant(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  return `${value.toFixed(3)} s`;
}
