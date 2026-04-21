import { useState } from 'react';
import { Slider } from '@/components/ui/slider';
import { EditableNumber } from '@/components/ui/editable-number';
import { COLORS } from '@/styles/tokens';

const SCALES = [
  { label: '千', value: 1_000 },
  { label: '万', value: 10_000 },
  { label: '十万', value: 100_000 },
  { label: '百万', value: 1_000_000 },
  { label: '千万', value: 10_000_000 },
] as const;

function pickScale(value: number): number {
  for (const s of SCALES) {
    if (value <= s.value) return s.value;
  }
  return SCALES[SCALES.length - 1].value;
}

function stepForScale(scale: number): number {
  if (scale <= 1_000) return 10;
  if (scale <= 10_000) return 100;
  if (scale <= 100_000) return 1_000;
  if (scale <= 1_000_000) return 10_000;
  return 100_000;
}

interface ScaleNSliderProps {
  label: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}

export function ScaleNSlider({ label, value, min = 10, onChange }: ScaleNSliderProps) {
  const [userScale, setUserScale] = useState(() => pickScale(value));

  // Effective scale: if value exceeds user-selected scale, auto-bump
  const scale = value > userScale ? pickScale(value) : userScale;
  const step = stepForScale(scale);
  const sliderVal = Math.min(value, scale);

  return (
    <div>
      <div className="flex justify-between mb-1.5">
        <span style={{ fontSize: 14, color: COLORS.textSecondary }}>{label}</span>
        <EditableNumber
          value={value}
          min={min}
          max={999_999_999}
          step={1}
          format={v => v.toLocaleString()}
          onChange={onChange}
        />
      </div>
      <Slider
        value={[sliderVal]}
        min={min}
        max={scale}
        step={step}
        onValueChange={([v]) => onChange(v)}
      />
      {/* Scale selector */}
      <div className="flex items-center gap-1 mt-1.5">
        <span style={{ fontSize: 14, color: COLORS.textTertiary, flexShrink: 0 }}>范围</span>
        <div className="flex gap-0.5 flex-1">
          {SCALES.map(s => (
            <button
              key={s.value}
              onClick={() => {
                setUserScale(s.value);
                if (value > s.value) onChange(s.value);
              }}
              className="flex-1 py-0.5 rounded text-center transition-colors"
              style={{
                fontSize: 14,
                fontWeight: scale === s.value ? 600 : 400,
                backgroundColor: scale === s.value ? COLORS.primaryLight : 'transparent',
                color: scale === s.value ? COLORS.primary : COLORS.textTertiary,
                border: `1px solid ${scale === s.value ? COLORS.primary : COLORS.border}`,
                cursor: 'pointer',
                minHeight: 22,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
