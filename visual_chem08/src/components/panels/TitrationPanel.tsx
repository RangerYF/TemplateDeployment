import * as React from 'react';
import { COLORS } from '@/styles/tokens';
import { useTitrationStore } from '@/store';
import { TITRATION_TYPE_OPTIONS, getPreset } from '@/data/titrationPresets';
import { INDICATORS } from '@/data/indicators';
import { REFERENCE_STANDARDS } from '@/data/titrationPresets';
import { getErrorDirection, errorDirectionLabel } from '@/engine/titrationMath';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import type { TitrationType } from '@/data/titrationPresets';

export function TitrationPanel() {
  const typeId = useTitrationStore((s) => s.titrationTypeId);
  const titrantConc = useTitrationStore((s) => s.titrantConc);
  const analyteConc = useTitrationStore((s) => s.analyteConc);
  const analyteVol = useTitrationStore((s) => s.analyteVol);
  const selectedIndicatorIds = useTitrationStore((s) => s.selectedIndicatorIds);
  const curveData = useTitrationStore((s) => s.curveData);
  const setTitrationType = useTitrationStore((s) => s.setTitrationType);
  const setTitrantConc = useTitrationStore((s) => s.setTitrantConc);
  const setAnalyteConc = useTitrationStore((s) => s.setAnalyteConc);
  const setAnalyteVol = useTitrationStore((s) => s.setAnalyteVol);
  const toggleIndicator = useTitrationStore((s) => s.toggleIndicator);

  const preset = getPreset(typeId);
  const titrantIsAcid = typeId === 'strongAcid_strongBase' || typeId === 'strongAcid_weakBase';

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto h-full">
      {/* Section: 滴定类型 */}
      <Section title="滴定类型">
        <Select
          value={typeId}
          onChange={(e) => setTitrationType(e.target.value as TitrationType)}
          options={TITRATION_TYPE_OPTIONS}
        />
        <div className="mt-2 text-sm" style={{ color: COLORS.textMuted }}>
          滴定剂：{preset.titrantFormula}（{preset.titrant}）
          <br />
          被测物：{preset.analyteFormula}（{preset.analyte}）
        </div>
      </Section>

      {/* Section: 浓度与体积 */}
      <Section title="参数设置">
        <ParamSlider
          label="滴定剂浓度 (mol/L)"
          value={titrantConc}
          min={0.0001}
          max={2}
          step={0.0001}
          stepOptions={[0.0001, 0.001, 0.01, 0.1]}
          defaultStepIdx={2}
          onChange={setTitrantConc}
        />
        <ParamSlider
          label="被测物浓度 (mol/L)"
          value={analyteConc}
          min={0.0001}
          max={2}
          step={0.0001}
          stepOptions={[0.0001, 0.001, 0.01, 0.1]}
          defaultStepIdx={2}
          onChange={setAnalyteConc}
        />
        <ParamSlider
          label="被测物体积 (mL)"
          value={analyteVol}
          min={0.1}
          max={500}
          step={0.1}
          stepOptions={[0.1, 1, 5, 10]}
          defaultStepIdx={1}
          onChange={setAnalyteVol}
        />
      </Section>

      {/* Section: 指示剂选择 */}
      <Section title="指示剂">
        <div className="flex flex-col gap-2">
          {INDICATORS.map((ind) => {
            const checked = selectedIndicatorIds.includes(ind.id);
            const midPH = (ind.pHRange[0] + ind.pHRange[1]) / 2;
            const errDir = curveData
              ? getErrorDirection(midPH, curveData.eqPH, titrantIsAcid)
              : 'good';
            const errLabel = curveData ? errorDirectionLabel(errDir) : '';

            return (
              <label
                key={ind.id}
                className="flex items-center gap-2 cursor-pointer text-sm"
                style={{ color: COLORS.text }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleIndicator(ind.id)}
                  className="accent-emerald-500"
                />
                <span>{ind.name}</span>
                <span className="text-xs" style={{ color: COLORS.textMuted }}>
                  pH {ind.pHRange[0]}–{ind.pHRange[1]}
                </span>
                {!ind.canUseTitration && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: COLORS.errorLight, color: COLORS.error }}>
                    不可用
                  </span>
                )}
                {ind.canUseTitration && curveData && (
                  <span
                    className="text-xs px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: errDir === 'good' ? COLORS.successLight : COLORS.warningLight,
                      color: errDir === 'good' ? COLORS.success : COLORS.warning,
                    }}
                  >
                    {errLabel}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </Section>

      {/* Section: 等当点数据 */}
      {curveData && (
        <Section title="数据摘要">
          <DataRow label="等当点体积" value={`${curveData.eqVolume.toFixed(2)} mL`} />
          <DataRow label="等当点 pH" value={curveData.eqPH.toFixed(2)} />
          {curveData.halfEqPH != null && (
            <DataRow label="半当量点 pH (pKa)" value={curveData.halfEqPH.toFixed(2)} />
          )}
          <DataRow
            label="突跃范围"
            value={`pH ${curveData.jumpRange[0].toFixed(1)} – ${curveData.jumpRange[1].toFixed(1)}`}
          />
        </Section>
      )}

      {/* Section: 基准物质 */}
      <Section title="基准物质说明">
        <div className="text-sm leading-relaxed" style={{ color: COLORS.textSecondary }}>
          <p className="mb-1">
            滴定分析中，滴定剂浓度需用基准物质标定：
          </p>
          <p className="mb-1">
            <strong>标定酸：</strong>{REFERENCE_STANDARDS.forAcid.name} — {REFERENCE_STANDARDS.forAcid.description}
          </p>
          <p>
            <strong>标定碱：</strong>{REFERENCE_STANDARDS.forBase.name} — {REFERENCE_STANDARDS.forBase.description}
          </p>
        </div>
      </Section>
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div
        className="text-sm font-semibold uppercase tracking-wider mb-2"
        style={{ color: COLORS.textMuted }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

/** 步长选择器 — 一排小型 pill 按钮 */
function StepSelector({
  options,
  activeIdx,
  onChange,
}: {
  options: number[];
  activeIdx: number;
  onChange: (idx: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <span className="text-xs mr-1" style={{ color: COLORS.textTertiary }}>步长</span>
      {options.map((s, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(i)}
            className="px-1.5 py-0.5 text-xs font-medium rounded-full transition-all duration-100"
            style={{
              backgroundColor: active ? COLORS.primary : 'transparent',
              color: active ? COLORS.white : COLORS.textMuted,
              lineHeight: '14px',
            }}
          >
            {formatStep(s)}
          </button>
        );
      })}
    </div>
  );
}

function formatStep(s: number): string {
  if (s >= 1) return s.toString();
  // 显示有效位数，避免 0.00010000
  return s.toFixed(Math.max(0, -Math.floor(Math.log10(s))));
}

function ParamSlider({
  label, value, min, max, step, stepOptions, defaultStepIdx, onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  stepOptions: number[];
  defaultStepIdx: number;
  onChange: (v: number) => void;
}) {
  const [stepIdx, setStepIdx] = React.useState(defaultStepIdx);
  const activeStep = stepOptions[stepIdx];

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm font-medium" style={{ color: COLORS.text }}>{label}</span>
        <StepSelector options={stepOptions} activeIdx={stepIdx} onChange={setStepIdx} />
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        buttonStep={activeStep}
      />
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm py-1" style={{ borderBottom: `1px solid ${COLORS.bgMuted}` }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: COLORS.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
