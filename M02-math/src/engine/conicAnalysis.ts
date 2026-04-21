import type {
  ConicEntity,
  EllipseParams,    EllipseDerived,
  HyperbolaParams,  HyperbolaDerived,
  ParabolaParams,   ParabolaDerived,
  CircleParams,     CircleDerived,
} from '@/types';

// ─── Derived element calculators ─────────────────────────────────────────────

/**
 * Compute all derived elements of an ellipse x²/a² + y²/b² = 1 (a > b > 0).
 *
 * Acceptance check (a=5, b=3):
 *   c = √(25-9) = 4.000  e = 0.800  foci = (±4, 0)  directrices x = ±6.25
 */
export function computeEllipseDerived(p: EllipseParams): EllipseDerived {
  const { a, b, cx, cy } = p;
  const c = Math.sqrt(a * a - b * b);
  const e = c / a;
  // directrix: x = cx ± a²/c  (= cx ± a/e)
  const d = a * a / c;
  return {
    c,
    e,
    foci:        [[cx - c, cy], [cx + c, cy]],
    directrices: [cx - d, cx + d],
  };
}

/**
 * Compute all derived elements of a hyperbola x²/a² - y²/b² = 1 (real axis along x).
 *
 * Acceptance check (a=3, b=4):
 *   c = √(9+16) = 5.000  e = 1.667  asymptote slopes ±1.333
 */
export function computeHyperbolaDerived(p: HyperbolaParams): HyperbolaDerived {
  const { a, b, cx, cy } = p;
  const c = Math.sqrt(a * a + b * b);
  const e = c / a;
  const d = a * a / c;             // directrix offset: x = cx ± a²/c
  const slope = b / a;             // asymptote slope ±b/a
  return {
    c,
    e,
    foci:        [[cx - c, cy], [cx + c, cy]],
    directrices: [cx - d, cx + d],
    asymptotes:  [
      { k:  slope, b: cy - slope  * cx },   // y =  (b/a)(x - cx) + cy
      { k: -slope, b: cy + slope  * cx },   // y = -(b/a)(x - cx) + cy
    ],
  };
}

/**
 * Compute all derived elements of a parabola.
 *
 * orientation 'h' (default): y² = 2p(x−cx)  focus=(cx+p/2, cy)  directrix x=cx−p/2
 * orientation 'v':           x² = 2p(y−cy)  focus=(cx, cy+p/2)  directrix y=cy−p/2
 */
export function computeParabolaDerived(p: ParabolaParams): ParabolaDerived {
  const { p: fp, cx, cy, orientation = 'h' } = p;
  if (orientation === 'v') {
    return {
      focus:       [cx, cy + fp / 2],
      directrix:   cy - fp / 2,       // horizontal line y = directrix
      orientation: 'v',
    };
  }
  return {
    focus:       [cx + fp / 2, cy],
    directrix:   cx - fp / 2,         // vertical line   x = directrix
    orientation: 'h',
  };
}

/** Compute all derived elements of a circle (x-cx)² + (y-cy)² = r². */
export function computeCircleDerived(p: CircleParams): CircleDerived {
  const { r, cx, cy } = p;
  return {
    center:        [cx, cy],
    area:          Math.PI * r * r,
    circumference: 2 * Math.PI * r,
  };
}

// ─── Focal distance ───────────────────────────────────────────────────────────

/**
 * Euclidean distances from a math-coordinate point to both foci.
 *
 * For ellipse:   r₁ + r₂ = 2a  (constant)
 * For hyperbola: |r₁ - r₂| = 2a (constant)
 * For circle:    r₁ = r₂ = distance to centre
 * For parabola:  r₁ = r₂ = distance to focus  (= distance to directrix)
 *
 * Returns `null` for unknown entity types.
 */
export function focalDistance(
  entity: ConicEntity,
  point:  [number, number],
): { r1: number; r2: number } | null {
  const [px, py] = point;

  const dist = (ax: number, ay: number) =>
    Math.sqrt((px - ax) ** 2 + (py - ay) ** 2);

  switch (entity.type) {
    case 'ellipse':
    case 'hyperbola': {
      const [[f1x, f1y], [f2x, f2y]] = entity.derived.foci;
      return { r1: dist(f1x, f1y), r2: dist(f2x, f2y) };
    }
    case 'circle': {
      const { cx, cy } = entity.params;
      const d = dist(cx, cy);
      return { r1: d, r2: d };
    }
    case 'parabola': {
      const [fx, fy] = entity.derived.focus;
      const d = dist(fx, fy);
      return { r1: d, r2: d };
    }
    default:
      return null;
  }
}

// ─── Eccentricity ↔ params ────────────────────────────────────────────────────

/**
 * Given a fixed focal half-distance `c` and a target eccentricity `e`,
 * compute the corresponding conic type + semi-axes.
 *
 * Used by `eccentricityEngine` (Phase 7) for the e 0→2 animation.
 *
 * | e         | conic type  | formula             |
 * |-----------|-------------|---------------------|
 * | ≈ 0       | circle      | a = b = c (limit)   |
 * | 0 < e < 1 | ellipse     | a = c/e, b = a√(1-e²)|
 * | e ≈ 1     | parabola    | p = 2c              |
 * | e > 1     | hyperbola   | a = c/e, b = a√(e²-1)|
 */
export function eccentricityToParams(
  e: number,
  c: number,
): { type: 'circle' | 'ellipse' | 'parabola' | 'hyperbola'; a: number; b: number; p?: number } {
  if (e < 1e-6) {
    return { type: 'circle', a: c, b: c };
  }
  if (e < 1 - 1e-6) {
    const a = c / e;
    const b = a * Math.sqrt(1 - e * e);
    return { type: 'ellipse', a, b };
  }
  if (Math.abs(e - 1) < 1e-6) {
    return { type: 'parabola', a: 0, b: 0, p: 2 * c };
  }
  const a = c / e;
  const b = a * Math.sqrt(e * e - 1);
  return { type: 'hyperbola', a, b };
}
