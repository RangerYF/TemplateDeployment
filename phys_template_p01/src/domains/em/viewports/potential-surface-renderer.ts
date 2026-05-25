import type { CoordinateTransform, Vec2 } from '@/core/types';
import { COULOMB_CONSTANT, computePotentialAtPoint } from '@/domains/em/logic/electric-field-observables';
import { useSimulationStore } from '@/store/simulation-store';

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

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

interface ProjectedPoint {
  x: number;
  y: number;
  depth: number;
}

export interface PotentialSurfacePanelBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SurfaceCamera {
  yawDeg: number;
  pitchDeg: number;
  zoom: number;
}

const SURFACE_COLUMNS = 43;
const SURFACE_ROWS = 35;
const PANEL_MIN_WIDTH = 278;
const PANEL_MAX_WIDTH = 368;
const PANEL_MIN_HEIGHT = 214;
const PANEL_MAX_HEIGHT = 286;
const PANEL_HORIZONTAL_MARGIN = 12;
const PANEL_BOTTOM_MARGIN = 16;
const PANEL_MAP_STACK_OFFSET = 94;
const RESET_BUTTON_WIDTH = 64;
const RESET_BUTTON_HEIGHT = 24;

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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function scale3(vector: Vec3, scalar: number): Vec3 {
  return { x: vector.x * scalar, y: vector.y * scalar, z: vector.z * scalar };
}

function dot3(a: Vec3, b: Vec3): number {
  return (a.x * b.x) + (a.y * b.y) + (a.z * b.z);
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return {
    x: (a.y * b.z) - (a.z * b.y),
    y: (a.z * b.x) - (a.x * b.z),
    z: (a.x * b.y) - (a.y * b.x),
  };
}

function length3(vector: Vec3): number {
  return Math.hypot(vector.x, vector.y, vector.z);
}

function normalize3(vector: Vec3): Vec3 {
  const magnitude = length3(vector);
  if (magnitude < 1e-9) return { x: 0, y: 0, z: 0 };
  return scale3(vector, 1 / magnitude);
}

function averageChargePosition(charges: PointChargeForPotentialSurface[]): Vec2 {
  if (charges.length === 0) return { x: 0, y: 0 };
  const sum = charges.reduce(
    (acc, charge) => ({
      x: acc.x + charge.position.x,
      y: acc.y + charge.position.y,
    }),
    { x: 0, y: 0 },
  );
  return {
    x: sum.x / charges.length,
    y: sum.y / charges.length,
  };
}

export function getPotentialSurfacePanelBounds(
  canvas: HTMLCanvasElement,
  options?: {
    avoidBottomLeftLegend?: boolean;
  },
): PotentialSurfacePanelBounds | null {
  const dpr = window.devicePixelRatio || 1;
  const canvasWidth = canvas.clientWidth || canvas.width / dpr;
  const canvasHeight = canvas.clientHeight || canvas.height / dpr;
  if (canvasWidth <= 0 || canvasHeight <= 0) return null;

  const panelWidth = clamp(canvasWidth * 0.34, PANEL_MIN_WIDTH, PANEL_MAX_WIDTH);
  const panelHeight = clamp(canvasHeight * 0.33, PANEL_MIN_HEIGHT, PANEL_MAX_HEIGHT);
  const bottomInset = options?.avoidBottomLeftLegend ? PANEL_MAP_STACK_OFFSET : PANEL_BOTTOM_MARGIN;

  return {
    x: PANEL_HORIZONTAL_MARGIN,
    y: Math.max(12, canvasHeight - panelHeight - bottomInset),
    width: panelWidth,
    height: panelHeight,
  };
}

export function getPotentialSurfaceResetButtonBounds(
  panel: PotentialSurfacePanelBounds,
): { x: number; y: number; width: number; height: number } {
  return {
    x: panel.x + panel.width - RESET_BUTTON_WIDTH - 12,
    y: panel.y + 10,
    width: RESET_BUTTON_WIDTH,
    height: RESET_BUTTON_HEIGHT,
  };
}

