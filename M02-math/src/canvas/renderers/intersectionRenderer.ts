import type { Viewport } from '@/canvas/Viewport';
import type { FunctionIntersection } from '@/engine/functionIntersection';
import type { FunctionEntry } from '@/types';
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

    ctx.font = '10px monospace';
    const textWidth = ctx.measureText(coordText).width;
    const boxW = textWidth + 12;
    const boxH = 18;
    let boxX = cx + 10;
    let boxY = cy - boxH - 10;

    if (boxX + boxW > viewport.width - 4) boxX = cx - boxW - 10;
    if (boxY < 4) boxY = cy + 10;

    boxX = Math.max(4, Math.min(boxX, viewport.width - boxW - 4));
    boxY = Math.max(4, Math.min(boxY, viewport.height - boxH - 4));

    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    roundRectPath(ctx, boxX, boxY, boxW, boxH, 5);
    ctx.fill();

    ctx.strokeStyle = 'rgba(251,191,36,0.75)';
    ctx.lineWidth = 1;
    roundRectPath(ctx, boxX, boxY, boxW, boxH, 5);
    ctx.stroke();

    ctx.fillStyle = COLORS.textPrimary;
    ctx.textBaseline = 'middle';
    ctx.fillText(coordText, boxX + 6, boxY + boxH / 2);
  });

  ctx.restore();
}
