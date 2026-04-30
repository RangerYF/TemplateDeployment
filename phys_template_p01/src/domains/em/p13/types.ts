import type { Vec2 } from '@/core/types';
import type { MagneticFieldDirection } from '../types';

export const P13_MODEL_KEYS = {
  rectangularLoopUniformBField: 'rectangular-loop-uniform-bfield',
  lenzMagnetCoil: 'lenz-magnet-coil',
  singleRodResistive: 'single-rod-resistive',
  singleRodWithSource: 'single-rod-with-source',
  singleRodWithCapacitor: 'single-rod-with-capacitor',
  doubleRod: 'double-rod',
  verticalRailRod: 'vertical-rail-rod',
  freeAssembly: 'free-assembly',
} as const;

export type P13ModelKey = typeof P13_MODEL_KEYS[keyof typeof P13_MODEL_KEYS];

export interface P13UniformBFieldRegion {
  sourceEntityId?: string;
  position: Vec2;
  width: number;
  height: number;
  magnitude: number;
  direction: MagneticFieldDirection;
}

export interface P13RectangularLoopSnapshot {
  position: Vec2;
  width: number;
  height: number;
  resistance: number;
  turns: number;
  velocity: Vec2;
  effectiveCutLength: number;
}

export interface P13FluxContribution {
  sourceEntityId?: string;
  overlapArea: number;
  signedFluxDensity: number;
  fluxContribution: number;
}

export interface P13FluxSample {
  flux: number;
  overlapArea: number;
  activeSignedFluxDensity: number;
  contributions: P13FluxContribution[];
}

export interface P13CircuitSample {
  emf: number;
  current: number;
  resistance: number;
}

export interface P13AmpereForceSample {
  magnitude: number;
  direction: Vec2;
  vector: Vec2;
  effectiveCutLength: number;
  signedFluxDensity: number;
}

export interface P13LoopRuntimeSnapshot {
  modelKey: P13ModelKey;
  flux: number;
  overlapArea: number;
  emf: number;
  current: number;
  ampereForce: number;
  activeSignedFluxDensity: number;
}

export type P13HorizontalDirection = 'left' | 'right' | 'none';
export type P13VerticalDirection = 'up' | 'down' | 'none';
export type P13LoopCurrentDirection = 'clockwise' | 'counterclockwise' | 'none';
export type P13SingleRodVariant =
  | 'resistive'
  | 'with-source'
  | 'with-capacitor';

export interface P13SingleRodParams {
  variant: P13SingleRodVariant;
  magneticField: number;
  magneticFieldDirection: MagneticFieldDirection;
  railSpan: number;
  mass: number;
  rodResistance: number;
  externalResistance: number;
  initialVelocity: number;
  frictionCoefficient: number;
  gravity: number;
  sourceVoltage: number;
  capacitanceMicroFarad: number;
  initialCapacitorVoltage: number;
}

export interface P13SingleRodState {
  time: number;
  position: number;
  velocity: number;
  emf: number;
  netCircuitVoltage: number;
  current: number;
  ampereForce: number;
  frictionForce: number;
  netForce: number;
  acceleration: number;
  kineticEnergy: number;
  sourceVoltage: number;
  capacitorVoltage: number;
  capacitorCharge: number;
  totalResistance: number;
  timeConstant: number;
  dampingRatio: number;
  motionDirection: P13HorizontalDirection;
  emfDirection: P13VerticalDirection;
  currentDirection: P13LoopCurrentDirection;
  ampereForceDirection: P13HorizontalDirection;
}

export type P13SingleRodAnalysisStepKey =
  | 'velocity'
  | 'emf'
  | 'current'
  | 'ampere-force';

export interface P13SingleRodAnalysisStep {
  key: P13SingleRodAnalysisStepKey;
  title: string;
  directionLabel: string;
  description: string;
  accentColor: string;
}

export interface P13SingleRodSummary {
  totalResistance: number;
  timeConstant: number;
  initialCurrent: number;
  theoreticalTerminalVelocity: number;
  theoreticalTerminalCurrent: number;
  theoreticalTerminalCapacitorVoltage: number;
  asymptoticDisplacement: number | null;
  stopTime: number | null;
  terminalExplanation: string;
  adoptedConvention: string;
}

export interface P13SingleRodSimulationResult {
  modelKey:
    | typeof P13_MODEL_KEYS.singleRodResistive
    | typeof P13_MODEL_KEYS.singleRodWithSource
    | typeof P13_MODEL_KEYS.singleRodWithCapacitor;
  variant: P13SingleRodVariant;
  params: P13SingleRodParams;
  duration: number;
  timeStep: number;
  samples: P13SingleRodState[];
  summary: P13SingleRodSummary;
}

export type P13DoubleRodVariant = 'basic-frictionless';

export interface P13DoubleRodParams {
  variant: P13DoubleRodVariant;
  magneticField: number;
  magneticFieldDirection: MagneticFieldDirection;
  railSpan: number;
  mass1: number;
  mass2: number;
  rod1Resistance: number;
  rod2Resistance: number;
  initialVelocity1: number;
  initialVelocity2: number;
  initialSeparation: number;
}

export interface P13DoubleRodState {
  time: number;
  position1: number;
  position2: number;
  velocity1: number;
  velocity2: number;
  relativeVelocity: number;
  separation: number;
  emf: number;
  current: number;
  totalResistance: number;
  ampereForceOnRod1: number;
  ampereForceOnRod2: number;
  acceleration1: number;
  acceleration2: number;
  momentum: number;
  kineticEnergy: number;
  motionDirection1: P13HorizontalDirection;
  motionDirection2: P13HorizontalDirection;
  relativeMotionDirection: P13HorizontalDirection;
  emfDirection: P13VerticalDirection;
  currentDirection: P13LoopCurrentDirection;
  ampereForceDirectionOnRod1: P13HorizontalDirection;
  ampereForceDirectionOnRod2: P13HorizontalDirection;
}

export type P13DoubleRodAnalysisStepKey =
  | 'relative-motion'
  | 'emf'
  | 'current'
  | 'ampere-force';

export interface P13DoubleRodAnalysisStep {
  key: P13DoubleRodAnalysisStepKey;
  title: string;
  directionLabel: string;
  description: string;
  accentColor: string;
}

export interface P13DoubleRodSummary {
  totalResistance: number;
  timeConstant: number;
  initialCurrent: number;
  initialMomentum: number;
  theoreticalTerminalVelocity: number;
  theoreticalTerminalCurrent: number;
  terminalExplanation: string;
  adoptedConvention: string;
}

export interface P13DoubleRodSimulationResult {
  modelKey: typeof P13_MODEL_KEYS.doubleRod;
  variant: P13DoubleRodVariant;
  params: P13DoubleRodParams;
  duration: number;
  timeStep: number;
  samples: P13DoubleRodState[];
  summary: P13DoubleRodSummary;
}
