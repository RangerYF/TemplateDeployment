import { useMemo, useState } from 'react';
import { COLORS } from '@/styles/tokens';
import {
  calculateAmmeterConversion,
  calculateVoltmeterConversion,
  type AmmeterConversionParams,
  type AmmeterConversionResult,
  type MeterConversionMode,
  type VoltmeterConversionParams,
  type VoltmeterConversionResult,
} from '@/domains/em/logic/meter-conversion';

interface Props {
  onBack: () => void;
}

interface AmmeterPageParams extends AmmeterConversionParams {}
interface VoltmeterPageParams extends VoltmeterConversionParams {}

type ActiveResult = AmmeterConversionResult | VoltmeterConversionResult;

interface DetailRow {
  label: string;
  value: string;
  accent?: string;
}

const MODE_META: Record<
  MeterConversionMode,
  {
    title: string;
    accent: string;
    summary: string;
    formula: string;
    unitSymbol: string;
    essence: string;
  }
> = {
  ammeter: {
    title: '电流表改装',
    accent: '#D97706',
    summary: '并联分流电阻 Rs，让总电流 I 分成表头电流 Ig 与分流电流 Is。',
    formula: 'Rs = Ig/(I - Ig) × Rg',
    unitSymbol: 'A',
    essence: '分流',
  },
  voltmeter: {
    title: '电压表改装',
    accent: '#059669',
    summary: '串联限流电阻 Rv，让总电压 U 分成表头电压 Ug 与电阻电压 Uv。',
    formula: 'Rv = U/Ig - Rg',
    unitSymbol: 'V',
    essence: '分压',
  },
};

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

const DEFAULT_AMMETER_PARAMS = clampAmmeterParams({
  rg: 120,
  ig: 0.003,
  targetCurrent: 0.6,
  operatingCurrent: 0.42,
  extraResistance: 0.05,
});

const DEFAULT_VOLTMETER_PARAMS = clampVoltmeterParams({
  rg: 120,
  ig: 0.003,
  targetVoltage: 15,
  operatingVoltage: 9,
  extraResistance: -180,
});

const animationStyles = `
@keyframes meter-current-flow {
  from { stroke-dashoffset: 0; }
  to { stroke-dashoffset: -34; }
}
@keyframes meter-soft-pulse {
  0%, 100% { opacity: 0.38; }
  50% { opacity: 0.95; }
}
`;

export function MeterConversionExperimentView({ onBack }: Props) {
  const [mode, setMode] = useState<MeterConversionMode>('ammeter');
  const [ammeterParams, setAmmeterParams] = useState<AmmeterPageParams>(DEFAULT_AMMETER_PARAMS);
  const [voltmeterParams, setVoltmeterParams] = useState<VoltmeterPageParams>(DEFAULT_VOLTMETER_PARAMS);

  const ammeterResult = useMemo(() => calculateAmmeterConversion(ammeterParams), [ammeterParams]);
  const voltmeterResult = useMemo(() => calculateVoltmeterConversion(voltmeterParams), [voltmeterParams]);
  const activeResult = mode === 'ammeter' ? ammeterResult : voltmeterResult;

  const updateAmmeterParams = (patch: Partial<AmmeterPageParams>) => {
    setAmmeterParams((prev) => clampAmmeterParams({ ...prev, ...patch }));
  };

  const updateVoltmeterParams = (patch: Partial<VoltmeterPageParams>) => {
    setVoltmeterParams((prev) => clampVoltmeterParams({ ...prev, ...patch }));
  };

  const resetCurrentMode = () => {
    if (mode === 'ammeter') {
      setAmmeterParams(DEFAULT_AMMETER_PARAMS);
      return;
    }
    setVoltmeterParams(DEFAULT_VOLTMETER_PARAMS);
  };

  const applyIdealPreset = () => {
    if (mode === 'ammeter') {
      updateAmmeterParams({ extraResistance: 0 });
      return;
    }
    updateVoltmeterParams({ extraResistance: 0 });
  };

  const applyHighlightErrorPreset = () => {
    if (mode === 'ammeter') {
      const bounds = getAmmeterExtraBounds(ammeterParams.rg, ammeterParams.ig, ammeterParams.targetCurrent);
      updateAmmeterParams({
        extraResistance: bounds.max * 0.55,
        operatingCurrent: ammeterParams.targetCurrent,
      });
      return;
    }

    const bounds = getVoltmeterExtraBounds(voltmeterParams.rg, voltmeterParams.ig, voltmeterParams.targetVoltage);
    updateVoltmeterParams({
      extraResistance: bounds.min * 0.45,
      operatingVoltage: voltmeterParams.targetVoltage,
    });
  };

  const applyNearFullScalePreset = () => {
    if (mode === 'ammeter') {
      updateAmmeterParams({ operatingCurrent: ammeterParams.targetCurrent * 0.96 });
      return;
    }
    updateVoltmeterParams({ operatingVoltage: voltmeterParams.targetVoltage * 0.96 });
  };

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden" style={{ backgroundColor: pageStyle.pageBg }}>
      <style>{animationStyles}</style>
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
        <h1 className="text-sm font-semibold" style={{ color: pageStyle.text }}>
          电表改装实验 · 电流表 ↔ 电压表
        </h1>
        <span className="text-[11px]" style={{ color: pageStyle.muted }}>
          在同一表头 G 上切换分流与分压两种改装思路，观察量程、刻度和误差如何联动
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <LeftPanel
          mode={mode}
          ammeterParams={ammeterParams}
          voltmeterParams={voltmeterParams}
          ammeterResult={ammeterResult}
          voltmeterResult={voltmeterResult}
          onChangeMode={setMode}
          onChangeAmmeter={updateAmmeterParams}
          onChangeVoltmeter={updateVoltmeterParams}
          onApplyIdealPreset={applyIdealPreset}
          onApplyHighlightErrorPreset={applyHighlightErrorPreset}
          onApplyNearFullScalePreset={applyNearFullScalePreset}
          onResetMode={resetCurrentMode}
        />
        <CenterPanel mode={mode} result={activeResult} />
        <RightPanel
          mode={mode}
          activeResult={activeResult}
          ammeterResult={ammeterResult}
          voltmeterResult={voltmeterResult}
        />
      </div>
    </div>
  );
}

