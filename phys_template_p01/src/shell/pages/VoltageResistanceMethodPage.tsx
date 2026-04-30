import { useState } from 'react';
import { COLORS } from '@/styles/tokens';
import {
  type VoltageResistanceCurvePoint,
  type VoltageResistanceMeasurementPosition,
  type VoltageResistanceMeterMode,
  type VoltageResistancePositionComparison,
  type VoltageResistanceMethodReading,
} from '@/domains/em/logic/voltage-resistance-method';
import { useVoltageResistanceMethod } from './useVoltageResistanceMethod';

interface VoltageResistanceMethodPageProps {
  onBack: () => void;
}

interface VoltageResistanceMethodPageState {
  E: number;
  R0: number;
  Rx: number;
  Rv: number;
  measurementPosition: VoltageResistanceMeasurementPosition;
  meterMode: VoltageResistanceMeterMode;
}

const DEFAULT_STATE: VoltageResistanceMethodPageState = {
  E: 6,
  R0: 150,
  Rx: 240,
  Rv: 12000,
  measurementPosition: 'measure-rx',
  meterMode: 'real',
};

const IDEAL_COLOR = '#2563EB';
const REAL_COLOR = '#D97706';
const MEASURE_COLOR = '#0F766E';

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

export function VoltageResistanceMethodPage({
  onBack,
}: VoltageResistanceMethodPageProps) {
  const [state, setState] = useState<VoltageResistanceMethodPageState>(DEFAULT_STATE);
  const { result, curve, chartMaxRx, activeReading, inactiveReading } =
    useVoltageResistanceMethod(state);

  const setParam = (key: keyof VoltageResistanceMethodPageState, value: number | string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const idealReading = result.current.ideal;
  const realReading = result.current.real;
  const alternativeComparison =
    state.measurementPosition === 'measure-rx'
      ? result.measureR0
      : result.measureRx;

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
          伏阻法测电阻
        </h1>
        <span className="text-[11px]" style={{ color: pageStyle.muted }}>
          串联 R0 与 Rx，利用电压表读数和分压关系间接求出未知电阻 Rx
        </span>
        <div className="flex-1" />
        <div className="text-right text-[10px]" style={{ color: pageStyle.muted }}>
          本组参数更推荐：{getMeasurementPositionLabel(result.recommendedPosition)}
          <div>{result.recommendReason}</div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col xl:flex-row">
        <VoltageResistanceControlPanel
          state={state}
          activeReading={activeReading}
          recommendedPosition={result.recommendedPosition}
          recommendReason={result.recommendReason}
          onChangeParam={setParam}
          onReset={() => setState(DEFAULT_STATE)}
        />

        <div
          className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto"
          style={{ backgroundColor: pageStyle.panelBg }}
        >
          <div className="grid min-h-0 grid-cols-1 gap-4 p-4">
            <VoltageResistanceCircuitCard
              state={state}
              activeReading={activeReading}
              inactiveReading={inactiveReading}
              idealReading={idealReading}
              realReading={realReading}
            />
            <VoltageResistanceReadingChartCard
              curve={curve}
              chartMaxRx={chartMaxRx}
              supplyVoltage={state.E}
              measurementPosition={state.measurementPosition}
              activeMode={state.meterMode}
              currentRx={state.Rx}
              idealReading={idealReading}
              realReading={realReading}
            />
          </div>
        </div>

        <div
          className="flex w-full shrink-0 flex-col overflow-y-auto xl:w-[360px]"
          style={{
            backgroundColor: pageStyle.panelBg,
            borderLeft: `1px solid ${pageStyle.border}`,
          }}
        >
          <div className="p-4">
            <VoltageResistanceFormulaCard
              state={state}
              idealReading={idealReading}
              realReading={realReading}
            />
            <VoltageResistanceResultCard
              state={state}
              activeReading={activeReading}
              idealReading={idealReading}
              realReading={realReading}
              alternativeComparison={alternativeComparison}
            />
            <VoltageResistanceTeachingCard
              state={state}
              realReading={realReading}
              recommendedPosition={result.recommendedPosition}
              recommendReason={result.recommendReason}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function VoltageResistanceControlPanel({
  state,
  activeReading,
  recommendedPosition,
  recommendReason,
  onChangeParam,
  onReset,
}: {
  state: VoltageResistanceMethodPageState;
  activeReading: VoltageResistanceMethodReading;
  recommendedPosition: VoltageResistanceMeasurementPosition;
  recommendReason: string;
  onChangeParam: (key: keyof VoltageResistanceMethodPageState, value: number | string) => void;
  onReset: () => void;
}) {
  return (
    <div
      className="flex w-full shrink-0 flex-col overflow-y-auto xl:w-[300px]"
      style={{
        backgroundColor: pageStyle.panelSoft,
        borderRight: `1px solid ${pageStyle.border}`,
      }}
    >
      <div className="p-4">
        <div
          className="mb-4 rounded-xl p-3"
          style={{
            backgroundColor: pageStyle.blockBg,
            border: `1px solid ${pageStyle.border}`,
          }}
        >
          <div className="text-xs font-semibold" style={{ color: pageStyle.text }}>
            当前实验模型
          </div>
          <div className="mt-1 text-[15px] font-semibold" style={{ color: MEASURE_COLOR }}>
            串联分压 + 电压表并联被测支路
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            {getMeasurementDescription(state.measurementPosition)}
          </div>
          <div
            className="mt-3 rounded-lg px-2.5 py-2"
            style={{
              backgroundColor: pageStyle.blockSoft,
              border: `1px solid ${pageStyle.border}`,
            }}
          >
            <div className="text-[10px] font-semibold" style={{ color: pageStyle.secondary }}>
              当前高亮
            </div>
            <div className="mt-1 text-[12px]" style={{ color: pageStyle.text }}>
              {getMeterModeLabel(state.meterMode)}，U表 = {formatVoltage(activeReading.voltmeterReading)}
            </div>
            <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted }}>
              按理想公式回代：Rx&apos; = {formatResistance(activeReading.estimatedResistance)}
            </div>
          </div>
        </div>

        <VoltageResistanceSectionTitle title="测量位置" />
        <VoltageResistanceToggleGroup
          value={state.measurementPosition}
          onChange={(value) =>
            onChangeParam('measurementPosition', value as VoltageResistanceMeasurementPosition)
          }
          options={[
            { value: 'measure-rx', label: '测 Rx 两端' },
            { value: 'measure-r0', label: '测 R0 两端' },
          ]}
        />

        <VoltageResistanceSectionTitle title="电压表模型" />
        <VoltageResistanceToggleGroup
          value={state.meterMode}
          onChange={(value) => onChangeParam('meterMode', value as VoltageResistanceMeterMode)}
          options={[
            { value: 'ideal', label: '理想电压表' },
            { value: 'real', label: '真实电压表' },
          ]}
        />

        <div
          className="mb-4 rounded-lg p-3"
          style={{
            backgroundColor: pageStyle.blockBg,
            border: `1px solid ${pageStyle.border}`,
          }}
        >
          <VoltageResistanceSectionTitle title="参数控制" />
          <VoltageResistanceRangeControl
            label="电源电压 E"
            value={state.E}
            min={1}
            max={24}
            step={0.1}
            unit="V"
            onChange={(value) => onChangeParam('E', value)}
          />
          <VoltageResistanceRangeControl
            label="已知电阻 R0"
            value={state.R0}
            min={10}
            max={1000}
            step={1}
            unit="Ω"
            onChange={(value) => onChangeParam('R0', value)}
          />
          <VoltageResistanceRangeControl
            label="被测电阻 Rx"
            value={state.Rx}
            min={1}
            max={5000}
            step={1}
            unit="Ω"
            onChange={(value) => onChangeParam('Rx', value)}
          />
          <VoltageResistanceRangeControl
            label="电压表内阻 Rv"
            value={state.Rv}
            min={200}
            max={100000}
            step={100}
            unit="Ω"
            onChange={(value) => onChangeParam('Rv', value)}
          />
        </div>

        <div
          className="mb-4 rounded-xl p-3"
          style={{
            backgroundColor: `${COLORS.primary}10`,
            border: `1px solid ${COLORS.primary}30`,
          }}
        >
          <div className="text-[11px] font-semibold" style={{ color: COLORS.primary }}>
            本组参数的推荐接法
          </div>
          <div className="mt-1 text-[15px] font-semibold" style={{ color: pageStyle.text }}>
            {getMeasurementPositionLabel(recommendedPosition)}
          </div>
          <div className="mt-1 text-[10px]" style={{ color: pageStyle.muted, lineHeight: 1.7 }}>
            {recommendReason}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <VoltageResistanceActionButton label="重置常规值" onClick={onReset} />
        </div>
      </div>
    </div>
  );
}

