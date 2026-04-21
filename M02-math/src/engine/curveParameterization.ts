/**
 * Curve parameterization engine — forward and inverse maps for all entity types.
 *
 * resolvePointOnEntity: t → (x, y)
 * projectOntoEntity: (x, y) → { t, x, y }
 */

import type {
  AnyEntity,
  ImplicitCurveEntity,
} from '@/types';
import type { Viewport } from '@/canvas/Viewport';
import { compileImplicitCurve } from '@/engine/implicitCurveEngine';
import { sampleImplicitCurve } from '@/engine/implicitSampler';

export interface ResolvedPoint {
  t: number;
  mathX: number;
  mathY: number;
  branch?: 'right' | 'left';
}

// ─── Forward map: t → (x, y) ────────────────────────────────────────────────

export function resolvePointOnEntity(
  entity: AnyEntity,
  t: number,
  branch?: 'right' | 'left',
): { mathX: number; mathY: number } | null {
  switch (entity.type) {
    case 'ellipse': {
      const { a, b, cx, cy } = entity.params;
      return { mathX: cx + a * Math.cos(t), mathY: cy + b * Math.sin(t) };
    }
    case 'circle': {
      const { r, cx, cy } = entity.params;
      return { mathX: cx + r * Math.cos(t), mathY: cy + r * Math.sin(t) };
    }
    case 'hyperbola': {
      const { a, b, cx, cy } = entity.params;
      const sign = branch === 'left' ? -1 : 1;
      return { mathX: cx + sign * a * Math.cosh(t), mathY: cy + b * Math.sinh(t) };
    }
    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = entity.params;
      if (orientation === 'v') {
        return { mathX: cx + t, mathY: cy + (t * t) / (2 * p) };
      }
      return { mathX: cx + (t * t) / (2 * p), mathY: cy + t };
    }
    case 'line': {
      const { k, b, vertical, x } = entity.params;
      if (vertical) {
        return { mathX: x, mathY: t };
      }
      return { mathX: t, mathY: k * t + b };
    }
    case 'implicit-curve':
      // For implicit curves, t is not used — return null
      // The caller should use mathX/mathY directly
      return null;
    case 'movable-point':
      return null;
  }
}

// ─── Inverse map: (x, y) → t ────────────────────────────────────────────────

export function projectOntoEntity(
  entity: AnyEntity,
  mx: number,
  my: number,
  vp: Viewport,
): ResolvedPoint | null {
  switch (entity.type) {
    case 'ellipse': {
      const { a, b, cx, cy } = entity.params;
      return projectOntoParametric(
        (t) => [cx + a * Math.cos(t), cy + b * Math.sin(t)],
        mx, my, 0, 2 * Math.PI, 400,
      );
    }
    case 'circle': {
      const { r, cx, cy } = entity.params;
      const dx = mx - cx;
      const dy = my - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 1e-10) return { t: 0, mathX: cx + r, mathY: cy };
      const t = Math.atan2(dy, dx);
      return { t, mathX: cx + r * Math.cos(t), mathY: cy + r * Math.sin(t) };
    }
    case 'hyperbola': {
      const { a, b, cx, cy } = entity.params;
      const yExt = Math.max(Math.abs(vp.yMax - cy), Math.abs(vp.yMin - cy)) + 1;
      const xExt = Math.max(Math.abs(vp.xMax - cx), Math.abs(vp.xMin - cx)) + 1;
      const tMaxY = Math.asinh(yExt / b);
      const tMaxX = Math.acosh(Math.max(1.01, xExt / a));
      const tMax = Math.max(tMaxY, tMaxX) + 0.5;

      let bestResult: ResolvedPoint | null = null;
      let bestDist = Infinity;

      for (const branchVal of ['right', 'left'] as const) {
        const sign = branchVal === 'left' ? -1 : 1;
        const result = projectOntoParametric(
          (t) => [cx + sign * a * Math.cosh(t), cy + b * Math.sinh(t)],
          mx, my, -tMax, tMax, 400,
        );
        if (result) {
          const d = (result.mathX - mx) ** 2 + (result.mathY - my) ** 2;
          if (d < bestDist) {
            bestDist = d;
            bestResult = { ...result, branch: branchVal };
          }
        }
      }
      return bestResult;
    }
    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = entity.params;
      if (orientation === 'v') {
        const xExt = Math.max(Math.abs(vp.xMax - cx), Math.abs(vp.xMin - cx)) + 2;
        return projectOntoParametric(
          (t) => [cx + t, cy + (t * t) / (2 * p)],
          mx, my, -xExt, xExt, 400,
        );
      }
      const yExt = Math.max(Math.abs(vp.yMax - cy), Math.abs(vp.yMin - cy)) + 2;
      return projectOntoParametric(
        (t) => [cx + (t * t) / (2 * p), cy + t],
        mx, my, -yExt, yExt, 400,
      );
    }
    case 'line': {
      const { k, b, vertical, x } = entity.params;
      if (vertical) {
        return { t: my, mathX: x, mathY: my };
      }
      // Project onto line y = kx + b
      // Closest point: t = (mx + k*my - k*b) / (1 + k*k)
      const t = (mx + k * (my - b)) / (1 + k * k);
      return { t, mathX: t, mathY: k * t + b };
    }
    case 'implicit-curve': {
      return projectOntoImplicit(entity, mx, my, vp);
    }
    case 'movable-point':
      return null;
  }
}