function LeftPanel({
  mode,
  ammeterParams,
  voltmeterParams,
  ammeterResult,
  voltmeterResult,
  onChangeMode,
  onChangeAmmeter,
  onChangeVoltmeter,
  onApplyIdealPreset,
  onApplyHighlightErrorPreset,
  onApplyNearFullScalePreset,
  onResetMode,
}: {
  mode: MeterConversionMode;
  ammeterParams: AmmeterPageParams;
  voltmeterParams: VoltmeterPageParams;
  ammeterResult: AmmeterConversionResult;
  voltmeterResult: VoltmeterConversionResult;
  onChangeMode: (mode: MeterConversionMode) => void;
  onChangeAmmeter: (patch: Partial<AmmeterPageParams>) => void;
  onChangeVoltmeter: (patch: Partial<VoltmeterPageParams>) => void;
  onApplyIdealPreset: () => void;
  onApplyHighlightErrorPreset: () => void;
  onApplyNearFullScalePreset: () => void;
  onResetMode: () => void;
}) {
  const activeMeta = MODE_META[mode];

  return (
    <div
      className="flex w-[292px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: pageStyle.panelSoft, borderRight: `1px solid ${pageStyle.border}` }}
    >
      <div className="p-4">
        <div className="mb-4 flex rounded-lg p-1" style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}>
          {(['ammeter', 'voltmeter'] as MeterConversionMode[]).map((item) => {
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
                {MODE_META[item].title}
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
          <div className="mt-1 text-[16px] font-semibold" style={{ color: activeMeta.accent }}>
            {activeMeta.title}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            {activeMeta.summary}
          </div>
        </div>

        {mode === 'ammeter' ? (
          <AmmeterControls
            params={ammeterParams}
            result={ammeterResult}
            onChange={onChangeAmmeter}
          />
        ) : (
          <VoltmeterControls
            params={voltmeterParams}
            result={voltmeterResult}
            onChange={onChangeVoltmeter}
          />
        )}

        <SectionTitle title="教学预设" />
        <div className="flex flex-wrap gap-2">
          <PresetButton label="理想改装" onClick={onApplyIdealPreset} />
          <PresetButton label="突出误差" onClick={onApplyHighlightErrorPreset} />
          <PresetButton label="接近满偏" onClick={onApplyNearFullScalePreset} />
          <PresetButton label="恢复默认" onClick={onResetMode} />
        </div>
      </div>
    </div>
  );
}

function AmmeterControls({
  params,
  result,
  onChange,
}: {
  params: AmmeterPageParams;
  result: AmmeterConversionResult;
  onChange: (patch: Partial<AmmeterPageParams>) => void;
}) {
  const targetBounds = getAmmeterTargetBounds(params.ig);
  const extraBounds = getAmmeterExtraBounds(params.rg, params.ig, params.targetCurrent);

  return (
    <>
      <SectionTitle title="表头参数" />
      <RangeControl
        label="表头内阻 Rg"
        value={params.rg}
        min={5}
        max={2000}
        step={resistanceStep(params.rg)}
        unit="Ω"
        onChange={(value) => onChange({ rg: value })}
      />
      <RangeControl
        label="满偏电流 Ig"
        value={params.ig}
        min={0.00005}
        max={0.02}
        step={0.00005}
        unit="A"
        onChange={(value) => onChange({ ig: value })}
      />

      <SectionTitle title="改装量程" />
      <RangeControl
        label="目标量程 I"
        value={params.targetCurrent}
        min={targetBounds.min}
        max={targetBounds.max}
        step={currentStep(params.targetCurrent)}
        unit="A"
        onChange={(value) => onChange({ targetCurrent: value })}
      />
      <RangeControl
        label="当前真实电流 I"
        value={params.operatingCurrent}
        min={0}
        max={params.targetCurrent * 1.2}
        step={currentStep(params.targetCurrent)}
        unit="A"
        onChange={(value) => onChange({ operatingCurrent: value })}
      />

      <SectionTitle title="非理想偏差" />
      <RangeControl
        label="分流电阻偏差 ΔR"
        value={params.extraResistance}
        min={extraBounds.min}
        max={extraBounds.max}
        step={resistanceStep(Math.max(Math.abs(extraBounds.min), Math.abs(extraBounds.max)))}
        unit="Ω"
        onChange={(value) => onChange({ extraResistance: value })}
      />

      <div
        className="mb-4 rounded-lg p-3"
        style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
      >
        <div className="text-[11px] font-semibold" style={{ color: pageStyle.text }}>
          当前扩程倍数
        </div>
        <div className="mt-1 text-[17px] font-semibold" style={{ color: MODE_META.ammeter.accent }}>
          {result.rangeMultiplier.toFixed(1)} ×
        </div>
        <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
          原表头满偏仅需 {formatCurrent(result.originalFullScale)}，改装后满偏量程变为 {formatCurrent(result.targetRange)}。
        </div>
      </div>
    </>
  );
}

function VoltmeterControls({
  params,
  result,
  onChange,
}: {
  params: VoltmeterPageParams;
  result: VoltmeterConversionResult;
  onChange: (patch: Partial<VoltmeterPageParams>) => void;
}) {
  const targetBounds = getVoltmeterTargetBounds(params.rg, params.ig);
  const extraBounds = getVoltmeterExtraBounds(params.rg, params.ig, params.targetVoltage);

  return (
    <>
      <SectionTitle title="表头参数" />
      <RangeControl
        label="表头内阻 Rg"
        value={params.rg}
        min={5}
        max={2000}
        step={resistanceStep(params.rg)}
        unit="Ω"
        onChange={(value) => onChange({ rg: value })}
      />
      <RangeControl
        label="满偏电流 Ig"
        value={params.ig}
        min={0.00005}
        max={0.02}
        step={0.00005}
        unit="A"
        onChange={(value) => onChange({ ig: value })}
      />

      <SectionTitle title="改装量程" />
      <RangeControl
        label="目标量程 U"
        value={params.targetVoltage}
        min={targetBounds.min}
        max={targetBounds.max}
        step={voltageStep(params.targetVoltage)}
        unit="V"
        onChange={(value) => onChange({ targetVoltage: value })}
      />
      <RangeControl
        label="当前真实电压 U"
        value={params.operatingVoltage}
        min={0}
        max={params.targetVoltage * 1.2}
        step={voltageStep(params.targetVoltage)}
        unit="V"
        onChange={(value) => onChange({ operatingVoltage: value })}
      />

      <SectionTitle title="非理想偏差" />
      <RangeControl
        label="限流电阻偏差 ΔR"
        value={params.extraResistance}
        min={extraBounds.min}
        max={extraBounds.max}
        step={resistanceStep(Math.max(Math.abs(extraBounds.min), Math.abs(extraBounds.max)))}
        unit="Ω"
        onChange={(value) => onChange({ extraResistance: value })}
      />

      <div
        className="mb-4 rounded-lg p-3"
        style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
      >
        <div className="text-[11px] font-semibold" style={{ color: pageStyle.text }}>
          当前扩程倍数
        </div>
        <div className="mt-1 text-[17px] font-semibold" style={{ color: MODE_META.voltmeter.accent }}>
          {result.rangeMultiplier.toFixed(1)} ×
        </div>
        <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
          原表头满偏电压为 {formatVoltage(result.originalFullScale)}，改装后满偏量程变为 {formatVoltage(result.targetRange)}。
        </div>
      </div>
    </>
  );
}

function CenterPanel({ mode, result }: { mode: MeterConversionMode; result: ActiveResult }) {
  const meta = MODE_META[mode];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ backgroundColor: pageStyle.panelBg }}>
      <div className="px-4 pt-4">
        <div className="rounded-xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                标准电路图与当前状态
              </div>
              <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
                {mode === 'ammeter'
                  ? 'G 与 Rs 并联，同一总电流在两支路中按阻值反比分配。'
                  : 'G 与 Rv 串联，同一回路电流在两元件上形成电压分配。'}
              </div>
            </div>
            <StatusBadge result={result} />
          </div>

          <div className="mt-3 overflow-hidden rounded-lg border" style={{ borderColor: pageStyle.border }}>
            {result.mode === 'ammeter' ? (
              <AmmeterCircuitDiagram result={result} />
            ) : (
              <VoltmeterCircuitDiagram result={result} />
            )}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 lg:grid-cols-3">
            {result.mode === 'ammeter' ? (
              <>
                <CircuitDetailCard title="电流分配">
                  <DetailLine text={`总电流 I = ${formatCurrent(result.operatingInput)}`} />
                  <DetailLine text={`表头电流 Ig = ${formatCurrent(result.meterCurrent)}`} />
                  <DetailLine text={`分流电流 Is = ${formatCurrent(result.shuntCurrent)}`} />
                  <DetailLine text={`I = Ig + Is`} accent={meta.accent} />
                </CircuitDetailCard>
                <CircuitDetailCard title="当前示数">
                  <DetailLine text={`机械偏转 θ = ${(result.usedPointerRatio * 100).toFixed(1)}%`} />
                  <DetailLine text={`改装表示数 = ${formatCurrent(result.indicatedValue)}`} />
                  <DetailLine text={`当前误差 = ${formatSignedPercent(result.currentErrorPercent)}`} />
                  <DetailLine
                    text={result.isOverRange ? '当前已超程，表盘停在满刻度附近' : '当前仍在可读量程内'}
                    accent={result.isOverRange ? COLORS.error : meta.accent}
                  />
                </CircuitDetailCard>
                <CircuitDetailCard title="工程视角">
                  <DetailLine text={`等效内阻 = ${formatResistance(result.loadResistance, 3)}`} />
                  <DetailLine text={`表头功耗 = ${formatPower(result.meterPower)}`} />
                  <DetailLine text={`分流电阻功耗 = ${formatPower(result.accessoryPower)}`} />
                  <DetailLine text={`量程倍率 n = ${result.rangeMultiplier.toFixed(1)}`} />
                </CircuitDetailCard>
              </>
            ) : (
              <>
                <CircuitDetailCard title="电压分配">
                  <DetailLine text={`总电压 U = ${formatVoltage(result.operatingInput)}`} />
                  <DetailLine text={`表头电压 Ug = ${formatVoltage(result.meterVoltage)}`} />
                  <DetailLine text={`串联电阻电压 Uv = ${formatVoltage(result.accessoryVoltage)}`} />
                  <DetailLine text={`U = Ug + Uv`} accent={meta.accent} />
                </CircuitDetailCard>
                <CircuitDetailCard title="当前示数">
                  <DetailLine text={`机械偏转 θ = ${(result.usedPointerRatio * 100).toFixed(1)}%`} />
                  <DetailLine text={`改装表示数 = ${formatVoltage(result.indicatedValue)}`} />
                  <DetailLine text={`当前误差 = ${formatSignedPercent(result.currentErrorPercent)}`} />
                  <DetailLine
                    text={result.isOverRange ? '当前已超程，表盘停在满刻度附近' : '当前仍在可读量程内'}
                    accent={result.isOverRange ? COLORS.error : meta.accent}
                  />
                </CircuitDetailCard>
                <CircuitDetailCard title="工程视角">
                  <DetailLine text={`输入电阻 = ${formatResistance(result.inputResistanceActual, 1)}`} />
                  <DetailLine text={`表头功耗 = ${formatPower(result.meterPower)}`} />
                  <DetailLine text={`限流电阻功耗 = ${formatPower(result.accessoryPower)}`} />
                  <DetailLine text={`灵敏度 = ${formatResistance(result.sensitivityOhmsPerVoltActual, 0)}/V`} />
                </CircuitDetailCard>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 py-4">
        <div className="rounded-xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                刻度响应、误差曲线与当前工作点
              </div>
              <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
                蓝虚线表示按公式得到的理想改装，彩色实线表示带有电阻偏差 ΔR 的真实改装。当前滑动位置会在两张图上同时高亮。
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <LegendPill label="理想" color="#2563EB" />
              <LegendPill label="实际" color={meta.accent} />
              <LegendPill label="工作点" color={pageStyle.text} hollow />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(290px,0.9fr)]">
            <ResponseChart result={result} />
            <div className="flex flex-col gap-4">
              <ErrorChart result={result} />
              <ScaleStrip result={result} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPanel({
  mode,
  activeResult,
  ammeterResult,
  voltmeterResult,
}: {
  mode: MeterConversionMode;
  activeResult: ActiveResult;
  ammeterResult: AmmeterConversionResult;
  voltmeterResult: VoltmeterConversionResult;
}) {
  const statusRows = buildCurrentStatusRows(activeResult);
  const warningRows = buildWarningRows(activeResult);
  const engineeringRows = buildEngineeringRows(activeResult);

  return (
    <div
      className="flex w-[332px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: pageStyle.panelBg, borderLeft: `1px solid ${pageStyle.border}` }}
    >
      <div className="p-3">
        <PanelTitle title="关键公式卡片" />
        <FormulaBlock
          title="电流表改装"
          color={MODE_META.ammeter.accent}
          active={mode === 'ammeter'}
          lines={[
            'Rs = (Ig / (I - Ig)) × Rg',
            `当前理论 Rs = ${formatResistance(ammeterResult.idealAccessoryResistance, 3)}`,
            `当前实际 Rs = ${formatResistance(ammeterResult.actualAccessoryResistance, 3)}`,
            `量程倍率 n = I / Ig = ${ammeterResult.rangeMultiplier.toFixed(1)}`,
          ]}
        />
        <FormulaBlock
          title="电压表改装"
          color={MODE_META.voltmeter.accent}
          active={mode === 'voltmeter'}
          lines={[
            'Rv = U / Ig - Rg',
            `当前理论 Rv = ${formatResistance(voltmeterResult.idealAccessoryResistance, 1)}`,
            `当前实际 Rv = ${formatResistance(voltmeterResult.actualAccessoryResistance, 1)}`,
            `原表头满偏电压 Ug = Ig × Rg = ${formatVoltage(voltmeterResult.originalFullScale)}`,
          ]}
        />
      </div>

      <div className="px-3 pb-3">
        <PanelTitle title="教学结论" />
        <InfoBlock
          title="核心理解"
          color={MODE_META[mode].accent}
          lines={[
            '电流表改装本质：分流。目标量程越大，分流电阻 Rs 越小，绝大部分电流绕过表头。',
            '电压表改装本质：分压。目标量程越大，串联电阻 Rv 越大，绝大部分电压落在外接电阻上。',
            '机械刻度并没有变，变化的是“每一小格对应的物理量”。改装后的刻度数字只是把同一偏角重新标尺。',
          ]}
        />
      </div>

      <div className="px-3 pb-3">
        <PanelTitle title="当前状态" />
        <KeyValueInfoBlock
          title={MODE_META[mode].title}
          color={MODE_META[mode].accent}
          rows={statusRows}
        />
      </div>

      <div className="px-3 pb-3">
        <PanelTitle title="错误设计提示" />
        <KeyValueInfoBlock
          title={activeResult.isUnsafe ? '当前存在过载风险' : '当前偏差可控'}
          color={activeResult.isUnsafe ? COLORS.error : COLORS.warning}
          rows={warningRows}
        />
      </div>

      <div className="px-3 pb-4" style={{ borderTop: `1px solid ${pageStyle.border}`, paddingTop: 12 }}>
        <PanelTitle title="工程视角" />
        <KeyValueInfoBlock
          title="功耗与灵敏度"
          color={MODE_META[mode].accent}
          rows={engineeringRows}
        />
      </div>
    </div>
  );
}

function AmmeterCircuitDiagram({ result }: { result: AmmeterConversionResult }) {
  const stroke = '#111827';
  const accent = MODE_META.ammeter.accent;
  const total = Math.max(result.operatingInput, 1e-9);
  const meterShare = result.meterCurrent / total;
  const shuntShare = result.shuntCurrent / total;
  const topPath = 'M112 96 H260';
  const meterPath = 'M300 96 V204';
  const shuntPath = 'M390 96 V204';

  return (
    <svg viewBox="0 0 520 300" style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#FFFFFF' }} aria-label="电流表改装标准电路图">
      <rect x="1" y="1" width="518" height="298" rx="12" fill="#FCFCFD" stroke={pageStyle.border} />

      <line x1="72" y1="96" x2="112" y2="96" stroke={stroke} strokeWidth="2" />
      <line x1="112" y1="96" x2="260" y2="96" stroke={stroke} strokeWidth="2" />
      <line x1="260" y1="96" x2="420" y2="96" stroke={stroke} strokeWidth="2" />
      <line x1="420" y1="96" x2="420" y2="204" stroke={stroke} strokeWidth="2" />
      <line x1="420" y1="204" x2="72" y2="204" stroke={stroke} strokeWidth="2" />
      <line x1="72" y1="96" x2="72" y2="124" stroke={stroke} strokeWidth="2" />
      <line x1="72" y1="168" x2="72" y2="204" stroke={stroke} strokeWidth="2" />

      <line x1="260" y1="96" x2="260" y2="204" stroke={stroke} strokeWidth="2" />
      <line x1="420" y1="96" x2="420" y2="204" stroke={stroke} strokeWidth="2" />

      <path
        d={topPath}
        fill="none"
        stroke={accent}
        strokeWidth={3.4}
        strokeDasharray="10 10"
        style={{ animation: 'meter-current-flow 1.1s linear infinite' }}
      />
      <path
        d={meterPath}
        fill="none"
        stroke={accent}
        strokeWidth={2.2 + meterShare * 5}
        strokeLinecap="round"
        strokeDasharray="9 8"
        style={{ animation: 'meter-current-flow 1s linear infinite', opacity: result.operatingInput > 0 ? 0.95 : 0.18 }}
      />
      <path
        d={shuntPath}
        fill="none"
        stroke={accent}
        strokeWidth={2.2 + shuntShare * 5}
        strokeLinecap="round"
        strokeDasharray="9 8"
        style={{ animation: 'meter-current-flow 0.92s linear infinite', opacity: result.operatingInput > 0 ? 0.9 : 0.14 }}
      />

      <BatterySymbol x={72} top={124} bottom={168} stroke={stroke} />
      <text x="54" y="148" textAnchor="middle" fontSize="12" fill={stroke} fontWeight="600">
        E
      </text>

      <MeterSymbol center={{ x: 300, y: 150 }} letter="G" stroke={stroke} accent={accent} accentRatio={meterShare} />
      <VerticalResistor x={372} y={120} width={36} height={60} label="Rs" stroke={stroke} accent={accent} accentRatio={shuntShare} />

      <NodeDot x={260} y={96} />
      <NodeDot x={260} y={204} />
      <NodeDot x={420} y={96} />
      <NodeDot x={420} y={204} />

      <text x="186" y="82" textAnchor="middle" fontSize="12" fill={accent} fontWeight="600">
        I = {formatCurrent(result.operatingInput)}
      </text>
      <text x="300" y="82" textAnchor="middle" fontSize="12" fill={accent} fontWeight="600">
        Ig = {formatCurrent(result.meterCurrent)}
      </text>
      <text x="390" y="82" textAnchor="middle" fontSize="12" fill={accent} fontWeight="600">
        Is = {formatCurrent(result.shuntCurrent)}
      </text>
      <text x="340" y="235" textAnchor="middle" fontSize="12" fill={stroke}>
        I → Ig + Is
      </text>

      <ValueChip x={208} y={248} text={`Rs(ideal) ${formatResistance(result.idealAccessoryResistance, 3)}`} color={accent} />
      <ValueChip x={362} y={248} text={`Rs(actual) ${formatResistance(result.actualAccessoryResistance, 3)}`} color={accent} />
    </svg>
  );
}

function VoltmeterCircuitDiagram({ result }: { result: VoltmeterConversionResult }) {
  const stroke = '#111827';
  const accent = MODE_META.voltmeter.accent;
  const currentRatio = Math.min(Math.max(result.pointerRatio, 0), 1.2);
  const uvRatio = result.operatingInput > 0 ? result.accessoryVoltage / result.operatingInput : 0;
  const ugRatio = result.operatingInput > 0 ? result.meterVoltage / result.operatingInput : 0;
  const flowPath = 'M112 100 H214 M304 100 H338 M382 100 H432 V204 H112';

  return (
    <svg viewBox="0 0 520 300" style={{ width: '100%', height: 'auto', display: 'block', backgroundColor: '#FFFFFF' }} aria-label="电压表改装标准电路图">
      <rect x="1" y="1" width="518" height="298" rx="12" fill="#FCFCFD" stroke={pageStyle.border} />

      <line x1="72" y1="100" x2="112" y2="100" stroke={stroke} strokeWidth="2" />
      <line x1="112" y1="100" x2="214" y2="100" stroke={stroke} strokeWidth="2" />
      <line x1="304" y1="100" x2="338" y2="100" stroke={stroke} strokeWidth="2" />
      <line x1="382" y1="100" x2="432" y2="100" stroke={stroke} strokeWidth="2" />
      <line x1="432" y1="100" x2="432" y2="204" stroke={stroke} strokeWidth="2" />
      <line x1="432" y1="204" x2="72" y2="204" stroke={stroke} strokeWidth="2" />
      <line x1="72" y1="100" x2="72" y2="128" stroke={stroke} strokeWidth="2" />
      <line x1="72" y1="172" x2="72" y2="204" stroke={stroke} strokeWidth="2" />

      <path
        d={flowPath}
        fill="none"
        stroke={accent}
        strokeWidth={2.6 + currentRatio * 2.6}
        strokeLinecap="round"
        strokeDasharray="10 10"
        style={{ animation: 'meter-current-flow 1s linear infinite', opacity: result.operatingInput > 0 ? 0.95 : 0.16 }}
      />

      <BatterySymbol x={72} top={128} bottom={172} stroke={stroke} />
      <text x="54" y="152" textAnchor="middle" fontSize="12" fill={stroke} fontWeight="600">
        E
      </text>

      <HorizontalResistor x={214} y={82} width={90} height={36} label="Rv" stroke={stroke} accent={accent} accentRatio={uvRatio} />
      <MeterSymbol center={{ x: 360, y: 100 }} letter="G" stroke={stroke} accent={accent} accentRatio={ugRatio} />

      <NodeDot x={214} y={100} />
      <NodeDot x={304} y={100} />
      <NodeDot x={338} y={100} />
      <NodeDot x={382} y={100} />

      <VoltageBracket x1={214} x2={304} y={50} label={`Uv = ${formatVoltage(result.accessoryVoltage)}`} color={accent} />
      <VoltageBracket x1={338} x2={382} y={68} label={`Ug = ${formatVoltage(result.meterVoltage)}`} color={accent} />
      <VoltageBracket x1={214} x2={382} y={28} label={`U = ${formatVoltage(result.operatingInput)}`} color="#2563EB" />

      <ValueChip x={206} y={248} text={`Rv(ideal) ${formatResistance(result.idealAccessoryResistance, 1)}`} color={accent} />
      <ValueChip x={364} y={248} text={`Rv(actual) ${formatResistance(result.actualAccessoryResistance, 1)}`} color={accent} />
    </svg>
  );
}

function ResponseChart({ result }: { result: ActiveResult }) {
  const accent = MODE_META[result.mode].accent;
  const width = 660;
  const height = 292;
  const plot = { x: 66, y: 18, w: 560, h: 196 };
  const xMax = result.curve[result.curve.length - 1]?.input ?? result.targetRange;
  const maxTheta = Math.max(
    1.05,
    ...result.curve.map((point) => Math.max(point.thetaIdeal, point.thetaActual)),
    result.pointerRatio,
  );
  const yMax = Math.min(1.28, maxTheta * 1.08);
  const toX = (value: number) => plot.x + (value / Math.max(xMax, 1e-9)) * plot.w;
  const toY = (value: number) => plot.y + plot.h - (value / Math.max(yMax, 1e-9)) * plot.h;
  const idealPath = buildLinePath(result.curve, (point) => toX(point.input), (point) => toY(point.thetaIdeal));
  const actualPath = buildLinePath(result.curve, (point) => toX(point.input), (point) => toY(point.thetaActual));
  const workingPoint = {
    x: toX(result.operatingInput),
    yIdeal: toY(result.operatingInput / result.targetRange),
    yActual: toY(result.pointerRatio),
  };

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: pageStyle.border }}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
          刻度响应曲线
        </div>
        <div className="text-[11px]" style={{ color: pageStyle.muted }}>
          x 轴是真实 {result.mode === 'ammeter' ? '电流 I' : '电压 U'}，y 轴是表头偏转比 θ
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
        <defs>
          <clipPath id={`response-${result.mode}`}>
            <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} rx="10" />
          </clipPath>
        </defs>
        <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} rx="10" fill="#FFFFFF" stroke={pageStyle.border} />

        {Array.from({ length: 7 }).map((_, index) => {
          const x = plot.x + (plot.w * index) / 6;
          return <line key={`x-${index}`} x1={x} y1={plot.y} x2={x} y2={plot.y + plot.h} stroke="#E5E7EB" strokeWidth="1" />;
        })}
        {Array.from({ length: 6 }).map((_, index) => {
          const y = plot.y + (plot.h * index) / 5;
          return <line key={`y-${index}`} x1={plot.x} y1={y} x2={plot.x + plot.w} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
        })}
        <line x1={plot.x} y1={toY(1)} x2={plot.x + plot.w} y2={toY(1)} stroke="#EF4444" strokeDasharray="6 6" strokeWidth="1.4" />

        <g clipPath={`url(#response-${result.mode})`}>
          <path d={idealPath} fill="none" stroke="#2563EB" strokeWidth="2.2" strokeDasharray="8 7" />
          <path d={actualPath} fill="none" stroke={accent} strokeWidth="2.8" />
        </g>

        <circle cx={workingPoint.x} cy={workingPoint.yIdeal} r="5.2" fill="#FFFFFF" stroke="#2563EB" strokeWidth="2" />
        <circle cx={workingPoint.x} cy={workingPoint.yActual} r="6.2" fill="#FFFFFF" stroke={accent} strokeWidth="2.4" />

        {Array.from({ length: 7 }).map((_, index) => {
          const value = (xMax * index) / 6;
          return (
            <text key={`xt-${index}`} x={plot.x + (plot.w * index) / 6} y={plot.y + plot.h + 22} textAnchor="middle" fontSize="10" fill={pageStyle.muted}>
              {formatAxisNumber(value, result.mode === 'ammeter' ? 'current' : 'voltage')}
            </text>
          );
        })}
        {Array.from({ length: 6 }).map((_, index) => {
          const value = yMax - (yMax * index) / 5;
          return (
            <text key={`yt-${index}`} x={plot.x - 12} y={plot.y + (plot.h * index) / 5 + 4} textAnchor="end" fontSize="10" fill={pageStyle.muted}>
              {value.toFixed(2)}
            </text>
          );
        })}

        <text x={plot.x + plot.w / 2} y={height - 16} textAnchor="middle" fontSize="11" fill={pageStyle.secondary}>
          真实{result.mode === 'ammeter' ? '电流 I / A' : '电压 U / V'}
        </text>
        <text
          x={24}
          y={plot.y + plot.h / 2}
          textAnchor="middle"
          fontSize="11"
          fill={pageStyle.secondary}
          transform={`rotate(-90 24 ${plot.y + plot.h / 2})`}
        >
          表头偏转比 θ
        </text>
      </svg>
    </div>
  );
}