function VoltageResistanceCircuitCard({
  state,
  activeReading,
  inactiveReading,
  idealReading,
  realReading,
}: {
  state: VoltageResistanceMethodPageState;
  activeReading: VoltageResistanceMethodReading;
  inactiveReading: VoltageResistanceMethodReading;
  idealReading: VoltageResistanceMethodReading;
  realReading: VoltageResistanceMethodReading;
}) {
  const activeColor = state.meterMode === 'ideal' ? IDEAL_COLOR : REAL_COLOR;

  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            标准电路图与当前系统状态
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.muted }}>
            R0 与 Rx 串联，电压表并联在当前被测支路两端，图中高亮部分与右侧公式保持一致。
          </div>
        </div>
        <div className="flex-1" />
        <div
          className="rounded-full px-3 py-1 text-[10px] font-semibold"
          style={{ backgroundColor: `${activeColor}14`, color: activeColor }}
        >
          当前展示：{getMeterModeLabel(state.meterMode)}
        </div>
      </div>

      <VoltageResistanceCircuitDiagram
        state={state}
        activeReading={activeReading}
        idealReading={idealReading}
      />

      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        <VoltageResistanceMetricCard
          title="当前 U表"
          value={formatVoltage(activeReading.voltmeterReading)}
          hint={`理想 ${formatVoltage(idealReading.voltmeterReading)} / 真实 ${formatVoltage(realReading.voltmeterReading)}`}
          color={activeColor}
        />
        <VoltageResistanceMetricCard
          title="当前推算 Rx'"
          value={formatResistance(activeReading.estimatedResistance)}
          hint={`理想 ${formatResistance(idealReading.estimatedResistance)} / 真实 ${formatResistance(realReading.estimatedResistance)}`}
          color={activeColor}
        />
        <VoltageResistanceMetricCard
          title="真实 Rx"
          value={formatResistance(state.Rx)}
          hint={`当前测量位置：${getMeasurementPositionLabel(state.measurementPosition)}`}
          color={MEASURE_COLOR}
        />
        <VoltageResistanceMetricCard
          title="总电流 I"
          value={formatCurrent(activeReading.totalCurrent)}
          hint={`另一模型 ${formatCurrent(inactiveReading.totalCurrent)}`}
          color={COLORS.info}
        />
        <VoltageResistanceMetricCard
          title="被测支路等效阻值"
          value={formatResistance(activeReading.effectiveMeasuredResistance)}
          hint={
            state.meterMode === 'ideal'
              ? '理想电压表不扰动支路阻值'
              : '真实电压表会与被测支路并联'
          }
          color={COLORS.warning}
        />
        <VoltageResistanceMetricCard
          title="当前相对误差"
          value={formatPercent(activeReading.relativeError)}
          hint={getErrorConclusion(state.measurementPosition, activeReading.relativeError)}
          color={activeReading.relativeError >= 0 ? COLORS.error : COLORS.success}
        />
      </div>
    </div>
  );
}

