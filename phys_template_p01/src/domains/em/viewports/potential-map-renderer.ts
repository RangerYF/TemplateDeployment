import type { CoordinateTransform, Vec2 } from '@/core/types';
import { worldToScreen } from '@/renderer/coordinate';
import { computePotentialAtPoint } from '@/domains/em/logic/electric-field-observables';

interface PointChargeForPotentialMap {
  id: string;
  position: Vec2;
  charge: number;
  radius?: number;
}

interface PotentialMapLegendState {
  clipPotential: number;
  stretchPotential: number;
}

interface PotentialMapCacheState {
  key: string;
  canvas: HTMLCanvasElement | null;
  legend: PotentialMapLegendState;
}

const SAMPLE_STEP_PX = 7;
const MIN_SAMPLE_COLUMNS = 72;
const MAX_SAMPLE_COLUMNS = 180;
const MIN_SAMPLE_ROWS = 48;
const MAX_SAMPLE_ROWS = 128;
const HOLE_PADDING_PX = 14;
const LEGEND_BOX_WIDTH = 192;
const LEGEND_BOX_HEIGHT = 54;
const LEGEND_BAR_HEIGHT = 10;

let potentialMapCache: PotentialMapCacheState = {
  key: '',
  canvas: null,
  legend: {
    clipPotential: 1,
    stretchPotential: 1,
  },
};

