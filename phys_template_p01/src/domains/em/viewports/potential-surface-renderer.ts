import type { CoordinateTransform, Vec2 } from '@/core/types';
import { COULOMB_CONSTANT } from '@/domains/em/logic/electric-field-observables';

interface PointChargeForPotentialSurface {
  id: string;
  position: Vec2;
  charge: number;
  radius?: number;
}

interface PotentialSurfaceCacheState {
  key: string;
  columns: number;
  rows: number;
  normalizedSamples: Float32Array;
  legendPotential: number;
  peakPotential: number;
  stretchPotential: number;
  heightExponent: number;
  softeningDistance: number;
  positivePeakCount: number;
  negativePeakCount: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
}

const SURFACE_COLUMNS = 41;
const SURFACE_ROWS = 33;
const PANEL_MIN_WIDTH = 232;
const PANEL_MAX_WIDTH = 304;
const PANEL_MIN_HEIGHT = 176;
const PANEL_MAX_HEIGHT = 220;
const PANEL_HORIZONTAL_MARGIN = 12;
const PANEL_BOTTOM_MARGIN = 16;
const PANEL_MAP_STACK_OFFSET = 88;

let potentialSurfaceCache: PotentialSurfaceCacheState = {
  key: '',
  columns: 0,
  rows: 0,
  normalizedSamples: new Float32Array(0),
  legendPotential: 1,
  peakPotential: 1,
  stretchPotential: 1,
  heightExponent: 1,
  softeningDistance: 1e-4,
  positivePeakCount: 0,
  negativePeakCount: 0,
};

export function renderPotentialSurface3D(
  canvasContext: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  coordinateTransform: CoordinateTransform,
  charges: PointChargeForPotentialSurface[],
  options?: {
    avoidBottomLeftLegend?: boolean;
    depthStrength?: number;
    perspectiveDeg?: number;
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

  const cacheKey = `${buildChargeKey(charges)}|${buildBoundsKey(bounds)}|${SURFACE_COLUMNS}x${SURFACE_ROWS}`;
  if (cacheKey !== potentialSurfaceCache.key) {
    potentialSurfaceCache = buildPotentialSurfaceCache(charges, bounds, SURFACE_COLUMNS, SURFACE_ROWS);
  }

  if (potentialSurfaceCache.normalizedSamples.length === 0) return;

  const panelWidth = clamp(canvasWidth * 0.3, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH);
  const panelHeight = clamp(canvasHeight * 0.29, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT);
  const panelX = PANEL_HORIZONTAL_MARGIN;
  const bottomInset = options?.avoidBottomLeftLegend ? PANEL_MAP_STACK_OFFSET : PANEL_BOTTOM_MARGIN;
  const panelY = Math.max(12, canvasHeight - panelHeight - bottomInset);

  const depthStrength = clamp(options?.depthStrength ?? 0, 0, 1);
  const perspectiveDeg = options?.perspectiveDeg ?? 0;
  const plotPaddingLeft = 14;
  const plotPaddingRight = 14;
  const plotPaddingTop = 38;
  const plotPaddingBottom = 26;
  const plotWidth = panelWidth - plotPaddingLeft - plotPaddingRight;
  const plotHeight = panelHeight - plotPaddingTop - plotPaddingBottom;
  const originX = panelX + panelWidth * 0.48;
  const originY = panelY + 58;
  const isoWidth = plotWidth * lerp(0.46, 0.56, depthStrength);
  const isoDepth = plotHeight * lerp(0.15, 0.23, depthStrength);
  const heightScale = plotHeight * lerp(0.32, 0.44, depthStrength);

  canvasContext.save();

  canvasContext.fillStyle = 'rgba(255, 255, 255, 0.95)';
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.34)';
  canvasContext.lineWidth = 1;
  roundRect(canvasContext, panelX, panelY, panelWidth, panelHeight, 14);
  canvasContext.fill();
  canvasContext.stroke();

  canvasContext.fillStyle = '#0F172A';
  canvasContext.font = '600 11px Inter, sans-serif';
  canvasContext.textAlign = 'left';
  canvasContext.textBaseline = 'top';
  canvasContext.fillText('立体电势图 φ', panelX + 12, panelY + 10);

  canvasContext.fillStyle = '#64748B';
  canvasContext.font = '10px Inter, sans-serif';
  const subtitle = describeSurfaceShape(
    potentialSurfaceCache.positivePeakCount,
    potentialSurfaceCache.negativePeakCount,
  );
  canvasContext.fillText(subtitle, panelX + 12, panelY + 24);

  const baseCorners = [
    projectSurfacePoint(0, 0, 0, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg),
    projectSurfacePoint(1, 0, 0, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg),
    projectSurfacePoint(1, 1, 0, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg),
    projectSurfacePoint(0, 1, 0, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg),
  ];

  canvasContext.beginPath();
  canvasContext.moveTo(baseCorners[0]!.x, baseCorners[0]!.y);
  for (let i = 1; i < baseCorners.length; i += 1) {
    canvasContext.lineTo(baseCorners[i]!.x, baseCorners[i]!.y);
  }
  canvasContext.closePath();
  canvasContext.fillStyle = 'rgba(241, 245, 249, 0.86)';
  canvasContext.fill();
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.42)';
  canvasContext.stroke();

  drawBaseGrid(
    canvasContext,
    potentialSurfaceCache.columns,
    potentialSurfaceCache.rows,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
    perspectiveDeg,
  );

  drawSurfaceCells(
    canvasContext,
    potentialSurfaceCache,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
    perspectiveDeg,
  );

  drawSurfaceMesh(
    canvasContext,
    potentialSurfaceCache,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
    perspectiveDeg,
  );

  drawChargeGuides(
    canvasContext,
    charges,
    bounds,
    potentialSurfaceCache,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
    perspectiveDeg,
  );

  const footerY = panelY + panelHeight - 11;
  canvasContext.fillStyle = '#475569';
  canvasContext.font = '10px Inter, sans-serif';
  canvasContext.textAlign = 'left';
  canvasContext.textBaseline = 'alphabetic';
  canvasContext.fillText(`高区参考 ≈ +${formatLegendValue(potentialSurfaceCache.legendPotential)}`, panelX + 12, footerY);
  canvasContext.textAlign = 'right';
  canvasContext.fillText(`低区参考 ≈ -${formatLegendValue(potentialSurfaceCache.legendPotential)}`, panelX + panelWidth - 12, footerY);

  canvasContext.restore();
}