export function renderPotentialSurface3D(
  canvasContext: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  coordinateTransform: CoordinateTransform,
  charges: PointChargeForPotentialSurface[],
  options?: {
    avoidBottomLeftLegend?: boolean;
  },
): void {
  if (charges.length === 0) return;

  const panel = getPotentialSurfacePanelBounds(canvas, options);
  if (!panel) return;

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

  const camera = useSimulationStore.getState().electrostaticSurface3D;
  const center = averageChargePosition(charges);
  const resetButton = getPotentialSurfaceResetButtonBounds(panel);
  const plotPaddingLeft = 18;
  const plotPaddingRight = 14;
  const plotPaddingTop = 44;
  const plotPaddingBottom = 26;
  const plotWidth = panel.width - plotPaddingLeft - plotPaddingRight;
  const plotHeight = panel.height - plotPaddingTop - plotPaddingBottom;
  const boundsSpanX = Math.max(bounds.maxX - bounds.minX, 1e-6);
  const boundsSpanY = Math.max(bounds.maxY - bounds.minY, 1e-6);
  const span = Math.max(boundsSpanX, boundsSpanY);
  const zoom = clamp(camera.zoom, 0.7, 1.8);
  const isoWidth = plotWidth * 0.31 * zoom;
  const isoDepth = plotHeight * 0.22 * zoom;
  const heightScale = plotHeight * 0.34 * zoom;
  const originX = panel.x + panel.width * 0.48;
  const originY = panel.y + 86;

  canvasContext.save();

  canvasContext.fillStyle = 'rgba(255, 255, 255, 0.96)';
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.34)';
  canvasContext.lineWidth = 1;
  roundRect(canvasContext, panel.x, panel.y, panel.width, panel.height, 14);
  canvasContext.fill();
  canvasContext.stroke();

  canvasContext.fillStyle = '#0F172A';
  canvasContext.font = '600 11px Inter, sans-serif';
  canvasContext.textAlign = 'left';
  canvasContext.textBaseline = 'top';
  canvasContext.fillText('立体电势图 φ', panel.x + 12, panel.y + 10);

  canvasContext.fillStyle = '#64748B';
  canvasContext.font = '10px Inter, sans-serif';
  canvasContext.fillText('拖拽旋转，滚轮缩放', panel.x + 12, panel.y + 24);

  const subtitle = describeSurfaceShape(
    potentialSurfaceCache.positivePeakCount,
    potentialSurfaceCache.negativePeakCount,
  );
  canvasContext.fillStyle = '#475569';
  canvasContext.font = '10px Inter, sans-serif';
  canvasContext.fillText(subtitle, panel.x + 12, panel.y + 38);

  drawResetButton(canvasContext, resetButton);

  const baseCorners = [
    projectSurfacePoint(
      pointOnSurface(0, 0, 0, bounds, center, span),
      camera,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
    ),
    projectSurfacePoint(
      pointOnSurface(1, 0, 0, bounds, center, span),
      camera,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
    ),
    projectSurfacePoint(
      pointOnSurface(1, 1, 0, bounds, center, span),
      camera,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
    ),
    projectSurfacePoint(
      pointOnSurface(0, 1, 0, bounds, center, span),
      camera,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
    ),
  ];

  canvasContext.beginPath();
  canvasContext.moveTo(baseCorners[0]!.x, baseCorners[0]!.y);
  for (let index = 1; index < baseCorners.length; index += 1) {
    canvasContext.lineTo(baseCorners[index]!.x, baseCorners[index]!.y);
  }
  canvasContext.closePath();
  canvasContext.fillStyle = 'rgba(244, 247, 252, 0.92)';
  canvasContext.fill();
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.38)';
  canvasContext.stroke();

  drawBaseGrid(
    canvasContext,
    potentialSurfaceCache.columns,
    potentialSurfaceCache.rows,
    bounds,
    center,
    span,
    camera,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
  );

  drawSurfaceCells(
    canvasContext,
    potentialSurfaceCache,
    bounds,
    center,
    span,
    camera,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
  );

  drawSurfaceMesh(
    canvasContext,
    potentialSurfaceCache,
    bounds,
    center,
    span,
    camera,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
  );

  drawChargeGuides(
    canvasContext,
    charges,
    bounds,
    center,
    span,
    potentialSurfaceCache,
    camera,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
  );

  const potentialProbeA = useSimulationStore.getState().potentialProbeA;
  const potentialProbeB = useSimulationStore.getState().potentialProbeB;
  drawProbeGuides(
    canvasContext,
    charges,
    bounds,
    center,
    span,
    potentialProbeA,
    potentialProbeB,
    potentialSurfaceCache,
    camera,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
  );

  const footerY = panel.y + panel.height - 11;
  canvasContext.fillStyle = '#475569';
  canvasContext.font = '10px Inter, sans-serif';
  canvasContext.textAlign = 'left';
  canvasContext.textBaseline = 'alphabetic';
  canvasContext.fillText(`高区参考 ≈ +${formatLegendValue(potentialSurfaceCache.legendPotential)}`, panel.x + 12, footerY);
  canvasContext.textAlign = 'right';
  canvasContext.fillText(`低区参考 ≈ -${formatLegendValue(potentialSurfaceCache.legendPotential)}`, panel.x + panel.width - 12, footerY);

  canvasContext.restore();
}