function VoltageResistanceCircuitDiagram({
  state,
  activeReading,
  idealReading,
}: {
  state: VoltageResistanceMethodPageState;
  activeReading: VoltageResistanceMethodReading;
  idealReading: VoltageResistanceMethodReading;
}) {
  const activeColor = state.meterMode === 'ideal' ? IDEAL_COLOR : REAL_COLOR;
  const measuringRx = state.measurementPosition === 'measure-rx';
  const measuredLeft = measuringRx ? 302 : 182;
  const measuredRight = measuringRx ? 388 : 268;
  const measuredCenter = (measuredLeft + measuredRight) / 2;
  const meterLeft = measuredCenter - 24;
  const meterRight = measuredCenter + 24;

  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockSoft }}
    >
      <svg
        viewBox="0 0 560 300"
        style={{ width: '100%', height: 320, display: 'block' }}
        aria-label="伏阻法测电阻电路图"
      >
        <rect x="0" y="0" width="560" height="300" fill={pageStyle.blockSoft} />

        <line x1="80" y1="70" x2="120" y2="70" stroke="#111111" strokeWidth="2.2" />
        <line x1="170" y1="70" x2="182" y2="70" stroke="#111111" strokeWidth="2.2" />
        <line x1="268" y1="70" x2="302" y2="70" stroke="#111111" strokeWidth="2.2" />
        <line x1="388" y1="70" x2="470" y2="70" stroke="#111111" strokeWidth="2.2" />
        <line x1="470" y1="70" x2="470" y2="228" stroke="#111111" strokeWidth="2.2" />
        <line x1="470" y1="228" x2="80" y2="228" stroke="#111111" strokeWidth="2.2" />

        <line x1="80" y1="70" x2="80" y2="104" stroke="#111111" strokeWidth="2.2" />
        <line x1="80" y1="128" x2="80" y2="228" stroke="#111111" strokeWidth="2.2" />
        <line x1="60" y1="108" x2="100" y2="108" stroke="#111111" strokeWidth="2.8" />
        <line x1="68" y1="126" x2="92" y2="126" stroke="#111111" strokeWidth="1.8" />

        <circle cx="126" cy="70" r="4" fill="#111111" />
        <circle cx="160" cy="70" r="4" fill="#111111" />
        <line x1="126" y1="70" x2="160" y2="70" stroke="#111111" strokeWidth="2.2" />

        <rect
          x="182"
          y="58"
          width="86"
          height="24"
          rx="4"
          fill={measuringRx ? pageStyle.blockBg : `${MEASURE_COLOR}14`}
          stroke={measuringRx ? '#111111' : MEASURE_COLOR}
          strokeWidth={measuringRx ? 1.8 : 2.6}
        />
        <rect
          x="302"
          y="58"
          width="86"
          height="24"
          rx="4"
          fill={measuringRx ? `${MEASURE_COLOR}14` : pageStyle.blockBg}
          stroke={measuringRx ? MEASURE_COLOR : '#111111'}
          strokeWidth={measuringRx ? 2.6 : 1.8}
        />

        <line
          x1={measuredLeft}
          y1="70"
          x2={measuredLeft}
          y2="132"
          stroke={activeColor}
          strokeWidth="2.2"
        />
        <line
          x1={measuredLeft}
          y1="132"
          x2={meterLeft}
          y2="132"
          stroke={activeColor}
          strokeWidth="2.2"
        />
        <line
          x1={measuredRight}
          y1="70"
          x2={measuredRight}
          y2="132"
          stroke={activeColor}
          strokeWidth="2.2"
        />
        <line
          x1={measuredRight}
          y1="132"
          x2={meterRight}
          y2="132"
          stroke={activeColor}
          strokeWidth="2.2"
        />
        <line
          x1={meterLeft}
          y1="132"
          x2={meterLeft}
          y2="164"
          stroke={activeColor}
          strokeWidth="2.2"
        />
        <line
          x1={meterRight}
          y1="132"
          x2={meterRight}
          y2="164"
          stroke={activeColor}
          strokeWidth="2.2"
        />
        <circle
          cx={measuredCenter}
          cy="188"
          r="24"
          fill={pageStyle.blockBg}
          stroke={activeColor}
          strokeWidth="2.4"
        />
        <text
          x={measuredCenter}
          y="194"
          textAnchor="middle"
          fontSize="18"
          fontWeight="700"
          fill={activeColor}
        >
          V
        </text>

        <line x1="148" y1="34" x2="230" y2="34" stroke={activeColor} strokeWidth="2" />
        <polygon points="230,34 220,29 220,39" fill={activeColor} />

        <text x="80" y="48" fontSize="12" fontWeight="600" fill={pageStyle.secondary}>
          E = {formatVoltage(state.E)}
        </text>
        <text x="72" y="101" fontSize="12" fill={pageStyle.secondary}>
          +
        </text>
        <text x="72" y="145" fontSize="12" fill={pageStyle.secondary}>
          -
        </text>
        <text x="143" y="54" fontSize="12" fill={pageStyle.secondary}>
          S
        </text>
        <text x="225" y="50" textAnchor="middle" fontSize="12" fontWeight="600" fill={pageStyle.secondary}>
          R0 = {formatResistance(state.R0)}
        </text>
        <text x="345" y="50" textAnchor="middle" fontSize="12" fontWeight="600" fill={pageStyle.secondary}>
          Rx = {formatResistance(state.Rx)}
        </text>
        <text
          x={measuringRx ? 345 : 225}
          y="98"
          textAnchor="middle"
          fontSize="11"
          fontWeight="600"
          fill={MEASURE_COLOR}
        >
          当前测量对象
        </text>
        <text x="188" y="268" fontSize="12" fill={pageStyle.secondary}>
          I = {formatCurrent(activeReading.totalCurrent)}
        </text>
        <text
          x={measuredCenter}
          y="232"
          textAnchor="middle"
          fontSize="12"
          fontWeight="600"
          fill={activeColor}
        >
          U表 = {formatVoltage(activeReading.voltmeterReading)}
        </text>
        <text
          x={measuredCenter}
          y="250"
          textAnchor="middle"
          fontSize="11"
          fill={pageStyle.secondary}
        >
          Rv = {formatResistance(state.Rv)}
        </text>
        <text
          x="362"
          y="170"
          fontSize="11"
          fill={pageStyle.secondary}
        >
          理想 U = {formatVoltage(idealReading.voltmeterReading)}
        </text>

        <rect
          x="376"
          y="18"
          width="164"
          height="56"
          rx="10"
          fill={pageStyle.blockBg}
          stroke={pageStyle.border}
        />
        <text x="388" y="38" fontSize="11" fontWeight="600" fill={pageStyle.text}>
          测量位置：{getMeasurementPositionLabel(state.measurementPosition)}
        </text>
        <text x="388" y="55" fontSize="10" fill={pageStyle.secondary}>
          等效支路：{formatResistance(activeReading.effectiveMeasuredResistance)}
        </text>
        <text x="388" y="70" fontSize="10" fill={pageStyle.secondary}>
          按公式回代：Rx&apos; = {formatResistance(activeReading.estimatedResistance)}
        </text>
      </svg>
    </div>
  );
}

