/**
 * Nearest-point finder for conic entities.
 *
 * For each conic type, a coarse parameter scan (400 steps) identifies the
 * approximate minimum, then ternary search (30 iterations) refines it to
 * sub-pixel accuracy.  The circle case uses the closed-form radial projection.
 *
 * Acceptance criteria (Phase 6):
 *   Ellipse: r₁ + r₂ − 2a  < 0.01
 *   Hyperbola: |r₁ − r₂| − 2a < 0.01
 */

import type {
  AnyEntity,
  ConicEntity,
  EllipseEntity,
  HyperbolaEntity,
  ParabolaEntity,
  CircleEntity,
  ImplicitCurveEntity,
  LineEntity,
} from '@/types';
import type { Viewport } from '@/canvas/Viewport';
import { compileImplicitCurve } from '@/engine/implicitCurveEngine';
import { sampleImplicitCurve } from '@/engine/implicitSampler';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface SnapResult {
  entity: ConicEntity | ImplicitCurveEntity | LineEntity;
  /** Snapped point in math coordinates. */
  x: number;
  y: number;
  /** Euclidean distance from mouse to snapped point (math units). */
  dist: number;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function distSq(x1: number, y1: number, x2: number, y2: number): number {
  return (x1 - x2) ** 2 + (y1 - y2) ** 2;
}

/**
 * Ternary search for the minimum of a unimodal function on [lo, hi].
 * Converges to near-machine precision in 30 iterations.
 */
function ternaryMin(
  f:    (t: number) => number,
  lo:   number,
  hi:   number,
  iters = 30,
): number {
  for (let i = 0; i < iters; i++) {
    const m1 = lo + (hi - lo) / 3;
    const m2 = hi - (hi - lo) / 3;
    if (f(m1) < f(m2)) hi = m2;
    else                lo = m1;
  }
  return (lo + hi) / 2;
}

// ─── Per-conic nearest-point finders ─────────────────────────────────────────

function nearestEllipse(
  entity: EllipseEntity,
  mx: number,
  my: number,
): [number, number] {
  const { a, b, cx, cy } = entity.params;
  const STEPS = 400;
  let bestT = 0;
  let bestD = Infinity;

  for (let i = 0; i < STEPS; i++) {
    const t = (i / STEPS) * 2 * Math.PI;
    const d = distSq(cx + a * Math.cos(t), cy + b * Math.sin(t), mx, my);
    if (d < bestD) { bestD = d; bestT = t; }
  }

  const step  = (2 * Math.PI) / STEPS;
  const tBest = ternaryMin(
    (t) => distSq(cx + a * Math.cos(t), cy + b * Math.sin(t), mx, my),
    bestT - step,
    bestT + step,
  );
  return [cx + a * Math.cos(tBest), cy + b * Math.sin(tBest)];
}

function nearestHyperbola(
  entity: HyperbolaEntity,
  mx:     number,
  my:     number,
  vp:     Viewport,
): [number, number] {
  const { a, b, cx, cy } = entity.params;

  // Adaptive parameter range to cover the visible viewport
  const yExt  = Math.max(Math.abs(vp.yMax - cy), Math.abs(vp.yMin - cy)) + 1;
  const xExt  = Math.max(Math.abs(vp.xMax - cx), Math.abs(vp.xMin - cx)) + 1;
  const tMaxY = Math.asinh(yExt / b);
  const tMaxX = Math.acosh(Math.max(1.01, xExt / a));
  const tMax  = Math.max(tMaxY, tMaxX) + 0.5;

  const STEPS = 400;
  let bestT = 0;
  let bestD = Infinity;
  let bestSign: 1 | -1 = 1;

  for (let i = 0; i <= STEPS; i++) {
    const t = -tMax + (i / STEPS) * 2 * tMax;
    for (const sign of [1, -1] as const) {
      const x = cx + sign * a * Math.cosh(t);
      const y = cy + b * Math.sinh(t);
      const d = distSq(x, y, mx, my);
      if (d < bestD) { bestD = d; bestT = t; bestSign = sign; }
    }
  }

  const step  = (2 * tMax) / STEPS;
  const tBest = ternaryMin(
    (t) => {
      const x = cx + bestSign * a * Math.cosh(t);
      const y = cy + b * Math.sinh(t);
      return distSq(x, y, mx, my);
    },
    bestT - step,
    bestT + step,
  );
  return [cx + bestSign * a * Math.cosh(tBest), cy + b * Math.sinh(tBest)];
}

function nearestParabola(
  entity: ParabolaEntity,
  mx:     number,
  my:     number,
  vp:     Viewport,
): [number, number] {
  const { p, cx, cy, orientation = 'h' } = entity.params;
  const STEPS = 400;

  if (orientation === 'v') {
    // Parametric: x = cx + t,  y = cy + t²/(2p),  t = x − cx
    const xExt = Math.max(Math.abs(vp.xMax - cx), Math.abs(vp.xMin - cx)) + 2;
    const tMax = xExt;
    let bestT = 0;
    let bestD = Infinity;

    for (let i = 0; i <= STEPS; i++) {
      const t = -tMax + (i / STEPS) * 2 * tMax;
      const d = distSq(cx + t, cy + (t * t) / (2 * p), mx, my);
      if (d < bestD) { bestD = d; bestT = t; }
    }

    const step  = (2 * tMax) / STEPS;
    const tBest = ternaryMin(
      (t) => distSq(cx + t, cy + (t * t) / (2 * p), mx, my),
      bestT - step,
      bestT + step,
    );
    return [cx + tBest, cy + (tBest * tBest) / (2 * p)];
  }

  // Horizontal (default): x = cx + t²/(2p),  y = cy + t
  const yExt = Math.max(Math.abs(vp.yMax - cy), Math.abs(vp.yMin - cy)) + 2;
  const tMax = yExt;
  let bestT = 0;
  let bestD = Infinity;

  for (let i = 0; i <= STEPS; i++) {
    const t = -tMax + (i / STEPS) * 2 * tMax;
    const d = distSq(cx + (t * t) / (2 * p), cy + t, mx, my);
    if (d < bestD) { bestD = d; bestT = t; }
  }

  const step  = (2 * tMax) / STEPS;
  const tBest = ternaryMin(
    (t) => distSq(cx + (t * t) / (2 * p), cy + t, mx, my),
    bestT - step,
    bestT + step,
  );
  return [cx + (tBest * tBest) / (2 * p), cy + tBest];
}

/** Circle: closed-form radial projection — O(1), no iteration needed. */
function nearestCircle(
  entity: CircleEntity,
  mx:     number,
  my:     number,
): [number, number] {
  const { r, cx, cy } = entity.params;
  const dx   = mx - cx;
  const dy   = my - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 1e-10) return [cx + r, cy];   // degenerate: mouse at centre
  return [cx + (dx / dist) * r, cy + (dy / dist) * r];
}

