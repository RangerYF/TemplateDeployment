import { type ReactNode } from 'react';
import { COLORS } from '@/styles/tokens';
import {
  type CurrentResistanceMeasurementSnapshot,
  type CurrentResistanceMeasurementTarget,
  type CurrentResistanceMeterMode,
  type CurrentResistanceMethodParams,
  type CurrentResistanceMethodResult,
  type CurrentResistanceSweepPoint,
} from '@/domains/em/logic/current-resistance-method';
import {
  useCurrentResistanceMethod,
} from './current-resistance-method/useCurrentResistanceMethod';

const pageStyle = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: COLORS.bg,
  blockBg: COLORS.bg,
  blockSoft: COLORS.bgMuted,
  border: COLORS.border,
  text: COLORS.text,
  muted: COLORS.textMuted,
  secondary: COLORS.textSecondary,
  accent: COLORS.primary,
  accentSoft: COLORS.primaryLight,
} as const;

const CURRENT_RESISTANCE_TARGET_META: Record<
  CurrentResistanceMeasurementTarget,
  { label: string; detail: string }
> = {
  known: {
    label: '测 R0 支路',
    detail: '先把电流表串入已知电阻支路，记录 I0。',
  },
  unknown: {
    label: '测 Rx 支路',
    detail: '再把电流表改接到未知电阻支路，记录 Ix。',
  },
};

const CURRENT_RESISTANCE_MODE_META: Record<
  CurrentResistanceMeterMode,
  { label: string; detail: string }
> = {
  ideal: {
    label: '理想电流表',
    detail: '取 Ra → 0，只保留教材核心比例关系。',
  },
  real: {
    label: '真实电流表',
    detail: '把 Ra 串入被测支路，观察读数扰动与系统误差。',
  },
};

interface Props {
  onBack: () => void;
}

interface CurrentResistanceMeasurementSet {
  knownMeasurement: CurrentResistanceMeasurementSnapshot;
  unknownMeasurement: CurrentResistanceMeasurementSnapshot;
  activeMeasurement: CurrentResistanceMeasurementSnapshot;
  inferredResistance: number;
  relativeErrorPercent: number;
}

export function CurrentResistanceMethodPage({ onBack }: Props) {
  const { params, result, setParam, applyParams, resetParams } =
    useCurrentResistanceMethod();
  const activeSet = selectCurrentResistanceMeasurementSet(
    result,
    params.meterMode,
  );

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: pageStyle.pageBg }}
    >
      <header
        className="flex items-center gap-3 px-5 py-2.5"
        style={{
          borderBottom: `1px solid ${pageStyle.border}`,
          backgroundColor: pageStyle.panelBg,
        }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 text-xs font-medium"
          style={{
            color: pageStyle.text,
            border: `1px solid ${pageStyle.border}`,
            backgroundColor: pageStyle.blockBg,
          }}
        >
          ← 返回
        </button>
        <h1 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
          安阻法测电阻
        </h1>
        <span className="text-[11px]" style={{ color: pageStyle.muted }}>
          并联 R0 与 Rx，电流表分两次测支路电流，用电流分配关系反推未知电阻
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <CurrentResistanceControlPanel
          params={params}
          activeSet={activeSet}
          onChangeParam={setParam}
          onApplyParams={applyParams}
          onReset={resetParams}
        />
        <CurrentResistanceCenterPanel
          params={params}
          result={result}
          activeSet={activeSet}
          onChangeMeasurementTarget={(value) =>
            setParam('measurementTarget', value)
          }
        />
        <CurrentResistanceRightPanel
          params={params}
          result={result}
          activeSet={activeSet}
        />
      </div>
    </div>
  );
}

function selectCurrentResistanceMeasurementSet(
  result: CurrentResistanceMethodResult,
  meterMode: CurrentResistanceMeterMode,
): CurrentResistanceMeasurementSet {
  if (meterMode === 'ideal') {
    return {
      knownMeasurement: result.idealKnownMeasurement,
      unknownMeasurement: result.idealUnknownMeasurement,
      activeMeasurement: result.activeIdealMeasurement,
      inferredResistance: result.inferredResistanceIdeal,
      relativeErrorPercent: 0,
    };
  }

  return {
    knownMeasurement: result.realKnownMeasurement,
    unknownMeasurement: result.realUnknownMeasurement,
    activeMeasurement: result.activeRealMeasurement,
    inferredResistance: result.inferredResistanceReal,
    relativeErrorPercent: result.relativeErrorPercent,
  };
}

