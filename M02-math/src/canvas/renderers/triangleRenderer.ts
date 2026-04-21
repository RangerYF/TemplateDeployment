/**
 * triangleRenderer — M04 Phase 5
 *
 * Renders a triangle (or two triangles for SSA dual solutions) onto a Canvas 2D context.
 *
 * Coordinate strategy:
 *   Local triangle: A at origin, B along +x, C above AB.
 *   Scaled to fit ≤65% of the smaller viewport dimension.
 *   Centred at the given math-space (cx, cy).
 *
 * Annotations:
 *   • Vertex circles labelled A / B / C
 *   • Side labels a / b / c at edge midpoints
 *   • Angle values inside each vertex (degrees)
 */

import type { Viewport }  from '@/canvas/Viewport';
import type { Triangle }  from '@/types';
import { COLORS }         from '@/styles/colors';

// ─── Constants ────────────────────────────────────────────────────────────────

const R2D = 180 / Math.PI;

// ─── Triangle → canvas vertices ───────────────────────────────────────────────

/**
 * Compute canvas-pixel vertices [A, B, C] for a triangle centred at (cx, cy)
 * in math coordinates.  The returned scale is the math-units-per-side-unit.
 */
function triangleToCanvas(
  triangle: Triangle,
  viewport: Viewport,
  cx: number,
  cy: number,
  fitXRange = viewport.xRange,
  fitYRange = viewport.yRange,
): [number, number][] {
  const { b, c, A } = triangle;

  // Local coordinates: A at origin, c along +x axis
  const Ax = 0, Ay = 0;
  const Bx = c,  By = 0;
  const Cx = b * Math.cos(A);
  const Cy = b * Math.sin(A);

  // Bounding box
  const xVals = [Ax, Bx, Cx];
  const yVals = [Ay, By, Cy];
  const xMin = Math.min(...xVals), xMax = Math.max(...xVals);
  const yMin = Math.min(...yVals), yMax = Math.max(...yVals);
  const localW = xMax - xMin || 1;
  const localH = yMax - yMin || 1;

  // Scale to fit 65% of the available range, maintaining aspect ratio
  const scaleX = fitXRange * 0.65 / localW;
  const scaleY = fitYRange * 0.65 / localH;
  const scale  = Math.min(scaleX, scaleY);

  // Centroid of local triangle
  const gx = (Ax + Bx + Cx) / 3;
  const gy = (Ay + By + Cy) / 3;

  // Transform to math coords (centred at cx, cy)
  function toMath(lx: number, ly: number): [number, number] {
    return [cx + (lx - gx) * scale, cy + (ly - gy) * scale];
  }

  const mA = toMath(Ax, Ay);
  const mB = toMath(Bx, By);
  const mC = toMath(Cx, Cy);

  return [
    viewport.toCanvas(mA[0], mA[1]),
    viewport.toCanvas(mB[0], mB[1]),
    viewport.toCanvas(mC[0], mC[1]),
  ];
}

// ─── Annotation rendering ─────────────────────────────────────────────────────

