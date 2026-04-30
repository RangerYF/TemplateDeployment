import type { Entity, Vec2 } from '@/core/types';

export interface PointChargeLaunchState {
  speed: number;
  angleDeg: number;
  velocity: Vec2;
}

export function normalizeAngleDeg(angleDeg: number): number {
  const normalized = angleDeg % 360;
  return normalized >= 0 ? normalized : normalized + 360;
}

export function velocityFromSpeedAndAngle(speed: number, angleDeg: number): Vec2 {
  const radians = (normalizeAngleDeg(angleDeg) * Math.PI) / 180;
  return {
    x: speed * Math.cos(radians),
    y: speed * Math.sin(radians),
  };
}

export function angleFromVelocity(velocity: Vec2): number {
  if (Math.hypot(velocity.x, velocity.y) < 1e-9) return 0;
  return normalizeAngleDeg((Math.atan2(velocity.y, velocity.x) * 180) / Math.PI);
}

/**
 * 支持两种初始化方式：
 * 1. 旧预设直接给 initialVelocity
 * 2. 新磁场实验同时给 initialSpeed + initialDirectionDeg
 */
export function getPointChargeLaunchState(particle: Entity): PointChargeLaunchState {
  const explicitVelocity = (particle.properties.initialVelocity as Vec2 | undefined) ?? { x: 0, y: 0 };
  const configuredSpeed = particle.properties.initialSpeed as number | undefined;
  const configuredAngle = particle.properties.initialDirectionDeg as number | undefined;

  if (configuredSpeed != null || configuredAngle != null) {
    const speed = Math.max(configuredSpeed ?? Math.hypot(explicitVelocity.x, explicitVelocity.y), 0);
    const angleDeg = normalizeAngleDeg(configuredAngle ?? angleFromVelocity(explicitVelocity));
    return {
      speed,
      angleDeg,
      velocity: velocityFromSpeedAndAngle(speed, angleDeg),
    };
  }

  return {
    speed: Math.hypot(explicitVelocity.x, explicitVelocity.y),
    angleDeg: angleFromVelocity(explicitVelocity),
    velocity: explicitVelocity,
  };
}

/**
 * 统一点电荷的两套初速度表示：
 * - 笛卡尔：initialVelocity = { x, y }
 * - 极坐标：initialSpeed + initialDirectionDeg
 *
 * 约定：
 * - 0° 向右
 * - 90° 向上（物理坐标系）
 */
export function syncPointChargeLaunchProperties(
  particle: Entity,
  changedProperty?: string,
): void {
  const properties = particle.properties as Record<string, unknown>;
  const explicitVelocity = (properties.initialVelocity as Vec2 | undefined) ?? { x: 0, y: 0 };
  const hasPolarConfig =
    typeof properties.initialSpeed === 'number' ||
    typeof properties.initialDirectionDeg === 'number';

  const shouldUsePolar =
    changedProperty === 'initialSpeed' ||
    changedProperty === 'initialDirectionDeg' ||
    (!changedProperty && hasPolarConfig);

  if (shouldUsePolar) {
    const speed = sanitizeNonNegativeNumber(
      properties.initialSpeed,
      Math.hypot(explicitVelocity.x, explicitVelocity.y),
    );
    const angleDeg = normalizeAngleDeg(
      sanitizeNumber(properties.initialDirectionDeg, angleFromVelocity(explicitVelocity)),
    );

    properties.initialSpeed = speed;
    properties.initialDirectionDeg = angleDeg;
    properties.initialVelocity = velocityFromSpeedAndAngle(speed, angleDeg);
    return;
  }

  const velocity = {
    x: sanitizeNumber(explicitVelocity.x, 0),
    y: sanitizeNumber(explicitVelocity.y, 0),
  };

  properties.initialVelocity = velocity;
  properties.initialSpeed = Math.hypot(velocity.x, velocity.y);
  properties.initialDirectionDeg = angleFromVelocity(velocity);
}

function sanitizeNumber(value: unknown, fallback: number): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function sanitizeNonNegativeNumber(value: unknown, fallback: number): number {
  return Math.max(sanitizeNumber(value, fallback), 0);
}
