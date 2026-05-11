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
      }
      const display = this.container.querySelector(`[data-display="${key}"]`);
      if (display) display.textContent = String(value);
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
    row.appendChild(label);

    const type = def.type ?? 'range';

    if (type === 'range') {
      const wrapper = document.createElement('div');
      wrapper.className = 'param-range-wrapper';

      const input = document.createElement('input');
      input.type = 'range';
      input.className = 'param-slider';
      input.dataset.key = def.key;
      input.min = String(def.min ?? 0);
      input.max = String(def.max ?? 100);
      input.step = String(def.step ?? 0.1);
      input.value = String(def.default);

      const display = document.createElement('span');
      display.className = 'param-value';
      display.dataset.display = def.key;
      display.textContent = String(def.default);

      input.addEventListener('input', () => {
        const val = parseFloat(input.value);
        this.values[def.key] = val;
        display.textContent = val.toFixed(def.step && def.step >= 1 ? 0 : 1);
        this._onChange?.(this.values);
      });

      wrapper.appendChild(input);
      wrapper.appendChild(display);
      row.appendChild(wrapper);
    } else if (type === 'select') {
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