function renderTriangle(
  ctx: CanvasRenderingContext2D,
  vertices: [number, number][],
  triangle: Triangle,
  color: string,
): void {
  const [pA, pB, pC] = vertices;

  // ── Triangle edges ──────────────────────────────────────────────────────
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = 2.5;
  ctx.beginPath();
  ctx.moveTo(pA[0], pA[1]);
  ctx.lineTo(pB[0], pB[1]);
  ctx.lineTo(pC[0], pC[1]);
  ctx.closePath();
  ctx.stroke();

  // ── Light fill ─────────────────────────────────────────────────────────
  ctx.fillStyle = `${color}18`;
  ctx.fill();
  ctx.restore();

  // ── Vertex circles + labels ─────────────────────────────────────────────
  const VERTEX_LABELS  = ['A', 'B', 'C'];
  const ANGLE_DEG      = [triangle.A, triangle.B, triangle.C].map((r) => (r * R2D).toFixed(1));
  const VERTEX_OFFSETS: [number, number][] = [[-14, 10], [8, 10], [0, -8]];

  ctx.save();
  ctx.fillStyle   = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.2)';
  ctx.lineWidth   = 1.5;

  vertices.forEach(([vx, vy], i) => {
    // Filled circle
    ctx.beginPath();
    ctx.arc(vx, vy, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Vertex letter
    ctx.font         = 'bold 14px monospace';
    ctx.fillStyle    = color;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(VERTEX_LABELS[i], vx + VERTEX_OFFSETS[i][0], vy + VERTEX_OFFSETS[i][1]);

    // Angle value
    ctx.font      = '12px monospace';
    ctx.fillStyle = '#374151';
    ctx.fillText(
      `${ANGLE_DEG[i]}°`,
      vx + VERTEX_OFFSETS[i][0] * 2.2,
      vy + VERTEX_OFFSETS[i][1] * 1.8,
    );
  });
  ctx.restore();

  // ── Side labels at edge midpoints ────────────────────────────────────────
  const SIDE_PAIRS: [[number, number], [number, number]][] = [
    [pB, pC],  // a (opposite A)
    [pA, pC],  // b (opposite B)
    [pA, pB],  // c (opposite C)
  ];
  const SIDE_NAMES   = ['a', 'b', 'c'];
  const SIDE_VALS    = [triangle.a, triangle.b, triangle.c];

  ctx.save();
  ctx.font         = '12px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  SIDE_PAIRS.forEach(([p1, p2], i) => {
    const mx = (p1[0] + p2[0]) / 2;
    const my = (p1[1] + p2[1]) / 2;

    // Perpendicular nudge so label doesn't sit on the line
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    const nx = -dy / len * 12;
    const ny =  dx / len * 12;

    ctx.fillStyle = '#D1D5DB';
    ctx.fillText(`${SIDE_NAMES[i]}=${SIDE_VALS[i].toFixed(2)}`, mx + nx, my + ny);
  });
  ctx.restore();
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Render a single triangle centred in the viewport.
 */
export function renderSingleTriangle(
  ctx:      CanvasRenderingContext2D,
  triangle: Triangle,
  viewport: Viewport,
  color:    string = COLORS.primary,
): void {
  const cx = (viewport.xMin + viewport.xMax) / 2;
  const cy = (viewport.yMin + viewport.yMax) / 2;
  const vertices = triangleToCanvas(triangle, viewport, cx, cy);
  renderTriangle(ctx, vertices, triangle, color);
}

/**
 * Render SSA dual solutions side by side.
 * Solution 1 (green) in the left 40%, solution 2 (blue) in the right 40%.
 */
export function renderSSADualSolutions(
  ctx:       CanvasRenderingContext2D,
  triangle1: Triangle,
  triangle2: Triangle,
  viewport:  Viewport,
): void {
  const cy  = (viewport.yMin + viewport.yMax) / 2;
  const cx1 = viewport.xMin + viewport.xRange * 0.28;
  const cx2 = viewport.xMax - viewport.xRange * 0.28;

  // Each triangle gets half the x-range for scale calculation, full viewport for toCanvas
  const halfX = viewport.xRange / 2;
  const v1 = triangleToCanvas(triangle1, viewport, cx1, cy, halfX, viewport.yRange);
  const v2 = triangleToCanvas(triangle2, viewport, cx2, cy, halfX, viewport.yRange);

  // Solution labels
  ctx.save();
  ctx.font      = 'bold 13px monospace';
  ctx.textAlign = 'center';

  ctx.fillStyle = COLORS.triangleSolution1;
  const [t1x] = viewport.toCanvas(cx1, viewport.yMax - viewport.yRange * 0.08);
  ctx.fillText('解 1', t1x, viewport.toCanvas(cx1, viewport.yMax - viewport.yRange * 0.08)[1]);

  ctx.fillStyle = COLORS.triangleSolution2;
  ctx.fillText('解 2', viewport.toCanvas(cx2, viewport.yMax - viewport.yRange * 0.08)[0],
    viewport.toCanvas(cx2, viewport.yMax - viewport.yRange * 0.08)[1]);
  ctx.restore();

  renderTriangle(ctx, v1, triangle1, COLORS.triangleSolution1);
  renderTriangle(ctx, v2, triangle2, COLORS.triangleSolution2);

  // Vertical separator
  ctx.save();
  const [sepX] = viewport.toCanvas((viewport.xMin + viewport.xMax) / 2, 0);
  ctx.strokeStyle = '#3A3A3E';
  ctx.lineWidth   = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(sepX, 0);
  ctx.lineTo(sepX, viewport.height);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
