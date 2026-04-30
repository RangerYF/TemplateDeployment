// Shared types for P-03 Optics Lab — ambient declarations (no module exports).

type ThemeName = 'light' | 'dark' | 'blueprint';
type ThemeTokens = Record<string, string>;
type ModuleId = 'refraction' | 'lens' | 'doubleslit' | 'diffraction' | 'thinfilm';

interface Point { x: number; y: number; }

type ShapeKind = 'interface' | 'slab' | 'half' | 'fiber' | 'apparent' | 'snellwindow';
type MaterialKey = 'air' | 'water' | 'glass' | 'crown' | 'flint' | 'diamond' | 'ice' | 'fiber';
type RefractionExperimentId = 'opt-001' | 'opt-002' | 'opt-003' | 'opt-004' | 'opt-005' | 'opt-006';
type HemisphereMode = 'center' | 'plane';

interface Material { n: number; label: string; nLabel: string; }

interface RefractionSettings {
  experimentId: RefractionExperimentId;
  shape: ShapeKind;
  material: MaterialKey;
  wavelength: number;
  sourceAnchorX: number;
  sourceY?: number;
  sourceAngleDeg?: number;
  elementCenterX: number;
  elementCenterY?: number;
  canvasPanX?: number;
  canvasPanY?: number;
  canvasZoom?: number;
  medium1N: number;
  medium2N: number;
  slabIndex: number;
  slabThicknessCm: number;
  hemisphereIndex: number;
  hemisphereRadiusCm: number;
  hemisphereMode: HemisphereMode;
  fiberCoreN: number;
  fiberCladdingN: number;
  fiberBendRadiusCm: number;
  apparentMode: 'depth' | 'height';
  apparentObjectDepthCm: number;
  apparentWaterN: number;
  apparentRayAngleDeg: number;
  snellSourceDepthCm: number;
  snellWaterN: number;
  snellIncidentAngleDeg: number;
  snellViewMode: '3d' | '2d' | 'topview';
  showAngles: boolean;
  showNormals: boolean;
  showFormula: boolean;
  showColor: boolean;
  rayThick: number;
}

type LensKind = 'convex' | 'concave';
type LensExperimentId = 'opt-011' | 'opt-012';
type LensSourceType = 'object' | 'point' | 'parallel';

interface LensSettings {
  experimentId: LensExperimentId;
  lensType: LensKind;
  sourceType: LensSourceType;
  focalLength: number;
  objectDistance: number;
  objectHeight: number;
  lensCenterX: number;
  objectX: number;
  screenX: number;
  canvasPanX?: number;
  canvasPanY?: number;
  canvasZoom?: number;
  showScreen: boolean;
  showRays: boolean;
  showFormula: boolean;
  rayThick: number;
}

interface DoubleSlitSettings {
  experimentId: 'opt-021';
  slitSpacing: number;
  slitWidth: number;
  screenDistance: number;
  wavelength: number;
  sourceX: number;
  slitX: number;
  screenX: number;
  whiteLight: boolean;
  showColor: boolean;
  showIntensity: boolean;
  showFormula: boolean;
}

type ApertureKind = 'slit' | 'circle';
type DiffractionExperimentId = 'opt-031' | 'opt-032';

interface DiffractionSettings {
  experimentId: DiffractionExperimentId;
  aperture: ApertureKind;
  slitWidth: number;
  diameter: number;
  wavelength: number;
  screenDistance: number;
  sourceX: number;
  apertureX: number;
  screenX: number;
  showColor: boolean;
  showIntensity: boolean;
  showFormula: boolean;
  compareMode?: boolean;
}

type FilmKind = 'newton' | 'wedge' | 'soap';
type ThinFilmExperimentId = 'opt-041' | 'opt-042' | 'opt-043';

interface ThinFilmSettings {
  experimentId: ThinFilmExperimentId;
  filmType: FilmKind;
  wavelength: number;
  thickness: number;
  filmN: number;
  lensR: number;
  wedgeAngle: number;
  showIntensity: boolean;
  showFormula: boolean;
}

interface SegOption<V extends string = string> { value: V; label: string; }

interface ModuleDef {
  id: ModuleId;
  num: string;
  short: string;
  full: string;
  desc: string;
}

interface ExperimentParamSpec {
  key: string;
  label: string;
  defaultValue: string | number | boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  hint?: string;
}

interface ExperimentSpec<Id extends string = string> {
  id: Id;
  moduleId: ModuleId;
  title: string;
  summary: string;
  category: string;
  formulas: string[];
  teachingPoints: string[];
  params: ExperimentParamSpec[];
  defaults: Record<string, string | number | boolean>;
  visualConfig?: Record<string, string | number | boolean>;
}

export {};