function VoltageResistanceReadingChartCard({
  curve,
  chartMaxRx,
  supplyVoltage,
  measurementPosition,
  activeMode,
  currentRx,
  idealReading,
  realReading,
}: {
  curve: VoltageResistanceCurvePoint[];
  chartMaxRx: number;
  supplyVoltage: number;
  measurementPosition: VoltageResistanceMeasurementPosition;
  activeMode: VoltageResistanceMeterMode;
  currentRx: number;
  idealReading: VoltageResistanceMethodReading;
  realReading: VoltageResistanceMethodReading;
}) {
  return (
    <div
      className="rounded-2xl border p-4"
      style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div>
          <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
            读数关系图
          </div>
          <div className="text-[11px]" style={{ color: pageStyle.muted }}>
            x 轴为 Rx，y 轴为 U表。理想曲线与真实曲线共同显示，当前工作点以圆点高亮。
          </div>
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-3 text-[10px]" style={{ color: pageStyle.secondary }}>
          <div className="flex items-center gap-1">
            <span style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: IDEAL_COLOR, display: 'inline-block' }} />
            理想电压表
          </div>
          <div className="flex items-center gap-1">
            <span style={{ width: 10, height: 10, borderRadius: 9999, backgroundColor: REAL_COLOR, display: 'inline-block' }} />
            真实电压表
          </div>
        </div>
      </div>

      <VoltageResistanceReadingChart
        curve={curve}
        chartMaxRx={chartMaxRx}
        supplyVoltage={supplyVoltage}
        activeMode={activeMode}
        currentRx={currentRx}
        currentIdealVoltage={idealReading.voltmeterReading}
        currentRealVoltage={realReading.voltmeterReading}
      />

      <div
        className="mt-3 rounded-xl p-3"
        style={{
          backgroundColor: pageStyle.blockSoft,
          border: `1px solid ${pageStyle.border}`,
        }}
      >
        <div className="text-[11px] font-semibold" style={{ color: pageStyle.text }}>
          当前工作点
        </div>
        <div className="mt-1 text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.8 }}>
          Rx = {formatResistance(currentRx)}，{getMeasurementPositionLabel(measurementPosition)}时，
          理想读数 U理 = {formatVoltage(idealReading.voltmeterReading)}，
          真实读数 U实 = {formatVoltage(realReading.voltmeterReading)}。
          当前真实回代得到 Rx&apos; = {formatResistance(realReading.estimatedResistance)}，
          误差为 {formatPercent(realReading.relativeError)}。
        </div>
      </div>
    </div>
  );
}