function drawResetButton(
  canvasContext: CanvasRenderingContext2D,
  bounds: { x: number; y: number; width: number; height: number },
): void {
  canvasContext.save();
  roundRect(canvasContext, bounds.x, bounds.y, bounds.width, bounds.height, 999);
  canvasContext.fillStyle = 'rgba(255,255,255,0.92)';
  canvasContext.fill();
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.38)';
  canvasContext.stroke();
  canvasContext.fillStyle = '#0F172A';
  canvasContext.font = '600 10px Inter, sans-serif';
  canvasContext.textAlign = 'center';
  canvasContext.textBaseline = 'middle';
  canvasContext.fillText('重置视角', bounds.x + (bounds.width / 2), bounds.y + (bounds.height / 2));
  canvasContext.restore();
}

function rotationBasis(camera: SurfaceCamera): { right: Vec3; up: Vec3; forward: Vec3 } {
  const yaw = (camera.yawDeg * Math.PI) / 180;
  const pitch = (camera.pitchDeg * Math.PI) / 180;
  const forward = normalize3({
    x: Math.sin(yaw) * Math.cos(pitch),
    y: Math.sin(pitch),
    z: Math.cos(yaw) * Math.cos(pitch),
  });
  const worldUp = Math.abs(forward.y) > 0.95 ? { x: 0, y: 0, z: 1 } : { x: 0, y: 1, z: 0 };
  const right = normalize3(cross3(worldUp, forward));
  const up = normalize3(cross3(forward, right));
  return { right, up, forward };
}

function projectSurfacePoint(
  point: Vec3,
  camera: SurfaceCamera,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
): ProjectedPoint {
  const { right, up, forward } = rotationBasis(camera);
  const rotatedX = dot3(point, right);
  const rotatedY = dot3(point, up);
  const rotatedZ = dot3(point, forward);
  const perspective = 1 / (1 + (rotatedZ * 0.18));

  return {
    x: originX + (rotatedX * isoWidth * perspective),
    y: originY + (rotatedY * isoDepth * 1.35 * perspective) - (point.z * heightScale * perspective),
    depth: rotatedZ,
  };
}

