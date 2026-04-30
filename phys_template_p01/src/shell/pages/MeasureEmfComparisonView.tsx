import { useMemo, useState, type ReactNode } from 'react';
import { COLORS } from '@/styles/tokens';
import {
  calculateMeasureEmfComparison,
  type MeasureEmfCompareMode,
  type MeasureEmfCompareParams,
  type MeasureEmfCompareResult,
  type MeasureEmfPoint,
  type MeasureEmfSeriesResult,
} from '@/domains/em/logic/measure-emf-r-comparison';

const DEFAULT_PARAMS: MeasureEmfCompareParams = {
  emf: 4.5,
  internalResistance: 0.5,
  ammeterResistance: 0.1,
  voltmeterResistance: 15000,
  maxResistance: 50,
  sliderRatio: 0.5,
  sampleCount: 8,
};

const SERIES_META: Record<
  MeasureEmfCompareMode,
  { label: string; short: string; color: string; note: string; conclusion: string }
> = {
  ideal: {
    label: '理想参照',
    short: '理想',
    color: '#2563EB',
    note: '理想电表只显示真值链路，A 读主回路电流 I，V 读电源端电压 U_PN。',
    conclusion: '真线：截距 = ε，斜率 = -r',
  },
  inner: {
    label: '内接法',
    short: '内接',
    color: '#D97706',
    note: 'A 串在主回路外侧，V 跨接外电路两端，读数关系为 A 读 I、V 读 U_AB。',
    conclusion: "结论：ε'≈ε，r' = r + rA",
  },
  outer: {
    label: '外接法',
    short: '外接',
    color: '#059669',
    note: 'V 跨接电源端子 P/N，A 只读负载支路电流，读数关系为 A 读 I_A、V 读 U_PN。',
    conclusion: "结论：ε'、r' 均偏小",
  },
};

const CURRENT_COLOR = '#D97706';
const VOLTAGE_COLOR = '#2563EB';
const SOURCE_COLOR = '#BE123C';
const NODE_COLOR = '#0F172A';

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
  onOpenPreset: () => void;
}

interface ModePresentationState {
  mode: MeasureEmfCompareMode;
  point: MeasureEmfPoint;
  currentResistance: number;
  totalCurrent: number;
  ammeterCurrent: number;
  voltmeterCurrent: number;
  terminalVoltage: number;
  internalDrop: number;
  loadVoltage: number;
  loadCurrent: number;
  ammeterDrop: number;
  measuredCurrentLabel: string;
  measuredVoltageLabel: string;
  meterCurrentMeaning: string;
  meterVoltageMeaning: string;
  sourceFormulaLines: string[];
  measurementFormulaLines: string[];
  modeSummaryLines: string[];
}

export function MeasureEmfComparisonView({ onBack, onOpenPreset }: Props) {
  const [params, setParams] = useState<MeasureEmfCompareParams>(DEFAULT_PARAMS);
  const [activeMode, setActiveMode] = useState<MeasureEmfCompareMode>('inner');

  const result = useMemo(() => calculateMeasureEmfComparison(params), [params]);
  const activeState = useMemo(
    () => buildModePresentationState(activeMode, params, result),
    [activeMode, params, result],
  );

  const set = (key: keyof MeasureEmfCompareParams, value: number) => {
    setParams((prev) => ({ ...prev, [key]: value }));
  };

  const applyPreset = (partial: Partial<MeasureEmfCompareParams>) => {
    setParams((prev) => ({ ...prev, ...partial }));
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
          style={{
            color: pageStyle.text,
            border: `1px solid ${pageStyle.border}`,
            backgroundColor: pageStyle.blockBg,
          }}
        >
          ← 返回
        </button>
        <button
          onClick={onOpenPreset}
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
          测电源电动势和内阻 · 内外接误差对比
        </h1>
        <span className="text-[11px]" style={{ color: pageStyle.muted }}>
          统一用节点、电流方向和工作点解释仪表读数，不再只摆静态电路图
        </span>
      </header>

      <div className="flex min-h-0 flex-1">
        <LeftPanel
          params={params}
          currentResistance={result.currentResistance}
          onChange={set}
          applyPreset={applyPreset}
        />
        <CenterPanel
          result={result}
          params={params}
          activeMode={activeMode}
          activeState={activeState}
          onChangeMode={setActiveMode}
        />
        <RightPanel
          result={result}
          params={params}
          activeMode={activeMode}
          activeState={activeState}
        />
      </div>
    </div>
  );
}

function LeftPanel({
  params,
  currentResistance,
  onChange,
  applyPreset,
}: {
  params: MeasureEmfCompareParams;
  currentResistance: number;
  onChange: (key: keyof MeasureEmfCompareParams, value: number) => void;
  applyPreset: (partial: Partial<MeasureEmfCompareParams>) => void;
}) {
  return (
    <div
      className="flex w-[286px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: pageStyle.panelSoft, borderRight: `1px solid ${pageStyle.border}` }}
    >
      <div className="p-4">
        <div
          className="mb-3 rounded-lg p-3"
          style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
        >
          <div className="text-xs font-semibold" style={{ color: pageStyle.text }}>
            当前负载工作阻值 R
          </div>
          <div
            className="mt-1 text-[18px] font-semibold"
            style={{ color: pageStyle.accent, fontVariantNumeric: 'tabular-nums' }}
          >
            {formatResistanceFixed(currentResistance)}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.6 }}>
            由滑动变阻器最大阻值和滑片位置共同决定。参数变化后，电路、电表读数和 U-I 图的工作点都会同步刷新。
          </div>
        </div>

        <SectionTitle title="预设场景" />
        <div className="mb-4 flex flex-wrap gap-2">
          <PresetButton label="标准教学" onClick={() => applyPreset(DEFAULT_PARAMS)} />
          <PresetButton
            label="突出 A 表影响"
            onClick={() => applyPreset({ ammeterResistance: 0.5, voltmeterResistance: 15000 })}
          />
          <PresetButton
            label="突出 V 表影响"
            onClick={() => applyPreset({ ammeterResistance: 0.1, voltmeterResistance: 3000 })}
          />
        </div>

        <SectionTitle title="电源参数" />
        <RangeControl
          label="电动势 ε"
          value={params.emf}
          min={1}
          max={12}
          step={0.1}
          unit="V"
          onChange={(value) => onChange('emf', value)}
        />
        <RangeControl
          label="内阻 r"
          value={params.internalResistance}
          min={0.1}
          max={5}
          step={0.1}
          unit="Ω"
          onChange={(value) => onChange('internalResistance', value)}
        />

        <SectionTitle title="仪表参数" />
        <RangeControl
          label="电流表内阻 rA"
          value={params.ammeterResistance}
          min={0.01}
          max={1}
          step={0.01}
          unit="Ω"
          onChange={(value) => onChange('ammeterResistance', value)}
        />
        <RangeControl
          label="电压表内阻 rV"
          value={params.voltmeterResistance}
          min={1000}
          max={30000}
          step={100}
          unit="Ω"
          onChange={(value) => onChange('voltmeterResistance', value)}
        />

        <SectionTitle title="滑动变阻器" />
        <RangeControl
          label="最大阻值"
          value={params.maxResistance}
          min={10}
          max={200}
          step={1}
          unit="Ω"
          onChange={(value) => onChange('maxResistance', value)}
        />
        <RangeControl
          label="滑片位置"
          value={params.sliderRatio}
          min={0.05}
          max={1}
          step={0.01}
          unit=""
          onChange={(value) => onChange('sliderRatio', value)}
        />
      </div>
    </div>
  );
}