function buildPotentialSurfaceCache(
  charges: PointChargeForPotentialSurface[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  columns: number,
  rows: number,
): PotentialSurfaceCacheState {
  const rawPotentials = new Float32Array(columns * rows);
  rawPotentials.fill(Number.NaN);
  const finiteAbsValues: number[] = [];
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  const cellWidth = width / Math.max(columns - 1, 1);
  const cellHeight = height / Math.max(rows - 1, 1);
  const softeningDistance = Math.max(((cellWidth + cellHeight) * 0.5) * 0.35, 1e-4);

  for (let row = 0; row < rows; row += 1) {
    const worldY = bounds.maxY - (row / Math.max(rows - 1, 1)) * height;
    for (let col = 0; col < columns; col += 1) {
      const worldX = bounds.minX + (col / Math.max(columns - 1, 1)) * width;
      const potential = computeSurfacePotentialAtPoint(
        { x: worldX, y: worldY },
        charges,
        softeningDistance,
      );
      const index = row * columns + col;
      rawPotentials[index] = potential;
      if (Number.isFinite(potential)) {
        finiteAbsValues.push(Math.abs(potential));
      }
    }
  }

  const normalizedSamples = new Float32Array(columns * rows);
  if (finiteAbsValues.length === 0) {
    return {
      key: `${buildChargeKey(charges)}|${buildBoundsKey(bounds)}|${columns}x${rows}`,
      columns,
      rows,
      normalizedSamples,
      legendPotential: 1,
      peakPotential: 1,
      stretchPotential: 1,
      heightExponent: 1,
      softeningDistance,
      positivePeakCount: 0,
      negativePeakCount: 0,
    };
  }

  finiteAbsValues.sort((left, right) => left - right);
  const legendPotential = Math.max(quantile(finiteAbsValues, 0.9), 1);
  const peakPotential = Math.max(finiteAbsValues[finiteAbsValues.length - 1] ?? 1, 1);
  const positivePeakCount = countChargesBySign(charges, 'positive');
  const negativePeakCount = countChargesBySign(charges, 'negative');
  const samePolarityMultiPeak = positivePeakCount >= 2 || negativePeakCount >= 2;
  const mixedPolarityPeak = positivePeakCount > 0 && negativePeakCount > 0;
  const stretchPotential = Math.max(
    quantile(finiteAbsValues, samePolarityMultiPeak ? 0.58 : mixedPolarityPeak ? 0.52 : 0.64),
    peakPotential * (samePolarityMultiPeak ? 0.07 : mixedPolarityPeak ? 0.06 : 0.05),
    1e-6,
  );
  const heightExponent = samePolarityMultiPeak ? 1.06 : mixedPolarityPeak ? 0.96 : 0.92;

  for (let index = 0; index < rawPotentials.length; index += 1) {
    const value = rawPotentials[index] ?? Number.NaN;
    normalizedSamples[index] = normalizePotentialForSurface(
      value,
      peakPotential,
      stretchPotential,
      heightExponent,
    );
  }

  return {
    key: `${buildChargeKey(charges)}|${buildBoundsKey(bounds)}|${columns}x${rows}`,
    columns,
    rows,
    normalizedSamples,
    legendPotential,
    peakPotential,
    stretchPotential,
    heightExponent,
    softeningDistance,
    positivePeakCount,
    negativePeakCount,
  };
}

function drawBaseGrid(
  canvasContext: CanvasRenderingContext2D,
  columns: number,
  rows: number,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
  perspectiveDeg: number,
): void {
  canvasContext.save();
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.34)';
  canvasContext.lineWidth = 1;

  for (let row = 0; row < rows; row += 1) {
    canvasContext.beginPath();
    for (let col = 0; col < columns; col += 1) {
      const point = projectSurfacePoint(
        col / Math.max(columns - 1, 1),
        row / Math.max(rows - 1, 1),
        0,
        originX,
        originY,
        isoWidth,
        isoDepth,
        heightScale,
        perspectiveDeg,
      );
      if (col === 0) {
        canvasContext.moveTo(point.x, point.y);
      } else {
        canvasContext.lineTo(point.x, point.y);
      }
    }
    canvasContext.stroke();
  }

  for (let col = 0; col < columns; col += 1) {
    canvasContext.beginPath();
    for (let row = 0; row < rows; row += 1) {
      const point = projectSurfacePoint(
        col / Math.max(columns - 1, 1),
        row / Math.max(rows - 1, 1),
        0,
        originX,
        originY,
        isoWidth,
        isoDepth,
        heightScale,
        perspectiveDeg,
      );
      if (row === 0) {
        canvasContext.moveTo(point.x, point.y);
      } else {
        canvasContext.lineTo(point.x, point.y);
      }
    }
    canvasContext.stroke();
  }

  canvasContext.restore();
}

