import type { Vec2 } from '@/core/types';

export const COULOMB_CONSTANT = 8.99e9;

export interface PointChargeSample {
  position: Vec2;
  charge: number;
}

function isNearSingularity(distance: number): boolean {
  return distance < 1e-6;
}

export function computeElectricFieldVectorAtPoint(
  point: Vec2,
  charges: PointChargeSample[],
): Vec2 {
  let ex = 0;
  let ey = 0;

  for (const charge of charges) {
    const dx = point.x - charge.position.x;
    const dy = point.y - charge.position.y;
    const r2 = dx * dx + dy * dy;
    if (r2 < 1e-12) continue;
    const r = Math.sqrt(r2);
    const r3 = r * r * r;
    ex += COULOMB_CONSTANT * charge.charge * dx / r3;
    ey += COULOMB_CONSTANT * charge.charge * dy / r3;
  }

  return { x: ex, y: ey };
}

export function computeElectricFieldMagnitudeAtPoint(
  point: Vec2,
  charges: PointChargeSample[],
): number {
  for (const charge of charges) {
    const dx = point.x - charge.position.x;
    const dy = point.y - charge.position.y;
    if (isNearSingularity(Math.hypot(dx, dy))) {
      return Number.POSITIVE_INFINITY;
    }
  }

  const vector = computeElectricFieldVectorAtPoint(point, charges);
  return Math.hypot(vector.x, vector.y);
}

export function computePotentialAtPoint(
  point: Vec2,
  charges: PointChargeSample[],
): number {
  let potential = 0;

  for (const charge of charges) {
    const dx = point.x - charge.position.x;
    const dy = point.y - charge.position.y;
    const r = Math.hypot(dx, dy);

    if (isNearSingularity(r)) {
      return charge.charge >= 0 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
    }

    potential += COULOMB_CONSTANT * charge.charge / r;
  }

  return potential;
}
