import { useMemo, useState, type ReactNode } from 'react';
import { COLORS } from '@/styles/tokens';
import {
  buildHalfDeflectionCurve,
  calculateAmmeterHalfDeflection,
  calculateVoltmeterHalfDeflection,
  getHalfDeflectionAssumption,
  getHalfDeflectionModeLabel,
  type HalfDeflectionCurvePoint,
  type HalfDeflectionMode,
} from '@/domains/em/logic/half-deflection-calculator';

interface HalfDeflectionPageParams {
  emf: number;
  sourceInternalResistance: number;
  meterResistance: number;
  maxResistance: number;
  sliderRatio: number;
  halfResistance: number;
}

const DEFAULT_PARAMS: Record<HalfDeflectionMode, HalfDeflectionPageParams> = {
  ammeter: {
    emf: 6,
    sourceInternalResistance: 0.2,
    meterResistance: 0.2,
    maxResistance: 20,
    sliderRatio: 0.4,
    halfResistance: 0.2,
  },
  voltmeter: {
    emf: 6,
    sourceInternalResistance: 0,
    meterResistance: 3000,
    maxResistance: 3000,
    sliderRatio: 0.5,
    halfResistance: 3000,
  },
};

const META = {
  ammeter: { color: '#D97706', note: '理想条件：干路电流近似不变。' },
  voltmeter: { color: '#059669', note: '理想条件：分压近似不变。' },
} as const;

const pageStyle = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: COLORS.bg,
  blockBg: COLORS.bg,
  blockSoft: COLORS.bgMuted,
  border: COLORS.border,
  borderStrong: COLORS.borderStrong,
  text: COLORS.text,
  muted: COLORS.textMuted,
  secondary: COLORS.textSecondary,
  accent: COLORS.primary,
  accentSoft: COLORS.primaryLight,
};

interface Props {
  onBack: () => void;
  onOpenPreset: (mode: HalfDeflectionMode) => void;
}

interface HalfDeflectionViewResult {
  rheostatResistance: number;
  baseline: ReturnType<typeof calculateAmmeterHalfDeflection>;
  current: ReturnType<typeof calculateAmmeterHalfDeflection>;
  curve: HalfDeflectionCurvePoint[];
}

interface CircuitToggleOption {
  value: string;
  label: string;
}

interface DetailRow {
  label: string;
  value: string;
  accent?: string;
}

export function HalfDeflectionComparisonView({ onBack, onOpenPreset }: Props) {
  const [mode, setMode] = useState<HalfDeflectionMode>('ammeter');
  const [paramsByMode, setParamsByMode] = useState<Record<HalfDeflectionMode, HalfDeflectionPageParams>>(DEFAULT_PARAMS);

  const params = paramsByMode[mode];

  const result = useMemo(() => {
    const rheostatResistance = params.maxResistance * params.sliderRatio;
    const calcParams = {
      emf: params.emf,
      sourceInternalResistance: params.sourceInternalResistance,
      rheostatResistance,
      meterResistance: params.meterResistance,
      halfResistance: params.halfResistance,
    };

    const baseline =
      mode === 'ammeter'
        ? calculateAmmeterHalfDeflection(calcParams, false)
        : calculateVoltmeterHalfDeflection(calcParams, true);
    const current =
      mode === 'ammeter'
        ? calculateAmmeterHalfDeflection(calcParams, true)
        : calculateVoltmeterHalfDeflection(calcParams, false);
    const curve = buildHalfDeflectionCurve(
      mode,
      {
        emf: params.emf,
        sourceInternalResistance: params.sourceInternalResistance,
        rheostatResistance: params.maxResistance,
        meterResistance: params.meterResistance,
      },
      61,
    );

    return {
      rheostatResistance,
      baseline,
      current,
      curve,
    };
  }, [mode, params]);

  const setParam = (key: keyof HalfDeflectionPageParams, value: number) => {
    setParamsByMode((prev) => ({
      ...prev,
      [mode]: {
        ...prev[mode],
        [key]: value,
      },
    }));
  };

  const applyHalfResistance = (value: number) => {
    setParam('halfResistance', value);
  };

  const resetCurrentMode = () => {
    setParamsByMode((prev) => ({ ...prev, [mode]: DEFAULT_PARAMS[mode] }));
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ backgroundColor: pageStyle.pageBg }}>
      <header
        className="flex items-center gap-3 px-5 py-2.5"
        style={{ borderBottom: `1px solid ${pageStyle.border}`, backgroundColor: pageStyle.panelBg }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 text-xs font-medium"
          style={{ color: pageStyle.text, border: `1px solid ${pageStyle.border}`, backgroundColor: pageStyle.blockBg }}
        >
          ← 返回
        </button>
        <button
          onClick={() => onOpenPreset(mode)}
          className="px-3 py-1 text-xs font-medium"
          style={{
            color: pageStyle.accent,
            border: `1px solid ${pageStyle.accent}55`,
            backgroundColor: pageStyle.accentSoft,
          }}
        >
          进入原实验
        </button>
        <h1 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
          半偏法测内阻 · 理想与真实对比
        </h1>
        <span className="text-[11px]" style={{ color: pageStyle.muted }}>
          调节滑动变阻器，观察理想实验与真实实验误差如何变化
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <HalfLeftPanel
          mode={mode}
          params={params}
          onChangeMode={setMode}
          onChangeParam={setParam}
          onReset={resetCurrentMode}
          onOpenPreset={() => onOpenPreset(mode)}
        />
        <HalfCenterPanel
          mode={mode}
          params={params}
          result={result}
          onApplyHalfResistance={applyHalfResistance}
        />
        <HalfRightPanel mode={mode} result={result} />
      </div>
    </div>
  );
}

