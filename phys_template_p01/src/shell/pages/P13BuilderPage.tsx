import { useEffect, useMemo, useState } from 'react';
import { simulator } from '@/core/engine/simulator';
import type {
  P13DoubleRodAnalysisStep,
  P13DoubleRodSimulationResult,
  P13DoubleRodState,
  P13DoubleRodVariant,
  P13SingleRodAnalysisStep,
  P13SingleRodSimulationResult,
  P13SingleRodState,
  P13SingleRodVariant,
} from '@/domains/em/p13/types';
import {
  P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS,
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
  P13_HORIZONTAL_DIRECTION_LABELS,
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
  P13_VERTICAL_RAIL_ANALYSIS_TOTAL_STEPS,
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
  P13HorizontalResistorBody,
  P13VerticalResistorBody,
  scaleArrowLength,
} from './p13/P13StagePrimitives';
import { P13TimeSeriesChart } from './p13/P13TimeSeriesChart';

type BuilderFamily = 'single-rod' | 'double-rod' | 'vertical-rail';
type AnalysisStepLike =
  | P13SingleRodAnalysisStep
  | P13DoubleRodAnalysisStep;
type BuilderSingleRodCapacitorScenario = 'charge' | 'discharge' | 'external-force';

interface Props {
  onBack: () => void;
  onSelectPreset: (presetId: string) => void;
}

interface BuilderSelection {
  family: BuilderFamily;
  familyLabel: string;
  code: string;
  title: string;
  presetId: string;
  topologyTitle: string;
  currentFormula: string;
  terminalHeadline: string;
  adoptedConvention: string;
  supportNote: string;
}

const FAMILY_OPTIONS: Array<{ key: BuilderFamily; title: string; summary: string }> = [
  {
    key: 'single-rod',
    title: '单棒组装',
    summary: '在同一工作台内选择纯电阻、含电源或含电容支路，再直接调参观察运动、电流和终态。',
  },
  {
    key: 'double-rod',
    title: '双棒组装',
    summary: '在同一工作台内选择无摩擦、含摩擦或恒外力结构，直接比较共速、停棒和长期驱动口径。',
  },
  {
    key: 'vertical-rail',
    title: '竖直导轨',
    summary: '保留竖直导轨标准结构，在 builder 中统一承接重力与安培力平衡的课堂模型。',
  },
];

const SINGLE_VARIANTS: P13SingleRodVariant[] = ['resistive', 'with-source', 'with-capacitor'];
const DOUBLE_VARIANTS: P13DoubleRodVariant[] = ['basic-frictionless', 'with-external-force'];

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
const RAIL_COLOR = '#7C5A3C';
const ROD_COLOR = '#F97316';
const SINGLE_ROD_STAGE_METERS_TO_PIXELS = 56;
const SINGLE_ROD_MAX_VISIBLE_DISPLACEMENT = 4.3;
const SINGLE_ROD_REFERENCE_SPEED = P13_SINGLE_ROD_PARAM_CONFIG.initialVelocity.max;
const SINGLE_ROD_REFERENCE_FORCE = P13_SINGLE_ROD_PARAM_CONFIG.externalForce.max;

