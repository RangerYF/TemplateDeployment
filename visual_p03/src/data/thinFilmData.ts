/**
 * thinFilmData.ts
 * Data layer for the P03 optics thin-film interference module.
 * Exports types, experiment specs, and default settings builder.
 */

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type FilmKind = 'newton' | 'wedge' | 'soap';
export type WedgeProfile = 'linear' | 'convex' | 'concave';
export type ThinFilmExperimentId = 'opt-041' | 'opt-042' | 'opt-043';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ThinFilmSettings {
  experimentId: ThinFilmExperimentId;
  filmType: FilmKind;
  /** Wavelength in nm (used for newton and wedge; soap uses white-light RGB). */
  wavelength: number;
  /** Soap bubble thickness in nm. */
  thickness: number;
  /** Film refractive index. */
  filmN: number;
  /** Newton's rings: lens radius of curvature in metres. */
  lensR: number;
  /** Wedge film: wedge angle in arc-minutes. */
  wedgeAngle: number;
  /** Wedge film: thickness profile shape. */
  wedgeProfile: WedgeProfile;
  /** Newton's rings: normalised sample-point ratio (0 to 0.92). */
  newtonSampleRatio: number;
  /** Show intensity / relation curve. */
  showIntensity: boolean;
  /** Show formula derivation. */
  showFormula: boolean;
}

// ---------------------------------------------------------------------------
// Experiment param spec (mirrors refraction / lens pattern)
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
  showIntensity?: boolean;
  showFormula?: boolean;
}

export interface ThinFilmExperimentSpec {
  id: ThinFilmExperimentId;
  moduleId: 'thinfilm';
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
// Experiment definitions (opt-041, opt-042, opt-043)
// ---------------------------------------------------------------------------

export const THINFILM_EXPERIMENTS: readonly ThinFilmExperimentSpec[] = [
  {
    id: 'opt-041',
    moduleId: 'thinfilm',
    title: 'OPT-041 肥皂泡干涉',
    summary: '膜厚不均匀时不同位置满足不同级次干涉条件，形成彩色条纹。',
    category: 'thin_film',
    formulas: ['2nd cos θ = kλ（明纹，反射光）'],
    teachingPoints: [
      '白光下不同波长满足条件的位置不同',
      '膜厚沿高度变化时会形成彩色条纹带',
    ],
    params: [
      { key: 'thickness', label: '薄膜厚度 t', defaultValue: 600, min: 200, max: 1800, step: 20, unit: 'nm' },
      { key: 'filmN', label: '薄膜折射率 n', defaultValue: 1.33, min: 1.0, max: 1.6, step: 0.01 },
    ],
    defaults: {
      experimentId: 'opt-041',
      filmType: 'soap',
      thickness: 600,
      filmN: 1.33,
      wavelength: 550,
      wedgeAngle: 1.0,
      wedgeProfile: 'linear',
      lensR: 1.0,
      newtonSampleRatio: 0.28,
    },
    visualConfig: { showIntensity: true, showFormula: true },
  },
  {
    id: 'opt-042',
    moduleId: 'thinfilm',
    title: 'OPT-042 楔形薄膜干涉',
    summary: '等厚干涉形成近似平行等间距条纹。',
    category: 'thin_film',
    formulas: ['l = λ / (2n sin α)'],
    teachingPoints: [
      '楔角越小条纹越稀疏',
      '波长越长条纹间距越大',
    ],
    params: [
      { key: 'wedgeAngle', label: '楔角 α', defaultValue: 1.0, min: 0.1, max: 10, step: 0.1, unit: "'" },
      { key: 'filmN', label: '薄膜折射率 n', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
      { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
    ],
    defaults: {
      experimentId: 'opt-042',
      filmType: 'wedge',
      wedgeAngle: 1.0,
      wedgeProfile: 'linear',
      filmN: 1.5,
      wavelength: 550,
      thickness: 600,
      lensR: 1.0,
      newtonSampleRatio: 0.28,
    },
    visualConfig: { showIntensity: true, showFormula: true },
  },
  {
    id: 'opt-043',
    moduleId: 'thinfilm',
    title: 'OPT-043 牛顿环',
    summary: '平凸透镜与平板间空气薄层干涉形成同心圆环。',
    category: 'thin_film',
    formulas: ['r_k = sqrt((k - 1/2)Rλ)', 'r_k = sqrt(kRλ)'],
    teachingPoints: [
      '中心为暗点',
      '图样应表现为同心圆环',
    ],
    params: [
      { key: 'lensR', label: '曲率半径 R', defaultValue: 1.0, min: 0.1, max: 10, step: 0.1, unit: 'm' },
      { key: 'wavelength', label: '波长 λ', defaultValue: 550, min: 380, max: 780, step: 10, unit: 'nm' },
    ],
    defaults: {
      experimentId: 'opt-043',
      filmType: 'newton',
      lensR: 1.0,
      filmN: 1.33,
      wavelength: 550,
      thickness: 600,
      wedgeAngle: 1.0,
      wedgeProfile: 'linear',
      newtonSampleRatio: 0.28,
    },
    visualConfig: { showIntensity: true, showFormula: true },
  },
] as const;

// ---------------------------------------------------------------------------
// Film-type descriptors (for overlay / selector)
// ---------------------------------------------------------------------------

export interface FilmTypeOption {
  value: FilmKind;
  experimentId: ThinFilmExperimentId;
  label: string;
  desc: string;
}

export const FILM_TYPES: FilmTypeOption[] = [
  { value: 'newton', experimentId: 'opt-043', label: '牛顿环', desc: '同心圆等厚干涉' },
  { value: 'wedge', experimentId: 'opt-042', label: '楔形薄膜', desc: '平行等厚条纹' },
  { value: 'soap', experimentId: 'opt-041', label: '肥皂泡', desc: '白光彩色条纹' },
];

// ---------------------------------------------------------------------------
// Default settings builder
// ---------------------------------------------------------------------------

export function buildDefaultThinFilmSettings(): ThinFilmSettings {
  return {
    experimentId: 'opt-043',
    filmType: 'newton',
    wavelength: 550,
    thickness: 600,
    filmN: 1.33,
    lensR: 1.0,
    wedgeAngle: 1.0,
    wedgeProfile: 'linear',
    newtonSampleRatio: 0.28,
    showIntensity: true,
    showFormula: true,
  };
}
