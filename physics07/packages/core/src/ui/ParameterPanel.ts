export interface ParamDef {
  key: string;
  label: string;
  unit?: string;
  type?: 'range' | 'select' | 'checkbox';
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  options?: string[];
  /** Only show this param when 'scene' value is in this list. If omitted, always shown. */
  scenes?: string[];
}

export type ParamValues = Record<string, number | string | boolean>;

export class ParameterPanel {
  private container: HTMLElement;
  private values: ParamValues = {};
  private defs: ParamDef[];
  private rows: Map<string, HTMLElement> = new Map();
  private _onChange?: (values: ParamValues) => void;

  constructor(parent: HTMLElement, defs: ParamDef[]) {
    this.defs = defs;
    this.container = document.createElement('div');
    this.container.className = 'param-panel';
    parent.appendChild(this.container);

    for (const def of defs) {
      this.values[def.key] = def.default;
      this.createControl(def);
    }

    // Initial visibility
    this.updateVisibility();
  }

  setOnChange(cb: (values: ParamValues) => void): void {
    this._onChange = cb;
  }

  getValues(): ParamValues {
    return { ...this.values };
  }

  getValue<T extends number | string | boolean = number>(key: string): T {
    return this.values[key] as T;
  }

  setValue(key: string, value: number | string | boolean): void {
    this.values[key] = value;
    const input = this.container.querySelector(`[data-key="${key}"]`) as HTMLInputElement;
    if (input) {
      if (input.type === 'checkbox') {
        input.checked = value as boolean;
      } else {
        input.value = String(value);
        if (input.type === 'range') {
          updateSliderFill(input);
          const num = this.container.querySelector(`[data-num="${key}"]`) as HTMLInputElement | null;
          if (num) num.value = String(value);
        }
      }
      const display = this.container.querySelector(`[data-display="${key}"]`) as HTMLElement | null;
      if (display) {
        const n = typeof value === 'number' ? value : parseFloat(String(value));
        display.textContent = Number.isFinite(n) ? n.toFixed(Math.abs(n) >= 100 || Number.isInteger(n) ? 0 : 1) : String(value);
      }
    }
  }

  /** Restore every parameter to its declared default (does not fire onChange). */
  reset(): void {
    for (const def of this.defs) {
      this.values[def.key] = def.default;
      this.setValue(def.key, def.default);
    }
  }

  /** Update which parameters are visible based on current scene selection */
  private updateVisibility(): void {
    const scene = this.values['scene'] as string | undefined;
    for (const def of this.defs) {
      const row = this.rows.get(def.key);
      if (!row) continue;
      if (def.scenes && scene) {
        row.style.display = def.scenes.includes(scene) ? '' : 'none';
      } else {
        row.style.display = '';
      }
    }
  }

  private createControl(def: ParamDef): void {
    const row = document.createElement('div');
    row.className = 'param-row';
    row.dataset.paramKey = def.key;
    this.rows.set(def.key, row);

    const label = document.createElement('label');
    label.className = 'param-label';
    label.textContent = def.label;
    if (def.unit) {
      const unitSpan = document.createElement('span');
      unitSpan.className = 'param-unit';
      unitSpan.textContent = ` (${def.unit})`;
      label.appendChild(unitSpan);
    }

    const type = def.type ?? 'range';

    if (type === 'range') {
      const decimals = def.step && def.step >= 1 ? 0 : 1;
      const fmt = (v: number) => v.toFixed(decimals);

      // Top row: label (left) + formatted value (right) — P09 style
      const head = document.createElement('div');
      head.className = 'param-row-head';
      const display = document.createElement('span');
      display.className = 'param-value';
      display.dataset.display = def.key;
      display.textContent = fmt(Number(def.default));
      head.appendChild(label);
      head.appendChild(display);

      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'param-slider';
      input.dataset.key = def.key;
      input.min = String(def.min ?? 0);
      input.max = String(def.max ?? 100);
      input.step = String(def.step ?? 0.1);
      input.value = String(def.default);

      // Editable number input below the slider — P09 style
      const num = document.createElement('input');
      num.type = 'number';
      num.className = 'param-number';
      num.dataset.num = def.key;
      num.min = input.min;
      num.max = input.max;
      num.step = input.step;
      num.value = fmt(Number(def.default));

      const apply = (raw: number, fromNumber: boolean) => {
        const lo = parseFloat(input.min);
        const hi = parseFloat(input.max);
        const val = Math.min(hi, Math.max(lo, raw));
        this.values[def.key] = val;
        input.value = String(val);
        display.textContent = fmt(val);
        if (!fromNumber) num.value = fmt(val);
        updateSliderFill(input);
        this._onChange?.(this.values);
      };

      updateSliderFill(input);
      input.addEventListener('input', () => apply(parseFloat(input.value), false));
      const commitNum = () => {
        const parsed = parseFloat(num.value);
        if (Number.isFinite(parsed)) apply(parsed, true);
        num.value = fmt(this.values[def.key] as number);
      };
      num.addEventListener('blur', commitNum);
      num.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') commitNum(); });

      row.appendChild(head);
      row.appendChild(input);
      row.appendChild(num);
    } else if (type === 'select') {
      row.appendChild(label);
      const select = document.createElement('select');
      select.className = 'param-select';
      select.dataset.key = def.key;
      for (const opt of def.options ?? []) {
        const option = document.createElement('option');
        option.value = opt;
        option.textContent = opt;
        if (opt === def.default) option.selected = true;
        select.appendChild(option);
      }
      select.addEventListener('change', () => {
        this.values[def.key] = select.value;
        this.updateVisibility();
        this._onChange?.(this.values);
      });
      row.appendChild(select);
    } else if (type === 'checkbox') {
      row.appendChild(label);
      const checkWrapper = document.createElement('label');
      checkWrapper.className = 'param-check-wrapper';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.className = 'param-checkbox';
      input.dataset.key = def.key;
      input.checked = def.default as boolean;
      input.addEventListener('change', () => {
        this.values[def.key] = input.checked;
        this._onChange?.(this.values);
      });
      checkWrapper.appendChild(input);
      row.appendChild(checkWrapper);
    }

    this.container.appendChild(row);
  }
}

export function defineParams(defs: ParamDef[]): ParamDef[] {
  return defs;
}

/** Paint the filled (green) portion of a range slider up to its current value (P09 style). */
function updateSliderFill(input: HTMLInputElement): void {
  const min = parseFloat(input.min);
  const max = parseFloat(input.max);
  const val = parseFloat(input.value);
  const pct = max > min ? ((val - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--fill', `${pct}%`);
}
