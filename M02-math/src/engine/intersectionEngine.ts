/**
 * Line–conic intersection engine for M03 解析几何画板.
 *
 * For a non-vertical line  y = k·x + b:
 *   Let X = x − cx,  Y = y − cy,  B' = k·cx + b − cy  (so Y = k·X + B')
 *   Substitute into each conic's centred equation → quadratic in X.
 *
 * For a vertical line  x = x₀:
 *   Each conic is solved directly for Y (closed-form).
 *
 * Focal triangle: when the chord passes through a focus F₁, the triangle
 *   is △F₂AB (other focus + chord endpoints).  Area via the cross-product
 *   formula.  Not defined for circles (no foci) or single-focus parabolas
 *   (the degenerate "other focus at infinity" case is skipped).
 */

import type { ConicEntity, LineParams } from '@/types';

// ─── Public types ─────────────────────────────────────────────────────────────

export interface IntersectionResult {
  /** 0, 1 or 2 intersection points (math coords), sorted left→right then bottom→top. */
  pts: [number, number][];
  /** |AB| chord length when 2 points exist, else null. */
  chordLength: number | null;
  /** Area of the focal triangle when the chord passes through a focus, else null. */
  focalTriangleArea: number | null;
  /** Label of the focus the line passes through ('F', 'F₁', 'F₂'), else null. */
  focalLabel: string | null;
  /**
   * The focus the chord passes through (math coords), or null.
   * For ellipse/hyperbola: the focus F₁ or F₂ that the line passes through.
   * For parabola: the single focus F.
   */
  focalPoint: [number, number] | null;
  /**
   * The "other" focus used for the focal triangle, or null.
   * For ellipse/hyperbola: the focus NOT on the chord line.
   * Null for parabolas and circles.
   */
  otherFocalPoint: [number, number] | null;
  /**
   * Distance from each intersection point to the focal point, when the chord
   * passes through a focus. [|AF|, |BF|] where A = pts[0], B = pts[1].
   * Null when no focal chord or fewer than 2 points.
   */
  focalDistances: [number, number] | null;
  /**
   * True when the focal chord is perpendicular to the focal axis —
   * i.e. this is the latus rectum (通径).  Always false for circles.
   */
  isLatusRectum: boolean;
  /**
   * Perpendicular distance from the conic centre to the line.
   * Only set for circles; null for all other conic types.
   */
  centerLineDist: number | null;
  /**
   * Positional relationship between a circle and the line.
   * Only set for circles; null for all other conic types.
   *   '相交' — d < R (two intersection points)
   *   '相切' — d ≈ R (one tangent point)
   *   '相离' — d > R (no intersection)
   */
  lineCircleRelation: '相交' | '相切' | '相离' | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Tolerance (math units): distance from focus to line that counts as "passes through". */
const FOCAL_TOL = 0.25;

/**
 * Tangency epsilon (math units): |d − R| < TANG_EPS → classified as '相切'.
 * Tight enough to require intentional placement; robust against float rounding.
 */
const TANG_EPS = 1e-4;

/**
 * Slope epsilon: |k| < PERP_TOL → line is treated as horizontal.
 * Used to detect latus rectum of vertical parabolas (x²=2py).
 */
const PERP_TOL = 0.05;

/** Distance from a point (fx, fy) to the line described by LineParams. */
function distPointToLine(fx: number, fy: number, line: LineParams): number {
  if (line.vertical) return Math.abs(fx - line.x);
  return Math.abs(fy - line.k * fx - line.b) / Math.sqrt(1 + line.k * line.k);
}

/**
 * Solve A·x² + B·x + C = 0.
 * Returns [] / [root] / [r1, r2] (no complex roots).
 */
function solveQuad(A: number, B: number, C: number): number[] {
  if (Math.abs(A) < 1e-12) {
    // Degenerate → linear
    if (Math.abs(B) < 1e-12) return [];
    return [-C / B];
  }
  const disc = B * B - 4 * A * C;
  if (disc < -1e-10) return [];
  if (disc < 0)      return [-B / (2 * A)];
  const sq = Math.sqrt(Math.max(0, disc));
  return [(-B - sq) / (2 * A), (-B + sq) / (2 * A)];
}

// ─── Non-vertical line vs each conic ──────────────────────────────────────────

function intersectSlope(line: LineParams, conic: ConicEntity): [number, number][] {
  const { k, b } = line;
  const pts: [number, number][] = [];

  switch (conic.type) {

    case 'ellipse': {
      const { a, b: be, cx, cy } = conic.params;
      const Bp = k * cx + b - cy;
      const A  = 1 / (a * a) + k * k / (be * be);
      const B  = 2 * k * Bp / (be * be);
      const C  = Bp * Bp / (be * be) - 1;
      for (const X of solveQuad(A, B, C)) {
        const x = cx + X;
        pts.push([x, k * x + b]);
      }
      break;
    }

    case 'hyperbola': {
      const { a, b: bh, cx, cy } = conic.params;
      const Bp = k * cx + b - cy;
      const A  =  1 / (a * a) - k * k / (bh * bh);
      const B  = -2 * k * Bp / (bh * bh);
      const C  = -Bp * Bp / (bh * bh) - 1;
      for (const X of solveQuad(A, B, C)) {
        const x = cx + X;
        pts.push([x, k * x + b]);
      }
      break;
    }

    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = conic.params;
      const Bp = k * cx + b - cy;

      if (orientation === 'v') {
        // (x−cx)² = 2p(y−cy)  →  X² − 2p·k·X − 2p·B' = 0
        const A = 1;
        const B = -2 * p * k;
        const C = -2 * p * Bp;
        for (const X of solveQuad(A, B, C)) {
          const x = cx + X;
          pts.push([x, k * x + b]);
        }
      } else {
        // (y−cy)² = 2p(x−cx)  →  k²·X² + (2k·B'−2p)·X + B'² = 0
        const A = k * k;
        const B = 2 * k * Bp - 2 * p;
        const C = Bp * Bp;
        for (const X of solveQuad(A, B, C)) {
          const x = cx + X;
          pts.push([x, k * x + b]);
        }
      }
      break;
    }

    case 'circle': {
      const { r, cx, cy } = conic.params;
      const Bp = k * cx + b - cy;
      const A  = 1 + k * k;
      const B  = 2 * k * Bp;
      const C  = Bp * Bp - r * r;
      for (const X of solveQuad(A, B, C)) {
        const x = cx + X;
        pts.push([x, k * x + b]);
      }
      break;
    }
  }
  return pts;
}