function CurrentResistanceControlPanel({
  params,
  activeSet,
  onChangeParam,
  onApplyParams,
  onReset,
}: {
  params: CurrentResistanceMethodParams;
  activeSet: CurrentResistanceMeasurementSet;
  onChangeParam: <Key extends keyof CurrentResistanceMethodParams>(
    key: Key,
    value: CurrentResistanceMethodParams[Key],
  ) => void;
  onApplyParams: (partial: Partial<CurrentResistanceMethodParams>) => void;
  onReset: () => void;
}) {
  return (
    <div
      className="flex w-[290px] shrink-0 flex-col overflow-y-auto"
      style={{
        backgroundColor: pageStyle.panelSoft,
        borderRight: `1px solid ${pageStyle.border}`,
      }}
    >
      <div className="p-4">
        <div
          className="mb-4 rounded-lg p-3"
          style={{
            backgroundColor: pageStyle.blockSoft,
            border: `1px solid ${pageStyle.border}`,
          }}
        >
          <div className="text-xs font-semibold" style={{ color: pageStyle.text }}>
            当前模式
          </div>
          <div className="mt-1 text-[16px] font-semibold" style={{ color: pageStyle.accent }}>
            {CURRENT_RESISTANCE_MODE_META[params.meterMode].label}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            {CURRENT_RESISTANCE_MODE_META[params.meterMode].detail}
          </div>
          <div className="mt-3 text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
            当前 A 表读数 = {formatCurrent(activeSet.activeMeasurement.displayedCurrent)}
          </div>
          <div className="text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
            按理想公式推算 Rx = {formatResistance(activeSet.inferredResistance, 2)}
          </div>
        </div>

        <SectionTitle title="快捷场景" />
        <div className="mb-4 flex flex-wrap gap-2">
          <PresetButton
            label="标准教学"
            onClick={() => onReset()}
          />
          <PresetButton
            label="近似理想"
            onClick={() =>
              onApplyParams({
                meterMode: 'ideal',
                ammeterResistance: 0.05,
              })
            }
          />
          <PresetButton
            label="误差放大"
            onClick={() =>
              onApplyParams({
                meterMode: 'real',
                ammeterResistance: 3.5,
                unknownResistance: 42,
              })
            }
          />
          <PresetButton
            label="设 Rx = R0"
            onClick={() =>
              onApplyParams({
                unknownResistance: params.knownResistance,
              })
            }
          />
        </div>

        <SectionTitle title="测量模式" />
        <ToggleGroup
          options={(
            ['ideal', 'real'] as CurrentResistanceMeterMode[]
          ).map((value) => ({
            value,
            label: CURRENT_RESISTANCE_MODE_META[value].label,
          }))}
          value={params.meterMode}
          onChange={(value) => onChangeParam('meterMode', value as CurrentResistanceMeterMode)}
        />

        <div className="mt-3">
          <ToggleGroup
            options={(
              ['known', 'unknown'] as CurrentResistanceMeasurementTarget[]
            ).map((value) => ({
              value,
              label: CURRENT_RESISTANCE_TARGET_META[value].label,
            }))}
            value={params.measurementTarget}
            onChange={(value) =>
              onChangeParam(
                'measurementTarget',
                value as CurrentResistanceMeasurementTarget,
              )
            }
          />
        </div>

        <div
          className="mt-3 rounded-lg p-3"
          style={{
            backgroundColor: pageStyle.blockSoft,
            border: `1px solid ${pageStyle.border}`,
          }}
        >
          <div className="text-xs font-semibold" style={{ color: pageStyle.text }}>
            当前测量步骤
          </div>
          <div className="mt-1 text-[12px] font-semibold" style={{ color: '#D97706' }}>
            {CURRENT_RESISTANCE_TARGET_META[params.measurementTarget].label}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            {CURRENT_RESISTANCE_TARGET_META[params.measurementTarget].detail}
          </div>
        </div>

        <SectionTitle title="参数控制" />
        <RangeControl
          label="电源电压 E"
          value={params.emf}
          min={1}
          max={12}
          step={0.1}
          unit="V"
          onChange={(value) => onChangeParam('emf', value)}
        />
        <RangeControl
          label="已知电阻 R0"
          value={params.knownResistance}
          min={2}
          max={30}
          step={0.5}
          unit="Ω"
          onChange={(value) => onChangeParam('knownResistance', value)}
        />
        <RangeControl
          label="被测电阻 Rx"
          value={params.unknownResistance}
          min={1}
          max={80}
          step={0.5}
          unit="Ω"
          onChange={(value) => onChangeParam('unknownResistance', value)}
        />
        <RangeControl
          label="电流表内阻 Ra"
          value={params.ammeterResistance}
          min={0}
          max={8}
          step={0.1}
          unit="Ω"
          onChange={(value) => onChangeParam('ammeterResistance', value)}
        />
      </div>
    </div>
  );
}

function CurrentResistanceCenterPanel({
  params,
  result,
  activeSet,
  onChangeMeasurementTarget,
}: {
  params: CurrentResistanceMethodParams;
  result: CurrentResistanceMethodResult;
  activeSet: CurrentResistanceMeasurementSet;
  onChangeMeasurementTarget: (value: CurrentResistanceMeasurementTarget) => void;
}) {
  return (
    <div
      className="flex min-w-0 flex-1 flex-col overflow-y-auto"
      style={{ backgroundColor: pageStyle.panelBg }}
    >
      <div className="p-4">
        <CurrentResistanceCircuitCard
          params={params}
          activeSet={activeSet}
          onChangeMeasurementTarget={onChangeMeasurementTarget}
        />
      </div>

      <div className="px-4 pb-4">
        <CurrentResistanceReadingChartCard
          params={params}
          result={result}
        />
      </div>

      <div className="px-4 pb-4">
        <CurrentResistanceErrorChartCard
          params={params}
          result={result}
        />
      </div>
    </div>
  );
}