function HalfLeftPanel({
  mode,
  params,
  onChangeMode,
  onChangeParam,
  onReset,
  onOpenPreset,
}: {
  mode: HalfDeflectionMode;
  params: HalfDeflectionPageParams;
  onChangeMode: (mode: HalfDeflectionMode) => void;
  onChangeParam: (key: keyof HalfDeflectionPageParams, value: number) => void;
  onReset: () => void;
  onOpenPreset: () => void;
}) {
  return (
    <div
      className="flex w-[280px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: pageStyle.panelSoft, borderRight: `1px solid ${pageStyle.border}` }}
    >
      <div className="p-4">
        <div className="mb-4 flex rounded-lg p-1" style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}>
          {(['ammeter', 'voltmeter'] as HalfDeflectionMode[]).map((item) => {
            const active = item === mode;
            return (
              <button
                key={item}
                onClick={() => onChangeMode(item)}
                className="flex-1 rounded-md px-3 py-2 text-xs font-medium"
                style={{
                  color: active ? pageStyle.accent : pageStyle.secondary,
                  backgroundColor: active ? pageStyle.accentSoft : 'transparent',
                }}
              >
                {getHalfDeflectionModeLabel(item)}
              </button>
            );
          })}
        </div>

        <div
          className="mb-4 rounded-lg p-3"
          style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
        >
          <div className="text-xs font-semibold" style={{ color: pageStyle.text }}>
            当前模式
          </div>
          <div className="mt-1 text-[16px] font-semibold" style={{ color: META[mode].color }}>
            {getHalfDeflectionModeLabel(mode)}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            {getHalfDeflectionAssumption(mode)} 滑动变阻器阻值变化会改变真实实验误差，图上会同步标记当前点。
          </div>
        </div>

        <SectionTitle title="参数控制" />
        <RangeControl label="电动势 ε" value={params.emf} min={1} max={12} step={0.1} unit="V" onChange={(value) => onChangeParam('emf', value)} />
        <RangeControl
          label="电源内阻 r"
          value={params.sourceInternalResistance}
          min={mode === 'ammeter' ? 0 : 0}
          max={mode === 'ammeter' ? 2 : 1000}
          step={mode === 'ammeter' ? 0.05 : 10}
          unit="Ω"
          onChange={(value) => onChangeParam('sourceInternalResistance', value)}
        />
        <RangeControl
          label={mode === 'ammeter' ? '电流表内阻' : '电压表内阻'}
          value={params.meterResistance}
          min={mode === 'ammeter' ? 0.05 : 1000}
          max={mode === 'ammeter' ? 1 : 12000}
          step={mode === 'ammeter' ? 0.01 : 100}
          unit="Ω"
          onChange={(value) => onChangeParam('meterResistance', value)}
        />
        <RangeControl
          label="滑动变阻器最大阻值"
          value={params.maxResistance}
          min={mode === 'ammeter' ? 5 : 500}
          max={mode === 'ammeter' ? 50 : 6000}
          step={mode === 'ammeter' ? 1 : 100}
          unit="Ω"
          onChange={(value) => onChangeParam('maxResistance', value)}
        />
        <RangeControl
          label="滑片位置"
          value={params.sliderRatio}
          min={0}
          max={1}
          step={0.01}
          unit=""
          onChange={(value) => onChangeParam('sliderRatio', value)}
        />
        <RangeControl
          label="当前 R'"
          value={params.halfResistance}
          min={0}
          max={mode === 'ammeter' ? 2 : 15000}
          step={mode === 'ammeter' ? 0.01 : 100}
          unit="Ω"
          onChange={(value) => onChangeParam('halfResistance', value)}
        />

        <div className="mt-4 flex flex-wrap gap-2">
          <PresetButton label="恢复默认" onClick={onReset} />
          <PresetButton label="打开原实验" onClick={onOpenPreset} />
        </div>
      </div>
    </div>
  );
}