function CenterPanel({
  result,
  params,
  activeMode,
  activeState,
  onChangeMode,
}: {
  result: MeasureEmfCompareResult;
  params: MeasureEmfCompareParams;
  activeMode: MeasureEmfCompareMode;
  activeState: ModePresentationState;
  onChangeMode: (mode: MeasureEmfCompareMode) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ backgroundColor: pageStyle.panelBg }}>
      <div
        className="px-4 py-3 text-[11px] leading-6"
        style={{ borderBottom: `1px solid ${pageStyle.border}`, color: pageStyle.secondary }}
      >
        当前统一规定主回路正方向为 <strong>P → A → B → N（顺时针）</strong>。图中橙色箭头、A 表读数和公式中的电流均按这个方向取正；
        每个电压都写出被测两端，例如 <strong>U_PN</strong>、<strong>U_AB</strong>。
      </div>

      <div className="space-y-4 p-4">
        <div
          className="rounded-xl border p-5"
          style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}
        >
          <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                电路表达与当前工作状态
              </div>
              <div className="mt-1 text-[11px] leading-6" style={{ color: pageStyle.muted }}>
                先明确“仪表量什么”，再看电源的真值链路 <strong>I = ε / (R_eq + r)</strong> 与 <strong>U_PN = ε - I_total r</strong>。
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {(['ideal', 'inner', 'outer'] as MeasureEmfCompareMode[]).map((mode) => (
                <ModePill key={mode} mode={mode} active={mode === activeMode} onClick={() => onChangeMode(mode)} />
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_296px]">
            <MeasureCircuitBoard state={activeState} params={params} />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
              <HighlightMetric
                label={`A表 · ${activeState.measuredCurrentLabel}`}
                value={formatCurrentFixed(activeState.ammeterCurrent)}
                description={activeState.meterCurrentMeaning}
                color={CURRENT_COLOR}
              />
              <HighlightMetric
                label={`V表 · ${activeState.measuredVoltageLabel}`}
                value={formatVoltageFixed(activeState.point.U)}
                description={activeState.meterVoltageMeaning}
                color={VOLTAGE_COLOR}
              />
              <HighlightMetric
                label="电源总电流 I_total"
                value={formatCurrentFixed(activeState.totalCurrent)}
                description="用于计算内阻压降和端电压，不一定等于 A 表读数。"
                color={SERIES_META[activeMode].color}
              />
              <HighlightMetric
                label="端电压 U_PN"
                value={formatVoltageFixed(activeState.terminalVoltage)}
                description="电源对外端子真实输出电压，始终满足 U_PN = ε - I_total r。"
                color={SOURCE_COLOR}
              />
              <HighlightMetric
                label="内阻压降 I_total r"
                value={formatVoltageFixed(activeState.internalDrop)}
                description="这是电源内部损失的电压，ε 与 U_PN 的差就在这里。"
                color="#B45309"
              />
            </div>
          </div>
        </div>

        <div
          className="rounded-xl border p-5"
          style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}
        >
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                电表读数 U-I 图线与当前工作点
              </div>
              <div className="mt-1 text-[11px] leading-6" style={{ color: pageStyle.muted }}>
                三条线都保留，但当前接法会被高亮；工作点用十字投影和坐标标注，参数变化时实时移动。
              </div>
            </div>
            <div className="text-[11px] md:max-w-[42%] md:text-right" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
              当前高亮：{SERIES_META[activeMode].label}，横轴对应 A 表读数 <strong>{activeState.measuredCurrentLabel}</strong>，
              纵轴对应 V 表读数 <strong>{activeState.measuredVoltageLabel}</strong>。
            </div>
          </div>

          <div className="mt-4">
            <MeasureComparisonChart result={result} activeMode={activeMode} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RightPanel({
  result,
  params,
  activeMode,
  activeState,
}: {
  result: MeasureEmfCompareResult;
  params: MeasureEmfCompareParams;
  activeMode: MeasureEmfCompareMode;
  activeState: ModePresentationState;
}) {
  const bestEmfText =
    result.bestForEmf === 'equal'
      ? '内接与外接对 ε 的误差接近。'
      : `测电动势 ε 更接近真值的是${result.bestForEmf === 'inner' ? '内接法' : '外接法'}。`;
  const bestRText =
    result.bestForR === 'equal'
      ? '内接与外接对 r 的误差接近。'
      : `测内阻 r 更接近真值的是${result.bestForR === 'inner' ? '内接法' : '外接法'}。`;

  return (
    <div
      className="flex w-[356px] shrink-0 flex-col overflow-y-auto"
      style={{ backgroundColor: pageStyle.panelBg, borderLeft: `1px solid ${pageStyle.border}` }}
    >
      <div className="flex flex-col gap-4 p-4">
        <RightPanelCard title="当前公式链">
          <FormulaBlock title="源方程" color={SOURCE_COLOR} lines={activeState.sourceFormulaLines} />
          <FormulaBlock
            title={`${SERIES_META[activeMode].label} · 仪表映射`}
            color={SERIES_META[activeMode].color}
            lines={activeState.measurementFormulaLines}
          />
        </RightPanelCard>

        <RightPanelCard title="当前工作点对比">
          <CurrentPointTable result={result} activeMode={activeMode} />
        </RightPanelCard>

        <RightPanelCard title="拟合结果对比">
          <FitComparisonTable result={result} activeMode={activeMode} />
        </RightPanelCard>

        <RightPanelCard title="截距 ε 误差">
          <MetricBar
            label="内接法"
            color={SERIES_META.inner.color}
            value={result.inner.emfErrorPercent}
            recommended={result.bestForEmf === 'inner'}
          />
          <MetricBar
            label="外接法"
            color={SERIES_META.outer.color}
            value={result.outer.emfErrorPercent}
            recommended={result.bestForEmf === 'outer'}
          />
        </RightPanelCard>

        <RightPanelCard title="斜率对应 r 误差">
          <MetricBar
            label="内接法"
            color={SERIES_META.inner.color}
            value={result.inner.rErrorPercent}
            recommended={result.bestForR === 'inner'}
          />
          <MetricBar
            label="外接法"
            color={SERIES_META.outer.color}
            value={result.outer.rErrorPercent}
            recommended={result.bestForR === 'outer'}
          />
        </RightPanelCard>

        <RightPanelCard
          title="当前接法判读"
          accentColor={SERIES_META[activeMode].color}
          backgroundColor={`${SERIES_META[activeMode].color}10`}
          borderColor={`${SERIES_META[activeMode].color}35`}
        >
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.85 }}>
            {activeState.modeSummaryLines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </div>
        </RightPanelCard>

        <RightPanelCard
          title="整体比较结论"
          accentColor={pageStyle.accent}
          backgroundColor={pageStyle.accentSoft}
          borderColor={`${pageStyle.accent}55`}
        >
          <div className="text-[11px]" style={{ color: pageStyle.secondary, lineHeight: 1.85 }}>
            <div>{bestEmfText}</div>
            <div>{bestRText}</div>
            <div>真值始终由参数给出：ε={formatVoltageFixed(params.emf)}，r={formatResistanceFixed(params.internalResistance)}。</div>
            <div>图线比较的是各接法下“电表读数对”的线性关系，而不是直接比较源本身的真值。</div>
          </div>
        </RightPanelCard>

        <RightPanelCard title="采样点列表">
          <MeasureSampleTable result={result} />
        </RightPanelCard>
      </div>
    </div>
  );
}

