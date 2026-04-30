import type { Entity, MotionState, Vec2 } from '@/core/types';
import { getPointChargeLaunchState } from './point-charge-kinematics';

export interface ParticleState2D {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface ParticleAcceleration2D {
  ax: number;
  ay: number;
}

export interface ParticleIntegrationResult {
  state: ParticleState2D;
  acceleration: ParticleAcceleration2D;
  sampledPositions: Vec2[];
}

export interface ParticleIntegrationOptions {
  dt: number;
  maxSubstep: number;
  accelerationAt: (state: ParticleState2D) => ParticleAcceleration2D;
}

export interface TrajectorySamplingOptions {
  minDistance: number;
  maxPoints: number;
}

export function createParticleState2D(position: Vec2, velocity: Vec2): ParticleState2D {
  return {
    x: position.x,
    y: position.y,
    vx: velocity.x,
    vy: velocity.y,
  };
}

export function resolvePointChargeState2D(
  particle: Entity,
  previousMotion?: MotionState | null,
): ParticleState2D {
  const launch = getPointChargeLaunchState(particle);
  return createParticleState2D(
    previousMotion?.position ?? particle.transform.position,
    previousMotion?.velocity ?? launch.velocity,
  );
}

export function particleStatePosition(state: ParticleState2D): Vec2 {
  return { x: state.x, y: state.y };
}

export function particleStateVelocity(state: ParticleState2D): Vec2 {
  return { x: state.vx, y: state.vy };
}

export function integrateParticleState2D(
  initialState: ParticleState2D,
  options: ParticleIntegrationOptions,
): ParticleIntegrationResult {
  const stepCount = options.dt > 0
    ? Math.max(1, Math.ceil(options.dt / options.maxSubstep))
    : 0;
  const stepDt = stepCount > 0 ? options.dt / stepCount : 0;
  const state: ParticleState2D = { ...initialState };
  const sampledPositions: Vec2[] = [];
  let acceleration = options.accelerationAt(state);

  for (let stepIndex = 0; stepIndex < stepCount; stepIndex += 1) {
    acceleration = options.accelerationAt(state);

    // 物理坐标系：x 向右、y 向上。
    state.vx += acceleration.ax * stepDt;
    state.vy += acceleration.ay * stepDt;
    state.x += state.vx * stepDt;
    state.y += state.vy * stepDt;

    sampledPositions.push({ x: state.x, y: state.y });
  }

  if (stepCount === 0) {
    acceleration = options.accelerationAt(state);
  }

  return {
    state,
    acceleration,
    sampledPositions,
  };
}

export function ensureTrajectorySeed(trajectory: Vec2[], point: Vec2): void {
  if (trajectory.length === 0) {
    trajectory.push({ ...point });
  }
}

export function appendTrajectorySamples(
  trajectory: Vec2[],
  samples: Vec2[],
  options: TrajectorySamplingOptions,
): void {
  for (const sample of samples) {
    appendTrajectoryPoint(trajectory, sample, options.minDistance);
  }

  if (trajectory.length > options.maxPoints) {
    trajectory.splice(0, trajectory.length - options.maxPoints);
  }
}

function appendTrajectoryPoint(
  trajectory: Vec2[],
  point: Vec2,
  minDistance: number,
): void {
  const lastPoint = trajectory[trajectory.length - 1];
  if (!lastPoint) {
    trajectory.push({ ...point });
    return;
  }

  const dx = point.x - lastPoint.x;
  const dy = point.y - lastPoint.y;
  if (Math.hypot(dx, dy) >= minDistance) {
    trajectory.push({ ...point });
  }
}