// ─── Parametric projection helper ────────────────────────────────────────────

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}

function projectOntoParametric(
  paramFn: (t: number) => [number, number],
  mx: number,
  my: number,
  tMin: number,
  tMax: number,
  steps: number,
): ResolvedPoint | null {
  let bestT = tMin;
  let bestD = Infinity;

  for (let i = 0; i <= steps; i++) {
    const t = tMin + (i / steps) * (tMax - tMin);
    const [px, py] = paramFn(t);
    const d = distSq(px, py, mx, my);
    if (d < bestD) { bestD = d; bestT = t; }
  }

  // Ternary refinement
  const step = (tMax - tMin) / steps;
  let lo = bestT - step;
  let hi = bestT + step;
  for (let i = 0; i < 30; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    const [p1x, p1y] = paramFn(m1);
    const [p2x, p2y] = paramFn(m2);
    if (distSq(p1x, p1y, mx, my) < distSq(p2x, p2y, mx, my)) hi = m2;
    else lo = m1;
  }

  const tBest = (lo + hi) / 2;
  const [rx, ry] = paramFn(tBest);
  return { t: tBest, mathX: rx, mathY: ry };
}

// ─── Implicit curve projection ───────────────────────────────────────────────

function projectOntoImplicit(
  entity: ImplicitCurveEntity,
  mx: number,
  my: number,
  vp: Viewport,
): ResolvedPoint | null {
  const compiled = compileImplicitCurve(entity.params);
  if (!compiled) return null;

  const result = sampleImplicitCurve(
    compiled.evaluator,
    vp.xMin, vp.xMax, vp.yMin, vp.yMax,
    100,
  );

  let bestX = mx;
  let bestY = my;
  let bestDist = Infinity;

  for (const seg of result.segments) {
    const [x1, y1, x2, y2] = seg;
    // Project onto segment
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    if (len2 < 1e-16) {
      const d = distSq(x1, y1, mx, my);
      if (d < bestDist) { bestDist = d; bestX = x1; bestY = y1; }
      continue;
    }
    let t = ((mx - x1) * dx + (my - y1) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + t * dx;
    const py = y1 + t * dy;
    const d = distSq(px, py, mx, my);
    if (d < bestDist) { bestDist = d; bestX = px; bestY = py; }
  }

  return { t: 0, mathX: bestX, mathY: bestY };
}

// ─── T-range for entity type ─────────────────────────────────────────────────

export function getEntityTRange(entity: AnyEntity, vp: Viewport): [number, number] {
  switch (entity.type) {
    case 'ellipse':
    case 'circle':
      return [0, 2 * Math.PI];
    case 'hyperbola': {
      const { a, b, cx, cy } = entity.params;
      const yExt = Math.max(Math.abs(vp.yMax - cy), Math.abs(vp.yMin - cy)) + 1;
      const xExt = Math.max(Math.abs(vp.xMax - cx), Math.abs(vp.xMin - cx)) + 1;
      const tMaxY = Math.asinh(yExt / b);
      const tMaxX = Math.acosh(Math.max(1.01, xExt / a));
      const tMax = Math.max(tMaxY, tMaxX) + 0.5;
      return [-tMax, tMax];
    }
    case 'parabola': {
      const { cx, cy, orientation = 'h' } = entity.params;
      if (orientation === 'v') {
        const xExt = Math.max(Math.abs(vp.xMax - cx), Math.abs(vp.xMin - cx)) + 2;
        return [-xExt, xExt];
      }
      const yExt = Math.max(Math.abs(vp.yMax - cy), Math.abs(vp.yMin - cy)) + 2;
      return [-yExt, yExt];
    }
    case 'line': {
      if (entity.params.vertical) {
        return [vp.yMin, vp.yMax];
      }
      return [vp.xMin, vp.xMax];
    }
    case 'implicit-curve':
      return [0, 1]; // not used for implicit
    case 'movable-point':
      return [0, 1];
  }
}
