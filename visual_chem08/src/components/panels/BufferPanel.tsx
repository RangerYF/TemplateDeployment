import * as React from 'react';
import { COLORS } from '@/styles/tokens';
import { useBufferStore } from '@/store';
import { BUFFER_OPTIONS, getBuffer } from '@/data/bufferSystems';
import { Select } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';

export function BufferPanel() {
  const bufferId = useBufferStore((s) => s.selectedBufferId);
  const addedAmount = useBufferStore((s) => s.addedAmount);
  const addType = useBufferStore((s) => s.addType);
  const result = useBufferStore((s) => s.result);
  const setSelectedBuffer = useBufferStore((s) => s.setSelectedBuffer);
  const setAddedAmount = useBufferStore((s) => s.setAddedAmount);
  const setAddType = useBufferStore((s) => s.setAddType);
  const displayMode = useBufferStore((s) => s.displayMode);
  const setDisplayMode = useBufferStore((s) => s.setDisplayMode);

  const buf = getBuffer(bufferId);

  // 步长选择器状态
  const amountSteps = [0.00001, 0.0001, 0.001];
  const [stepIdx, setStepIdx] = React.useState(1); // default 0.0001
  const activeStep = amountSteps[stepIdx];

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto h-full">
      {/* 缓冲体系选择 */}
      <Section title="缓冲体系">
        <Select
          value={bufferId}
          onChange={(e) => setSelectedBuffer(e.target.value)}
          options={BUFFER_OPTIONS}
        />
        <div className="mt-2 text-sm" style={{ color: COLORS.textMuted }}>
          组成：{buf.formulas[0]} / {buf.formulas[1]}
          <br />
          各组分浓度：0.1 mol/L，体积：100 mL
          <br />
          目标 pH ≈ {buf.targetPH}（pKa = {buf.pKa}）
        </div>
      </Section>

      {/* 操作参数 */}
      <Section title="对比实验">
        {/* 加酸/加碱切换 */}
        <div className="flex gap-2 mb-3">
          {(['acid', 'base'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setAddType(t)}
              className="flex-1 py-2 text-sm font-medium rounded-full transition-all duration-150"
              style={{
                backgroundColor: addType === t ? COLORS.primary : COLORS.bgMuted,
                color: addType === t ? COLORS.white : COLORS.textMuted,
              }}
            >
              {t === 'acid' ? '加入酸 (HCl)' : '加入碱 (NaOH)'}
            </button>
          ))}
        </div>

        {/* 加入量滑块 */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium" style={{ color: COLORS.text }}>
              加入量 (mmol)
            </span>
            <StepSelector
              options={amountSteps}
              activeIdx={stepIdx}
              onChange={setStepIdx}
              formatFn={(s) => `${(s * 1000).toFixed(Math.max(0, -Math.floor(Math.log10(s * 1000))))}`}
            />
          </div>
          <Slider
            value={[addedAmount]}
            onValueChange={([v]) => setAddedAmount(v)}
            min={0}
            max={0.05}
            step={0.00001}
            buttonStep={activeStep}
            formatValue={(v) => (v * 1000).toFixed(3)}
            parseValue={(s) => parseFloat(s) / 1000}
          />
        </div>
      </Section>

      {/* 图表模式 */}
      <Section title="图表显示">
        <div className="flex gap-2">
          {(['delta', 'absolute'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setDisplayMode(m)}
              className="flex-1 py-2 text-sm font-medium rounded-full transition-all duration-150"
              style={{
                backgroundColor: displayMode === m ? COLORS.primary : COLORS.bgMuted,
                color: displayMode === m ? COLORS.white : COLORS.textMuted,
              }}
            >
              {m === 'delta' ? '显示变化值' : '显示度量值'}
            </button>
          ))}
        </div>
      </Section>

      {/* 结果 */}
      {result && (
        <Section title="pH 变化结果">
          <DataRow label="缓冲液初始 pH" value={result.bufferInitialPH.toFixed(2)} />
          <DataRow label="缓冲液终态 pH" value={result.bufferFinalPH.toFixed(2)} />
          <DataRow label="缓冲液 ΔpH" value={result.bufferPHChange.toFixed(4)} highlight />
          <div className="my-2" />
          <DataRow label="纯水初始 pH" value={result.waterInitialPH.toFixed(2)} />
          <DataRow label="纯水终态 pH" value={result.waterFinalPH.toFixed(2)} />
          <DataRow label="纯水 ΔpH" value={result.waterPHChange.toFixed(4)} />
          <div className="mt-2 text-sm font-semibold" style={{ color: COLORS.primary }}>
            缓冲液的 pH 变化仅为纯水的{' '}
            {result.waterPHChange > 0
              ? (result.bufferPHChange / result.waterPHChange * 100).toFixed(1)
              : '0'
            }%
          </div>
        </Section>
      )}

      {/* 缓冲原理 */}
      <Section title="缓冲原理">
        <div className="text-sm leading-relaxed" style={{ color: COLORS.textSecondary }}>
          {buf.description}
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

function StepSelector({
  options,
  activeIdx,
  onChange,
  formatFn,
}: {
  options: number[];
  activeIdx: number;
  onChange: (idx: number) => void;
  formatFn?: (s: number) => string;
}) {
  const fmt = formatFn ?? ((s: number) => {
    if (s >= 1) return s.toString();
    return s.toFixed(Math.max(0, -Math.floor(Math.log10(s))));
  });

  return (
    <div className="flex items-center gap-0.5">
      <span className="text-sm mr-1" style={{ color: COLORS.textTertiary }}>步长</span>
      {options.map((s, i) => {
        const active = i === activeIdx;
        return (
          <button
            key={s}
            type="button"
            onClick={() => onChange(i)}
            className="px-1.5 py-0.5 text-sm font-medium rounded-full transition-all duration-100"
            style={{
              backgroundColor: active ? COLORS.primary : 'transparent',
              color: active ? COLORS.white : COLORS.textMuted,
              lineHeight: '14px',
            }}
          >
            {fmt(s)}
          </button>
        );
      })}
    </div>
  );
}

function DataRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between text-sm py-1" style={{ borderBottom: `1px solid ${COLORS.bgMuted}` }}>
      <span style={{ color: COLORS.textMuted }}>{label}</span>
      <span style={{ color: highlight ? COLORS.primary : COLORS.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