function pointOnSurface(
  xRatio: number,
  yRatio: number,
  normalizedHeight: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  center: Vec2,
  span: number,
): Vec3 {
  const worldX = lerp(bounds.minX, bounds.maxX, xRatio);
  const worldY = lerp(bounds.maxY, bounds.minY, yRatio);
  return {
    x: (worldX - center.x) / span,
    y: (worldY - center.y) / span,
    z: normalizedHeight,
  };
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
      if (Number.isFinite(potential)) finiteAbsValues.push(Math.abs(potential));
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
  const heightExponent = samePolarityMultiPeak ? 1.04 : mixedPolarityPeak ? 0.95 : 0.92;

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
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  center: Vec2,
  span: number,
  camera: SurfaceCamera,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
): void {
  canvasContext.save();
  canvasContext.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  canvasContext.lineWidth = 1;

  for (let row = 0; row < rows; row += 1) {
    canvasContext.beginPath();
    for (let col = 0; col < columns; col += 1) {
      const point = projectSurfacePoint(
        pointOnSurface(
          col / Math.max(columns - 1, 1),
          row / Math.max(rows - 1, 1),
          0,
          bounds,
          center,
          span,
        ),
        camera,
        originX,
        originY,
        isoWidth,
        isoDepth,
        heightScale,
      );
      if (col === 0) canvasContext.moveTo(point.x, point.y);
      else canvasContext.lineTo(point.x, point.y);
    }
    canvasContext.stroke();
  }

  for (let col = 0; col < columns; col += 1) {
    canvasContext.beginPath();
    for (let row = 0; row < rows; row += 1) {
      const point = projectSurfacePoint(
        pointOnSurface(
          col / Math.max(columns - 1, 1),
          row / Math.max(rows - 1, 1),
          0,
          bounds,
          center,
          span,
        ),
        camera,
        originX,
        originY,
        isoWidth,
        isoDepth,
        heightScale,
      );
      if (row === 0) canvasContext.moveTo(point.x, point.y);
      else canvasContext.lineTo(point.x, point.y);
    }
    canvasContext.stroke();
  }

  canvasContext.restore();
}

