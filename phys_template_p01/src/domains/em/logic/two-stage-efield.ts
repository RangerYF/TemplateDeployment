import type { Entity, Vec2 } from '@/core/types';
import {
  getUniformEFieldDerivedState,
  type UniformEFieldDerivedState,
} from './electric-force';
import { getParticleRadius } from './detector-screen';
import {
  analyzeParallelPlateDeflectionFromState,
  type ParallelPlateDeflectionAnalysis,
} from './parallel-plate-deflection';
import { getPointChargeLaunchState } from './point-charge-kinematics';

const TIME_EPSILON = 1e-9;
const VELOCITY_EPSILON = 1e-6;

export interface TwoStageEFieldStagePair {
  accelerationField: Entity;
  deflectionField: Entity;
}

export interface TwoStageEFieldAnalysis {
  particleRadius: number;
  launchPosition: Vec2;
  launchVelocity: Vec2;
  accelerationState: UniformEFieldDerivedState;
  deflectionState: UniformEFieldDerivedState;
  accelerationVector: Vec2;
  accelerationExitBoundary: 'left' | 'right' | 'top' | 'bottom' | null;
  accelerationExitTime: number | null;
  accelerationExitPosition: Vec2 | null;
  accelerationExitVelocity: Vec2 | null;
  accelerationDistance: number | null;
  deflection: ParallelPlateDeflectionAnalysis | null;
}

export function resolveTwoStageEFieldPair(fields: Entity[]): TwoStageEFieldStagePair | null {
  const accelerationField = fields.find((field) => field.properties.stageRole === 'acceleration')
    ?? fields.find((field) => {
      const direction = (field.properties.direction as Vec2 | undefined) ?? { x: 0, y: 0 };
      return Math.abs(direction.x) > Math.abs(direction.y);
    });
  const deflectionField = fields.find((field) => field.properties.stageRole === 'deflection')
    ?? fields.find((field) => {
      const direction = (field.properties.direction as Vec2 | undefined) ?? { x: 0, y: 0 };
      return Math.abs(direction.y) > Math.abs(direction.x);
    });

  if (!accelerationField || !deflectionField || accelerationField.id === deflectionField.id) {
    return null;
  }

  return {
    accelerationField,
    deflectionField,
  };
}

export function analyzeTwoStageEField(
  particle: Entity,
  fields: Entity[],
  screens: Entity[] = [],
): TwoStageEFieldAnalysis | null {
  const stagePair = resolveTwoStageEFieldPair(fields);
  if (!stagePair) return null;

  return analyzeTwoStageEFieldWithStages(
    particle,
    stagePair.accelerationField,
    stagePair.deflectionField,
    screens,
  );
}

export function analyzeTwoStageEFieldWithStages(
  particle: Entity,
  accelerationField: Entity,
  deflectionField: Entity,
  screens: Entity[] = [],
): TwoStageEFieldAnalysis | null {
  const accelerationDirection = (accelerationField.properties.direction as Vec2 | undefined) ?? { x: 0, y: 0 };
  const deflectionDirection = (deflectionField.properties.direction as Vec2 | undefined) ?? { x: 0, y: 0 };
  if (Math.abs(accelerationDirection.x) <= Math.abs(accelerationDirection.y)) return null;
  if (Math.abs(deflectionDirection.y) <= Math.abs(deflectionDirection.x)) return null;

  const charge = (particle.properties.charge as number) ?? 0;
  const mass = Math.max((particle.properties.mass as number) ?? 1, 1e-9);
  const particleRadius = getParticleRadius(particle);
  const launch = getPointChargeLaunchState(particle);
  const launchPosition = particle.transform.position;
  const accelerationState = getUniformEFieldDerivedState(accelerationField);
  const deflectionState = getUniformEFieldDerivedState(deflectionField);
  const accelerationVector = {
    x: (charge * accelerationState.effectiveE * accelerationDirection.x) / mass,
    y: (charge * accelerationState.effectiveE * accelerationDirection.y) / mass,
  };
  if (Math.abs(accelerationVector.y) > 1e-6) return null;

  const accelerationExit = resolveAccelerationFieldExit({
    launchPosition,
    launchVelocity: launch.velocity,
    accelerationVector,
    particleRadius,
    field: accelerationField,
  });
  if (!accelerationExit) return null;

  const deflection = accelerationExit.exitPosition && accelerationExit.exitVelocity
    ? analyzeParallelPlateDeflectionFromState({
      launchPosition: accelerationExit.exitPosition,
      launchVelocity: accelerationExit.exitVelocity,
      charge,
      mass,
      particleRadius,
      field: deflectionField,
      screens,
    })
    : null;

  return {
    particleRadius,
    launchPosition,
    launchVelocity: launch.velocity,
    accelerationState,
    deflectionState,
    accelerationVector,
    accelerationExitBoundary: accelerationExit.boundary,
    accelerationExitTime: accelerationExit.time,
    accelerationExitPosition: accelerationExit.exitPosition,
    accelerationExitVelocity: accelerationExit.exitVelocity,
    accelerationDistance: accelerationExit.distance,
    deflection,
  };
}

