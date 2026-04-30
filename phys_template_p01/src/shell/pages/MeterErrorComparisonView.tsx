/**
 * 伏安法测电阻误差对比实验
 *
 * 教学可视化实验台：
 * - 左侧：统一参数控制 + 真实值 + 判别结论
 * - 中间：三电路并排（理想 / 内接 / 外接），相同骨架布局便于对比
 * - 右侧：对比表格 + 误差条 + 推荐结论 + 教学提示
 */

import { useState, useCallback, useRef, useEffect, type MouseEvent } from 'react';
import { COLORS } from '@/styles/tokens';
import {
  calculateMeterError,
  formatValue,
  formatPercent,
  type MeterErrorParams,
  type MeterErrorResult,
  type CircuitResult,
} from '@/domains/em/logic/meter-error-calculator';
import {
  ExperimentBoardScene,
  type ExperimentBoardTooltipData,
} from '@/shell/components/ExperimentBoardScene';

// ─── 常量 ─────────────────────────────────────────

const DEFAULT_PARAMS: MeterErrorParams = { E: 6, r: 1, Rx: 100, rA: 0.1, rV: 15000 };

const IDEAL_COLOR = '#4B5563';

/** 内接法色调（暖色） */
const INNER_COLOR = '#E67E22';
/** 外接法色调（冷色） */
const OUTER_COLOR = '#2980B9';
/** 推荐高亮 */
const RECOMMEND_BG = '#EEF4EA';

const TEXTBOOK_FONT = '"Times New Roman", "Noto Serif SC", "Songti SC", serif';

const textbookCircuitStyle = {
  fontFamily: TEXTBOOK_FONT,
  panelBg: COLORS.bg,
  panelMutedBg: COLORS.bgMuted,
  panelBorder: COLORS.border,
  panelDivider: COLORS.border,
  title: COLORS.text,
  text: COLORS.text,
  muted: COLORS.textMuted,
  guide: COLORS.textMuted,
  wire: '#111111',
  node: '#111111',
  symbol: '#111111',
  overlayBg: 'rgba(255,255,255,0.88)',
  wireWidth: 1.8,
  symbolWidth: 1.6,
  nodeRadius: 2.8,
  meterRadius: 14,
  meterLead: 10,
  resistorWidth: 50,
  resistorHeight: 16,
  branchDash: [5, 4],
};

const apparatusStyle = {
  bg: COLORS.bg,
  benchTop: COLORS.bgMuted,
  benchShadow: COLORS.border,
  wire: COLORS.text,
  wireMuted: COLORS.textPlaceholder,
  terminalRed: '#9F1D1D',
  terminalBlack: '#111111',
  meterFrame: COLORS.text,
  meterBody: COLORS.bg,
  meterGlass: COLORS.bg,
  ammeterAccent: COLORS.text,
  voltmeterAccent: COLORS.text,
  sourceBody: COLORS.bgMuted,
  resistorBody: COLORS.bgMuted,
  resistorEdge: COLORS.borderStrong,
  switchBase: COLORS.bgMuted,
  switchHandle: COLORS.textSecondary,
  label: COLORS.textSecondary,
  tooltipBg: 'rgba(255,255,255,0.98)',
};

const controlStyle = {
  pageBg: COLORS.bgPage,
  panelBg: COLORS.bg,
  panelSoft: COLORS.bg,
  blockBg: COLORS.bg,
  blockBorder: COLORS.border,
  blockBorderDark: COLORS.borderStrong,
  text: COLORS.text,
  muted: COLORS.textMuted,
  accent: COLORS.primary,
  accentSoft: COLORS.primaryLight,
  accentStrong: COLORS.primaryDisabled,
  sliderTrack: COLORS.borderStrong,
  inputBg: COLORS.bg,
  inputBorder: COLORS.borderStrong,
  successBorder: COLORS.primaryDisabled,
  softPanel: COLORS.bgMuted,
};

function getStepPrecision(step: number) {
  const normalized = step.toString();
  if (!normalized.includes('.')) return 0;
  return normalized.split('.')[1]?.length ?? 0;
}

// ─── 主组件 ───────────────────────────────────────

interface Props {
  onBack: () => void;
}

