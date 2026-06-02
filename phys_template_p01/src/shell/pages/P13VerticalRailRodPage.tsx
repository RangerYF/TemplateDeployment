import { useEffect, useMemo, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import type { P13SingleRodAnalysisStep } from '@/domains/em/p13/types';
import {
  P13_VERTICAL_RAIL_ANALYSIS_TOTAL_STEPS,
  P13_VERTICAL_RAIL_CURRENT_DIRECTION_LABELS,
  P13_VERTICAL_RAIL_HORIZONTAL_DIRECTION_LABELS,
  P13_VERTICAL_RAIL_ROD_META,
  P13_VERTICAL_RAIL_ROD_PARAM_CONFIG,
  P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS,
  buildVerticalRailAnalysisSteps,
  normalizeVerticalRailRodParams,
  sampleVerticalRailRodStateAtTime,
  simulateVerticalRailRodModel,
  type P13VerticalRailRodParamKey,
  type P13VerticalRailRodSimulationResult,
  type P13VerticalRailRodState,
} from '@/domains/em/p13/vertical-rail-rod';
import {
  P13LegendBadge,
  P13MetricLine,
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
import {
  P13HorizontalResistorBody,
  scaleArrowLength,
} from './p13/P13StagePrimitives';
import { P13TimeSeriesChart } from './p13/P13TimeSeriesChart';
import { registerPageSnapshotAdapter } from '@/snapshotPageRegistry';

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
const RAIL_COLOR = '#7C5A3C';
const ROD_COLOR = '#F97316';

export function P13VerticalRailRodPage({ onBack }: Props) {
  const [params, setParams] = useState(() => normalizeVerticalRailRodParams());
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [displayOptions, setDisplayOptions] = useState<P13DisplayOptions>(DEFAULT_P13_DISPLAY_OPTIONS);

  useEffect(() => {
    simulator.unload();
  }, []);

  useEffect(() => registerPageSnapshotAdapter('p13-vertical-rail-rod', {
    getSnapshot: () => ({ params, currentTime, isPlaying, analysisStep, displayOptions }),
    loadSnapshot: (snapshot) => {
      const value = snapshot as Partial<{
        params: Parameters<typeof normalizeVerticalRailRodParams>[0];
        currentTime: number;
        isPlaying: boolean;
        analysisStep: number;
        displayOptions: P13DisplayOptions;
      }>;
      if (value.params) setParams(normalizeVerticalRailRodParams(value.params));
      if (typeof value.currentTime === 'number') setCurrentTime(value.currentTime);
      if (typeof value.isPlaying === 'boolean') setIsPlaying(value.isPlaying);
      if (typeof value.analysisStep === 'number') setAnalysisStep(value.analysisStep);
      if (value.displayOptions) setDisplayOptions(value.displayOptions);
    },
  }), [analysisStep, currentTime, displayOptions, isPlaying, params]);

  const result = useMemo(() => simulateVerticalRailRodModel(params), [params]);
  const currentState = useMemo(
    () => sampleVerticalRailRodStateAtTime(result, currentTime),
    [result, currentTime],
  );
  const analysisSteps = useMemo(
    () => buildVerticalRailAnalysisSteps(result, currentState),
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

  function updateNumericParam(key: P13VerticalRailRodParamKey, value: number): void {
    setParams((previous) => normalizeVerticalRailRodParams({ ...previous, [key]: value }));
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

  function beginAnalysis(): void {
    setIsPlaying(false);
    if (currentTime <= 1e-6) {
      setCurrentTime(Math.min(result.duration, Math.max(result.timeStep * 16, 0.2)));
    }
    setAnalysisStep(1);
  }

  const badges = [
    { label: '模型', value: P13_VERTICAL_RAIL_ROD_META.code, tone: 'primary' as const },
    {
      label: '总电阻',
      value: `${formatNumber(result.summary.totalResistance, 2)} Ω`,
      tone: 'muted' as const,
    },
    {
      label: '当前速度',
      value: `${formatNumber(currentState.velocity, 3)} m/s`,
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
      title={`${P13_VERTICAL_RAIL_ROD_META.code} ${P13_VERTICAL_RAIL_ROD_META.title}`}
      subtitle={P13_VERTICAL_RAIL_ROD_META.pageSubtitle}
      onBack={onBack}
      badges={badges}
      modelRail={<VerticalRailModelRail />}
      leftPanel={
        <div className="space-y-4">
          <P13PanelCard
            title="参数区"
            subtitle="按课堂理想模型，仅保留 B / L / m / R棒 / R 五个主参数。"
          >
            <div className="space-y-4">
              {(Object.keys(P13_VERTICAL_RAIL_ROD_PARAM_CONFIG) as P13VerticalRailRodParamKey[])
                .map((key) => {
                  const config = P13_VERTICAL_RAIL_ROD_PARAM_CONFIG[key];
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
            <P13MetricLine label="导轨方向" value="竖直放置" />
            <P13MetricLine label="导体棒方向" value="水平横跨两轨" />
            <P13MetricLine label="初始条件" value="从静止释放，v0 = 0" />
            <P13MetricLine label="受力方程" value="m dv/dt = mg - B²L²v / (R + R棒)" emphasis />
            <P13MetricLine label="终态条件" value="mg = B²L²v终 / (R + R棒)" emphasis />
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

          <P13PanelCard
            title="电路拓扑"
            subtitle="竖直导轨只保留理想闭合回路，不引入自感、空气阻力和接触电阻波动。"
          >
            <VerticalRailTopologyView state={currentState} />
          </P13PanelCard>

          <P13PanelCard title="当前联动值">
            <P13MetricLine label="ε = BLv" value={`${formatNumber(currentState.emf, 3)} V`} emphasis />
            <P13MetricLine
              label={P13_VERTICAL_RAIL_ROD_META.currentFormulaLabel}
              value={`${formatNumber(currentState.current, 3)} A`}
              emphasis
            />
            <P13MetricLine
              label="F安 = BIL"
              value={`${formatNumber(currentState.ampereForce, 3)} N`}
              emphasis
            />
            <P13MetricLine label="重力 mg" value={`${formatNumber(currentState.gravityForce, 3)} N`} />
            <P13MetricLine label="合力（向下为正）" value={`${formatNumber(currentState.netForce, 3)} N`} />
            <P13MetricLine label="a = (mg - F安) / m" value={`${formatNumber(currentState.acceleration, 3)} m/s²`} />
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
          subtitle="速度、电动势、电流和安培力均对应同一时刻；重力固定向下，安培力随速度增长逐步抬升。"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <P13LegendBadge label="速度 v" color={P13_SHELL_COLORS.velocity} />
              <P13LegendBadge label="电动势 ε" color={P13_SHELL_COLORS.emf} />
              <P13LegendBadge label="电流 i" color={P13_SHELL_COLORS.current} />
              <P13LegendBadge label="安培力 F安" color={P13_SHELL_COLORS.force} />
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

          <VerticalRailStage
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
            title="v-t 图"
            unit="m/s"
            color={P13_SHELL_COLORS.velocity}
            formula="v(t) = v终 · (1 - e^(-t/τ))"
            samples={result.samples.map((sample) => ({
              time: sample.time,
              value: sample.velocity,
            }))}
            currentTime={currentTime}
            currentValue={currentState.velocity}
          />
          <P13TimeSeriesChart
            title="i-t 图"
            unit="A"
            color={P13_SHELL_COLORS.current}
            formula={P13_VERTICAL_RAIL_ROD_META.currentFormula}
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
          title="分析受力"
          subtitle="按课堂顺序判断：运动方向 → 感应电动势方向 → 电流方向 → 安培力方向。"
        >
          <div className="mb-3 flex flex-wrap gap-2">
            <button
              onClick={beginAnalysis}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={PRIMARY_BUTTON_STYLE}
            >
              分析受力
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setAnalysisStep((previous) =>
                  Math.min(P13_VERTICAL_RAIL_ANALYSIS_TOTAL_STEPS, previous + 1),
                );
              }}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                ...SECONDARY_BUTTON_STYLE,
                opacity: analysisStep >= P13_VERTICAL_RAIL_ANALYSIS_TOTAL_STEPS ? 0.45 : 1,
              }}
              disabled={analysisStep >= P13_VERTICAL_RAIL_ANALYSIS_TOTAL_STEPS}
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
          subtitle="结果区固定给出 v终、i终 和终态解释，便于课堂直接落到结论口径。"
        >
          <div
            className="mb-4 rounded-2xl px-4 py-3"
            style={{
              backgroundColor: P13_SHELL_COLORS.primarySoft,
              border: `1px solid ${P13_SHELL_COLORS.primaryBorder}`,
            }}
          >
            <div className="text-sm font-semibold" style={{ color: P13_SHELL_COLORS.primary }}>
              {P13_VERTICAL_RAIL_ROD_META.terminalHeadline}
            </div>
            <p className="mt-1 text-xs leading-5" style={{ color: P13_SHELL_COLORS.secondary }}>
              {result.summary.terminalExplanation}
            </p>
          </div>

          <P13MetricLine label="时间常数 τ" value={formatPhysicalTime(result.summary.timeConstant)} emphasis />
          <P13MetricLine
            label="理论终态速度 v终"
            value={`${formatNumber(result.summary.theoreticalTerminalVelocity, 4)} m/s`}
            emphasis
          />
          <P13MetricLine
            label="理论终态电流 i终"
            value={`${formatNumber(result.summary.theoreticalTerminalCurrent, 4)} A`}
            emphasis
          />
          <P13MetricLine
            label="终态安培力"
            value={`${formatNumber(result.params.mass * result.params.gravity, 4)} N`}
          />
          <P13MetricLine
            label="观测窗末速度"
            value={`${formatNumber(result.samples[result.samples.length - 1]?.velocity ?? 0, 4)} m/s`}
          />
          <P13MetricLine
            label="观测窗末电流"
            value={`${formatNumber(result.samples[result.samples.length - 1]?.current ?? 0, 4)} A`}
          />
          <P13MetricLine
            label="观测窗末安培力"
            value={`${formatNumber(result.samples[result.samples.length - 1]?.ampereForce ?? 0, 4)} N`}
          />
          <P13MetricLine label="初始电流" value={`${formatNumber(result.summary.initialCurrent, 4)} A`} />
          <P13MetricLine label="总电阻" value={`${formatNumber(result.summary.totalResistance, 2)} Ω`} />
          <div
            className="mt-4 rounded-2xl px-3 py-3 text-xs leading-6"
            style={{
              color: P13_SHELL_COLORS.secondary,
              backgroundColor: P13_SHELL_COLORS.blockSoft,
            }}
          >
            采用的课堂约定：{result.summary.adoptedConvention}
          </div>
        </P13PanelCard>
      }
    />
  );
}

function VerticalRailModelRail() {
  return (
    <div className="flex flex-wrap gap-2">
      <div
        className="rounded-2xl px-3 py-2 text-sm"
        style={{
          color: P13_SHELL_COLORS.primary,
          backgroundColor: P13_SHELL_COLORS.primarySoft,
          border: `1px solid ${P13_SHELL_COLORS.primaryBorder}`,
        }}
      >
        <span className="font-semibold">{P13_VERTICAL_RAIL_ROD_META.code}</span>
        <span className="mx-2 opacity-50">·</span>
        <span>{P13_VERTICAL_RAIL_ROD_META.shortTitle}</span>
        <span className="ml-2 text-xs opacity-70">已开放</span>
      </div>
    </div>
  );
}

function VerticalRailTopologyView({ state }: { state: P13VerticalRailRodState }) {
  return (
    <svg viewBox="0 0 320 180" style={{ width: '100%', display: 'block' }} aria-label="竖直导轨闭合回路示意">
      <rect x="10" y="10" width="300" height="160" rx="22" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      <text x="24" y="34" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
        {P13_VERTICAL_RAIL_ROD_META.topologyTitle}
      </text>
      <text x="24" y="52" fill={P13_SHELL_COLORS.secondary} fontSize="11">
        当前电流：{P13_VERTICAL_RAIL_CURRENT_DIRECTION_LABELS[state.currentDirection]}
      </text>

      <line x1="92" y1="58" x2="92" y2="134" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
      <line x1="228" y1="58" x2="228" y2="134" stroke={RAIL_COLOR} strokeWidth="5" strokeLinecap="round" />
      <line x1="92" y1="134" x2="228" y2="134" stroke={ROD_COLOR} strokeWidth="9" strokeLinecap="round" />
      <text x="236" y="138" fill={P13_SHELL_COLORS.text} fontSize="11" fontWeight="600">
        导体棒
      </text>

      <line x1="92" y1="58" x2="112" y2="58" stroke="#64748B" strokeWidth="4" />
      <P13HorizontalResistorBody leftX={116} centerY={58} width={84} height={18} strokeWidth={2.5} />
      <line x1="208" y1="58" x2="228" y2="58" stroke="#64748B" strokeWidth="4" />
      <text x="128" y="38" fill={P13_SHELL_COLORS.secondary} fontSize="11">
        外接电阻 R
      </text>

      {state.currentDirection !== 'none' && (
        <>
          <line
            x1={state.currentDirection === 'clockwise' ? 108 : 212}
            y1="134"
            x2={state.currentDirection === 'clockwise' ? 212 : 108}
            y2="134"
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#vertical-topology-current)"
          />
        </>
      )}

      <text x="24" y="154" fill={P13_SHELL_COLORS.secondary} fontSize="11">
        下落越快，棒中 BLv 越大，回路电流与向上的安培力越强。
      </text>

      <defs>
        <marker id="vertical-topology-current" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={P13_SHELL_COLORS.current} />
        </marker>
      </defs>
    </svg>
  );
}

function VerticalRailStage({
  result,
  state,
  analysisStep,
  displayOptions,
}: {
  result: P13VerticalRailRodSimulationResult;
  state: P13VerticalRailRodState;
  analysisStep: number;
  displayOptions: P13DisplayOptions;
}) {
  const leftRailX = 260;
  const rightRailX = 500;
  const branchY = 108;
  const rodTopY = 152;
  const rodBottomY = 312;
  const maxObservedDisplacement = result.samples.reduce(
    (max, sample) => Math.max(max, sample.position),
    0,
  );
  const displayDisplacement = Math.max(0.6, maxObservedDisplacement);
  const rodY = clamp(
    rodTopY + ((state.position / displayDisplacement) * (rodBottomY - rodTopY)),
    rodTopY,
    rodBottomY,
  );
  const showVelocity = displayOptions.showVectors && analysisStep >= 1;
  const showEmf = displayOptions.showVectors && analysisStep >= 2;
  const showCurrent = displayOptions.showVectors && analysisStep >= 3;
  const showForce = displayOptions.showVectors && analysisStep >= 4;
  const maxSpeedMagnitude = result.samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample.velocity)),
    Math.abs(state.velocity),
  );
  const maxForceMagnitude = result.samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample.ampereForce)),
    Math.abs(state.ampereForce),
  );
  const speedArrowLength = scaleArrowLength(state.velocity, maxSpeedMagnitude, 42, 92);
  const forceArrowLength = scaleArrowLength(state.ampereForce, maxForceMagnitude, 34, 84);

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }}>
      <defs>
        <marker id="vertical-velocity" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="vertical-emf" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.emf} />
        </marker>
        <marker id="vertical-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
        <marker id="vertical-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
        <marker id="vertical-gravity" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748B" />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      <rect x="148" y="64" width="464" height="274" rx="28" fill="#F7FBFF" stroke="#D7E7F9" />

      {displayOptions.showGrid && <P13StageGrid left={160} top={76} right={600} bottom={326} />}

      {displayOptions.showGrid &&
        Array.from({ length: 8 }).map((_, row) =>
          Array.from({ length: 8 }).map((__, column) => (
            <text
              key={`${row}-${column}`}
              x={184 + (column * 50)}
              y={100 + (row * 30)}
              fill="#90A4B8"
              fontSize="13"
              textAnchor="middle"
            >
              ×
            </text>
          )),
        )}

      {displayOptions.showAxes && <P13StageAxes originX={168} originY={332} />}

      {displayOptions.showLabels && (
        <>
          <text x="42" y="44" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
            匀强磁场中的竖直导轨单棒
          </text>
          <text x="42" y="64" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            {P13_VERTICAL_RAIL_ROD_META.topologyTitle} · {P13_VERTICAL_RAIL_ROD_META.code}
          </text>
        </>
      )}

      <line x1={leftRailX} y1={branchY} x2={leftRailX} y2="330" stroke={RAIL_COLOR} strokeWidth="7" strokeLinecap="round" />
      <line x1={rightRailX} y1={branchY} x2={rightRailX} y2="330" stroke={RAIL_COLOR} strokeWidth="7" strokeLinecap="round" />
      <line x1={leftRailX} y1={branchY} x2="286" y2={branchY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      <P13HorizontalResistorBody leftX={300} centerY={branchY} width={132} height={24} strokeWidth={3} />
      <line x1="446" y1={branchY} x2={rightRailX} y2={branchY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      {displayOptions.showLabels && (
        <text x="318" y="86" fill={P13_SHELL_COLORS.secondary} fontSize="12">
          外接电阻 R
        </text>
      )}

      <line x1={leftRailX} y1={rodY} x2={rightRailX} y2={rodY} stroke={ROD_COLOR} strokeWidth="12" strokeLinecap="round" />
      {displayOptions.showLabels && (
        <text x="514" y={rodY + 6} fill={P13_SHELL_COLORS.text} fontSize="12" fontWeight="600">
          R棒
        </text>
      )}

      <line x1="208" y1={rodY - 58} x2="208" y2={rodY + 20} stroke="#64748B" strokeWidth="4" markerEnd="url(#vertical-gravity)" />
      {displayOptions.showLabels && (
        <text x="194" y={rodY - 68} fill="#64748B" fontSize="12" fontWeight="600">
          G
        </text>
      )}

      {showCurrent && state.currentDirection !== 'none' && (
        <>
          <line
            x1={state.currentDirection === 'clockwise' ? 482 : 278}
            y1={branchY - 18}
            x2={state.currentDirection === 'clockwise' ? 278 : 482}
            y2={branchY - 18}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#vertical-current)"
          />
          <line
            x1={state.currentDirection === 'clockwise' ? leftRailX - 18 : rightRailX + 18}
            y1={branchY + 16}
            x2={state.currentDirection === 'clockwise' ? leftRailX - 18 : rightRailX + 18}
            y2={rodY - 12}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#vertical-current)"
          />
          <line
            x1={state.currentDirection === 'clockwise' ? leftRailX + 18 : rightRailX - 18}
            y1={rodY + 18}
            x2={state.currentDirection === 'clockwise' ? rightRailX - 18 : leftRailX + 18}
            y2={rodY + 18}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#vertical-current)"
          />
          <line
            x1={state.currentDirection === 'clockwise' ? rightRailX + 18 : leftRailX - 18}
            y1={rodY - 12}
            x2={state.currentDirection === 'clockwise' ? rightRailX + 18 : leftRailX - 18}
            y2={branchY + 16}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#vertical-current)"
          />
          {displayOptions.showLabels && (
            <text x="526" y="118" fill={P13_SHELL_COLORS.current} fontSize="12" fontWeight="600">
              电流：{P13_VERTICAL_RAIL_CURRENT_DIRECTION_LABELS[state.currentDirection]}
            </text>
          )}
          <line
            x1={state.currentDirection === 'clockwise' ? leftRailX + 20 : rightRailX - 20}
            y1={rodY}
            x2={state.currentDirection === 'clockwise' ? rightRailX - 20 : leftRailX + 20}
            y2={rodY}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="5"
            markerEnd="url(#vertical-current)"
          />
        </>
      )}

      {showVelocity && state.motionDirection !== 'none' && (
        <>
          <line
            x1={rightRailX + 48}
            y1={rodY - (speedArrowLength * 0.5)}
            x2={rightRailX + 48}
            y2={rodY + (speedArrowLength * 0.5)}
            stroke={P13_SHELL_COLORS.velocity}
            strokeWidth="4"
            markerEnd="url(#vertical-velocity)"
          />
          {displayOptions.showLabels && (
            <text x={rightRailX + 62} y={rodY - 48} fill={P13_SHELL_COLORS.velocity} fontSize="12" fontWeight="600">
              v：{P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS[state.motionDirection]}
            </text>
          )}
        </>
      )}

      {showEmf && state.emfDirection !== 'none' && (
        <>
          <line
            x1={state.emfDirection === 'right' ? leftRailX + 20 : rightRailX - 20}
            y1={rodY - 20}
            x2={state.emfDirection === 'right' ? rightRailX - 20 : leftRailX + 20}
            y2={rodY - 20}
            stroke={P13_SHELL_COLORS.emf}
            strokeWidth="4"
            markerEnd="url(#vertical-emf)"
          />
          {displayOptions.showLabels && (
            <text x="320" y={rodY - 32} fill={P13_SHELL_COLORS.emf} fontSize="12" fontWeight="600">
              ε：{P13_VERTICAL_RAIL_HORIZONTAL_DIRECTION_LABELS[state.emfDirection]}
            </text>
          )}
        </>
      )}

      {showForce && state.ampereForceDirection !== 'none' && (
        <>
          <line
            x1={leftRailX - 48}
            y1={rodY + (forceArrowLength * 0.5)}
            x2={leftRailX - 48}
            y2={rodY - (forceArrowLength * 0.5)}
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#vertical-force)"
          />
          {displayOptions.showLabels && (
            <text x={leftRailX - 104} y={rodY + 50} fill={P13_SHELL_COLORS.force} fontSize="12" fontWeight="600">
              F安：{P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS[state.ampereForceDirection]}
            </text>
          )}
        </>
      )}

      {displayOptions.showLabels && (
        <>
          <rect x="524" y="226" width="172" height="98" rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
          <text x="540" y="248" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前状态
          </text>
          <text x="540" y="270" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            y = {formatNumber(state.position, 4)} m
          </text>
          <text x="540" y="290" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            v = {formatNumber(state.velocity, 4)} m/s
          </text>
          <text x="540" y="310" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            i = {formatNumber(state.current, 4)} A
          </text>
        </>
      )}
    </svg>
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
  step: P13SingleRodAnalysisStep;
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
        {visible ? step.description : '从当前时刻开始逐步判断，这一步的方向会在推进后显示。'}
      </p>
    </div>
  );
}

function formatByStep(value: number, step: number): string {
  const decimals = Math.max(0, (step.toString().split('.')[1] ?? '').length);
  return value.toFixed(decimals);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value: number, decimals = 3): string {
  if (!Number.isFinite(value)) return '∞';
  return value.toFixed(decimals);
}

function formatPhysicalTime(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value < 0.2) {
    return `${(value * 1000).toFixed(value < 0.02 ? 2 : 1)} ms`;
  }
  return `${value.toFixed(value >= 10 ? 1 : 2)} s`;
}