function HalfCenterPanel({
  mode,
  params,
  result,
  onApplyHalfResistance,
}: {
  mode: HalfDeflectionMode;
  params: HalfDeflectionPageParams;
  result: HalfDeflectionViewResult;
  onApplyHalfResistance: (value: number) => void;
}) {
  const readingLabel = mode === 'ammeter' ? 'I' : 'U';
  const readingText = mode === 'ammeter' ? formatCurrent : formatVoltage;
  const currentMeta = META[mode];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ backgroundColor: pageStyle.panelBg }}>
      <div className="grid grid-cols-1 gap-3 p-4 xl:grid-cols-2 2xl:grid-cols-3">
        {mode === 'ammeter' ? (
          <StandardAmmeterCircuitCard
            result={result}
            onApplyHalfResistance={onApplyHalfResistance}
          />
        ) : (
          <StandardVoltmeterCircuitCard
            result={result}
            onApplyHalfResistance={onApplyHalfResistance}
          />
        )}
        <ComparisonCard
          title="理想实验"
          color="#2563EB"
          className="2xl:col-span-1"
          lines={[
            currentMeta.note,
            `${readingLabel}0 = ${readingText(result.baseline.referenceReading)}`,
            `${readingLabel}0/2 = ${readingText(result.baseline.targetHalfReading)}`,
            `理想测得内阻 = ${formatResistance(result.current.idealHalfResistance, mode === 'ammeter' ? 2 : 0)}`,
          ]}
        />
        <ComparisonCard
          title="真实实验"
          color={currentMeta.color}
          className="2xl:col-span-1"
          lines={[
            `当前滑动变阻器 = ${formatResistance(result.rheostatResistance, mode === 'ammeter' ? 1 : 0)}`,
            `真实半偏值 = ${formatResistance(result.current.exactHalfResistance, mode === 'ammeter' ? 2 : 0)}`,
            `理论误差 = ${formatSignedPercent(result.current.realErrorPercent)}`,
            `当前示数 = ${readingText(result.current.meterReading)}`,
          ]}
        />
      </div>

      <div className="px-4 pb-4">
        <div className="rounded-xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                误差随滑动变阻器阻值变化
              </div>
              <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
                蓝色虚线表示理想实验误差为 0，彩色实线表示真实实验误差。当前滑片位置会在曲线上高亮。
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <PresetButton
                label="设 R' = 理想值"
                onClick={() => onApplyHalfResistance(result.current.idealHalfResistance)}
              />
              <PresetButton
                label="设 R' = 真实值"
                onClick={() => onApplyHalfResistance(result.current.exactHalfResistance)}
              />
            </div>
          </div>
          <div className="mt-4">
            <HalfDeflectionCurveChart
              mode={mode}
              maxResistance={params.maxResistance}
              currentRheostatResistance={result.rheostatResistance}
              currentTheoreticalError={result.current.realErrorPercent}
              curve={result.curve}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function HalfRightPanel({
  mode,
  result,
}: {
  mode: HalfDeflectionMode;
  result: HalfDeflectionViewResult;
}) {
  const readingText = mode === 'ammeter' ? formatCurrent : formatVoltage;

  return (
    <div
      className="flex w-[320px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: pageStyle.panelBg, borderLeft: `1px solid ${pageStyle.border}` }}
    >
      <div className="p-3">
        <PanelTitle title="当前判读" />
        <KeyValueInfoBlock
          title="当前实验状态"
          color={META[mode].color}
          rows={[
            { label: '当前滑变阻值', value: formatResistance(result.rheostatResistance, mode === 'ammeter' ? 1 : 0) },
            { label: '目标半偏', value: readingText(result.current.targetHalfReading) },
            { label: '当前示数', value: readingText(result.current.meterReading), accent: META[mode].color },
            {
              label: '状态',
              value: result.current.isHalfDeflection ? "已达到半偏，可直接记录当前 R'" : "尚未达到半偏，可继续调 R'",
              accent: result.current.isHalfDeflection ? META[mode].color : undefined,
            },
          ]}
        />
        <KeyValueInfoBlock
          title="理想值与真实值"
          color="#2563EB"
          rows={[
            { label: '理想测得内阻', value: formatResistance(result.current.idealHalfResistance, mode === 'ammeter' ? 2 : 0) },
            { label: '真实半偏值', value: formatResistance(result.current.exactHalfResistance, mode === 'ammeter' ? 2 : 0) },
            { label: "按当前 R' 估算误差", value: formatSignedPercent(result.current.currentErrorPercent) },
            { label: '滑变阻理论误差', value: formatSignedPercent(result.current.realErrorPercent) },
          ]}
        />
      </div>

      <div className="px-3 pb-3">
        <PanelTitle title="教学结论" />
        <div
          className="rounded-xl border p-3"
          style={{ borderColor: `${META[mode].color}55`, backgroundColor: `${META[mode].color}10` }}
        >
          <div className="text-xs font-semibold" style={{ color: META[mode].color }}>
            {mode === 'ammeter' ? '电流表半偏' : '电压表半偏'}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
            {mode === 'ammeter'
              ? '滑动变阻器越大，干路总电阻越大，真实半偏值逐渐逼近理想值，误差减小。'
              : '滑动变阻器越大，额外分压越明显，真实半偏值偏离理想值更多，误差增大。'}
          </div>
        </div>
      </div>

      <div className="px-3 pb-4" style={{ borderTop: `1px solid ${pageStyle.border}`, paddingTop: 12 }}>
        <PanelTitle title="关键公式" />
        {mode === 'ammeter' ? (
          <TextInfoBlock
            title="电流表半偏"
            color={META[mode].color}
            lines={[
              "理想：R' ≈ rA",
              "真实：R' = rA(R滑+r电源)/(R滑+r电源+rA)",
              'R滑增大时，误差逐渐减小',
            ]}
          />
        ) : (
          <TextInfoBlock
            title="电压表半偏"
            color={META[mode].color}
            lines={[
              "理想：R' ≈ rV",
              "真实：R' = R滑 + r电源 + rV",
              'R滑增大时，误差逐渐增大',
            ]}
          />
        )}
      </div>
    </div>
  );
}

