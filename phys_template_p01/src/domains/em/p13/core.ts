import type { Entity, Vec2 } from '@/core/types';
import type { MagneticFieldDirection } from '../types';
import {
  P13_MODEL_KEYS,
  type P13AmpereForceSample,
  type P13CircuitSample,
  type P13FluxContribution,
  type P13FluxSample,
  type P13LoopRuntimeSnapshot,
  type P13RectangularLoopSnapshot,
  type P13UniformBFieldRegion,
} from './types';

const EPSILON = 1e-9;

interface AxisAlignedRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function readVec2(value: unknown, fallback: Vec2): Vec2 {
  if (
    value &&
    typeof value === 'object' &&
    typeof (value as Vec2).x === 'number' &&
    typeof (value as Vec2).y === 'number'
  ) {
    return {
      x: (value as Vec2).x,
      y: (value as Vec2).y,
    };
  }
  return fallback;
}

export function resolveSignedFluxDensity(
  magnitude: number,
  direction: MagneticFieldDirection,
): number {
  return direction === 'out' ? magnitude : -magnitude;
}

export function computeRectOverlapArea(a: AxisAlignedRect, b: AxisAlignedRect): number {
  const overlapX = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const overlapY = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return overlapX * overlapY;
}

export function extractUniformBFieldRegions(fieldEntities: Entity[]): P13UniformBFieldRegion[] {
  return fieldEntities
    .filter((entity) => entity.type === 'uniform-bfield')
    .map((field) => ({
      sourceEntityId: field.id,
      position: field.transform.position,
      width: readNumber(field.properties.width, 0),
      height: readNumber(field.properties.height, 0),
      magnitude: readNumber(field.properties.magnitude, 0),
      direction: (field.properties.direction as MagneticFieldDirection) ?? 'into',
    }));
}

export function createRectangularLoopSnapshot(
  entity: Entity,
  overrides?: Partial<Pick<P13RectangularLoopSnapshot, 'position' | 'velocity'>>,
): P13RectangularLoopSnapshot {
  const height = readNumber(entity.properties.height, 0.8);
  return {
    position: overrides?.position ?? entity.transform.position,
    width: readNumber(entity.properties.width, 1),
    height,
    resistance: readNumber(entity.properties.resistance, 2),
    turns: Math.max(1, readNumber(entity.properties.turns, 1)),
    velocity: overrides?.velocity ?? readVec2(entity.properties.initialVelocity, { x: 1, y: 0 }),
    effectiveCutLength: readNumber(entity.properties.effectiveCutLength, height),
  };
}

export function computeRectangularLoopFlux(
  loop: Pick<P13RectangularLoopSnapshot, 'position' | 'width' | 'height'>,
  fields: P13UniformBFieldRegion[],
): P13FluxSample {
  const loopRect: AxisAlignedRect = {
    x: loop.position.x,
    y: loop.position.y,
    width: loop.width,
    height: loop.height,
  };

  let flux = 0;
  let overlapArea = 0;
  let activeSignedFluxDensity = 0;
  const contributions: P13FluxContribution[] = [];

  for (const field of fields) {
    const overlap = computeRectOverlapArea(loopRect, {
      x: field.position.x,
      y: field.position.y,
      width: field.width,
      height: field.height,
    });
    if (overlap <= EPSILON) continue;

    const signedFluxDensity = resolveSignedFluxDensity(field.magnitude, field.direction);
    const fluxContribution = signedFluxDensity * overlap;
    flux += fluxContribution;
    overlapArea += overlap;
    activeSignedFluxDensity += signedFluxDensity;
    contributions.push({
      sourceEntityId: field.sourceEntityId,
      overlapArea: overlap,
      signedFluxDensity,
      fluxContribution,
    });
  }

  return {
    flux,
    overlapArea,
    activeSignedFluxDensity,
    contributions,
  };
}

