import type { Viewport } from '@/canvas/Viewport';
import type { FunctionIntersection } from '@/engine/functionIntersection';
import type { FunctionEntry } from '@/types';
import { LabelPlacer } from '@/canvas/renderers/labelStrategy';
import { COLORS } from '@/styles/colors';

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function formatCoord(value: number): string {
  if (Math.abs(value) < 1e-6) return '0';
  const roundedInt = Math.round(value);
  if (Math.abs(value - roundedInt) < 1e-4) return String(roundedInt);
  return String(Number(value.toFixed(2)));
}

function drawHalfRing(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color1: string,
  color2: string,
): void {
  ctx.save();
  ctx.lineWidth = 3;

  ctx.strokeStyle = color1;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI, 0);
  ctx.stroke();

  ctx.strokeStyle = color2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI);
  ctx.stroke();

  ctx.restore();
}

export function renderIntersections(
  ctx: CanvasRenderingContext2D,
  intersections: FunctionIntersection[],
  functions: FunctionEntry[],
  viewport: Viewport,
): void {
  ctx.save();
  const placer = new LabelPlacer(viewport.width, viewport.height);

  intersections.forEach((intersection, index) => {
    if (
      intersection.mathX < viewport.xMin ||
      intersection.mathX > viewport.xMax ||
      intersection.mathY < viewport.yMin ||
      intersection.mathY > viewport.yMax
    ) {
      return;
    }

    const fn1 = functions.find((fn) => fn.id === intersection.fnId1);
    const fn2 = functions.find((fn) => fn.id === intersection.fnId2);
    const [cx, cy] = viewport.toCanvas(intersection.mathX, intersection.mathY);

    drawHalfRing(ctx, cx, cy, 7, fn1?.color ?? COLORS.warning, fn2?.color ?? COLORS.warning);
    placer.reserve(cx, cy, 11, 11);

    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.beginPath();
    ctx.arc(cx, cy, 4.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = COLORS.warning;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy);
    ctx.lineTo(cx + 4, cy);
    ctx.moveTo(cx, cy - 4);
    ctx.lineTo(cx, cy + 4);
    ctx.stroke();

    const label = `X${index + 1}`;
    const coordText = `${label} (${formatCoord(intersection.mathX)}, ${formatCoord(intersection.mathY)})`;

    ctx.font = '700 11px monospace';
    const textWidth = ctx.measureText(coordText).width;
    const boxW = textWidth + 16;
    const boxH = 22;
    const placed = placer.place({
      text: coordText,
      anchorX: cx,
      anchorY: cy,
      textWidth: boxW,
      textHeight: boxH,
      offset: 16,
      preferredDir: index % 2 === 0 ? 1 : 7,
    });
    const centerX = placed?.x ?? Math.min(Math.max(cx + boxW / 2 + 16, boxW / 2 + 6), viewport.width - boxW / 2 - 6);
    const centerY = placed?.y ?? Math.min(Math.max(cy - boxH / 2 - 16, boxH / 2 + 6), viewport.height - boxH / 2 - 6);
    const boxX = centerX - boxW / 2;
    const boxY = centerY - boxH / 2;

    ctx.fillStyle = 'rgba(17,24,39,0.94)';
    roundRectPath(ctx, boxX, boxY, boxW, boxH, 7);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251,191,36,0.95)';
    ctx.lineWidth = 1.4;
    roundRectPath(ctx, boxX, boxY, boxW, boxH, 5);
    ctx.stroke();

    ctx.fillStyle = '#F9FAFB';
    ctx.textBaseline = 'middle';
    ctx.fillText(coordText, boxX + 8, boxY + boxH / 2);

    ctx.strokeStyle = 'rgba(251,191,36,0.65)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    const leaderX = centerX + (centerX >= cx ? -boxW / 2 + 4 : boxW / 2 - 4);
    const leaderY = centerY + (centerY >= cy ? -boxH / 2 + 4 : boxH / 2 - 4);
    ctx.lineTo(leaderX, leaderY);
    ctx.stroke();
  });

  ctx.restore();
}