function CurrentResistanceRightPanel({
  params,
  result,
  activeSet,
}: {
  params: CurrentResistanceMethodParams;
  result: CurrentResistanceMethodResult;
  activeSet: CurrentResistanceMeasurementSet;
}) {
  return (
    <div
      className="flex w-[340px] shrink-0 flex-col overflow-y-auto"
      style={{
        backgroundColor: pageStyle.panelBg,
        borderLeft: `1px solid ${pageStyle.border}`,
      }}
    >
      <div className="p-3">
        <CurrentResistanceFormulaCard
          params={params}
          result={result}
        />
      </div>

      <div className="px-3 pb-3">
        <PanelTitle title="结果列表" />
        <CurrentResistanceMeasurementTable activeSet={activeSet} />
        <CurrentResistanceSummaryTable
          params={params}
          result={result}
          activeSet={activeSet}
        />
      </div>

      <div className="px-3 pb-4">
        <PanelTitle title="教学结论" />
        <div
          className="rounded-xl border p-3"
          style={{
            borderColor: `${COLORS.primary}55`,
            backgroundColor: COLORS.primaryLight,
          }}
        >
          <div className="text-xs font-semibold" style={{ color: COLORS.primary }}>
            误差来源与判据
          </div>
          <div className="mt-2 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            理想安阻法利用比例关系 I0 / Ix = Rx / R0，电源电压 E 在比值中会相互约掉，所以改变 E 会改变表头读数，但不会改变理想推算结果。
          </div>
          <div className="mt-2 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            当 Ra 有限时，电流表总是与被测支路串联，导致两次测量分别变成 I0 = E / (R0 + Ra)、Ix = E / (Rx + Ra)。若仍直接套用理想公式，推算值会被拉向 R0。
          </div>
          <div className="mt-2 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            若 Rx &gt; R0，则当前系统会低估 Rx；若 Rx &lt; R0，则会高估 Rx；当 Rx = R0 时，误差恰好为 0。已知 Ra 时可用修正公式消除该误差。
          </div>
        </div>
      </div>
    </div>
  );
}

