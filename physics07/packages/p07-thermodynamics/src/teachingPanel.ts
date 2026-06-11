import type { SceneConfig, LiveEntry } from './types';

/**
 * TeachingPanel — the 实时读数 readout list in the right sidebar.
 * P09 style: flat rows separated by a hairline border, muted label on the left,
 * neutral-coloured semibold value on the right. Static "core" values render as
 * the first rows; dynamic live values follow.
 */
export class TeachingPanel {
  private container: HTMLElement;
  private liveContainer: HTMLElement | null = null;
  private liveEntries: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setScene(config: SceneConfig): void {
    this.container.innerHTML = '';
    this.liveEntries.clear();
    const t = config.teaching;

    const list = document.createElement('div');
    list.className = 'readout-list';
    this.container.appendChild(list);
    this.liveContainer = list;

    // Static core values first (e.g. 气体 = N₂, T = …)
    for (const cv of t.coreValues) {
      const row = this.makeRow(cv.label);
      const num = row.querySelector('.readout-num') as HTMLElement;
      if (cv.staticValue) num.textContent = String(cv.staticValue);
      if (cv.dynamicKey) num.dataset.coreKey = cv.dynamicKey;
      list.appendChild(row);
    }
  }

  updateLiveValues(entries: LiveEntry[]): void {
    if (!this.liveContainer) return;

    for (const entry of entries) {
      let row = this.liveEntries.get(entry.label);
      if (!row) {
        row = this.makeRow(entry.label);
        (row.querySelector('.readout-num') as HTMLElement).dataset.liveKey = entry.label;
        this.liveContainer.appendChild(row);
        this.liveEntries.set(entry.label, row);
      }
      row.classList.toggle('highlight', Boolean(entry.highlight));
      const numEl = row.querySelector('[data-live-key]') as HTMLElement;
      if (numEl && numEl.textContent !== entry.value) {
        numEl.textContent = entry.value;
      }
    }
  }

  updateCoreValues(params: Record<string, number | string | boolean>): void {
    const coreEls = this.container.querySelectorAll('[data-core-key]');
    for (const el of coreEls) {
      const key = (el as HTMLElement).dataset.coreKey!;
      const val = params[key];
      if (val !== undefined) {
        el.textContent = String(val);
      }
    }
  }

  private makeRow(label: string): HTMLElement {
    const row = document.createElement('div');
    row.className = 'readout-row';
    const lbl = document.createElement('span');
    lbl.className = 'readout-label';
    lbl.textContent = label;
    const num = document.createElement('span');
    num.className = 'readout-num';
    row.appendChild(lbl);
    row.appendChild(num);
    return row;
  }
}
