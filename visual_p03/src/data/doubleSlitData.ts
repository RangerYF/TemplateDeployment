/**
 * doubleSlitData.ts
 * Data layer for the P03 optics double-slit interference module.
 * Exports types, experiment spec, and default settings builder.
 */

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface DoubleSlitSettings {
  experimentId: 'opt-021';
  /** Slit spacing d (μm) */
  slitSpacing: number;
  /** Slit width a (μm) */
  slitWidth: number;
  /** Screen distance L (m) */
  screenDistance: number;
  /** Wavelength λ (nm) */
  wavelength: number;
  /** SVG layout: light-source x position */
  sourceX: number;
  /** SVG layout: double-slit x position */
  slitX: number;
  /** SVG layout: screen x position */
  screenX: number;
  /** White-light composite mode */
  whiteLight: boolean;
  /** Show colour in fringe pattern */
  showColor: boolean;
  /** Show intensity plot */
  showIntensity: boolean;
  /** Show formula derivation */
  showFormula: boolean;
}

// ---------------------------------------------------------------------------
// Experiment param spec (mirrors the refraction module pattern)
// ---------------------------------------------------------------------------

export interface ExperimentParamSpec {
  key: string;
  label: string;
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface ExperimentVisualConfig {
  showColor?: boolean;
  showIntensity?: boolean;
  showFormula?: boolean;
}

export interface DoubleSlitExperimentSpec {
  id: 'opt-021';
  moduleId: 'doubleslit';
  title: string;
  summary: string;
  category: string;
  formulas: string[];
  teachingPoints: string[];
  params: ExperimentParamSpec[];
  defaults: Record<string, string | number | boolean>;
  visualConfig: ExperimentVisualConfig;
}

// ---------------------------------------------------------------------------
// Experiment definitions
// ---------------------------------------------------------------------------

export const DOUBLESLIT_EXPERIMENTS: readonly DoubleSlitExperimentSpec[] = [
  {
    id: 'opt-021',
    moduleId: 'doubleslit',
    title: 'OPT-021 杨氏双缝干涉',
    summary: '展示双缝条纹随缝间距、波长和屏距变化的规律。',
    category: 'interference',
    formulas: ['Δy = λL / d', 'd sin θ = kλ', 'd sin θ = (k + 1/2)λ'],
    teachingPoints: [
      'd 增大时条纹变密',
      'λ 或 L 增大时条纹变宽',
      '白光干涉中央为白色',
    ],
    params: [
      { key: 'slitSpacing', label: '缝间距 d', defaultValue: 200, min: 50, max: 1000, step: 10, unit: 'μm' },
      { key: 'slitWidth', label: '缝宽 a', defaultValue: 20, min: 5, max: 80, step: 1, unit: 'μm' },
      { key: 'screenDistance', label: '屏距 L', defaultValue: 1.0, min: 0.1, max: 5.0, step: 0.1, unit: 'm' },
      { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
    ],
    defaults: {
      experimentId: 'opt-021',
      slitSpacing: 200,
      slitWidth: 20,
      screenDistance: 1.0,
      wavelength: 550,
      whiteLight: false,
    },
    visualConfig: {
      showColor: true,
      showIntensity: true,
      showFormula: true,
    },
  },
] as const;

// ---------------------------------------------------------------------------
// Default settings builder
// ---------------------------------------------------------------------------

export function buildDefaultDoubleSlitSettings(): DoubleSlitSettings {
  return {
    experimentId: 'opt-021',
    slitSpacing: 200,
    slitWidth: 20,
    screenDistance: 1.0,
    wavelength: 550,
    sourceX: 110,
    slitX: 280,
    screenX: 390,
    whiteLight: false,
    showColor: true,
    showIntensity: true,
    showFormula: true,
  };
}
