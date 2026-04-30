import type { Entity, Vec2 } from '@/core/types';

export const DETECTOR_SCREEN_TYPE = 'detector-screen';

const COLLISION_EPSILON = 1e-9;

interface AxisAlignedRect {
  left: number;
  right: number;
  bottom: number;
  top: number;
}

export interface DetectorScreenCollision {
  screen: Entity;
  position: Vec2;
  progress: number;
}

export interface DetectorScreenRaycastHit {
  screen: Entity;
  position: Vec2;
  time: number;
}

export function isDetectorScreen(entity: Entity): boolean {
  return entity.type === DETECTOR_SCREEN_TYPE;
}

export function getParticleRadius(particle: Entity): number {
  return Math.max((particle.properties.radius as number) ?? 0.12, 0.02);
}

export function resolveDetectorScreenCollision({
  particle,
  previousPosition,
  nextPosition,
  screens,
}: {
  particle: Entity;
  previousPosition: Vec2;
  nextPosition: Vec2;
  screens: Entity[];
}): DetectorScreenCollision | null {
  const radius = getParticleRadius(particle);
  let earliestHit: DetectorScreenCollision | null = null;

  for (const screen of screens) {
    const hit = intersectSegmentWithExpandedRect(previousPosition, nextPosition, getExpandedRect(screen, radius));
    if (!hit) continue;

    if (!earliestHit || hit.progress < earliestHit.progress) {
      earliestHit = {
        screen,
        position: hit.position,
        progress: hit.progress,
      };
    }
  }

  return earliestHit;
}

export function raycastDetectorScreen({
  origin,
  velocity,
  particleRadius,
  screens,
  minTime = 0,
}: {
  origin: Vec2;
  velocity: Vec2;
  particleRadius: number;
  screens: Entity[];
  minTime?: number;
}): DetectorScreenRaycastHit | null {
  let earliestHit: DetectorScreenRaycastHit | null = null;

  for (const screen of screens) {
    const hit = intersectRayWithExpandedRect(origin, velocity, getExpandedRect(screen, particleRadius), minTime);
    if (!hit) continue;

    if (!earliestHit || hit.time < earliestHit.time) {
      earliestHit = {
        screen,
        position: hit.position,
        time: hit.time,
      };
    }
  }

  return earliestHit;
}

function getExpandedRect(screen: Entity, expand: number): AxisAlignedRect {
  const width = Math.max((screen.properties.width as number) ?? 0.18, 0.02);
  const height = Math.max((screen.properties.height as number) ?? 3, 0.1);
  const { position } = screen.transform;

  return {
    left: position.x - expand,
    right: position.x + width + expand,
    bottom: position.y - expand,
    top: position.y + height + expand,
  };
}

function intersectSegmentWithExpandedRect(
  start: Vec2,
  end: Vec2,
  rect: AxisAlignedRect,
): { position: Vec2; progress: number } | null {
  const delta = {
    x: end.x - start.x,
    y: end.y - start.y,
  };
  const intersection = intersectRayInternal(start, delta, rect, 0, 1);
  if (!intersection) return null;

  return {
    position: intersection.position,
    progress: intersection.time,
  };
}

function intersectRayWithExpandedRect(
  origin: Vec2,
  velocity: Vec2,
  rect: AxisAlignedRect,
  minTime: number,
): { position: Vec2; time: number } | null {
  return intersectRayInternal(origin, velocity, rect, minTime, Number.POSITIVE_INFINITY);
}

function intersectRayInternal(
  origin: Vec2,
  velocity: Vec2,
  rect: AxisAlignedRect,
  minTime: number,
  maxTime: number,
): { position: Vec2; time: number } | null {
  const xRange = intersectAxis(origin.x, velocity.x, rect.left, rect.right, minTime, maxTime);
  if (!xRange) return null;

  const yRange = intersectAxis(origin.y, velocity.y, rect.bottom, rect.top, xRange.min, xRange.max);
  if (!yRange) return null;

  const time = Math.max(minTime, xRange.min, yRange.min);
  if (!Number.isFinite(time) || time > maxTime) return null;

  return {
    time,
    position: {
      x: origin.x + velocity.x * time,
      y: origin.y + velocity.y * time,
    },
  };
}

function intersectAxis(
  origin: number,
  velocity: number,
  minBoundary: number,
  maxBoundary: number,
  currentMin: number,
  currentMax: number,
): { min: number; max: number } | null {
  if (Math.abs(velocity) < COLLISION_EPSILON) {
    if (origin < minBoundary || origin > maxBoundary) {
      return null;
    }
    return { min: currentMin, max: currentMax };
  }

  let entry = (minBoundary - origin) / velocity;
  let exit = (maxBoundary - origin) / velocity;
  if (entry > exit) {
    const swap = entry;
    entry = exit;
    exit = swap;
  }

  const nextMin = Math.max(currentMin, entry);
  const nextMax = Math.min(currentMax, exit);

  if (nextMin - nextMax > COLLISION_EPSILON) {
    return null;
  }

  return { min: nextMin, max: nextMax };
}