function ErrorChart({ result }: { result: ActiveResult }) {
  const accent = MODE_META[result.mode].accent;
  const width = 460;
  const height = 194;
  const plot = { x: 56, y: 18, w: 370, h: 120 };
  const xMax = result.curve[result.curve.length - 1]?.input ?? result.targetRange;
  const errorValues = result.curve.map((point) => point.errorPercent);
  const maxAbs = Math.max(0.5, ...errorValues.map((value) => Math.abs(value)), Math.abs(result.currentErrorPercent)) * 1.16;
  const toX = (value: number) => plot.x + (value / Math.max(xMax, 1e-9)) * plot.w;
  const toY = (value: number) => plot.y + plot.h / 2 - (value / Math.max(maxAbs, 1e-9)) * (plot.h / 2);
  const errorPath = buildLinePath(result.curve, (point) => toX(point.input), (point) => toY(point.errorPercent));

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: pageStyle.border }}>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
          误差曲线
        </div>
        <div className="text-[11px]" style={{ color: pageStyle.muted }}>
          当前 ΔR = {formatResistance(getSignedDeviation(result), result.mode === 'ammeter' ? 3 : 1)}
        </div>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }}>
        <rect x={plot.x} y={plot.y} width={plot.w} height={plot.h} rx="10" fill="#FFFFFF" stroke={pageStyle.border} />
        {Array.from({ length: 7 }).map((_, index) => {
          const x = plot.x + (plot.w * index) / 6;
          return <line key={`xe-${index}`} x1={x} y1={plot.y} x2={x} y2={plot.y + plot.h} stroke="#E5E7EB" strokeWidth="1" />;
        })}
        {Array.from({ length: 5 }).map((_, index) => {
          const y = plot.y + (plot.h * index) / 4;
          return <line key={`ye-${index}`} x1={plot.x} y1={y} x2={plot.x + plot.w} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
        })}
        <line x1={plot.x} y1={toY(0)} x2={plot.x + plot.w} y2={toY(0)} stroke="#9CA3AF" strokeDasharray="5 5" strokeWidth="1.4" />
        <path d={errorPath} fill="none" stroke={accent} strokeWidth="2.6" />
        <circle cx={toX(result.operatingInput)} cy={toY(result.currentErrorPercent)} r="5.4" fill="#FFFFFF" stroke={accent} strokeWidth="2.2" />

        {[-maxAbs, 0, maxAbs].map((value) => (
          <text key={value} x={plot.x - 10} y={toY(value) + 4} textAnchor="end" fontSize="10" fill={pageStyle.muted}>
            {value.toFixed(1)}%
          </text>
        ))}

        <text x={plot.x + plot.w / 2} y={height - 14} textAnchor="middle" fontSize="11" fill={pageStyle.secondary}>
          真实{result.mode === 'ammeter' ? '电流' : '电压'}
        </text>
        <text
          x={22}
          y={plot.y + plot.h / 2}
          textAnchor="middle"
          fontSize="11"
          fill={pageStyle.secondary}
          transform={`rotate(-90 22 ${plot.y + plot.h / 2})`}
        >
          相对误差 / %
        </text>
      </svg>
    </div>
  );
}