function drawSurfaceCells(
  canvasContext: CanvasRenderingContext2D,
  cache: PotentialSurfaceCacheState,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
  perspectiveDeg: number,
): void {
  canvasContext.save();

  const maxDiagonal = (cache.rows - 2) + (cache.columns - 2);
  for (let diagonal = 0; diagonal <= maxDiagonal; diagonal += 1) {
    const rowStart = Math.max(0, diagonal - (cache.columns - 2));
    const rowEnd = Math.min(cache.rows - 2, diagonal);

    for (let row = rowStart; row <= rowEnd; row += 1) {
      const col = diagonal - row;
      const p00 = projectSample(cache, col, row, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg);
      const p10 = projectSample(cache, col + 1, row, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg);
      const p11 = projectSample(cache, col + 1, row + 1, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg);
      const p01 = projectSample(cache, col, row + 1, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg);
      const averageNormalized = (
        sampleAt(cache, row, col) +
        sampleAt(cache, row, col + 1) +
        sampleAt(cache, row + 1, col + 1) +
        sampleAt(cache, row + 1, col)
      ) / 4;
      const color = colorForNormalizedPotential(averageNormalized);
      const fillAlpha = lerp(0.18, 0.52, Math.abs(averageNormalized));
      const strokeAlpha = lerp(0.16, 0.36, Math.abs(averageNormalized));

      canvasContext.beginPath();
      canvasContext.moveTo(p00.x, p00.y);
      canvasContext.lineTo(p10.x, p10.y);
      canvasContext.lineTo(p11.x, p11.y);
      canvasContext.lineTo(p01.x, p01.y);
      canvasContext.closePath();
      canvasContext.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${fillAlpha.toFixed(3)})`;
      canvasContext.fill();
      canvasContext.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${strokeAlpha.toFixed(3)})`;
      canvasContext.lineWidth = 0.8;
      canvasContext.stroke();
    }
  }

  canvasContext.restore();
}

