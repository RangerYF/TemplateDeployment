/**
 * triangleRenderer — M04 Phase 5
 *
 * Renders a triangle (or two triangles for SSA dual solutions) onto a Canvas 2D context.
 *
 * Coordinate strategy:
 *   Local triangle: A at origin, B along +x, C above AB.
 *   Rendered in true math units so side lengths match the visible grid.
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
import { formatExactOnly } from '@/engine/triangleDisplay';
import type { TriangleAuxiliaryOptions } from '@/editor/store/triangleSolverStore';

// ─── Constants ────────────────────────────────────────────────────────────────

const R2D = 180 / Math.PI;

// ─── Triangle → canvas vertices ───────────────────────────────────────────────

/**
 * Compute canvas-pixel vertices [A, B, C] for a triangle centred at (cx, cy)
 * in math coordinates. Side lengths are not display-scaled.
 */
function triangleToCanvas(
  triangle: Triangle,
  viewport: Viewport,
  cx: number,
  cy: number,
): [number, number][] {
  const { b, c, A } = triangle;

  // Local coordinates: A at origin, c along +x axis
  const Ax = 0, Ay = 0;
  const Bx = c,  By = 0;
  const Cx = b * Math.cos(A);
  const Cy = b * Math.sin(A);

  // Centroid of local triangle
  const gx = (Ax + Bx + Cx) / 3;
  const gy = (Ay + By + Cy) / 3;

  // Transform to math coords (centred at cx, cy)
  function toMath(lx: number, ly: number): [number, number] {
    return [cx + (lx - gx), cy + (ly - gy)];
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

function midpoint(p1: [number, number], p2: [number, number]): [number, number] {
  return [(p1[0] + p2[0]) / 2, (p1[1] + p2[1]) / 2];
}

function normalize(vx: number, vy: number): [number, number] {
  const len = Math.sqrt(vx * vx + vy * vy) || 1;
  return [vx / len, vy / len];
}

function renderAuxiliaryLines(
  ctx: CanvasRenderingContext2D,
  vertices: [number, number][],
  options: TriangleAuxiliaryOptions,
): void {
  const [A, B, C] = vertices;
  const sideMidpoints: [[number, number], [number, number], [number, number]] = [
    midpoint(B, C),
    midpoint(A, C),
    midpoint(A, B),
  ];

  ctx.save();
  ctx.lineWidth = 1.6;

  if (options.showMedians) {
    ctx.strokeStyle = 'rgba(59,130,246,0.85)';
    ctx.setLineDash([6, 4]);
    [A, B, C].forEach((vertex, i) => {
      const m = sideMidpoints[i];
      ctx.beginPath();
      ctx.moveTo(vertex[0], vertex[1]);
      ctx.lineTo(m[0], m[1]);
      ctx.stroke();
    });
  }

  if (options.showAltitudes) {
    ctx.strokeStyle = 'rgba(239,68,68,0.8)';
    ctx.setLineDash([4, 4]);
    const feet = [
      projectPointToLine(A, B, C),
      projectPointToLine(B, A, C),
      projectPointToLine(C, A, B),
    ];
    [A, B, C].forEach((vertex, i) => {
      const foot = feet[i];
      ctx.beginPath();
      ctx.moveTo(vertex[0], vertex[1]);
      ctx.lineTo(foot[0], foot[1]);
      ctx.stroke();
    });
  }

  if (options.showAngleBisectors) {
    ctx.strokeStyle = 'rgba(34,197,94,0.85)';
    ctx.setLineDash([2, 4]);
    const bisectorTargets = [
      angleBisectorPoint(A, B, C),
      angleBisectorPoint(B, A, C),
      angleBisectorPoint(C, A, B),
    ];
    [A, B, C].forEach((vertex, i) => {
      const target = bisectorTargets[i];
      ctx.beginPath();
      ctx.moveTo(vertex[0], vertex[1]);
      ctx.lineTo(target[0], target[1]);
      ctx.stroke();
    });
  }

  if (options.showPerpBisectors) {
    ctx.strokeStyle = 'rgba(168,85,247,0.85)';
    ctx.setLineDash([8, 5]);
    [[A, B], [A, C], [B, C]].forEach(([p1, p2]) => {
      const mid = midpoint(p1, p2);
      const [nx, ny] = normalize(-(p2[1] - p1[1]), p2[0] - p1[0]);
      const ext = 120;
      ctx.beginPath();
      ctx.moveTo(mid[0] - nx * ext, mid[1] - ny * ext);
      ctx.lineTo(mid[0] + nx * ext, mid[1] + ny * ext);
      ctx.stroke();
    });
  }

  ctx.restore();
}

function circumcenter(
  A: [number, number],
  B: [number, number],
  C: [number, number],
): [number, number] | null {
  const d = 2 * (A[0] * (B[1] - C[1]) + B[0] * (C[1] - A[1]) + C[0] * (A[1] - B[1]));
  if (Math.abs(d) < 1e-10) return null;
  const ux = (
    (A[0] * A[0] + A[1] * A[1]) * (B[1] - C[1]) +
    (B[0] * B[0] + B[1] * B[1]) * (C[1] - A[1]) +
    (C[0] * C[0] + C[1] * C[1]) * (A[1] - B[1])
  ) / d;
  const uy = (
    (A[0] * A[0] + A[1] * A[1]) * (C[0] - B[0]) +
    (B[0] * B[0] + B[1] * B[1]) * (A[0] - C[0]) +
    (C[0] * C[0] + C[1] * C[1]) * (B[0] - A[0])
  ) / d;
  return [ux, uy];
}

function renderCenters(
  ctx: CanvasRenderingContext2D,
  vertices: [number, number][],
  options: TriangleAuxiliaryOptions,
): void {
  const [A, B, C] = vertices;
  ctx.save();

  if (options.showCentroid) {
    const gx = (A[0] + B[0] + C[0]) / 3;
    const gy = (A[1] + B[1] + C[1]) / 3;
    ctx.beginPath();
    ctx.arc(gx, gy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#F59E0B';
    ctx.fill();
    ctx.strokeStyle = '#FFFFFF';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 12px monospace';
    ctx.fillStyle = '#F59E0B';
    ctx.fillText('G', gx + 10, gy - 8);
  }

  if (options.showCircumcenter) {
    const center = circumcenter(A, B, C);
    if (center) {
      ctx.beginPath();
      ctx.arc(center[0], center[1], 5, 0, Math.PI * 2);
      ctx.fillStyle = '#A855F7';
      ctx.fill();
      ctx.strokeStyle = '#FFFFFF';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.font = 'bold 12px monospace';
      ctx.fillStyle = '#A855F7';
      ctx.fillText('O', center[0] + 10, center[1] - 8);
    }
  }

  ctx.restore();
}

function projectPointToLine(
  point: [number, number],
  lineA: [number, number],
  lineB: [number, number],
): [number, number] {
  const [px, py] = point;
  const [ax, ay] = lineA;
  const [bx, by] = lineB;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy || 1;
  const t = ((px - ax) * dx + (py - ay) * dy) / len2;
  return [ax + t * dx, ay + t * dy];
}

function angleBisectorPoint(
  vertex: [number, number],
  p1: [number, number],
  p2: [number, number],
): [number, number] {
  const [ux, uy] = normalize(p1[0] - vertex[0], p1[1] - vertex[1]);
  const [vx, vy] = normalize(p2[0] - vertex[0], p2[1] - vertex[1]);
  const [bx, by] = normalize(ux + vx, uy + vy);
  return [vertex[0] + bx * 90, vertex[1] + by * 90];
}

// ─── Annotation rendering ─────────────────────────────────────────────────────

function renderTriangle(
  ctx: CanvasRenderingContext2D,
  vertices: [number, number][],
  triangle: Triangle,
  color: string,
  viewport?: Viewport,
  auxiliaryOptions?: TriangleAuxiliaryOptions,
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

  if (auxiliaryOptions) {
    renderAuxiliaryLines(ctx, vertices, auxiliaryOptions);
    renderCenters(ctx, vertices, auxiliaryOptions);
  }

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
  ctx.font         = 'bold 13px monospace';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  SIDE_PAIRS.forEach(([p1, p2], i) => {
    const mx = (p1[0] + p2[0]) / 2;
    const my = (p1[1] + p2[1]) / 2;

    // Perpendicular nudge so label doesn't sit on the line
    const dx = p2[0] - p1[0];
    const dy = p2[1] - p1[1];
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    let nx = -dy / len;
    let ny =  dx / len;

    const centroidX = (pA[0] + pB[0] + pC[0]) / 3;
    const centroidY = (pA[1] + pB[1] + pC[1]) / 3;
    const dotToCentroid = nx * (centroidX - mx) + ny * (centroidY - my);
    if (dotToCentroid > 0) {
      nx = -nx;
      ny = -ny;
    }

    let offset = 16;
    if (viewport) {
      const axisX = viewport.toCanvas(0, 0)[0];
      const axisY = viewport.toCanvas(0, 0)[1];
      if (Math.abs(mx - axisX) < 36) offset += 10;
      if (Math.abs(my - axisY) < 24) offset += 10;
      if (mx < 42 || mx > viewport.width - 42) offset += 8;
      if (my < 28 || my > viewport.height - 28) offset += 8;
    }

    const label = `${SIDE_NAMES[i]}=${formatExactOnly(SIDE_VALS[i])}`;
    const lx = mx + nx * offset;
    const ly = my + ny * offset;
    const textW = ctx.measureText(label).width;
    const boxW = textW + 10;
    const boxH = 18;

    ctx.fillStyle = 'rgba(17, 24, 39, 0.72)';
    ctx.beginPath();
    ctx.roundRect(lx - boxW / 2, ly - boxH / 2, boxW, boxH, 6);
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, lx, ly);

    ctx.fillStyle = '#F9FAFB';
    ctx.fillText(label, lx, ly);
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
  auxiliaryOptions?: TriangleAuxiliaryOptions,
): void {
  const cx = (viewport.xMin + viewport.xMax) / 2;
  const cy = (viewport.yMin + viewport.yMax) / 2;
  const vertices = triangleToCanvas(triangle, viewport, cx, cy);
  renderTriangle(ctx, vertices, triangle, color, viewport, auxiliaryOptions);
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
  auxiliaryOptions?: TriangleAuxiliaryOptions,
): void {
  const cy  = (viewport.yMin + viewport.yMax) / 2;
  const cx1 = viewport.xMin + viewport.xRange * 0.28;
  const cx2 = viewport.xMax - viewport.xRange * 0.28;

  const v1 = triangleToCanvas(triangle1, viewport, cx1, cy);
  const v2 = triangleToCanvas(triangle2, viewport, cx2, cy);

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

  renderTriangle(ctx, v1, triangle1, COLORS.triangleSolution1, viewport, auxiliaryOptions);
  renderTriangle(ctx, v2, triangle2, COLORS.triangleSolution2, viewport, auxiliaryOptions);

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

export function renderRangeDemoTriangle(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  sideLength: number,
  angleDeg: number,
  sampleRatio: number,
): void {
  const baseY = viewport.height * 0.72;
  const leftX = viewport.width * 0.2;
  const rightX = viewport.width * 0.8;
  const apexX = leftX + (rightX - leftX) * sampleRatio;
  const apexY = baseY - Math.tan((angleDeg * Math.PI) / 180) * (apexX - leftX);
  const apexEndY = baseY - Math.tan((angleDeg * Math.PI) / 180) * (rightX - leftX);

  ctx.save();

  // Base side (fixed side)
  ctx.strokeStyle = 'rgba(59,130,246,0.9)';
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(leftX, baseY);
  ctx.lineTo(rightX, baseY);
  ctx.stroke();

  // Feasible region rays from left endpoint at the given angle
  ctx.strokeStyle = 'rgba(34,197,94,0.8)';
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(leftX, baseY);
  ctx.lineTo(viewport.width - 20, baseY - Math.tan((angleDeg * Math.PI) / 180) * (viewport.width - 20 - leftX));
  ctx.stroke();
  ctx.setLineDash([]);

  // Candidate triangles along the feasible range
  ctx.strokeStyle = 'rgba(34,197,94,0.28)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i <= 8; i++) {
    const t = 0.1 + i * 0.1;
    const tx = leftX + (rightX - leftX) * t;
    const ty = baseY - Math.tan((angleDeg * Math.PI) / 180) * (tx - leftX);
    ctx.beginPath();
    ctx.moveTo(leftX, baseY);
    ctx.lineTo(rightX, baseY);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.stroke();
  }

  // Example triangle
  ctx.strokeStyle = COLORS.primary;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(leftX, baseY);
  ctx.lineTo(rightX, baseY);
  ctx.lineTo(apexX, apexY);
  ctx.closePath();
  ctx.stroke();
  ctx.fillStyle = `${COLORS.primary}18`;
  ctx.fill();

  ctx.fillStyle = '#F9FAFB';
  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'left';
  ctx.fillText(`已知边 = ${sideLength.toFixed(1)}`, leftX, baseY + 22);
  ctx.fillText(`已知角 = ${angleDeg.toFixed(1)}°`, leftX, baseY + 40);
  ctx.fillText('浅绿色三角形表示该条件下的候选范围', leftX, 28);
  ctx.fillText('蓝绿色高亮为当前示意位置', leftX, 46);

  // Arc marker for the known angle
  ctx.strokeStyle = COLORS.warning;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(leftX, baseY, 26, -Math.PI / 2, -Math.PI / 2 + (angleDeg * Math.PI) / 180, false);
  ctx.stroke();

  // Apex locus hint
  ctx.strokeStyle = 'rgba(34,197,94,0.55)';
  ctx.lineWidth = 2;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(leftX, baseY);
  ctx.lineTo(rightX, apexEndY);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(leftX, baseY, 6, 0, Math.PI * 2);
  ctx.arc(rightX, baseY, 6, 0, Math.PI * 2);
  ctx.arc(apexX, apexY, 6, 0, Math.PI * 2);
  ctx.fillStyle = COLORS.primary;
  ctx.fill();

  ctx.restore();
}