function ScaleStrip({ result }: { result: ActiveResult }) {
  const accent = MODE_META[result.mode].accent;
  const currentRatio = Math.min(result.usedPointerRatio, 1);
  const currentX = 44 + 332 * currentRatio;

  return (
    <div className="rounded-xl border bg-white p-4" style={{ borderColor: pageStyle.border }}>
      <div className="mb-2 text-sm font-semibold" style={{ color: pageStyle.text }}>
        同一机械刻度的重新标尺
      </div>
      <div className="mb-3 text-[11px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
        上方是改装后的刻度数字，下方是原表头同一偏角对应的原始量程。机械刻度没有变，变化的是每一格对应的物理量。
      </div>

      <svg viewBox="0 0 420 154" style={{ width: '100%', display: 'block' }}>
        <line x1="44" y1="52" x2="376" y2="52" stroke={accent} strokeWidth="3" strokeLinecap="round" />
        <line x1="44" y1="106" x2="376" y2="106" stroke="#9CA3AF" strokeWidth="2.2" strokeLinecap="round" />

        {result.scaleMarks.map((mark) => {
          const x = 44 + 332 * mark.ratio;
          const showLabel = mark.division % 2 === 0 || mark.division === 10;
          return (
            <g key={mark.division}>
              <line x1={x} y1="42" x2={x} y2="62" stroke={accent} strokeWidth="1.5" />
              <line x1={x} y1="96" x2={x} y2="116" stroke="#6B7280" strokeWidth="1.3" />
              {showLabel && (
                <>
                  <text x={x} y="32" textAnchor="middle" fontSize="10" fill={accent}>
                    {formatScaleLabel(mark.convertedValue, result.mode)}
                  </text>
                  <text x={x} y="132" textAnchor="middle" fontSize="10" fill={pageStyle.muted}>
                    {formatScaleLabel(mark.originalValue, result.mode === 'ammeter' ? 'ammeter-original' : 'voltmeter-original')}
                  </text>
                </>
              )}
            </g>
          );
        })}

        <line x1={currentX} y1="20" x2={currentX} y2="138" stroke={pageStyle.text} strokeDasharray="4 4" strokeWidth="1.5" />
        <circle cx={currentX} cy="52" r="6.4" fill="#FFFFFF" stroke={accent} strokeWidth="2.2" />
        <circle cx={currentX} cy="106" r="5.4" fill="#FFFFFF" stroke="#6B7280" strokeWidth="1.8" />

        <text x={16} y="56" textAnchor="start" fontSize="11" fill={accent} fontWeight="600">
          改装后
        </text>
        <text x={16} y="110" textAnchor="start" fontSize="11" fill="#6B7280" fontWeight="600">
          原表头
        </text>
      </svg>
    </div>
  );
}

