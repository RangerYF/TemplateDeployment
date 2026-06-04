import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { wavelengthToColor } from '@/lib/utils/wavelengthToColor';

/** Section heading — thin uppercase label with optional aside tag */
export function SectionTitle({ children, aside }: { children: React.ReactNode; aside?: string }) {
  return (
    <div className="mb-2 mt-4 flex items-center gap-2 first:mt-0">
      <h4
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        {children}
      </h4>
      {aside && (
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--theme-text-muted)', opacity: 0.5 }}
        >
          {aside}
        </span>
      )}
    </div>
  );
}

/** Labeled slider row: label + value on one line, slider below */
export function ParamSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  unit = '',
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  unit?: string;
  hint?: string;
}) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs" style={{ color: 'var(--theme-text)' }}>
          {label}
        </span>
        <span
          className="tabular-nums text-xs font-medium"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          {value.toFixed(step < 1 ? (step < 0.1 ? 2 : 1) : 0)}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
      {hint && (
        <p
          className="mt-0.5 text-[10px] leading-tight"
          style={{ color: 'var(--theme-text-muted)', opacity: 0.7 }}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** Segmented selector (small button group) */
export function SegSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="mb-2 flex gap-1">
      {options.map((opt) => (
        <button
          key={opt.value}
          className="flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors"
          style={{
            background:
              value === opt.value
                ? 'var(--theme-primary, #00C06B)'
                : 'var(--theme-bg-muted, #F5F5F7)',
            color:
              value === opt.value
                ? '#fff'
                : 'var(--theme-text-muted)',
          }}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** Toggle row: label on left, switch on right */
export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="mb-1.5 flex items-center justify-between">
      <span className="text-xs" style={{ color: 'var(--theme-text)' }}>
        {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

/** Single readout row */
export function Readout({
  label,
  value,
  unit = '',
  highlight = false,
}: {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <span
        className="text-xs"
        style={{ color: 'var(--theme-text-muted)' }}
      >
        {label}
      </span>
      <span
        className="text-xs font-medium tabular-nums"
        style={{
          color: highlight
            ? 'var(--theme-primary, #00C06B)'
            : 'var(--theme-text)',
        }}
      >
        {value}
        {unit ? ` ${unit}` : ''}
      </span>
    </div>
  );
}

/** Wavelength slider with color swatch */
export function WavelengthSlider({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--theme-text)' }}>
          波长 λ
        </span>
        <span
          className="flex items-center gap-1.5 text-xs font-medium tabular-nums"
          style={{ color: 'var(--theme-text-muted)' }}
        >
          <span
            className="inline-block h-3 w-3 rounded-full"
            style={{ background: wavelengthToColor(value) }}
          />
          {value} nm
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={380}
        max={780}
        step={10}
        disabled={disabled}
      />
    </div>
  );
}