function StandardCircuitCardFrame({
  subtitle,
  toggleOptions,
  activeValue,
  onChange,
  children,
  conclusion,
  status,
}: {
  subtitle: string;
  toggleOptions: CircuitToggleOption[];
  activeValue: string;
  onChange: (value: string) => void;
  children: ReactNode;
  conclusion: ReactNode;
  status: ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-3 xl:col-span-2 2xl:col-span-1"
      style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            标准电路图
          </div>
          <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
            {subtitle}
          </div>
        </div>
        <div
          className="flex rounded-lg p-1"
          style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
        >
          {toggleOptions.map((item) => {
            const active = item.value === activeValue;
            return (
              <button
                key={item.value}
                onClick={() => onChange(item.value)}
                className="rounded-md px-2.5 py-1 text-[10px] font-medium"
                style={{
                  color: active ? pageStyle.text : pageStyle.secondary,
                  backgroundColor: active ? pageStyle.blockBg : 'transparent',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border" style={{ borderColor: pageStyle.border }}>
        {children}
      </div>

      <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
        <CircuitDetailCard title="核心结论">{conclusion}</CircuitDetailCard>
        <CircuitDetailCard title="当前状态">{status}</CircuitDetailCard>
      </div>
    </div>
  );
}

function CircuitDetailCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: '#11111122', backgroundColor: '#FFFFFF' }}>
      <div className="text-[11px] font-semibold" style={{ color: '#111111' }}>
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function StandardAmmeterCircuitCard({
  result,
  onApplyHalfResistance,
}: {
  result: HalfDeflectionViewResult;
  onApplyHalfResistance: (value: number) => void;
}) {
  const [branchClosed, setBranchClosed] = useState(false);
  const circuitWidth = 440;
  const circuitHeight = 280;
  const activeResult = branchClosed ? result.current : result.baseline;
  const totalCurrent = Math.max(activeResult.totalCurrent, 1e-9);
  const meterCurrent = branchClosed ? result.current.meterReading : result.baseline.meterReading;
  const shuntCurrent = branchClosed ? result.current.auxiliaryCurrent : 0;
  const isBalanced = branchClosed && result.current.isHalfDeflection;
  const branchMessage = branchClosed ? "调 R' 使电流表半偏 I0/2" : '调到满偏 I0';
  const currentEqualityMessage = branchClosed ? (isBalanced ? "I_g = I_R'" : "目标：I_g = I_R'") : '主回路电流为 I0';
  const currentStroke = '#B45309';
  const activeWire = '#111111';
  const inactiveWire = '#9CA3AF';

  const leadSegments = ['M52 96 V70', 'M52 210 V132', 'M52 70 H282', 'M282 210 H52'];
  const meterBranchPath = 'M282 70 V210';
  const shuntBranchPath = 'M282 70 H362 V210 H282';

  const meterStrokeWidth = branchClosed ? 1.8 + (meterCurrent / totalCurrent) * 3 : 4.8;
  const shuntStrokeWidth = branchClosed ? 1.8 + (shuntCurrent / totalCurrent) * 3 : 0;
  const summaryRows: DetailRow[] = branchClosed
    ? [
        { label: 'S2 状态', value: "已闭合，R' 支路接入" },
        { label: 'I_g', value: formatCurrent(meterCurrent), accent: currentStroke },
        { label: "I_R'", value: formatCurrent(shuntCurrent), accent: currentStroke },
        {
          label: '当前判定',
          value: isBalanced ? "当前已半偏，I_g = I_R'" : "继续调节 R'，直到 I_g = I_R'",
          accent: isBalanced ? '#92400E' : undefined,
        },
      ]
    : [
        { label: 'S2 状态', value: '已断开，先调主回路满偏' },
        { label: '电流表示数', value: `${formatCurrent(result.baseline.meterReading)} = I0`, accent: currentStroke },
        { label: "R' 支路", value: '无电流' },
      ];

  return (
    <StandardCircuitCardFrame
      subtitle="教材接法：主回路串联，S2 控制 R' 并联支路接入。"
      toggleOptions={[
        { value: 'open', label: 'S2 断开' },
        { value: 'closed', label: 'S2 闭合' },
      ]}
      activeValue={branchClosed ? 'closed' : 'open'}
      onChange={(value) => setBranchClosed(value === 'closed')}
      conclusion={
        <>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
            当电流表半偏时：R' = Rg
          </div>
          <div className="text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            教材近似下成立；当前真实模型的严格半偏值为 {formatResistance(result.current.exactHalfResistance, 2)}。
          </div>
        </>
      }
      status={
        <>
          <KeyValueList rows={summaryRows} />
          {branchClosed && !isBalanced && (
            <button
              onClick={() => onApplyHalfResistance(result.current.exactHalfResistance)}
              className="mt-2 rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{
                backgroundColor: pageStyle.accentSoft,
                color: pageStyle.accent,
                border: `1px solid ${pageStyle.accent}33`,
              }}
            >
              设 R' = 当前真实半偏值
            </button>
          )}
        </>
      }
    >
      <svg viewBox={`0 0 ${circuitWidth} ${circuitHeight}`} style={{ width: '100%', display: 'block', backgroundColor: '#FFFFFF' }}>
        <rect x="0" y="0" width={circuitWidth} height={circuitHeight} fill="#FFFFFF" />

        <g stroke="#111111" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M52 70 V96" />
          <path d="M52 132 V210 H282" />
          <path d="M52 70 H86" />
          <path d="M122 70 H146" />
          <path d="M226 70 H282" />
          <path d="M282 70 V114" />
          <path d="M282 166 V210" />
          <path d="M282 70 H316" opacity={branchClosed ? 1 : 0.28} />
          <path d="M352 70 H362 V118" opacity={branchClosed ? 1 : 0.28} />
          <path d="M362 166 V210 H282" opacity={branchClosed ? 1 : 0.28} />
        </g>

        <g style={{ cursor: 'help' }}>
          <title>电源 E：为实验提供电动势。</title>
          <line x1="34" y1="104" x2="70" y2="104" stroke="#111111" strokeWidth="2.4" />
          <line x1="42" y1="124" x2="62" y2="124" stroke="#111111" strokeWidth="2.4" />
          <text x="18" y="116" fontSize="14" fill="#111111" fontWeight="600">
            E
          </text>
        </g>

        <g style={{ cursor: 'help' }}>
          <title>S1：主开关，控制主回路通断。</title>
          <circle cx="86" cy="70" r="2.8" fill="#111111" />
          <circle cx="122" cy="70" r="2.8" fill="#111111" />
          <line x1="86" y1="70" x2="122" y2="70" stroke="#111111" strokeWidth="2.2" />
          <text x="92" y="53" fontSize="12" fill="#111111">
            S1
          </text>
        </g>

        <g style={{ cursor: 'help' }}>
          <title>滑动变阻器 R：采用限流接法，调节主回路总电阻。</title>
          <rect x="146" y="61" width="80" height="18" stroke="#111111" strokeWidth="2.2" fill="#FFFFFF" />
          <line x1="154" y1="92" x2="206" y2="56" stroke="#111111" strokeWidth="2" />
          <path d="M206 56 L199 57 L202 63" stroke="#111111" strokeWidth="2" />
          <text x="171" y="48" fontSize="12" fill="#111111">
            R
          </text>
          <text x="150" y="108" fontSize="10" fill="#4B5563">
            限流
          </text>
        </g>

        <g style={{ cursor: 'help' }}>
          <title>电流表 G：待测内阻为 Rg。</title>
          <circle cx="282" cy="140" r="26" stroke="#111111" strokeWidth="2.2" fill="#FFFFFF" />
          <text x="282" y="145" textAnchor="middle" fontSize="16" fill="#111111" fontWeight="600">
            G
          </text>
          <text x="282" y="182" textAnchor="middle" fontSize="11" fill="#111111">
            待测 Rg
          </text>
        </g>

        <g style={{ cursor: 'help' }} opacity={branchClosed ? 1 : 0.42}>
          <title>S2：控制 R' 支路的接入与断开。</title>
          <circle cx="316" cy="70" r="2.8" fill="#111111" />
          <circle cx="352" cy="70" r="2.8" fill="#111111" />
          {branchClosed ? (
            <line x1="316" y1="70" x2="352" y2="70" stroke="#111111" strokeWidth="2.2" />
          ) : (
            <line x1="316" y1="70" x2="347" y2="58" stroke="#111111" strokeWidth="2.2" />
          )}
          <text x="323" y="53" fontSize="12" fill="#111111">
            S2
          </text>
        </g>

        <g style={{ cursor: 'help' }} opacity={branchClosed ? 1 : 0.42}>
          <title>电阻箱 R'：闭合 S2 后与电流表 G 并联，用于调到半偏。</title>
          <rect x="348" y="118" width="28" height="48" stroke="#111111" strokeWidth="2.2" fill="#FFFFFF" />
          <text x="390" y="146" fontSize="12" fill="#111111">
            R'
          </text>
        </g>

        <circle cx="282" cy="70" r="3.2" fill="#111111" />
        <circle cx="282" cy="210" r="3.2" fill="#111111" />

        {leadSegments.map((segment) => (
          <path
            key={segment}
            d={segment}
            fill="none"
            stroke={branchClosed ? activeWire : '#111111'}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        <path
          d={meterBranchPath}
          fill="none"
          stroke={activeWire}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {branchClosed && (
          <path
            d={shuntBranchPath}
            fill="none"
            stroke={inactiveWire}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {leadSegments.map((segment) => (
          <path
            key={`${segment}-flow`}
            d={segment}
            fill="none"
            stroke={currentStroke}
            strokeWidth="2.4"
            strokeDasharray="8 10"
            strokeLinecap="round"
            opacity="0.9"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-36" dur="1.2s" repeatCount="indefinite" />
          </path>
        ))}

        <path
          d={meterBranchPath}
          fill="none"
          stroke={currentStroke}
          strokeWidth={meterStrokeWidth}
          strokeDasharray="8 10"
          strokeLinecap="round"
          opacity="0.95"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-34" dur="1.1s" repeatCount="indefinite" />
        </path>

        {branchClosed && (
          <path
            d={shuntBranchPath}
            fill="none"
            stroke={currentStroke}
            strokeWidth={shuntStrokeWidth}
            strokeDasharray="8 10"
            strokeLinecap="round"
            opacity="0.92"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-34" dur="1.1s" repeatCount="indefinite" />
          </path>
        )}

        <text x="250" y="136" fontSize="11" fill="#92400E">
          Ig
        </text>
        {branchClosed && (
          <text x="372" y="110" fontSize="11" fill="#92400E">
            IR'
          </text>
        )}

        <rect x="100" y="226" width="240" height="38" rx="8" fill="#FFFFFF" stroke="#D1D5DB" />
        <text x="220" y="242" textAnchor="middle" fontSize="12" fill="#111111" fontWeight="600">
          {branchMessage}
        </text>
        <text x="220" y="257" textAnchor="middle" fontSize="11" fill={isBalanced ? '#92400E' : '#4B5563'}>
          {currentEqualityMessage}
        </text>
      </svg>
    </StandardCircuitCardFrame>
  );
}

function StandardVoltmeterCircuitCard({
  result,
  onApplyHalfResistance,
}: {
  result: HalfDeflectionViewResult;
  onApplyHalfResistance: (value: number) => void;
}) {
  const [bypassClosed, setBypassClosed] = useState(true);
  const circuitWidth = 440;
  const circuitHeight = 280;
  const isBalanced = !bypassClosed && result.current.isHalfDeflection;
  const voltageLabel = bypassClosed ? 'U0' : isBalanced ? 'U0/2' : 'U';
  const currentStroke = '#B45309';
  const activeWire = '#111111';
  const inactiveWire = '#9CA3AF';
  const branchMessage = bypassClosed ? "闭合 S2，先记录基准电压 U0" : "断开 S2，调 R' 使电压表半偏";
  const voltageMessage = bypassClosed ? 'R\' 被短接，电压表直接读 U0' : isBalanced ? '当前已半偏，U = U0/2' : '目标：U = U0/2';
  const summaryRows: DetailRow[] = bypassClosed
    ? [
        { label: 'S2 状态', value: "已闭合，R' 被短接" },
        { label: '当前电压', value: `${formatVoltage(result.baseline.meterReading)} = U0`, accent: currentStroke },
        { label: '目标半偏', value: formatVoltage(result.current.targetHalfReading) },
        { label: "当前 R'", value: formatResistance(result.current.currentHalfResistance, 0) },
      ]
    : [
        { label: 'S2 状态', value: "已断开，R' 与 V 串联分压" },
        { label: '当前电压', value: formatVoltage(result.current.meterReading), accent: currentStroke },
        { label: '目标半偏', value: formatVoltage(result.current.targetHalfReading) },
        { label: "当前 R'", value: formatResistance(result.current.currentHalfResistance, 0) },
        {
          label: '当前判定',
          value: isBalanced ? '当前已达到半偏，U = U0/2' : "尚未达到半偏，继续调节 R'",
          accent: isBalanced ? '#92400E' : undefined,
        },
      ];

  const commonSegments = [
    'M52 96 V70',
    'M52 210 V132',
    'M52 70 H86',
    'M122 70 H146',
    'M226 70 H258',
    'M356 140 H408',
    'M408 140 H390 V210 H52',
  ];
  const activeBranchPath = bypassClosed ? 'M258 70 H340 V140 H356' : 'M258 70 V130 H340 V140 H356';

  return (
    <StandardCircuitCardFrame
      subtitle="教材接法：先读 U0，再用 S2 改变接法，让 R' 串联分压使电压表半偏。"
      toggleOptions={[
        { value: 'closed', label: 'S2 闭合' },
        { value: 'open', label: 'S2 断开' },
      ]}
      activeValue={bypassClosed ? 'closed' : 'open'}
      onChange={(value) => setBypassClosed(value === 'closed')}
      conclusion={
        <>
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
            当电压表半偏时：R' = Rv
          </div>
          <div className="text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            教材近似下成立；当前真实模型的严格半偏值为 {formatResistance(result.current.exactHalfResistance, 0)}。
          </div>
        </>
      }
      status={
        <>
          <KeyValueList rows={summaryRows} />
          {!bypassClosed && !isBalanced && (
            <button
              onClick={() => onApplyHalfResistance(result.current.exactHalfResistance)}
              className="mt-2 rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{
                backgroundColor: pageStyle.accentSoft,
                color: pageStyle.accent,
                border: `1px solid ${pageStyle.accent}33`,
              }}
            >
              设 R' = 当前真实半偏值
            </button>
          )}
        </>
      }
    >
      <svg viewBox={`0 0 ${circuitWidth} ${circuitHeight}`} style={{ width: '100%', display: 'block', backgroundColor: '#FFFFFF' }}>
        <rect x="0" y="0" width={circuitWidth} height={circuitHeight} fill="#FFFFFF" />

        <g stroke="#111111" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="M52 70 V96" />
          <path d="M52 132 V210 H390" />
          <path d="M52 70 H86" />
          <path d="M122 70 H146" />
          <path d="M226 70 H258" />
          <path d="M258 70 V130" />
          <path d="M340 70 V140 H356" />
          <path d="M408 140 H390 V210" />
          <path d="M258 70 H274" opacity={bypassClosed ? 1 : 0.28} />
          <path d="M310 70 H340" opacity={bypassClosed ? 1 : 0.28} />
          <path d="M258 130 H270" opacity={bypassClosed ? 0.42 : 1} />
          <path d="M328 130 H340" opacity={bypassClosed ? 0.42 : 1} />
        </g>

        <g style={{ cursor: 'help' }}>
          <title>电源 E：为实验提供电动势。</title>
          <line x1="34" y1="104" x2="70" y2="104" stroke="#111111" strokeWidth="2.4" />
          <line x1="42" y1="124" x2="62" y2="124" stroke="#111111" strokeWidth="2.4" />
          <text x="18" y="116" fontSize="14" fill="#111111" fontWeight="600">
            E
          </text>
        </g>

        <g style={{ cursor: 'help' }}>
          <title>S1：主开关，控制主回路通断。</title>
          <circle cx="86" cy="70" r="2.8" fill="#111111" />
          <circle cx="122" cy="70" r="2.8" fill="#111111" />
          <line x1="86" y1="70" x2="122" y2="70" stroke="#111111" strokeWidth="2.2" />
          <text x="92" y="53" fontSize="12" fill="#111111">
            S1
          </text>
        </g>

        <g style={{ cursor: 'help' }}>
          <title>滑动变阻器 R：采用限流接法，调节主回路总电阻。</title>
          <rect x="146" y="61" width="80" height="18" stroke="#111111" strokeWidth="2.2" fill="#FFFFFF" />
          <line x1="154" y1="92" x2="206" y2="56" stroke="#111111" strokeWidth="2" />
          <path d="M206 56 L199 57 L202 63" stroke="#111111" strokeWidth="2" />
          <text x="171" y="48" fontSize="12" fill="#111111">
            R
          </text>
          <text x="150" y="108" fontSize="10" fill="#4B5563">
            限流
          </text>
        </g>

        <g style={{ cursor: 'help' }} opacity={bypassClosed ? 1 : 0.42}>
          <title>S2：闭合时短接 R'，断开时让电流经过 R' 再进入电压表。</title>
          <circle cx="274" cy="70" r="2.8" fill="#111111" />
          <circle cx="310" cy="70" r="2.8" fill="#111111" />
          {bypassClosed ? (
            <line x1="274" y1="70" x2="310" y2="70" stroke="#111111" strokeWidth="2.2" />
          ) : (
            <line x1="274" y1="70" x2="306" y2="58" stroke="#111111" strokeWidth="2.2" />
          )}
          <text x="281" y="53" fontSize="12" fill="#111111">
            S2
          </text>
        </g>

        <g style={{ cursor: 'help' }} opacity={bypassClosed ? 0.42 : 1}>
          <title>电阻箱 R'：S2 断开后与电压表 V 串联，用于调到半偏。</title>
          <rect x="270" y="121" width="58" height="18" stroke="#111111" strokeWidth="2.2" fill="#FFFFFF" />
          <text x="289" y="112" fontSize="12" fill="#111111">
            R'
          </text>
          <text x="274" y="154" fontSize="10" fill="#4B5563">
            串联分压
          </text>
        </g>

        <g style={{ cursor: 'help' }}>
          <title>电压表 V：待测内阻为 Rv。</title>
          <circle cx="382" cy="140" r="26" stroke="#111111" strokeWidth="2.2" fill="#FFFFFF" />
          <text x="382" y="145" textAnchor="middle" fontSize="16" fill="#111111" fontWeight="600">
            V
          </text>
          <text x="382" y="182" textAnchor="middle" fontSize="11" fill="#111111">
            待测 Rv
          </text>
        </g>

        <circle cx="258" cy="70" r="3.2" fill="#111111" />
        <circle cx="340" cy="70" r="3.2" fill="#111111" />

        {commonSegments.map((segment) => (
          <path
            key={segment}
            d={segment}
            fill="none"
            stroke={activeWire}
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        <path
          d={bypassClosed ? 'M258 70 H340 V140 H356' : 'M258 70 V130 H340 V140 H356'}
          fill="none"
          stroke={activeWire}
          strokeWidth="2.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {!bypassClosed && (
          <path
            d="M258 70 H340"
            fill="none"
            stroke={inactiveWire}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.5"
          />
        )}

        {commonSegments.map((segment) => (
          <path
            key={`${segment}-flow`}
            d={segment}
            fill="none"
            stroke={currentStroke}
            strokeWidth="2.4"
            strokeDasharray="8 10"
            strokeLinecap="round"
            opacity="0.9"
          >
            <animate attributeName="stroke-dashoffset" from="0" to="-36" dur="1.2s" repeatCount="indefinite" />
          </path>
        ))}

        <path
          d={activeBranchPath}
          fill="none"
          stroke={currentStroke}
          strokeWidth="3.2"
          strokeDasharray="8 10"
          strokeLinecap="round"
          opacity="0.95"
        >
          <animate attributeName="stroke-dashoffset" from="0" to="-34" dur="1.1s" repeatCount="indefinite" />
        </path>

        <text x="370" y="98" fontSize="12" fill="#92400E" fontWeight="600">
          {voltageLabel}
        </text>
        {!bypassClosed && (
          <text x="278" y="170" fontSize="11" fill="#92400E">
            U_R'
          </text>
        )}
        <text x="366" y="122" fontSize="11" fill="#92400E">
          U
        </text>

        <rect x="88" y="226" width="264" height="38" rx="8" fill="#FFFFFF" stroke="#D1D5DB" />
        <text x="220" y="242" textAnchor="middle" fontSize="12" fill="#111111" fontWeight="600">
          {branchMessage}
        </text>
        <text x="220" y="257" textAnchor="middle" fontSize="11" fill={isBalanced ? '#92400E' : '#4B5563'}>
          {voltageMessage}
        </text>
      </svg>
    </StandardCircuitCardFrame>
  );
}

function HalfDeflectionCurveChart({
  mode,
  maxResistance,
  currentRheostatResistance,
  currentTheoreticalError,
  curve,
}: {
  mode: HalfDeflectionMode;
  maxResistance: number;
  currentRheostatResistance: number;
  currentTheoreticalError: number;
  curve: HalfDeflectionCurvePoint[];
}) {
  const width = 640;
  const height = 280;
  const pad = { left: 56, right: 20, top: 16, bottom: 36 };
  const plotX = pad.left;
  const plotY = pad.top;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const color = META[mode].color;
  const errorValues = curve.map((point) => point.realErrorPercent);
  const minY = Math.min(0, currentTheoreticalError, ...errorValues);
  const maxY = Math.max(0, currentTheoreticalError, ...errorValues);
  const yPad = Math.max(1, (maxY - minY) * 0.12);
  const yMin = minY - yPad;
  const yMax = maxY + yPad;
  const xTicks = 6;
  const yTicks = 6;

  const toX = (value: number) => plotX + (value / Math.max(maxResistance, 1)) * plotW;
  const toY = (value: number) => plotY + plotH - ((value - yMin) / Math.max(yMax - yMin, 1)) * plotH;

  const linePath = curve
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${toX(point.rheostatResistance)} ${toY(point.realErrorPercent)}`)
    .join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
      <rect x="0" y="0" width={width} height={height} rx="12" fill="#FFFFFF" />

      {Array.from({ length: xTicks + 1 }).map((_, index) => {
        const x = plotX + (plotW * index) / xTicks;
        return <line key={`x-${index}`} x1={x} y1={plotY} x2={x} y2={plotY + plotH} stroke="#E5E7EB" strokeWidth="1" />;
      })}
      {Array.from({ length: yTicks + 1 }).map((_, index) => {
        const y = plotY + (plotH * index) / yTicks;
        return <line key={`y-${index}`} x1={plotX} y1={y} x2={plotX + plotW} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
      })}

      <line x1={plotX} y1={toY(0)} x2={plotX + plotW} y2={toY(0)} stroke="#2563EB" strokeDasharray="6 4" strokeWidth="1.4" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2.4" />
      <circle cx={toX(currentRheostatResistance)} cy={toY(currentTheoreticalError)} r="5.2" fill="#FFFFFF" stroke={color} strokeWidth="2.4" />

      <text x={toX(currentRheostatResistance) + 8} y={toY(currentTheoreticalError) - 8} fontSize="10" fill={color}>
        当前点
      </text>

      {Array.from({ length: xTicks + 1 }).map((_, index) => {
        const value = (Math.max(maxResistance, 1) * index) / xTicks;
        return (
          <text key={`xt-${index}`} x={plotX + (plotW * index) / xTicks} y={plotY + plotH + 18} textAnchor="middle" fontSize="10" fill={pageStyle.muted}>
            {value.toFixed(maxResistance <= 20 ? 1 : 0)}
          </text>
        );
      })}
      {Array.from({ length: yTicks + 1 }).map((_, index) => {
        const value = yMax - ((yMax - yMin) * index) / yTicks;
        return (
          <text key={`yt-${index}`} x={plotX - 8} y={plotY + (plotH * index) / yTicks + 3} textAnchor="end" fontSize="10" fill={pageStyle.muted}>
            {value.toFixed(1)}
          </text>
        );
      })}

      <text x={plotX + plotW / 2} y={height - 8} textAnchor="middle" fontSize="11" fill={pageStyle.secondary}>
        R滑 / Ω
      </text>
      <text x="20" y={plotY + plotH / 2} textAnchor="middle" fontSize="11" fill={pageStyle.secondary} transform={`rotate(-90 20 ${plotY + plotH / 2})`}>
        误差 / %
      </text>
    </svg>
  );
}

function ComparisonCard({
  title,
  color,
  lines,
  className,
}: {
  title: string;
  color: string;
  lines: string[];
  className?: string;
}) {
  return (
    <div className={`rounded-xl border p-3 ${className ?? ''}`} style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
      <div className="text-sm font-semibold" style={{ color }}>
        {title}
      </div>
      <div className="mt-2 flex flex-col gap-1 text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
    </div>
  );
}

function KeyValueList({
  rows,
}: {
  rows: DetailRow[];
}) {
  return (
    <div className="overflow-hidden rounded-md border" style={{ borderColor: '#11111122', backgroundColor: '#FFFFFF' }}>
      {rows.map((row, index) => (
        <div
          key={`${row.label}-${row.value}`}
          className="grid grid-cols-[minmax(0,42%)_minmax(0,58%)] gap-2 px-2.5 py-2"
          style={{
            backgroundColor: index % 2 === 0 ? '#FFFFFF' : '#F8FAFC',
            borderBottom: index === rows.length - 1 ? 'none' : '1px solid #E5E7EB',
          }}
        >
          <div className="text-[10px]" style={{ color: pageStyle.muted }}>
            {row.label}
          </div>
          <div className="text-[10px] font-semibold leading-4" style={{ color: row.accent ?? pageStyle.text }}>
            {row.value}
          </div>
        </div>
      ))}
    </div>
  );
}

function KeyValueInfoBlock({
  title,
  color,
  rows,
}: {
  title: string;
  color: string;
  rows: DetailRow[];
}) {
  return (
    <div className="mb-2 rounded-lg p-2.5" style={{ border: `1px solid ${color}33`, backgroundColor: `${color}10` }}>
      <div className="mb-1 text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      <KeyValueList rows={rows} />
    </div>
  );
}

function TextInfoBlock({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div className="mb-2 rounded-lg p-2.5" style={{ border: `1px solid ${color}33`, backgroundColor: `${color}10` }}>
      <div className="mb-1 text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      {lines.map((line) => (
        <div key={line} className="text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
          {line}
        </div>
      ))}
    </div>
  );
}

function PanelTitle({ title }: { title: string }) {
  return (
    <h2 className="mb-2 text-xs font-semibold" style={{ color: pageStyle.text }}>
      {title}
    </h2>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 text-[11px] font-semibold" style={{ color: pageStyle.secondary }}>
      {title}
    </div>
  );
}

function PresetButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-2.5 py-1 text-[10px] font-medium"
      style={{ backgroundColor: pageStyle.accentSoft, color: pageStyle.accent, border: `1px solid ${pageStyle.accent}33` }}
    >
      {label}
    </button>
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
        <span className="text-[11px]" style={{ color: pageStyle.secondary }}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isNaN(next)) onChange(Math.max(min, Math.min(max, next)));
            }}
            className="w-20 rounded border px-1.5 py-0.5 text-right text-[11px]"
            style={{ borderColor: pageStyle.border, color: pageStyle.text }}
          />
          <span className="text-[10px]" style={{ color: pageStyle.muted }}>{unit}</span>
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: pageStyle.accent }}
      />
    </div>
  );
}

function formatResistance(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(digits > 0 ? digits : 1)} kΩ`;
  return `${value.toFixed(digits)} Ω`;
}

function formatCurrent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) < 0.01) return `${(value * 1000).toFixed(2)} mA`;
  return `${value.toFixed(3)} A`;
}

function formatVoltage(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(3)} V`;
}

function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}