export function P13BuilderPage({ onBack, onSelectPreset }: Props) {
  const [family, setFamily] = useState<BuilderFamily>('single-rod');
  const [singleVariant, setSingleVariant] = useState<P13SingleRodVariant>('resistive');
  const [singleCapacitorScenario, setSingleCapacitorScenario] = useState<BuilderSingleRodCapacitorScenario>('charge');
  const [doubleVariant, setDoubleVariant] = useState<P13DoubleRodVariant>('basic-frictionless');
  const [singleParams, setSingleParams] = useState(() => normalizeSingleRodParams('resistive'));
  const [doubleParams, setDoubleParams] = useState(() => normalizeDoubleRodParams('basic-frictionless'));
  const [verticalParams, setVerticalParams] = useState(() => normalizeVerticalRailRodParams());
  const [currentTime, setCurrentTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [analysisStep, setAnalysisStep] = useState(0);
  const [displayOptions, setDisplayOptions] = useState<P13DisplayOptions>(DEFAULT_P13_DISPLAY_OPTIONS);

  useEffect(() => {
    simulator.unload();
  }, []);

  useEffect(() => {
    setSingleParams((previous) => normalizeSingleRodParams(singleVariant, previous));
    setCurrentTime(0);
    setIsPlaying(true);
    setAnalysisStep(0);
    setSingleCapacitorScenario('charge');
  }, [singleVariant]);

  useEffect(() => {
    setDoubleParams((previous) => normalizeDoubleRodParams(doubleVariant, previous));
    setCurrentTime(0);
    setIsPlaying(true);
    setAnalysisStep(0);
  }, [doubleVariant]);

  const singleResult = useMemo(
    () => simulateSingleRodModel(singleVariant, singleParams),
    [singleParams, singleVariant],
  );
  const singleState = useMemo(
    () => sampleSingleRodStateAtTime(singleResult, currentTime),
    [currentTime, singleResult],
  );
  const singleAnalysisSteps = useMemo(
    () => buildSingleRodAnalysisSteps(singleResult, singleState),
    [singleResult, singleState],
  );

  const doubleResult = useMemo(
    () => simulateDoubleRodModel(doubleVariant, doubleParams),
    [doubleParams, doubleVariant],
  );
  const doubleState = useMemo(
    () => sampleDoubleRodStateAtTime(doubleResult, currentTime),
    [currentTime, doubleResult],
  );
  const doubleAnalysisSteps = useMemo(
    () => buildDoubleRodAnalysisSteps(doubleResult, doubleState),
    [doubleResult, doubleState],
  );

  const verticalResult = useMemo(
    () => simulateVerticalRailRodModel(verticalParams),
    [verticalParams],
  );
  const verticalState = useMemo(
    () => sampleVerticalRailRodStateAtTime(verticalResult, currentTime),
    [currentTime, verticalResult],
  );
  const verticalAnalysisSteps = useMemo(
    () => buildVerticalRailAnalysisSteps(verticalResult, verticalState),
    [verticalResult, verticalState],
  );

  const selection = useMemo<BuilderSelection>(() => {
    if (family === 'single-rod') {
      const meta = getSingleRodVariantMeta(singleVariant);
      const capacitorScenarioLabel =
        singleCapacitorScenario === 'charge'
          ? '充电式'
          : singleCapacitorScenario === 'discharge'
            ? '放电式'
            : '恒外力式';
      return {
        family,
        familyLabel: '单棒组装',
        code: meta.code,
        title: singleVariant === 'with-capacitor' ? `${meta.title} · ${capacitorScenarioLabel}` : meta.title,
        presetId: meta.presetId,
        topologyTitle: meta.topologyTitle,
        currentFormula: meta.currentFormula,
        terminalHeadline: meta.terminalHeadline,
        adoptedConvention: meta.adoptedConvention,
        supportNote:
          singleVariant === 'with-capacitor'
            ? `当前 builder 已和专页同步到三种电容情形：${capacitorScenarioLabel}会直接影响参数区、图表、结果区和动画表现。`
            : '当前 builder 已经是页内实时工作台：切换支路结构、改参数、看图表和分步分析都在本页完成，不再只是跳转入口。',
      };
    }

    if (family === 'double-rod') {
      const meta = getDoubleRodVariantMeta(doubleVariant);
      return {
        family,
        familyLabel: '双棒组装',
        code: meta.code,
        title: meta.title,
        presetId: meta.presetId,
        topologyTitle: meta.topologyTitle,
        currentFormula: meta.currentFormula,
        terminalHeadline: meta.terminalHeadline,
        adoptedConvention: meta.adoptedConvention,
        supportNote:
          '当前 builder 支持在同一页内切换无摩擦、含摩擦和恒外力三种双棒结构，并直接观察相对速度、电流和长期口径。',
      };
    }

    return {
      family,
      familyLabel: '竖直导轨',
      code: P13_VERTICAL_RAIL_ROD_META.code,
      title: P13_VERTICAL_RAIL_ROD_META.title,
      presetId: P13_VERTICAL_RAIL_ROD_META.presetId,
      topologyTitle: P13_VERTICAL_RAIL_ROD_META.topologyTitle,
      currentFormula: P13_VERTICAL_RAIL_ROD_META.currentFormula,
      terminalHeadline: P13_VERTICAL_RAIL_ROD_META.terminalHeadline,
      adoptedConvention: P13_VERTICAL_RAIL_ROD_META.adoptedConvention,
      supportNote:
        '竖直导轨当前只有一支标准结构，但已经并入 builder 工作台，参数、图表和分步分析都在本页联动完成。',
    };
  }, [doubleVariant, family, singleCapacitorScenario, singleVariant]);

  const activeDuration =
    family === 'single-rod'
      ? singleResult.duration
      : family === 'double-rod'
        ? doubleResult.duration
        : verticalResult.duration;
  const activeTimeStep =
    family === 'single-rod'
      ? singleResult.timeStep
      : family === 'double-rod'
        ? doubleResult.timeStep
        : verticalResult.timeStep;
  const activeAnalysisTotalSteps =
    family === 'single-rod'
      ? P13_SINGLE_ROD_ANALYSIS_TOTAL_STEPS
      : family === 'double-rod'
        ? P13_DOUBLE_ROD_ANALYSIS_TOTAL_STEPS
        : P13_VERTICAL_RAIL_ANALYSIS_TOTAL_STEPS;
  const activeAnalysisSteps: AnalysisStepLike[] =
    family === 'single-rod'
      ? singleAnalysisSteps
      : family === 'double-rod'
        ? doubleAnalysisSteps
        : verticalAnalysisSteps;
  const activeResult =
    family === 'single-rod'
      ? singleResult
      : family === 'double-rod'
        ? doubleResult
        : verticalResult;
  const playbackPhysicalRate = useMemo(
    () => (
      activeResult.duration < PLAYBACK_PHYSICAL_SECONDS_PER_REAL_SECOND
        ? Math.max(activeResult.duration / PLAYBACK_SHORT_TRANSIENT_REALTIME_SECONDS, 1e-4)
        : PLAYBACK_PHYSICAL_SECONDS_PER_REAL_SECOND
    ),
    [activeResult.duration],
  );

  useEffect(() => {
    setCurrentTime(0);
    setIsPlaying(true);
    setAnalysisStep(0);
  }, [activeResult]);

  useEffect(() => {
    if (!isPlaying) return undefined;

    let frameId = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      setCurrentTime((previous) =>
        Math.min(activeDuration, previous + (elapsed * playbackPhysicalRate)),
      );
      frameId = window.requestAnimationFrame(tick);
    };

    frameId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frameId);
  }, [activeDuration, isPlaying, playbackPhysicalRate]);

  useEffect(() => {
    if (currentTime >= activeDuration - 1e-6) {
      setCurrentTime(activeDuration);
      setIsPlaying(false);
    }
  }, [activeDuration, currentTime]);

  function updateSingleParam(key: P13SingleRodParamKey, value: number): void {
    setSingleParams((previous) => normalizeSingleRodParams(singleVariant, { ...previous, [key]: value }));
  }

  function applySingleCapacitorScenario(nextScenario: BuilderSingleRodCapacitorScenario): void {
    if (singleVariant !== 'with-capacitor') return;
    setSingleCapacitorScenario(nextScenario);
    setSingleParams((previous) => normalizeSingleRodParams('with-capacitor', {
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

  function updateDoubleParam(key: P13DoubleRodParamKey, value: number): void {
    setDoubleParams((previous) => normalizeDoubleRodParams(doubleVariant, { ...previous, [key]: value }));
  }

  function updateVerticalParam(key: P13VerticalRailRodParamKey, value: number): void {
    setVerticalParams((previous) => normalizeVerticalRailRodParams({ ...previous, [key]: value }));
  }

  function togglePlayback(): void {
    if (currentTime >= activeDuration - 1e-6) {
      setCurrentTime(0);
    }
    setIsPlaying((previous) => !previous || currentTime >= activeDuration - 1e-6);
  }

  function resetPlayback(): void {
    setCurrentTime(0);
    setIsPlaying(false);
    setAnalysisStep(0);
  }

  function beginAnalysis(): void {
    setIsPlaying(false);
    if (currentTime <= 1e-6) {
      setCurrentTime(Math.min(activeDuration, Math.max(activeTimeStep * 18, 0.12)));
    }
    setAnalysisStep(1);
  }

  function resetCurrentStructure(): void {
    if (family === 'single-rod') {
      setSingleParams(normalizeSingleRodParams(singleVariant));
      setSingleCapacitorScenario('charge');
      return;
    }
    if (family === 'double-rod') {
      setDoubleParams(normalizeDoubleRodParams(doubleVariant));
      return;
    }
    setVerticalParams(normalizeVerticalRailRodParams());
  }

  const badges = [
    { label: '入口', value: 'P13-BUILDER', tone: 'primary' as const },
    { label: '当前族', value: selection.familyLabel, tone: 'muted' as const },
    { label: '当前结构', value: selection.code, tone: 'warning' as const },
  ];

  return (
    <P13WorkbenchShell
      title="P13-BUILDER 实时组装台"
      subtitle="现在的 P13 builder 不再只是模板跳转页，而是在一个独立工作台里直接切换结构、调参数、看动画、看图表、做分步分析。仍然保持 P13 独立实现，不和其他模块合并。"
      onBack={onBack}
      badges={badges}
      scrollResetKey={
        family === 'single-rod'
          ? `${singleVariant}:${singleCapacitorScenario}`
          : family === 'double-rod'
            ? doubleVariant
            : 'vertical-rail'
      }
      modelRail={(
        <div className="flex flex-wrap gap-2">
          <P13ModelRailChip code="P13-BUILDER" title="实时组装台" state="active" />
        </div>
      )}
      leftPanel={(
        <div className="space-y-4">
          <P13PanelCard
            title="选择结构家族"
            subtitle="先定导轨与导体结构，再决定是否加入电源、电容、摩擦或恒外力。"
          >
            <div className="space-y-3">
              {FAMILY_OPTIONS.map((option) => {
                const active = option.key === family;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setFamily(option.key)}
                    className="w-full rounded-2xl border px-4 py-3 text-left"
                    style={{
                      borderColor: active ? P13_SHELL_COLORS.primaryBorder : P13_SHELL_COLORS.border,
                      backgroundColor: active ? P13_SHELL_COLORS.primarySoft : P13_SHELL_COLORS.blockBg,
                    }}
                  >
                    <div
                      className="text-sm font-semibold"
                      style={{ color: active ? P13_SHELL_COLORS.primary : P13_SHELL_COLORS.text }}
                    >
                      {option.title}
                    </div>
                    <div className="mt-1 text-xs leading-5" style={{ color: P13_SHELL_COLORS.secondary }}>
                      {option.summary}
                    </div>
                  </button>
                );
              })}
            </div>
          </P13PanelCard>

          {family === 'single-rod' && (
            <P13PanelCard title="组装单棒支路">
              <div className="flex flex-wrap gap-2">
                {SINGLE_VARIANTS.map((variant) => {
                  const meta = getSingleRodVariantMeta(variant);
                  return (
                    <P13ModelRailChip
                      key={variant}
                      code={meta.code}
                      title={meta.shortTitle}
                      state={singleVariant === variant ? 'active' : 'available'}
                      onSelect={singleVariant === variant ? undefined : () => setSingleVariant(variant)}
                    />
                  );
                })}
              </div>
            </P13PanelCard>
          )}

          {family === 'single-rod' && singleVariant === 'with-capacitor' && (
            <P13PanelCard
              title="电容情形"
              subtitle="builder 里也和专页一致：充电式、放电式、恒外力式三种情形都在这里切。"
            >
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => applySingleCapacitorScenario('charge')}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={singleCapacitorScenario === 'charge' ? PRIMARY_BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
                >
                  充电式
                </button>
                <button
                  type="button"
                  onClick={() => applySingleCapacitorScenario('discharge')}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={singleCapacitorScenario === 'discharge' ? PRIMARY_BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
                >
                  放电式
                </button>
                <button
                  type="button"
                  onClick={() => applySingleCapacitorScenario('external-force')}
                  className="rounded-xl px-3 py-2 text-sm font-medium"
                  style={singleCapacitorScenario === 'external-force' ? PRIMARY_BUTTON_STYLE : SECONDARY_BUTTON_STYLE}
                >
                  恒外力式
                </button>
              </div>
              <p className="mt-3 text-xs leading-6" style={{ color: P13_SHELL_COLORS.secondary }}>
                {singleCapacitorScenario === 'charge'
                  ? '充电式：Uc0 = 0，棒有初速度，电容逐步被充电。'
                  : singleCapacitorScenario === 'discharge'
                    ? '放电式：v0 = 0，默认把 Uc0 和 C 提到更适合演示的量级，闭合后能明显看到导体棒被放电电流启动。'
                    : '恒外力式：按教学简化，机械侧直接取 a = F外 / m，电路侧继续演示 Uc 和 i 的建立过程。'}
              </p>
            </P13PanelCard>
          )}

          {family === 'double-rod' && (
            <P13PanelCard title="组装双棒回路">
              <div className="flex flex-wrap gap-2">
                {DOUBLE_VARIANTS.map((variant) => {
                  const meta = getDoubleRodVariantMeta(variant);
                  return (
                    <P13ModelRailChip
                      key={variant}
                      code={meta.code}
                      title={meta.shortTitle}
                      state={doubleVariant === variant ? 'active' : 'available'}
                      onSelect={doubleVariant === variant ? undefined : () => setDoubleVariant(variant)}
                    />
                  );
                })}
              </div>
            </P13PanelCard>
          )}

          <P13PanelCard
            title="参数编辑"
            subtitle="Builder 当前允许直接改结构所需主参数，不需要离开当前工作台。"
          >
            <div className="space-y-4">
              {family === 'single-rod' && (
                <>
                  {getBuilderSingleVisibleParamKeys(singleVariant, singleCapacitorScenario).map((key) => {
                    const config = P13_SINGLE_ROD_PARAM_CONFIG[key];
                    return (
                      <ParameterSlider
                        key={key}
                        label={config.label}
                        unit={config.unit}
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        value={singleParams[key]}
                        onChange={(value) => updateSingleParam(key, value)}
                      />
                    );
                  })}
                </>
              )}

              {family === 'double-rod' && (
                <>
                  {getDoubleRodVariantMeta(doubleVariant).visibleParamKeys.map((key) => {
                    const config = P13_DOUBLE_ROD_PARAM_CONFIG[key];
                    return (
                      <ParameterSlider
                        key={key}
                        label={config.label}
                        unit={config.unit}
                        min={config.min}
                        max={config.max}
                        step={config.step}
                        value={doubleParams[key]}
                        onChange={(value) => updateDoubleParam(key, value)}
                      />
                    );
                  })}
                </>
              )}

              {family === 'vertical-rail' && (
                <>
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
                          value={verticalParams[key]}
                          onChange={(value) => updateVerticalParam(key, value)}
                        />
                      );
                    })}
                </>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={SECONDARY_BUTTON_STYLE}
                onClick={resetCurrentStructure}
              >
                重置当前结构
              </button>
              <button
                type="button"
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={SECONDARY_BUTTON_STYLE}
                onClick={() => onSelectPreset(selection.presetId)}
              >
                打开专页
              </button>
            </div>
          </P13PanelCard>

          <P13DisplayOptionsPanel
            options={displayOptions}
            onChange={setDisplayOptions}
          />
        </div>
      )}
      stagePanel={(
        <P13PanelCard
          title="组装预览"
          subtitle="结构、参数、图表和方向分析都在同一 builder 页同步联动。"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {family === 'single-rod' && (
                <>
                  <P13LegendBadge label="速度 v" color={P13_SHELL_COLORS.velocity} />
                  <P13LegendBadge label="电动势 ε" color={P13_SHELL_COLORS.emf} />
                  <P13LegendBadge label="电流 i" color={P13_SHELL_COLORS.current} />
                  <P13LegendBadge label="安培力 F安" color={P13_SHELL_COLORS.force} />
                  {singleVariant === 'with-capacitor' && singleResult.summary.simplifiedMode && (
                    <P13LegendBadge label="恒外力 F外" color={P13_SHELL_COLORS.primary} />
                  )}
                </>
              )}
              {family === 'double-rod' && (
                <>
                  <P13LegendBadge label="棒1速度 v1" color={P13_SHELL_COLORS.velocity} />
                  <P13LegendBadge label="棒2速度 v2" color={P13_SHELL_COLORS.field} />
                  <P13LegendBadge label="电流 i" color={P13_SHELL_COLORS.current} />
                  <P13LegendBadge label="安培力 F1/F2" color={P13_SHELL_COLORS.force} />
                </>
              )}
              {family === 'vertical-rail' && (
                <>
                  <P13LegendBadge label="速度 v" color={P13_SHELL_COLORS.velocity} />
                  <P13LegendBadge label="电流 i" color={P13_SHELL_COLORS.current} />
                  <P13LegendBadge label="安培力 F安" color={P13_SHELL_COLORS.force} />
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={togglePlayback}
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={PRIMARY_BUTTON_STYLE}
              >
                {isPlaying ? '暂停' : currentTime >= activeDuration - 1e-6 ? '重播' : '播放'}
              </button>
              <button
                type="button"
                onClick={resetPlayback}
                className="rounded-xl px-3 py-2 text-sm font-medium"
                style={SECONDARY_BUTTON_STYLE}
              >
                回到起点
              </button>
            </div>
          </div>

          {family === 'single-rod' && (
            <BuilderSingleRodStage
              result={singleResult}
              state={singleState}
              analysisStep={analysisStep}
              displayOptions={displayOptions}
            />
          )}
          {family === 'double-rod' && (
            <BuilderDoubleRodStage
              result={doubleResult}
              state={doubleState}
              analysisStep={analysisStep}
              variant={doubleVariant}
              displayOptions={displayOptions}
            />
          )}
          {family === 'vertical-rail' && (
            <BuilderVerticalRailStage
              result={verticalResult}
              state={verticalState}
              analysisStep={analysisStep}
              displayOptions={displayOptions}
            />
          )}

          <div className="mt-4">
            <div
              className="mb-2 flex items-center justify-between text-xs"
              style={{ color: P13_SHELL_COLORS.muted }}
            >
              <span>时间推进</span>
              <span>
                t = {formatPhysicalTime(currentTime)} / {formatPhysicalTime(activeDuration)}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={activeDuration}
              step={activeTimeStep}
              value={currentTime}
              className="w-full"
              onChange={(event) => {
                setCurrentTime(Number(event.target.value));
                setIsPlaying(false);
              }}
            />
          </div>
        </P13PanelCard>
      )}
      chartPanel={(
        <BuilderChartPanel
          family={family}
          singleVariant={singleVariant}
          doubleVariant={doubleVariant}
          singleResult={singleResult}
          singleState={singleState}
          doubleResult={doubleResult}
          doubleState={doubleState}
          verticalResult={verticalResult}
          verticalState={verticalState}
          currentTime={currentTime}
        />
      )}
      analysisPanel={(
        <P13PanelCard
          title="分步分析"
          subtitle="builder 内也保留和专页一致的方向分析链路，不必离开当前结构。"
        >
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={PRIMARY_BUTTON_STYLE}
              onClick={beginAnalysis}
            >
              开始分析
            </button>
            <button
              type="button"
              className="rounded-xl px-3 py-2 text-sm font-medium"
              style={{
                ...PRIMARY_BUTTON_STYLE,
                opacity: analysisStep >= activeAnalysisTotalSteps ? 0.45 : 1,
              }}
              onClick={() => setAnalysisStep((previous) => Math.min(activeAnalysisTotalSteps, previous + 1))}
              disabled={analysisStep >= activeAnalysisTotalSteps}
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
          </div>

          <div className="mt-4 space-y-3">
            {activeAnalysisSteps.map((step, index) => (
              <AnalysisStepCard
                key={`${selection.code}-${step.title}-${index}`}
                step={step}
                index={index}
                visible={analysisStep >= index + 1}
                active={analysisStep === index + 1}
              />
            ))}
          </div>
        </P13PanelCard>
      )}
      resultPanel={(
        <P13PanelCard
          title="当前结果"
          subtitle={selection.terminalHeadline}
        >
          <P13MetricLine label="当前结构号" value={selection.code} emphasis />
          <P13MetricLine label="当前结构" value={selection.title} emphasis />
          <P13MetricLine label="回路拓扑" value={selection.topologyTitle} />
          {family === 'single-rod' && (
            <>
              {singleVariant === 'with-capacitor' && (
                <P13MetricLine
                  label="当前情形"
                  value={singleCapacitorScenario === 'charge' ? '充电式' : singleCapacitorScenario === 'discharge' ? '放电式' : '恒外力式'}
                  emphasis
                />
              )}
              <P13MetricLine label="当前速度" value={`${formatNumber(singleState.velocity, 4)} m/s`} emphasis />
              <P13MetricLine label="当前电流" value={`${formatNumber(singleState.current, 4)} A`} emphasis />
              {singleVariant === 'with-capacitor' && singleResult.summary.simplifiedMode && (
                <P13MetricLine label="当前外力 F外" value={`${formatNumber(singleState.externalForce, 4)} N`} emphasis />
              )}
              {singleResult.params.frictionCoefficient > 0 && (
                <P13MetricLine label="当前摩擦力" value={`${formatNumber(singleState.frictionForce, 4)} N`} />
              )}
              <P13MetricLine
                label={singleVariant === 'with-capacitor' && singleResult.summary.simplifiedMode ? '教学加速度 a' : '理论终态速度'}
                value={singleVariant === 'with-capacitor' && singleResult.summary.simplifiedMode
                  ? `${formatNumber(singleResult.summary.theoreticalAcceleration ?? 0, 4)} m/s²`
                  : `${formatNumber(singleResult.summary.theoreticalTerminalVelocity, 4)} m/s`}
              />
              <P13MetricLine
                label={singleVariant === 'with-capacitor' && singleResult.summary.simplifiedMode ? '理论渐近电流' : '理论终态电流'}
                value={`${formatNumber(singleResult.summary.theoreticalTerminalCurrent, 4)} A`}
              />
              {singleVariant === 'with-capacitor' && (
                <P13MetricLine
                  label={singleResult.summary.simplifiedMode ? '当前 Uc 过程值' : '理论终态 Uc'}
                  value={`${formatNumber(singleResult.summary.simplifiedMode ? singleState.capacitorVoltage : singleResult.summary.theoreticalTerminalCapacitorVoltage, 4)} V`}
                />
              )}
              {singleResult.params.frictionCoefficient > 0 && (
                <P13MetricLine
                  label="停止时间"
                  value={singleResult.summary.stopTime === null ? '当前结构不收敛到静止' : formatPhysicalTime(singleResult.summary.stopTime)}
                />
              )}
              <P13MetricLine label="终态解释" value={singleResult.summary.terminalExplanation} />
            </>
          )}
          {family === 'double-rod' && (
            <>
              <P13MetricLine label="当前 v1 / v2" value={`${formatNumber(doubleState.velocity1, 4)} / ${formatNumber(doubleState.velocity2, 4)} m/s`} emphasis />
              <P13MetricLine label="当前电流" value={`${formatNumber(doubleState.current, 4)} A`} emphasis />
              {doubleVariant === 'with-external-force' && (
                <P13MetricLine label="当前外力 F外" value={`${formatNumber(doubleState.externalForceOnRod1, 4)} N`} emphasis />
              )}
              <P13MetricLine
                label={doubleVariant === 'with-external-force' ? '理论稳定速度差' : '理论终态共速'}
                value={doubleVariant === 'with-external-force'
                  ? `${formatNumber(doubleResult.summary.theoreticalRelativeVelocity ?? 0, 4)} m/s`
                  : `${formatNumber(doubleResult.summary.theoreticalTerminalVelocity, 4)} m/s`}
              />
              <P13MetricLine label="最终 v1 / v2" value={`${formatNumber(doubleResult.summary.finalVelocity1, 4)} / ${formatNumber(doubleResult.summary.finalVelocity2, 4)} m/s`} />
              {doubleVariant === 'with-external-force' && (
                <P13MetricLine
                  label="理论共同加速度"
                  value={`${formatNumber(doubleResult.summary.theoreticalCommonAcceleration ?? 0, 4)} m/s²`}
                />
              )}
              {doubleVariant === 'with-capacitor' && (
                <P13MetricLine label="最终 Uc" value={`${formatNumber(doubleResult.summary.finalCapacitorVoltage, 4)} V`} />
              )}
              <P13MetricLine label="终态分类" value={doubleResult.summary.finalOutcome} />
            </>
          )}
          {family === 'vertical-rail' && (
            <>
              <P13MetricLine label="当前速度" value={`${formatNumber(verticalState.velocity, 4)} m/s`} emphasis />
              <P13MetricLine label="当前电流" value={`${formatNumber(verticalState.current, 4)} A`} emphasis />
              <P13MetricLine label="理论终态速度" value={`${formatNumber(verticalResult.summary.theoreticalTerminalVelocity, 4)} m/s`} />
              <P13MetricLine label="理论终态电流" value={`${formatNumber(verticalResult.summary.theoreticalTerminalCurrent, 4)} A`} />
              <P13MetricLine label="终态解释" value={verticalResult.summary.terminalExplanation} />
            </>
          )}
          <div
            className="mt-3 rounded-2xl px-3 py-3 text-xs leading-6"
            style={{
              color: P13_SHELL_COLORS.secondary,
              backgroundColor: P13_SHELL_COLORS.blockSoft,
            }}
          >
            {selection.adoptedConvention}
          </div>
          <div
            className="mt-3 rounded-2xl px-3 py-3 text-xs leading-6"
            style={{
              color: P13_SHELL_COLORS.secondary,
              backgroundColor: P13_SHELL_COLORS.primarySoft,
            }}
          >
            {selection.supportNote}
          </div>
        </P13PanelCard>
      )}
    />
  );
}

function BuilderChartPanel({
  family,
  singleVariant,
  doubleVariant,
  singleResult,
  singleState,
  doubleResult,
  doubleState,
  verticalResult,
  verticalState,
  currentTime,
}: {
  family: BuilderFamily;
  singleVariant: P13SingleRodVariant;
  doubleVariant: P13DoubleRodVariant;
  singleResult: P13SingleRodSimulationResult;
  singleState: P13SingleRodState;
  doubleResult: P13DoubleRodSimulationResult;
  doubleState: P13DoubleRodState;
  verticalResult: P13VerticalRailRodSimulationResult;
  verticalState: P13VerticalRailRodState;
  currentTime: number;
}) {
  if (family === 'single-rod') {
    const singleCurrentFormula = getBuilderSingleCurrentFormula(singleVariant, singleResult.summary.simplifiedMode);
    return (
      <div className={`grid gap-4 ${singleVariant === 'with-capacitor' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <P13TimeSeriesChart
          title="速度 v-t"
          unit="m/s"
          color={P13_SHELL_COLORS.velocity}
          formula={getBuilderSingleVelocityFormula(singleVariant, singleResult)}
          samples={singleResult.samples.map((sample) => ({ time: sample.time, value: sample.velocity }))}
          currentTime={currentTime}
          currentValue={singleState.velocity}
        />
        <P13TimeSeriesChart
          title="电流 i-t"
          unit="A"
          color={P13_SHELL_COLORS.current}
          formula={singleCurrentFormula}
          samples={singleResult.samples.map((sample) => ({ time: sample.time, value: sample.current }))}
          currentTime={currentTime}
          currentValue={singleState.current}
        />
        {singleVariant === 'with-capacitor' && (
          <P13TimeSeriesChart
            title="电容电压 Uc-t"
            unit="V"
            color={P13_SHELL_COLORS.emf}
            formula="Uc"
            samples={singleResult.samples.map((sample) => ({ time: sample.time, value: sample.capacitorVoltage }))}
            currentTime={currentTime}
            currentValue={singleState.capacitorVoltage}
          />
        )}
      </div>
    );
  }

  if (family === 'double-rod') {
    return (
      <div className={`grid gap-4 ${doubleVariant === 'with-capacitor' ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        <P13TimeSeriesChart
          title="双棒速度 v-t"
          unit="m/s"
          formula="v1、v2 同图，直接比较两棒速度变化"
          currentTime={currentTime}
          series={[
            {
              label: 'v1',
              color: P13_SHELL_COLORS.velocity,
              samples: doubleResult.samples.map((sample) => ({ time: sample.time, value: sample.velocity1 })),
              currentValue: doubleState.velocity1,
            },
            {
              label: 'v2',
              color: P13_SHELL_COLORS.field,
              samples: doubleResult.samples.map((sample) => ({ time: sample.time, value: sample.velocity2 })),
              currentValue: doubleState.velocity2,
            },
          ]}
        />
        <P13TimeSeriesChart
          title="电流 i-t"
          unit="A"
          color={P13_SHELL_COLORS.current}
          formula={getDoubleRodVariantMeta(doubleVariant).currentFormula}
          samples={doubleResult.samples.map((sample) => ({ time: sample.time, value: sample.current }))}
          currentTime={currentTime}
          currentValue={doubleState.current}
        />
        {doubleVariant === 'with-capacitor' && (
          <P13TimeSeriesChart
            title="电容电压 Uc-t"
            unit="V"
            color={P13_SHELL_COLORS.emf}
            formula="Uc"
            samples={doubleResult.samples.map((sample) => ({ time: sample.time, value: sample.capacitorVoltage }))}
            currentTime={currentTime}
            currentValue={doubleState.capacitorVoltage}
          />
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <P13TimeSeriesChart
        title="速度 v-t"
        unit="m/s"
        color={P13_SHELL_COLORS.velocity}
        formula="v"
        samples={verticalResult.samples.map((sample) => ({ time: sample.time, value: sample.velocity }))}
        currentTime={currentTime}
        currentValue={verticalState.velocity}
      />
      <P13TimeSeriesChart
        title="电流 i-t"
        unit="A"
        color={P13_SHELL_COLORS.current}
        formula={P13_VERTICAL_RAIL_ROD_META.currentFormula}
        samples={verticalResult.samples.map((sample) => ({ time: sample.time, value: sample.current }))}
        currentTime={currentTime}
        currentValue={verticalState.current}
      />
    </div>
  );
}

function getBuilderSingleVisibleParamKeys(
  variant: P13SingleRodVariant,
  scenario: BuilderSingleRodCapacitorScenario,
): readonly P13SingleRodParamKey[] {
  const base = getSingleRodVariantMeta(variant).visibleParamKeys;
  if (variant !== 'with-capacitor') return base;
  return base.filter((key) => {
    if (scenario === 'external-force') {
      return !['initialVelocity', 'initialCapacitorVoltage', 'frictionCoefficient'].includes(key);
    }
    return key !== 'externalForce';
  });
}

function getBuilderSingleVelocityFormula(
  variant: P13SingleRodVariant,
  result: P13SingleRodSimulationResult,
): string {
  if (variant === 'with-source') {
    return 'v 从 0 起步上升，最终在 BLv = ε0 时转入匀速';
  }
  if (variant === 'with-capacitor' && result.summary.simplifiedMode) {
    return '教学简化：v(t) = (F外 / m) · t';
  }
  if (variant === 'with-capacitor') {
    return 'v 与 Uc、i 联动变化，课堂终态满足 i → 0';
  }
  return '速度由安培力实时反作用，呈减速衰减';
}

function getBuilderSingleCurrentFormula(
  variant: P13SingleRodVariant,
  simplifiedMode: boolean,
): string {
  if (variant === 'with-capacitor' && simplifiedMode) {
    return 'i = (BLv - U电容) / (R + R棒)（恒外力式按教学简化）';
  }
  return getSingleRodVariantMeta(variant).currentFormula;
}

function AnalysisStepCard({
  step,
  index,
  visible,
  active,
}: {
  step: AnalysisStepLike;
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
        {visible ? step.description : '点击“开始分析”后从当前结构逐步判断方向和终态。'}
      </p>
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
          {formatByStep(value, step)}{unit ? ` ${unit}` : ''}
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

function BuilderSingleRodStage({
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
  const rodX = clamp(rawRodX, 238, 618);
  const stageOverflowed = state.position > SINGLE_ROD_MAX_VISIBLE_DISPLACEMENT;
  const centerY = 208;
  const railGap = 120 + (((railSpan - 0.1) / 1.9) * 84);
  const topY = centerY - (railGap / 2);
  const bottomY = centerY + (railGap / 2);
  const branchX = 152;
  const showVelocity = displayOptions.showVectors && analysisStep >= 1;
  const showEmf = displayOptions.showVectors && analysisStep >= 2;
  const showCurrent = displayOptions.showVectors && analysisStep >= 3;
  const showForce = displayOptions.showVectors && analysisStep >= 4;
  const simplifiedExternalForceMode = result.variant === 'with-capacitor' && result.summary.simplifiedMode;
  const maxSpeedMagnitude = result.samples.reduce(
    (max: number, sample) => Math.max(max, Math.abs(sample.velocity)),
    SINGLE_ROD_REFERENCE_SPEED,
  );
  const maxForceMagnitude = result.samples.reduce(
    (max: number, sample) => Math.max(max, Math.abs(sample.ampereForce), Math.abs(sample.externalForce)),
    SINGLE_ROD_REFERENCE_FORCE,
  );
  const velocityArrowLength = scaleArrowLength(state.velocity, maxSpeedMagnitude, 34, 92);
  const forceArrowLength = scaleArrowLength(state.ampereForce, maxForceMagnitude, 30, 88);
  const externalForceArrowLength = scaleArrowLength(state.externalForce, maxForceMagnitude, 30, 88);
  const magneticIntensity = clamp((magneticField - 0.1) / 4.9, 0, 1);
  const fieldColumns = 8 + Math.round(magneticIntensity * 8);
  const fieldRows = 5 + Math.round(magneticIntensity * 4);
  const fieldTint = `rgba(14, 165, 233, ${0.08 + (magneticIntensity * 0.14)})`;
  const fieldMarkColor = magneticIntensity > 0.66 ? '#5B7FA6' : magneticIntensity > 0.33 ? '#7F9BBC' : '#A9BDD3';
  const fieldLabel = `B = ${formatNumber(magneticField, 2)} T`;
  const railLabel = `L = ${formatNumber(railSpan, 2)} m`;

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }} aria-label="单棒 builder 预览">
      <defs>
        <marker id="p13-builder-single-velocity" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="p13-builder-single-emf" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.emf} />
        </marker>
        <marker id="p13-builder-single-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
        <marker id="p13-builder-single-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
        <marker id="p13-builder-single-external-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.primary} />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      {displayOptions.showGrid && <P13StageGrid left={104} top={104} right={642} bottom={304} />}
      {displayOptions.showAxes && <P13StageAxes originX={110} originY={312} />}
      {displayOptions.showLabels && (
        <>
          <text x="34" y="42" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
            {meta.code} · {meta.shortTitle}
          </text>
          <text x="34" y="62" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            Builder 内实时切换单棒支路结构
          </text>
          <text x="444" y="62" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            统一比例 1 m ≈ {Math.round(SINGLE_ROD_STAGE_METERS_TO_PIXELS)} px
          </text>
          <text x="444" y="80" fill={P13_SHELL_COLORS.secondary} fontSize="11">
            速度箭头按 0-{SINGLE_ROD_REFERENCE_SPEED} m/s、受力箭头按 0-{SINGLE_ROD_REFERENCE_FORCE} N 统一标定
          </text>
          {result.duration < PLAYBACK_PHYSICAL_SECONDS_PER_REAL_SECOND && (
            <text x="34" y="80" fill={P13_SHELL_COLORS.primary} fontSize="11" fontWeight="600">
              短时暂态已慢放到约 {PLAYBACK_SHORT_TRANSIENT_REALTIME_SECONDS} s，便于观察 v-t / i-t / Uc-t
            </text>
          )}
        </>
      )}

      <rect x="96" y="94" width="550" height="220" rx="24" fill="#EEF4FF" stroke="#93C5FD" />
      <rect x="96" y="94" width="550" height="220" rx="24" fill={fieldTint} />
      {displayOptions.showGrid &&
        Array.from({ length: fieldRows }).map((_, row) =>
          Array.from({ length: fieldColumns }).map((__, column) => (
            <text
              key={`${row}-${column}`}
              x={120 + (column * (502 / Math.max(1, fieldColumns - 1)))}
              y={110 + (row * (188 / Math.max(1, fieldRows - 1)))}
              fill={fieldMarkColor}
              fontSize={12 + (magneticIntensity * 2)}
              textAnchor="middle"
            >
              ×
            </text>
          )),
        )}
      <line x1="120" y1={topY} x2="640" y2={topY} stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
      <line x1="120" y1={bottomY} x2="640" y2={bottomY} stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
      <line x1={rodX} y1={topY} x2={rodX} y2={bottomY} stroke={ROD_COLOR} strokeWidth="10" strokeLinecap="round" />
      {displayOptions.showLabels && (
        <>
          <text x={rodX + 16} y={bottomY + 18} fill={P13_SHELL_COLORS.text} fontSize="12" fontWeight="600">
            导体棒
          </text>
          <text x="470" y="62" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            {fieldLabel} · {railLabel}
          </text>
        </>
      )}

      <BuilderSingleBranch variant={result.variant} branchX={branchX} topY={topY} bottomY={bottomY} />

      {showCurrent && state.currentDirection !== 'none' && (
        <LoopCurrentPath
          direction={state.currentDirection}
          left={branchX}
          right={rodX}
          top={topY}
          bottom={bottomY}
          markerId="p13-builder-single-current"
        />
      )}
      {showCurrent && state.currentDirection !== 'none' && (
        <line
          x1={rodX}
          y1={state.currentDirection === 'counterclockwise' ? bottomY - 16 : topY + 16}
          x2={rodX}
          y2={state.currentDirection === 'counterclockwise' ? topY + 16 : bottomY - 16}
          stroke={P13_SHELL_COLORS.current}
          strokeWidth="5"
          markerEnd="url(#p13-builder-single-current)"
        />
      )}

      {showVelocity && state.motionDirection !== 'none' && (
        <>
          <line
            x1={rodX}
            y1={bottomY + 34}
            x2={rodX + (state.motionDirection === 'right' ? velocityArrowLength : -velocityArrowLength)}
            y2={bottomY + 34}
            stroke={P13_SHELL_COLORS.velocity}
            strokeWidth="4"
            markerEnd="url(#p13-builder-single-velocity)"
          />
          {displayOptions.showLabels && (
            <text x={rodX + 8} y={bottomY + 26} fill={P13_SHELL_COLORS.velocity} fontSize="12" fontWeight="600">
              v：{P13_HORIZONTAL_DIRECTION_LABELS[state.motionDirection]}
            </text>
          )}
        </>
      )}

      {showEmf && state.emfDirection !== 'none' && (
        <>
          <line
            x1={rodX + 24}
            y1={state.emfDirection === 'up' ? bottomY - 14 : topY + 14}
            x2={rodX + 24}
            y2={state.emfDirection === 'up' ? topY + 18 : bottomY - 18}
            stroke={P13_SHELL_COLORS.emf}
            strokeWidth="4"
            markerEnd="url(#p13-builder-single-emf)"
          />
          {displayOptions.showLabels && (
            <text x={rodX + 36} y={(topY + bottomY) / 2} fill={P13_SHELL_COLORS.emf} fontSize="12" fontWeight="600">
              ε：{P13_VERTICAL_DIRECTION_LABELS[state.emfDirection]}
            </text>
          )}
        </>
      )}

      {showForce && state.ampereForceDirection !== 'none' && (
        <>
          <line
            x1={rodX}
            y1={topY - 30}
            x2={rodX + (state.ampereForceDirection === 'right' ? forceArrowLength : -forceArrowLength)}
            y2={topY - 30}
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#p13-builder-single-force)"
          />
          {displayOptions.showLabels && (
            <text x={rodX + 8} y={topY - 40} fill={P13_SHELL_COLORS.force} fontSize="12" fontWeight="600">
              F安：{P13_HORIZONTAL_DIRECTION_LABELS[state.ampereForceDirection]}
            </text>
          )}
        </>
      )}

      {showForce && simplifiedExternalForceMode && state.externalForce > 0 && (
        <>
          <line
            x1={rodX}
            y1={topY - 52}
            x2={rodX + externalForceArrowLength}
            y2={topY - 52}
            stroke={P13_SHELL_COLORS.primary}
            strokeWidth="4"
            markerEnd="url(#p13-builder-single-external-force)"
          />
          {displayOptions.showLabels && (
            <text x={rodX + 8} y={topY - 62} fill={P13_SHELL_COLORS.primary} fontSize="12" fontWeight="600">
              F外：向右
            </text>
          )}
        </>
      )}

      {displayOptions.showLabels && (
        <>
          <rect x="486" y="196" width="214" height={simplifiedExternalForceMode ? 156 : 138} rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
          <text x="502" y="234" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前读数
          </text>
          <text x="502" y="256" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            ε：{formatNumber(state.emf, 3)} V
          </text>
          <text x="502" y="276" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            i：{formatNumber(state.current, 3)} A
          </text>
          <text x="502" y="296" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            F安：{formatNumber(state.ampereForce, 3)} N
          </text>
          {result.variant === 'with-capacitor' && (
            <text x="502" y="316" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
              Uc：{formatNumber(state.capacitorVoltage, 3)} V
            </text>
          )}
          {simplifiedExternalForceMode && (
            <text x="502" y="336" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
              F外：{formatNumber(state.externalForce, 3)} N
            </text>
          )}
          {stageOverflowed && (
            <text x="502" y={simplifiedExternalForceMode ? 356 : 342} fill={P13_SHELL_COLORS.primary} fontSize="12" fontWeight="600">
              当前位置已超出演示窗，舞台只截取前 {formatNumber(SINGLE_ROD_MAX_VISIBLE_DISPLACEMENT, 1)} m
            </text>
          )}
          <text x="122" y={topY - 18} fill={P13_SHELL_COLORS.secondary} fontSize="12" fontWeight="600">
            {fieldLabel}
          </text>
          <line x1="660" y1={topY} x2="660" y2={bottomY} stroke="#94A3B8" strokeWidth="2.5" strokeDasharray="5 4" />
          <line x1="654" y1={topY} x2="666" y2={topY} stroke="#94A3B8" strokeWidth="2.5" />
          <line x1="654" y1={bottomY} x2="666" y2={bottomY} stroke="#94A3B8" strokeWidth="2.5" />
          <text x="674" y={centerY + 4} fill={P13_SHELL_COLORS.secondary} fontSize="12" fontWeight="600">
            {railLabel}
          </text>
        </>
      )}
    </svg>
  );
}

function BuilderSingleBranch({
  variant,
  branchX,
  topY,
  bottomY,
}: {
  variant: P13SingleRodVariant;
  branchX: number;
  topY: number;
  bottomY: number;
}) {
  if (variant === 'with-source') {
    const resistorTop = topY + 18;
    const resistorHeight = 38;
    const resistorBottom = resistorTop + resistorHeight;
    const batteryTop = bottomY - 44;
    return (
      <>
        <line x1={branchX} y1={topY} x2={branchX} y2={resistorTop} stroke="#64748B" strokeWidth="4" />
        <P13VerticalResistorBody centerX={branchX} topY={resistorTop} width={20} height={resistorHeight} strokeWidth={3} />
        <line x1={branchX} y1={resistorBottom} x2={branchX} y2={batteryTop - 12} stroke="#64748B" strokeWidth="4" />
        <line x1={branchX - 14} y1={batteryTop} x2={branchX + 14} y2={batteryTop} stroke="#0F172A" strokeWidth="4" />
        <line x1={branchX - 8} y1={batteryTop + 16} x2={branchX + 8} y2={batteryTop + 16} stroke="#0F172A" strokeWidth="4" />
        <line x1={branchX} y1={batteryTop + 16} x2={branchX} y2={bottomY} stroke="#64748B" strokeWidth="4" />
        <text x={branchX + 18} y={resistorTop + 24} fill={P13_SHELL_COLORS.secondary} fontSize="12">
          电阻
        </text>
        <text x={branchX + 18} y={batteryTop + 10} fill={P13_SHELL_COLORS.secondary} fontSize="12">
          电源
        </text>
      </>
    );
  }

  if (variant === 'with-capacitor') {
    const resistorTop = topY + 18;
    const resistorHeight = 38;
    const resistorBottom = resistorTop + resistorHeight;
    const capacitorTop = bottomY - 44;
    return (
      <>
        <line x1={branchX} y1={topY} x2={branchX} y2={resistorTop} stroke="#64748B" strokeWidth="4" />
        <P13VerticalResistorBody centerX={branchX} topY={resistorTop} width={20} height={resistorHeight} strokeWidth={3} />
        <line x1={branchX} y1={resistorBottom} x2={branchX} y2={capacitorTop - 10} stroke="#64748B" strokeWidth="4" />
        <line x1={branchX - 14} y1={capacitorTop} x2={branchX + 14} y2={capacitorTop} stroke="#0F172A" strokeWidth="4" />
        <line x1={branchX - 14} y1={capacitorTop + 16} x2={branchX + 14} y2={capacitorTop + 16} stroke="#0F172A" strokeWidth="4" />
        <line x1={branchX} y1={capacitorTop + 16} x2={branchX} y2={bottomY} stroke="#64748B" strokeWidth="4" />
        <text x={branchX + 18} y={resistorTop + 24} fill={P13_SHELL_COLORS.secondary} fontSize="12">
          电阻
        </text>
        <text x={branchX + 18} y={capacitorTop + 10} fill={P13_SHELL_COLORS.secondary} fontSize="12">
          电容
        </text>
      </>
    );
  }

  return (
    <>
      <line x1={branchX} y1={topY} x2={branchX} y2={topY + 18} stroke="#64748B" strokeWidth="4" />
      <P13VerticalResistorBody centerX={branchX} topY={topY + 18} width={20} height={60} strokeWidth={3} />
      <line x1={branchX} y1={topY + 78} x2={branchX} y2={bottomY} stroke="#64748B" strokeWidth="4" />
      <text x={branchX + 18} y={topY + 54} fill={P13_SHELL_COLORS.secondary} fontSize="12">
        电阻
      </text>
    </>
  );
}

function BuilderDoubleRodStage({
  result,
  state,
  analysisStep,
  variant,
  displayOptions,
}: {
  result: P13DoubleRodSimulationResult;
  state: P13DoubleRodState;
  analysisStep: number;
  variant: P13DoubleRodVariant;
  displayOptions: P13DisplayOptions;
}) {
  const meta = getDoubleRodVariantMeta(variant);
  const minPosition = result.samples.reduce(
    (min, sample) => Math.min(min, sample.position1, sample.position2),
    Math.min(state.position1, state.position2),
  );
  const maxPosition = result.samples.reduce(
    (max, sample) => Math.max(max, sample.position1, sample.position2),
    Math.max(state.position1, state.position2),
  );
  const range = Math.max(0.8, maxPosition - minPosition);
  const scaleX = (position: number) => 150 + (((position - minPosition) / range) * 360);
  const rod2X = clamp(scaleX(state.position2), 150, 520);
  const rod1X = clamp(scaleX(state.position1), 196, 566);
  const topY = 118;
  const bottomY = 300;
  const showRelative = displayOptions.showVectors && analysisStep >= 1;
  const showEmf = displayOptions.showVectors && analysisStep >= 2;
  const showCurrent = displayOptions.showVectors && analysisStep >= 3;
  const showForce = displayOptions.showVectors && analysisStep >= 4;
  const maxSpeedMagnitude = result.samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample.velocity1), Math.abs(sample.velocity2)),
    Math.max(Math.abs(state.velocity1), Math.abs(state.velocity2)),
  );
  const maxForceMagnitude = result.samples.reduce(
    (max, sample) => Math.max(max, Math.abs(sample.ampereForceOnRod1), Math.abs(sample.ampereForceOnRod2), Math.abs(sample.externalForceOnRod1)),
    Math.max(Math.abs(state.ampereForceOnRod1), Math.abs(state.ampereForceOnRod2), Math.abs(state.externalForceOnRod1)),
  );
  const velocityArrowLength1 = scaleArrowLength(state.velocity1, maxSpeedMagnitude, 30, 84);
  const velocityArrowLength2 = scaleArrowLength(state.velocity2, maxSpeedMagnitude, 30, 84);
  const forceArrowLength1 = scaleArrowLength(state.ampereForceOnRod1, maxForceMagnitude, 28, 80);
  const forceArrowLength2 = scaleArrowLength(state.ampereForceOnRod2, maxForceMagnitude, 28, 80);
  const externalForceArrowLength = scaleArrowLength(state.externalForceOnRod1, maxForceMagnitude, 30, 84);

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }} aria-label="双棒 builder 预览">
      <defs>
        <marker id="p13-builder-double-v1" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="p13-builder-double-v2" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.field} />
        </marker>
        <marker id="p13-builder-double-emf" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.emf} />
        </marker>
        <marker id="p13-builder-double-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
        <marker id="p13-builder-double-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
        <marker id="p13-builder-double-external" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.primary} />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      {displayOptions.showGrid && <P13StageGrid left={104} top={98} right={642} bottom={308} />}
      {displayOptions.showAxes && <P13StageAxes originX={110} originY={314} />}
      {displayOptions.showLabels && (
        <>
          <text x="34" y="42" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
            {meta.code} · {meta.shortTitle}
          </text>
          <text x="34" y="62" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            Builder 内实时切换双棒耦合条件
          </text>
        </>
      )}

      <rect x="96" y="88" width="550" height="228" rx="24" fill="#EEF4FF" stroke="#93C5FD" />
      <line x1="120" y1={topY} x2="640" y2={topY} stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
      <line x1="120" y1={bottomY} x2="640" y2={bottomY} stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
      <line x1={rod2X} y1={topY} x2={rod2X} y2={bottomY} stroke="#16A34A" strokeWidth="10" strokeLinecap="round" />
      <line x1={rod1X} y1={topY} x2={rod1X} y2={bottomY} stroke={ROD_COLOR} strokeWidth="10" strokeLinecap="round" />
      {displayOptions.showLabels && (
        <>
          <text x={rod2X - 40} y={bottomY + 18} fill={P13_SHELL_COLORS.field} fontSize="12" fontWeight="600">
            棒2
          </text>
          <text x={rod1X + 14} y={bottomY + 18} fill={P13_SHELL_COLORS.velocity} fontSize="12" fontWeight="600">
            棒1
          </text>
        </>
      )}

      {showCurrent && state.currentDirection !== 'none' && (
        <LoopCurrentPath
          direction={state.currentDirection}
          left={rod2X}
          right={rod1X}
          top={topY}
          bottom={bottomY}
          markerId="p13-builder-double-current"
        />
      )}
      {showCurrent && state.currentDirection !== 'none' && (
        <>
          <line
            x1={rod1X}
            y1={state.currentDirection === 'counterclockwise' ? bottomY - 16 : topY + 16}
            x2={rod1X}
            y2={state.currentDirection === 'counterclockwise' ? topY + 16 : bottomY - 16}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="5"
            markerEnd="url(#p13-builder-double-current)"
          />
          <line
            x1={rod2X}
            y1={state.currentDirection === 'counterclockwise' ? topY + 16 : bottomY - 16}
            x2={rod2X}
            y2={state.currentDirection === 'counterclockwise' ? bottomY - 16 : topY + 16}
            stroke={P13_SHELL_COLORS.current}
            strokeWidth="5"
            markerEnd="url(#p13-builder-double-current)"
          />
        </>
      )}

      {showRelative && state.motionDirection1 !== 'none' && (
        <>
          <line
            x1={rod1X}
            y1={bottomY + 32}
            x2={rod1X + (state.motionDirection1 === 'right' ? velocityArrowLength1 : -velocityArrowLength1)}
            y2={bottomY + 32}
            stroke={P13_SHELL_COLORS.velocity}
            strokeWidth="4"
            markerEnd="url(#p13-builder-double-v1)"
          />
          {displayOptions.showLabels && (
            <text x={rod1X + 8} y={bottomY + 24} fill={P13_SHELL_COLORS.velocity} fontSize="12" fontWeight="600">
              v1：{P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.motionDirection1]}
            </text>
          )}
        </>
      )}

      {showRelative && state.motionDirection2 !== 'none' && (
        <>
          <line
            x1={rod2X}
            y1={bottomY + 56}
            x2={rod2X + (state.motionDirection2 === 'right' ? velocityArrowLength2 : -velocityArrowLength2)}
            y2={bottomY + 56}
            stroke={P13_SHELL_COLORS.field}
            strokeWidth="4"
            markerEnd="url(#p13-builder-double-v2)"
          />
          {displayOptions.showLabels && (
            <text x={rod2X + 8} y={bottomY + 48} fill={P13_SHELL_COLORS.field} fontSize="12" fontWeight="600">
              v2：{P13_DOUBLE_ROD_HORIZONTAL_DIRECTION_LABELS[state.motionDirection2]}
            </text>
          )}
        </>
      )}

      {showEmf && state.emfDirection !== 'none' && (
        <>
          <line
            x1={(rod1X + rod2X) / 2}
            y1={state.emfDirection === 'up' ? bottomY - 16 : topY + 16}
            x2={(rod1X + rod2X) / 2}
            y2={state.emfDirection === 'up' ? topY + 16 : bottomY - 16}
            stroke={P13_SHELL_COLORS.emf}
            strokeWidth="4"
            markerEnd="url(#p13-builder-double-emf)"
          />
          {displayOptions.showLabels && (
            <text x={(rod1X + rod2X) / 2 + 14} y={(topY + bottomY) / 2} fill={P13_SHELL_COLORS.emf} fontSize="12" fontWeight="600">
              ε：{P13_DOUBLE_ROD_VERTICAL_DIRECTION_LABELS[state.emfDirection]}
            </text>
          )}
        </>
      )}

      {showForce && state.ampereForceDirectionOnRod1 !== 'none' && state.ampereForceDirectionOnRod2 !== 'none' && (
        <>
          <line
            x1={rod1X}
            y1={topY - 24}
            x2={rod1X + (state.ampereForceDirectionOnRod1 === 'right' ? forceArrowLength1 : -forceArrowLength1)}
            y2={topY - 24}
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#p13-builder-double-force)"
          />
          <line
            x1={rod2X}
            y1={topY - 46}
            x2={rod2X + (state.ampereForceDirectionOnRod2 === 'right' ? forceArrowLength2 : -forceArrowLength2)}
            y2={topY - 46}
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#p13-builder-double-force)"
          />
        </>
      )}

      {showForce && variant === 'with-external-force' && state.externalForceOnRod1 > 0 && (
        <line
          x1={rod1X}
          y1={topY - 46}
          x2={rod1X + externalForceArrowLength}
          y2={topY - 46}
          stroke={P13_SHELL_COLORS.primary}
          strokeWidth="4"
          markerEnd="url(#p13-builder-double-external)"
        />
      )}

      {displayOptions.showLabels && (
        <>
          <rect x="488" y="206" width="214" height={variant === 'with-capacitor' || variant === 'with-external-force' ? 132 : 116} rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
          <text x="504" y="232" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前读数
          </text>
          <text x="504" y="254" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            Δv：{formatNumber(state.relativeVelocity, 3)} m/s
          </text>
          <text x="504" y="274" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            i：{formatNumber(state.current, 3)} A
          </text>
          <text x="504" y="294" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            F1 / F2：{formatNumber(state.ampereForceOnRod1, 3)} / {formatNumber(state.ampereForceOnRod2, 3)} N
          </text>
          {variant === 'with-capacitor' && (
            <text x="504" y="314" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
              Uc：{formatNumber(state.capacitorVoltage, 3)} V
            </text>
          )}
          {variant === 'with-external-force' && (
            <text x="504" y="314" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
              F外：{formatNumber(state.externalForceOnRod1, 3)} N
            </text>
          )}
        </>
      )}
    </svg>
  );
}