function VoltageResistanceReadingChart({
  curve,
  chartMaxRx,
  supplyVoltage,
  activeMode,
  currentRx,
  currentIdealVoltage,
  currentRealVoltage,
}: {
  curve: VoltageResistanceCurvePoint[];
  chartMaxRx: number;
  supplyVoltage: number;
  activeMode: VoltageResistanceMeterMode;
  currentRx: number;
  currentIdealVoltage: number;
  currentRealVoltage: number;
}) {
  const width = 720;
  const height = 300;
  const paddingLeft = 58;
  const paddingRight = 24;
  const paddingTop = 24;
  const paddingBottom = 48;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;
  const yMax = Math.max(
    1,
    supplyVoltage * 1.05,
    ...curve.map((point) => Math.max(point.idealVoltage, point.realVoltage)),
  );

  const xToSvg = (value: number) =>
    paddingLeft + (value / Math.max(chartMaxRx, 1e-9)) * plotWidth;
  const yToSvg = (value: number) =>
    paddingTop + plotHeight - (value / Math.max(yMax, 1e-9)) * plotHeight;

  const buildPath = (values: number[]) =>
    values
      .map((value, index) => {
        const point = curve[index];
        if (!point) return '';
        const prefix = index === 0 ? 'M' : 'L';
        return `${prefix} ${xToSvg(point.Rx).toFixed(2)} ${yToSvg(value).toFixed(2)}`;
      })
      .join(' ');

  const idealPath = buildPath(curve.map((point) => point.idealVoltage));
  const realPath = buildPath(curve.map((point) => point.realVoltage));
  const activeColor = activeMode === 'ideal' ? IDEAL_COLOR : REAL_COLOR;
  const currentIdealX = xToSvg(currentRx);
  const currentIdealY = yToSvg(currentIdealVoltage);
  const currentRealX = xToSvg(currentRx);
  const currentRealY = yToSvg(currentRealVoltage);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: '100%', height: 320, display: 'block' }}
      aria-label="伏阻法读数关系图"
    >
      <rect x="0" y="0" width={width} height={height} fill={pageStyle.blockBg} />

      {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
        const x = paddingLeft + plotWidth * ratio;
        const yValue = yMax * (1 - ratio);
        const y = yToSvg(yValue);

        return (
          <g key={ratio}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={width - paddingRight}
              y2={y}
              stroke={pageStyle.border}
              strokeDasharray="4 4"
            />
            <line
              x1={x}
              y1={paddingTop}
              x2={x}
              y2={height - paddingBottom}
              stroke={pageStyle.border}
              strokeDasharray="4 4"
            />
            <text
              x={paddingLeft - 10}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill={pageStyle.secondary}
            >
              {yValue.toFixed(1)}
            </text>
            <text
              x={x}
              y={height - paddingBottom + 18}
              textAnchor="middle"
              fontSize="10"
              fill={pageStyle.secondary}
            >
              {(chartMaxRx * ratio).toFixed(ratio === 0 ? 0 : chartMaxRx >= 1000 ? 0 : 1)}
            </text>
          </g>
        );
      })}

      <line
        x1={paddingLeft}
        y1={height - paddingBottom}
        x2={width - paddingRight}
        y2={height - paddingBottom}
        stroke={pageStyle.borderStrong}
        strokeWidth="1.6"
      />
      <line
        x1={paddingLeft}
        y1={paddingTop}
        x2={paddingLeft}
        y2={height - paddingBottom}
        stroke={pageStyle.borderStrong}
        strokeWidth="1.6"
      />

      <path
        d={idealPath}
        fill="none"
        stroke={IDEAL_COLOR}
        strokeWidth={activeMode === 'ideal' ? 3 : 2.2}
      />
      <path
        d={realPath}
        fill="none"
        stroke={REAL_COLOR}
        strokeWidth={activeMode === 'real' ? 3 : 2.2}
      />

      <circle cx={currentIdealX} cy={currentIdealY} r="4.5" fill={IDEAL_COLOR} />
      <circle cx={currentRealX} cy={currentRealY} r="4.5" fill={REAL_COLOR} />
      <circle
        cx={activeMode === 'ideal' ? currentIdealX : currentRealX}
        cy={activeMode === 'ideal' ? currentIdealY : currentRealY}
        r="10"
        fill="none"
        stroke={activeColor}
        strokeWidth="2"
      />

      <text
        x={width / 2}
        y={height - 10}
        textAnchor="middle"
        fontSize="11"
        fill={pageStyle.secondary}
      >
        Rx / Ω
      </text>
      <text
        x="18"
        y={height / 2}
        textAnchor="middle"
        fontSize="11"
        fill={pageStyle.secondary}
        transform={`rotate(-90 18 ${height / 2})`}
      >
        U表 / V
      </text>
    </svg>
  );
}