function CurrentResistanceCircuitCard({
  params,
  activeSet,
  onChangeMeasurementTarget,
}: {
  params: CurrentResistanceMethodParams;
  activeSet: CurrentResistanceMeasurementSet;
  onChangeMeasurementTarget: (value: CurrentResistanceMeasurementTarget) => void;
}) {
  const knownSelected = params.measurementTarget === 'known';
  const knownStroke = knownSelected ? '#D97706' : '#2563EB';
  const unknownStroke = knownSelected ? '#059669' : '#D97706';
  const totalStroke = '#475569';
  const activeMeasurement = activeSet.activeMeasurement;

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor: pageStyle.border,
        backgroundColor: pageStyle.blockBg,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            标准电路图
          </div>
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
            电源 E 经开关 S 向并联的 R0 与 Rx 供电，电流表 A 分两次改接到不同支路，记录 I0 与 Ix 后再求 Rx。
          </div>
        </div>
        <ToggleGroup
          compact
          options={(
            ['known', 'unknown'] as CurrentResistanceMeasurementTarget[]
          ).map((value) => ({
            value,
            label: CURRENT_RESISTANCE_TARGET_META[value].label,
          }))}
          value={params.measurementTarget}
          onChange={(value) =>
            onChangeMeasurementTarget(value as CurrentResistanceMeasurementTarget)
          }
        />
      </div>

      <div
        className="mt-3 overflow-hidden rounded-lg border"
        style={{ borderColor: pageStyle.border }}
      >
        <svg
          viewBox="0 0 520 270"
          style={{ width: '100%', display: 'block', background: '#FCFCFD' }}
          aria-label="安阻法测电阻标准电路图"
        >
          <defs>
            <marker
              id="currentResistanceArrow"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5.5"
              markerHeight="5.5"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="#334155" />
            </marker>
          </defs>

          <rect x="1" y="1" width="518" height="268" fill="#FCFCFD" stroke={pageStyle.border} />

          <line x1="78" y1="64" x2="122" y2="64" stroke="#111827" strokeWidth="2.3" />
          <line x1="150" y1="64" x2="450" y2="64" stroke="#111827" strokeWidth="2.3" />
          <line x1="450" y1="64" x2="450" y2="208" stroke="#111827" strokeWidth="2.3" />
          <line x1="450" y1="208" x2="78" y2="208" stroke="#111827" strokeWidth="2.3" />
          <line x1="78" y1="64" x2="78" y2="92" stroke="#111827" strokeWidth="2.3" />
          <line x1="78" y1="124" x2="78" y2="208" stroke="#111827" strokeWidth="2.3" />

          <line x1="122" y1="64" x2="138" y2="64" stroke="#111827" strokeWidth="2.3" />
          <line x1="138" y1="64" x2="150" y2="52" stroke="#111827" strokeWidth="2.3" />
          <circle cx="122" cy="64" r="3.2" fill="#111827" />
          <circle cx="150" cy="64" r="3.2" fill="#111827" />

          <BatterySymbol x={78} top={92} bottom={124} stroke="#111827" />

          <line x1="270" y1="64" x2="270" y2="82" stroke={knownStroke} strokeWidth={knownSelected ? 3.6 : 2.3} />
          {knownSelected ? (
            <>
              <MeterSymbol center={{ x: 270, y: 104 }} accent={knownStroke} />
              <line x1="270" y1="122" x2="270" y2="136" stroke={knownStroke} strokeWidth="3.6" />
              <ResistorSymbol x={248} y={136} width={44} height={50} stroke={knownStroke} />
            </>
          ) : (
            <>
              <line x1="270" y1="82" x2="270" y2="108" stroke={knownStroke} strokeWidth="2.3" />
              <ResistorSymbol x={248} y={108} width={44} height={50} stroke={knownStroke} />
            </>
          )}
          <line x1="270" y1="186" x2="270" y2="208" stroke={knownStroke} strokeWidth={knownSelected ? 3.6 : 2.3} />

          <line x1="382" y1="64" x2="382" y2="82" stroke={unknownStroke} strokeWidth={knownSelected ? 2.3 : 3.6} />
          {!knownSelected ? (
            <>
              <MeterSymbol center={{ x: 382, y: 104 }} accent={unknownStroke} />
              <line x1="382" y1="122" x2="382" y2="136" stroke={unknownStroke} strokeWidth="3.6" />
              <ResistorSymbol x={360} y={136} width={44} height={50} stroke={unknownStroke} />
            </>
          ) : (
            <>
              <line x1="382" y1="82" x2="382" y2="108" stroke={unknownStroke} strokeWidth="2.3" />
              <ResistorSymbol x={360} y={108} width={44} height={50} stroke={unknownStroke} />
            </>
          )}
          <line x1="382" y1="186" x2="382" y2="208" stroke={unknownStroke} strokeWidth={knownSelected ? 2.3 : 3.6} />

          <CurrentResistanceCurrentArrow
            x={238}
            y1={78}
            y2={194}
            color={knownStroke}
            label={`I0 = ${formatCurrent(activeMeasurement.knownBranchCurrent)}`}
          />
          <CurrentResistanceCurrentArrow
            x={414}
            y1={78}
            y2={194}
            color={unknownStroke}
            label={`Ix = ${formatCurrent(activeMeasurement.unknownBranchCurrent)}`}
          />

          <line
            x1="168"
            y1="44"
            x2="434"
            y2="44"
            stroke={totalStroke}
            strokeWidth="1.9"
            markerEnd="url(#currentResistanceArrow)"
          />
          <text x="302" y="34" textAnchor="middle" fontSize="11" fill={totalStroke}>
            It = {formatCurrent(activeMeasurement.totalCurrent)}
          </text>

          <text x="78" y="226" fontSize="11" fill={pageStyle.muted}>
            电源 E = {formatVoltage(params.emf)}
          </text>
          <text x="124" y="52" fontSize="11" fill={pageStyle.muted}>
            S
          </text>
          <text x="226" y="232" fontSize="11" fill={knownStroke}>
            R0 = {formatResistance(params.knownResistance, 1)}
          </text>
          <text x="340" y="232" fontSize="11" fill={unknownStroke}>
            Rx = {formatResistance(params.unknownResistance, 1)}
          </text>
          <text x="270" y="26" textAnchor="middle" fontSize="11" fill={pageStyle.muted}>
            并联支路电压相等：U0 = Ux = E
          </text>
          <text x="352" y="26" textAnchor="middle" fontSize="11" fill="#D97706">
            {params.meterMode === 'ideal'
              ? '理想比较：Ra → 0'
              : `真实比较：Ra = ${formatResistance(params.ammeterResistance, 1)}`}
          </text>
          <text x="270" y={knownSelected ? 132 : 96} textAnchor="middle" fontSize="10.5" fill={knownStroke}>
            {knownSelected ? 'A 串入 R0 支路' : '步骤 1：改接 A 测 I0'}
          </text>
          <text x="382" y={!knownSelected ? 132 : 96} textAnchor="middle" fontSize="10.5" fill={unknownStroke}>
            {!knownSelected ? 'A 串入 Rx 支路' : '步骤 2：改接 A 测 Ix'}
          </text>
        </svg>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-2">
        <CircuitDetailCard title="当前系统卡片">
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            当前接法：{CURRENT_RESISTANCE_TARGET_META[params.measurementTarget].label}
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            A 表读数：{formatCurrent(activeMeasurement.displayedCurrent)}
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            本次回路总电流：{formatCurrent(activeMeasurement.totalCurrent)}
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            被测支路总阻值：{formatResistance(activeMeasurement.measuredBranchResistance, 2)}
          </div>
        </CircuitDetailCard>
        <CircuitDetailCard title="两次测量汇总">
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            I0 = {formatCurrent(activeSet.knownMeasurement.displayedCurrent)}
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            Ix = {formatCurrent(activeSet.unknownMeasurement.displayedCurrent)}
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            当前推算 Rx = {formatResistance(activeSet.inferredResistance, 2)}
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.75 }}>
            相对误差 = {formatPercent(activeSet.relativeErrorPercent)}
          </div>
        </CircuitDetailCard>
      </div>
    </div>
  );
}

function CurrentResistanceFormulaCard({
  params,
  result,
}: {
  params: CurrentResistanceMethodParams;
  result: CurrentResistanceMethodResult;
}) {
  return (
    <>
      <PanelTitle title="关键公式" />
      <div
        className="rounded-xl border p-3"
        style={{
          borderColor: pageStyle.border,
          backgroundColor: pageStyle.blockBg,
        }}
      >
        <div className="text-xs font-semibold" style={{ color: '#2563EB' }}>
          理想安阻法
        </div>
        <FormulaLine>U0 = Ux = E</FormulaLine>
        <FormulaLine>I0 = E / R0，Ix = E / Rx</FormulaLine>
        <FormulaLine>I0 / Ix = Rx / R0</FormulaLine>
        <FormulaLine>Rx = R0 · I0 / Ix</FormulaLine>
        <div className="mt-2 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
          代入当前参数：Rx = {formatResistance(params.knownResistance, 1)} ×{' '}
          {formatCurrent(result.idealKnownMeasurement.displayedCurrent)} /{' '}
          {formatCurrent(result.idealUnknownMeasurement.displayedCurrent)} ={' '}
          {formatResistance(result.inferredResistanceIdeal, 2)}
        </div>

        <div className="mt-4 text-xs font-semibold" style={{ color: COLORS.primary }}>
          真实电流表
        </div>
        <FormulaLine>I0 = E / (R0 + Ra)</FormulaLine>
        <FormulaLine>Ix = E / (Rx + Ra)</FormulaLine>
        <FormulaLine>若仍套用理想式：Rx&apos; = R0 · I0 / Ix</FormulaLine>
        <FormulaLine>修正式：Rx = (R0 + Ra) · I0 / Ix - Ra</FormulaLine>
        <div className="mt-2 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
          当前真实系统：Rx&apos; = {formatResistance(result.inferredResistanceReal, 2)}，
          修正后 = {formatResistance(result.correctedResistanceReal, 2)}。
        </div>
      </div>
    </>
  );
}