export function renderPotentialMap(
  canvasContext: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  coordinateTransform: CoordinateTransform,
  charges: PointChargeForPotentialMap[],
  options?: {
    showFieldLines?: boolean;
    showEquipotentialLines?: boolean;
  },
): void {
  if (charges.length === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = canvas.clientWidth || canvas.width / dpr;
  const canvasHeight = canvas.clientHeight || canvas.height / dpr;
  if (canvasWidth <= 0 || canvasHeight <= 0) return;

  const bounds = {
    minX: -coordinateTransform.origin.x / coordinateTransform.scale,
    maxX: (canvasWidth - coordinateTransform.origin.x) / coordinateTransform.scale,
    minY: -(canvasHeight - coordinateTransform.origin.y) / coordinateTransform.scale,
    maxY: coordinateTransform.origin.y / coordinateTransform.scale,
  };

  const columns = clamp(
    Math.round(canvasWidth / SAMPLE_STEP_PX),
    MIN_SAMPLE_COLUMNS,
    MAX_SAMPLE_COLUMNS,
  );
  const rows = clamp(
    Math.round(canvasHeight / SAMPLE_STEP_PX),
    MIN_SAMPLE_ROWS,
    MAX_SAMPLE_ROWS,
  );

  const cacheKey = `${buildChargeKey(charges)}|${buildBoundsKey(bounds)}|${columns}x${rows}`;
  if (cacheKey !== potentialMapCache.key) {
    potentialMapCache = {
      key: cacheKey,
      ...buildPotentialMapCache(charges, bounds, columns, rows),
    };
  }

  if (!potentialMapCache.canvas) return;

  const overlayAlpha = options?.showFieldLines || options?.showEquipotentialLines ? 0.76 : 0.86;

  canvasContext.save();
  canvasContext.globalAlpha = overlayAlpha;
  canvasContext.imageSmoothingEnabled = true;
  clipAroundCharges(canvasContext, charges, coordinateTransform, canvasWidth, canvasHeight);
  canvasContext.drawImage(potentialMapCache.canvas, 0, 0, canvasWidth, canvasHeight);
  canvasContext.restore();

  drawPotentialLegend(
    canvasContext,
    canvasWidth,
    canvasHeight,
    potentialMapCache.legend,
  );
}

function buildPotentialMapCache(
  charges: PointChargeForPotentialMap[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  columns: number,
  rows: number,
): { canvas: HTMLCanvasElement | null; legend: PotentialMapLegendState } {
  const sampleValues = new Float32Array(columns * rows);
  sampleValues.fill(Number.NaN);
  const finiteAbsValues: number[] = [];

  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;

  for (let row = 0; row < rows; row += 1) {
    const worldY = bounds.maxY - ((row + 0.5) / rows) * height;
    for (let col = 0; col < columns; col += 1) {
      const worldX = bounds.minX + ((col + 0.5) / columns) * width;
      const potential = computePotentialAtPoint({ x: worldX, y: worldY }, charges);
      const index = row * columns + col;
      sampleValues[index] = potential;
      if (Number.isFinite(potential)) {
        finiteAbsValues.push(Math.abs(potential));
      }
    }
  }

  if (finiteAbsValues.length === 0) {
    return {
      canvas: null,
      legend: { clipPotential: 1, stretchPotential: 1 },
    };
  }

  finiteAbsValues.sort((a, b) => a - b);
  const clipPotential = Math.max(quantile(finiteAbsValues, 0.9), 1);
  const stretchPotential = Math.max(
    quantile(finiteAbsValues, 0.55),
    clipPotential * 0.14,
    1e-6,
  );
  const normalizer = Math.asinh(clipPotential / stretchPotential) || 1;

  const heatmapCanvas = document.createElement('canvas');
  heatmapCanvas.width = columns;
  heatmapCanvas.height = rows;
  const heatmapContext = heatmapCanvas.getContext('2d');
  if (!heatmapContext) {
    return {
      canvas: null,
      legend: { clipPotential, stretchPotential },
    };
  }

  const imageData = heatmapContext.createImageData(columns, rows);
  for (let index = 0; index < sampleValues.length; index += 1) {
    const offset = index * 4;
    const value = sampleValues[index] ?? Number.NaN;

    if (!Number.isFinite(value)) {
      imageData.data[offset + 3] = 0;
      continue;
    }

    const normalized = Math.asinh(clampNumber(value, -clipPotential, clipPotential) / stretchPotential) / normalizer;
    const color = colorForNormalizedPotential(normalized);
    imageData.data[offset] = color.r;
    imageData.data[offset + 1] = color.g;
    imageData.data[offset + 2] = color.b;
    imageData.data[offset + 3] = Math.round(color.a * 255);
  }

  heatmapContext.putImageData(imageData, 0, 0);

  return {
    canvas: heatmapCanvas,
    legend: { clipPotential, stretchPotential },
  };
}

function clipAroundCharges(
  canvasContext: CanvasRenderingContext2D,
  charges: PointChargeForPotentialMap[],
  coordinateTransform: CoordinateTransform,
  canvasWidth: number,
  canvasHeight: number,
): void {
  canvasContext.beginPath();
  canvasContext.rect(0, 0, canvasWidth, canvasHeight);

  for (const charge of charges) {
    const screenPosition = worldToScreen(charge.position, coordinateTransform);
    const radiusPx = Math.max(
      ((charge.radius ?? 0.12) * coordinateTransform.scale) + HOLE_PADDING_PX,
      18,
    );
    canvasContext.moveTo(screenPosition.x + radiusPx, screenPosition.y);
    canvasContext.arc(screenPosition.x, screenPosition.y, radiusPx, 0, Math.PI * 2);
  }

  canvasContext.clip('evenodd');
}

function drawPotentialLegend(
  canvasContext: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  legend: PotentialMapLegendState,
): void {
  const x = Math.max(8, Math.min(16, canvasWidth - LEGEND_BOX_WIDTH - 8));
  const y = Math.max(16, canvasHeight - LEGEND_BOX_HEIGHT - 16);
  const title = '电势分布 V（相对色标）';
  const subtitle = '红/橙：正电势高   蓝：负电势低';

  canvasContext.save();
  canvasContext.fillStyle = 'rgba(255, 255, 255, 0.92)';
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.32)';
  canvasContext.lineWidth = 1;
  roundRect(canvasContext, x, y, LEGEND_BOX_WIDTH, LEGEND_BOX_HEIGHT, 12);
  canvasContext.fill();
  canvasContext.stroke();

  canvasContext.fillStyle = '#0F172A';
  canvasContext.font = '600 11px Inter, sans-serif';
  canvasContext.textAlign = 'left';
  canvasContext.textBaseline = 'top';
  canvasContext.fillText(title, x + 10, y + 8);

  canvasContext.fillStyle = '#64748B';
  canvasContext.font = '10px Inter, sans-serif';
  canvasContext.fillText(subtitle, x + 10, y + 22);

  const barX = x + 10;
  const barY = y + 38;
  const barWidth = LEGEND_BOX_WIDTH - 20;
  const gradient = canvasContext.createLinearGradient(barX, barY, barX + barWidth, barY);
  gradient.addColorStop(0, gradientColor(-1));
  gradient.addColorStop(0.5, gradientColor(0));
  gradient.addColorStop(1, gradientColor(1));
  canvasContext.fillStyle = gradient;
  roundRect(canvasContext, barX, barY, barWidth, LEGEND_BAR_HEIGHT, 999);
  canvasContext.fill();

  canvasContext.fillStyle = '#475569';
  canvasContext.font = '10px Inter, sans-serif';
  canvasContext.textBaseline = 'alphabetic';
  canvasContext.fillText(`-${formatLegendValue(legend.clipPotential)}`, barX, barY - 2);
  canvasContext.textAlign = 'center';
  canvasContext.fillText('0', barX + barWidth / 2, barY - 2);
  canvasContext.textAlign = 'right';
  canvasContext.fillText(`+${formatLegendValue(legend.clipPotential)}`, barX + barWidth, barY - 2);
  canvasContext.restore();
}

function colorForNormalizedPotential(normalized: number): {
  r: number;
  g: number;
  b: number;
  a: number;
} {
  const clamped = clampNumber(normalized, -1, 1);
  if (Math.abs(clamped) < 1e-6) {
    return { r: 248, g: 250, b: 252, a: 0.12 };
  }

  if (clamped > 0) {
    return {
      r: Math.round(lerp(255, 214, clamped)),
      g: Math.round(lerp(245, 69, clamped)),
      b: Math.round(lerp(235, 65, clamped)),
      a: lerp(0.18, 0.92, Math.pow(clamped, 0.78)),
    };
  }

  const magnitude = Math.abs(clamped);
  return {
    r: Math.round(lerp(239, 26, magnitude)),
    g: Math.round(lerp(246, 86, magnitude)),
    b: Math.round(lerp(255, 219, magnitude)),
    a: lerp(0.18, 0.92, Math.pow(magnitude, 0.78)),
  };
}

function gradientColor(normalized: number): string {
  const color = colorForNormalizedPotential(normalized);
  return `rgba(${color.r}, ${color.g}, ${color.b}, 1)`;
}

function buildChargeKey(charges: PointChargeForPotentialMap[]): string {
  return charges
    .map((charge) => [
      charge.id,
      charge.position.x.toFixed(4),
      charge.position.y.toFixed(4),
      charge.charge.toFixed(6),
      (charge.radius ?? 0).toFixed(4),
    ].join(':'))
    .join('|');
}

function buildBoundsKey(bounds: { minX: number; maxX: number; minY: number; maxY: number }): string {
  return [
    bounds.minX.toFixed(4),
    bounds.maxX.toFixed(4),
    bounds.minY.toFixed(4),
    bounds.maxY.toFixed(4),
  ].join(',');
}

function roundRect(
  canvasContext: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  canvasContext.beginPath();
  canvasContext.moveTo(x + r, y);
  canvasContext.arcTo(x + width, y, x + width, y + height, r);
  canvasContext.arcTo(x + width, y + height, x, y + height, r);
  canvasContext.arcTo(x, y + height, x, y, r);
  canvasContext.arcTo(x, y, x + width, y, r);
  canvasContext.closePath();
}

function quantile(sortedValues: number[], ratio: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(
    sortedValues.length - 1,
    Math.max(0, Math.floor((sortedValues.length - 1) * ratio)),
  );
  return sortedValues[index] ?? 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function formatLegendValue(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value >= 1e4 || (value > 0 && value < 1e-2)) {
    return value.toExponential(1);
  }
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}
