// Shared UI primitives — typed.
const React = (window as any).React;

interface SliderProps {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  hint?: string;
}
function Slider({ label, value, onChange, min, max, step = 1, unit = '', hint }: SliderProps) {
  return (
    <label className="slider">
      <div className="slider-head">
        <span className="slider-label">{label}</span>
        <span className="slider-value">
          <span className="num">{typeof value === 'number'
            ? (Number.isInteger(step) ? value : value.toFixed(step < 0.1 ? 2 : 1))
            : value}</span>
          <span className="unit">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e: any) => onChange(parseFloat(e.target.value))}
      />
      {hint && <div className="slider-hint">{hint}</div>}
    </label>
  );
}

interface SegOptionT<V extends string = string> { value: V; label: string; }
interface SegSelectProps<V extends string = string> {
  label?: string;
  value: V;
  onChange: (v: V) => void;
  options: SegOptionT<V>[];
}
function SegSelect<V extends string = string>({ label, value, onChange, options }: SegSelectProps<V>) {
  return (
    <div className="seg-wrap">
      {label && <div className="seg-label">{label}</div>}
      <div className="seg" role="tablist">
        {options.map((o) => (
          <button
            key={o.value}
            role="tab"
            aria-selected={value === o.value}
            className={value === o.value ? 'seg-item active' : 'seg-item'}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}
function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e: any) => onChange(e.target.checked)} />
      <span className="toggle-track"><span className="toggle-thumb" /></span>
      <span className="toggle-label">{label}</span>
    </label>
  );
}

interface ReadoutProps {
  label: string;
  value: string | number;
  unit?: string;
  hi?: boolean;
}
function Readout({ label, value, unit, hi }: ReadoutProps) {
  return (
    <div className={hi ? 'readout hi' : 'readout'}>
      <div className="readout-label">{label}</div>
      <div className="readout-value">
        <span className="num">{value}</span>
        {unit && <span className="unit">{unit}</span>}
      </div>
    </div>
  );
}

interface SectionTitleProps {
  children: any;
  aside?: string;
}
function SectionTitle({ children, aside }: SectionTitleProps) {
  return (
    <div className="section-title">
      <span>{children}</span>
      {aside && <span className="section-aside">{aside}</span>}
    </div>
  );
}

function FormulaBlock({ children }: { children: any }) {
  return <div className="formula">{children}</div>;
}

Object.assign(window, { Slider, SegSelect, Toggle, Readout, SectionTitle, FormulaBlock });

export {};