function CurrentResistanceReadingChartCard({
  params,
  result,
}: {
  params: CurrentResistanceMethodParams;
  result: CurrentResistanceMethodResult;
}) {
  const width = 760;
  const height = 290;
  const pad = { left: 58, right: 26, top: 20, bottom: 38 };
  const plotX = pad.left;
  const plotY = pad.top;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xMin = result.range.minUnknownResistance;
  const xMax = result.range.maxUnknownResistance;
  const yMax =
    Math.max(
      ...result.sweep.map((point) =>
        Math.max(
          point.knownCurrentIdeal,
          point.knownCurrentReal,
          point.unknownCurrentIdeal,
          point.unknownCurrentReal,
        ),
      ),
      result.currentPoint.knownCurrentIdeal,
      result.currentPoint.unknownCurrentReal,
      0.1,
    ) * 1.16;

  const toX = (value: number) =>
    plotX + ((value - xMin) / Math.max(xMax - xMin, 1e-9)) * plotW;
  const toY = (value: number) =>
    plotY + plotH - (value / Math.max(yMax, 1e-9)) * plotH;
  const buildPath = (accessor: (point: CurrentResistanceSweepPoint) => number) =>
    result.sweep
      .map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${toX(point.unknownResistance).toFixed(2)} ${toY(accessor(point)).toFixed(2)}`,
      )
      .join(' ');
  const currentX = toX(result.currentPoint.unknownResistance);
  const knownCurrentNow =
    params.meterMode === 'ideal'
      ? result.currentPoint.knownCurrentIdeal
      : result.currentPoint.knownCurrentReal;
  const unknownCurrentNow =
    params.meterMode === 'ideal'
      ? result.currentPoint.unknownCurrentIdeal
      : result.currentPoint.unknownCurrentReal;
  const selectedCurrent =
    params.measurementTarget === 'known' ? knownCurrentNow : unknownCurrentNow;

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: pageStyle.border,
        backgroundColor: pageStyle.blockBg,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            关系图：支路电流读数随 Rx 变化
          </div>
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
            蓝色表示测 R0 支路得到的 I0，绿色表示测 Rx 支路得到的 Ix。虚线为理想电流表，实线为当前 Ra 下的真实读数。
          </div>
        </div>
        <ChartLegend
          items={[
            { color: '#2563EB', label: 'I0 理想', dash: '5 4' },
            { color: '#2563EB', label: 'I0 真实' },
            { color: '#059669', label: 'Ix 理想', dash: '5 4' },
            { color: '#059669', label: 'Ix 真实' },
          ]}
        />
      </div>

      <div className="mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
          <rect x="0" y="0" width={width} height={height} rx="12" fill="#FFFFFF" />

          {Array.from({ length: 7 }).map((_, index) => {
            const x = plotX + (plotW * index) / 6;
            return (
              <line
                key={`rx-grid-${index}`}
                x1={x}
                y1={plotY}
                x2={x}
                y2={plotY + plotH}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}
          {Array.from({ length: 6 }).map((_, index) => {
            const y = plotY + (plotH * index) / 5;
            return (
              <line
                key={`iy-grid-${index}`}
                x1={plotX}
                y1={y}
                x2={plotX + plotW}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}

          <line
            x1={currentX}
            y1={plotY}
            x2={currentX}
            y2={plotY + plotH}
            stroke="#D97706"
            strokeDasharray="6 4"
            strokeWidth="1.4"
          />

          <path d={buildPath((point) => point.knownCurrentIdeal)} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeDasharray="5 4" />
          <path d={buildPath((point) => point.knownCurrentReal)} fill="none" stroke="#2563EB" strokeWidth="2.4" />
          <path d={buildPath((point) => point.unknownCurrentIdeal)} fill="none" stroke="#059669" strokeWidth="2.2" strokeDasharray="5 4" />
          <path d={buildPath((point) => point.unknownCurrentReal)} fill="none" stroke="#059669" strokeWidth="2.4" />

          <circle cx={currentX} cy={toY(result.currentPoint.knownCurrentIdeal)} r="4.5" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
          <circle cx={currentX} cy={toY(result.currentPoint.knownCurrentReal)} r="4.5" fill="#2563EB" />
          <circle cx={currentX} cy={toY(result.currentPoint.unknownCurrentIdeal)} r="4.5" fill="#FFFFFF" stroke="#059669" strokeWidth="2" />
          <circle cx={currentX} cy={toY(result.currentPoint.unknownCurrentReal)} r="4.5" fill="#059669" />
          <circle cx={currentX} cy={toY(selectedCurrent)} r="8" fill="none" stroke="#D97706" strokeWidth="2.2" />

          <text x={currentX + 10} y={toY(result.currentPoint.knownCurrentReal) - 8} fontSize="10" fill="#2563EB">
            I0 当前
          </text>
          <text x={currentX + 10} y={toY(result.currentPoint.unknownCurrentReal) - 8} fontSize="10" fill="#059669">
            Ix 当前
          </text>
          <text x={currentX + 10} y={toY(selectedCurrent) + 18} fontSize="10" fill="#D97706">
            A表当前工作点
          </text>

          {Array.from({ length: 7 }).map((_, index) => {
            const value = xMin + ((xMax - xMin) * index) / 6;
            return (
              <text
                key={`rx-tick-${index}`}
                x={plotX + (plotW * index) / 6}
                y={plotY + plotH + 18}
                textAnchor="middle"
                fontSize="10"
                fill={pageStyle.muted}
              >
                {value.toFixed(0)}
              </text>
            );
          })}
          {Array.from({ length: 6 }).map((_, index) => {
            const value = yMax - (yMax * index) / 5;
            return (
              <text
                key={`iy-tick-${index}`}
                x={plotX - 8}
                y={plotY + (plotH * index) / 5 + 3}
                textAnchor="end"
                fontSize="10"
                fill={pageStyle.muted}
              >
                {value.toFixed(2)}
              </text>
            );
          })}

          <text x={plotX + plotW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={pageStyle.muted}>
            Rx / Ω
          </text>
          <text x="18" y={plotY + plotH / 2} fontSize="11" fill={pageStyle.muted} transform={`rotate(-90 18 ${plotY + plotH / 2})`}>
            I / A
          </text>
        </svg>
      </div>
    </div>
  );
}

function CurrentResistanceErrorChartCard({
  params,
  result,
}: {
  params: CurrentResistanceMethodParams;
  result: CurrentResistanceMethodResult;
}) {
  const width = 760;
  const height = 240;
  const pad = { left: 60, right: 26, top: 18, bottom: 40 };
  const plotX = pad.left;
  const plotY = pad.top;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const xMin = result.range.minUnknownResistance;
  const xMax = result.range.maxUnknownResistance;
  const rawMin = Math.min(
    0,
    ...result.sweep.map((point) => point.relativeErrorPercent),
    result.currentPoint.relativeErrorPercent,
  );
  const rawMax = Math.max(
    0,
    ...result.sweep.map((point) => point.relativeErrorPercent),
    result.currentPoint.relativeErrorPercent,
  );
  const spanPad = Math.max((rawMax - rawMin) * 0.14, 1.2);
  const yMin = rawMin - spanPad;
  const yMax = rawMax + spanPad;
  const toX = (value: number) =>
    plotX + ((value - xMin) / Math.max(xMax - xMin, 1e-9)) * plotW;
  const toY = (value: number) =>
    plotY + plotH - ((value - yMin) / Math.max(yMax - yMin, 1e-9)) * plotH;
  const buildPath = (accessor: (point: CurrentResistanceSweepPoint) => number) =>
    result.sweep
      .map((point, index) =>
        `${index === 0 ? 'M' : 'L'} ${toX(point.unknownResistance).toFixed(2)} ${toY(accessor(point)).toFixed(2)}`,
      )
      .join(' ');
  const currentX = toX(result.currentPoint.unknownResistance);
  const currentY = toY(result.currentPoint.relativeErrorPercent);
  const zeroY = toY(0);
  const knownResistanceX = toX(params.knownResistance);

  return (
    <div
      className="rounded-xl border p-4"
      style={{
        borderColor: pageStyle.border,
        backgroundColor: pageStyle.blockBg,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            关系图：按理想公式计算时的相对误差
          </div>
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
            曲线按真实电流表读数计算。虚线标出 Rx = R0，此处误差为 0；橙点是当前工作点。
          </div>
        </div>
        <div className="text-right text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
          <div>当前系统误差：{formatPercent(result.relativeErrorPercent)}</div>
          <div>已知 Ra 校正后：{formatResistance(result.correctedResistanceReal, 2)}</div>
        </div>
      </div>

      <div className="mt-4">
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
          <rect x="0" y="0" width={width} height={height} rx="12" fill="#FFFFFF" />

          {Array.from({ length: 7 }).map((_, index) => {
            const x = plotX + (plotW * index) / 6;
            return (
              <line
                key={`err-x-grid-${index}`}
                x1={x}
                y1={plotY}
                x2={x}
                y2={plotY + plotH}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}
          {Array.from({ length: 6 }).map((_, index) => {
            const y = plotY + (plotH * index) / 5;
            return (
              <line
                key={`err-y-grid-${index}`}
                x1={plotX}
                y1={y}
                x2={plotX + plotW}
                y2={y}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
            );
          })}

          <line x1={plotX} y1={zeroY} x2={plotX + plotW} y2={zeroY} stroke="#94A3B8" strokeDasharray="5 5" strokeWidth="1.4" />
          <line x1={knownResistanceX} y1={plotY} x2={knownResistanceX} y2={plotY + plotH} stroke="#2563EB" strokeDasharray="6 4" strokeWidth="1.4" />
          <line x1={currentX} y1={plotY} x2={currentX} y2={plotY + plotH} stroke="#D97706" strokeDasharray="6 4" strokeWidth="1.4" />

          <path d={buildPath((point) => point.relativeErrorPercent)} fill="none" stroke={COLORS.primary} strokeWidth="2.5" />

          <circle cx={currentX} cy={currentY} r="5.5" fill="#FFFFFF" stroke="#D97706" strokeWidth="2.4" />
          <text x={knownResistanceX + 10} y={zeroY - 8} fontSize="10" fill="#2563EB">
            Rx = R0，误差为 0
          </text>
          <text x={currentX + 10} y={currentY - 8} fontSize="10" fill="#D97706">
            当前点 {formatPercent(result.currentPoint.relativeErrorPercent)}
          </text>

          {Array.from({ length: 7 }).map((_, index) => {
            const value = xMin + ((xMax - xMin) * index) / 6;
            return (
              <text
                key={`err-x-tick-${index}`}
                x={plotX + (plotW * index) / 6}
                y={plotY + plotH + 18}
                textAnchor="middle"
                fontSize="10"
                fill={pageStyle.muted}
              >
                {value.toFixed(0)}
              </text>
            );
          })}
          {Array.from({ length: 6 }).map((_, index) => {
            const value = yMax - ((yMax - yMin) * index) / 5;
            return (
              <text
                key={`err-y-tick-${index}`}
                x={plotX - 8}
                y={plotY + (plotH * index) / 5 + 3}
                textAnchor="end"
                fontSize="10"
                fill={pageStyle.muted}
              >
                {value.toFixed(1)}%
              </text>
            );
          })}

          <text x={plotX + plotW / 2} y={height - 10} textAnchor="middle" fontSize="11" fill={pageStyle.muted}>
            Rx / Ω
          </text>
          <text x="18" y={plotY + plotH / 2} fontSize="11" fill={pageStyle.muted} transform={`rotate(-90 18 ${plotY + plotH / 2})`}>
            相对误差 / %
          </text>
        </svg>
      </div>
    </div>
  );
}

function BatterySymbol({
  x,
  top,
  bottom,
  stroke,
}: {
  x: number;
  top: number;
  bottom: number;
  stroke: string;
}) {
  const longPlateY = top + 6;
  const shortPlateY = top + 20;

  return (
    <>
      <line x1={x} y1={top} x2={x} y2={longPlateY} stroke={stroke} strokeWidth="2.2" />
      <line x1={x - 12} y1={longPlateY} x2={x + 12} y2={longPlateY} stroke={stroke} strokeWidth="2.3" />
      <line x1={x - 8} y1={shortPlateY} x2={x + 8} y2={shortPlateY} stroke={stroke} strokeWidth="1.8" />
      <line x1={x} y1={shortPlateY} x2={x} y2={bottom} stroke={stroke} strokeWidth="2.2" />
    </>
  );
}

function MeterSymbol({
  center,
  accent,
}: {
  center: { x: number; y: number };
  accent: string;
}) {
  return (
    <>
      <circle cx={center.x} cy={center.y} r="18" fill="#FFFFFF" stroke="#111827" strokeWidth="2" />
      <circle cx={center.x} cy={center.y} r="15" fill="none" stroke={accent} strokeWidth="1.8" />
      <text x={center.x} y={center.y + 5} textAnchor="middle" fontSize="16" fontWeight="700" fill="#111827">
        A
      </text>
    </>
  );
}

function ResistorSymbol({
  x,
  y,
  width,
  height,
  stroke,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  stroke: string;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill="#FFFFFF" stroke="#111827" strokeWidth="2" />
      <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6} fill="none" stroke={stroke} strokeWidth="1.7" />
    </>
  );
}

function CurrentResistanceCurrentArrow({
  x,
  y1,
  y2,
  color,
  label,
}: {
  x: number;
  y1: number;
  y2: number;
  color: string;
  label: string;
}) {
  return (
    <>
      <line x1={x} y1={y1} x2={x} y2={y2} stroke={color} strokeWidth="1.8" markerEnd="url(#currentResistanceArrow)" />
      <text x={x - 10} y={y1 - 6} textAnchor="end" fontSize="10.5" fill={color}>
        {label}
      </text>
    </>
  );
}

function CircuitDetailCard({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div
      className="rounded-lg border p-2.5"
      style={{ borderColor: '#11111122', backgroundColor: '#FFFFFF' }}
    >
      <div className="text-[11px] font-semibold" style={{ color: '#111111' }}>
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 text-xs font-semibold" style={{ color: pageStyle.text }}>
      {title}
    </div>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 mt-4 text-xs font-semibold" style={{ color: pageStyle.text }}>
      {title}
    </div>
  );
}

function ToggleGroup({
  options,
  value,
  onChange,
  compact = false,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
  compact?: boolean;
}) {
  return (
    <div
      className="flex rounded-lg p-1"
      style={{
        backgroundColor: pageStyle.blockSoft,
        border: `1px solid ${pageStyle.border}`,
      }}
    >
      {options.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            className={`flex-1 rounded-md ${compact ? 'px-2.5 py-1.5 text-[10px]' : 'px-3 py-2 text-xs'} font-medium`}
            style={{
              color: active ? pageStyle.accent : pageStyle.secondary,
              backgroundColor: active ? pageStyle.accentSoft : 'transparent',
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium" style={{ color: pageStyle.secondary }}>
          {label}
        </span>
        <span className="text-[11px]" style={{ color: pageStyle.text }}>
          {formatRangeValue(value)}{unit ? ` ${unit}` : ''}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full"
        style={{
          background: `linear-gradient(90deg, ${COLORS.primary} 0%, ${COLORS.primary} ${((value - min) / Math.max(max - min, 1e-9)) * 100}%, #E5E7EB ${((value - min) / Math.max(max - min, 1e-9)) * 100}%, #E5E7EB 100%)`,
        }}
      />
    </div>
  );
}

function PresetButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1 text-[10px] font-medium"
      style={{
        color: pageStyle.accent,
        backgroundColor: pageStyle.accentSoft,
      }}
    >
      {label}
    </button>
  );
}

function CurrentResistanceMeasurementTable({
  activeSet,
}: {
  activeSet: CurrentResistanceMeasurementSet;
}) {
  const rows = [
    {
      label: '测 R0 支路',
      reading: formatCurrent(activeSet.knownMeasurement.displayedCurrent),
      idealReading: formatCurrent(activeSet.knownMeasurement.idealDisplayedCurrent),
      branchResistance: formatResistance(activeSet.knownMeasurement.measuredBranchResistance, 2),
      totalCurrent: formatCurrent(activeSet.knownMeasurement.totalCurrent),
    },
    {
      label: '测 Rx 支路',
      reading: formatCurrent(activeSet.unknownMeasurement.displayedCurrent),
      idealReading: formatCurrent(activeSet.unknownMeasurement.idealDisplayedCurrent),
      branchResistance: formatResistance(activeSet.unknownMeasurement.measuredBranchResistance, 2),
      totalCurrent: formatCurrent(activeSet.unknownMeasurement.totalCurrent),
    },
  ];

  return (
    <div className="mb-3 overflow-hidden rounded-xl border" style={{ borderColor: pageStyle.border }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ backgroundColor: pageStyle.blockSoft }}>
            {['测量', 'A表读数', '理想读数', '支路总阻值', '回路总电流'].map((label) => (
              <th
                key={label}
                className="px-2 py-2 text-left"
                style={{ color: pageStyle.secondary, borderBottom: `1px solid ${pageStyle.border}` }}
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.label} style={{ backgroundColor: index % 2 === 0 ? pageStyle.blockBg : pageStyle.blockSoft }}>
              <td className="px-2 py-2" style={{ color: pageStyle.text, fontWeight: 600 }}>
                {row.label}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {row.reading}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.secondary }}>
                {row.idealReading}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {row.branchResistance}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {row.totalCurrent}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CurrentResistanceSummaryTable({
  params,
  result,
  activeSet,
}: {
  params: CurrentResistanceMethodParams;
  result: CurrentResistanceMethodResult;
  activeSet: CurrentResistanceMeasurementSet;
}) {
  const rows = [
    ['当前 A 表位置', CURRENT_RESISTANCE_TARGET_META[params.measurementTarget].label],
    ['当前示数', formatCurrent(activeSet.activeMeasurement.displayedCurrent)],
    ['真值 Rx', formatResistance(params.unknownResistance, 2)],
    ['理想推算', formatResistance(result.inferredResistanceIdeal, 2)],
    ['当前系统推算', formatResistance(activeSet.inferredResistance, 2)],
    ['已知 Ra 校正', formatResistance(result.correctedResistanceReal, 2)],
    ['相对误差', formatPercent(activeSet.relativeErrorPercent)],
  ];

  return (
    <div className="mb-3 overflow-hidden rounded-xl border" style={{ borderColor: pageStyle.border }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 11 }}>
        <tbody>
          {rows.map(([label, value], index) => (
            <tr key={label} style={{ backgroundColor: index % 2 === 0 ? pageStyle.blockBg : pageStyle.blockSoft }}>
              <td
                className="px-2 py-2"
                style={{
                  width: '44%',
                  color: pageStyle.secondary,
                  borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${pageStyle.border}`,
                }}
              >
                {label}
              </td>
              <td
                className="px-2 py-2"
                style={{
                  color: pageStyle.text,
                  fontWeight: 600,
                  borderBottom: index === rows.length - 1 ? 'none' : `1px solid ${pageStyle.border}`,
                }}
              >
                {value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FormulaLine({ children }: { children: ReactNode }) {
  return (
    <div
      className="mt-1 text-[11px]"
      style={{
        color: pageStyle.secondary,
        lineHeight: 1.7,
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
      }}
    >
      {children}
    </div>
  );
}

function ChartLegend({
  items,
}: {
  items: Array<{ color: string; label: string; dash?: string }>;
}) {
  return (
    <div className="flex flex-wrap justify-end gap-x-3 gap-y-1">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            <line
              x1="1"
              y1="4"
              x2="17"
              y2="4"
              stroke={item.color}
              strokeWidth="2.2"
              strokeDasharray={item.dash}
            />
          </svg>
          <span className="text-[10px]" style={{ color: pageStyle.muted }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function formatVoltage(value: number): string {
  return `${value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, '')} V`;
}

function formatResistance(value: number, digits = 1): string {
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(digits)} kΩ`;
  }
  return `${value.toFixed(digits)} Ω`;
}

function formatCurrent(value: number): string {
  if (Math.abs(value) >= 1) {
    return `${value.toFixed(2)} A`;
  }
  if (Math.abs(value) >= 0.01) {
    return `${value.toFixed(3)} A`;
  }
  return `${(value * 1000).toFixed(1)} mA`;
}

function formatPercent(value: number): string {
  const normalized = Number.isFinite(value) ? value : 0;
  return `${normalized >= 0 ? '+' : ''}${normalized.toFixed(2)}%`;
}

function formatRangeValue(value: number): string {
  if (Math.abs(value) >= 100) return value.toFixed(0);
  if (Math.abs(value) >= 10) return value.toFixed(1).replace(/\.0$/, '');
  return value.toFixed(2).replace(/0$/, '').replace(/\.$/, '');
}