function StatusBadge({ result }: { result: ActiveResult }) {
  const danger = result.isUnsafe;
  const warn = !danger && (result.isOverRange || result.isNearFullScale);
  const color = danger ? COLORS.error : warn ? COLORS.warning : MODE_META[result.mode].accent;
  const backgroundColor = danger ? COLORS.errorLight : warn ? COLORS.warningLight : `${MODE_META[result.mode].accent}14`;
  const text = danger
    ? '过载风险'
    : result.isOverRange
      ? '已超程'
      : result.isNearFullScale
        ? '接近满偏'
        : '工作正常';

  return (
    <div className="rounded-full px-2.5 py-1 text-[10px] font-medium" style={{ color, backgroundColor }}>
      {text}
    </div>
  );
}

function FormulaBlock({
  title,
  color,
  active,
  lines,
}: {
  title: string;
  color: string;
  active: boolean;
  lines: string[];
}) {
  return (
    <div
      className="mb-2 rounded-lg p-3"
      style={{
        border: `1px solid ${active ? color : `${color}33`}`,
        backgroundColor: active ? `${color}12` : `${color}0C`,
      }}
    >
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

function CircuitDetailCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border p-2.5" style={{ borderColor: '#11111122', backgroundColor: '#FFFFFF' }}>
      <div className="text-[11px] font-semibold" style={{ color: '#111111' }}>
        {title}
      </div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function DetailLine({ text, accent }: { text: string; accent?: string }) {
  return (
    <div className="text-[10px]" style={{ color: accent ?? pageStyle.secondary, lineHeight: 1.7 }}>
      {text}
    </div>
  );
}

function VoltageBracket({
  x1,
  x2,
  y,
  label,
  color,
}: {
  x1: number;
  x2: number;
  y: number;
  label: string;
  color: string;
}) {
  return (
    <>
      <line x1={x1} y1={y} x2={x2} y2={y} stroke={color} strokeWidth="1.8" />
      <line x1={x1} y1={y} x2={x1} y2={y + 10} stroke={color} strokeWidth="1.5" />
      <line x1={x2} y1={y} x2={x2} y2={y + 10} stroke={color} strokeWidth="1.5" />
      <text x={(x1 + x2) / 2} y={y - 6} textAnchor="middle" fontSize="11" fill={color} fontWeight="600">
        {label}
      </text>
    </>
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
  const longPlateY = top + 8;
  const shortPlateY = top + 26;

  return (
    <>
      <line x1={x} y1={top} x2={x} y2={longPlateY} stroke={stroke} strokeWidth="2" />
      <line x1={x - 12} y1={longPlateY} x2={x + 12} y2={longPlateY} stroke={stroke} strokeWidth="2.2" />
      <line x1={x - 8} y1={shortPlateY} x2={x + 8} y2={shortPlateY} stroke={stroke} strokeWidth="1.6" />
      <line x1={x} y1={shortPlateY} x2={x} y2={bottom} stroke={stroke} strokeWidth="2" />
    </>
  );
}

function MeterSymbol({
  center,
  letter,
  stroke,
  accent,
  accentRatio,
}: {
  center: { x: number; y: number };
  letter: string;
  stroke: string;
  accent: string;
  accentRatio: number;
}) {
  return (
    <>
      <circle cx={center.x} cy={center.y} r="22" fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
      <circle
        cx={center.x}
        cy={center.y}
        r="18"
        fill="none"
        stroke={accent}
        strokeWidth={1.4 + accentRatio * 2.2}
        style={{ opacity: 0.3 + accentRatio * 0.7, animation: 'meter-soft-pulse 1.4s ease-in-out infinite' }}
      />
      <text x={center.x} y={center.y + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill={stroke}>
        {letter}
      </text>
    </>
  );
}

function VerticalResistor({
  x,
  y,
  width,
  height,
  label,
  stroke,
  accent,
  accentRatio,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  stroke: string;
  accent: string;
  accentRatio: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
      <rect x={x + 3} y={y + 3} width={width - 6} height={height - 6} fill={accent} opacity={0.08 + accentRatio * 0.2} />
      <text x={x + width / 2} y={y + height / 2 + 4} textAnchor="middle" fontSize="14" fill={stroke} fontWeight="600">
        {label}
      </text>
    </>
  );
}

function HorizontalResistor({
  x,
  y,
  width,
  height,
  label,
  stroke,
  accent,
  accentRatio,
}: {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  stroke: string;
  accent: string;
  accentRatio: number;
}) {
  return (
    <>
      <rect x={x} y={y} width={width} height={height} fill="#FFFFFF" stroke={stroke} strokeWidth="2" />
      <rect x={x + 3} y={y + 3} width={(width - 6) * Math.min(Math.max(accentRatio, 0.08), 1)} height={height - 6} fill={accent} opacity={0.18} />
      <text x={x + width / 2} y={y + height / 2 + 5} textAnchor="middle" fontSize="15" fill={stroke} fontWeight="600">
        {label}
      </text>
    </>
  );
}

function NodeDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="2.8" fill="#111827" />;
}

function ValueChip({ x, y, text, color }: { x: number; y: number; text: string; color: string }) {
  const width = Math.max(118, text.length * 6.5 + 16);

  return (
    <g transform={`translate(${x}, ${y})`}>
      <rect x={-width / 2} y="-12" width={width} height="24" rx="12" fill={`${color}12`} stroke={`${color}55`} />
      <text x="0" y="4" textAnchor="middle" fontSize="10" fill={color} fontWeight="600">
        {text}
      </text>
    </g>
  );
}

function LegendPill({ label, color, hollow = false }: { label: string; color: string; hollow?: boolean }) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]"
      style={{ backgroundColor: hollow ? pageStyle.blockSoft : `${color}12`, color: pageStyle.text }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: hollow ? '#FFFFFF' : color,
          border: `1.8px solid ${color}`,
        }}
      />
      {label}
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
          className="grid grid-cols-[minmax(0,38%)_minmax(0,62%)] gap-2 px-2.5 py-2"
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

function InfoBlock({ title, color, lines }: { title: string; color: string; lines: string[] }) {
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
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[11px]" style={{ color: pageStyle.secondary }}>
          {label}
        </span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={roundToStep(value, step)}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isNaN(next)) onChange(clamp(next, min, max));
            }}
            className="w-24 rounded border px-1.5 py-0.5 text-right text-[11px]"
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