export function computeInducedEmf(params: {
  previousFlux: number;
  currentFlux: number;
  dt: number;
  turns?: number;
}): number {
  const { previousFlux, currentFlux, dt } = params;
  if (dt <= EPSILON) return 0;
  const turns = Math.max(1, params.turns ?? 1);
  return -((currentFlux - previousFlux) * turns) / dt;
}

export function computeInducedCurrent(params: {
  emf: number;
  resistance: number;
}): number {
  const { emf, resistance } = params;
  if (Math.abs(resistance) <= EPSILON) return 0;
  return emf / resistance;
}

export function computeSeriesCircuitVoltage(
  contributions: readonly number[],
): number {
  return contributions.reduce((sum, value) => sum + value, 0);
}

export function computeMotionalEmf(params: {
  signedFluxDensity: number;
  effectiveCutLength: number;
  velocity: number;
}): number {
  const { signedFluxDensity, effectiveCutLength, velocity } = params;
  if (Math.abs(signedFluxDensity) <= EPSILON || effectiveCutLength <= EPSILON) {
    return 0;
  }
  return -(signedFluxDensity * effectiveCutLength * velocity);
}

export function computeAmpereForceMagnitude(params: {
  signedFluxDensity: number;
  current: number;
  effectiveCutLength: number;
}): number {
  const { signedFluxDensity, current, effectiveCutLength } = params;
  if (
    Math.abs(signedFluxDensity) <= EPSILON ||
    Math.abs(current) <= EPSILON ||
    effectiveCutLength <= EPSILON
  ) {
    return 0;
  }
  return Math.abs(signedFluxDensity) * Math.abs(current) * effectiveCutLength;
}

export function microFaradToFarad(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value * 1e-6;
}

export function computeAmpereForceFromMotion(params: {
  current: number;
  effectiveCutLength: number;
  signedFluxDensity: number;
  velocity: Vec2;
}): P13AmpereForceSample | null {
  const { current, effectiveCutLength, signedFluxDensity, velocity } = params;
  const speed = Math.hypot(velocity.x, velocity.y);
  const fieldStrength = Math.abs(signedFluxDensity);

  if (
    Math.abs(current) <= EPSILON ||
    effectiveCutLength <= EPSILON ||
    fieldStrength <= EPSILON ||
    speed <= EPSILON
  ) {
    return null;
  }

  const magnitude = fieldStrength * Math.abs(current) * effectiveCutLength;
  const direction = {
    x: -velocity.x / speed,
    y: -velocity.y / speed,
  };

  return {
    magnitude,
    direction,
    vector: {
      x: direction.x * magnitude,
      y: direction.y * magnitude,
    },
    effectiveCutLength,
    signedFluxDensity,
  };
}

export function computeRectangularLoopInductionStep(params: {
  loop: P13RectangularLoopSnapshot;
  fields: P13UniformBFieldRegion[];
  previousFlux: number;
  dt: number;
}): {
  flux: P13FluxSample;
  circuit: P13CircuitSample;
  ampereForce: P13AmpereForceSample | null;
  runtime: P13LoopRuntimeSnapshot;
} {
  const { loop, fields, previousFlux, dt } = params;
  const flux = computeRectangularLoopFlux(loop, fields);
  const emf = computeInducedEmf({
    previousFlux,
    currentFlux: flux.flux,
    dt,
    turns: loop.turns,
  });
  const current = computeInducedCurrent({
    emf,
    resistance: loop.resistance,
  });
  const ampereForce = computeAmpereForceFromMotion({
    current,
    effectiveCutLength: loop.effectiveCutLength,
    signedFluxDensity: flux.activeSignedFluxDensity,
    velocity: loop.velocity,
  });

  return {
    flux,
    circuit: {
      emf,
      current,
      resistance: loop.resistance,
    },
    ampereForce,
    runtime: {
      modelKey: P13_MODEL_KEYS.rectangularLoopUniformBField,
      flux: flux.flux,
      overlapArea: flux.overlapArea,
      emf,
      current,
      ampereForce: ampereForce?.magnitude ?? 0,
      activeSignedFluxDensity: flux.activeSignedFluxDensity,
    },
  };
}