function BuilderVerticalRailStage({
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
  const maxPosition = result.samples.reduce((max, sample) => Math.max(max, sample.position), state.position);
  const displayTravel = Math.max(0.5, maxPosition);
  const topLimitY = 130;
  const bottomLimitY = 292;
  const rodY = clamp(
    topLimitY + ((state.position / displayTravel) * (bottomLimitY - topLimitY)),
    topLimitY,
    bottomLimitY,
  );
  const leftRailX = 228;
  const rightRailX = 404;
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
  const velocityArrowLength = scaleArrowLength(state.velocity, maxSpeedMagnitude, 36, 88);
  const forceArrowLength = scaleArrowLength(state.ampereForce, maxForceMagnitude, 30, 76);

  return (
    <svg viewBox="0 0 760 390" style={{ width: '100%', display: 'block' }} aria-label="竖直导轨 builder 预览">
      <defs>
        <marker id="p13-builder-vertical-velocity" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.velocity} />
        </marker>
        <marker id="p13-builder-vertical-current" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.current} />
        </marker>
        <marker id="p13-builder-vertical-force" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.force} />
        </marker>
        <marker id="p13-builder-vertical-emf" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M 0 0 L 10 5 L 0 10 z" fill={P13_SHELL_COLORS.emf} />
        </marker>
      </defs>

      <rect x="10" y="10" width="740" height="370" rx="24" fill="#FFFDF9" stroke={P13_SHELL_COLORS.border} />
      {displayOptions.showGrid && <P13StageGrid left={156} top={96} right={500} bottom={312} />}
      {displayOptions.showAxes && <P13StageAxes originX={162} originY={318} />}
      {displayOptions.showLabels && (
        <>
          <text x="34" y="42" fill={P13_SHELL_COLORS.text} fontSize="15" fontWeight="600">
            {P13_VERTICAL_RAIL_ROD_META.code} · 竖直导轨
          </text>
          <text x="34" y="62" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            Builder 内实时调整竖直导轨参数
          </text>
        </>
      )}

      <rect x="148" y="90" width="360" height="228" rx="24" fill="#EEF4FF" stroke="#93C5FD" />
      <line x1={leftRailX} y1={116} x2={leftRailX} y2={310} stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
      <line x1={rightRailX} y1={116} x2={rightRailX} y2={310} stroke={RAIL_COLOR} strokeWidth="6" strokeLinecap="round" />
      <line x1={leftRailX} y1={rodY} x2={rightRailX} y2={rodY} stroke={ROD_COLOR} strokeWidth="10" strokeLinecap="round" />
      {displayOptions.showLabels && (
        <text x={rightRailX + 16} y={rodY + 4} fill={P13_SHELL_COLORS.text} fontSize="12" fontWeight="600">
          导体棒
        </text>
      )}

      <line x1={leftRailX} y1={116} x2={264} y2={116} stroke="#64748B" strokeWidth="4" />
      <P13HorizontalResistorBody leftX={272} centerY={116} width={96} height={20} strokeWidth={2.5} />
      <line x1={376} y1={116} x2={rightRailX} y2={116} stroke="#64748B" strokeWidth="4" />

      {showCurrent && state.currentDirection !== 'none' && (
        <LoopCurrentPath
          direction={state.currentDirection === 'clockwise' ? 'clockwise' : 'counterclockwise'}
          left={leftRailX}
          right={rightRailX}
          top={116}
          bottom={rodY}
          markerId="p13-builder-vertical-current"
        />
      )}
      {showCurrent && state.currentDirection !== 'none' && (
        <line
          x1={state.currentDirection === 'clockwise' ? leftRailX + 18 : rightRailX - 18}
          y1={rodY}
          x2={state.currentDirection === 'clockwise' ? rightRailX - 18 : leftRailX + 18}
          y2={rodY}
          stroke={P13_SHELL_COLORS.current}
          strokeWidth="5"
          markerEnd="url(#p13-builder-vertical-current)"
        />
      )}

      {showVelocity && state.motionDirection !== 'none' && (
        <>
          <line
            x1={rightRailX + 44}
            y1={rodY - (velocityArrowLength * 0.5)}
            x2={rightRailX + 44}
            y2={rodY + (velocityArrowLength * 0.5)}
            stroke={P13_SHELL_COLORS.velocity}
            strokeWidth="4"
            markerEnd="url(#p13-builder-vertical-velocity)"
          />
          {displayOptions.showLabels && (
            <text x={rightRailX + 58} y={rodY + 38} fill={P13_SHELL_COLORS.velocity} fontSize="12" fontWeight="600">
              v：{P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS[state.motionDirection]}
            </text>
          )}
        </>
      )}

      {showEmf && state.emfDirection !== 'none' && (
        <>
          <line
            x1={rightRailX + 14}
            y1={state.emfDirection === 'right' ? rodY + 22 : rodY - 22}
            x2={state.emfDirection === 'right' ? rightRailX + 86 : leftRailX - 86}
            y2={state.emfDirection === 'right' ? rodY + 22 : rodY - 22}
            stroke={P13_SHELL_COLORS.emf}
            strokeWidth="4"
            markerEnd="url(#p13-builder-vertical-emf)"
          />
        </>
      )}

      {showForce && state.ampereForceDirection !== 'none' && (
        <>
          <line
            x1={leftRailX - 40}
            y1={rodY + (forceArrowLength * 0.5)}
            x2={leftRailX - 40}
            y2={rodY - (forceArrowLength * 0.5)}
            stroke={P13_SHELL_COLORS.force}
            strokeWidth="4"
            markerEnd="url(#p13-builder-vertical-force)"
          />
          {displayOptions.showLabels && (
            <text x={leftRailX - 30} y={rodY - 38} fill={P13_SHELL_COLORS.force} fontSize="12" fontWeight="600">
              F安：{P13_VERTICAL_RAIL_VERTICAL_DIRECTION_LABELS[state.ampereForceDirection]}
            </text>
          )}
        </>
      )}

      {displayOptions.showLabels && (
        <>
          <rect x="520" y="206" width="176" height="112" rx="22" fill="#FFFFFF" stroke={P13_SHELL_COLORS.border} />
          <text x="536" y="232" fill={P13_SHELL_COLORS.secondary} fontSize="12">
            当前读数
          </text>
          <text x="536" y="254" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            v：{formatNumber(state.velocity, 3)} m/s
          </text>
          <text x="536" y="274" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            i：{formatNumber(state.current, 3)} A
          </text>
          <text x="536" y="294" fill={P13_SHELL_COLORS.text} fontSize="13" fontWeight="600">
            F安：{formatNumber(state.ampereForce, 3)} N
          </text>
        </>
      )}
    </svg>
  );
}