function drawSurfaceCells(
  canvasContext: CanvasRenderingContext2D,
  cache: PotentialSurfaceCacheState,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  center: Vec2,
  span: number,
  camera: SurfaceCamera,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
): void {
  const cells: Array<{
    points: ProjectedPoint[];
    averageNormalized: number;
    depth: number;
  }> = [];

  for (let row = 0; row < cache.rows - 1; row += 1) {
    for (let col = 0; col < cache.columns - 1; col += 1) {
      const points = [
        projectSample(cache, col, row, bounds, center, span, camera, originX, originY, isoWidth, isoDepth, heightScale),
        projectSample(cache, col + 1, row, bounds, center, span, camera, originX, originY, isoWidth, isoDepth, heightScale),
        projectSample(cache, col + 1, row + 1, bounds, center, span, camera, originX, originY, isoWidth, isoDepth, heightScale),
        projectSample(cache, col, row + 1, bounds, center, span, camera, originX, originY, isoWidth, isoDepth, heightScale),
      ];
      const averageNormalized = (
        sampleAt(cache, row, col) +
        sampleAt(cache, row, col + 1) +
        sampleAt(cache, row + 1, col + 1) +
        sampleAt(cache, row + 1, col)
      ) / 4;
      const depth = points.reduce((sum, point) => sum + point.depth, 0) / points.length;
      cells.push({ points, averageNormalized, depth });
    }
  }

  cells.sort((left, right) => left.depth - right.depth);

  canvasContext.save();
  for (const cell of cells) {
    const color = colorForNormalizedPotential(cell.averageNormalized);
    const fillAlpha = lerp(0.18, 0.48, Math.abs(cell.averageNormalized));
    const strokeAlpha = lerp(0.12, 0.28, Math.abs(cell.averageNormalized));

    canvasContext.beginPath();
    canvasContext.moveTo(cell.points[0]!.x, cell.points[0]!.y);
    for (let index = 1; index < cell.points.length; index += 1) {
      canvasContext.lineTo(cell.points[index]!.x, cell.points[index]!.y);
    }
    canvasContext.closePath();
    canvasContext.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${fillAlpha.toFixed(3)})`;
    canvasContext.fill();
    canvasContext.strokeStyle = `rgba(${color.r}, ${color.g}, ${color.b}, ${strokeAlpha.toFixed(3)})`;
    canvasContext.lineWidth = 0.85;
    canvasContext.stroke();
  }
  canvasContext.restore();
}

function drawSurfaceMesh(
  canvasContext: CanvasRenderingContext2D,
  cache: PotentialSurfaceCacheState,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  center: Vec2,
  span: number,
  camera: SurfaceCamera,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
): void {
  canvasContext.save();
  canvasContext.strokeStyle = 'rgba(15, 23, 42, 0.16)';
  canvasContext.lineWidth = 1;

  for (let row = 0; row < cache.rows; row += 1) {
    canvasContext.beginPath();
    for (let col = 0; col < cache.columns; col += 1) {
      const point = projectSample(cache, col, row, bounds, center, span, camera, originX, originY, isoWidth, isoDepth, heightScale);
      if (col === 0) canvasContext.moveTo(point.x, point.y);
      else canvasContext.lineTo(point.x, point.y);
    }
    canvasContext.stroke();
  }

  for (let col = 0; col < cache.columns; col += 1) {
    canvasContext.beginPath();
    for (let row = 0; row < cache.rows; row += 1) {
      const point = projectSample(cache, col, row, bounds, center, span, camera, originX, originY, isoWidth, isoDepth, heightScale);
      if (row === 0) canvasContext.moveTo(point.x, point.y);
      else canvasContext.lineTo(point.x, point.y);
    }
    canvasContext.stroke();
  }

  canvasContext.restore();
}

function drawChargeGuides(
  canvasContext: CanvasRenderingContext2D,
  charges: PointChargeForPotentialSurface[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  center: Vec2,
  span: number,
  cache: PotentialSurfaceCacheState,
  camera: SurfaceCamera,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
): void {
  canvasContext.save();
  canvasContext.lineWidth = 1.1;
  canvasContext.font = '600 10px Inter, sans-serif';
  canvasContext.textAlign = 'center';
  canvasContext.textBaseline = 'middle';

  for (const charge of charges) {
    const xRatio = clampNumber((charge.position.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6), 0, 1);
    const yRatio = clampNumber((bounds.maxY - charge.position.y) / Math.max(bounds.maxY - bounds.minY, 1e-6), 0, 1);
    const basePoint = projectSurfacePoint(
      pointOnSurface(xRatio, yRatio, 0, bounds, center, span),
      camera,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
    );
    const surfaceHeight = normalizePotentialForSurface(
      computeSurfacePotentialAtPoint(charge.position, charges, cache.softeningDistance),
      cache.peakPotential,
      cache.stretchPotential,
      cache.heightExponent,
    );
    const surfacePoint = projectSurfacePoint(
      pointOnSurface(xRatio, yRatio, surfaceHeight, bounds, center, span),
      camera,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
    );
    const isPositive = charge.charge >= 0;
    const strokeColor = isPositive ? 'rgba(220, 38, 38, 0.82)' : 'rgba(37, 99, 235, 0.82)';
    const fillColor = isPositive ? '#DC2626' : '#2563EB';
    const labelColor = isPositive ? '#7F1D1D' : '#1E3A8A';

    canvasContext.save();
    canvasContext.setLineDash([4, 3]);
    canvasContext.strokeStyle = strokeColor;
    canvasContext.beginPath();
    canvasContext.moveTo(basePoint.x, basePoint.y);
    canvasContext.lineTo(surfacePoint.x, surfacePoint.y);
    canvasContext.stroke();
    canvasContext.restore();

    canvasContext.fillStyle = isPositive ? 'rgba(248, 113, 113, 0.2)' : 'rgba(96, 165, 250, 0.2)';
    canvasContext.beginPath();
    canvasContext.arc(surfacePoint.x, surfacePoint.y, 6.8, 0, Math.PI * 2);
    canvasContext.fill();

    canvasContext.fillStyle = fillColor;
    canvasContext.beginPath();
    canvasContext.arc(surfacePoint.x, surfacePoint.y, 3.9, 0, Math.PI * 2);
    canvasContext.fill();

    canvasContext.strokeStyle = 'rgba(255,255,255,0.96)';
    canvasContext.lineWidth = 1;
    canvasContext.beginPath();
    canvasContext.arc(basePoint.x, basePoint.y, 3.3, 0, Math.PI * 2);
    canvasContext.fillStyle = fillColor;
    canvasContext.fill();
    canvasContext.stroke();

    canvasContext.fillStyle = labelColor;
    canvasContext.fillText(isPositive ? '+' : '−', basePoint.x, basePoint.y + 12);
  }

  canvasContext.restore();
}

function drawProbeGuides(
  canvasContext: CanvasRenderingContext2D,
  charges: PointChargeForPotentialSurface[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  center: Vec2,
  span: number,
  probeA: Vec2 | null,
  probeB: Vec2 | null,
  cache: PotentialSurfaceCacheState,
  camera: SurfaceCamera,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
): void {
  if (!probeA && !probeB) return;

  const drawProbe = (probe: Vec2, label: 'A' | 'B', color: string): void => {
    const xRatio = clampNumber((probe.x - bounds.minX) / Math.max(bounds.maxX - bounds.minX, 1e-6), 0, 1);
    const yRatio = clampNumber((bounds.maxY - probe.y) / Math.max(bounds.maxY - bounds.minY, 1e-6), 0, 1);
    const potential = computePotentialAtPoint(probe, charges);
    const normalizedHeight = normalizePotentialForSurface(
      potential,
      cache.peakPotential,
      cache.stretchPotential,
      cache.heightExponent,
    );
    const point = projectSurfacePoint(
      pointOnSurface(xRatio, yRatio, normalizedHeight, bounds, center, span),
      camera,
      originX,
      originY,
      isoWidth,
      isoDepth,
      heightScale,
    );

    canvasContext.save();
    canvasContext.fillStyle = '#FFFFFF';
    canvasContext.strokeStyle = color;
    canvasContext.lineWidth = 2;
    canvasContext.beginPath();
    canvasContext.arc(point.x, point.y, 5.2, 0, Math.PI * 2);
    canvasContext.fill();
    canvasContext.stroke();
    canvasContext.fillStyle = color;
    canvasContext.font = '700 10px Inter, sans-serif';
    canvasContext.textAlign = 'left';
    canvasContext.textBaseline = 'middle';
    canvasContext.fillText(label, point.x + 8, point.y - 2);
    canvasContext.restore();
  };

  if (probeA) drawProbe(probeA, 'A', '#0EA5E9');
  if (probeB) drawProbe(probeB, 'B', '#F97316');
}

function projectSample(
  cache: PotentialSurfaceCacheState,
  col: number,
  row: number,
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  center: Vec2,
  span: number,
  camera: SurfaceCamera,
  originX: number,
  originY: number,
  isoWidth: number,
  isoDepth: number,
  heightScale: number,
): ProjectedPoint {
  return projectSurfacePoint(
    pointOnSurface(
      col / Math.max(cache.columns - 1, 1),
      row / Math.max(cache.rows - 1, 1),
      sampleAt(cache, row, col),
      bounds,
      center,
      span,
    ),
    camera,
    originX,
    originY,
    isoWidth,
    isoDepth,
    heightScale,
  );
}

function sampleAt(cache: PotentialSurfaceCacheState, row: number, col: number): number {
  return cache.normalizedSamples[row * cache.columns + col] ?? 0;
}

function colorForNormalizedPotential(normalized: number): { r: number; g: number; b: number } {
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
    const chargeSoftening = Math.max(softeningDistance, (charge.radius ?? 0) * 0.72, 1e-4);
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
  if (!Number.isFinite(value) || peakPotential <= 0 || stretchPotential <= 0) return 0;
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
  if (positivePeakCount >= 2 && negativePeakCount === 0) return '同号正电荷对应双峰';
  if (negativePeakCount >= 2 && positivePeakCount === 0) return '同号负电荷对应双谷';
  if (positivePeakCount > 0 && negativePeakCount > 0) return '异号双电荷对应一峰一谷';
  if (positivePeakCount === 1) return '单个正电荷对应单峰';
  if (negativePeakCount === 1) return '单个负电荷对应单谷';
  return '峰值看正区，低谷看负区';
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

function formatLegendValue(value: number): string {
  if (!Number.isFinite(value)) return '∞';
  if (value >= 1e4 || (value > 0 && value < 1e-2)) return value.toExponential(1);
  return value >= 100 ? value.toFixed(0) : value.toFixed(1);
}

function countChargesBySign(
  charges: PointChargeForPotentialSurface[],
  sign: 'positive' | 'negative',
): number {
  return charges.filter((charge) => sign === 'positive' ? charge.charge > 0 : charge.charge < 0).length;
}