function buildCurrentStatusRows(result: ActiveResult): DetailRow[] {
  if (result.mode === 'ammeter') {
    return [
      { label: '当前量程', value: `I = ${formatCurrent(result.targetRange)}` },
      { label: '原表头满偏', value: `Ig = ${formatCurrent(result.originalFullScale)}` },
      { label: '当前 Rs', value: formatResistance(result.actualAccessoryResistance, 3) },
      { label: '目标工作点', value: `I = ${formatCurrent(result.operatingInput)}` },
      { label: '电流分配', value: `Ig = ${formatCurrent(result.meterCurrent)}，Is = ${formatCurrent(result.shuntCurrent)}` },
      { label: '机械偏转', value: `${(result.pointerRatio * 100).toFixed(1)}%` },
      { label: '改装后示数', value: formatCurrent(result.indicatedValue), accent: MODE_META.ammeter.accent },
    ];
  }

  return [
    { label: '当前量程', value: `U = ${formatVoltage(result.targetRange)}` },
    { label: '原表头满偏', value: `Ug = ${formatVoltage(result.originalFullScale)}` },
    { label: '当前 Rv', value: formatResistance(result.actualAccessoryResistance, 1) },
    { label: '目标工作点', value: `U = ${formatVoltage(result.operatingInput)}` },
    { label: '电压分配', value: `Ug = ${formatVoltage(result.meterVoltage)}，Uv = ${formatVoltage(result.accessoryVoltage)}` },
    { label: '机械偏转', value: `${(result.pointerRatio * 100).toFixed(1)}%` },
    { label: '改装后示数', value: formatVoltage(result.indicatedValue), accent: MODE_META.voltmeter.accent },
  ];
}