function MeasureCircuitBoard({
  state,
  params,
}: {
  state: ModePresentationState;
  params: MeasureEmfCompareParams;
}) {
  const mode = state.mode;
  const modeColor = SERIES_META[mode].color;
  const viewWidth = 620;
  const viewHeight = 332;
  const leftX = 72;
  const rightX = 544;
  const topY = 92;
  const bottomY = 252;
  const batteryTop = 128;
  const batteryBottom = 162;
  const meterRadius = 22;
  const ammeterCenter = { x: 184, y: topY };
  const resistor = { x: 284, y: topY - 16, width: 124, height: 32 };
  const pNode = { x: leftX, y: topY };
  const nNode = { x: leftX, y: bottomY };
  const aNode = { x: resistor.x, y: topY };
  const bNode = { x: resistor.x + resistor.width, y: topY };
  const innerMeterCenter = { x: 346, y: 188 };
  const outerMeterCenter = { x: 160, y: 172 };
  const displayedMeterCenter = mode === 'inner' ? innerMeterCenter : outerMeterCenter;
  const currentArrowId = `measure-current-${mode}`;
  const voltageArrowId = `measure-voltage-${mode}`;

  return (
    <svg
      viewBox={`0 0 ${viewWidth} ${viewHeight}`}
      style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }}
      aria-label="测电源电动势和内阻电路图"
    >
      <defs>
        <marker id={currentArrowId} viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={CURRENT_COLOR} />
        </marker>
        <marker id={voltageArrowId} viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="6" markerHeight="6" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill={VOLTAGE_COLOR} />
        </marker>
        <filter id={`active-point-glow-${mode}`}>
          <feGaussianBlur stdDeviation="2.2" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      <rect x="1" y="1" width={viewWidth - 2} height={viewHeight - 2} rx="18" fill="#FCFCFD" stroke={pageStyle.border} />

      <text x="28" y="30" fontSize="12" fontWeight="700" fill={pageStyle.text}>
        {SERIES_META[mode].label}
      </text>
      <text x="28" y="50" fontSize="11" fill={pageStyle.muted}>
        正方向统一定义为 P → A → B → N（顺时针）
      </text>

      <path d={`M ${pNode.x} ${topY} H ${ammeterCenter.x - meterRadius}`} stroke="#111827" strokeWidth="2.2" fill="none" />
      <path d={`M ${ammeterCenter.x + meterRadius} ${topY} H ${resistor.x}`} stroke="#111827" strokeWidth="2.2" fill="none" />
      <path d={`M ${resistor.x + resistor.width} ${topY} H ${rightX} V ${bottomY} H ${leftX}`} stroke="#111827" strokeWidth="2.2" fill="none" />
      <path d={`M ${leftX} ${topY} V ${batteryTop}`} stroke="#111827" strokeWidth="2.2" fill="none" />
      <path d={`M ${leftX} ${batteryBottom} V ${bottomY}`} stroke="#111827" strokeWidth="2.2" fill="none" />

      <line
        x1={110}
        y1={topY - 24}
        x2={430}
        y2={topY - 24}
        stroke={CURRENT_COLOR}
        strokeWidth="2.8"
        markerEnd={`url(#${currentArrowId})`}
      />
      <text x="266" y={topY - 34} textAnchor="middle" fontSize="11" fontWeight="700" fill={CURRENT_COLOR}>
        {state.measuredCurrentLabel}
      </text>
      <line
        x1={484}
        y1={bottomY + 22}
        x2={182}
        y2={bottomY + 22}
        stroke={CURRENT_COLOR}
        strokeWidth="2.4"
        markerEnd={`url(#${currentArrowId})`}
        opacity="0.8"
      />

      {mode === 'inner' ? (
        <>
          <path
            d={`M ${aNode.x} ${topY} V 128 H ${innerMeterCenter.x - meterRadius} V ${innerMeterCenter.y - meterRadius}`}
            stroke={VOLTAGE_COLOR}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M ${bNode.x} ${topY} V 128 H ${innerMeterCenter.x + meterRadius} V ${innerMeterCenter.y - meterRadius}`}
            stroke={VOLTAGE_COLOR}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <text x={346} y="118" textAnchor="middle" fontSize="11" fontWeight="700" fill={VOLTAGE_COLOR}>
            V 读 U_AB
          </text>
          <line
            x1={aNode.x + 10}
            y1={136}
            x2={bNode.x - 10}
            y2={136}
            stroke={VOLTAGE_COLOR}
            strokeWidth="2"
            markerEnd={`url(#${voltageArrowId})`}
          />
        </>
      ) : (
        <>
          <path
            d={`M ${pNode.x} ${topY} H ${outerMeterCenter.x - meterRadius} V ${outerMeterCenter.y - meterRadius}`}
            stroke={VOLTAGE_COLOR}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <path
            d={`M ${nNode.x} ${bottomY} H ${outerMeterCenter.x - meterRadius} V ${outerMeterCenter.y + meterRadius}`}
            stroke={VOLTAGE_COLOR}
            strokeWidth="2.4"
            fill="none"
            strokeLinecap="round"
          />
          <text x="164" y="142" textAnchor="middle" fontSize="11" fontWeight="700" fill={VOLTAGE_COLOR}>
            V 读 U_PN
          </text>
          <line
            x1={96}
            y1={topY + 14}
            x2={96}
            y2={bottomY - 14}
            stroke={VOLTAGE_COLOR}
            strokeWidth="2"
            markerEnd={`url(#${voltageArrowId})`}
          />
        </>
      )}

      <BatterySymbol x={leftX} top={batteryTop} bottom={batteryBottom} stroke="#111827" />
      <MeterSymbol
        center={ammeterCenter}
        letter="A"
        stroke="#111827"
        accent={CURRENT_COLOR}
        sublabel={state.measuredCurrentLabel}
      />
      <VariableResistorSymbol x={resistor.x} y={resistor.y} width={resistor.width} height={resistor.height} stroke="#111827" />
      <MeterSymbol
        center={displayedMeterCenter}
        letter="V"
        stroke="#111827"
        accent={VOLTAGE_COLOR}
        sublabel={state.measuredVoltageLabel}
      />

      <NodeDot x={pNode.x} y={pNode.y} />
      <NodeDot x={nNode.x} y={nNode.y} />
      <NodeDot x={aNode.x} y={aNode.y} />
      <NodeDot x={bNode.x} y={bNode.y} />

      <NodePill x={pNode.x - 18} y={pNode.y - 24} label="P(+)" />
      <NodePill x={nNode.x - 18} y={nNode.y + 30} label="N(-)" />
      <NodePill x={aNode.x - 10} y={aNode.y - 28} label="A" />
      <NodePill x={bNode.x + 10} y={bNode.y - 28} label="B" />

      <CircuitBadge x="430" y="44" width="166" title="电源真值" lines={[
        `ε = ${formatVoltageFixed(params.emf)}`,
        `r = ${formatResistanceFixed(params.internalResistance)}`,
        `U_PN = ${formatVoltageFixed(state.terminalVoltage)}`,
        `I_total r = ${formatVoltageFixed(state.internalDrop)}`,
      ]} accent={SOURCE_COLOR} />

      <CircuitBadge
        x="432"
        y="164"
        width="164"
        title="当前读数"
        lines={[
          `A: ${state.measuredCurrentLabel} = ${formatCurrentFixed(state.ammeterCurrent)}`,
          `V: ${state.measuredVoltageLabel} = ${formatVoltageFixed(state.point.U)}`,
          `R = ${formatResistanceFixed(state.currentResistance)}`,
        ]}
        accent={modeColor}
      />

      <text x={resistor.x + resistor.width / 2} y={resistor.y - 14} textAnchor="middle" fontSize="11" fill={pageStyle.secondary}>
        滑动变阻器等效负载 R
      </text>
      <text x={leftX + 30} y={batteryBottom + 26} fontSize="11" fill={pageStyle.secondary}>
        理想电动势 ε 与内阻 r
      </text>

      <foreignObject x="32" y="280" width="556" height="34">
        <div
          style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            fontSize: '10px',
            lineHeight: '16px',
            color: pageStyle.secondary,
          }}
        >
          <InlineLegend color={CURRENT_COLOR} text={`${state.measuredCurrentLabel} 定义为沿主回路顺时针为正`} />
          <InlineLegend color={VOLTAGE_COLOR} text={`V 表只显示 ${state.measuredVoltageLabel}，必须和节点定义对应`} />
        </div>
      </foreignObject>
    </svg>
  );
}

