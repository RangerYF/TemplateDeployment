import type { SceneConfig, ModelVariant, ScenePreset, DisplayToggle } from './types';

export class ModelPanel {
  private container: HTMLElement;
  private modelBtns: HTMLButtonElement[] = [];
  private toggleStates: Map<string, boolean> = new Map();

  onModelSelect?: (variant: ModelVariant) => void;
  onPresetSelect?: (preset: ScenePreset) => void;
  onToggleChange?: (key: string, value: boolean) => void;

  constructor(container: HTMLElement) {
    this.container = container;
  }

  setScene(config: SceneConfig): void {
    this.container.innerHTML = '';
    this.modelBtns = [];
    this.toggleStates.clear();

    // Model section
    if (config.models.length > 1) {
      const section = this.createSection('模型', 'MODEL');
      const grid = document.createElement('div');
      grid.className = 'model-grid';
      for (const model of config.models) {
        const btn = document.createElement('button');
        btn.className = 'model-btn';
        btn.textContent = model.label;
        btn.title = model.id;
        btn.addEventListener('click', () => {
          this.setActiveModel(model.id);
          this.onModelSelect?.(model);
        });
        grid.appendChild(btn);
        this.modelBtns.push(btn);
      }
      section.appendChild(grid);
      this.container.appendChild(section);
      if (config.models.length > 0) {
        this.setActiveModel(config.models[0].id);
      }
    }

    // Presets section
    if (config.presets.length > 0) {
      const section = this.createSection('课堂预设', 'PRESETS');
      const grid = document.createElement('div');
      grid.className = 'preset-grid';
      for (const preset of config.presets) {
        const btn = document.createElement('button');
        btn.className = 'preset-btn';
        btn.textContent = preset.label;
        btn.addEventListener('click', () => {
          this.onPresetSelect?.(preset);
        });
        grid.appendChild(btn);
      }
      section.appendChild(grid);
      this.container.appendChild(section);
    }

    // Display toggles
    if (config.displayToggles.length > 0) {
      const section = this.createSection('显示选项', 'DISPLAY');
      for (const toggle of config.displayToggles) {
        this.toggleStates.set(toggle.key, toggle.default);
        const row = document.createElement('div');
        row.className = 'toggle-row';

        const label = document.createElement('span');
        label.className = 'toggle-label';
        label.textContent = toggle.label;

        const sw = document.createElement('div');
        sw.className = 'toggle-switch' + (toggle.default ? ' on' : '');
        sw.addEventListener('click', () => {
          const current = this.toggleStates.get(toggle.key) ?? false;
          const next = !current;
          this.toggleStates.set(toggle.key, next);
          sw.classList.toggle('on', next);
          this.onToggleChange?.(toggle.key, next);
        });

        label.addEventListener('click', () => sw.click());

        row.appendChild(label);
        row.appendChild(sw);
        section.appendChild(row);
      }
      this.container.appendChild(section);
    }
  }

  setActiveModel(modelId: string): void {
    for (const btn of this.modelBtns) {
      btn.classList.toggle('active', btn.title === modelId);
    }
  }

  setActiveModelByParams(params: Record<string, number | string | boolean>, config: SceneConfig): void {
    for (const model of config.models) {
      const match = Object.entries(model.paramOverrides).every(
        ([k, v]) => params[k] === v
      );
      if (match || Object.keys(model.paramOverrides).length === 0) {
        this.setActiveModel(model.id);
        break;
      }
    }
  }

  getToggleState(key: string): boolean {
    return this.toggleStates.get(key) ?? false;
  }

  private createSection(title: string, enLabel: string): HTMLElement {
    const section = document.createElement('div');
    section.className = 'sidebar-section';
    const header = document.createElement('div');
    header.className = 'sidebar-section-title';
    header.innerHTML = `${title} <span class="en-label">${enLabel}</span>`;
    section.appendChild(header);
    return section;
  }
}
