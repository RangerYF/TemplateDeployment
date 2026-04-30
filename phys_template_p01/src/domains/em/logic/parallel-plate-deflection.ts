import type { Entity, Vec2 } from '@/core/types';
import { getEFieldGap, getEffectiveE } from './electric-force';
import { getPointChargeLaunchState } from './point-charge-kinematics';
import { getParticleRadius, raycastDetectorScreen } from './detector-screen';

const TIME_EPSILON = 1e-9;
const VELOCITY_EPSILON = 1e-6;

export interface PlateCollisionPrediction {
  time: number;
  position: Vec2;
  boundary: 'top-plate' | 'bottom-plate';
}

export interface ScreenImpactPrediction {
  screenId: string;
  screenLabel?: string;
  time: number;
  position: Vec2;
}

export interface ParallelPlateDeflectionAnalysis {
  particleRadius: number;
  fieldEntryTime: number;
  fieldEntryPosition: Vec2;
  fieldExitTime: number | null;
  horizontalTravelDistance: number;
  fieldLeft: number;
  fieldRight: number;
  fieldBottom: number;
  fieldTop: number;
  acceleration: Vec2;
  launchVelocity: Vec2;
  launchPosition: Vec2;
  plateCollision: PlateCollisionPrediction | null;
  exitPosition: Vec2 | null;
  exitVelocity: Vec2 | null;
  exitDeflection: number | null;
  exitAngleDeg: number | null;
  screenImpact: ScreenImpactPrediction | null;
}

export function analyzeParallelPlateDeflection(
  particle: Entity,
  field: Entity,
  screens: Entity[] = [],
): ParallelPlateDeflectionAnalysis | null {
  const launch = getPointChargeLaunchState(particle);
  return analyzeParallelPlateDeflectionFromState({
    launchPosition: particle.transform.position,
    launchVelocity: launch.velocity,
    charge: (particle.properties.charge as number) ?? 0,
    mass: Math.max((particle.properties.mass as number) ?? 1, 1e-9),
    particleRadius: getParticleRadius(particle),
    field,
    screens,
  });
}

export function analyzeParallelPlateDeflectionFromState({
  launchPosition,
  launchVelocity,
  charge,
  mass,
  particleRadius,
  field,
  screens = [],
}: {
  launchPosition: Vec2;
  launchVelocity: Vec2;
  charge: number;
  mass: number;
  particleRadius: number;
  field: Entity;
  screens?: Entity[];
}): ParallelPlateDeflectionAnalysis | null {
  const direction = (field.properties.direction as Vec2 | undefined) ?? { x: 0, y: -1 };
  if (Math.abs(direction.y) <= Math.abs(direction.x)) return null;
  if (Math.abs(launchVelocity.x) <= VELOCITY_EPSILON) return null;

  const effectiveE = getEffectiveE(field);
  const gap = getEFieldGap(field);
  if (gap <= 0) return null;

  const fieldWidth = (field.properties.width as number) ?? 0;
  const fieldHeight = (field.properties.height as number) ?? 0;
  if (fieldWidth <= 0 || fieldHeight <= 0) return null;

  const fieldLeft = field.transform.position.x + particleRadius;
  const fieldRight = field.transform.position.x + fieldWidth - particleRadius;
  const fieldBottom = field.transform.position.y + particleRadius;
  const fieldTop = field.transform.position.y + fieldHeight - particleRadius;

  const acceleration = {
    x: (charge * effectiveE * direction.x) / mass,
    y: (charge * effectiveE * direction.y) / mass,
  };
  if (Math.abs(acceleration.x) > 1e-6) return null;

  const timeWindow = getHorizontalTraversalWindow(launchPosition.x, launchVelocity.x, fieldLeft, fieldRight);
  if (!timeWindow) return null;

  const fieldEntryTime = Math.max(0, timeWindow.entryTime);
  const fieldExitTime = timeWindow.exitTime;
  if (fieldExitTime <= fieldEntryTime + TIME_EPSILON) return null;
  const fieldEntryPosition = {
    x: launchPosition.x + launchVelocity.x * fieldEntryTime,
    y: launchPosition.y + launchVelocity.y * fieldEntryTime,
  };
  const inFieldDuration = fieldExitTime - fieldEntryTime;

  const entryInsideGap =
    fieldEntryPosition.y >= fieldBottom - TIME_EPSILON &&
    fieldEntryPosition.y <= fieldTop + TIME_EPSILON;
  if (!entryInsideGap && fieldEntryTime <= TIME_EPSILON) {
    return {
      particleRadius,
      fieldEntryTime,
      fieldEntryPosition,
      fieldExitTime,
      horizontalTravelDistance: 0,
      fieldLeft,
      fieldRight,
      fieldBottom,
      fieldTop,
      acceleration,
      launchVelocity,
      launchPosition,
      plateCollision: {
        time: 0,
        position: {
          x: launchPosition.x,
          y: clamp(launchPosition.y, fieldBottom, fieldTop),
        },
        boundary: launchPosition.y >= fieldTop ? 'top-plate' : 'bottom-plate',
      },
      exitPosition: null,
      exitVelocity: null,
      exitDeflection: null,
      exitAngleDeg: null,
      screenImpact: null,
    };
  }
  if (!entryInsideGap) {
    return {
      particleRadius,
      fieldEntryTime,
      fieldEntryPosition,
      fieldExitTime,
      horizontalTravelDistance: 0,
      fieldLeft,
      fieldRight,
      fieldBottom,
      fieldTop,
      acceleration,
      launchVelocity,
      launchPosition,
      plateCollision: null,
      exitPosition: null,
      exitVelocity: null,
      exitDeflection: null,
      exitAngleDeg: null,
      screenImpact: null,
    };
  }

  const plateCollision = findPlateCollision({
    launchPosition: fieldEntryPosition,
    launchVelocity,
    accelerationY: acceleration.y,
    startTime: 0,
    endTime: inFieldDuration,
    lowerBoundary: fieldBottom,
    upperBoundary: fieldTop,
  });

  if (plateCollision) {
    return {
      particleRadius,
      fieldEntryTime,
      fieldEntryPosition,
      fieldExitTime,
      horizontalTravelDistance: Math.abs(launchVelocity.x) * plateCollision.time,
      fieldLeft,
      fieldRight,
      fieldBottom,
      fieldTop,
      acceleration,
      launchVelocity,
      launchPosition,
      plateCollision: {
        ...plateCollision,
        time: fieldEntryTime + plateCollision.time,
      },
      exitPosition: null,
      exitVelocity: null,
      exitDeflection: null,
      exitAngleDeg: null,
      screenImpact: null,
    };
  }

  const exitPosition = positionAt(fieldEntryPosition, launchVelocity, acceleration.y, inFieldDuration);
  const exitVelocity = {
    x: launchVelocity.x,
    y: launchVelocity.y + acceleration.y * inFieldDuration,
  };
  const exitAngleDeg = Math.atan2(exitVelocity.y, exitVelocity.x) * 180 / Math.PI;
  const screenImpactHit = raycastDetectorScreen({
    origin: exitPosition,
    velocity: exitVelocity,
    particleRadius,
    screens,
    minTime: 0,
  });
  const screenImpact = screenImpactHit
    ? {
      screenId: screenImpactHit.screen.id,
      screenLabel: screenImpactHit.screen.label,
      time: screenImpactHit.time,
      position: screenImpactHit.position,
    }
    : null;

  return {
    particleRadius,
    fieldEntryTime,
    fieldEntryPosition,
    fieldExitTime,
    horizontalTravelDistance: Math.abs(launchVelocity.x) * inFieldDuration,
    fieldLeft,
    fieldRight,
    fieldBottom,
    fieldTop,
    acceleration,
    launchVelocity,
    launchPosition,
    plateCollision: null,
    exitPosition,
    exitVelocity,
    exitDeflection: exitPosition.y - launchPosition.y,
    exitAngleDeg,
    screenImpact,
  };
}