function buildWarningRows(result: ActiveResult): DetailRow[] {
  if (result.mode === 'ammeter') {
    const deviation = getSignedDeviation(result);
    return [
      {
        label: '当前偏差',
        value: deviation > 0
          ? 'Rs 比理论值偏大，分流不足，表头电流偏大。'
          : deviation < 0
            ? 'Rs 比理论值偏小，分流更强，读数偏小但更安全。'
            : 'Rs 与理论值一致，理想线与实际线重合。',
      },
      {
        label: '风险状态',
        value: result.isUnsafe
          ? '表头电流已超过满偏约 105%，继续增大电流会有过载风险。'
          : result.isOverRange
            ? '当前已超程，机械指针只能停在末端。'
            : '若长期工作，建议让工作点低于满偏附近。',
        accent: result.isUnsafe ? COLORS.error : result.isOverRange ? COLORS.warning : undefined,
      },
      {
        label: '工程提醒',
        value: '真正危险的是 Rs 偏大、接触不良或分流支路断开，而不是单纯 Rs 更小。',
      },
    ];
  }

  const deviation = getSignedDeviation(result);
  return [
    {
      label: '当前偏差',
      value: deviation < 0
        ? 'Rv 比理论值偏小，限流不足，表头电流偏大。'
        : deviation > 0
          ? 'Rv 比理论值偏大，总电阻增大，表头电流偏小。'
          : 'Rv 与理论值一致，理想线与实际线重合。',
    },
    {
      label: '风险状态',
      value: result.isUnsafe
        ? '表头电流已超过额定满偏值，继续升高电压会有过载风险。'
        : result.isOverRange
          ? '当前已超程，表盘只能停在满刻度附近。'
          : '如需更高安全余量，可适当提高总内阻。',
      accent: result.isUnsafe ? COLORS.error : result.isOverRange ? COLORS.warning : undefined,
    },
    {
      label: '工程提醒',
      value: '电压表改装真正危险的是限流电阻偏小或短接，不是电阻偏大。',
    },
  ];
}