function VoltageResistanceFormulaCard({
  state,
  idealReading,
  realReading,
}: {
  state: VoltageResistanceMethodPageState;
  idealReading: VoltageResistanceMethodReading;
  realReading: VoltageResistanceMethodReading;
}) {
  const idealLines =
    state.measurementPosition === 'measure-rx'
      ? [
          'I = E / (R0 + Rx)',
          'U表 = Ux = I * Rx = E * Rx / (R0 + Rx)',
          'Rx = R0 * U表 / (E - U表)',
        ]
      : [
          'I = E / (R0 + Rx)',
          'U表 = U0 = I * R0 = E * R0 / (R0 + Rx)',
          'Rx = R0 * (E / U表 - 1)',
        ];

  const realLines =
    state.measurementPosition === 'measure-rx'
      ? [
          'R支 = Rx || Rv = Rx * Rv / (Rx + Rv)',
          'U实 = E * R支 / (R0 + R支)',
          '若仍按理想公式回代，则 Rx\' = R支 < Rx',
        ]
      : [
          'R支 = R0 || Rv = R0 * Rv / (R0 + Rv)',
          'U实 = E * R支 / (Rx + R支)',
          '若仍按理想公式回代，则 Rx\' = Rx * (1 + R0 / Rv) > Rx',
        ];

  return (
    <div className="mb-4 rounded-2xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
      <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
        关键公式
      </div>
      <div className="mt-1 text-[11px]" style={{ color: pageStyle.muted }}>
        当前采用 {getMeasurementPositionLabel(state.measurementPosition)} 的伏阻法模型，右侧公式与电路图和数值计算严格一致。
      </div>

      <VoltageResistanceFormulaBlock title="理想电压表" color={IDEAL_COLOR} lines={idealLines} />
      <VoltageResistanceFormulaBlock title="真实电压表" color={REAL_COLOR} lines={realLines} />
      <VoltageResistanceFormulaBlock
        title="当前代入结果"
        color={MEASURE_COLOR}
        lines={[
          `理想读数 U理 = ${formatVoltage(idealReading.voltmeterReading)}，回代得 Rx' = ${formatResistance(idealReading.estimatedResistance)}`,
          `真实读数 U实 = ${formatVoltage(realReading.voltmeterReading)}，回代得 Rx' = ${formatResistance(realReading.estimatedResistance)}`,
          `当前真实误差 e = ${formatPercent(realReading.relativeError)}`,
        ]}
      />
    </div>
  );
}

function VoltageResistanceResultCard({
  state,
  activeReading,
  idealReading,
  realReading,
  alternativeComparison,
}: {
  state: VoltageResistanceMethodPageState;
  activeReading: VoltageResistanceMethodReading;
  idealReading: VoltageResistanceMethodReading;
  realReading: VoltageResistanceMethodReading;
  alternativeComparison: VoltageResistancePositionComparison;
}) {
  const activeColor = state.meterMode === 'ideal' ? IDEAL_COLOR : REAL_COLOR;
  const alternativeReading =
    state.meterMode === 'ideal' ? alternativeComparison.ideal : alternativeComparison.real;

  return (
    <div className="mb-4 rounded-2xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
      <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
        当前读数与结果
      </div>

      <div className="mt-3 rounded-xl border" style={{ borderColor: pageStyle.border }}>
        <VoltageResistanceComparisonRow label="当前模式" idealValue="理想电压表" realValue="真实电压表" highlight={state.meterMode} />
        <VoltageResistanceComparisonRow label="U表读数" idealValue={formatVoltage(idealReading.voltmeterReading)} realValue={formatVoltage(realReading.voltmeterReading)} highlight={state.meterMode} />
        <VoltageResistanceComparisonRow label="推算 Rx'" idealValue={formatResistance(idealReading.estimatedResistance)} realValue={formatResistance(realReading.estimatedResistance)} highlight={state.meterMode} />
        <VoltageResistanceComparisonRow label="相对误差" idealValue={formatPercent(idealReading.relativeError)} realValue={formatPercent(realReading.relativeError)} highlight={state.meterMode} />
      </div>

      <div
        className="mt-3 rounded-xl p-3"
        style={{ backgroundColor: `${activeColor}10`, border: `1px solid ${activeColor}22` }}
      >
        <div className="text-[11px] font-semibold" style={{ color: activeColor }}>
          当前高亮结果
        </div>
        <div className="mt-1 text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.8 }}>
          {getMeterModeLabel(state.meterMode)}下，U表 = {formatVoltage(activeReading.voltmeterReading)}，
          推得 Rx&apos; = {formatResistance(activeReading.estimatedResistance)}，
          与真实值 {formatResistance(state.Rx)} 相比，误差为 {formatPercent(activeReading.relativeError)}。
        </div>
      </div>

      <div
        className="mt-3 rounded-xl p-3"
        style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
      >
        <div className="text-[11px] font-semibold" style={{ color: pageStyle.text }}>
          测量位置数据列表
        </div>
        <VoltageResistancePositionTable
          activePosition={state.measurementPosition}
          activeReading={activeReading}
          alternativeReading={alternativeReading}
        />
      </div>
    </div>
  );
}

