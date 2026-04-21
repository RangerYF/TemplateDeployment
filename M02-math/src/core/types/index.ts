/**
 * Core shared types — re-exported from the central types.ts.
 * All skill modules should import shared types from '@/core/types'.
 */
export type {
  FunctionParam,
  Transform,
  ViewportState,
  PiecewiseSegment,
  FunctionEntry,
  ConicType,
  EllipseParams,
  HyperbolaParams,
  ParabolaParams,
  CircleParams,
  EllipseDerived,
  HyperbolaDerived,
  ParabolaDerived,
  CircleDerived,
  BaseEntityMeta,
  EllipseEntity,
  HyperbolaEntity,
  ParabolaEntity,
  CircleEntity,
  ConicEntity,
  LineParams,
  LineEntity,
  AnyEntity,
  ParametricPoint,
  TrigTransform,
  ExactValue,
  SpecialAngleValues,
  Triangle,
  SolveMode,
  SolveResult,
  FnType,
  FivePointStep,
} from '@/types';

export {
  DEFAULT_TRANSFORM,
  DEFAULT_VIEWPORT,
  FUNCTION_COLORS,
  DEFAULT_M03_VIEWPORT,
  ENTITY_COLORS,
} from '@/types';
