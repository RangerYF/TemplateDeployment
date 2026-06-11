import type { SceneConfig, CalcStep } from './types';

/**
 * TeachingModal — P09-style centred modal holding the STATIC teaching content
 * (insight / formulas / summary / teaching points). Opened by the 📖 TopBar
 * button; closes on backdrop click or Escape.
 */
export class TeachingModal {
  private backdrop: HTMLDivElement;
  private titleEl: HTMLElement;
  private bodyEl: HTMLElement;
  private calcEl: HTMLElement;
  private open = false;
  private lastCalc: CalcStep[] = [];

  constructor() {
    this.backdrop = document.createElement('div');
    this.backdrop.className = 'teach-modal-backdrop';
    this.backdrop.style.display = 'none';

    const modal = document.createElement('div');
    modal.className = 'teach-modal';

    const header = document.createElement('div');
    header.className = 'teach-modal-header';
    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'teach-modal-title';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'teach-modal-close';
    closeBtn.textContent = '×';
    closeBtn.addEventListener('click', () => this.close());
    header.appendChild(this.titleEl);
    header.appendChild(closeBtn);

    this.bodyEl = document.createElement('div');
    this.bodyEl.className = 'teach-modal-body';
    this.calcEl = document.createElement('div'); // (re)assigned in setScene

    modal.appendChild(header);
    modal.appendChild(this.bodyEl);
    this.backdrop.appendChild(modal);
    document.body.appendChild(this.backdrop);

    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.open) this.close();
    });
  }

  setScene(config: SceneConfig): void {
    this.titleEl.textContent = `${config.tabLabel} · 教学要点`;
    const t = config.teaching;
    this.bodyEl.innerHTML = '';

    if (t.insight) {
      this.bodyEl.appendChild(section('核心结论', `<div class="tm-insight">${esc(t.insight)}</div>`));
    }
    if (t.formulas?.length) {
      const inner = t.formulas.map((f) => `<div class="tm-formula">${esc(f)}</div>`).join('');
      this.bodyEl.appendChild(section('核心公式', inner));
    }
    if (t.bullets?.length) {
      const inner = `<ul class="tm-bullets">${t.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>`;
      this.bodyEl.appendChild(section('教学要点', inner));
    }
    if (t.summary) {
      this.bodyEl.appendChild(section('实验摘要', `<div class="tm-summary">${esc(t.summary)}</div>`));
    }
    // calc-steps section (filled dynamically by updateCalcSteps)
    const calcSec = section('计算过程', '<div class="tm-calc"></div>');
    this.bodyEl.appendChild(calcSec);
    this.calcEl = calcSec.querySelector('.tm-calc') as HTMLElement;
    this.renderCalc();
  }

  updateCalcSteps(steps: CalcStep[]): void {
    this.lastCalc = steps;
    if (this.open) this.renderCalc();
  }

  private renderCalc(): void {
    if (!this.calcEl) return;
    const sec = this.calcEl.parentElement as HTMLElement | null;
    if (this.lastCalc.length === 0) {
      if (sec) sec.style.display = 'none';
      return;
    }
    if (sec) sec.style.display = '';
    this.calcEl.innerHTML = this.lastCalc
      .map((s) => (s.text === ''
        ? '<div class="tm-calc-spacer"></div>'
        : `<div class="tm-calc-step${s.highlight ? ' hi' : ''}">${esc(s.text)}</div>`))
      .join('');
  }

  show(): void {
    this.backdrop.style.display = 'flex';
    this.open = true;
    this.renderCalc();
  }

  close(): void {
    this.backdrop.style.display = 'none';
    this.open = false;
  }

  toggle(): void {
    if (this.open) this.close();
    else this.show();
  }
}

function section(title: string, innerHTML: string): HTMLElement {
  const s = document.createElement('div');
  s.className = 'tm-section';
  s.innerHTML = `<div class="tm-section-title">${esc(title)}</div>${innerHTML}`;
  return s;
}

function esc(s: string): string {
  return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] || c));
}
