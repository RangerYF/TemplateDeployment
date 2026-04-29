import type { Viewport } from '@/canvas/Viewport';
import type { FunctionEntry, PiecewiseSegment } from '@/types';
import { compileExpression, isParseError, evaluateAt } from '@/engine/expressionEngine';
import { evaluateStandard, getNumericalDerivative } from '@/engine/sampler';
import { COLORS } from '@/styles/colors';

type FeatureMarkerType = 'zero' | 'localMax' | 'localMin';

interface FeatureMarker {
  x: number;
  y: number;
  type: FeatureMarkerType;
}

const FEATURE_SCAN_STEPS = 600;
const FEATURE_EPSILON = 1e-7;

function bisectZero(fn: (x: number) => number | null, left: number, right: number): number {
  let lo = left;
  let hi = right;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    const loValue = fn(lo);
    const midValue = fn(mid);
    if (loValue === null || midValue === null) break;
    if (loValue * midValue <= 0) hi = mid;
    else lo = mid;
  }
  return (lo + hi) / 2;
}

function isDuplicate(markers: FeatureMarker[], x: number, tolerance: number): boolean {
  return markers.some((marker) => Math.abs(marker.x - x) < tolerance);
}

function scanStandardFeatureMarkers(fn: FunctionEntry, viewport: Viewport): FeatureMarker[] {
  const markers: FeatureMarker[] = [];
  const dx = (viewport.xMax - viewport.xMin) / FEATURE_SCAN_STEPS;
  const valueAt = (x: number) => evaluateStandard(fn, x);
  const derivativeAt = (x: number) => getNumericalDerivative(fn, x);

  let prevX = viewport.xMin;
  let prevY = valueAt(prevX);
  let prevD = derivativeAt(prevX);

  for (let i = 1; i <= FEATURE_SCAN_STEPS; i++) {
    const x = viewport.xMin + i * dx;
    const y = valueAt(x);
    const d = derivativeAt(x);

    if (prevY !== null && y !== null && Number.isFinite(prevY) && Number.isFinite(y)) {
      if (prevY * y < 0) {
        const zeroX = bisectZero(valueAt, prevX, x);
        if (!isDuplicate(markers, zeroX, dx * 2)) {
          markers.push({ x: zeroX, y: 0, type: 'zero' });
        }
      } else if (Math.abs(y) < FEATURE_EPSILON && !isDuplicate(markers, x, dx * 2)) {
        markers.push({ x, y: 0, type: 'zero' });
      }
    }

    if (prevD !== null && d !== null && Number.isFinite(prevD) && Number.isFinite(d) && prevD * d < 0) {
      const extremumX = bisectZero(derivativeAt, prevX, x);
      const extremumY = valueAt(extremumX);
      if (extremumY !== null && Number.isFinite(extremumY) && !isDuplicate(markers, extremumX, dx * 2)) {
        markers.push({
          x: extremumX,
          y: extremumY,
          type: prevD > 0 ? 'localMax' : 'localMin',
        });
      }
    }

    prevX = x;
    prevY = y;
    prevD = d;
  }

  return markers
    .filter((marker) => marker.y >= viewport.yMin && marker.y <= viewport.yMax)
    .sort((a, b) => a.x - b.x);
}

function featureLabel(type: FeatureMarkerType): string {
  if (type === 'zero') return '零点';
  return type === 'localMax' ? '极大' : '极小';
}

function renderFeatureMarker(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  marker: FeatureMarker,
  color: string,
): void {
  const [cx, cy] = viewport.toCanvas(marker.x, marker.y);

  ctx.save();
  ctx.fillStyle = COLORS.surface;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';
  ctx.fillText(featureLabel(marker.type), cx + 8, cy - 5);

  ctx.font = '10px monospace';
  ctx.textBaseline = 'top';
  ctx.fillStyle = COLORS.textSecondary;
  ctx.fillText(`(${marker.x.toFixed(2)}, ${marker.y.toFixed(2)})`, cx + 8, cy + 4);
  ctx.restore();
}

/**
 * Render the endpoints of a single piecewise segment.
 *
 * Left endpoint  (xMin):
 *   - inclusive  → filled circle ●  (radius 4px, filled with color)
 *   - exclusive  → hollow circle ○  (radius 4px, stroke color, interior filled with COLORS.surface)
 *
 * Right endpoint (xMax):
 *   - same rules
 *
 * Endpoints at ±∞ (null) are skipped.
 * Endpoints outside the viewport x-range are skipped.
 * Endpoints whose y-value cannot be evaluated are skipped.
 */
export function renderSegmentEndpoints(
  ctx: CanvasRenderingContext2D,
  segment: PiecewiseSegment,
  viewport: Viewport,
  color: string,
): void {
  const compiled = compileExpression(segment.exprStr);
  if (isParseError(compiled)) return;

  const { xMin, xMax, xMinInclusive, xMaxInclusive } = segment.domain;

  const endpoints: Array<{ mathX: number; inclusive: boolean }> = [];
  if (xMin !== null) endpoints.push({ mathX: xMin, inclusive: xMinInclusive });
  if (xMax !== null) endpoints.push({ mathX: xMax, inclusive: xMaxInclusive });

  for (const { mathX, inclusive } of endpoints) {
    // Skip endpoints outside the visible viewport
    if (mathX < viewport.xMin || mathX > viewport.xMax) continue;

    const y = evaluateAt(compiled, mathX);
    if (!isFinite(y)) continue;
    if (y < viewport.yMin || y > viewport.yMax) continue;

    const [cx, cy] = viewport.toCanvas(mathX, y);
    const R = 4;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);

    if (inclusive) {
      // ● filled circle
      ctx.fillStyle = color;
      ctx.fill();
    } else {
      // ○ hollow circle
      ctx.fillStyle = COLORS.surface;
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    }
    ctx.restore();
  }
}

export function renderFeaturePoints(
  ctx: CanvasRenderingContext2D,
  functions: FunctionEntry[],
  viewport: Viewport,
): void {
  for (const fn of functions) {
    if (!fn.visible || fn.mode !== 'standard') continue;
    for (const marker of scanStandardFeatureMarkers(fn, viewport)) {
      renderFeatureMarker(ctx, viewport, marker, fn.color);
    }
  }
}
