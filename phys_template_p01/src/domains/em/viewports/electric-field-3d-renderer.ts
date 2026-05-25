import type { CoordinateTransform } from '@/core/types';
import type { EquipotentialLine } from '@/domains/em/logic/field-line-calculator';
import {
  createElectricFieldCamera,
  generateElectricFieldLines3D,
  projectPoint3D,
  projectSphereRadius,
  type FieldLine3D,
  type PointCharge3DInput,
  type ProjectedPoint3D,
  type ProjectionCamera3D,
} from '@/domains/em/logic/electric-field-3d';
import { worldToScreen } from '@/renderer/coordinate';

const POSITIVE_LINE_COLOR = '#E55353';
const NEGATIVE_LINE_COLOR = '#2F7EF7';
const POSITIVE_GLOW = 'rgba(239, 68, 68, 0.22)';
const NEGATIVE_GLOW = 'rgba(59, 130, 246, 0.22)';
const POSITIVE_SPHERE_EDGE = 'rgba(127, 29, 29, 0.72)';
const NEGATIVE_SPHERE_EDGE = 'rgba(30, 64, 175, 0.72)';
const EQUIPOTENTIAL_POSITIVE = 'rgba(239, 68, 68, 0.18)';
const EQUIPOTENTIAL_NEGATIVE = 'rgba(59, 130, 246, 0.18)';
const ARROW_TARGET_INTERVAL_PX = 110;
const MAX_EQ_COUNT = 8;
const CHARGE_LABEL_FONT = '700 15px Inter, sans-serif';

interface RenderProjectedLine {
  sourceSign: 1 | -1;
  projected: ProjectedPoint3D[];
  averageDepth: number;
  reachesSink: boolean;
}

interface RenderProjectedCharge {
  charge: PointCharge3DInput;
  point: ProjectedPoint3D;
  radius: number;
  averageDepth: number;
}

interface ElectricField3DCache {
  key: string;
  lines: FieldLine3D[];
}

let cachedField3D: ElectricField3DCache = {
  key: '',
  lines: [],
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function buildChargeCacheKey(
  charges: PointCharge3DInput[],
  density: string,
): string {
  return [
    density,
    ...charges.map((charge) => (
      `${charge.id}:${charge.position.x.toFixed(4)},${charge.position.y.toFixed(4)},${charge.charge.toFixed(7)},${(charge.radius ?? 0).toFixed(4)}`
    )),
  ].join('|');
}

function lineAverageDepth(projected: ProjectedPoint3D[]): number {
  if (projected.length === 0) return 1;
  const total = projected.reduce((sum, point) => sum + point.depth, 0);
  return total / projected.length;
}

function drawPath(
  canvasContext: CanvasRenderingContext2D,
  points: ProjectedPoint3D[],
): void {
  canvasContext.beginPath();
  canvasContext.moveTo(points[0]!.x, points[0]!.y);

  if (points.length === 2) {
    canvasContext.lineTo(points[1]!.x, points[1]!.y);
    return;
  }

  for (let index = 0; index < points.length - 2; index += 1) {
    const current = points[index]!;
    const next = points[index + 1]!;
    const midX = (current.x + next.x) * 0.5;
    const midY = (current.y + next.y) * 0.5;
    canvasContext.quadraticCurveTo(current.x, current.y, midX, midY);
  }

  const penultimate = points[points.length - 2]!;
  const last = points[points.length - 1]!;
  canvasContext.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);
}

