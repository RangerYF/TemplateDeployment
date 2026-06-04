/**
 * lensData.ts
 * Data layer for the P03 optics lens imaging module.
 * Exports all types, constants, experiment specs, and default builder.
 */

import type { Point } from '@/data/refractionData';

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export type LensKind = 'convex' | 'concave';
export type LensSourceType = 'object' | 'point' | 'parallel';
export type LensDragTarget = 'source' | 'lens' | 'screen' | 'pan' | null;

export type LensExperimentId = 'opt-011' | 'opt-012';

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface LensSettings {
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

// ---------------------------------------------------------------------------
// Lens type descriptors
// ---------------------------------------------------------------------------

export interface LensTypeOption {
  value: LensKind;
  label: string;
  desc: string;
}

export const LENS_TYPES: LensTypeOption[] = [
  { value: 'convex', label: '凸透镜', desc: '会聚，覆盖标准课堂五种典型物距条件' },
  { value: 'concave', label: '凹透镜', desc: '发散，始终成正立缩小虚像' },
];

export interface SourceTypeOption {
  value: LensSourceType;
  label: string;
}

export const SOURCE_TYPES: SourceTypeOption[] = [
  { value: 'object', label: '物体光源' },
  { value: 'parallel', label: '平行光' },
  { value: 'point', label: '点光源' },
];

// ---------------------------------------------------------------------------
// Stage constants
// ---------------------------------------------------------------------------

export const LENS_STAGE = {
  width: 1240,
  height: 620,
  axisY: 320,
  axisLeft: 56,
  axisRight: 1180,
  sourceMinX: 96,
  lensMinX: 320,
  lensMaxX: 920,
  screenGapMin: 55,
  screenMaxX: 1140,
  rayEndX: 1160,
  parallelSourceX: 88,
  parallelSourceWidth: 56,
  focalMin: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Experiment spec types (matching refraction pattern)
// ---------------------------------------------------------------------------

export interface LensExperimentParamSpec {
  key: string;
  label: string;
  defaultValue: number | string;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface LensExperimentSpec {
  id: LensExperimentId;
  moduleId: 'lens';
  title: string;
  summary: string;
  category: string;
  formulas: string[];
  teachingPoints: string[];
  params: LensExperimentParamSpec[];
  defaults: Record<string, string | number | boolean>;
  visualConfig: Record<string, boolean | string>;
}

// ---------------------------------------------------------------------------
// Experiment definitions (opt-011, opt-012)
// ---------------------------------------------------------------------------

export const LENS_EXPERIMENTS: readonly LensExperimentSpec[] = [
  {
    id: 'opt-011',
    moduleId: 'lens',
    title: 'OPT-011 凸透镜成像',
    summary: '演示物距变化下的像距、正倒、大小与虚实变化。',
    category: 'lens',
    formulas: ['1 / u + 1 / v = 1 / f'],
    teachingPoints: [
      'u > 2f：倒立缩小实像',
      'f < u < 2f：倒立放大实像',
      'u = f：不成像，出射光平行',
    ],
    params: [
      { key: 'focalLength', label: '焦距 f', defaultValue: 80, min: 20, max: 200, step: 5, unit: 'cm' },
      { key: 'objectDistance', label: '物距 u', defaultValue: 120, min: 10, max: 400, step: 5, unit: 'cm' },
    ],
    defaults: { experimentId: 'opt-011', lensType: 'convex', focalLength: 80, objectDistance: 120, objectHeight: 60 },
    visualConfig: { showRays: true, showFormula: true, sourceType: 'object', showScreen: true },
  },
  {
    id: 'opt-012',
    moduleId: 'lens',
    title: 'OPT-012 凹透镜成像',
    summary: '凹透镜对实物始终成正立缩小虚像。',
    category: 'lens',
    formulas: ['1 / u + 1 / v = 1 / f（f < 0）'],
    teachingPoints: [
      '焦距取负值',
      '始终成正立缩小虚像',
    ],
    params: [
      { key: 'focalLength', label: '焦距 |f|', defaultValue: 80, min: 20, max: 200, step: 5, unit: 'cm' },
      { key: 'objectDistance', label: '物距 u', defaultValue: 120, min: 10, max: 400, step: 5, unit: 'cm' },
    ],
    defaults: { experimentId: 'opt-012', lensType: 'concave', focalLength: 80, objectDistance: 120, objectHeight: 60 },
    visualConfig: { showRays: true, showFormula: true, sourceType: 'object', showScreen: true },
  },
] as const;

// ---------------------------------------------------------------------------
// Default settings builder
// ---------------------------------------------------------------------------

export function buildDefaultLensSettings(): LensSettings {
  return {
    experimentId: 'opt-011',
    lensType: 'convex',
    sourceType: 'object',
    focalLength: 80,
    objectDistance: 120,
    objectHeight: 60,
    lensCenterX: 560,
    objectX: 440,
    screenX: 900,
    canvasPanX: 0,
    canvasPanY: 0,
    canvasZoom: 1,
    showScreen: true,
    showRays: true,
    showFormula: true,
    rayThick: 1.8,
  };
}