function VoltageResistancePositionTable({
  activePosition,
  activeReading,
  alternativeReading,
}: {
  activePosition: VoltageResistanceMeasurementPosition;
  activeReading: VoltageResistanceMethodReading;
  alternativeReading: VoltageResistanceMethodReading;
}) {
  const alternativePosition: VoltageResistanceMeasurementPosition =
    activePosition === 'measure-rx' ? 'measure-r0' : 'measure-rx';
  const rows = [
    {
      position: activePosition,
      reading: activeReading,
      highlighted: true,
    },
    {
      position: alternativePosition,
      reading: alternativeReading,
      highlighted: false,
    },
  ];

  return (
    <div className="mt-2 overflow-hidden rounded-lg border" style={{ borderColor: pageStyle.border }}>
      <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: 10.5 }}>
        <thead>
          <tr style={{ backgroundColor: pageStyle.blockBg }}>
            {['测量位置', 'U表', 'I总', '等效支路', "推算 Rx'", '误差'].map((label) => (
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
            <tr
              key={row.position}
              style={{
                backgroundColor: row.highlighted
                  ? `${MEASURE_COLOR}10`
                  : index % 2 === 0
                    ? pageStyle.blockBg
                    : pageStyle.blockSoft,
              }}
            >
              <td className="px-2 py-2" style={{ color: pageStyle.text, fontWeight: row.highlighted ? 700 : 600 }}>
                {getMeasurementPositionLabel(row.position)}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {formatVoltage(row.reading.voltmeterReading)}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {formatCurrent(row.reading.totalCurrent)}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {formatResistance(row.reading.effectiveMeasuredResistance)}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {formatResistance(row.reading.estimatedResistance)}
              </td>
              <td className="px-2 py-2" style={{ color: pageStyle.text }}>
                {formatPercent(row.reading.relativeError)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VoltageResistanceTeachingCard({
  state,
  realReading,
  recommendedPosition,
  recommendReason,
}: {
  state: VoltageResistanceMethodPageState;
  realReading: VoltageResistanceMethodReading;
  recommendedPosition: VoltageResistanceMeasurementPosition;
  recommendReason: string;
}) {
  const conclusionLines =
    state.measurementPosition === 'measure-rx'
      ? [
          '测 Rx 两端时，真实电压表与 Rx 并联，电压表读数对应的是等效阻值 Rx || Rv，因此推算值会偏小。',
          '当 Rx 相对 Rv 变大时，并联分流更明显，图上真实曲线会逐渐低于理想曲线。',
          '若想减小这类误差，应选更大的 Rv，或改测 R0 两端进行比较。',
        ]
      : [
          '测 R0 两端时，真实电压表与 R0 并联，会减小该支路电阻，使回代结果偏大。',
          '这一接法的相对误差近似由 R0 / Rv 决定，因此在图上主要表现为整体系数偏高。',
          '若 Rv 远大于 R0，则这一误差很小，适合课堂上做稳定演示。',
        ];

  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: pageStyle.border, backgroundColor: pageStyle.blockBg }}>
      <div className="text-sm font-semibold" style={{ color: pageStyle.text }}>
        教学结论
      </div>
      <div
        className="mt-3 rounded-xl p-3"
        style={{ backgroundColor: `${COLORS.primary}10`, border: `1px solid ${COLORS.primary}25` }}
      >
        <div className="text-[11px] font-semibold" style={{ color: COLORS.primary }}>
          当前实验结论
        </div>
        <div className="mt-1 text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.8 }}>
          真实电压表下，当前回代误差为 {formatPercent(realReading.relativeError)}。
          对本组参数，更推荐 {getMeasurementPositionLabel(recommendedPosition)}。
          {recommendReason}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {conclusionLines.map((line) => (
          <div
            key={line}
            className="rounded-lg p-2.5 text-[10px]"
            style={{
              backgroundColor: pageStyle.blockSoft,
              border: `1px solid ${pageStyle.border}`,
              color: pageStyle.secondary,
              lineHeight: 1.8,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function VoltageResistanceFormulaBlock({
  title,
  color,
  lines,
}: {
  title: string;
  color: string;
  lines: string[];
}) {
  return (
    <div
      className="mt-3 rounded-xl p-3"
      style={{ backgroundColor: `${color}10`, border: `1px solid ${color}22` }}
    >
      <div className="text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      <div className="mt-2 space-y-1.5">
        {lines.map((line) => (
          <div
            key={line}
            className="rounded-md px-2 py-1.5 text-[11px]"
            style={{
              backgroundColor: pageStyle.blockBg,
              color: pageStyle.text,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
            }}
          >
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}

function VoltageResistanceMetricCard({
  title,
  value,
  hint,
  color,
}: {
  title: string;
  value: string;
  hint: string;
  color: string;
}) {
  return (
    <div
      className="rounded-xl border p-3"
      style={{ borderColor: `${color}28`, backgroundColor: `${color}10` }}
    >
      <div className="text-[10px] font-semibold" style={{ color }}>
        {title}
      </div>
      <div className="mt-1 text-[18px] font-semibold" style={{ color: pageStyle.text }}>
        {value}
      </div>
      <div className="mt-1 text-[10px]" style={{ color: pageStyle.secondary, lineHeight: 1.7 }}>
        {hint}
      </div>
    </div>
  );
}

function VoltageResistanceComparisonRow({
  label,
  idealValue,
  realValue,
  highlight,
}: {
  label: string;
  idealValue: string;
  realValue: string;
  highlight: VoltageResistanceMeterMode;
}) {
  return (
    <div
      className="grid grid-cols-[92px_1fr_1fr] items-center gap-3 px-3 py-2 text-[10px]"
      style={{ borderBottom: `1px solid ${pageStyle.border}` }}
    >
      <div style={{ color: pageStyle.secondary }}>{label}</div>
      <div
        className="rounded-md px-2 py-1"
        style={{
          backgroundColor: highlight === 'ideal' ? `${IDEAL_COLOR}14` : pageStyle.blockSoft,
          color: highlight === 'ideal' ? IDEAL_COLOR : pageStyle.text,
        }}
      >
        {idealValue}
      </div>
      <div
        className="rounded-md px-2 py-1"
        style={{
          backgroundColor: highlight === 'real' ? `${REAL_COLOR}14` : pageStyle.blockSoft,
          color: highlight === 'real' ? REAL_COLOR : pageStyle.text,
        }}
      >
        {realValue}
      </div>
    </div>
  );
}

function VoltageResistanceToggleGroup({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div
      className="mb-4 flex rounded-xl p-1"
      style={{ backgroundColor: pageStyle.blockSoft, border: `1px solid ${pageStyle.border}` }}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            onClick={() => onChange(option.value)}
            className="flex-1 rounded-lg px-3 py-2 text-xs font-medium"
            style={{
              backgroundColor: active ? pageStyle.accentSoft : 'transparent',
              color: active ? pageStyle.accent : pageStyle.secondary,
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function VoltageResistanceActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1.5 text-[10px] font-medium"
      style={{
        backgroundColor: pageStyle.accentSoft,
        color: pageStyle.accent,
        border: `1px solid ${pageStyle.accent}30`,
      }}
    >
      {label}
    </button>
  );
}

function VoltageResistanceSectionTitle({ title }: { title: string }) {
  return (
    <div className="mb-2 text-[11px] font-semibold" style={{ color: pageStyle.secondary }}>
      {title}
    </div>
  );
}

function VoltageResistanceRangeControl({
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
            value={value}
            min={min}
            max={max}
            step={step}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (!Number.isNaN(next)) onChange(Math.max(min, Math.min(max, next)));
            }}
            className="w-24 rounded border px-1.5 py-0.5 text-right text-[11px]"
            style={{ borderColor: pageStyle.border, color: pageStyle.text }}
          />
          <span className="text-[10px]" style={{ color: pageStyle.muted }}>
            {unit}
          </span>
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

function getMeasurementPositionLabel(position: VoltageResistanceMeasurementPosition) {
  return position === 'measure-rx' ? '测 Rx 两端' : '测 R0 两端';
}

function getMeasurementDescription(position: VoltageResistanceMeasurementPosition) {
  return position === 'measure-rx'
    ? '先测 Rx 两端电压 Ux，再利用 Ux / (E - Ux) = Rx / R0 反推未知电阻。'
    : '先测 R0 两端电压 U0，再利用 E / U0 - 1 = Rx / R0 反推未知电阻。';
}

function getMeterModeLabel(mode: VoltageResistanceMeterMode) {
  return mode === 'ideal' ? '理想电压表' : '真实电压表';
}

function getErrorConclusion(
  position: VoltageResistanceMeasurementPosition,
  relativeError: number,
) {
  if (Math.abs(relativeError) < 1e-6) return '当前与理想模型一致';
  if (position === 'measure-rx') return relativeError < 0 ? '测量值偏小，原因是并联分流' : '测量值偏大';
  return relativeError > 0 ? '测量值偏大，原因是 R0 支路被并联拉低' : '测量值偏小';
}

function formatResistance(value: number) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1000) {
    return `${(value / 1000).toFixed(value >= 10000 ? 1 : 2)} kΩ`;
  }
  return `${value.toFixed(value >= 100 ? 1 : 2)} Ω`;
}

function formatVoltage(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${value.toFixed(value >= 10 ? 2 : 3)} V`;
}

function formatCurrent(value: number) {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) >= 1) return `${value.toFixed(3)} A`;
  if (Math.abs(value) >= 0.001) return `${(value * 1000).toFixed(2)} mA`;
  return `${(value * 1000000).toFixed(1)} μA`;
}

function formatPercent(value: number) {
  if (!Number.isFinite(value)) return '—';
  const percent = value * 100;
  const sign = percent > 0 ? '+' : '';
  return `${sign}${percent.toFixed(2)}%`;
}