function drawSurfaceMesh(
  canvasContext: CanvasRenderingContext2D,
  cache: PotentialSurfaceCacheState,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
  perspectiveDeg: number,
): void {
  canvasContext.save();
  canvasContext.strokeStyle = 'rgba(15, 23, 42, 0.18)';
  canvasContext.lineWidth = 1;

  for (let row = 0; row < cache.rows; row += 1) {
    canvasContext.beginPath();
    for (let col = 0; col < cache.columns; col += 1) {
      const point = projectSample(cache, col, row, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg);
      if (col === 0) {
        canvasContext.moveTo(point.x, point.y);
      } else {
        canvasContext.lineTo(point.x, point.y);
      }
    }
    canvasContext.stroke();
  }

  for (let col = 0; col < cache.columns; col += 1) {
    canvasContext.beginPath();
    for (let row = 0; row < cache.rows; row += 1) {
      const point = projectSample(cache, col, row, originX, originY, isoWidth, isoDepth, heightScale, perspectiveDeg);
      if (row === 0) {
        canvasContext.moveTo(point.x, point.y);
      } else {
        canvasContext.lineTo(point.x, point.y);
      }
    }
    canvasContext.stroke();
  }

  canvasContext.restore();
}

function drawChargeGuides(
  canvasContext: CanvasRenderingContext2D,
  charges: PointChargeForPotentialSurface[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  cache: PotentialSurfaceCacheState,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
  perspectiveDeg: number,
): void {
  const width = bounds.maxX - bounds.minX;
  const height = bounds.maxY - bounds.minY;
  if (width <= 0 || height <= 0) return;

  canvasContext.save();
  canvasContext.lineWidth = 1.1;
  canvasContext.font = '600 10px Inter, sans-serif';
  canvasContext.textAlign = 'center';
  canvasContext.textBaseline = 'middle';

  for (const charge of charges) {
    const xRatio = clampNumber((charge.position.x - bounds.minX) / width, 0, 1);
    const yRatio = clampNumber((bounds.maxY - charge.position.y) / height, 0, 1);
    const basePoint = projectSurfacePoint(
      xRatio,
      yRatio,
      0,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
      perspectiveDeg,
    );
    const surfaceHeight = normalizePotentialForSurface(
      computeSurfacePotentialAtPoint(charge.position, charges, cache.softeningDistance),
      cache.peakPotential,
      cache.stretchPotential,
      cache.heightExponent,
    );
    const surfacePoint = projectSurfacePoint(
      xRatio,
      yRatio,
      surfaceHeight,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
      perspectiveDeg,
    );
    const isPositive = charge.charge >= 0;
    const strokeColor = isPositive ? 'rgba(220, 38, 38, 0.82)' : 'rgba(37, 99, 235, 0.82)';
    const fillColor = isPositive ? '#DC2626' : '#2563EB';
    const haloColor = isPositive ? 'rgba(248, 113, 113, 0.24)' : 'rgba(96, 165, 250, 0.24)';
    const labelColor = isPositive ? '#7F1D1D' : '#1E3A8A';

    canvasContext.save();
    canvasContext.setLineDash([4, 3]);
    canvasContext.strokeStyle = strokeColor;
    canvasContext.beginPath();
    canvasContext.moveTo(basePoint.x, basePoint.y);
    canvasContext.lineTo(surfacePoint.x, surfacePoint.y);
    canvasContext.stroke();
    canvasContext.restore();

    canvasContext.fillStyle = haloColor;
    canvasContext.beginPath();
    canvasContext.arc(surfacePoint.x, surfacePoint.y, 6.5, 0, Math.PI * 2);
    canvasContext.fill();

    canvasContext.fillStyle = fillColor;
    canvasContext.beginPath();
    canvasContext.arc(surfacePoint.x, surfacePoint.y, 3.7, 0, Math.PI * 2);
    canvasContext.fill();

    canvasContext.strokeStyle = 'rgba(255, 255, 255, 0.96)';
    canvasContext.lineWidth = 1;
    canvasContext.beginPath();
    canvasContext.arc(basePoint.x, basePoint.y, 3.1, 0, Math.PI * 2);
    canvasContext.fillStyle = fillColor;
    canvasContext.fill();
    canvasContext.stroke();

    canvasContext.fillStyle = labelColor;
    canvasContext.fillText(isPositive ? '+' : '−', basePoint.x, basePoint.y + 11);
  }

  canvasContext.restore();
}

function projectSample(
  cache: PotentialSurfaceCacheState,
  col: number,
  row: number,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
  perspectiveDeg: number,
): ProjectedPoint {
  return projectSurfacePoint(
    col / Math.max(cache.columns - 1, 1),
    row / Math.max(cache.rows - 1, 1),
    sampleAt(cache, row, col),
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
    perspectiveDeg,
  );
}

function projectSurfacePoint(
  xRatio: number,
  yRatio: number,
  normalizedHeight: number,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
  perspectiveDeg: number,
): ProjectedPoint {
  const baseX = (xRatio - yRatio) * isoWidth;
  const baseY = (xRatio + yRatio) * isoDepth;
  const tilt = (perspectiveDeg * Math.PI) / 180;
  const perspectiveLift = Math.sin(tilt) * (0.22 + (0.36 * yRatio)) * isoDepth;
  return {
    x: originX + baseX,
    y: originY + baseY - perspectiveLift - (normalizedHeight * heightScale),
  };
}

function sampleAt(cache: PotentialSurfaceCacheState, row: number, col: number): number {
  return cache.normalizedSamples[row * cache.columns + col] ?? 0;
}

function colorForNormalizedPotential(normalized: number): {
  r: number;
  g: number;
  b: number;
} {
  const clamped = clampNumber(normalized, -1, 1);
  if (Math.abs(clamped) < 1e-6) {
    return { r: 248, g: 250, b: 252 };
  }

  if (clamped > 0) {
    return {
      r: Math.round(lerp(255, 214, clamped)),
      g: Math.round(lerp(245, 69, clamped)),
      b: Math.round(lerp(235, 65, clamped)),
    };
  }

  const magnitude = Math.abs(clamped);
  return {
    r: Math.round(lerp(239, 26, magnitude)),
    g: Math.round(lerp(246, 86, magnitude)),
    b: Math.round(lerp(255, 219, magnitude)),
  };
}

function computeSurfacePotentialAtPoint(
  point: Vec2,
  charges: PointChargeForPotentialSurface[],
  softeningDistance: number,
): number {
  let potential = 0;

  for (const charge of charges) {
    const dx = point.x - charge.position.x;
    const dy = point.y - charge.position.y;
    const radialDistance = Math.hypot(dx, dy);
    const chargeSoftening = Math.max(
      softeningDistance,
      (charge.radius ?? 0) * 0.72,
      1e-4,
    );
    // 立体电势图使用近场平滑显示，避免无穷尖峰在小面板里被裁成平台。
    potential += COULOMB_CONSTANT * charge.charge / (radialDistance + chargeSoftening);
  }

  return potential;
}

function normalizePotentialForSurface(
  value: number,
  peakPotential: number,
  stretchPotential: number,
  heightExponent: number,
): number {
  if (!Number.isFinite(value) || peakPotential <= 0 || stretchPotential <= 0) {
    return 0;
  }

  const normalizedMagnitude = Math.asinh(Math.abs(value) / stretchPotential)
    / (Math.asinh(peakPotential / stretchPotential) || 1);
  return clampNumber(
    Math.sign(value) * Math.pow(clampNumber(normalizedMagnitude, 0, 1), heightExponent),
    -1,
    1,
  );
}

function buildChargeKey(charges: PointChargeForPotentialSurface[]): string {
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

function describeSurfaceShape(positivePeakCount: number, negativePeakCount: number): string {
  if (positivePeakCount >= 2 && negativePeakCount === 0) {
    return '同号正电荷应看到双峰；红点与红虚线对应两处峰顶';
  }
  if (negativePeakCount >= 2 && positivePeakCount === 0) {
    return '同号负电荷应看到双谷；蓝点与蓝虚线对应两处低谷';
  }
  if (positivePeakCount > 0 && negativePeakCount > 0) {
    return '异号双电荷应看到一峰一谷；红点抬升成峰，蓝点下陷成谷';
  }
  if (positivePeakCount === 1) {
    return '单个正电荷应呈单峰；越靠近红点，电势抬升越陡';
  }
  if (negativePeakCount === 1) {
    return '单个负电荷应呈单谷；越靠近蓝点，电势下陷越深';
  }
  return '峰值看正电势高区，低谷看负电势低区';
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

function countChargesBySign(
  charges: PointChargeForPotentialSurface[],
  sign: 'positive' | 'negative',
): number {
  return charges.filter((charge) => sign === 'positive' ? charge.charge > 0 : charge.charge < 0).length;
}
