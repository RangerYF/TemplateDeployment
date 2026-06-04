/**
 * refractionData.ts
 * Data layer for the P03 optics refraction module.
 * Exports all types, constants, material definitions, and experiment specs.
 */

// ---------------------------------------------------------------------------
// Geometry primitives
// ---------------------------------------------------------------------------

export interface Point {
  x: number;
  y: number;
}

export interface RaySegment {
  from: Point;
  to: Point;
  kind: 'incident' | 'refracted' | 'reflected' | 'exit' | 'leak' | 'virtual';
}

export interface AngleMark {
  at: Point;
  normalAngleDeg: number;
  rayAngleDeg: number;
  label: string;
  radius: number;
  side?: 'left' | 'right';
}

export interface BoundaryHit {
  point: Point;
  normal: Point;
  edge: 'top' | 'bottom' | 'left' | 'right' | 'arc';
  distance: number;
}

export interface FiberGeometry {
  center: Point;
  left: number;
  right: number;
  width: number;
  coreHalf: number;
  claddingHalf: number;
  amplitude: number;
}

export interface SolveResult {
  segments: RaySegment[];
  angleMarks: AngleMark[];
  normals: [Point, Point][];
  hitPoint?: Point;
  status: string;
  pathMode: string;
  firstEdge?: BoundaryHit['edge'] | 'interface' | null;
  lastEdge?: BoundaryHit['edge'] | 'interface' | null;
  criticalDeg?: number | null;
  incidentDeg?: number | null;
  refractedDeg?: number | null;
  reflectedDeg?: number | null;
  exitDeg?: number | null;
  shiftCm?: number | null;
  coreDeg?: number | null;
  effectiveWallDeg?: number | null;
  apparentDepthCm?: number | null;
  realDepthCm?: number | null;
  virtualImagePoint?: Point;
  objectPoint?: Point;
}

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface Material {
  n: number;
  label: string;
  nLabel: string;
}

export type MaterialKey =
  | 'air'
  | 'water'
  | 'glass'
  | 'crown'
  | 'flint'
  | 'diamond'
  | 'ice'
  | 'fiber';

export type ShapeKind =
  | 'interface'
  | 'slab'
  | 'half'
  | 'fiber'
  | 'apparent'
  | 'snellwindow';

export type RefractionExperimentId =
  | 'opt-001'
  | 'opt-002'
  | 'opt-003'
  | 'opt-004'
  | 'opt-005'
  | 'opt-006';

export type HemisphereMode = 'center' | 'plane';
export type FiberModel = 'straight' | 'bent';
export type SnellSourceShape = 'point' | 'line' | 'polygon';

export type DragTarget = 'source' | 'source2' | 'element' | 'pan' | null;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface RefractionSettings {
  experimentId: RefractionExperimentId;
  shape: ShapeKind;
  material: MaterialKey;
  wavelength: number;
  sourceAnchorX: number;
  sourceY?: number;
  sourceAngleDeg?: number;
  showSource2?: boolean;
  source2AngleDeg?: number;
  source2AnchorX?: number;
  source2Y?: number;
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
  fiberModel?: FiberModel;
  fiberBendRadiusCm: number;
  apparentMode: 'depth' | 'height';
  apparentObjectDepthCm: number;
  apparentWaterN: number;
  apparentRayAngleDeg: number;
  apparentRayOpacity?: number;
  snellSourceDepthCm: number;
  snellSourceShape?: SnellSourceShape;
  snellSourceSizeCm?: number;
  snellPolygonSides?: number;
  snellWaterN: number;
  snellIncidentAngleDeg: number;
  snellLineSampleCount?: number;
  snellViewMode: '3d' | '2d' | 'topview';
  showAngles: boolean;
  showNormals: boolean;
  showFormula: boolean;
  showColor: boolean;
  rayThick: number;
}

export interface ShapeOption {
  id: ShapeKind;
  label: string;
  desc: string;
  experimentId: RefractionExperimentId;
}

// ---------------------------------------------------------------------------
// Experiment spec types
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
  showAngles?: boolean;
  showNormals?: boolean;
  showColor?: boolean;
  showFormula?: boolean;
  lightMode?: string;
}

