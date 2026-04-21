import { COLORS } from '@/styles/tokens';
import { useComparisonStore, CURVE_COLORS } from '@/store';
import { TITRATION_PRESETS, REFERENCE_STANDARDS, getPreset } from '@/data/titrationPresets';

export function ComparisonPanel() {
  const selectedTypes = useComparisonStore((s) => s.selectedTypes);
  const curves = useComparisonStore((s) => s.curves);
  const toggleType = useComparisonStore((s) => s.toggleType);

  return (
    <div className="flex flex-col gap-5 p-4 overflow-y-auto h-full">
      {/* 曲线选择 */}
      <Section title="选择滴定类型">
        <div className="flex flex-col gap-2">
          {TITRATION_PRESETS.map((preset) => {
            const checked = selectedTypes.includes(preset.type);
            const idx = selectedTypes.indexOf(preset.type);
            const color = idx >= 0 ? CURVE_COLORS[idx] : COLORS.textMuted;

            return (
              <label
                key={preset.type}
                className="flex items-center gap-2 cursor-pointer text-sm"
                style={{ color: COLORS.text }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleType(preset.type)}
                  className="accent-emerald-500"
                  disabled={false}
                />
                <span
                  className="inline-block w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: checked ? color : 'transparent', border: `1.5px solid ${color}` }}
                />
                <span>{preset.label}</span>
                <span className="text-sm" style={{ color: COLORS.textMuted }}>
                  {preset.titrantFormula} → {preset.analyteFormula}
                </span>
              </label>
            );
          })}
        </div>
      </Section>

      {/* 固定参数 */}
      <Section title="对比参数（固定）">
        <div className="text-sm" style={{ color: COLORS.textSecondary }}>
          <p>浓度：0.1 mol/L</p>
          <p>被测物体积：20 mL</p>
        </div>
      </Section>

      {/* 等当点数据 */}
      {selectedTypes.length > 0 && (
        <Section title="等当点数据">
          <div className="flex flex-col gap-1">
            {selectedTypes.map((type, idx) => {
              const curve = curves[type];
              const preset = getPreset(type);
              const color = CURVE_COLORS[idx];
              return (
                <div key={type} className="text-sm py-1" style={{ borderBottom: `1px solid ${COLORS.bgMuted}` }}>
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                    <span style={{ color: COLORS.text, fontWeight: 600 }}>{preset.label}</span>
                  </div>
                  {curve && (
                    <span style={{ color: COLORS.textMuted }}>
                      V<sub>eq</sub>={curve.eqVolume.toFixed(1)}mL, pH={curve.eqPH.toFixed(2)}
                      {curve.halfEqPH != null && `, pKa=${curve.halfEqPH.toFixed(2)}`}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* 推荐指示剂 */}
      {selectedTypes.length > 0 && (
        <Section title="推荐指示剂">
          {selectedTypes.map((type) => {
            const preset = getPreset(type);
            return (
              <div key={type} className="text-sm mb-1" style={{ color: COLORS.textSecondary }}>
                <strong>{preset.label}：</strong>
                {preset.recommendedIndicators.map((id) => {
                  const names: Record<string, string> = {
                    phenolphthalein: '酚酞',
                    methylOrange: '甲基橙',
                  };
                  return names[id] || id;
                }).join('、')}
              </div>
            );
          })}
        </Section>
      )}

      {/* 基准物质 */}
      <Section title="基准物质说明">
        <div className="text-sm leading-relaxed" style={{ color: COLORS.textSecondary }}>
          <p className="mb-1">
            滴定剂浓度需用基准物质标定，确保结果准确：
          </p>
          <p className="mb-1">
            <strong>标定酸：</strong>{REFERENCE_STANDARDS.forAcid.name}
          </p>
          <p>
            <strong>标定碱：</strong>{REFERENCE_STANDARDS.forBase.name}
          </p>
        </div>
      </Section>
    </div>
  );
}

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
