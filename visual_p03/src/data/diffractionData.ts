/**
 * diffractionData.ts
 * Data layer for the P03 optics diffraction module.
 * Exports types, experiment specs, and default settings builder.
 */

// ---------------------------------------------------------------------------
// Aperture type
// ---------------------------------------------------------------------------

export type ApertureType = 'slit' | 'circle' | 'disk';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type DiffractionExperimentId = 'opt-031' | 'opt-032';

export interface DiffractionSettings {
  experimentId: DiffractionExperimentId;
  /** Aperture type: single slit, circular aperture, or disk */
  aperture: ApertureType;
  /** Slit width a (μm) — used when aperture === 'slit' */
  slitWidth: number;
  /** Aperture / disk diameter D (μm) — used when aperture === 'circle' | 'disk' */
  diameter: number;
  /** Wavelength λ (nm) */
  wavelength: number;
  /** Screen distance L (m) */
  screenDistance: number;
  /** SVG layout: light-source x position */
  sourceX: number;
  /** SVG layout: aperture x position */
  apertureX: number;
  /** SVG layout: screen x position */
  screenX: number;
  /** Show colour in pattern */
  showColor: boolean;
  /** Show intensity plot */
  showIntensity: boolean;
  /** Show formula derivation */
  showFormula: boolean;
  /** Compare mode: show 3 wavelengths side-by-side */
  compareMode: boolean;
}

// ---------------------------------------------------------------------------
// Experiment param spec (mirrors the doubleSlitData pattern)
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

export interface DiffractionExperimentSpec {
  id: DiffractionExperimentId;
  moduleId: 'diffraction';
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

export const DIFFRACTION_EXPERIMENTS: readonly DiffractionExperimentSpec[] = [
  {
    id: 'opt-031',
    moduleId: 'diffraction',
    title: 'OPT-031 单缝衍射',
    summary: '演示缝宽与波长对中央明纹宽度的影响。',
    category: 'diffraction',
    formulas: ['2θ = 2λ / a', 'a sin θ = kλ'],
    teachingPoints: [
      '中央明纹最宽最亮',
      '缝宽减小 -> 条纹变宽',
      '波长增大 -> 条纹变宽',
    ],
    params: [
      { key: 'slitWidth', label: '缝宽 a', defaultValue: 100, min: 10, max: 500, step: 5, unit: 'μm' },
      { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
      { key: 'screenDistance', label: '屏距 L', defaultValue: 1.5, min: 0.5, max: 3.0, step: 0.05, unit: 'm' },
    ],
    defaults: {
      experimentId: 'opt-031',
      aperture: 'slit',
      slitWidth: 100,
      diameter: 200,
      wavelength: 550,
      screenDistance: 1.5,
    },
    visualConfig: {
      showColor: true,
      showIntensity: true,
      showFormula: true,
    },
  },
  {
    id: 'opt-032',
    moduleId: 'diffraction',
    title: 'OPT-032 圆孔衍射',
    summary: '演示圆孔衍射的艾里斑大小随孔径与波长变化的规律。',
    category: 'diffraction',
    formulas: ['θ = 1.22 λ / D'],
    teachingPoints: [
      '孔径越小艾里斑越大',
      '波长越长艾里斑越大',
    ],
    params: [
      { key: 'diameter', label: '孔径 D', defaultValue: 200, min: 20, max: 1000, step: 10, unit: 'μm' },
      { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
      { key: 'screenDistance', label: '屏距 L', defaultValue: 1.5, min: 0.5, max: 3.0, step: 0.05, unit: 'm' },
    ],
    defaults: {
      experimentId: 'opt-032',
      aperture: 'circle',
      slitWidth: 100,
      diameter: 200,
      wavelength: 550,
      screenDistance: 1.5,
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

export function buildDefaultDiffractionSettings(): DiffractionSettings {
  return {
    experimentId: 'opt-031',
    aperture: 'slit',
    slitWidth: 100,
    diameter: 200,
    wavelength: 550,
    screenDistance: 1.5,
    sourceX: 110,
    apertureX: 280,
    screenX: 445,
    showColor: true,
    showIntensity: true,
    showFormula: true,
    compareMode: false,
  };
}