function drawLineArrows(
  canvasContext: CanvasRenderingContext2D,
  points: ProjectedPoint3D[],
  color: string,
  alpha: number,
  widthScale: number,
): void {
  if (points.length < 2) return;

  const cumulativeDistance: number[] = [0];
  for (let index = 1; index < points.length; index += 1) {
    const current = points[index]!;
    const previous = points[index - 1]!;
    cumulativeDistance.push(
      cumulativeDistance[index - 1]! + Math.hypot(current.x - previous.x, current.y - previous.y),
    );
  }

  const totalDistance = cumulativeDistance[cumulativeDistance.length - 1]!;
  if (totalDistance < ARROW_TARGET_INTERVAL_PX * 0.62) return;

  let targetDistance = ARROW_TARGET_INTERVAL_PX * 0.42;
  let segmentIndex = 0;

  while (targetDistance < totalDistance - 12) {
    while (
      segmentIndex < cumulativeDistance.length - 1 &&
      cumulativeDistance[segmentIndex + 1]! < targetDistance
    ) {
      segmentIndex += 1;
    }
    if (segmentIndex >= points.length - 1) break;

    const start = points[segmentIndex]!;
    const end = points[segmentIndex + 1]!;
    const segmentLength = cumulativeDistance[segmentIndex + 1]! - cumulativeDistance[segmentIndex]!;
    if (segmentLength < 1e-6) {
      targetDistance += ARROW_TARGET_INTERVAL_PX;
      continue;
    }

    const t = (targetDistance - cumulativeDistance[segmentIndex]!) / segmentLength;
    const x = lerp(start.x, end.x, t);
    const y = lerp(start.y, end.y, t);
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const arrowSize = 7 * widthScale;

    canvasContext.save();
    canvasContext.fillStyle = color;
    canvasContext.globalAlpha = alpha;
    canvasContext.beginPath();
    canvasContext.moveTo(
      x + (arrowSize * Math.cos(angle)),
      y + (arrowSize * Math.sin(angle)),
    );
    canvasContext.lineTo(
      x + (arrowSize * Math.cos(angle + 2.48)),
      y + (arrowSize * Math.sin(angle + 2.48)),
    );
    canvasContext.lineTo(
      x + (arrowSize * Math.cos(angle - 2.48)),
      y + (arrowSize * Math.sin(angle - 2.48)),
    );
    canvasContext.closePath();
    canvasContext.fill();
    canvasContext.restore();

    targetDistance += ARROW_TARGET_INTERVAL_PX;
  }
}

function drawSphereShadow(
  canvasContext: CanvasRenderingContext2D,
  point: ProjectedPoint3D,
  radius: number,
): void {
  canvasContext.save();
  canvasContext.fillStyle = 'rgba(15, 23, 42, 0.08)';
  canvasContext.beginPath();
  canvasContext.ellipse(
    point.x,
    point.y + radius * 1.22,
    Math.max(7, radius * 0.98),
    Math.max(3, radius * 0.34),
    0,
    0,
    Math.PI * 2,
  );
  canvasContext.fill();
  canvasContext.restore();
}

function drawChargeSphere(
  canvasContext: CanvasRenderingContext2D,
  point: ProjectedPoint3D,
  radius: number,
  sign: 1 | -1,
): void {
  const highlightX = point.x - (radius * 0.34);
  const highlightY = point.y - (radius * 0.36);
  const gradient = canvasContext.createRadialGradient(
    highlightX,
    highlightY,
    Math.max(2.5, radius * 0.14),
    point.x,
    point.y,
    Math.max(radius, 1),
  );

  if (sign > 0) {
    gradient.addColorStop(0, 'rgba(255, 251, 248, 0.99)');
    gradient.addColorStop(0.24, '#FDA4AF');
    gradient.addColorStop(0.66, '#EF4444');
    gradient.addColorStop(1, '#991B1B');
  } else {
    gradient.addColorStop(0, 'rgba(247, 251, 255, 0.99)');
    gradient.addColorStop(0.24, '#BFDBFE');
    gradient.addColorStop(0.66, '#3B82F6');
    gradient.addColorStop(1, '#1E3A8A');
  }

  canvasContext.save();
  canvasContext.beginPath();
  canvasContext.arc(point.x, point.y, radius, 0, Math.PI * 2);
  canvasContext.fillStyle = gradient;
  canvasContext.shadowColor = sign > 0 ? POSITIVE_GLOW : NEGATIVE_GLOW;
  canvasContext.shadowBlur = Math.max(14, radius * 0.48);
  canvasContext.shadowOffsetY = Math.max(2, radius * 0.07);
  canvasContext.fill();
  canvasContext.shadowColor = 'transparent';
  canvasContext.strokeStyle = sign > 0 ? POSITIVE_SPHERE_EDGE : NEGATIVE_SPHERE_EDGE;
  canvasContext.lineWidth = Math.max(1.4, radius * 0.09);
  canvasContext.stroke();

  canvasContext.beginPath();
  canvasContext.arc(highlightX, highlightY, Math.max(2.8, radius * 0.22), 0, Math.PI * 2);
  canvasContext.fillStyle = 'rgba(255,255,255,0.74)';
  canvasContext.fill();

  canvasContext.fillStyle = '#FFFFFF';
  canvasContext.font = CHARGE_LABEL_FONT;
  canvasContext.textAlign = 'center';
  canvasContext.textBaseline = 'middle';
  canvasContext.fillText(sign > 0 ? '+' : '−', point.x, point.y);
  canvasContext.restore();
}