function resolveAccelerationFieldExit({
  launchPosition,
  launchVelocity,
  accelerationVector,
  particleRadius,
  field,
}: {
  launchPosition: Vec2;
  launchVelocity: Vec2;
  accelerationVector: Vec2;
  particleRadius: number;
  field: Entity;
}): {
  boundary: 'left' | 'right' | 'top' | 'bottom' | null;
  time: number | null;
  exitPosition: Vec2 | null;
  exitVelocity: Vec2 | null;
  distance: number | null;
} | null {
  const width = Math.max((field.properties.width as number) ?? 0, 0);
  const height = Math.max((field.properties.height as number) ?? 0, 0);
  if (width <= 0 || height <= 0) return null;

  const left = field.transform.position.x + particleRadius;
  const right = field.transform.position.x + width - particleRadius;
  const bottom = field.transform.position.y + particleRadius;
  const top = field.transform.position.y + height - particleRadius;

  const insideField =
    launchPosition.x >= left - TIME_EPSILON &&
    launchPosition.x <= right + TIME_EPSILON &&
    launchPosition.y >= bottom - TIME_EPSILON &&
    launchPosition.y <= top + TIME_EPSILON;
  if (!insideField) return null;

  const xAt = (time: number) =>
    launchPosition.x + (launchVelocity.x * time) + (0.5 * accelerationVector.x * time * time);
  const yAt = (time: number) => launchPosition.y + (launchVelocity.y * time);

  const candidates: Array<{ boundary: 'left' | 'right' | 'top' | 'bottom'; time: number }> = [];
  for (const [boundary, boundaryX] of [['left', left], ['right', right]] as const) {
    for (const time of solveQuadraticTimes(0.5 * accelerationVector.x, launchVelocity.x, launchPosition.x - boundaryX)) {
      if (time <= TIME_EPSILON) continue;
      const y = yAt(time);
      if (y < bottom - TIME_EPSILON || y > top + TIME_EPSILON) continue;
      candidates.push({ boundary, time });
    }
  }

  if (Math.abs(launchVelocity.y) > VELOCITY_EPSILON) {
    for (const [boundary, boundaryY] of [['bottom', bottom], ['top', top]] as const) {
      const time = (boundaryY - launchPosition.y) / launchVelocity.y;
      if (time <= TIME_EPSILON) continue;
      const x = xAt(time);
      if (x < left - TIME_EPSILON || x > right + TIME_EPSILON) continue;
      candidates.push({ boundary, time });
    }
  }

  candidates.sort((leftCandidate, rightCandidate) => leftCandidate.time - rightCandidate.time);
  const exit = candidates[0];
  if (!exit) {
    return {
      boundary: null,
      time: null,
      exitPosition: null,
      exitVelocity: null,
      distance: null,
    };
  }

  const exitPosition = {
    x: xAt(exit.time),
    y: yAt(exit.time),
  };
  const exitVelocity = {
    x: launchVelocity.x + (accelerationVector.x * exit.time),
    y: launchVelocity.y,
  };

  return {
    boundary: exit.boundary,
    time: exit.time,
    exitPosition,
    exitVelocity,
    distance: exit.boundary === 'left' || exit.boundary === 'right'
      ? Math.abs(exitPosition.x - launchPosition.x)
      : null,
  };
}

function solveQuadraticTimes(a: number, b: number, c: number): number[] {
  if (Math.abs(a) < TIME_EPSILON) {
    if (Math.abs(b) < VELOCITY_EPSILON) return [];
    return [(-c) / b];
  }

  const discriminant = (b * b) - (4 * a * c);
  if (discriminant < -TIME_EPSILON) return [];

  const safeDiscriminant = Math.max(discriminant, 0);
  const sqrtDiscriminant = Math.sqrt(safeDiscriminant);
  const denominator = 2 * a;
  return [
    (-b - sqrtDiscriminant) / denominator,
    (-b + sqrtDiscriminant) / denominator,
  ];
}