function LoopCurrentPath({
  direction,
  left,
  right,
  top,
  bottom,
  markerId,
}: {
  direction: 'clockwise' | 'counterclockwise';
  left: number;
  right: number;
  top: number;
  bottom: number;
  markerId: string;
}) {
  const topY = top - 16;
  const bottomY = bottom + 16;
  const leftX = left - 16;
  const rightX = right + 16;

  return (
    <>
      <line
        x1={direction === 'counterclockwise' ? right : left}
        y1={topY}
        x2={direction === 'counterclockwise' ? left : right}
        y2={topY}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd={`url(#${markerId})`}
      />
      <line
        x1={rightX}
        y1={direction === 'counterclockwise' ? top : bottom}
        x2={rightX}
        y2={direction === 'counterclockwise' ? bottom : top}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd={`url(#${markerId})`}
      />
      <line
        x1={direction === 'counterclockwise' ? left : right}
        y1={bottomY}
        x2={direction === 'counterclockwise' ? right : left}
        y2={bottomY}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd={`url(#${markerId})`}
      />
      <line
        x1={leftX}
        y1={direction === 'counterclockwise' ? bottom : top}
        x2={leftX}
        y2={direction === 'counterclockwise' ? top : bottom}
        stroke={P13_SHELL_COLORS.current}
        strokeWidth="3"
        markerEnd={`url(#${markerId})`}
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

function formatPhysicalTime(value: number): string {
  return `${value.toFixed(2)} s`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