// ─── Vertical line  x = x₀  vs each conic ────────────────────────────────────

function intersectVertical(x0: number, conic: ConicEntity): [number, number][] {
  const pts: [number, number][] = [];

  switch (conic.type) {

    case 'ellipse': {
      const { a, b, cx, cy } = conic.params;
      const X  = x0 - cx;
      const y2 = b * b * (1 - X * X / (a * a));
      if (y2 < 0) break;
      const Y = Math.sqrt(y2);
      if (Y < 1e-10) { pts.push([x0, cy]); }
      else            { pts.push([x0, cy + Y], [x0, cy - Y]); }
      break;
    }

    case 'hyperbola': {
      const { a, b, cx, cy } = conic.params;
      const X  = x0 - cx;
      const y2 = b * b * (X * X / (a * a) - 1);
      if (y2 < 0) break;
      const Y = Math.sqrt(y2);
      if (Y < 1e-10) { pts.push([x0, cy]); }
      else            { pts.push([x0, cy + Y], [x0, cy - Y]); }
      break;
    }

    case 'parabola': {
      const { p, cx, cy, orientation = 'h' } = conic.params;
      const X = x0 - cx;
      if (orientation === 'v') {
        // X² = 2p·Y  →  Y = X²/(2p)
        pts.push([x0, cy + X * X / (2 * p)]);
      } else {
        // Y² = 2p·X  →  only valid when X ≥ 0
        if (X < -1e-10) break;
        const Y = Math.sqrt(Math.max(0, 2 * p * X));
        if (Y < 1e-10) { pts.push([x0, cy]); }
        else            { pts.push([x0, cy + Y], [x0, cy - Y]); }
      }
      break;
    }

    case 'circle': {
      const { r, cx, cy } = conic.params;
      const X  = x0 - cx;
      const y2 = r * r - X * X;
      if (y2 < 0) break;
      const Y = Math.sqrt(y2);
      if (Y < 1e-10) { pts.push([x0, cy]); }
      else            { pts.push([x0, cy + Y], [x0, cy - Y]); }
      break;
    }
  }
  return pts;
}

// ─── Public entry ─────────────────────────────────────────────────────────────

/**
 * Compute intersections between a line and a conic entity.
 * Returns an `IntersectionResult` with up to 2 points, chord length, and
 * optional focal-triangle area.
 */