/** Nearest point on an implicit curve — sample segments and project. */
function nearestImplicitCurve(
  entity: ImplicitCurveEntity,
  mx: number,
  my: number,
  vp: Viewport,
): [number, number] | null {
  const compiled = compileImplicitCurve(entity.params);
  if (!compiled) return null;

  const result = sampleImplicitCurve(
    compiled.evaluator,
    vp.xMin, vp.xMax, vp.yMin, vp.yMax,
    100,
  );

  if (result.segments.length === 0) return null;

  let bestX = 0;
  let bestY = 0;
  let bestDist = Infinity;

  for (const seg of result.segments) {
    const [x1, y1, x2, y2] = seg;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let px: number, py: number;
    if (len2 < 1e-16) {
      px = x1; py = y1;
    } else {
      let t = ((mx - x1) * dx + (my - y1) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      px = x1 + t * dx;
      py = y1 + t * dy;
    }
    const d = distSq(px, py, mx, my);
    if (d < bestDist) { bestDist = d; bestX = px; bestY = py; }
  }

  return [bestX, bestY];
}

/** Nearest point on a line (perpendicular projection, clamped to viewport). */
function nearestLine(
  entity: LineEntity,
  mx: number,
  my: number,
  vp: Viewport,
): [number, number] {
  const { k, b, vertical, x: vx } = entity.params;

  if (vertical) {
    // Vertical line x = vx: nearest point is (vx, my), clamped to viewport
    const cy = Math.max(vp.yMin, Math.min(vp.yMax, my));
    return [vx, cy];
  }

  // Non-vertical line: y = kx + b
  // Perpendicular foot: project (mx, my) onto the line
  // Line direction: (1, k), normal: (-k, 1)
  // foot = (mx + k*(my - b - k*mx)) / (1 + k²), then y = k*fx + b
  const denom = 1 + k * k;
  const fx = (mx + k * (my - b)) / denom;
  const fy = k * fx + b;
  return [fx, fy];
}

// ─── Public entry ─────────────────────────────────────────────────────────────

/**
 * Find the nearest point on any visible entity to a math-coordinate position.
 *
 * @param snapRadius  Max distance (math units) to activate the snap.
 *                    Typically `Math.min(vp.xRange, vp.yRange) * 0.10`.
 *
 * @returns The closest `SnapResult`, or `null` if no entity is within radius.
 */
export function findNearestOnAnyEntity(
  entities:   AnyEntity[],
  mx:         number,
  my:         number,
  viewport:   Viewport,
  snapRadius: number,
): SnapResult | null {
  let best: SnapResult | null = null;
  const snapRadSq = snapRadius * snapRadius;

  for (const entity of entities) {
    // Skip movable points
    if (!entity.visible || entity.type === 'movable-point') continue;

    let nx: number;
    let ny: number;

    if (entity.type === 'line') {
      [nx, ny] = nearestLine(entity, mx, my, viewport);
    } else if (entity.type === 'implicit-curve') {
      const result = nearestImplicitCurve(entity, mx, my, viewport);
      if (!result) continue;
      [nx, ny] = result;
    } else {
      switch (entity.type) {
        case 'ellipse':   [nx, ny] = nearestEllipse  (entity, mx, my);          break;
        case 'hyperbola': [nx, ny] = nearestHyperbola(entity, mx, my, viewport); break;
        case 'parabola':  [nx, ny] = nearestParabola (entity, mx, my, viewport); break;
        case 'circle':    [nx, ny] = nearestCircle   (entity, mx, my);          break;
      }
    }

    const d2   = distSq(nx, ny, mx, my);
    if (d2 > snapRadSq) continue;

    const dist = Math.sqrt(d2);
    if (!best || dist < best.dist) {
      best = { entity: entity as ConicEntity | ImplicitCurveEntity | LineEntity, x: nx, y: ny, dist };
    }
  }

  return best;
}