export interface RefractionExperimentSpec {
  id: RefractionExperimentId;
  moduleId: 'refraction';
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
// Constants
// ---------------------------------------------------------------------------

export const SOURCE2_COLOR = 'oklch(0.62 0.18 250)';

/**
 * Material reference data. Keys match MaterialKey.
 */
export const MATERIALS: Record<MaterialKey, Material> = {
  air:     { n: 1.0,   label: '真空 / 空气', nLabel: 'n = 1.000' },
  water:   { n: 1.333, label: '水',          nLabel: 'n = 1.333' },
  glass:   { n: 1.5,   label: '普通玻璃',      nLabel: 'n = 1.500' },
  crown:   { n: 1.52,  label: '冕牌玻璃',      nLabel: 'n = 1.520' },
  flint:   { n: 1.65,  label: '火石玻璃',      nLabel: 'n = 1.650' },
  diamond: { n: 2.417, label: '金刚石',        nLabel: 'n = 2.417' },
  ice:     { n: 1.309, label: '冰',          nLabel: 'n = 1.309' },
  fiber:   { n: 1.5,   label: '光纤纤芯',      nLabel: 'n = 1.500' },
} as const;

/**
 * Shape options that map each visual shape to its experiment.
 */
export const SHAPES: readonly ShapeOption[] = [
  { id: 'interface',   label: '单平面界面',     desc: '单次界面折射、反射、临界角、全反射',             experimentId: 'opt-001' },
  { id: 'slab',        label: '玻璃砖',         desc: '双界面折射、平行出射、侧移',                 experimentId: 'opt-002' },
  { id: 'half',        label: '半球介质',       desc: '平面入射 / 球心入射 / 曲面法线',             experimentId: 'opt-003' },
  { id: 'fiber',       label: '光纤',           desc: '导光、弯曲、漏光趋势',                         experimentId: 'opt-004' },
  { id: 'apparent',    label: '视深与视高',     desc: '水中看浅、水下看高、虚像位置',             experimentId: 'opt-005' },
  { id: 'snellwindow', label: '水下光源 3D', desc: '斯涅尔窗、临界角锥、全反射 (Three.js)', experimentId: 'opt-006' },
] as const;

/**
 * Base preset overrides per shape, used to initialise RefractionSettings
 * when switching between experiment shapes.
 */
export const BASE_SHAPE_PRESETS: Record<ShapeKind, Partial<RefractionSettings>> = {
  interface: {
    experimentId: 'opt-001', shape: 'interface',
    sourceAnchorX: 180, sourceY: 86, sourceAngleDeg: 56,
    elementCenterX: 500, elementCenterY: 250,
    medium1N: 1.0, medium2N: 1.5,
  },
  slab: {
    experimentId: 'opt-002', shape: 'slab',
    sourceAnchorX: 170, sourceY: 88, sourceAngleDeg: 56,
    elementCenterX: 500, elementCenterY: 248,
    slabIndex: 1.5, slabThicknessCm: 6,
  },
  half: {
    experimentId: 'opt-003', shape: 'half',
    sourceAnchorX: 180, sourceY: 92, sourceAngleDeg: 62,
    elementCenterX: 520, elementCenterY: 266,
    hemisphereIndex: 1.5, hemisphereRadiusCm: 6, hemisphereMode: 'plane',
  },
  fiber: {
    experimentId: 'opt-004', shape: 'fiber',
    sourceAnchorX: 130, sourceY: 270, sourceAngleDeg: 8,
    elementCenterX: 560, elementCenterY: 290,
    fiberCoreN: 1.5, fiberCladdingN: 1.3, fiberModel: 'straight', fiberBendRadiusCm: 14,
  },
  apparent: {
    experimentId: 'opt-005', shape: 'apparent',
    sourceAnchorX: 500, sourceY: 90, sourceAngleDeg: -90,
    elementCenterX: 500, elementCenterY: 260,
    apparentMode: 'depth' as const, apparentObjectDepthCm: 5, apparentWaterN: 1.333,
    apparentRayAngleDeg: 20, rayThick: 1.2,
  },
  snellwindow: {
    experimentId: 'opt-006', shape: 'snellwindow',
    sourceAnchorX: 500, sourceY: 90,
    elementCenterX: 500, elementCenterY: 260,
    snellSourceDepthCm: 8, snellSourceShape: 'point', snellSourceSizeCm: 4,
    snellPolygonSides: 5, snellWaterN: 1.333, snellIncidentAngleDeg: 30,
    snellViewMode: '3d' as const,
  },
} as const;

// ---------------------------------------------------------------------------
// Experiment definitions (opt-001 through opt-006)
// ---------------------------------------------------------------------------

export const REFRACTION_EXPERIMENTS: readonly RefractionExperimentSpec[] = [
  {
    id: 'opt-001',
    moduleId: 'refraction',
    title: 'OPT-001 平行界面折射',
    summary: '独立调节两侧介质折射率，演示折射定律与临界角。',
    category: 'refraction',
    formulas: [
      'n₁ sin θ₁ = n₂ sin θ₂',
      'sin θc = n₂ / n₁（当 n₁ > n₂ 时）',
    ],
    teachingPoints: [
      '折射角由两侧折射率共同决定',
      '当 n₁ > n₂ 且入射角继续增大时会出现全反射',
    ],
    params: [
      { key: 'theta1Deg', label: '入射角 θ₁', defaultValue: 30, min: 0, max: 89, step: 1, unit: '°' },
      { key: 'medium1N', label: '介质1折射率 n₁', defaultValue: 1.0, min: 1.0, max: 2.5, step: 0.01 },
      { key: 'medium2N', label: '介质2折射率 n₂', defaultValue: 1.5, min: 1.0, max: 2.5, step: 0.01 },
    ],
    defaults: {
      experimentId: 'opt-001', shape: 'interface',
      theta1Deg: 30, medium1N: 1.0, medium2N: 1.5,
      wavelength: 550, material: 'glass',
    },
    visualConfig: { showAngles: true, showNormals: true, showColor: true, lightMode: 'single' },
  },
  {
    id: 'opt-002',
    moduleId: 'refraction',
    title: 'OPT-002 矩形玻璃砖',
    summary: '展示玻璃砖双界面折射后的平行出射与侧向位移。',
    category: 'refraction',
    formulas: [
      'n₁ sin θ₁ = n₂ sin θ₂',
      'Δ = d sin(θ₁ − θ₂) / cos θ₂',
    ],
    teachingPoints: [
      '出射光线平行于入射光线',
      '厚度与折射率共同影响侧移量',
    ],
    params: [
      { key: 'theta1Deg', label: '入射角 θ', defaultValue: 45, min: 0, max: 89, step: 1, unit: '°' },
      { key: 'slabIndex', label: '玻璃折射率 n', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
      { key: 'slabThicknessCm', label: '玻璃砖厚度 d', defaultValue: 5, min: 1, max: 20, step: 0.5, unit: 'cm' },
    ],
    defaults: {
      experimentId: 'opt-002', shape: 'slab',
      theta1Deg: 45, slabIndex: 1.5, slabThicknessCm: 5,
      wavelength: 550, material: 'glass',
    },
    visualConfig: { showAngles: true, showNormals: true, showColor: true, lightMode: 'single' },
  },
  {
    id: 'opt-003',
    moduleId: 'refraction',
    title: 'OPT-003 半球形玻璃砖',
    summary: '区分球心入射和平面入射，重点演示曲面法线与临界角判定。',
    category: 'refraction',
    formulas: [
      '球心入射：曲面处入射角 = 0°',
      '平面入射：sin θc = 1 / n',
    ],
    teachingPoints: [
      '球心入射法用于判断曲面处是否折射',
      '平面入射后到曲面可继续判断全反射',
    ],
    params: [
      { key: 'theta1Deg', label: '入射角 θ', defaultValue: 30, min: 0, max: 89, step: 1, unit: '°' },
      { key: 'hemisphereIndex', label: '折射率 n', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
      { key: 'hemisphereRadiusCm', label: '半径 R', defaultValue: 5, min: 2, max: 10, step: 0.5, unit: 'cm' },
    ],
    defaults: {
      experimentId: 'opt-003', shape: 'half',
      theta1Deg: 30, hemisphereIndex: 1.5, hemisphereRadiusCm: 5,
      hemisphereMode: 'plane', wavelength: 550, material: 'glass',
    },
    visualConfig: { showAngles: true, showNormals: true, showColor: true, lightMode: 'single' },
  },
  {
    id: 'opt-004',
    moduleId: 'refraction',
    title: 'OPT-004 光导纤维模型',
    summary: '演示纤芯-包层界面连续全反射与弯曲损耗趋势。',
    category: 'refraction',
    formulas: [
      'sin θc = n₂ / n₁',
      '光在纤芯-包层界面全反射',
    ],
    teachingPoints: [
      'n₁ 必须大于 n₂',
      '弯曲半径越小越容易漏光',
    ],
    params: [
      { key: 'fiberCoreN', label: '纤芯折射率 n₁', defaultValue: 1.5, min: 1.3, max: 2.0, step: 0.01 },
      { key: 'fiberCladdingN', label: '包层折射率 n₂', defaultValue: 1.3, min: 1.0, max: 1.8, step: 0.01 },
      { key: 'fiberModel', label: '光纤模型', defaultValue: 'straight' },
      { key: 'fiberBendRadiusCm', label: '弯曲半径 R', defaultValue: 10, min: 2, max: 50, step: 1, unit: 'cm' },
    ],
    defaults: {
      experimentId: 'opt-004', shape: 'fiber',
      theta1Deg: 25, fiberCoreN: 1.5, fiberCladdingN: 1.3,
      fiberModel: 'straight', fiberBendRadiusCm: 10,
      wavelength: 550, material: 'fiber',
    },
    visualConfig: { showAngles: true, showNormals: true, showColor: true, lightMode: 'single' },
  },
  {
    id: 'opt-005',
    moduleId: 'refraction',
    title: 'OPT-005 视深与视高',
    summary: '从一侧介质观察另一侧物体，折射导致虚像位置偏移。',
    category: 'refraction',
    formulas: [
      "h' = h / n（视深，从空气看水中物体）",
      "h' = h × n（视高，从水中看空气物体）",
    ],
    teachingPoints: [
      '视深：水中物体看起来比实际位置浅',
      '视高：水上物体从水下看显得更高',
      '近轴近似下虚像位置与折射率成简单比例关系',
    ],
    params: [
      { key: 'apparentObjectDepthCm', label: '物体深度 h', defaultValue: 5, min: 1, max: 15, step: 0.5, unit: 'cm' },
      { key: 'apparentWaterN', label: '水折射率 n', defaultValue: 1.333, min: 1.1, max: 1.8, step: 0.01 },
    ],
    defaults: {
      experimentId: 'opt-005', shape: 'apparent',
      apparentMode: 'depth', apparentObjectDepthCm: 5, apparentWaterN: 1.333,
      wavelength: 550,
    },
    visualConfig: { showAngles: true, showNormals: true, showColor: true, showFormula: true },
  },
  {
    id: 'opt-006',
    moduleId: 'refraction',
    title: 'OPT-006 水下光源与斯涅尔窗',
    summary: '水下光源向各方向发射光线，临界角锥内折射出水面形成斯涅尔窗，锥外全反射。',
    category: 'refraction',
    formulas: [
      'sin θc = 1/n',
      'r = h tan θc',
    ],
    teachingPoints: [
      '临界角锥内的光线折射出水面',
      '锥外光线全部全反射回水中',
      '斯涅尔窗是鱼眼看到的整个外部世界',
    ],
    params: [
      { key: 'snellIncidentAngleDeg', label: '入射角 θ₁', defaultValue: 30, min: 5, max: 85, step: 1, unit: '°' },
      { key: 'snellWaterN', label: '水折射率 n', defaultValue: 1.333, min: 1.1, max: 1.8, step: 0.01 },
      { key: 'snellSourceDepthCm', label: '水深 h', defaultValue: 8, min: 2, max: 20, step: 0.5, unit: 'cm' },
      { key: 'snellSourceShape', label: '光源形态', defaultValue: 'point' },
      { key: 'snellSourceSizeCm', label: '光源尺寸', defaultValue: 4, min: 1, max: 12, step: 0.5, unit: 'cm' },
    ],
    defaults: {
      experimentId: 'opt-006', shape: 'snellwindow',
      snellSourceDepthCm: 8, snellSourceShape: 'point', snellSourceSizeCm: 4,
      snellPolygonSides: 5, snellWaterN: 1.333, snellIncidentAngleDeg: 30,
      snellViewMode: '3d', wavelength: 550,
    },
    visualConfig: { showColor: true, showFormula: true },
  },
] as const;

// ---------------------------------------------------------------------------
// Default settings builder
// ---------------------------------------------------------------------------

/**
 * Build a complete RefractionSettings object with every field populated.
 * Starts from the 'interface' preset and fills in all remaining defaults
 * matching the old buildP03Defaults().refraction structure.
 */
export function buildDefaultSettings(): RefractionSettings {
  return {
    // Base preset for 'interface'
    ...BASE_SHAPE_PRESETS['interface'],

    // Global display
    experimentId: 'opt-001',
    shape: 'interface',
    material: 'glass',
    wavelength: 550,
    showAngles: true,
    showNormals: true,
    showFormula: true,
    showColor: true,
    rayThick: 2,

    // Source positions
    sourceAnchorX: 400,
    sourceY: 92,
    sourceAngleDeg: 56,
    showSource2: false,
    source2AngleDeg: 35,
    source2AnchorX: 400,
    source2Y: 150,

    // Element / canvas
    elementCenterX: 400,
    elementCenterY: 190,
    canvasPanX: 0,
    canvasPanY: 0,
    canvasZoom: 1,

    // Interface
    medium1N: 1.0,
    medium2N: 1.5,

    // Slab
    slabIndex: 1.5,
    slabThicknessCm: 5,

    // Hemisphere
    hemisphereIndex: 1.5,
    hemisphereRadiusCm: 5,
    hemisphereMode: 'plane',

    // Fiber
    fiberCoreN: 1.5,
    fiberCladdingN: 1.3,
    fiberModel: 'straight',
    fiberBendRadiusCm: 10,

    // Apparent depth / height
    apparentMode: 'depth',
    apparentObjectDepthCm: 5,
    apparentWaterN: 1.333,
    apparentRayAngleDeg: 20,

    // Snell window
    snellSourceDepthCm: 8,
    snellSourceShape: 'point',
    snellSourceSizeCm: 4,
    snellPolygonSides: 5,
    snellWaterN: 1.333,
    snellIncidentAngleDeg: 30,
    snellViewMode: '3d',
  } as RefractionSettings;
}