function drawProjectedFieldLines(
  canvasContext: CanvasRenderingContext2D,
  lines: RenderProjectedLine[],
): void {
  for (const line of lines) {
    const color = line.sourceSign > 0 ? POSITIVE_LINE_COLOR : NEGATIVE_LINE_COLOR;
    const alpha = lerp(0.28, 0.88, 1 - line.averageDepth);
    const widthScale = lerp(0.8, 1.34, 1 - line.averageDepth);

    canvasContext.save();
    canvasContext.strokeStyle = color;
    canvasContext.lineWidth = 1.55 * widthScale;
    canvasContext.lineJoin = 'round';
    canvasContext.lineCap = 'round';
    canvasContext.globalAlpha = alpha;
    canvasContext.shadowColor = line.sourceSign > 0 ? POSITIVE_GLOW : NEGATIVE_GLOW;
    canvasContext.shadowBlur = lerp(1.2, 8.5, 1 - line.averageDepth);
    drawPath(canvasContext, line.projected);
    canvasContext.stroke();
    canvasContext.restore();

    drawLineArrows(canvasContext, line.projected, color, alpha, widthScale);
  }
}

function drawProjectedEquipotentialLines(
  canvasContext: CanvasRenderingContext2D,
  equipotentialLines: EquipotentialLine[],
  camera: ProjectionCamera3D,
  coordinateTransform: CoordinateTransform,
): void {
  if (equipotentialLines.length === 0) return;

  const selectedLines = equipotentialLines
    .slice(0, MAX_EQ_COUNT)
    .map((line) => ({
      line,
      voltage: line.voltage,
      projected: line.points
        .map((point) => projectPoint3D({ x: point.x, y: point.y, z: 0 }, camera, coordinateTransform))
        .filter((point) => point.visible),
    }))
    .filter((entry) => entry.projected.length >= 2);

  canvasContext.save();
  canvasContext.setLineDash([5, 7]);
  canvasContext.lineWidth = 0.85;
  canvasContext.lineJoin = 'round';
  canvasContext.lineCap = 'round';

  for (const entry of selectedLines) {
    const averageDepth = lineAverageDepth(entry.projected);
    const color = entry.voltage >= 0 ? EQUIPOTENTIAL_POSITIVE : EQUIPOTENTIAL_NEGATIVE;
    canvasContext.strokeStyle = color;
    canvasContext.globalAlpha = lerp(0.08, 0.2, 1 - averageDepth);
    drawPath(canvasContext, entry.projected);
    canvasContext.stroke();
  }

  canvasContext.setLineDash([]);
  canvasContext.restore();
}

