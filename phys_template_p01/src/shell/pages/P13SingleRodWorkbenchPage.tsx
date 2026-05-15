import { useEffect, useMemo, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import type {
  P13SingleRodAnalysisStep,
  P13SingleRodSimulationResult,
  P13SingleRodState,
  P13SingleRodVariant,
} from '@/domains/em/p13/types';
import {
  P13_HORIZONTAL_DIRECTION_LABELS,
  P13_LOOP_CURRENT_DIRECTION_LABELS,
  P13_SINGLE_ROD_ANALYSIS_TOTAL_STEPS,
  P13_SINGLE_ROD_PARAM_CONFIG,
  P13_VERTICAL_DIRECTION_LABELS,
  type P13SingleRodParamKey,
  buildSingleRodAnalysisSteps,
  getSingleRodVariantMeta,
  normalizeSingleRodParams,
  sampleSingleRodStateAtTime,
  simulateSingleRodModel,
} from '@/domains/em/p13/single-rod';
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
import {
  P13VerticalResistorBody,
  scaleArrowLength,
} from './p13/P13StagePrimitives';
import { P13TimeSeriesChart } from './p13/P13TimeSeriesChart';

interface Props {
  variant: P13SingleRodVariant;
  onBack: () => void;
  onSelectPreset: (presetId: string) => void;
}

type SingleRodCapacitorScenario = 'charge' | 'discharge' | 'external-force';

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

const PLAYBACK_PHYSICAL_SECONDS_PER_REAL_SECOND = 1;
const PLAYBACK_SHORT_TRANSIENT_REALTIME_SECONDS = 4;
const SINGLE_ROD_STAGE_METERS_TO_PIXELS = 56;
const SINGLE_ROD_MAX_VISIBLE_DISPLACEMENT = 4.3;
const SINGLE_ROD_REFERENCE_SPEED = P13_SINGLE_ROD_PARAM_CONFIG.initialVelocity.max;
const SINGLE_ROD_REFERENCE_FORCE = P13_SINGLE_ROD_PARAM_CONFIG.externalForce.max;

export function P13SingleRodWorkbenchPage({
  variant,
  onBack,
  onSelectPreset,
}: Props) {
  const meta = getSingleRodVariantMeta(variant);
  const [params, setParams] = useState(() => normalizeSingleRodParams(variant));
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [capacitorScenario, setCapacitorScenario] = useState<SingleRodCapacitorScenario>('charge');
  const [displayOptions, setDisplayOptions] = useState<P13DisplayOptions>(DEFAULT_P13_DISPLAY_OPTIONS);

  useEffect(() => {
    simulator.unload();
  }, []);

  useEffect(() => {
    setParams(normalizeSingleRodParams(variant));
    setCurrentTime(0);
    setIsPlaying(true);
    setAnalysisStep(0);
    setCapacitorScenario('charge');
  }, [variant]);

  const result = useMemo(() => simulateSingleRodModel(variant, params), [variant, params]);
  const currentState = useMemo(
    () => sampleSingleRodStateAtTime(result, currentTime),
    [result, currentTime],
  );
  const analysisSteps = useMemo(
    () => buildSingleRodAnalysisSteps(result, currentState),
    [result, currentState],
  );
  const playbackPhysicalRate = useMemo(
    () => (
      result.duration < PLAYBACK_PHYSICAL_SECONDS_PER_REAL_SECOND
        ? Math.max(result.duration / PLAYBACK_SHORT_TRANSIENT_REALTIME_SECONDS, 1e-4)
        : PLAYBACK_PHYSICAL_SECONDS_PER_REAL_SECOND
    ),
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

  function updateNumericParam(key: P13SingleRodParamKey, value: number): void {
    setParams((previous) => normalizeSingleRodParams(variant, { ...previous, [key]: value }));
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

  function applyCapacitorScenario(nextScenario: SingleRodCapacitorScenario): void {
    if (variant !== 'with-capacitor') return;
    setCapacitorScenario(nextScenario);
    setParams((previous) => normalizeSingleRodParams('with-capacitor', {
      ...previous,
      initialVelocity:
        nextScenario === 'charge'
          ? Math.max(previous.initialVelocity, 5)
          : 0,
      initialCapacitorVoltage:
        nextScenario === 'charge'
          ? 0
          : nextScenario === 'discharge'
            ? Math.max(previous.initialCapacitorVoltage, 20)
            : 0,
      externalForce: nextScenario === 'external-force' ? Math.max(previous.externalForce, 1.2) : 0,
      frictionCoefficient: nextScenario === 'external-force' ? 0 : previous.frictionCoefficient,
      capacitanceMicroFarad:
        nextScenario === 'discharge'
          ? Math.max(previous.capacitanceMicroFarad, 1000)
          : previous.capacitanceMicroFarad,
    }));
    setCurrentTime(0);
    setIsPlaying(true);
    setAnalysisStep(0);
  }

  const displayedCurrent = getDisplayedCurrentValue(variant, currentState.current);
  const displayedTheoreticalTerminalCurrent = getDisplayedCurrentValue(
    variant,
    result.summary.theoreticalTerminalCurrent,
  );
  const displayedObservedTerminalCurrent = getDisplayedCurrentValue(
    variant,
    result.samples[result.samples.length - 1]?.current ?? 0,
  );
  const displayedInitialCurrent = getDisplayedCurrentValue(variant, result.summary.initialCurrent);
  const currentChartFormula = getDisplayedCurrentFormula(variant, meta.currentFormula, result.summary.simplifiedMode);
  const capacitorExternalForceMode = variant === 'with-capacitor' && result.summary.simplifiedMode;
  const capacitorVisibleParamKeys = variant === 'with-capacitor'
    ? meta.visibleParamKeys.filter((key) => {
      if (capacitorScenario === 'external-force') {
        return !['initialVelocity', 'initialCapacitorVoltage', 'frictionCoefficient'].includes(key);
      }
      return key !== 'externalForce';
    })
    : meta.visibleParamKeys;

  const badges = [
    { label: '模型', value: meta.code, tone: 'primary' as const },
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
      value: `${formatNumber(displayedCurrent, 3)} A`,
      tone: 'warning' as const,
    },
    ...(variant === 'with-source'
      ? [{
          label: '电源',
          value: `ε0 = ${formatNumber(params.sourceVoltage, 1)} V`,
          tone: 'muted' as const,
        }]
      : variant === 'with-capacitor'
        ? [{
            label: '情形',
            value: capacitorScenario === 'charge' ? '充电式' : capacitorScenario === 'discharge' ? '放电式' : '恒外力式',
            tone: 'muted' as const,
          }, {
            label: '电容',
            value: `Uc = ${formatNumber(currentState.capacitorVoltage, 3)} V`,
            tone: 'muted' as const,
          }]
        : []),
  ];

  return (
    <P13WorkbenchShell
      title={`${meta.code} ${meta.title}`}
      subtitle={meta.pageSubtitle}
      onBack={onBack}
      badges={badges}
      scrollResetKey={variant === 'with-capacitor' ? capacitorScenario : variant}
      modelRail={<SingleRodModelRail activeVariant={variant} onSelectPreset={onSelectPreset} />}
      leftPanel={
        <div className="space-y-4">
          <P13PanelCard
            title="参数区"
            subtitle={variant === 'with-capacitor'
              ? '含电容模型已开放充电式 / 放电式 / 恒外力式三种课堂情形；其中恒外力式按教学简化单独处理。'
              : '三支单棒模型共用同一套参数壳层，只按变体增加少量专属参数。'}
          >
            <div className="space-y-4">
              {capacitorVisibleParamKeys.map((key) => {
                const config = P13_SINGLE_ROD_PARAM_CONFIG[key];
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

          {variant === 'with-capacitor' && (
            <P13PanelCard
              title="电容情形"
              subtitle="三种课堂高频口径统一在一个页面里切换；恒外力式会明确标注为教学简化。"
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applyCapacitorScenario('charge')}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={capacitorScenario === 'charge' ? PRIMARY_BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
                >
                  充电式
                </button>
                <button
                  type="button"
                  onClick={() => applyCapacitorScenario('discharge')}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={capacitorScenario === 'discharge' ? PRIMARY_BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
                >
                  放电式
                </button>
                <button
                  type="button"
                  onClick={() => applyCapacitorScenario('external-force')}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={capacitorScenario === 'external-force' ? PRIMARY_BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
                >
                  恒外力式
                </button>
              </div>
              <p className="mt-3 text-xs leading-6" style={{ color: P13_SHELL_COLORS.secondary }}>
                {capacitorScenario === 'charge'
                  ? '充电式：Uc0 = 0，导体棒带初速度，随后电容被动生电动势充电，电流衰减到 0。'
                  : capacitorScenario === 'discharge'
                    ? '放电式：v0 = 0，电容先带初始电压；这里默认把 Uc0 和 C 提到课堂演示更容易看清的量级，闭合后能明显看到导体棒被放电电流启动。'
                    : '恒外力式：按教学简化，导体棒受恒定外力近似做匀加速运动；回路继续展示 Uc 和 i 的建立过程，但不把安培力反作用回速度。'}
              </p>
            </P13PanelCard>
          )}

          <P13PanelCard title="模型约定">
            <P13MetricLine label="磁场方向" value="垂直纸面向内 ×" />
            <P13MetricLine label="导体棒方向" value="竖直放置于导轨上" />
            <P13MetricLine label="回路电阻" value="R总 = R + R棒" />
            <P13MetricLine label="当前电流公式" value={currentChartFormula} />
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
            subtitle="按当前模型切换纯电阻 / 含电源 / 含电容拓扑，不只是换标题。"
          >
            <SingleRodTopologyView result={result} state={currentState} />
          </P13PanelCard>

          <P13PanelCard title="当前联动值">
            <P13MetricLine label="ε = BLv" value={`${formatNumber(currentState.emf, 3)} V`} emphasis />
            <P13MetricLine
              label={variant === 'with-source' ? '电流强度 |i|' : meta.currentFormulaLabel}
              value={`${formatNumber(displayedCurrent, 3)} A`}
              emphasis
            />
            <P13MetricLine label="F安 = BIL" value={`${formatNumber(currentState.ampereForce, 3)} N`} emphasis />
            {capacitorExternalForceMode && (
              <P13MetricLine label="恒定外力 F外" value={`${formatNumber(currentState.externalForce, 3)} N`} emphasis />
            )}
            {params.frictionCoefficient > 0 && (
              <P13MetricLine label="摩擦力 f" value={`${formatNumber(currentState.frictionForce, 3)} N`} emphasis />
            )}
            <P13MetricLine
              label={capacitorExternalForceMode ? '教学加速度 a' : 'a = ΣF / m'}
              value={`${formatNumber(currentState.acceleration, 3)} m/s²`}
            />
            {variant === 'with-source' && (
              <P13MetricLine label="电源电动势" value={`${formatNumber(currentState.sourceVoltage, 3)} V`} />
            )}
            {variant === 'with-capacitor' && (
              <P13MetricLine label="U电容" value={`${formatNumber(currentState.capacitorVoltage, 3)} V`} />
            )}
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
          subtitle="物理场景与小型回路拓扑保持一致，速度、动生电动势、电流与安培力按同一时刻同步刷新。"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <P13LegendBadge label="速度 v" color={P13_SHELL_COLORS.velocity} />
              <P13LegendBadge label="电动势 ε" color={P13_SHELL_COLORS.emf} />
              <P13LegendBadge label="电流 i" color={P13_SHELL_COLORS.current} />
              <P13LegendBadge label="安培力 F安" color={P13_SHELL_COLORS.force} />
              {capacitorExternalForceMode && (
                <P13LegendBadge label="恒外力 F外" color={P13_SHELL_COLORS.primary} />
              )}
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

          <SingleRodStage
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
        <div className={`grid gap-4 ${variant === 'with-capacitor' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
          <P13TimeSeriesChart
            title="v-t 图"
            unit="m/s"
            color={P13_SHELL_COLORS.velocity}
            formula={getVelocityFormula(variant, params, result.summary.simplifiedMode)}
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
            formula={currentChartFormula}
            samples={result.samples.map((sample) => ({
              time: sample.time,
              value: getDisplayedCurrentValue(variant, sample.current),
            }))}
            currentTime={currentTime}
            currentValue={displayedCurrent}
          />
          {variant === 'with-capacitor' && (
            <P13TimeSeriesChart
              title="Uc-t 图"
              unit="V"
              color={P13_SHELL_COLORS.emf}
              formula="dUc/dt = i / C"
              samples={result.samples.map((sample) => ({
                time: sample.time,
                value: sample.capacitorVoltage,
              }))}
              currentTime={currentTime}
              currentValue={currentState.capacitorVoltage}
            />
          )}
        </div>
      }
      analysisPanel={
        <P13PanelCard
          title="分析受力"
          subtitle="仍按课堂顺序判断：速度方向 → EMF 方向 → 电流方向 → 安培力方向。"
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
              分析受力
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setAnalysisStep((previous) =>
                  Math.min(P13_SINGLE_ROD_ANALYSIS_TOTAL_STEPS, previous + 1),
                );
              }}
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                ...SECONDARY_BUTTON_STYLE,
                opacity: analysisStep >= P13_SINGLE_ROD_ANALYSIS_TOTAL_STEPS ? 0.45 : 1,
              }}
              disabled={analysisStep >= P13_SINGLE_ROD_ANALYSIS_TOTAL_STEPS}
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
          subtitle={capacitorExternalForceMode
            ? '恒外力式按教学简化输出长期口径、加速度和当前观测窗末态。'
            : '统一输出理论终态、解释文案和当前观测窗末态，避免页面结束后没有可讲的数值口径。'}
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

          <P13MetricLine label="时间常数 τ" value={formatPhysicalTime(result.summary.timeConstant)} emphasis />
          {!capacitorExternalForceMode && (
            <P13MetricLine label="理论终态速度" value={`${formatNumber(result.summary.theoreticalTerminalVelocity, 4)} m/s`} emphasis />
          )}
          {capacitorExternalForceMode && (
            <P13MetricLine
              label="教学加速度 a"
              value={`${formatNumber(result.summary.theoreticalAcceleration ?? 0, 4)} m/s²`}
              emphasis
            />
          )}
          <P13MetricLine
            label={capacitorExternalForceMode
              ? '理论渐近电流'
              : variant === 'with-source'
                ? '理论终态电流强度'
                : '理论终态电流'}
            value={`${formatNumber(displayedTheoreticalTerminalCurrent, 4)} A`}
            emphasis
          />
          {variant === 'with-capacitor' && !capacitorExternalForceMode && (
            <P13MetricLine
              label="理论 U电容"
              value={`${formatNumber(result.summary.theoreticalTerminalCapacitorVoltage, 4)} V`}
              emphasis
            />
          )}
          <P13MetricLine
            label="观测窗末速度"
            value={`${formatNumber(result.samples[result.samples.length - 1]?.velocity ?? 0, 4)} m/s`}
          />
          <P13MetricLine
            label="观测窗末电流"
            value={`${formatNumber(displayedObservedTerminalCurrent, 4)} A`}
          />
          {params.frictionCoefficient > 0 && (
            <P13MetricLine
              label="停止时间"
              value={result.summary.stopTime === null ? '当前结构不收敛到静止' : formatPhysicalTime(result.summary.stopTime)}
            />
          )}
          {variant === 'with-capacitor' && (
            <P13MetricLine
              label="观测窗末 U电容"
              value={`${formatNumber(result.samples[result.samples.length - 1]?.capacitorVoltage ?? 0, 4)} V`}
            />
          )}
          {capacitorExternalForceMode && (
            <P13MetricLine
              label="当前外力 F外"
              value={`${formatNumber(currentState.externalForce, 4)} N`}
            />
          )}
          <P13MetricLine
            label={variant === 'with-source' ? '初始电流强度' : '初始电流'}
            value={`${formatNumber(displayedInitialCurrent, 4)} A`}
          />
          <P13MetricLine label="总电阻" value={`${formatNumber(result.summary.totalResistance, 2)} Ω`} />
          {variant === 'resistive' && params.frictionCoefficient <= 0 && (
            <>
              <P13MetricLine
                label="停止时间"
                value={result.summary.stopTime === null ? '无有限停止时刻' : formatPhysicalTime(result.summary.stopTime)}
              />
              <P13MetricLine
                label="极限位移"
                value={
                  result.summary.asymptoticDisplacement === null
                    ? '本模型不单独给出'
                    : `${formatNumber(result.summary.asymptoticDisplacement, 4)} m`
                }
              />
            </>
          )}
          <div
            className="mt-4 rounded-2xl px-3 py-3 text-xs leading-6"
            style={{
              color: P13_SHELL_COLORS.secondary,
              backgroundColor: P13_SHELL_COLORS.blockSoft,
            }}
          >
            {result.summary.simplifiedMode ? '教学简化：' : '采用的课堂约定：'}{result.summary.adoptedConvention}
          </div>
        </P13PanelCard>
      }
    />
  );
}

function SingleRodModelRail({
  activeVariant,
  onSelectPreset,
}: {
  activeVariant: P13SingleRodVariant;
  onSelectPreset: (presetId: string) => void;
}) {
  const entries = ([
    getSingleRodVariantMeta('resistive'),
    getSingleRodVariantMeta('with-source'),
    getSingleRodVariantMeta('with-capacitor'),
  ]);

  return (
    <div className="flex flex-wrap gap-2">
      {entries.map((entry) => {
        const active = entry.variant === activeVariant;
        return (
          <P13ModelRailChip
            key={entry.code}
            code={entry.code}
            title={entry.shortTitle}
            state={active ? 'active' : 'available'}
            onSelect={!active ? () => onSelectPreset(entry.presetId) : undefined}
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

function SingleRodTopologyView({
  result,
  state,
}: {
  result: P13SingleRodSimulationResult;
  state: P13SingleRodState;
}) {
  const meta = getSingleRodVariantMeta(result.variant);
  return (
    <svg viewBox="0 0 320 180" style={{ width: '100%', display: 'block' }} aria-label={`${meta.topologyTitle}示意`}>
      <rect x="10" y="10" width="300" height="160" rx="22" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      <text x="24" y="34" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
        {meta.topologyTitle}
      </text>
      <text x="24" y="52" fill={P13_SHELL_COLORS.secondary} fontSize="11">
        当前电流：{P13_LOOP_CURRENT_DIRECTION_LABELS[state.currentDirection]}
      </text>
      <line x1="88" y1="70" x2="232" y2="70" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
      <line x1="88" y1="134" x2="232" y2="134" stroke="#64748B" strokeWidth="4" strokeLinecap="round" />
      <line x1="232" y1="70" x2="232" y2="134" stroke="#0F172A" strokeWidth="9" strokeLinecap="round" />
      <text x="244" y="106" fill={P13_SHELL_COLORS.text} fontSize="11" fontWeight="600">
        导体棒
      </text>

      <BranchElement variant={result.variant} x={88} topY={70} bottomY={134} compact />

      {state.currentDirection !== 'none' && (
        <line
          x1="232"
          y1={state.currentDirection === 'counterclockwise' ? 120 : 84}
          x2="232"
          y2={state.currentDirection === 'counterclockwise' ? 84 : 120}
          stroke={P13_SHELL_COLORS.current}
          strokeWidth="4"
          markerEnd="url(#topology-current-arrow)"
        />
      )}
      <defs>
        <marker id="topology-current-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
          <path d="M 0 0 L 8 4 L 0 8 z" fill={P13_SHELL_COLORS.current} />
        </marker>
      </defs>

      <text x="24" y="152" fill={P13_SHELL_COLORS.secondary} fontSize="11">
        {result.variant === 'with-source'
          ? '静止时电源先驱动顺时针电流'
          : result.variant === 'with-capacitor'
            ? result.summary.simplifiedMode
              ? '教学简化：棒近似做匀加速，回路继续演示电容充电'
              : '动生电动势先给电容充电'
            : '纯电阻回路只由动生电动势驱动'}
      </text>
    </svg>
  );
}

function SingleRodStage({
  result,
  state,
  analysisStep,
  displayOptions,
}: {
  result: P13SingleRodSimulationResult;
  state: P13SingleRodState;
  analysisStep: number;
  displayOptions: P13DisplayOptions;
}) {
  const meta = getSingleRodVariantMeta(result.variant);
  const { magneticField, railSpan } = result.params;
  const initialX = 240;
  const rawRodX = initialX + (state.position * SINGLE_ROD_STAGE_METERS_TO_PIXELS);
  const rodX = clamp(rawRodX, 234, 616);
  const stageOverflowed = state.position > SINGLE_ROD_MAX_VISIBLE_DISPLACEMENT;
  const railLeft = 132;
  const railRight = 668;
  const centerY = 207;
  const railGap = 120 + (((railSpan - 0.1) / 1.9) * 84);
  const topY = centerY - (railGap / 2);
  const bottomY = centerY + (railGap / 2);
  const branchX = 152;
  const showVelocity = displayOptions.showVectors && analysisStep >= 1;
  const showEmf = displayOptions.showVectors && analysisStep >= 2;
  const showCurrent = displayOptions.showVectors && analysisStep >= 3;
  const showForce = displayOptions.showVectors && analysisStep >= 4;
  const currentLoopDirection = state.currentDirection;
  const displayedCurrent = getDisplayedCurrentValue(result.variant, state.current);
  const simplifiedExternalForceMode = result.variant === 'with-capacitor' && result.summary.simplifiedMode;
  const maxSpeedMagnitude = result.samples.reduce(
    (max: number, sample) => Math.max(max, Math.abs(sample.velocity)),
    SINGLE_ROD_REFERENCE_SPEED,
  );
  const maxForceMagnitude = result.samples.reduce(
    (max: number, sample) => Math.max(max, Math.abs(sample.ampereForce), Math.abs(sample.externalForce)),
    SINGLE_ROD_REFERENCE_FORCE,
  );
  const speedArrowLength = scaleArrowLength(state.velocity, maxSpeedMagnitude, 38, 96);
  const forceArrowLength = scaleArrowLength(state.ampereForce, maxForceMagnitude, 34, 92);
  const externalForceArrowLength = scaleArrowLength(state.externalForce, maxForceMagnitude, 34, 96);
  const magneticIntensity = clamp((magneticField - 0.1) / 4.9, 0, 1);
  const fieldColumns = 8 + Math.round(magneticIntensity * 8);
  const fieldRows = 5 + Math.round(magneticIntensity * 4);
  const fieldTint = `rgba(14, 165, 233, ${0.08 + (magneticIntensity * 0.14)})`;
  const fieldMarkColor = magneticIntensity > 0.66 ? '#5B7FA6' : magneticIntensity > 0.33 ? '#7F9BBC' : '#A9BDD3';
  const fieldLabel = `B = ${formatNumber(magneticField, 2)} T`;
  const railLabel = `L = ${formatNumber(railSpan, 2)} m`;

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }}>
      <defs>
        <marker id="single-rod-velocity" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="single-rod-emf" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.emf} />
        </marker>
        <marker id="single-rod-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
        <marker id="single-rod-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
        <marker id="single-rod-external-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.primary} />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      <rect x="120" y="72" width="560" height="260" rx="28" fill="#F7FBFF" stroke="#D7E7F9" />
      <rect x="120" y="72" width="560" height="260" rx="28" fill={fieldTint} />

      {displayOptions.showGrid && <P13StageGrid left={132} top={86} right={668} bottom={318} />}

      {displayOptions.showGrid &&
        Array.from({ length: fieldRows }).map((_, row) =>
          Array.from({ length: fieldColumns }).map((__, column) => (
            <text
              key={`${row}-${column}`}
              x={148 + (column * (504 / Math.max(1, fieldColumns - 1)))}
              y={102 + (row * (196 / Math.max(1, fieldRows - 1)))}
              fill={fieldMarkColor}
              fontSize={12 + (magneticIntensity * 2)}
              textAnchor="middle"
            >
              ×
            </text>
          )),
        )}

      {displayOptions.showAxes && <P13StageAxes originX={142} originY={318} />}

      {displayOptions.showLabels && (
        <>
          <text x="42" y="44" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
            匀强磁场中的单棒回路
          </text>
          <text x="42" y="64" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            {meta.topologyTitle} · {meta.code}
          </text>
          <text x="512" y="64" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            {fieldLabel} · {railLabel} · 统一比例 1 m ≈ {Math.round(SINGLE_ROD_STAGE_METERS_TO_PIXELS)} px
          </text>
          <text x="428" y="82" fill={P13_SHELL_COLORS.secondary} fontSize="11">
            速度箭头按 0-{SINGLE_ROD_REFERENCE_SPEED} m/s、受力箭头按 0-{SINGLE_ROD_REFERENCE_FORCE} N 统一标定
          </text>
          {result.duration < PLAYBACK_PHYSICAL_SECONDS_PER_REAL_SECOND && (
            <text x="42" y="82" fill={P13_SHELL_COLORS.primary} fontSize="11" fontWeight="600">
              短时暂态已慢放到约 {PLAYBACK_SHORT_TRANSIENT_REALTIME_SECONDS} s，便于观察 v-t / i-t / Uc-t
            </text>
          )}
        </>
      )}

      <line x1={railLeft} y1={topY} x2={railRight} y2={topY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      <line x1={railLeft} y1={bottomY} x2={railRight} y2={bottomY} stroke="#64748B" strokeWidth="5" strokeLinecap="round" />
      <BranchElement variant={result.variant} x={branchX} topY={topY} bottomY={bottomY} />

      <line x1={rodX} y1={topY} x2={rodX} y2={bottomY} stroke="#0F172A" strokeWidth="11" strokeLinecap="round" />
      {displayOptions.showLabels && (
        <text x={rodX + 16} y="206" fill={P13_SHELL_COLORS.text} fontSize="12" fontWeight="600">
          R棒
        </text>
      )}

      {showCurrent && currentLoopDirection !== 'none' && (
        <>
          <line
            x1={currentLoopDirection === 'counterclockwise' ? rodX - 14 : branchX + 16}
            y1={topY - 14}
            x2={currentLoopDirection === 'counterclockwise' ? branchX + 16 : rodX - 14}
            y2={topY - 14}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#single-rod-current)"
          />
          <line
            x1={branchX - 18}
            y1={currentLoopDirection === 'counterclockwise' ? topY + 12 : bottomY - 12}
            x2={branchX - 18}
            y2={currentLoopDirection === 'counterclockwise' ? bottomY - 12 : topY + 12}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#single-rod-current)"
          />
          <line
            x1={currentLoopDirection === 'counterclockwise' ? branchX + 16 : rodX - 14}
            y1={bottomY + 14}
            x2={currentLoopDirection === 'counterclockwise' ? rodX - 14 : branchX + 16}
            y2={bottomY + 14}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#single-rod-current)"
          />
          <line
            x1={rodX + 18}
            y1={currentLoopDirection === 'counterclockwise' ? bottomY - 12 : topY + 12}
            x2={rodX + 18}
            y2={currentLoopDirection === 'counterclockwise' ? topY + 12 : bottomY - 12}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="4"
            markerEnd="url(#single-rod-current)"
          />
          {displayOptions.showLabels && (
            <text x="498" y="96" fill={P13_SHELL_COLORS.current} fontSize="12" fontWeight="600">
              电流：{P13_LOOP_CURRENT_DIRECTION_LABELS[currentLoopDirection]}
            </text>
          )}
          <line
            x1={rodX}
            y1={currentLoopDirection === 'counterclockwise' ? bottomY - 18 : topY + 18}
            x2={rodX}
            y2={currentLoopDirection === 'counterclockwise' ? topY + 18 : bottomY - 18}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="5"
            markerEnd="url(#single-rod-current)"
          />
        </>
      )}

      {showVelocity && state.motionDirection !== 'none' && (
        <>
          <line
            x1={rodX}
            y1="88"
            x2={rodX + (state.motionDirection === 'right' ? speedArrowLength : -speedArrowLength)}
            y2="88"
            stroke={P13_SHELL_COLORS.velocity}
            strokeWidth="4"
            markerEnd="url(#single-rod-velocity)"
          />
          {displayOptions.showLabels && (
            <text
              x={rodX + (state.motionDirection === 'right' ? 12 : -88)}
              y="72"
              fill={P13_SHELL_COLORS.velocity}
              fontSize="12"
              fontWeight="600"
            >
              v：{P13_HORIZONTAL_DIRECTION_LABELS[state.motionDirection]}
            </text>
          )}
        </>
      )}

      {showEmf && state.emfDirection !== 'none' && (
        <>
          <line
            x1={rodX - 20}
            y1={state.emfDirection === 'up' ? bottomY - 12 : topY + 12}
            x2={rodX - 20}
            y2={state.emfDirection === 'up' ? topY + 12 : bottomY - 12}
            stroke={P13_SHELL_COLORS.emf}
            strokeWidth="4"
            markerEnd="url(#single-rod-emf)"
          />
          {displayOptions.showLabels && (
            <text
              x={rodX - 66}
              y="206"
              fill={P13_SHELL_COLORS.emf}
              fontSize="12"
              fontWeight="600"
              transform={`rotate(-90 ${rodX - 66} 206)`}
            >
              ε：{P13_VERTICAL_DIRECTION_LABELS[state.emfDirection]}
            </text>
          )}
        </>
      )}

      {showForce && state.ampereForceDirection !== 'none' && (
        <>
          <line
            x1={rodX}
            y1="334"
            x2={rodX + (state.ampereForceDirection === 'right' ? forceArrowLength : -forceArrowLength)}
            y2="334"
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#single-rod-force)"
          />
          {displayOptions.showLabels && (
            <text
              x={rodX + (state.ampereForceDirection === 'right' ? 12 : -96)}
              y="352"
              fill={P13_SHELL_COLORS.force}
              fontSize="12"
              fontWeight="600"
            >
              F安：{P13_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirection]}
            </text>
          )}
        </>
      )}

      {showForce && simplifiedExternalForceMode && state.externalForce > 0 && (
        <>
          <line
            x1={rodX}
            y1="52"
            x2={rodX + externalForceArrowLength}
            y2="52"
            stroke={P13_SHELL_COLORS.primary}
            strokeWidth="4"
            markerEnd="url(#single-rod-external-force)"
          />
          {displayOptions.showLabels && (
            <text
              x={rodX + 12}
              y="40"
              fill={P13_SHELL_COLORS.primary}
              fontSize="12"
              fontWeight="600"
            >
              F外：向右
            </text>
          )}
        </>
      )}

      {displayOptions.showLabels && (
        <>
          <rect x="492" y="198" width="214" height={simplifiedExternalForceMode ? 160 : 132} rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
          <text x="514" y="240" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前状态
          </text>
          <text x="514" y="262" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            x = {formatNumber(state.position, 4)} m
          </text>
          <text x="514" y="282" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            v = {formatNumber(state.velocity, 4)} m/s
          </text>
          <text x="514" y="302" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            i = {formatNumber(displayedCurrent, 4)} A
          </text>
          {result.variant === 'with-source' && (
            <text x="514" y="322" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
              ε0 = {formatNumber(state.sourceVoltage, 3)} V
            </text>
          )}
          {result.variant === 'with-capacitor' && (
            <text x="514" y="322" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
              Uc = {formatNumber(state.capacitorVoltage, 4)} V
            </text>
          )}
          {simplifiedExternalForceMode && (
            <text x="514" y="336" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
              F外 = {formatNumber(state.externalForce, 3)} N
            </text>
          )}
          {stageOverflowed && (
            <text x="514" y={simplifiedExternalForceMode ? 356 : 342} fill={P13_SHELL_COLORS.primary} fontSize="12" fontWeight="600">
              当前位置已超出演示窗，舞台只截取前 {formatNumber(SINGLE_ROD_MAX_VISIBLE_DISPLACEMENT, 1)} m
            </text>
          )}
          <text x="150" y={topY - 18} fill={P13_SHELL_COLORS.secondary} fontSize="12" fontWeight="600">
            {fieldLabel}
          </text>
          <line x1="692" y1={topY} x2="692" y2={bottomY} stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="5 4" />
          <line x1="686" y1={topY} x2="698" y2={topY} stroke="#94A3B8" strokeWidth="2.5" />
          <line x1="686" y1={bottomY} x2="698" y2={bottomY} stroke="#94A3B8" strokeWidth="2.5" />
          <text x="706" y={centerY + 4} fill={P13_SHELL_COLORS.secondary} fontSize="12" fontWeight="600">
            {railLabel}
          </text>
        </>
      )}
    </svg>
  );
}

function BranchElement({
  variant,
  x,
  topY,
  bottomY,
  compact = false,
}: {
  variant: P13SingleRodVariant;
  x: number;
  topY: number;
  bottomY: number;
  compact?: boolean;
}) {
  const resistorColor = '#B96A16';
  const textColor = P13_SHELL_COLORS.secondary;
  if (variant === 'resistive') {
    const bodyTop = topY + 18;
    const bodyBottom = bottomY - 18;
    return (
      <>
        <line x1={x} y1={topY} x2={x} y2={bodyTop} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
        <P13VerticalResistorBody
          centerX={x}
          topY={bodyTop}
          width={compact ? 16 : 22}
          height={Math.max(24, bodyBottom - bodyTop)}
          stroke={resistorColor}
          strokeWidth={compact ? 2.5 : 3}
        />
        <line x1={x} y1={bodyBottom} x2={x} y2={bottomY} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
        {!compact && (
          <text x={x - 66} y={(topY + bottomY) / 2} fill={textColor} fontSize="12">
            外接电阻 R
          </text>
        )}
      </>
    );
  }

  if (variant === 'with-source') {
    const resistorBodyTop = topY + 18;
    const resistorBodyHeight = compact ? 30 : 42;
    const resistorBottom = resistorBodyTop + resistorBodyHeight;
    const batteryTop = bottomY - 44;
    return (
      <>
        <line x1={x} y1={topY} x2={x} y2={resistorBodyTop} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
        <P13VerticalResistorBody
          centerX={x}
          topY={resistorBodyTop}
          width={compact ? 16 : 22}
          height={resistorBodyHeight}
          stroke={resistorColor}
          strokeWidth={compact ? 2.5 : 3}
        />
        <line x1={x} y1={resistorBottom} x2={x} y2={batteryTop - 12} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
        <line x1={x - 18} y1={batteryTop} x2={x + 18} y2={batteryTop} stroke="#1D4ED8" strokeWidth={compact ? 3 : 4} />
        <line x1={x - 10} y1={batteryTop + 18} x2={x + 10} y2={batteryTop + 18} stroke="#1D4ED8" strokeWidth={compact ? 3 : 4} />
        <line x1={x} y1={batteryTop + 18} x2={x} y2={bottomY} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
        {!compact && (
          <>
            <text x={x - 62} y={topY + 54} fill={textColor} fontSize="12">
              电阻 R
            </text>
            <text x={x - 74} y={batteryTop + 12} fill="#1D4ED8" fontSize="12">
              电源 ε0
            </text>
          </>
        )}
      </>
    );
  }

  const resistorBodyTop = topY + 18;
  const resistorBodyHeight = compact ? 30 : 42;
  const resistorBottom = resistorBodyTop + resistorBodyHeight;
  const capacitorTop = bottomY - 48;
  return (
    <>
      <line x1={x} y1={topY} x2={x} y2={resistorBodyTop} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
      <P13VerticalResistorBody
        centerX={x}
        topY={resistorBodyTop}
        width={compact ? 16 : 22}
        height={resistorBodyHeight}
        stroke={resistorColor}
        strokeWidth={compact ? 2.5 : 3}
      />
      <line x1={x} y1={resistorBottom} x2={x} y2={capacitorTop - 12} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
      <line x1={x - 18} y1={capacitorTop} x2={x + 18} y2={capacitorTop} stroke="#0F766E" strokeWidth={compact ? 3 : 4} />
      <line x1={x - 18} y1={capacitorTop + 16} x2={x + 18} y2={capacitorTop + 16} stroke="#0F766E" strokeWidth={compact ? 3 : 4} />
      <line x1={x} y1={capacitorTop + 16} x2={x} y2={bottomY} stroke="#64748B" strokeWidth={compact ? 3 : 4} />
      {!compact && (
        <>
          <text x={x - 62} y={topY + 54} fill={textColor} fontSize="12">
            电阻 R
          </text>
          <text x={x - 76} y={capacitorTop + 10} fill="#0F766E" fontSize="12">
            电容 C
          </text>
        </>
      )}
    </>
  );
}

function getVelocityFormula(
  variant: P13SingleRodVariant,
  params: { externalForce: number; mass: number },
  simplifiedMode: boolean,
): string {
  if (variant === 'with-source') {
    return 'm dv/dt = BL(ε0 - BLv) / (R + R棒)';
  }
  if (variant === 'with-capacitor') {
    if (simplifiedMode && params.externalForce > 0) {
      return '教学简化：v(t) = (F外 / m) · t，回路仍按 i = (BLv - Uc) / (R + R棒) 演示';
    }
    return 'm dv/dt = -BL(BLv - U电容) / (R + R棒)';
  }
  return 'v(t) = v0 · exp(-B²L²t / (m(R + R棒)))（μ = 0 时）';
}

function getDisplayedCurrentValue(
  variant: P13SingleRodVariant,
  current: number,
): number {
  return variant === 'with-source' ? Math.abs(current) : current;
}

function getDisplayedCurrentFormula(
  variant: P13SingleRodVariant,
  fallback: string,
  simplifiedMode: boolean,
): string {
  if (variant === 'with-source') {
    return '|i| = (ε0 - ε) / (R + R棒)（本页图表按电流强度展示，方向由箭头单独表示）';
  }
  if (variant === 'with-capacitor' && simplifiedMode) {
    return 'i = (BLv - U电容) / (R + R棒)（恒外力式按教学简化，不把安培力反作用回速度）';
  }
  return fallback;
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
