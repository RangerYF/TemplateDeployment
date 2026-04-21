import type { Viewport } from '@/canvas/Viewport';
import type {
  ConicEntity, ParametricPoint,
  EllipseEntity, HyperbolaEntity, ParabolaEntity, CircleEntity,
} from '@/types';

// ─── Individual samplers ──────────────────────────────────────────────────────

/**
 * Sample an ellipse using the standard parametric form:
 *   x = cx + a·cos(θ),  y = cy + b·sin(θ)  for θ ∈ [0, 2π]
 *
 * Uniform angle sampling gives equal arc-length distribution,
 * which is ideal for closed curves with no singularities.
 */
export function sampleEllipse(
  entity: EllipseEntity,
  _vp:    Viewport,
  steps = 800,
): ParametricPoint[] {
  const { a, b, cx, cy } = entity.params;
  const pts: ParametricPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    pts.push({ x: cx + a * Math.cos(theta), y: cy + b * Math.sin(theta) });
  }
  return pts;
}

/**
 * Sample a hyperbola x²/a² - y²/b² = 1 using sinh/cosh:
 *   Right branch: x = cx + a·cosh(t),  y = cy + b·sinh(t)
 *   Left  branch: x = cx - a·cosh(t),  y = cy + b·sinh(t)
 *
 * Using hyperbolic functions completely avoids the tan-asymptote problem:
 * cosh(t) ≥ 1 always, so the vertex is never crossed.
 *
 * The t-range is adaptive: it is chosen so that both branches fully cover
 * the visible viewport (both in x and y).
 */
export function sampleHyperbola(
  entity: HyperbolaEntity,
  vp:     Viewport,
  steps = 800,
): { right: ParametricPoint[]; left: ParametricPoint[] } {
  const { a, b, cx, cy } = entity.params;

  // Compute the t range that covers the full visible viewport
  const yExtent    = Math.max(Math.abs(vp.yMax - cy), Math.abs(vp.yMin - cy));
  const tFromY     = Math.asinh(yExtent / b);

  const xRight = Math.max(0, vp.xMax - cx);
  const xLeft  = Math.max(0, cx - vp.xMin);
  const tFromX = Math.acosh(Math.max(1, xRight / a, xLeft / a));

  const tMax = Math.max(tFromY, tFromX) + 0.3; // +0.3 pad so edges are smooth

  const right: ParametricPoint[] = [];
  const left:  ParametricPoint[] = [];

  for (let i = 0; i <= steps; i++) {
    const t  = -tMax + (2 * tMax * i) / steps;
    const ch = Math.cosh(t);
    const sh = Math.sinh(t);
    right.push({ x: cx + a * ch, y: cy + b * sh });
    left.push ({ x: cx - a * ch, y: cy + b * sh });
  }

  return { right, left };
}

/**
 * Sample a parabola.
 *
 * orientation 'h' (default): y² = 2p(x−cx), t = y−cy → x = cx + t²/(2p)
 * orientation 'v':           x² = 2p(y−cy), t = x−cx → y = cy + t²/(2p)
 */
export function sampleParabola(
  entity: ParabolaEntity,
  vp:     Viewport,
  steps = 800,
): ParametricPoint[] {
  const { p, cx, cy, orientation = 'h' } = entity.params;

  if (orientation === 'v') {
    // t ∈ [xMin−cx, xMax−cx]
    const tMin = vp.xMin - cx;
    const tMax = vp.xMax - cx;
    const pts: ParametricPoint[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = tMin + ((tMax - tMin) * i) / steps;
      pts.push({ x: cx + t, y: cy + (t * t) / (2 * p) });
    }
    return pts;
  }

  // Horizontal (default): t ∈ [yMin−cy, yMax−cy]
  const tMin = vp.yMin - cy;
  const tMax = vp.yMax - cy;
  const pts: ParametricPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = tMin + ((tMax - tMin) * i) / steps;
    pts.push({ x: cx + (t * t) / (2 * p), y: cy + t });
  }
  return pts;
}

/**
 * Sample a circle using the standard parametric form:
 *   x = cx + r·cos(θ),  y = cy + r·sin(θ)  for θ ∈ [0, 2π]
 */
export function sampleCircle(
  entity: CircleEntity,
  _vp:    Viewport,
  steps = 800,
): ParametricPoint[] {
  const { r, cx, cy } = entity.params;
  const pts: ParametricPoint[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
  }
  return pts;
}

// ─── Unified dispatcher ───────────────────────────────────────────────────────

/** Return type for the unified sampler. */
export type SampleResult =
  | ParametricPoint[]
  | { right: ParametricPoint[]; left: ParametricPoint[] };

/**
 * Dispatch to the conic-specific sampler based on entity type.
 *
 * The caller must discriminate the return value before rendering:
 * ```typescript
 * const result = sampleConicEntity(entity, vp);
 * if (Array.isArray(result)) {
 *   renderParametricCurve(ctx, result, vp, entity.color);
 * } else {
 *   renderParametricCurve(ctx, result.right, vp, entity.color);
 *   renderParametricCurve(ctx, result.left,  vp, entity.color);
 * }
 * ```
 */
export function sampleConicEntity(
  entity: ConicEntity,
  vp:     Viewport,
  steps?: number,
): SampleResult {
  switch (entity.type) {
    case 'ellipse':   return sampleEllipse  (entity, vp, steps);
    case 'hyperbola': return sampleHyperbola(entity, vp, steps);
    case 'parabola':  return sampleParabola (entity, vp, steps);
    case 'circle':    return sampleCircle   (entity, vp, steps);
  }
}