function MeasureComparisonChart({
  result,
  activeMode,
}: {
  result: MeasureEmfCompareResult;
  activeMode: MeasureEmfCompareMode;
}) {
  const allSeries = [result.ideal, result.inner, result.outer];
  const allPoints = allSeries.flatMap((series) => [...series.samples, series.current]);
  const maxI = Math.max(0.5, ...allPoints.map((point) => point.I)) * 1.1;
  const maxIntercept = Math.max(1, ...allSeries.map((series) => series.fit?.emf ?? 0));
  const maxU = Math.max(1, maxIntercept, ...allPoints.map((point) => point.U)) * 1.1;
  const minZoomI = Math.min(...allPoints.map((point) => point.I));
  const maxZoomI = Math.max(...allPoints.map((point) => point.I));
  const minZoomU = Math.min(...allPoints.map((point) => point.U));
  const maxZoomU = Math.max(...allPoints.map((point) => point.U));
  const zoomIPad = Math.max((maxZoomI - minZoomI) * 0.16, 0.015);
  const zoomUPad = Math.max((maxZoomU - minZoomU) * 0.2, 0.015);
  const zoomXMin = Math.max(0, minZoomI - zoomIPad);
  const zoomXMax = maxZoomI + zoomIPad;
  const zoomYMin = Math.max(0, minZoomU - zoomUPad);
  const zoomYMax = maxZoomU + zoomUPad;
  const zoomAmplification = (maxU - 0) / Math.max(zoomYMax - zoomYMin, 1e-6);
  const xTicks = 6;
  const yTicks = 5;
  const activeSeries = getSeriesByMode(result, activeMode);

  const plots = [
    {
      key: 'full',
      title: '完整 U-I 图线',
      note: '保留完整截距与斜率，便于看出真线和误差线的整体差异。',
      xMin: 0,
      xMax: maxI,
      yMin: 0,
      yMax: maxU,
      viewHeight: 300,
      plot: { x: 76, y: 22, w: 560, h: 202 },
    },
    {
      key: 'zoom',
      title: '工作点局部放大',
      note: `自动放大约 ${zoomAmplification.toFixed(1)}×，直接观察当前滑片位置下的读数差异。`,
      xMin: zoomXMin,
      xMax: zoomXMax,
      yMin: zoomYMin,
      yMax: zoomYMax,
      viewHeight: 308,
      plot: { x: 76, y: 24, w: 560, h: 208 },
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        {(['ideal', 'inner', 'outer'] as MeasureEmfCompareMode[]).map((mode) => (
          <LegendPill key={mode} mode={mode} active={mode === activeMode} />
        ))}
      </div>

      {plots.map((plot) => {
        const safeXSpan = Math.max(plot.xMax - plot.xMin, 1e-6);
        const safeYSpan = Math.max(plot.yMax - plot.yMin, 1e-6);
        const toX = (value: number) => plot.plot.x + ((value - plot.xMin) / safeXSpan) * plot.plot.w;
        const toY = (value: number) => plot.plot.y + plot.plot.h - ((value - plot.yMin) / safeYSpan) * plot.plot.h;
        const selectedX = toX(activeSeries.current.I);
        const selectedY = toY(activeSeries.current.U);
        const clipId = `measure-chart-${plot.key}-${activeMode}`;

        return (
          <div
            key={plot.key}
            className="rounded-xl border bg-white p-4"
            style={{ borderColor: pageStyle.border }}
          >
            <div className="mb-3 flex flex-col gap-1.5 md:flex-row md:items-start md:justify-between">
              <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
                {plot.title}
              </div>
              <div className="text-[11px] md:max-w-[52%] md:text-right" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
                {plot.note}
              </div>
            </div>

            <svg viewBox={`0 0 680 ${plot.viewHeight}`} style={{ width: '100%', display: 'block' }}>
              <defs>
                <clipPath id={clipId}>
                  <rect x={plot.plot.x} y={plot.plot.y} width={plot.plot.w} height={plot.plot.h} rx="12" />
                </clipPath>
              </defs>

              <rect
                x={plot.plot.x}
                y={plot.plot.y}
                width={plot.plot.w}
                height={plot.plot.h}
                rx="12"
                fill="#FFFFFF"
                stroke="#E5E7EB"
              />

              {Array.from({ length: xTicks + 1 }).map((_, index) => {
                const x = plot.plot.x + (plot.plot.w * index) / xTicks;
                return <line key={`${plot.key}-x-${index}`} x1={x} y1={plot.plot.y} x2={x} y2={plot.plot.y + plot.plot.h} stroke="#E5E7EB" strokeWidth="1" />;
              })}
              {Array.from({ length: yTicks + 1 }).map((_, index) => {
                const y = plot.plot.y + (plot.plot.h * index) / yTicks;
                return <line key={`${plot.key}-y-${index}`} x1={plot.plot.x} y1={y} x2={plot.plot.x + plot.plot.w} y2={y} stroke="#E5E7EB" strokeWidth="1" />;
              })}

              <line
                x1={selectedX}
                y1={plot.plot.y}
                x2={selectedX}
                y2={plot.plot.y + plot.plot.h}
                stroke={`${SERIES_META[activeMode].color}88`}
                strokeDasharray="6 6"
                strokeWidth="1.5"
              />
              <line
                x1={plot.plot.x}
                y1={selectedY}
                x2={plot.plot.x + plot.plot.w}
                y2={selectedY}
                stroke={`${SERIES_META[activeMode].color}88`}
                strokeDasharray="6 6"
                strokeWidth="1.5"
              />

              <g clipPath={`url(#${clipId})`}>
                {allSeries.map((series) => {
                  const meta = SERIES_META[series.mode];
                  const isActive = series.mode === activeMode;
                  const fit = series.fit;
                  const yStart = fit ? fit.emf - fit.r * plot.xMin : 0;
                  const yEnd = fit ? fit.emf - fit.r * plot.xMax : 0;

                  return (
                    <g key={`${plot.key}-${series.mode}`}>
                      {fit && (
                        <line
                          x1={toX(plot.xMin)}
                          y1={toY(yStart)}
                          x2={toX(plot.xMax)}
                          y2={toY(yEnd)}
                          stroke={meta.color}
                          strokeWidth={isActive ? 3.1 : 1.8}
                          opacity={isActive ? 0.96 : 0.28}
                        />
                      )}

                      {series.samples.map((point, index) => (
                        <circle
                          key={`${plot.key}-${series.mode}-${index}`}
                          cx={toX(point.I)}
                          cy={toY(point.U)}
                          r={isActive ? 4.3 : 3.1}
                          fill={meta.color}
                          opacity={isActive ? 0.55 : 0.18}
                        />
                      ))}
                    </g>
                  );
                })}
              </g>

              {allSeries.map((series) => {
                const meta = SERIES_META[series.mode];
                const isActive = series.mode === activeMode;
                return (
                  <g key={`${plot.key}-${series.mode}-current`}>
                    <circle
                      cx={toX(series.current.I)}
                      cy={toY(series.current.U)}
                      r={isActive ? 7.4 : 5.3}
                      fill={isActive ? meta.color : '#FFFFFF'}
                      stroke={meta.color}
                      strokeWidth={isActive ? 2.6 : 1.8}
                    />
                    {isActive && (
                      <circle
                        cx={toX(series.current.I)}
                        cy={toY(series.current.U)}
                        r={10.5}
                        fill="none"
                        stroke={meta.color}
                        strokeOpacity="0.28"
                        strokeWidth="4"
                      />
                    )}
                  </g>
                );
              })}

              <rect
                x={Math.min(selectedX + 12, plot.plot.x + plot.plot.w - 160)}
                y={Math.max(plot.plot.y + 8, selectedY - 42)}
                width="148"
                height="42"
                rx="10"
                fill="rgba(255,255,255,0.94)"
                stroke={`${SERIES_META[activeMode].color}55`}
              />
              <text
                x={Math.min(selectedX + 22, plot.plot.x + plot.plot.w - 150)}
                y={Math.max(plot.plot.y + 24, selectedY - 24)}
                fontSize="11"
                fontWeight="700"
                fill={SERIES_META[activeMode].color}
              >
                W({formatCurrentScalar(activeSeries.current.I)}, {formatVoltageScalar(activeSeries.current.U)})
              </text>
              <text
                x={Math.min(selectedX + 22, plot.plot.x + plot.plot.w - 150)}
                y={Math.max(plot.plot.y + 38, selectedY - 10)}
                fontSize="10"
                fill={pageStyle.secondary}
              >
                当前工作点
              </text>

              {Array.from({ length: xTicks + 1 }).map((_, index) => {
                const value = plot.xMin + (safeXSpan * index) / xTicks;
                return (
                  <text
                    key={`${plot.key}-xt-${index}`}
                    x={plot.plot.x + (plot.plot.w * index) / xTicks}
                    y={plot.plot.y + plot.plot.h + 24}
                    textAnchor="middle"
                    fontSize="10"
                    fill={pageStyle.muted}
                  >
                    {value.toFixed(plot.xMax <= 2 ? 2 : 1)}
                  </text>
                );
              })}

              {Array.from({ length: yTicks + 1 }).map((_, index) => {
                const value = plot.yMax - (safeYSpan * index) / yTicks;
                return (
                  <text
                    key={`${plot.key}-yt-${index}`}
                    x={plot.plot.x - 12}
                    y={plot.plot.y + (plot.plot.h * index) / yTicks + 4}
                    textAnchor="end"
                    fontSize="10"
                    fill={pageStyle.muted}
                  >
                    {value.toFixed(2)}
                  </text>
                );
              })}

              <text x={plot.plot.x + plot.plot.w / 2} y={plot.viewHeight - 16} textAnchor="middle" fontSize="11" fill={pageStyle.secondary}>
                电流表读数 I_meter / A
              </text>
              <text
                x={24}
                y={plot.plot.y + plot.plot.h / 2}
                textAnchor="middle"
                fontSize="11"
                fill={pageStyle.secondary}
                transform={`rotate(-90 24 ${plot.plot.y + plot.plot.h / 2})`}
              >
                电压表读数 U_meter / V
              </text>
            </svg>
          </div>
        );
      })}
    </div>
  );
}

function CurrentPointTable({
  result,
  activeMode,
}: {
  result: MeasureEmfCompareResult;
  activeMode: MeasureEmfCompareMode;
}) {
  const rows = (['ideal', 'inner', 'outer'] as MeasureEmfCompareMode[]).map((mode) => {
    const state = buildModePresentationState(mode, DEFAULT_PARAMS, {
      ...result,
      ideal: result.ideal,
      inner: result.inner,
      outer: result.outer,
    });
    return state;
  });

  return (
    <table className="w-full table-fixed" style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${pageStyle.border}` }}>
          <HeadCell>接法</HeadCell>
          <HeadCell right>A表</HeadCell>
          <HeadCell right>V表</HeadCell>
          <HeadCell right>U_PN</HeadCell>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr
            key={row.mode}
            style={{
              borderBottom: `1px solid ${pageStyle.border}`,
              backgroundColor: row.mode === activeMode ? `${SERIES_META[row.mode].color}12` : 'transparent',
            }}
          >
            <td className="px-1 py-2" style={{ color: SERIES_META[row.mode].color, fontWeight: 700 }}>
              {SERIES_META[row.mode].short}
            </td>
            <BodyCell>{formatCurrentFixed(row.ammeterCurrent)}</BodyCell>
            <BodyCell>{formatVoltageFixed(row.point.U)}</BodyCell>
            <BodyCell>{formatVoltageFixed(row.terminalVoltage)}</BodyCell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FitComparisonTable({
  result,
  activeMode,
}: {
  result: MeasureEmfCompareResult;
  activeMode: MeasureEmfCompareMode;
}) {
  return (
    <table className="w-full table-fixed" style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
      <colgroup>
        <col style={{ width: '18%' }} />
        <col style={{ width: '22%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
        <col style={{ width: '20%' }} />
      </colgroup>
      <thead>
        <tr style={{ borderBottom: `2px solid ${pageStyle.border}` }}>
          <HeadCell>方法</HeadCell>
          <HeadCell right>ε'</HeadCell>
          <HeadCell right>Δε</HeadCell>
          <HeadCell right>r'</HeadCell>
          <HeadCell right>Δr</HeadCell>
        </tr>
      </thead>
      <tbody>
        {([result.ideal, result.inner, result.outer] as MeasureEmfSeriesResult[]).map((series) => (
          <tr
            key={series.mode}
            style={{
              borderBottom: `1px solid ${pageStyle.border}`,
              backgroundColor: series.mode === activeMode ? `${SERIES_META[series.mode].color}12` : 'transparent',
            }}
          >
            <td className="px-1 py-2" style={{ color: SERIES_META[series.mode].color, fontWeight: 700 }}>
              {SERIES_META[series.mode].short}
            </td>
            <BodyCell>{formatVoltageFixed(series.fit?.emf ?? 0)}</BodyCell>
            <BodyCell>{formatPercentFixed(series.emfErrorPercent)}</BodyCell>
            <BodyCell>{formatResistanceFixed(series.fit?.r ?? 0)}</BodyCell>
            <BodyCell>{formatPercentFixed(series.rErrorPercent)}</BodyCell>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function MeasureSampleTable({ result }: { result: MeasureEmfCompareResult }) {
  const rows = result.ideal.samples.map((point, index) => ({
    resistance: point.resistance,
    ideal: point,
    inner: result.inner.samples[index] ?? result.inner.current,
    outer: result.outer.samples[index] ?? result.outer.current,
  }));

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 10.5, minWidth: 640 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${pageStyle.border}` }}>
            <HeadCell>R</HeadCell>
            <HeadCell right>理想 U</HeadCell>
            <HeadCell right>理想 I</HeadCell>
            <HeadCell right>内接 U</HeadCell>
            <HeadCell right>内接 I</HeadCell>
            <HeadCell right>外接 U</HeadCell>
            <HeadCell right>外接 I</HeadCell>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.resistance}-${index}`} style={{ borderBottom: `1px solid ${pageStyle.border}` }}>
              <td className="px-1 py-2 align-top" style={{ color: pageStyle.text, fontWeight: 600 }}>
                {formatResistanceFixed(row.resistance)}
              </td>
              <BodyCell>{formatVoltageFixed(row.ideal.U)}</BodyCell>
              <BodyCell>{formatCurrentFixed(row.ideal.I)}</BodyCell>
              <BodyCell>{formatVoltageFixed(row.inner.U)}</BodyCell>
              <BodyCell>{formatCurrentFixed(row.inner.I)}</BodyCell>
              <BodyCell>{formatVoltageFixed(row.outer.U)}</BodyCell>
              <BodyCell>{formatCurrentFixed(row.outer.I)}</BodyCell>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ModePill({
  mode,
  active,
  onClick,
}: {
  mode: MeasureEmfCompareMode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[11px] font-semibold transition-colors"
      style={{
        color: active ? '#FFFFFF' : SERIES_META[mode].color,
        backgroundColor: active ? SERIES_META[mode].color : `${SERIES_META[mode].color}12`,
        border: `1px solid ${SERIES_META[mode].color}44`,
      }}
    >
      {SERIES_META[mode].label}
    </button>
  );
}

function HighlightMetric({
  label,
  value,
  description,
  color,
}: {
  label: string;
  value: string;
  description: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border px-3 py-3"
      style={{ borderColor: `${color}33`, backgroundColor: `${color}0D` }}
    >
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color }}>
        {label}
      </div>
      <div
        className="mt-1 text-[20px] font-semibold"
        style={{ color: pageStyle.text, fontVariantNumeric: 'tabular-nums' }}
      >
        {value}
      </div>
      <div className="mt-1 text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
        {description}
      </div>
    </div>
  );
}

function MetricBar({
  label,
  color,
  value,
  recommended,
}: {
  label: string;
  color: string;
  value: number;
  recommended: boolean;
}) {
  const maxAbs = 60;
  const width = Math.min((Math.abs(value) / maxAbs) * 100, 100);
  const isPositive = value >= 0;

  return (
    <div className="mb-3 flex flex-col gap-1.5 last:mb-0">
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium" style={{ color }}>
            {label}
          </span>
          {recommended && <span className="text-[9px]" style={{ color: pageStyle.accent }}>较优</span>}
        </div>
        <span
          className="text-[11px] font-semibold"
          style={{ color, fontVariantNumeric: 'tabular-nums' }}
        >
          {formatPercentFixed(value)}
        </span>
      </div>
      <div className="relative h-[18px] overflow-hidden rounded-full" style={{ backgroundColor: pageStyle.blockSoft }}>
        <div className="absolute left-1/2 top-0 h-full w-px" style={{ backgroundColor: pageStyle.borderStrong }} />
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            width: `${width / 2}%`,
            left: isPositive ? '50%' : `${50 - width / 2}%`,
            backgroundColor: color,
            opacity: recommended ? 0.9 : 0.55,
          }}
        />
      </div>
    </div>
  );
}

function FormulaBlock({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div
      className="mb-2 rounded-lg p-3 last:mb-0"
      style={{ border: `1px solid ${color}30`, backgroundColor: `${color}10` }}
    >
      <div className="mb-1 text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      {lines.map((line) => (
        <div
          key={line}
          className="text-[10px]"
          style={{
            color: pageStyle.secondary,
            lineHeight: 1.8,
            fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {line}
        </div>
      ))}
    </div>
  );
}

function LegendPill({
  mode,
  active = false,
}: {
  mode: MeasureEmfCompareMode;
  active?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px]"
      style={{
        backgroundColor: active ? `${SERIES_META[mode].color}18` : `${SERIES_META[mode].color}10`,
        color: pageStyle.text,
        border: `1px solid ${SERIES_META[mode].color}${active ? '66' : '22'}`,
      }}
    >
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: 999,
          backgroundColor: SERIES_META[mode].color,
        }}
      />
      {SERIES_META[mode].label}
    </div>
  );
}

function RightPanelCard({
  title,
  children,
  accentColor,
  backgroundColor,
  borderColor,
}: {
  title: string;
  children: ReactNode;
  accentColor?: string;
  backgroundColor?: string;
  borderColor?: string;
}) {
  return (
    <div
      className="rounded-xl border p-3.5"
      style={{
        borderColor: borderColor ?? pageStyle.border,
        backgroundColor: backgroundColor ?? pageStyle.blockBg,
      }}
    >
      <div className="mb-2 text-xs font-semibold" style={{ color: accentColor ?? pageStyle.text }}>
        {title}
      </div>
      {children}
    </div>
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
      style={{
        backgroundColor: pageStyle.accentSoft,
        color: pageStyle.accent,
        border: `1px solid ${pageStyle.accent}33`,
      }}
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
            style={{
              borderColor: pageStyle.border,
              color: pageStyle.text,
              fontVariantNumeric: 'tabular-nums',
            }}
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

function HeadCell({ children, right }: { children: ReactNode; right?: boolean }) {
  return (
    <th
      className={`px-1 py-2 ${right ? 'text-right' : 'text-left'}`}
      style={{ color: pageStyle.muted, fontWeight: 500, fontSize: 10 }}
    >
      {children}
    </th>
  );
}

function BodyCell({ children }: { children: ReactNode }) {
  return (
    <td
      className="px-1 py-2 text-right"
      style={{
        color: pageStyle.text,
        fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
        fontSize: 10.5,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {children}
    </td>
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
      <line x1={x} y1={top} x2={x} y2={longPlateY} stroke={stroke} strokeWidth="2.2" />
      <line x1={x - 12} y1={longPlateY} x2={x + 12} y2={longPlateY} stroke={stroke} strokeWidth="2.4" />
      <line x1={x - 8} y1={shortPlateY} x2={x + 8} y2={shortPlateY} stroke={stroke} strokeWidth="1.8" />
      <line x1={x} y1={shortPlateY} x2={x} y2={bottom} stroke={stroke} strokeWidth="2.2" />
    </>
  );
}

function MeterSymbol({
  center,
  letter,
  stroke,
  accent,
  sublabel,
}: {
  center: { x: number; y: number };
  letter: string;
  stroke: string;
  accent: string;
  sublabel: string;
}) {
  return (
    <>
      <circle cx={center.x} cy={center.y} r="22" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
      <circle cx={center.x} cy={center.y} r="18" fill="none" stroke={accent} strokeWidth="1.8" />
      <text x={center.x} y={center.y + 6} textAnchor="middle" fontSize="18" fontWeight="700" fill={stroke}>
        {letter}
      </text>
      <text x={center.x} y={center.y + 34} textAnchor="middle" fontSize="10" fill={accent} fontWeight="700">
        {sublabel}
      </text>
    </>
  );
}

function VariableResistorSymbol({
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
  const midY = y + height / 2;

  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx="8" fill="#FFFFFF" stroke={stroke} strokeWidth="2.2" />
      <path
        d={`M ${x + 12} ${midY} H ${x + 24} L ${x + 38} ${y + 7} L ${x + 52} ${y + height - 7} L ${x + 66} ${y + 7} L ${x + 80} ${y + height - 7} L ${x + 94} ${midY}`}
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <line x1={x + width - 10} y1={y - 10} x2={x + 46} y2={y + height - 6} stroke={stroke} strokeWidth="1.7" />
      <polygon points={`${x + width - 10},${y - 10} ${x + width - 16},${y - 2} ${x + width - 4},${y - 2}`} fill={stroke} />
    </>
  );
}

function CircuitBadge({
  x,
  y,
  width,
  title,
  lines,
  accent,
}: {
  x: string | number;
  y: string | number;
  width: string | number;
  title: string;
  lines: string[];
  accent: string;
}) {
  const height = 26 + lines.length * 16 + 12;
  return (
    <>
      <rect x={x} y={y} width={width} height={height} rx="12" fill="rgba(255,255,255,0.96)" stroke={`${accent}55`} />
      <text x={Number(x) + 14} y={Number(y) + 18} fontSize="11" fontWeight="700" fill={accent}>
        {title}
      </text>
      {lines.map((line, index) => (
        <text
          key={line}
          x={Number(x) + 14}
          y={Number(y) + 36 + index * 16}
          fontSize="10.5"
          fill={pageStyle.secondary}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {line}
        </text>
      ))}
    </>
  );
}

function NodeDot({ x, y }: { x: number; y: number }) {
  return <circle cx={x} cy={y} r="3.2" fill={NODE_COLOR} />;
}

function NodePill({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <>
      <rect x={x - 18} y={y - 10} width="36" height="20" rx="10" fill="#FFFFFF" stroke="#CBD5E1" />
      <text x={x} y={y + 4} textAnchor="middle" fontSize="10" fontWeight="700" fill={NODE_COLOR}>
        {label}
      </text>
    </>
  );
}

function InlineLegend({ color, text }: { color: string; text: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 8px',
        borderRadius: '999px',
        border: `1px solid ${color}33`,
        backgroundColor: `${color}0F`,
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: 999, backgroundColor: color }} />
      {text}
    </span>
  );
}

function buildModePresentationState(
  mode: MeasureEmfCompareMode,
  params: MeasureEmfCompareParams,
  result: MeasureEmfCompareResult,
): ModePresentationState {
  const point = getSeriesByMode(result, mode).current;
  const emf = Math.max(params.emf, 0);
  const r = Math.max(params.internalResistance, 1e-6);
  const rA = Math.max(params.ammeterResistance, 1e-6);
  const rV = Math.max(params.voltmeterResistance, 1e-6);
  const load = Math.max(result.currentResistance, 1e-6);

  if (mode === 'ideal') {
    const totalCurrent = point.I;
    const terminalVoltage = point.U;
    const internalDrop = emf - terminalVoltage;

    return {
      mode,
      point,
      currentResistance: load,
      totalCurrent,
      ammeterCurrent: point.I,
      voltmeterCurrent: 0,
      terminalVoltage,
      internalDrop,
      loadVoltage: point.U,
      loadCurrent: point.I,
      ammeterDrop: 0,
      measuredCurrentLabel: 'I',
      measuredVoltageLabel: 'U_PN',
      meterCurrentMeaning: '理想 A 表读主回路电流，等于源电流与负载电流。',
      meterVoltageMeaning: '理想 V 表读电源端电压；理想参照下 U_PN 与外电路电压相同。',
      sourceFormulaLines: [
        'I = ε / (R + r)',
        `  = ${formatScalar(emf, 3)} / (${formatScalar(load, 2)} + ${formatScalar(r, 2)}) = ${formatScalar(totalCurrent, 3)} A`,
        'U_PN = ε - I·r',
        `    = ${formatScalar(emf, 3)} - ${formatScalar(totalCurrent, 3)} × ${formatScalar(r, 2)} = ${formatScalar(terminalVoltage, 3)} V`,
      ],
      measurementFormulaLines: [
        `A 表读数：I = ${formatCurrentFixed(point.I)}`,
        `V 表读数：U_PN = ${formatVoltageFixed(point.U)}`,
        `理想条件下：U_PN = U_AB，内阻压降 = ${formatVoltageFixed(internalDrop)}`,
      ],
      modeSummaryLines: [
        '理想参照只保留电源真值链路，不引入仪表内阻。',
        'A 表读主回路电流 I，V 表读电源端电压 U_PN。',
        '这条线是后面比较内接 / 外接误差时的基准线。',
      ],
    };
  }

  if (mode === 'inner') {
    const totalCurrent = point.I;
    const terminalVoltage = emf - totalCurrent * r;
    const internalDrop = emf - terminalVoltage;
    const loadVoltage = point.U;
    const loadCurrent = loadVoltage / load;
    const voltmeterCurrent = loadVoltage / rV;
    const ammeterDrop = totalCurrent * rA;

    return {
      mode,
      point,
      currentResistance: load,
      totalCurrent,
      ammeterCurrent: point.I,
      voltmeterCurrent,
      terminalVoltage,
      internalDrop,
      loadVoltage,
      loadCurrent,
      ammeterDrop,
      measuredCurrentLabel: 'I',
      measuredVoltageLabel: 'U_AB',
      meterCurrentMeaning: 'A 表串在主回路中，读到的就是总电流 I。',
      meterVoltageMeaning: 'V 表跨接 A/B 两点，读的是外电路两端电压 U_AB，而不是 U_PN。',
      sourceFormulaLines: [
        'I = ε / (r + rA + (R‖rV))',
        `  = ${formatScalar(emf, 3)} / (${formatScalar(r, 2)} + ${formatScalar(rA, 2)} + (${formatResistanceFormula(load)}‖${formatResistanceFormula(rV)}))`,
        `  = ${formatScalar(totalCurrent, 3)} A`,
        'U_PN = ε - I·r',
        `    = ${formatScalar(emf, 3)} - ${formatScalar(totalCurrent, 3)} × ${formatScalar(r, 2)} = ${formatScalar(terminalVoltage, 3)} V`,
      ],
      measurementFormulaLines: [
        `V 表跨 A/B：U_AB = U_PN - I·rA = ${formatVoltageFixed(loadVoltage)}`,
        `A 表读数：I = ${formatCurrentFixed(totalCurrent)}`,
        `支路分流：I_R = ${formatCurrentFixed(loadCurrent)}，I_V = ${formatCurrentFixed(voltmeterCurrent)}`,
      ],
      modeSummaryLines: [
        '内接法中，A 表内阻会占掉一部分外电路电压，所以 V 表读到的是 U_AB，不是 U_PN。',
        'A 表仍读总电流 I，因此拟合截距更接近 ε，但斜率会把 rA 一起算进去。',
        '图上若只看 V 表和 A 表，很容易把 U_AB 误当成端电压，这就是主要误区。',
      ],
    };
  }

  const terminalVoltage = point.U;
  const ammeterCurrent = point.I;
  const voltmeterCurrent = terminalVoltage / rV;
  const totalCurrent = ammeterCurrent + voltmeterCurrent;
  const internalDrop = emf - terminalVoltage;
  const loadVoltage = ammeterCurrent * load;
  const ammeterDrop = ammeterCurrent * rA;

  return {
    mode,
    point,
    currentResistance: load,
    totalCurrent,
    ammeterCurrent,
    voltmeterCurrent,
    terminalVoltage,
    internalDrop,
    loadVoltage,
    loadCurrent: ammeterCurrent,
    ammeterDrop,
    measuredCurrentLabel: 'I_A',
    measuredVoltageLabel: 'U_PN',
    meterCurrentMeaning: 'A 表只在负载支路中，读的是支路电流 I_A，不是源总电流。',
    meterVoltageMeaning: 'V 表跨接 P/N，读的是电源端电压 U_PN。',
    sourceFormulaLines: [
      'U_PN = ε - I_total·r',
      `    = ${formatScalar(emf, 3)} - ${formatScalar(totalCurrent, 3)} × ${formatScalar(r, 2)} = ${formatScalar(terminalVoltage, 3)} V`,
      'I_total = I_A + I_V',
      `       = ${formatScalar(ammeterCurrent, 3)} + ${formatScalar(voltmeterCurrent, 3)} = ${formatScalar(totalCurrent, 3)} A`,
    ],
    measurementFormulaLines: [
      `A 表支路：I_A = U_PN / (R + rA) = ${formatCurrentFixed(ammeterCurrent)}`,
      `V 表支路：I_V = U_PN / rV = ${formatCurrentFixed(voltmeterCurrent)}`,
      `负载压降：U_R = I_A·R = ${formatVoltageFixed(loadVoltage)}，A 表压降 = ${formatVoltageFixed(ammeterDrop)}`,
    ],
    modeSummaryLines: [
      '外接法中，V 表直接跨在 P/N 上，所以端电压 U_PN 的定义最清楚。',
      '但 A 表只在负载支路里，源总电流其实是 I_total = I_A + I_V。',
      'V 表分流越明显，拟合出的 ε 与 r 都会被拉小。',
    ],
  };
}

function getSeriesByMode(
  result: MeasureEmfCompareResult,
  mode: MeasureEmfCompareMode,
): MeasureEmfSeriesResult {
  return mode === 'ideal' ? result.ideal : mode === 'inner' ? result.inner : result.outer;
}

function formatScalar(value: number, digits = 3): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits);
}

function formatVoltageScalar(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(3);
}

function formatCurrentScalar(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(3);
}

function formatVoltageFixed(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(3)} V`;
}

function formatCurrentFixed(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(3)} A`;
}

function formatResistanceFixed(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} kΩ`;
  return `${value.toFixed(2)} Ω`;
}

function formatResistanceFormula(value: number): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(2)} kΩ`;
  return `${value.toFixed(2)} Ω`;
}

function formatPercentFixed(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}