function drawAmbientGradient(
  canvasContext: CanvasRenderingContext2D,
  charges: PointCharge3DInput[],
  coordinateTransform: CoordinateTransform,
): void {
  for (const charge of charges) {
    const center = worldToScreen(charge.position, coordinateTransform);
    const radius = Math.max(110, coordinateTransform.scale * 0.34);
    const gradient = canvasContext.createRadialGradient(center.x, center.y, 0, center.x, center.y, radius);

    if (charge.charge >= 0) {
      gradient.addColorStop(0, 'rgba(239, 68, 68, 0.16)');
      gradient.addColorStop(0.42, 'rgba(251, 146, 60, 0.08)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    } else {
      gradient.addColorStop(0, 'rgba(59, 130, 246, 0.16)');
      gradient.addColorStop(0.42, 'rgba(96, 165, 250, 0.08)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
    }

    canvasContext.save();
    canvasContext.globalAlpha = 0.9;
    canvasContext.fillStyle = gradient;
    canvasContext.beginPath();
    canvasContext.arc(center.x, center.y, radius, 0, Math.PI * 2);
    canvasContext.fill();
    canvasContext.restore();
  }
}

function projectFieldLines(
  fieldLines: FieldLine3D[],
  camera: ProjectionCamera3D,
  coordinateTransform: CoordinateTransform,
): RenderProjectedLine[] {
  return fieldLines
    .map((line) => ({
      sourceSign: line.sourceSign,
      reachesSink: line.reachesSink,
      projected: line.points
        .map((point) => projectPoint3D(point, camera, coordinateTransform))
        .filter((point) => point.visible),
    }))
    .filter((line) => line.projected.length >= 4)
    .map((line) => ({
      ...line,
      averageDepth: lineAverageDepth(line.projected),
    }))
    .sort((left, right) => right.averageDepth - left.averageDepth);
}

function projectCharges(
  charges: PointCharge3DInput[],
  camera: ProjectionCamera3D,
  coordinateTransform: CoordinateTransform,
): RenderProjectedCharge[] {
  return charges
    .map((charge) => {
      const projectedPoint = projectPoint3D(
        { x: charge.position.x, y: charge.position.y, z: 0 },
        camera,
        coordinateTransform,
      );
      return {
        charge,
        point: projectedPoint,
        radius: projectSphereRadius(charge.radius ?? 0.008, projectedPoint, coordinateTransform),
        averageDepth: projectedPoint.depth,
      };
    })
    .filter((entry) => entry.point.visible)
    .sort((left, right) => right.averageDepth - left.averageDepth);
}

export function renderElectricField3D(
  canvasContext: CanvasRenderingContext2D,
  coordinateTransform: CoordinateTransform,
  charges: PointCharge3DInput[],
  equipotentialLines: EquipotentialLine[],
  bounds: { minX: number; maxX: number; minY: number; maxY: number },
  options?: {
    density?: 'sparse' | 'standard' | 'dense';
    showFieldLines?: boolean;
    showEquipotentialLines?: boolean;
  },
): void {
  if (charges.length === 0) return;

  const density = options?.density ?? 'standard';
  const cacheKey = `${buildChargeCacheKey(charges, density)}|${bounds.minX.toFixed(3)},${bounds.maxX.toFixed(3)},${bounds.minY.toFixed(3)},${bounds.maxY.toFixed(3)}`;
  if (cachedField3D.key !== cacheKey) {
    cachedField3D = {
      key: cacheKey,
      lines: generateElectricFieldLines3D(charges, bounds, { density }),
    };
  }

  const camera = createElectricFieldCamera(charges, bounds);
  drawAmbientGradient(canvasContext, charges, coordinateTransform);

  if (options?.showEquipotentialLines ?? true) {
    drawProjectedEquipotentialLines(
      canvasContext,
      equipotentialLines,
      camera,
      coordinateTransform,
    );
  }

  if (options?.showFieldLines ?? true) {
    const projectedLines = projectFieldLines(cachedField3D.lines, camera, coordinateTransform);
    drawProjectedFieldLines(canvasContext, projectedLines);
  }

  const projectedCharges = projectCharges(charges, camera, coordinateTransform);
  for (const projected of projectedCharges) {
    const radius = clamp(projected.radius, 10, 22);
    drawSphereShadow(canvasContext, projected.point, radius);
  }
  for (const projected of projectedCharges) {
    const radius = clamp(projected.radius, 10, 22);
    drawChargeSphere(
      canvasContext,
      projected.point,
      radius,
      projected.charge.charge >= 0 ? 1 : -1,
    );
  }
}