function buildEngineeringRows(result: ActiveResult): DetailRow[] {
  if (result.mode === 'ammeter') {
    return [
      { label: '等效内阻 Req', value: formatResistance(result.loadResistance, 3) },
      { label: '表头功耗 Pg', value: formatPower(result.meterPower) },
      { label: '分流电阻功耗 Ps', value: formatPower(result.accessoryPower) },
      { label: '量程倍率 n', value: result.rangeMultiplier.toFixed(1) },
      { label: '理想近似', value: 'Req ≈ Rg / n' },
    ];
  }

  return [
    { label: '输入电阻 Rin', value: formatResistance(result.inputResistanceActual, 1) },
    { label: '表头功耗 Pg', value: formatPower(result.meterPower) },
    { label: '串联电阻功耗 Pv', value: formatPower(result.accessoryPower) },
    { label: '理想灵敏度', value: `${formatResistance(result.sensitivityOhmsPerVoltIdeal, 0)}/V` },
    { label: '当前灵敏度', value: `${formatResistance(result.sensitivityOhmsPerVoltActual, 0)}/V` },
  ];
}

function getSignedDeviation(result: ActiveResult): number {
  return result.actualAccessoryResistance - result.idealAccessoryResistance;
}

function buildLinePath<T>(points: T[], getX: (point: T) => number, getY: (point: T) => number): string {
  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${getX(point).toFixed(2)} ${getY(point).toFixed(2)}`)
    .join(' ');
}

function getAmmeterTargetBounds(ig: number): { min: number; max: number } {
  const min = Math.max(ig * 1.2, ig + 0.002);
  const max = Math.max(min + ig, 5);
  return { min, max };
}

function getVoltmeterTargetBounds(rg: number, ig: number): { min: number; max: number } {
  const ug = rg * ig;
  const min = Math.max(ug * 1.2, ug + 0.5);
  const max = Math.max(min + ug, 300);
  return { min, max };
}

function getAmmeterExtraBounds(rg: number, ig: number, targetCurrent: number): { min: number; max: number } {
  const idealRs = (ig / Math.max(targetCurrent - ig, 1e-9)) * rg;
  return {
    min: -Math.max(idealRs * 0.6, 0.02),
    max: Math.max(idealRs * 0.85, rg * 0.2, 0.05),
  };
}

function getVoltmeterExtraBounds(rg: number, ig: number, targetVoltage: number): { min: number; max: number } {
  const idealRv = targetVoltage / Math.max(ig, 1e-9) - rg;
  return {
    min: -Math.max(idealRv * 0.6, rg, 10),
    max: Math.max(idealRv * 0.25, rg * 3, 25),
  };
}

function clampAmmeterParams(params: AmmeterPageParams): AmmeterPageParams {
  const rg = clamp(params.rg, 5, 2000);
  const ig = clamp(params.ig, 0.00005, 0.02);
  const targetBounds = getAmmeterTargetBounds(ig);
  const targetCurrent = clamp(params.targetCurrent, targetBounds.min, targetBounds.max);
  const extraBounds = getAmmeterExtraBounds(rg, ig, targetCurrent);

  return {
    rg,
    ig,
    targetCurrent,
    operatingCurrent: clamp(params.operatingCurrent, 0, targetCurrent * 1.2),
    extraResistance: clamp(params.extraResistance, extraBounds.min, extraBounds.max),
  };
}

function clampVoltmeterParams(params: VoltmeterPageParams): VoltmeterPageParams {
  const rg = clamp(params.rg, 5, 2000);
  const ig = clamp(params.ig, 0.00005, 0.02);
  const targetBounds = getVoltmeterTargetBounds(rg, ig);
  const targetVoltage = clamp(params.targetVoltage, targetBounds.min, targetBounds.max);
  const extraBounds = getVoltmeterExtraBounds(rg, ig, targetVoltage);

  return {
    rg,
    ig,
    targetVoltage,
    operatingVoltage: clamp(params.operatingVoltage, 0, targetVoltage * 1.2),
    extraResistance: clamp(params.extraResistance, extraBounds.min, extraBounds.max),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function currentStep(value: number): number {
  if (value < 0.02) return 0.0001;
  if (value < 0.2) return 0.001;
  if (value < 1) return 0.01;
  return 0.05;
}

function voltageStep(value: number): number {
  if (value < 10) return 0.1;
  if (value < 50) return 0.5;
  return 1;
}

function resistanceStep(value: number): number {
  if (value < 1) return 0.01;
  if (value < 10) return 0.1;
  if (value < 100) return 1;
  if (value < 1000) return 5;
  return 10;
}

function roundToStep(value: number, step: number): number {
  const precision = getStepPrecision(step);
  return Number(value.toFixed(precision));
}

function getStepPrecision(step: number): number {
  const normalized = step.toString();
  if (!normalized.includes('.')) return 0;
  return normalized.split('.')[1]?.length ?? 0;
}

function formatResistance(value: number, digits = 1): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(digits > 0 ? digits : 1)} kΩ`;
  if (Math.abs(value) >= 1) return `${value.toFixed(digits)} Ω`;
  return `${(value * 1000).toFixed(Math.max(digits, 1))} mΩ`;
}

function formatCurrent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1) return `${value.toFixed(3)} A`;
  if (abs >= 0.001) return `${(value * 1000).toFixed(abs < 0.01 ? 2 : 1)} mA`;
  return `${(value * 1000000).toFixed(0)} μA`;
}

function formatVoltage(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1) return `${value.toFixed(2)} V`;
  return `${(value * 1000).toFixed(0)} mV`;
}

function formatPower(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1) return `${value.toFixed(2)} W`;
  if (Math.abs(value) >= 0.001) return `${(value * 1000).toFixed(1)} mW`;
  return `${(value * 1000000).toFixed(0)} μW`;
}

function formatSignedPercent(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function formatAxisNumber(value: number, kind: 'current' | 'voltage'): string {
  if (kind === 'current') {
    if (value < 1) return value.toFixed(value < 0.1 ? 2 : 1);
    return value.toFixed(1);
  }
  return value.toFixed(value < 10 ? 1 : 0);
}

function formatScaleLabel(value: number, kind: MeterConversionMode | 'ammeter-original' | 'voltmeter-original'): string {
  if (kind === 'ammeter') {
    if (value < 1) return value.toFixed(value < 0.1 ? 2 : 1);
    return value.toFixed(1);
  }
  if (kind === 'ammeter-original') {
    return `${(value * 1000).toFixed(value < 0.001 ? 2 : 1)}mA`;
  }
  if (kind === 'voltmeter') {
    return value.toFixed(value < 10 ? 1 : 0);
  }
  return value.toFixed(value < 1 ? 2 : 1);
}
