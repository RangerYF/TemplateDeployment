import type { Viewport } from '@/canvas/Viewport';
import type { FnType, TrigTransform } from '@/types';
import type { M04TrigAnalysisDisplay } from '@/editor/store/m04FunctionStore';
import { COLORS } from '@/styles/colors';

function drawVerticalMarker(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  mathX: number,
  color: string,
) {
  if (mathX < viewport.xMin || mathX > viewport.xMax) return;
  const [cx] = viewport.toCanvas(mathX, 0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.4;
  ctx.setLineDash([6, 5]);
  ctx.beginPath();
  ctx.moveTo(cx, 0);
  ctx.lineTo(cx, viewport.height);
  ctx.stroke();
  ctx.restore();
}

function drawPointMarker(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  mathX: number,
  mathY: number,
  color: string,
) {
  if (
    mathX < viewport.xMin || mathX > viewport.xMax ||
    mathY < viewport.yMin || mathY > viewport.yMax
  ) return;
  const [cx, cy] = viewport.toCanvas(mathX, mathY);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function renderTrigAnalysisOverlay(
  ctx: CanvasRenderingContext2D,
  viewport: Viewport,
  fnType: FnType,
  transform: TrigTransform,
  display: M04TrigAnalysisDisplay,
) {
  if (fnType === 'tan') {
    const centerX = -transform.phi / transform.omega;
    if (display.showSymmetryCenters) {
      drawPointMarker(ctx, viewport, centerX, transform.k, COLORS.angleArc);
    }
    if (display.showZeros && Math.abs(transform.k) < 1e-10) {
      const period = Math.PI / transform.omega;
      for (let n = -6; n <= 6; n++) {
        drawPointMarker(ctx, viewport, centerX + n * period, 0, COLORS.primary);
      }
    }
    return;
  }

  const period = (2 * Math.PI) / transform.omega;
  const zeroBase = fnType === 'sin'
    ? -transform.phi / transform.omega
    : (Math.PI / 2 - transform.phi) / transform.omega;
  const centerBase = fnType === 'sin'
    ? -transform.phi / transform.omega
    : (Math.PI / 2 - transform.phi) / transform.omega;
  const axis1 = fnType === 'sin'
    ? (Math.PI / 2 - transform.phi) / transform.omega
    : -transform.phi / transform.omega;
  const axis2 = fnType === 'sin'
    ? (3 * Math.PI / 2 - transform.phi) / transform.omega
    : (Math.PI - transform.phi) / transform.omega;

  if (display.showZeros && Math.abs(transform.k) < 1e-10) {
    for (let n = -6; n <= 6; n++) {
      const x = zeroBase + n * period / 2;
      drawPointMarker(ctx, viewport, x, 0, COLORS.primary);
    }
  }

  if (display.showSymmetryAxes) {
    for (let n = -4; n <= 4; n++) {
      drawVerticalMarker(ctx, viewport, axis1 + n * period, COLORS.sinColor);
      drawVerticalMarker(ctx, viewport, axis2 + n * period, COLORS.tanColor);
    }
  }

  if (display.showSymmetryCenters) {
    for (let n = -4; n <= 4; n++) {
      drawPointMarker(ctx, viewport, centerBase + n * period / 2, transform.k, COLORS.angleArc);
    }
  }
}
