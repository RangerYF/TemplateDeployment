import type { Entity, Force, Vec2 } from '@/core/types';
import { pointInCircle, pointInRect, pointInSemicircle, type SemicircleHalf } from '@/core/physics/geometry';
import type { MagneticFieldDirection } from '../types';

/**
 * 2D 简化：
 * - 粒子速度始终在画布平面内
 * - 磁场只有 z 分量，方向为垂直纸面向里/向外
 * - 洛伦兹力 F = q(v × B)，始终与当前速度垂直
 */

export interface MagneticFieldSample {
  inField: boolean;
  signedBz: number;
  magnitude: number;
  direction: MagneticFieldDirection | null;
}

export interface LorentzForceResult {
  force: Force;
  fx: number;
  fy: number;
  field: MagneticFieldSample;
}

export function getSignedBz(magnitude: number, direction: MagneticFieldDirection): number {
  return direction === 'out' ? magnitude : -magnitude;
}

export function isPointInsideBField(
  point: Vec2,
  fieldPosition: Vec2,
  fieldWidth: number,
  fieldHeight: number,
  boundaryShape?: string,
  boundaryRadius?: number,
  boundaryHalf?: SemicircleHalf,
): boolean {
  const center = {
    x: fieldPosition.x + fieldWidth / 2,
    y: fieldPosition.y + fieldHeight / 2,
  };

  if (boundaryShape === 'circle' && boundaryRadius != null) {
    return pointInCircle(point, center, boundaryRadius);
  }

  if (boundaryShape === 'semicircle' && boundaryRadius != null) {
    return pointInSemicircle(point, center, boundaryRadius, boundaryHalf);
  }

  return pointInRect(point, {
    x: fieldPosition.x,
    y: fieldPosition.y,
    width: fieldWidth,
    height: fieldHeight,
  });
}

export function sampleMagneticFieldAtPoint(
  particlePosition: Vec2,
  fieldEntities: Entity[],
): MagneticFieldSample {
  let signedBz = 0;
  let inField = false;

  for (const field of fieldEntities) {
    const fieldPosition = field.transform.position;
    const width = (field.properties.width as number) ?? 0;
    const height = (field.properties.height as number) ?? 0;
    const magnitude = Math.max((field.properties.magnitude as number) ?? 0, 0);
    const direction = (field.properties.direction as MagneticFieldDirection) ?? 'into';
    const boundaryShape = field.properties.boundaryShape as string | undefined;
    const boundaryRadius = field.properties.boundaryRadius as number | undefined;
    const boundaryHalf = field.properties.boundaryHalf as SemicircleHalf | undefined;

    if (
      !isPointInsideBField(
        particlePosition,
        fieldPosition,
        width,
        height,
        boundaryShape,
        boundaryRadius,
        boundaryHalf,
      )
    ) {
      continue;
    }

    inField = true;
    signedBz += getSignedBz(magnitude, direction);
  }

  const magnitude = Math.abs(signedBz);
  const direction = signedBz > 0 ? 'out' : signedBz < 0 ? 'into' : null;

  return {
    inField,
    signedBz,
    magnitude,
    direction,
  };
}

export function computeLorentzForce(
  particlePosition: Vec2,
  velocity: Vec2,
  charge: number,
  fieldEntities: Entity[],
): LorentzForceResult | null {
  const field = sampleMagneticFieldAtPoint(particlePosition, fieldEntities);
  if (!field.inField) return null;

  const fx = charge * velocity.y * field.signedBz;
  const fy = -charge * velocity.x * field.signedBz;
  const magnitude = Math.hypot(fx, fy);

  return {
    force: {
      type: 'lorentz',
      label: 'FB',
      magnitude,
      direction: magnitude > 0
        ? { x: fx / magnitude, y: fy / magnitude }
        : { x: 0, y: 0 },
      displayMagnitude: magnitude * 100,
    },
    fx,
    fy,
    field,
  };
}