export function MeterErrorComparisonView({ onBack }: Props) {
  const [params, setParams] = useState<MeterErrorParams>(DEFAULT_PARAMS);
  const [closed, setClosed] = useState(true); // 开关状态
  const [showFormula, setShowFormula] = useState(false);
  const [viewMode, setViewMode] = useState<CircuitViewMode>('diagram');
  const [showIdealModel, setShowIdealModel] = useState(true);

  const result = calculateMeterError(params);

  const set = useCallback((key: keyof MeterErrorParams, v: number) => {
    setParams((p) => ({ ...p, [key]: v }));
  }, []);

  const applyPreset = useCallback((p: Partial<MeterErrorParams>) => {
    setParams((prev) => ({ ...prev, ...p }));
  }, []);

  const criticalR = result.trueValues.criticalResistance;

  return (
    <div
      className="flex h-screen w-screen flex-col overflow-hidden"
      style={{ backgroundColor: controlStyle.pageBg }}
    >
      {/* ── 顶栏 ── */}
      <header
        className="flex items-center gap-3 px-5 py-2.5"
        style={{
          borderBottom: `1px solid ${controlStyle.blockBorder}`,
          backgroundColor: controlStyle.panelBg,
        }}
      >
        <button
          onClick={onBack}
          className="px-3 py-1 text-xs font-medium"
          style={{
            color: controlStyle.text,
            border: `1px solid ${controlStyle.blockBorder}`,
            backgroundColor: controlStyle.blockBg,
          }}
        >
          ← 返回
        </button>
        <h1 className="text-sm font-semibold" style={{ color: controlStyle.text }}>
          伏安法测电阻 · 误差对比实验
        </h1>
        <span className="text-[11px]" style={{ color: controlStyle.muted }}>
          同屏比较理想、内接法、外接法三种模型的表头读数与测量误差
        </span>
        <div className="flex-1" />
        <div className="text-[10px]" style={{ color: controlStyle.muted }}>
          当前教材判据：R₀ = √(rA × rV) = {formatValue(criticalR)} Ω
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          params={params}
          onChange={set}
          applyPreset={applyPreset}
          criticalR={criticalR}
          result={result}
          closed={closed}
          onToggleClosed={() => setClosed((prev) => !prev)}
          viewMode={viewMode}
          onChangeViewMode={setViewMode}
          showIdealModel={showIdealModel}
          onToggleIdealModel={() => setShowIdealModel((prev) => !prev)}
          showFormula={showFormula}
          onToggleFormula={() => setShowFormula((prev) => !prev)}
        />
        <CenterPanel
          params={params}
          result={result}
          closed={closed}
          viewMode={viewMode}
          showIdealModel={showIdealModel}
          showFormula={showFormula}
        />
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 左侧：参数控制面板
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function LeftPanel({
  params,
  onChange,
  applyPreset,
  criticalR,
  result,
  closed,
  onToggleClosed,
  viewMode,
  onChangeViewMode,
  showIdealModel,
  onToggleIdealModel,
  showFormula,
  onToggleFormula,
}: {
  params: MeterErrorParams;
  onChange: (k: keyof MeterErrorParams, v: number) => void;
  applyPreset: (p: Partial<MeterErrorParams>) => void;
  criticalR: number;
  result: MeterErrorResult;
  closed: boolean;
  onToggleClosed: () => void;
  viewMode: CircuitViewMode;
  onChangeViewMode: (mode: CircuitViewMode) => void;
  showIdealModel: boolean;
  onToggleIdealModel: () => void;
  showFormula: boolean;
  onToggleFormula: () => void;
}) {
  const trueR = result.trueValues.trueResistance;
  const betterMethod = result.errorSummary.betterMethod === 'inner' ? '内接法' : '外接法';

  return (
    <div
      className="flex w-[290px] shrink-0 flex-col overflow-y-auto"
      style={{
        backgroundColor: controlStyle.panelSoft,
        borderRight: `1px solid ${controlStyle.blockBorder}`,
      }}
    >
      <div className="p-4">
        <div
          className="mb-3 rounded-xl p-3"
          style={{
            backgroundColor: controlStyle.blockBg,
            border: `1px solid ${controlStyle.blockBorder}`,
          }}
        >
          <h2
            className="mb-3 text-xs font-semibold tracking-[0.12em]"
            style={{ color: controlStyle.text }}
          >
            实验参数设定
          </h2>
          <ParamRow
            label="电动势 E"
            unit="V"
            value={params.E}
            min={1}
            max={12}
            step={0.1}
            onChange={(v) => onChange('E', v)}
          />
          <ParamRow
            label="电源内阻 r"
            unit="Ω"
            value={params.r}
            min={0}
            max={5}
            step={0.1}
            onChange={(v) => onChange('r', v)}
          />
          <ParamRow
            label="待测电阻 Rx"
            unit="Ω"
            value={params.Rx}
            min={1}
            max={1000}
            step={1}
            onChange={(v) => onChange('Rx', v)}
            logScale
          />
          <ParamRow
            label="电流表内阻 RA"
            unit="Ω"
            value={params.rA}
            min={0}
            max={1}
            step={0.01}
            onChange={(v) => onChange('rA', v)}
          />
          <ParamRow
            label="电压表内阻 RV"
            unit="Ω"
            value={params.rV}
            min={1000}
            max={50000}
            step={100}
            onChange={(v) => onChange('rV', v)}
            logScale
          />
        </div>

        <div
          className="mb-3 rounded-xl p-3"
          style={{
            backgroundColor: controlStyle.blockBg,
            border: `1px solid ${controlStyle.blockBorder}`,
          }}
        >
          <h3 className="mb-2 text-[11px] font-medium" style={{ color: controlStyle.text }}>
            开关与显示
          </h3>
          <ToggleRow
            label="开关状态"
            description={closed ? '闭合后显示表头读数与误差' : '断开时只展示电路结构'}
            active={closed}
            activeLabel="闭合"
            inactiveLabel="断开"
            onToggle={onToggleClosed}
          />
          <div className="mb-3">
            <div className="mb-1 text-[10px]" style={{ color: controlStyle.muted }}>
              电路图样式
            </div>
            <div className="flex gap-2">
              <OptionPill
                active={viewMode === 'diagram'}
                label="教材图"
                onClick={() => onChangeViewMode('diagram')}
              />
              <OptionPill
                active={viewMode === 'apparatus'}
                label="实物图"
                onClick={() => onChangeViewMode('apparatus')}
              />
            </div>
          </div>
          <ToggleRow
            label="显示理想模型"
            description="保留理想值作为参照列"
            active={showIdealModel}
            activeLabel="显示"
            inactiveLabel="隐藏"
            onToggle={onToggleIdealModel}
          />
          <ToggleRow
            label="显示误差推导"
            description="展开公式、误差图和教学解释"
            active={showFormula}
            activeLabel="展开"
            inactiveLabel="收起"
            onToggle={onToggleFormula}
          />
        </div>

        <div
          className="mb-3 rounded-xl p-3"
          style={{
            backgroundColor: controlStyle.blockBg,
            border: `1px solid ${controlStyle.blockBorder}`,
          }}
        >
          <h3 className="mb-2 text-[11px] font-medium" style={{ color: controlStyle.text }}>
            快捷预设
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            <PresetBtn
              label="大电阻"
              sub="680Ω，宜内接"
              onClick={() => applyPreset({ E: 6, r: 1, Rx: 680, rA: 0.1, rV: 15000 })}
            />
            <PresetBtn
              label="小电阻"
              sub="8Ω，宜外接"
              onClick={() => applyPreset({ E: 3, r: 0.5, Rx: 8, rA: 0.1, rV: 15000 })}
            />
            <PresetBtn
              label="临界场景"
              sub="约 39Ω"
              onClick={() => applyPreset({ E: 6, r: 1, Rx: 39, rA: 0.1, rV: 15000 })}
            />
            <PresetBtn
              label="偏差演示"
              sub="仅作极端对比"
              onClick={() => applyPreset({ E: 6, r: 1, Rx: 820, rA: 0.8, rV: 1500 })}
            />
          </div>
          <button
            onClick={() => applyPreset(DEFAULT_PARAMS)}
            className="mt-2 w-full py-1.5 text-[11px]"
            style={{
              color: controlStyle.muted,
              border: `1px dashed ${controlStyle.blockBorderDark}`,
              backgroundColor: controlStyle.panelBg,
            }}
          >
            重置为常规实验值
          </button>
        </div>

        <div
          className="rounded-xl p-3"
          style={{
            backgroundColor: controlStyle.blockBg,
            border: `1px solid ${controlStyle.blockBorder}`,
          }}
        >
          <h3 className="mb-2 text-[11px] font-medium" style={{ color: controlStyle.text }}>
            当前判据与提醒
          </h3>
          <div className="mb-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <Kv k="真实值 Rx" v={`${formatValue(trueR)} Ω`} />
            <Kv k="临界值 R₀" v={`${formatValue(criticalR)} Ω`} accent />
            <Kv k="电动势 E" v={`${formatValue(params.E)} V`} />
            <Kv k="内阻 r" v={`${formatValue(params.r)} Ω`} />
          </div>

          <div
            className="rounded-lg p-2.5"
            style={{ backgroundColor: RECOMMEND_BG, border: `1px solid ${controlStyle.successBorder}` }}
          >
            <div className="text-[12px] font-semibold" style={{ color: controlStyle.accent }}>
              当前更准确：{betterMethod}
            </div>
            <div className="mt-0.5 text-[10px]" style={{ color: controlStyle.muted }}>
              {result.recommendReason}
            </div>
            <div className="mt-1 text-[10px]" style={{ color: controlStyle.muted }}>
              Rx = {formatValue(trueR)}Ω{' '}
              {trueR > criticalR ? '>' : trueR < criticalR ? '<' : '≈'} R₀ = {formatValue(criticalR)}Ω
            </div>
          </div>

          <div className="mt-3 rounded-lg p-2.5" style={{ backgroundColor: controlStyle.softPanel, border: `1px solid ${controlStyle.blockBorder}` }}>
            <div className="text-[11px] font-medium" style={{ color: controlStyle.text }}>
            记忆口诀
            </div>
            <div className="mt-1 text-[10px] leading-relaxed" style={{ color: controlStyle.muted }}>
              「大内小外」：大电阻用内接，小电阻用外接
              <br />
              「内大外小」：内接测得偏大，外接测得偏小
              <br />
              教材近似判据：R₀ = √(RA × RV)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kv({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-[10px]" style={{ color: controlStyle.muted }}>
        {k}
      </span>
      <span
        className="text-xs font-medium"
        style={{ color: accent ? controlStyle.accent : controlStyle.text }}
      >
        {v}
      </span>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  active,
  activeLabel,
  inactiveLabel,
  onToggle,
}: {
  label: string;
  description: string;
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
  onToggle: () => void;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div>
        <div className="text-[11px]" style={{ color: controlStyle.text }}>
          {label}
        </div>
        <div className="text-[9px]" style={{ color: controlStyle.muted }}>
          {description}
        </div>
      </div>
      <button
        onClick={onToggle}
        className="rounded-full px-2.5 py-1 text-[10px] font-medium"
        style={{
          border: `1px solid ${active ? controlStyle.accentStrong : controlStyle.blockBorder}`,
          backgroundColor: active ? controlStyle.accentSoft : controlStyle.blockBg,
          color: active ? controlStyle.accent : controlStyle.muted,
        }}
      >
        {active ? activeLabel : inactiveLabel}
      </button>
    </div>
  );
}

function OptionPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-full px-3 py-1 text-[10px] font-medium"
      style={{
        border: `1px solid ${active ? controlStyle.blockBorderDark : controlStyle.blockBorder}`,
        backgroundColor: active ? controlStyle.accentSoft : controlStyle.blockBg,
        color: active ? controlStyle.accent : controlStyle.text,
      }}
    >
      {label}
    </button>
  );
}

// ─── 参数行（slider + 数字输入） ────────────────────

function ParamRow({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
  logScale,
}: {
  label: string;
  unit: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  logScale?: boolean;
}) {
  const toSlider = logScale
    ? (v: number) => {
        const m = Math.max(min, 1);
        return (Math.log(Math.max(v, m)) - Math.log(m)) / (Math.log(max) - Math.log(m));
      }
    : (v: number) => (v - min) / (max - min);
  const fromSlider = logScale
    ? (s: number) => {
        const m = Math.max(min, 1);
        return Math.exp(Math.log(m) + s * (Math.log(max) - Math.log(m)));
      }
    : (s: number) => min + s * (max - min);

  const align = (raw: number) => Math.max(min, Math.min(max, Math.round(raw / step) * step));
  const precision = getStepPrecision(step);

  return (
    <div className="mb-3 border-b pb-3 last:mb-0 last:border-b-0 last:pb-0" style={{ borderColor: controlStyle.blockBorder }}>
      <div className="mb-1 flex items-center justify-between">
        <div>
          <div className="text-[11px]" style={{ color: controlStyle.text }}>
            {label}
          </div>
          <div className="text-[9px]" style={{ color: controlStyle.muted }}>
            {formatValue(min)} ~ {formatValue(max)} {unit}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            value={Number(value.toFixed(precision))}
            min={min}
            max={max}
            step={step}
            onChange={(e) => {
              const n = parseFloat(e.target.value);
              if (!isNaN(n)) onChange(align(n));
            }}
            className="w-[74px] px-1.5 py-0.5 text-right text-[11px] font-medium"
            style={{
              border: `1px solid ${controlStyle.inputBorder}`,
              color: controlStyle.text,
              outline: 'none',
              backgroundColor: controlStyle.inputBg,
            }}
          />
          <span className="text-[10px]" style={{ color: controlStyle.muted }}>
            {unit}
          </span>
        </div>
      </div>
      <div className="px-0.5">
        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={toSlider(value)}
          onChange={(e) => onChange(align(fromSlider(parseFloat(e.target.value))))}
          style={{
            width: '100%',
            accentColor: controlStyle.accent,
            height: 4,
          }}
        />
        <div className="mt-1 flex justify-between text-[9px]" style={{ color: controlStyle.muted }}>
          <span>{formatValue(min)}</span>
          <span>{formatValue(max)}</span>
        </div>
      </div>
    </div>
  );
}

function PresetBtn({ label, sub, onClick }: { label: string; sub: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-start px-2.5 py-1.5 text-left transition-colors"
      style={{
        border: `1px solid ${controlStyle.blockBorder}`,
        backgroundColor: controlStyle.panelBg,
      }}
    >
      <span className="text-[11px] font-medium" style={{ color: controlStyle.text }}>
        {label}
      </span>
      <span className="text-[9px]" style={{ color: controlStyle.muted }}>
        {sub}
      </span>
    </button>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 中间：三电路图
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

type CircuitMode = 'ideal' | 'inner' | 'outer';
type CircuitViewMode = 'diagram' | 'apparatus';

interface MeterTooltipState {
  title: string;
  readingText: string;
  rangeText: string;
  accent: string;
  x: number;
  y: number;
}

const CIRCUIT_META: Record<CircuitMode, { figureNo: string; title: string; subtitle: string; color: string }> = {
  ideal: {
    figureNo: '(1)',
    title: '理想电路',
    subtitle: '取 RA = 0、RV = ∞，理想情况下 R测 = Rx',
    color: IDEAL_COLOR,
  },
  inner: {
    figureNo: '(2)',
    title: '内接法',
    subtitle: 'V 表跨接在 A 与 Rx 两端，R测 = Rx + RA，测量值偏大',
    color: INNER_COLOR,
  },
  outer: {
    figureNo: '(3)',
    title: '外接法',
    subtitle: 'V 表只跨接在 Rx 两端，R测 = Rx ∥ RV，测量值偏小',
    color: OUTER_COLOR,
  },
};

function CenterPanel({
  params,
  result,
  closed,
  viewMode,
  showIdealModel,
  showFormula,
}: {
  params: MeterErrorParams;
  result: MeterErrorResult;
  closed: boolean;
  viewMode: CircuitViewMode;
  showIdealModel: boolean;
  showFormula: boolean;
}) {
  const criticalR = result.trueValues.criticalResistance;
  const trueR = result.trueValues.trueResistance;
  const recLabel = result.errorSummary.betterMethod === 'inner' ? '内接法' : '外接法';
  const cmp = trueR > criticalR ? '>' : trueR < criticalR ? '<' : '≈';
  const innerRec = result.recommended === 'inner';
  const outerRec = result.recommended === 'outer';
  const cards: Array<{
    mode: CircuitMode;
    reading: CircuitResult;
    status: 'recommended' | 'rejected' | 'neutral';
  }> = showIdealModel
    ? [
        { mode: 'ideal', reading: result.idealValues, status: 'neutral' },
        {
          mode: 'inner',
          reading: result.innerConnectionValues,
          status: innerRec ? 'recommended' : 'rejected',
        },
        {
          mode: 'outer',
          reading: result.outerConnectionValues,
          status: outerRec ? 'recommended' : 'rejected',
        },
      ]
    : [
        {
          mode: 'inner',
          reading: result.innerConnectionValues,
          status: innerRec ? 'recommended' : 'rejected',
        },
        {
          mode: 'outer',
          reading: result.outerConnectionValues,
          status: outerRec ? 'recommended' : 'rejected',
        },
      ];

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto" style={{ backgroundColor: textbookCircuitStyle.panelBg }}>
      <div className="p-4">
        <div
          className="mb-4 rounded-xl border px-4 py-2 text-center"
          style={{
            border: `1px solid ${textbookCircuitStyle.panelBorder}`,
            backgroundColor: textbookCircuitStyle.panelBg,
            fontFamily: textbookCircuitStyle.fontFamily,
          }}
        >
          <span className="text-xs" style={{ color: textbookCircuitStyle.text }}>
            当前参数：Rx = {formatValue(trueR)}Ω {cmp} R₀ = {formatValue(criticalR)}Ω，误差绝对值更小的接法是 {recLabel}
          </span>
        </div>

        <div className={`grid gap-4 ${showIdealModel ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
          {cards.map(({ mode, reading, status }) => (
            <OneCircuit
              key={mode}
              mode={mode}
              label={CIRCUIT_META[mode].title}
              reason={CIRCUIT_META[mode].subtitle}
              params={params}
              r={reading}
              closed={closed}
              status={status}
              viewMode={viewMode}
              trueResistance={trueR}
            />
          ))}
        </div>

        <div className="mt-4">
          <RightPanel
            params={params}
            result={result}
            closed={closed}
            criticalR={criticalR}
            showFormula={showFormula}
          />
        </div>
      </div>
    </div>
  );
}

function OneCircuit({
  mode,
  label,
  reason,
  params,
  r,
  closed,
  status,
  viewMode,
  trueResistance,
}: {
  mode: CircuitMode;
  label: string;
  reason: string;
  params: MeterErrorParams;
  r: CircuitResult;
  closed: boolean;
  status: 'recommended' | 'rejected' | 'neutral';
  viewMode: CircuitViewMode;
  trueResistance: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<MeterTooltipState | null>(null);

  const redraw = useCallback(() => {
    if (viewMode !== 'diagram') return;
    const canvas = canvasRef.current;
    const box = boxRef.current;
    if (!canvas || !box) return;
    const rect = box.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    drawCircuit(ctx, rect.width, rect.height, mode, closed, 'diagram', params, r);
  }, [closed, mode, params, r, viewMode]);

  useEffect(() => {
    redraw();
  }, [redraw]);
  useEffect(() => {
    if (viewMode !== 'diagram') return undefined;
    const h = () => redraw();
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [redraw, viewMode]);

  useEffect(() => {
    setTooltip(null);
  }, [viewMode, mode, closed]);

  const handleMeterHover = useCallback(
    (
      meterTooltip: ExperimentBoardTooltipData,
      event: MouseEvent<SVGGElement>,
    ) => {
      if (!boxRef.current) return;
      const rect = boxRef.current.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      setTooltip({
        ...meterTooltip,
        x: Math.min(x + 14, rect.width - 126),
        y: Math.max(16, y - 14),
      });
    },
    [],
  );

  const handlePointerLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const errDir = getDirectionText(r.direction);
  const meta = CIRCUIT_META[mode];
  const note = mode === 'ideal' ? '理想参照' : status === 'recommended' ? '当前更准' : '对比观察';
  const accentColor = meta.color;
  const cardBorder =
    status === 'recommended'
      ? `${accentColor}66`
      : status === 'neutral'
        ? `${accentColor}33`
        : textbookCircuitStyle.panelBorder;
  const cardBg =
    status === 'recommended'
      ? `${accentColor}10`
      : status === 'neutral'
        ? '#FFFFFF'
        : textbookCircuitStyle.panelBg;
  const measurementLabel = mode === 'ideal' ? '理想测得' : '按伏安法计算';

  return (
    <div
      className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border"
      style={{
        borderColor: cardBorder,
        backgroundColor: cardBg,
      }}
    >
      <div
        className="px-4 py-3"
        style={{
          borderBottom: `1px solid ${textbookCircuitStyle.panelBorder}`,
          backgroundColor: `${accentColor}0D`,
          fontFamily: textbookCircuitStyle.fontFamily,
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            className="text-[16px] font-semibold tracking-[0.04em]"
            style={{ color: accentColor }}
          >
            {meta.figureNo} {label}
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              border: `1px solid ${status === 'recommended' ? accentColor : textbookCircuitStyle.panelBorder}`,
              color: status === 'recommended' ? accentColor : textbookCircuitStyle.text,
              backgroundColor: '#FFFFFF',
            }}
          >
            {note}
          </span>
        </div>
        <div
          className="mt-1 text-[11px] leading-relaxed"
          style={{ color: textbookCircuitStyle.muted }}
        >
          {reason}
        </div>
      </div>

      <div
        ref={boxRef}
        className="relative flex-1 overflow-hidden"
        style={{
          backgroundColor: viewMode === 'apparatus' ? '#FFFFFF' : textbookCircuitStyle.panelBg,
        }}
        onMouseLeave={handlePointerLeave}
      >
        {viewMode === 'diagram' ? (
          <canvas ref={canvasRef} />
        ) : (
          <ExperimentBoardScene
            mode={mode}
            params={params}
            result={r}
            closed={closed}
            onMeterHover={handleMeterHover}
            onMeterLeave={handlePointerLeave}
          />
        )}
        {tooltip && (
          <div
            className="pointer-events-none absolute px-2 py-1.5 text-[10px]"
            style={{
              left: tooltip.x,
              top: tooltip.y,
              backgroundColor: '#FFFFFF',
              color: textbookCircuitStyle.text,
              border: `1px solid ${textbookCircuitStyle.panelBorder}`,
              fontFamily: textbookCircuitStyle.fontFamily,
            }}
          >
            <div className="font-semibold" style={{ color: tooltip.accent }}>
              {tooltip.title}
            </div>
            <div>{tooltip.readingText}</div>
            <div style={{ color: textbookCircuitStyle.muted }}>{tooltip.rangeText}</div>
          </div>
        )}
      </div>

      <div
        className="px-4 py-4"
        style={{
          borderTop: `1px solid ${textbookCircuitStyle.panelDivider}`,
          backgroundColor: textbookCircuitStyle.panelBg,
          fontFamily: textbookCircuitStyle.fontFamily,
        }}
      >
        {closed ? (
          <div>
            <div className="grid grid-cols-2 gap-3">
              <CardStat label="电流表读数 I" value={formatValue(r.I)} unit="A" />
              <CardStat label="电压表读数 U" value={formatValue(r.V)} unit="V" />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-3"
                style={{ border: `1px solid ${accentColor}33`, backgroundColor: `${accentColor}0A` }}
              >
                <div className="text-[11px]" style={{ color: textbookCircuitStyle.muted }}>
                  {measurementLabel}
                </div>
                <div className="mt-1 text-[26px] font-semibold leading-none" style={{ color: accentColor }}>
                  {formatValue(r.Rmeasured)}
                  <span className="ml-1 text-[15px]">Ω</span>
                </div>
                <div className="mt-1 text-[10px]" style={{ color: textbookCircuitStyle.muted }}>
                  R测 = U / I
                </div>
              </div>

              <div
                className="rounded-xl p-3"
                style={{ border: `1px solid ${accentColor}22`, backgroundColor: '#FFFFFF' }}
              >
                <div className="text-[11px]" style={{ color: textbookCircuitStyle.muted }}>
                  与真实值比较
                </div>
                <div className="mt-1 text-[28px] font-bold leading-none" style={{ color: accentColor }}>
                  {formatPercent(r.error)}
                </div>
                <div className="mt-1 text-[12px] font-medium" style={{ color: textbookCircuitStyle.text }}>
                  {mode === 'ideal' ? '应等于真实值' : `结论：${errDir}`}
                </div>
                <div className="mt-1 text-[10px]" style={{ color: textbookCircuitStyle.muted }}>
                  真实值 Rx = {formatValue(trueResistance)} Ω
                </div>
              </div>
            </div>

            <div className="mt-3 rounded-xl px-3 py-2" style={{ backgroundColor: `${accentColor}0C` }}>
              <div className="text-[11px]" style={{ color: textbookCircuitStyle.muted }}>
                {mode === 'ideal'
                  ? '理想模型说明'
                  : status === 'recommended'
                    ? '当前参数下，该接法误差更小'
                    : '当前参数下，该接法误差更大'}
              </div>
              <div className="mt-0.5 text-[12px] font-medium" style={{ color: accentColor }}>
                {mode === 'ideal'
                  ? '理想模型给出无系统误差参照值'
                  : `${label}${errDir === '无误差' ? '与真实值一致' : errDir}`}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl px-3 py-3 text-[12px]" style={{ color: textbookCircuitStyle.muted, backgroundColor: '#FFFFFF' }}>
            开关断开，当前只展示电路结构；闭合开关后即可同步看到三种接法的 I、U、R测 和误差。
          </div>
        )}
      </div>
    </div>
  );
}

function CardStat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-xl border px-3 py-2" style={{ borderColor: textbookCircuitStyle.panelBorder, backgroundColor: '#FFFFFF' }}>
      <div className="text-[10px]" style={{ color: textbookCircuitStyle.muted }}>
        {label}
      </div>
      <div className="mt-1 text-[20px] font-semibold leading-none" style={{ color: textbookCircuitStyle.text }}>
        {value}
        <span className="ml-1 text-[12px]">{unit}</span>
      </div>
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 右侧：结果对比面板
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function RightPanel({
  params,
  result,
  closed,
  criticalR,
  showFormula,
}: {
  params: MeterErrorParams;
  result: MeterErrorResult;
  closed: boolean;
  criticalR: number;
  showFormula: boolean;
}) {
  const trueR = result.trueValues.trueResistance;
  const inner = result.innerConnectionValues;
  const outer = result.outerConnectionValues;
  const recommendedLabel = result.recommended === 'inner' ? '内接法' : '外接法';

  return (
    <div
      className="rounded-2xl border p-4"
      style={{
        backgroundColor: controlStyle.panelBg,
        borderColor: controlStyle.blockBorder,
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[18px] font-semibold" style={{ color: COLORS.text }}>
            误差对比总览
          </h2>
          <div className="mt-1 text-[11px]" style={{ color: COLORS.textMuted }}>
            先看真实值、两种接法的测量值和误差率，再解释为什么偏大或偏小。
          </div>
        </div>
        <div
          className="rounded-full px-3 py-1 text-[11px] font-semibold"
          style={{ backgroundColor: RECOMMEND_BG, color: controlStyle.accent, border: `1px solid ${controlStyle.successBorder}` }}
        >
          当前更准确：{recommendedLabel}
        </div>
      </div>

      {closed ? (
        <>
          <div className="mt-4 grid gap-4 xl:grid-cols-4">
            <SummaryValueCard
              title="真实值"
              accent={IDEAL_COLOR}
              majorLabel="真实电阻"
              majorValue={`${formatValue(trueR)} Ω`}
              details={[
                `电动势 E = ${formatValue(params.E)} V`,
                `电源内阻 r = ${formatValue(params.r)} Ω`,
              ]}
            />
            <MethodSummaryCard
              title="内接法"
              accent={INNER_COLOR}
              measuredLabel="R内"
              measuredValue={inner.Rmeasured}
              error={inner.error}
              direction={inner.direction}
            />
            <MethodSummaryCard
              title="外接法"
              accent={OUTER_COLOR}
              measuredLabel="R外"
              measuredValue={outer.Rmeasured}
              error={outer.error}
              direction={outer.direction}
            />
            <SummaryValueCard
              title="自动判断"
              accent={controlStyle.accent}
              majorLabel="当前更准确"
              majorValue={recommendedLabel}
              details={[
                result.recommendReason,
                `教材判据：Rx ${trueR > criticalR ? '>' : trueR < criticalR ? '<' : '≈'} R₀ = ${formatValue(criticalR)} Ω`,
              ]}
            />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr,0.65fr]">
            <div
              className="rounded-xl border p-3"
              style={{ borderColor: COLORS.border, backgroundColor: '#FFFFFF' }}
            >
              <h3 className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
                表头读数明细
              </h3>
              <ComparisonTable result={result} />
            </div>

            <div
              className="rounded-xl border p-3"
              style={{ borderColor: COLORS.border, backgroundColor: '#FFFFFF' }}
            >
              <h3 className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
                误差百分比对比
              </h3>
              <ErrorBar
                label="内接法"
                error={inner.error}
                color={INNER_COLOR}
                recommended={result.recommended === 'inner'}
              />
              <ErrorBar
                label="外接法"
                error={outer.error}
                color={OUTER_COLOR}
                recommended={result.recommended === 'outer'}
              />
              <ErrorRatioHint inner={inner.error} outer={outer.error} />
            </div>
          </div>

          {showFormula && (
            <div className="mt-4 grid gap-4 xl:grid-cols-[0.9fr,0.9fr,1.1fr]">
              <AnalysisCard
                color={INNER_COLOR}
                title="内接法推导"
                lines={[
                  '电压表跨在 Rx + RA 两端',
                  "A 表读的是经过 Rx 的支路电流",
                  `R内 = U / I = Rx + RA = ${formatValue(inner.Rmeasured)} Ω`,
                  `误差率 = ${formatPercent(inner.error)}，结论：${getDirectionText(inner.direction)}`,
                ]}
              />
              <AnalysisCard
                color={OUTER_COLOR}
                title="外接法推导"
                lines={[
                  '电压表只跨在 Rx 两端',
                  'A 表读的是总电流，含 V 表支路',
                  `R外 = U / I = Rx ∥ RV = ${formatValue(outer.Rmeasured)} Ω`,
                  `误差率 = ${formatPercent(outer.error)}，结论：${getDirectionText(outer.direction)}`,
                ]}
              />
              <div
                className="rounded-xl border p-3"
                style={{ borderColor: COLORS.border, backgroundColor: '#FFFFFF' }}
              >
                <h3 className="mb-2 text-[13px] font-semibold" style={{ color: COLORS.text }}>
                  教学提示与误差曲线
                </h3>
                <div className="mb-3 text-[10px] leading-relaxed" style={{ color: COLORS.textSecondary }}>
                  理想模型下，R测应等于 Rx。RA 越大，内接法偏大的程度越明显；RV 越小，外接法偏小的程度越明显。
                </div>
                <ErrorVsRChart rA={params.rA} rV={params.rV} currentR={params.Rx} />
                <div className="mt-3 text-[10px] leading-relaxed" style={{ color: COLORS.textMuted }}>
                  大电阻通常更适合内接法，小电阻通常更适合外接法。本页“自动判断”始终按当前参数下的误差绝对值给出结果。
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        <div
          className="mt-4 rounded-xl px-4 py-6 text-center text-[13px]"
          style={{ backgroundColor: '#FFFFFF', color: COLORS.textMuted, border: `1px solid ${COLORS.border}` }}
        >
          开关断开，当前不显示测量值与误差。闭合开关后，理想值、内接法、外接法三组结果会同步刷新。
        </div>
      )}
    </div>
  );
}

function SummaryValueCard({
  title,
  accent,
  majorLabel,
  majorValue,
  details,
}: {
  title: string;
  accent: string;
  majorLabel: string;
  majorValue: string;
  details: string[];
}) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${accent}33`, backgroundColor: '#FFFFFF' }}>
      <div className="text-[12px] font-semibold" style={{ color: accent }}>
        [{title}]
      </div>
      <div className="mt-2 text-[11px]" style={{ color: COLORS.textMuted }}>
        {majorLabel}
      </div>
      <div className="mt-1 text-[28px] font-bold leading-none" style={{ color: COLORS.text }}>
        {majorValue}
      </div>
      <div className="mt-3 flex flex-col gap-1 text-[10px]" style={{ color: COLORS.textSecondary }}>
        {details.map((detail) => (
          <div key={detail}>{detail}</div>
        ))}
      </div>
    </div>
  );
}

function MethodSummaryCard({
  title,
  accent,
  measuredLabel,
  measuredValue,
  error,
  direction,
}: {
  title: string;
  accent: string;
  measuredLabel: string;
  measuredValue: number;
  error: number;
  direction: CircuitResult['direction'];
}) {
  return (
    <div className="rounded-xl border p-3" style={{ borderColor: `${accent}33`, backgroundColor: '#FFFFFF' }}>
      <div className="text-[12px] font-semibold" style={{ color: accent }}>
        [{title}]
      </div>
      <div className="mt-2 text-[11px]" style={{ color: COLORS.textMuted }}>
        测得电阻：{measuredLabel}
      </div>
      <div className="mt-1 text-[28px] font-bold leading-none" style={{ color: accent }}>
        {formatValue(measuredValue)} Ω
      </div>
      <div className="mt-3 text-[11px]" style={{ color: COLORS.textMuted }}>
        误差率
      </div>
      <div className="mt-1 text-[32px] font-bold leading-none" style={{ color: accent }}>
        {formatPercent(error)}
      </div>
      <div className="mt-2 text-[14px] font-semibold" style={{ color: COLORS.text }}>
        结论：{getDirectionText(direction)}
      </div>
    </div>
  );
}

function getDirectionText(direction: CircuitResult['direction']) {
  if (direction === 'higher') return '偏大';
  if (direction === 'lower') return '偏小';
  return '无误差';
}

// ─── 对比表格 ─────────────────────────────────────

function ComparisonTable({ result }: { result: MeterErrorResult }) {
  return (
    <table className="w-full" style={{ fontSize: 12, borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
          <Th>类型</Th>
          <Th right>I (A)</Th>
          <Th right>V (V)</Th>
          <Th right>R&apos; (Ω)</Th>
          <Th right>误差</Th>
          <Th right>方向</Th>
        </tr>
      </thead>
      <tbody>
        <TRow label="理想" r={result.idealValues} recommended={false} />
        <TRow
          label="内接"
          r={result.innerConnectionValues}
          recommended={result.recommended === 'inner'}
          labelColor={INNER_COLOR}
        />
        <TRow
          label="外接"
          r={result.outerConnectionValues}
          recommended={result.recommended === 'outer'}
          labelColor={OUTER_COLOR}
        />
      </tbody>
    </table>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`py-1.5 ${right ? 'text-right' : 'text-left'}`}
      style={{ color: COLORS.textMuted, fontWeight: 500, fontSize: 10 }}
    >
      {children}
    </th>
  );
}

function TRow({
  label,
  r,
  recommended,
  labelColor,
}: {
  label: string;
  r: CircuitResult;
  recommended: boolean;
  labelColor?: string;
}) {
  const abs = Math.abs(r.error);
  const errColor = abs < 0.001 ? COLORS.success : abs < 0.05 ? COLORS.warning : COLORS.error;
  const dir = getDirectionText(r.direction);
  const dirColor =
    r.direction === 'higher' ? INNER_COLOR : r.direction === 'lower' ? OUTER_COLOR : COLORS.textMuted;

  return (
    <tr
      style={{
        borderBottom: `1px solid ${COLORS.border}`,
        backgroundColor: recommended ? `${COLORS.primary}08` : undefined,
      }}
    >
      <td
        className="py-1.5"
        style={{
          color: labelColor ?? COLORS.text,
          fontWeight: recommended ? 600 : 400,
          fontSize: 11,
        }}
      >
        {label}
        {recommended && <span style={{ color: COLORS.primary, marginLeft: 3 }}>★</span>}
      </td>
      <Td>{formatValue(r.I)}</Td>
      <Td>{formatValue(r.V)}</Td>
      <Td>{formatValue(r.Rmeasured)}</Td>
      <td
        className="py-1.5 text-right text-[11px] font-semibold"
        style={{ color: errColor, fontFamily: 'monospace' }}
      >
        {formatPercent(r.error)}
      </td>
      <td className="py-1.5 text-right text-[10px] font-medium" style={{ color: dirColor }}>
        {dir}
      </td>
    </tr>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td
      className="py-1.5 text-right text-[11px]"
      style={{ color: COLORS.text, fontFamily: 'monospace' }}
    >
      {children}
    </td>
  );
}

// ─── 误差条 ───────────────────────────────────────

function ErrorBar({
  label,
  error,
  color,
  recommended,
}: {
  label: string;
  error: number;
  color: string;
  recommended: boolean;
}) {
  const pct = error * 100;
  const maxPct = 30;
  const barW = Math.min((Math.abs(pct) / maxPct) * 100, 100);
  const isPositive = pct > 0;

  return (
    <div className="mb-2">
      <div className="mb-0.5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-[10px] font-medium" style={{ color }}>
            {label}
          </span>
          {recommended && (
            <span className="text-[8px] font-bold" style={{ color: COLORS.primary }}>
              推荐
            </span>
          )}
        </div>
        <span className="text-[10px] font-semibold" style={{ color }}>
          {formatPercent(error)}
        </span>
      </div>
      <div
        className="relative h-4 overflow-hidden rounded-full"
        style={{ backgroundColor: COLORS.bgMuted }}
      >
        <div
          className="absolute left-1/2 top-0 h-full w-px"
          style={{ backgroundColor: COLORS.borderStrong }}
        />
        <div
          className="absolute top-0 h-full rounded-full transition-all"
          style={{
            backgroundColor: color,
            opacity: recommended ? 0.9 : 0.5,
            width: `${barW / 2}%`,
            left: isPositive ? '50%' : `${50 - barW / 2}%`,
          }}
        />
      </div>
      <div
        className="mt-0.5 flex justify-between text-[8px]"
        style={{ color: COLORS.textPlaceholder }}
      >
        <span>← 偏小</span>
        <span>偏大 →</span>
      </div>
    </div>
  );
}

/** 2️⃣ 误差倍数对比提示 */
function ErrorRatioHint({ inner, outer }: { inner: number; outer: number }) {
  const absIn = Math.abs(inner);
  const absOut = Math.abs(outer);
  if (absIn < 1e-8 || absOut < 1e-8) return null;

  const bigger = absIn > absOut ? '内接' : '外接';
  const smaller = absIn > absOut ? '外接' : '内接';
  const ratio = Math.max(absIn, absOut) / Math.min(absIn, absOut);

  if (ratio < 1.05) {
    return (
      <div className="mt-1 text-center text-[10px] font-medium" style={{ color: COLORS.textMuted }}>
        两种方法误差接近
      </div>
    );
  }

  return (
    <div
      className="mt-1 rounded-md py-1 text-center text-[10px] font-semibold"
      style={{ backgroundColor: COLORS.errorLight, color: COLORS.error }}
    >
      {bigger}误差是{smaller}的 {ratio.toFixed(1)} 倍
    </div>
  );
}

function AnalysisCard({ title, color, lines }: { title: string; color: string; lines: string[] }) {
  return (
    <div
      className="mb-2 rounded-lg p-2.5"
      style={{ border: `1px solid ${color}25`, backgroundColor: `${color}06` }}
    >
      <div className="mb-1 text-[11px] font-semibold" style={{ color }}>
        {title}
      </div>
      {lines.map((l, i) => (
        <div key={i} className="text-[10px]" style={{ color: COLORS.textSecondary }}>
          {l}
        </div>
      ))}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 6️⃣ 误差 vs R 曲线图
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function ErrorVsRChart({ rA, rV, currentR }: { rA: number; rV: number; currentR: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const W = 260,
    H = 130;
  const criticalR = Math.sqrt(rA * rV);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, W, H);

    // 绘图区域
    const pad = { l: 36, r: 10, t: 10, b: 24 };
    const gw = W - pad.l - pad.r;
    const gh = H - pad.t - pad.b;

    // R 范围：对数刻度 1~1000
    const logMin = 0,
      logMax = 3; // log10(1) ~ log10(1000)
    const toX = (logR: number) => pad.l + ((logR - logMin) / (logMax - logMin)) * gw;
    const maxErr = 50; // 最大误差百分比
    const toY = (errPct: number) => pad.t + gh - (Math.min(Math.abs(errPct), maxErr) / maxErr) * gh;

    // 坐标轴
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.l, pad.t);
    ctx.lineTo(pad.l, pad.t + gh);
    ctx.lineTo(pad.l + gw, pad.t + gh);
    ctx.stroke();

    // Y 轴标签
    ctx.font = '8px sans-serif';
    ctx.fillStyle = COLORS.textPlaceholder;
    ctx.textAlign = 'right';
    ctx.fillText('|误差|%', pad.l - 2, pad.t + 4);
    ctx.fillText('0', pad.l - 4, pad.t + gh + 3);
    ctx.fillText(`${maxErr}`, pad.l - 4, pad.t + 8);

    // X 轴标签
    ctx.textAlign = 'center';
    for (const exp of [0, 1, 2, 3]) {
      const x = toX(exp);
      const label = exp === 0 ? '1' : exp === 1 ? '10' : exp === 2 ? '100' : '1k';
      ctx.fillText(label, x, pad.t + gh + 14);
      // 刻度线
      ctx.beginPath();
      ctx.moveTo(x, pad.t + gh);
      ctx.lineTo(x, pad.t + gh + 3);
      ctx.stroke();
    }
    ctx.fillText('R(Ω)', pad.l + gw / 2, pad.t + gh + 23);

    // 内接法曲线：|err| = rA/R * 100
    ctx.beginPath();
    ctx.strokeStyle = INNER_COLOR;
    ctx.lineWidth = 2;
    const steps = 200;
    for (let i = 0; i <= steps; i++) {
      const logR = logMin + (logMax - logMin) * (i / steps);
      const R = Math.pow(10, logR);
      const errPct = (rA / R) * 100;
      const x = toX(logR);
      const y = toY(errPct);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 外接法曲线：|err| = R/(R+rV) * 100
    ctx.beginPath();
    ctx.strokeStyle = OUTER_COLOR;
    ctx.lineWidth = 2;
    for (let i = 0; i <= steps; i++) {
      const logR = logMin + (logMax - logMin) * (i / steps);
      const R = Math.pow(10, logR);
      const errPct = (R / (R + rV)) * 100;
      const x = toX(logR);
      const y = toY(errPct);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 临界点竖线
    if (criticalR >= 1 && criticalR <= 1000) {
      const cx = toX(Math.log10(criticalR));
      ctx.beginPath();
      ctx.strokeStyle = COLORS.primary;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.moveTo(cx, pad.t);
      ctx.lineTo(cx, pad.t + gh);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = '8px sans-serif';
      ctx.fillStyle = COLORS.primary;
      ctx.textAlign = 'center';
      ctx.fillText('R₀', cx, pad.t + gh + 14);
    }

    // 当前 R 标记
    if (currentR >= 1 && currentR <= 1000) {
      const cx = toX(Math.log10(currentR));
      const innerErr = (rA / currentR) * 100;
      const outerErr = (currentR / (currentR + rV)) * 100;

      // 内接法点
      ctx.beginPath();
      ctx.fillStyle = INNER_COLOR;
      ctx.arc(cx, toY(innerErr), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      ctx.arc(cx, toY(innerErr), 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 外接法点
      ctx.beginPath();
      ctx.fillStyle = OUTER_COLOR;
      ctx.arc(cx, toY(outerErr), 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.fillStyle = '#fff';
      ctx.arc(cx, toY(outerErr), 1.5, 0, Math.PI * 2);
      ctx.fill();

      // 当前 R 竖线
      ctx.beginPath();
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.moveTo(cx, pad.t);
      ctx.lineTo(cx, pad.t + gh);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 图例
    ctx.font = '8px sans-serif';
    ctx.textAlign = 'left';
    const legY = pad.t + 4;
    ctx.fillStyle = INNER_COLOR;
    ctx.fillRect(pad.l + 4, legY - 4, 12, 2);
    ctx.fillText('内接', pad.l + 20, legY);
    ctx.fillStyle = OUTER_COLOR;
    ctx.fillRect(pad.l + 48, legY - 4, 12, 2);
    ctx.fillText('外接', pad.l + 64, legY);
  }, [rA, rV, currentR, criticalR]);

  return <canvas ref={canvasRef} style={{ width: W, height: H }} />;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 电路绘制
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function drawCircuit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: CircuitMode,
  closed: boolean,
  viewMode: CircuitViewMode,
  params: MeterErrorParams,
  result: CircuitResult,
) {
  if (viewMode === 'apparatus') {
    drawApparatusCircuit(ctx, w, h, mode, closed, params, result);
    return;
  }

  drawTextbookCircuit(ctx, w, h, mode, closed);
}

function drawTextbookCircuit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: CircuitMode,
  closed: boolean,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'miter';

  const sideMargin = Math.max(22, w * 0.07);
  const leftX = sideMargin;
  const rightX = w - sideMargin;
  const circuitHeight = Math.max(92, Math.min(118, h * 0.34));
  const topY = Math.max(52, Math.min((h - circuitHeight) * 0.42, h - circuitHeight - 58));
  const bottomY = topY + circuitHeight;
  const branchY = topY + Math.max(38, Math.min(48, circuitHeight * 0.42));
  const centerX = (leftX + rightX) / 2;

  const meterRadius = textbookCircuitStyle.meterRadius;
  const resistorWidth = textbookCircuitStyle.resistorWidth;
  const ammeterX = leftX + (rightX - leftX) * 0.29;
  const resistorX = leftX + (rightX - leftX) * 0.7;
  const sourceX = centerX;
  const switchX = leftX + (rightX - leftX) * 0.18;

  const ammeterLeft = ammeterX - meterRadius;
  const ammeterRight = ammeterX + meterRadius;
  const resistorLeft = resistorX - resistorWidth / 2;
  const resistorRight = resistorX + resistorWidth / 2;

  wire(ctx, leftX, topY, leftX, bottomY);
  wire(ctx, rightX, topY, rightX, bottomY);

  wire(ctx, leftX, bottomY, switchX - 18, bottomY);
  switchSymbol(ctx, switchX, bottomY, closed);
  wire(ctx, switchX + 18, bottomY, sourceX - 26, bottomY);
  battery(ctx, sourceX, bottomY);
  wire(ctx, sourceX + 26, bottomY, rightX, bottomY);

  wire(ctx, leftX, topY, ammeterLeft, topY);
  ammeter(ctx, ammeterX, topY, mode === 'ideal' ? 'rA=0' : 'rA');
  wire(ctx, ammeterRight, topY, resistorLeft, topY);
  resistor(ctx, resistorX, topY, 'Rx');
  wire(ctx, resistorRight, topY, rightX, topY);

  const branchLeftX = mode === 'outer' ? resistorLeft - 8 : ammeterLeft - 10;
  const branchRightX = resistorRight + 8;
  const voltmeterX = (branchLeftX + branchRightX) / 2;

  wire(ctx, branchLeftX, topY, branchLeftX, branchY);
  wire(ctx, branchLeftX, branchY, voltmeterX - meterRadius, branchY);
  voltmeter(ctx, voltmeterX, branchY, mode === 'ideal' ? 'rV=∞' : 'rV');
  wire(ctx, voltmeterX + meterRadius, branchY, branchRightX, branchY);
  wire(ctx, branchRightX, branchY, branchRightX, topY);

  dot(ctx, branchLeftX, topY);
  dot(ctx, branchRightX, topY);

  if (closed) {
    currentArrow(ctx, ammeterRight + 10, resistorLeft - 10, topY - 14, 'I');
  }

  ctx.restore();
}

function setTextbookFont(ctx: CanvasRenderingContext2D, size: number, weight = 400) {
  ctx.font = `${weight} ${size}px ${textbookCircuitStyle.fontFamily}`;
}

function wire(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
  ctx.beginPath();
  ctx.strokeStyle = textbookCircuitStyle.wire;
  ctx.lineWidth = textbookCircuitStyle.wireWidth;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath();
  ctx.fillStyle = textbookCircuitStyle.node;
  ctx.arc(x, y, textbookCircuitStyle.nodeRadius, 0, Math.PI * 2);
  ctx.fill();
}

function switchSymbol(ctx: CanvasRenderingContext2D, cx: number, cy: number, closed: boolean) {
  const leftContact = cx - 10;
  const rightContact = cx + 10;
  const liftY = cy - 11;

  dot(ctx, leftContact, cy);
  dot(ctx, rightContact, cy);

  ctx.beginPath();
  ctx.strokeStyle = textbookCircuitStyle.symbol;
  ctx.lineWidth = textbookCircuitStyle.symbolWidth;
  ctx.moveTo(leftContact, cy);
  if (closed) {
    ctx.lineTo(rightContact, cy);
  } else {
    ctx.lineTo(rightContact - 3, liftY);
  }
  ctx.stroke();

  setTextbookFont(ctx, 9);
  ctx.fillStyle = textbookCircuitStyle.muted;
  ctx.textAlign = 'center';
  ctx.fillText('S', cx, cy + 18);
}

function battery(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  const leftLead = cx - 26;
  const rightLead = cx + 26;
  const shortH = 9;
  const longH = 16;

  wire(ctx, leftLead, cy, cx - 14, cy);
  wire(ctx, cx + 14, cy, rightLead, cy);

  ctx.strokeStyle = textbookCircuitStyle.symbol;
  ctx.lineWidth = textbookCircuitStyle.symbolWidth;

  for (const [x, height] of [
    [cx - 10, shortH],
    [cx - 4, longH],
    [cx + 4, shortH],
    [cx + 10, longH],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, cy - height);
    ctx.lineTo(x, cy + height);
    ctx.stroke();
  }

  setTextbookFont(ctx, 9);
  ctx.fillStyle = textbookCircuitStyle.muted;
  ctx.textAlign = 'center';
  ctx.fillText('E, r', cx, cy + 22);
}

function resistor(ctx: CanvasRenderingContext2D, cx: number, cy: number, label: string) {
  const width = textbookCircuitStyle.resistorWidth;
  const height = textbookCircuitStyle.resistorHeight;

  ctx.beginPath();
  ctx.rect(cx - width / 2, cy - height / 2, width, height);
  ctx.strokeStyle = textbookCircuitStyle.symbol;
  ctx.lineWidth = textbookCircuitStyle.symbolWidth;
  ctx.stroke();

  setTextbookFont(ctx, 10);
  ctx.fillStyle = textbookCircuitStyle.text;
  ctx.textAlign = 'center';
  ctx.fillText(label, cx, cy - height / 2 - 8);
}

function ammeter(ctx: CanvasRenderingContext2D, cx: number, cy: number, subLabel: string) {
  const radius = textbookCircuitStyle.meterRadius;

  ctx.beginPath();
  ctx.fillStyle = textbookCircuitStyle.panelBg;
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = textbookCircuitStyle.symbol;
  ctx.lineWidth = textbookCircuitStyle.symbolWidth;
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  setTextbookFont(ctx, 12, 600);
  ctx.fillStyle = textbookCircuitStyle.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('A', cx, cy);

  setTextbookFont(ctx, 9);
  ctx.fillStyle = textbookCircuitStyle.muted;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(subLabel, cx, cy + radius + 12);
}

function voltmeter(ctx: CanvasRenderingContext2D, cx: number, cy: number, subLabel: string) {
  const radius = textbookCircuitStyle.meterRadius;

  ctx.beginPath();
  ctx.fillStyle = textbookCircuitStyle.panelBg;
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.strokeStyle = textbookCircuitStyle.symbol;
  ctx.lineWidth = textbookCircuitStyle.symbolWidth;
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  setTextbookFont(ctx, 12, 600);
  ctx.fillStyle = textbookCircuitStyle.text;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('V', cx, cy);

  setTextbookFont(ctx, 9);
  ctx.fillStyle = textbookCircuitStyle.muted;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(subLabel, cx, cy + radius + 12);
}

function currentArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  x2: number,
  y: number,
  label: string,
) {
  if (x2 <= x1) return;

  const tipX = x2;
  ctx.beginPath();
  ctx.strokeStyle = textbookCircuitStyle.symbol;
  ctx.lineWidth = 1.1;
  ctx.moveTo(x1, y);
  ctx.lineTo(tipX, y);
  ctx.stroke();

  ctx.beginPath();
  ctx.fillStyle = textbookCircuitStyle.symbol;
  ctx.moveTo(tipX, y);
  ctx.lineTo(tipX - 6, y - 3);
  ctx.lineTo(tipX - 6, y + 3);
  ctx.closePath();
  ctx.fill();

  setTextbookFont(ctx, 9);
  ctx.fillStyle = textbookCircuitStyle.muted;
  ctx.textAlign = 'center';
  ctx.fillText(label, (x1 + x2) / 2, y - 6);
}

interface Point2 {
  x: number;
  y: number;
}

interface ApparatusMeterLayout {
  x: number;
  y: number;
  width: number;
  height: number;
  leftTerminal: Point2;
  rightTerminal: Point2;
  rect: { x: number; y: number; width: number; height: number };
}

interface ApparatusLayout {
  ammeter: ApparatusMeterLayout;
  voltmeter: ApparatusMeterLayout;
  resistor: {
    x: number;
    y: number;
    width: number;
    height: number;
    leftTerminal: Point2;
    rightTerminal: Point2;
  };
  source: {
    x: number;
    y: number;
    width: number;
    height: number;
    leftTerminal: Point2;
    rightTerminal: Point2;
  };
  switchBlock: {
    x: number;
    y: number;
    width: number;
    height: number;
    leftTerminal: Point2;
    rightTerminal: Point2;
  };
  branchLeft: Point2;
  branchRight: Point2;
  benchTopY: number;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function getApparatusLayout(w: number, h: number, mode: CircuitMode): ApparatusLayout {
  const side = Math.max(20, w * 0.06);
  const usableW = w - side * 2;

  const meterW = clampNumber(usableW * 0.18, 78, 96);
  const meterH = meterW * 0.86;
  const resistorW = clampNumber(usableW * 0.2, 78, 112);
  const resistorH = clampNumber(h * 0.12, 28, 34);
  const sourceW = clampNumber(usableW * 0.24, 96, 132);
  const sourceH = 44;
  const switchW = clampNumber(usableW * 0.11, 54, 72);
  const switchH = 22;

  const voltmeterY = clampNumber(h * 0.2, 56, 84);
  const ammeterY = clampNumber(h * 0.38, 112, 152);
  const resistorY = ammeterY + 8;
  const sourceY = clampNumber(ammeterY + 82, h - 78, h - 62);
  const switchY = sourceY - 8;

  const ammeterX = side + usableW * 0.28;
  const resistorX = side + usableW * 0.72;
  const sourceX = side + usableW * 0.5;
  const switchX = side + usableW * 0.12;
  const voltmeterX = mode === 'outer' ? resistorX : (ammeterX + resistorX) / 2;

  const createMeter = (x: number, y: number): ApparatusMeterLayout => ({
    x,
    y,
    width: meterW,
    height: meterH,
    leftTerminal: { x: x - meterW * 0.22, y: y + meterH * 0.36 },
    rightTerminal: { x: x + meterW * 0.22, y: y + meterH * 0.36 },
    rect: { x: x - meterW / 2, y: y - meterH / 2, width: meterW, height: meterH },
  });

  const ammeter = createMeter(ammeterX, ammeterY);
  const voltmeter = createMeter(voltmeterX, voltmeterY);

  const resistor = {
    x: resistorX,
    y: resistorY,
    width: resistorW,
    height: resistorH,
    leftTerminal: { x: resistorX - resistorW / 2 - 6, y: resistorY },
    rightTerminal: { x: resistorX + resistorW / 2 + 6, y: resistorY },
  };

  const source = {
    x: sourceX,
    y: sourceY,
    width: sourceW,
    height: sourceH,
    leftTerminal: { x: sourceX - sourceW * 0.24, y: sourceY - sourceH * 0.38 },
    rightTerminal: { x: sourceX + sourceW * 0.24, y: sourceY - sourceH * 0.38 },
  };

  const switchBlock = {
    x: switchX,
    y: switchY,
    width: switchW,
    height: switchH,
    leftTerminal: { x: switchX - switchW * 0.32, y: switchY + 2 },
    rightTerminal: { x: switchX + switchW * 0.32, y: switchY + 2 },
  };

  const branchLeft = mode === 'outer' ? resistor.leftTerminal : ammeter.leftTerminal;
  const branchRight = resistor.rightTerminal;

  return {
    ammeter,
    voltmeter,
    resistor,
    source,
    switchBlock,
    branchLeft,
    branchRight,
    benchTopY: sourceY + sourceH * 0.32,
  };
}

function getMeterRange(kind: 'ammeter' | 'voltmeter', _params: MeterErrorParams, reading: number) {
  if (kind === 'ammeter') {
    return reading <= 0.6 ? 0.6 : 3;
  }

  return Math.abs(reading) <= 3 ? 3 : 15;
}

function drawApparatusCircuit(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  mode: CircuitMode,
  closed: boolean,
  params: MeterErrorParams,
  result: CircuitResult,
) {
  ctx.clearRect(0, 0, w, h);
  ctx.save();

  const layout = getApparatusLayout(w, h, mode);
  const liveCurrent = closed ? result.I : 0;
  const liveVoltage = closed ? result.V : 0;
  const ammeterRange = getMeterRange('ammeter', params, liveCurrent);
  const voltmeterRange = getMeterRange('voltmeter', params, liveVoltage);
  const wireColor = closed ? apparatusStyle.wire : apparatusStyle.wireMuted;

  drawBenchBackdrop(ctx, w, h, layout.benchTopY);

  drawLabWire(
    ctx,
    [
      layout.source.leftTerminal,
      { x: layout.source.leftTerminal.x - 20, y: layout.source.leftTerminal.y + 24 },
      { x: layout.switchBlock.leftTerminal.x - 18, y: layout.switchBlock.leftTerminal.y + 14 },
      layout.switchBlock.leftTerminal,
    ],
    wireColor,
  );

  drawLabWire(
    ctx,
    [
      layout.switchBlock.rightTerminal,
      { x: layout.switchBlock.rightTerminal.x + 20, y: layout.switchBlock.rightTerminal.y - 44 },
      { x: layout.ammeter.leftTerminal.x - 24, y: layout.ammeter.leftTerminal.y - 26 },
      layout.ammeter.leftTerminal,
    ],
    wireColor,
  );

  drawLabWire(
    ctx,
    [
      layout.ammeter.rightTerminal,
      {
        x: (layout.ammeter.rightTerminal.x + layout.resistor.leftTerminal.x) / 2,
        y: layout.ammeter.rightTerminal.y - 24,
      },
      layout.resistor.leftTerminal,
    ],
    wireColor,
  );

  drawLabWire(
    ctx,
    [
      layout.resistor.rightTerminal,
      { x: layout.resistor.rightTerminal.x + 28, y: layout.resistor.rightTerminal.y + 42 },
      { x: layout.source.rightTerminal.x + 14, y: layout.source.rightTerminal.y - 34 },
      layout.source.rightTerminal,
    ],
    wireColor,
  );

  drawLabWire(
    ctx,
    [
      layout.branchLeft,
      { x: layout.branchLeft.x, y: layout.voltmeter.leftTerminal.y + 34 },
      { x: layout.voltmeter.leftTerminal.x - 16, y: layout.voltmeter.leftTerminal.y + 18 },
      layout.voltmeter.leftTerminal,
    ],
    wireColor,
  );

  drawLabWire(
    ctx,
    [
      layout.voltmeter.rightTerminal,
      { x: layout.voltmeter.rightTerminal.x + 16, y: layout.voltmeter.rightTerminal.y + 18 },
      { x: layout.branchRight.x, y: layout.branchRight.y - 26 },
      layout.branchRight,
    ],
    wireColor,
  );

  drawApparatusSource(ctx, layout.source, params.E, params.r);
  drawApparatusSwitch(ctx, layout.switchBlock, closed);
  drawApparatusResistor(ctx, layout.resistor, params.Rx);
  drawApparatusMeter(
    ctx,
    layout.ammeter,
    'A',
    liveCurrent,
    ammeterRange,
    apparatusStyle.ammeterAccent,
  );
  drawApparatusMeter(
    ctx,
    layout.voltmeter,
    'V',
    liveVoltage,
    voltmeterRange,
    apparatusStyle.voltmeterAccent,
  );

  if (closed) {
    drawApparatusDirectionArrow(
      ctx,
      { x: layout.ammeter.rightTerminal.x + 10, y: layout.ammeter.rightTerminal.y - 26 },
      { x: layout.resistor.leftTerminal.x - 12, y: layout.resistor.leftTerminal.y - 26 },
      'I',
    );
  }

  ctx.restore();
}

function drawBenchBackdrop(ctx: CanvasRenderingContext2D, w: number, h: number, benchTopY: number) {
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#FBF9F5');
  gradient.addColorStop(1, apparatusStyle.bg);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  ctx.fillStyle = apparatusStyle.benchTop;
  ctx.fillRect(0, benchTopY, w, h - benchTopY);
  ctx.fillStyle = apparatusStyle.benchShadow;
  ctx.fillRect(0, benchTopY, w, 6);
}

function drawLabWire(ctx: CanvasRenderingContext2D, points: Point2[], color: string) {
  if (points.length < 2) return;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);

  if (points.length === 2) {
    ctx.lineTo(points[1]!.x, points[1]!.y);
  } else {
    for (let i = 1; i < points.length - 1; i++) {
      const current = points[i]!;
      const next = points[i + 1]!;
      const midX = (current.x + next.x) / 2;
      const midY = (current.y + next.y) / 2;
      ctx.quadraticCurveTo(current.x, current.y, midX, midY);
    }
    const penultimate = points[points.length - 2]!;
    const last = points[points.length - 1]!;
    ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
  }

  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  ctx.restore();
}

function drawTerminalPost(
  ctx: CanvasRenderingContext2D,
  point: Point2,
  color: string,
  radius = 4.5,
) {
  ctx.save();
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(15,23,42,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
}

function drawApparatusSource(
  ctx: CanvasRenderingContext2D,
  source: ApparatusLayout['source'],
  emf: number,
  sourceResistance: number,
) {
  ctx.save();
  const left = source.x - source.width / 2;
  const top = source.y - source.height / 2;

  ctx.fillStyle = apparatusStyle.sourceBody;
  ctx.beginPath();
  ctx.roundRect(left, top, source.width, source.height, 10);
  ctx.fill();

  ctx.fillStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.roundRect(left + 10, top + 10, source.width - 20, source.height - 20, 8);
  ctx.fill();

  ctx.fillStyle = apparatusStyle.label;
  ctx.font = '600 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`E=${formatValue(emf)} V`, source.x, source.y - 6);
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(`r=${formatValue(sourceResistance)} Ω`, source.x, source.y + 10);

  drawTerminalPost(ctx, source.leftTerminal, apparatusStyle.terminalBlack);
  drawTerminalPost(ctx, source.rightTerminal, apparatusStyle.terminalRed);

  ctx.font = '600 11px Inter, sans-serif';
  ctx.fillStyle = apparatusStyle.terminalBlack;
  ctx.fillText('−', source.leftTerminal.x, source.leftTerminal.y - 12);
  ctx.fillStyle = apparatusStyle.terminalRed;
  ctx.fillText('+', source.rightTerminal.x, source.rightTerminal.y - 12);
  ctx.restore();
}

function drawApparatusSwitch(
  ctx: CanvasRenderingContext2D,
  switchBlock: ApparatusLayout['switchBlock'],
  closed: boolean,
) {
  ctx.save();
  const left = switchBlock.x - switchBlock.width / 2;
  const top = switchBlock.y - switchBlock.height / 2;

  ctx.fillStyle = apparatusStyle.switchBase;
  ctx.beginPath();
  ctx.roundRect(left, top, switchBlock.width, switchBlock.height, 8);
  ctx.fill();

  const pivot = { x: switchBlock.leftTerminal.x + 4, y: switchBlock.leftTerminal.y - 8 };
  const progress = closed ? 1 : 0;
  const end = {
    x: switchBlock.leftTerminal.x + 12 + switchBlock.width * 0.34,
    y: switchBlock.leftTerminal.y - 8 - (1 - progress) * 18,
  };

  ctx.strokeStyle = '#E5E7EB';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pivot.x, pivot.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  drawTerminalPost(ctx, switchBlock.leftTerminal, apparatusStyle.terminalBlack, 4.2);
  drawTerminalPost(ctx, switchBlock.rightTerminal, apparatusStyle.terminalRed, 4.2);

  ctx.fillStyle = apparatusStyle.switchHandle;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = apparatusStyle.label;
  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(closed ? 'S 闭合' : 'S 断开', switchBlock.x, top - 8);
  ctx.restore();
}

function drawApparatusResistor(
  ctx: CanvasRenderingContext2D,
  resistor: ApparatusLayout['resistor'],
  resistance: number,
) {
  ctx.save();
  const bodyW = resistor.width * 0.72;
  const bodyH = resistor.height;
  const left = resistor.x - bodyW / 2;
  const top = resistor.y - bodyH / 2;

  ctx.fillStyle = apparatusStyle.resistorBody;
  ctx.beginPath();
  ctx.roundRect(left, top, bodyW, bodyH, 10);
  ctx.fill();
  ctx.strokeStyle = apparatusStyle.resistorEdge;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const bands = getResistanceBandColors(resistance);
  const gap = bodyW / (bands.length + 2);
  bands.forEach((color, index) => {
    ctx.fillStyle = color;
    ctx.fillRect(left + gap * (index + 1), top + 3, 6, bodyH - 6);
  });

  drawTerminalPost(ctx, resistor.leftTerminal, apparatusStyle.terminalBlack, 4.2);
  drawTerminalPost(ctx, resistor.rightTerminal, apparatusStyle.terminalRed, 4.2);

  ctx.fillStyle = apparatusStyle.label;
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`Rx  ${formatValue(resistance)} Ω`, resistor.x, top - 8);
  ctx.restore();
}

function getResistanceBandColors(resistance: number) {
  const bandMap = [
    '#111827',
    '#8B4513',
    '#EF4444',
    '#F97316',
    '#FACC15',
    '#22C55E',
    '#2563EB',
    '#7C3AED',
    '#94A3B8',
    '#FFFFFF',
  ];

  const rounded = Math.max(1, Math.round(resistance));
  const digits = rounded.toString().padEnd(2, '0');
  const first = Number(digits[0] ?? 1);
  const second = Number(digits[1] ?? 0);
  const multiplier = clampNumber(digits.length - 2, 0, 9);

  return [bandMap[first]!, bandMap[second]!, bandMap[multiplier]!, '#D4AF37'];
}

function drawApparatusMeter(
  ctx: CanvasRenderingContext2D,
  meter: ApparatusMeterLayout,
  symbol: 'A' | 'V',
  reading: number,
  rangeMax: number,
  accent: string,
) {
  ctx.save();
  const left = meter.x - meter.width / 2;
  const top = meter.y - meter.height / 2;

  ctx.fillStyle = apparatusStyle.meterBody;
  ctx.beginPath();
  ctx.roundRect(left, top, meter.width, meter.height, 16);
  ctx.fill();
  ctx.strokeStyle = apparatusStyle.meterFrame;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = apparatusStyle.meterGlass;
  ctx.beginPath();
  ctx.roundRect(left + 8, top + 8, meter.width - 16, meter.height - 18, 12);
  ctx.fill();

  const dialCenter = { x: meter.x, y: top + meter.height * 0.62 };
  const dialRadius = Math.min(meter.width * 0.34, meter.height * 0.42);
  const startAngle = (-5 * Math.PI) / 6;
  const endAngle = -Math.PI / 6;
  const clamped = clampNumber(Math.abs(reading) / Math.max(rangeMax, 1e-6), 0, 1);
  const needleAngle = startAngle + clamped * (endAngle - startAngle);

  ctx.strokeStyle = '#CBD5E1';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(dialCenter.x, dialCenter.y, dialRadius, startAngle, endAngle);
  ctx.stroke();

  for (let i = 0; i <= 10; i++) {
    const ratio = i / 10;
    const angle = startAngle + ratio * (endAngle - startAngle);
    const outer = polarPoint(dialCenter, dialRadius, angle);
    const inner = polarPoint(dialCenter, dialRadius - (i % 5 === 0 ? 10 : 6), angle);
    ctx.strokeStyle = i % 5 === 0 ? apparatusStyle.meterFrame : '#94A3B8';
    ctx.lineWidth = i % 5 === 0 ? 1.4 : 1;
    ctx.beginPath();
    ctx.moveTo(outer.x, outer.y);
    ctx.lineTo(inner.x, inner.y);
    ctx.stroke();
  }

  ctx.fillStyle = apparatusStyle.label;
  ctx.font = '9px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('0', dialCenter.x - dialRadius + 4, dialCenter.y + 10);
  ctx.fillText(formatValue(rangeMax / 2), dialCenter.x, dialCenter.y - dialRadius * 0.78);
  ctx.fillText(formatValue(rangeMax), dialCenter.x + dialRadius - 4, dialCenter.y + 10);

  const needleEnd = polarPoint(dialCenter, dialRadius - 12, needleAngle);
  ctx.strokeStyle = reading > rangeMax ? '#DC2626' : accent;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(dialCenter.x, dialCenter.y);
  ctx.lineTo(needleEnd.x, needleEnd.y);
  ctx.stroke();

  ctx.fillStyle = apparatusStyle.meterFrame;
  ctx.beginPath();
  ctx.arc(dialCenter.x, dialCenter.y, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = accent;
  ctx.font = '700 14px Inter, sans-serif';
  ctx.fillText(symbol, meter.x, top + 18);

  ctx.fillStyle = apparatusStyle.label;
  ctx.font = '10px Inter, sans-serif';
  ctx.fillText(`0~${formatValue(rangeMax)}${symbol}`, meter.x, top + meter.height - 14);

  drawTerminalPost(ctx, meter.leftTerminal, apparatusStyle.terminalBlack, 4.4);
  drawTerminalPost(ctx, meter.rightTerminal, apparatusStyle.terminalRed, 4.4);
  ctx.restore();
}

function polarPoint(center: Point2, radius: number, angle: number): Point2 {
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function drawApparatusDirectionArrow(
  ctx: CanvasRenderingContext2D,
  start: Point2,
  end: Point2,
  label: string,
) {
  ctx.save();
  ctx.strokeStyle = apparatusStyle.label;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.fillStyle = apparatusStyle.label;
  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(end.x - 7, end.y - 3.5);
  ctx.lineTo(end.x - 7, end.y + 3.5);
  ctx.closePath();
  ctx.fill();

  ctx.font = '10px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, (start.x + end.x) / 2, start.y - 6);
  ctx.restore();
}