function getHorizontalTraversalWindow(
  startX: number,
  velocityX: number,
  left: number,
  right: number,
): { entryTime: number; exitTime: number } | null {
  if (velocityX > VELOCITY_EPSILON) {
    const entryTime = (left - startX) / velocityX;
    const exitTime = (right - startX) / velocityX;
    if (exitTime <= 0) return null;
    return { entryTime, exitTime };
  }

  if (velocityX < -VELOCITY_EPSILON) {
    const entryTime = (right - startX) / velocityX;
    const exitTime = (left - startX) / velocityX;
    if (exitTime <= 0) return null;
    return { entryTime, exitTime };
  }

  return null;
}

function findPlateCollision({
  launchPosition,
  launchVelocity,
  accelerationY,
  startTime,
  endTime,
  lowerBoundary,
  upperBoundary,
}: {
  launchPosition: Vec2;
  launchVelocity: Vec2;
  accelerationY: number;
  startTime: number;
  endTime: number;
  lowerBoundary: number;
  upperBoundary: number;
}): PlateCollisionPrediction | null {
  const collisions: PlateCollisionPrediction[] = [];

  const lowerTimes = solveVerticalBoundaryTimes(
    launchPosition.y,
    launchVelocity.y,
    accelerationY,
    lowerBoundary,
  );
  for (const time of lowerTimes) {
    if (time + TIME_EPSILON < startTime || time - TIME_EPSILON > endTime) continue;
    collisions.push({
      time,
      position: positionAt(launchPosition, launchVelocity, accelerationY, time),
      boundary: 'bottom-plate',
    });
  }

  const upperTimes = solveVerticalBoundaryTimes(
    launchPosition.y,
    launchVelocity.y,
    accelerationY,
    upperBoundary,
  );
  for (const time of upperTimes) {
    if (time + TIME_EPSILON < startTime || time - TIME_EPSILON > endTime) continue;
    collisions.push({
      time,
      position: positionAt(launchPosition, launchVelocity, accelerationY, time),
      boundary: 'top-plate',
    });
  }

  collisions.sort((a, b) => a.time - b.time);
  return collisions[0] ?? null;
}

function solveVerticalBoundaryTimes(
  initialY: number,
  initialVy: number,
  accelerationY: number,
  boundaryY: number,
): number[] {
  if (Math.abs(accelerationY) < TIME_EPSILON) {
    if (Math.abs(initialVy) < VELOCITY_EPSILON) return [];
    return [(boundaryY - initialY) / initialVy].filter((time) => time >= -TIME_EPSILON);
  }

  const a = 0.5 * accelerationY;
  const b = initialVy;
  const c = initialY - boundaryY;
  const discriminant = b * b - 4 * a * c;
  if (discriminant < -TIME_EPSILON) return [];

  const safeDiscriminant = Math.max(discriminant, 0);
  const sqrtDiscriminant = Math.sqrt(safeDiscriminant);
  const denominator = 2 * a;
  const roots = [
    (-b - sqrtDiscriminant) / denominator,
    (-b + sqrtDiscriminant) / denominator,
  ];

  return roots
    .filter((time) => time >= -TIME_EPSILON)
    .map((time) => Math.max(0, time))
    .sort((left, right) => left - right);
}

function positionAt(
  launchPosition: Vec2,
  launchVelocity: Vec2,
  accelerationY: number,
  time: number,
): Vec2 {
  return {
    x: launchPosition.x + launchVelocity.x * time,
    y: launchPosition.y + launchVelocity.y * time + 0.5 * accelerationY * time * time,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