export function intersectLineConic(
  line:  LineParams,
  conic: ConicEntity,
): IntersectionResult {
  const raw = line.vertical
    ? intersectVertical(line.x, conic)
    : intersectSlope(line, conic);

  // Stable ordering: left → right, then bottom → top
  const pts = raw.slice().sort(([ax, ay], [bx, by]) =>
    ax !== bx ? ax - bx : ay - by,
  );

  // Chord length: Euclidean distance √((x₂−x₁)² + (y₂−y₁)²).
  // For non-vertical lines (y = kx+b): y₂−y₁ = k(x₂−x₁), so this simplifies to
  //   √(1+k²)·|x₂−x₁|  — the textbook formula.
  // Both expressions are algebraically identical; the Euclidean form also
  // handles vertical lines (x₁=x₂) correctly without a special case.
  const chordLength = pts.length === 2
    ? Math.sqrt((pts[0][0] - pts[1][0]) ** 2 + (pts[0][1] - pts[1][1]) ** 2)
    : null;

  // ── Circle: centre-to-line distance + positional relationship ──────────────
  let centerLineDist: number | null = null;
  let lineCircleRelation: '相交' | '相切' | '相离' | null = null;

  if (conic.type === 'circle') {
    const d = distPointToLine(conic.params.cx, conic.params.cy, line);
    centerLineDist = d;
    const R = conic.params.r;
    if      (Math.abs(d - R) < TANG_EPS) lineCircleRelation = '相切';
    else if (d < R)                      lineCircleRelation = '相交';
    else                                 lineCircleRelation = '相离';
  }

  // ── Focal triangle + latus-rectum detection ─────────────────────────────────
  let focalTriangleArea: number | null = null;
  let focalLabel: string | null = null;
  let focalPoint: [number, number] | null = null;
  let otherFocalPoint: [number, number] | null = null;
  let focalDistances: [number, number] | null = null;
  let isLatusRectum = false;

  if (pts.length === 2 && conic.type !== 'circle') {
    const [A, B] = pts;

    if (conic.type === 'parabola') {
      // Parabola has only one focus — no "other focus" triangle.
      const focus: [number, number] = [conic.derived.focus[0], conic.derived.focus[1]];
      if (distPointToLine(focus[0], focus[1], line) < FOCAL_TOL) {
        focalLabel = 'F';
        focalPoint = focus;
        focalDistances = [
          Math.sqrt((A[0] - focus[0]) ** 2 + (A[1] - focus[1]) ** 2),
          Math.sqrt((B[0] - focus[0]) ** 2 + (B[1] - focus[1]) ** 2),
        ];
        // Latus rectum: focal chord ⊥ focal axis.
        isLatusRectum = conic.params.orientation === 'v'
          ? (!line.vertical && Math.abs(line.k) < PERP_TOL)
          : line.vertical;
      }

    } else {
      // Ellipse / hyperbola — major axis is always horizontal in our model.
      const [[f1x, f1y], [f2x, f2y]] = conic.derived.foci;
      const d1 = distPointToLine(f1x, f1y, line);
      const d2 = distPointToLine(f2x, f2y, line);

      if (d1 < FOCAL_TOL && d1 <= d2) {
        focalLabel = 'F₁';
        focalPoint = [f1x, f1y];
        otherFocalPoint = [f2x, f2y];
        focalTriangleArea = 0.5 * Math.abs(
          (A[0] - f2x) * (B[1] - f2y) - (B[0] - f2x) * (A[1] - f2y),
        );
        focalDistances = [
          Math.sqrt((A[0] - f1x) ** 2 + (A[1] - f1y) ** 2),
          Math.sqrt((B[0] - f1x) ** 2 + (B[1] - f1y) ** 2),
        ];
        isLatusRectum = line.vertical;
      } else if (d2 < FOCAL_TOL) {
        focalLabel = 'F₂';
        focalPoint = [f2x, f2y];
        otherFocalPoint = [f1x, f1y];
        focalTriangleArea = 0.5 * Math.abs(
          (A[0] - f1x) * (B[1] - f1y) - (B[0] - f1x) * (A[1] - f1y),
        );
        focalDistances = [
          Math.sqrt((A[0] - f2x) ** 2 + (A[1] - f2y) ** 2),
          Math.sqrt((B[0] - f2x) ** 2 + (B[1] - f2y) ** 2),
        ];
        isLatusRectum = line.vertical;
      }
    }
  }

  return {
    pts, chordLength,
    focalTriangleArea, focalLabel, focalPoint, otherFocalPoint, focalDistances,
    isLatusRectum,
    centerLineDist, lineCircleRelation,
  };
}
