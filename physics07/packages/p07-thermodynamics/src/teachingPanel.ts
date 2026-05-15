import type { SceneConfig, CalcStep, LiveEntry } from './types';

export class TeachingPanel {
  private container: HTMLElement;
  private liveContainer: HTMLElement | null = null;
  private calcContainer: HTMLElement | null = null;
  private liveEntries: Map<string, HTMLElement> = new Map();

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setScene(config: SceneConfig): void {
    this.container.innerHTML = '';
    this.liveEntries.clear();
    const t = config.teaching;

    // CORE values
    if (t.coreValues.length > 0) {
      const section = this.createSection('教学贴图', 'CORE');
      const values = document.createElement('div');
      values.style.display = 'flex';
      values.style.flexWrap = 'wrap';
      values.style.gap = '4px';
      for (const cv of t.coreValues) {
        const span = document.createElement('span');
        span.className = 'teach-key-value';
        span.textContent = cv.staticValue
          ? `${cv.label} = ${cv.staticValue}`
          : `${cv.label}`;
        if (cv.dynamicKey) span.dataset.coreKey = cv.dynamicKey;
        values.appendChild(span);
      }
      section.appendChild(values);
      this.container.appendChild(section);
    }

    // Insight
    if (t.insight) {
      const section = this.createSection('变化趋势', 'TREND');
      const p = document.createElement('div');
      p.className = 'teach-insight';
      p.textContent = t.insight;
      section.appendChild(p);
      this.container.appendChild(section);
    }

    // Live values
    {
      const section = this.createSection('实时数值', 'LIVE');
      const lv = document.createElement('div');
      lv.className = 'teach-live-values';
      section.appendChild(lv);
      this.liveContainer = lv;
      this.container.appendChild(section);
    }

    // Formulas
    if (t.formulas.length > 0) {
      const section = this.createSection('公式', 'FORMULAS');
      for (const f of t.formulas) {
        const div = document.createElement('div');
        div.className = 'teach-formula';
        div.textContent = f;
        section.appendChild(div);
      }
      this.container.appendChild(section);
    }

    // Summary
    if (t.summary) {
      const section = this.createSection('实验摘要', 'EXPERIMENT');
      const p = document.createElement('div');
      p.className = 'teach-summary';
      p.textContent = t.summary;
      section.appendChild(p);
      this.container.appendChild(section);
    }

    // Teaching bullets
    if (t.bullets.length > 0) {
      const section = this.createSection('教学要点', 'TEACH');
      for (const b of t.bullets) {
        const div = document.createElement('div');
        div.className = 'teach-bullet';
        div.textContent = b;
        section.appendChild(div);
      }
      this.container.appendChild(section);
    }

    // Calc steps (populated later by updateCalcSteps)
    {
      const section = this.createSection('计算过程', 'CALC');
      const cc = document.createElement('div');
      section.appendChild(cc);
      this.calcContainer = cc;
      section.style.display = 'none';
      section.dataset.role = 'calc';
      this.container.appendChild(section);
    }
  }

  updateLiveValues(entries: LiveEntry[]): void {
    if (!this.liveContainer) return;

    for (const entry of entries) {
      let row = this.liveEntries.get(entry.label);
      if (!row) {
        row = document.createElement('div');
        row.className = 'teach-live-row';
        const lbl = document.createElement('span');
        lbl.className = 'teach-live-label';
        lbl.textContent = entry.label;
        const num = document.createElement('span');
        num.className = 'teach-live-num';
        num.dataset.liveKey = entry.label;
        row.appendChild(lbl);
        row.appendChild(num);
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

  updateCalcSteps(steps: CalcStep[]): void {
    if (!this.calcContainer) return;
    const section = this.calcContainer.parentElement!;
    if (steps.length === 0) {
      section.style.display = 'none';
      return;
    }
    section.style.display = '';
    let html = '';
    for (const step of steps) {
      if (step.text === '') {
        html += '<div class="calc-step spacer"></div>';
      } else {
        const cls = step.highlight ? 'calc-step highlight' : 'calc-step';
        html += `<div class="${cls}">${escapeHtml(step.text)}</div>`;
      }
    }
    this.calcContainer.innerHTML = html;
  }

  updateCoreValues(params: Record<string, number | string | boolean>): void {
    const coreEls = this.container.querySelectorAll('[data-core-key]');
    for (const el of coreEls) {
      const key = (el as HTMLElement).dataset.coreKey!;
      const val = params[key];
      if (val !== undefined) {
        const label = el.textContent?.split('=')[0]?.trim() || key;
        el.textContent = `${label} = ${val}`;
      }
    }
  }

  private createSection(title: string, enLabel: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'teach-section';
    const header = document.createElement('div');
    header.className = 'teach-section-header';
    header.innerHTML = `${title} <span class="en-label">${enLabel}</span>`;
    section.appendChild(header);
    return section;
  }
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
