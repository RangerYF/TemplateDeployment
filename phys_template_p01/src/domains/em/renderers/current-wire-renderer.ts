import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import type { Entity } from '@/core/types';
import { useSimulationStore } from '@/store';
import {
  getLoopCurrentDirection,
  getLoopCrossSectionDirections,
  getLoopCurrentDirectionLabel,
  getStraightWireCurrentDirection,
  getStraightWireCurrentDirectionLabel,
} from '../logic/current-direction';
import {
  getLoopViewMode,
  getLoopVisualStrength,
  resolveLoopViewTransition,
  type LoopViewMode,
} from '../logic/loop-current-teaching';
import {
  getLoopCameraState,
  getProjectedVisibleSegments,
  projectLoopPoint,
  type LoopPoint3D,
  type ProjectedLoopPoint,
} from '../logic/loop-current-3d';
import {
  getStraightWireTopViewCurrentSymbol,
  getStraightWireViewMode,
  getStraightWireVisualStrength,
  resolveStraightWireViewTransition,
  type StraightWireViewMode,
} from '../logic/straight-wire-teaching';

/** 导线颜色 */
const WIRE_COLOR = '#444444';
/** 电流方向箭头颜色 */
const CURRENT_ARROW_COLOR = '#E74C3C';
/** 标签颜色 */
const LABEL_COLOR = '#2C3E50';
/** 导线线宽（像素） */
const WIRE_LINE_WIDTH = 3;
/** 电流出/入截面颜色 */
const CROSS_SECTION_COLOR = '#555555';
const TEACHING_WIRE_DARK = '#33424D';
const TEACHING_WIRE_LIGHT = '#DEE8F0';
const TEACHING_WIRE_MID = '#7B8D9C';
const TEACHING_WIRE_GLOW_RGB = '78, 115, 146';
const TEACHING_CURRENT_RGB = '255, 142, 87';

/**
 * 载流导线实体渲染器
 *
 * 直导线：绘制竖直或水平线段 + 电流方向箭头
 * 圆环（2D 截面）：绘制两个圆点表示截面（⊙ 和 ⊗）
 */
const currentWireRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;
  const { position } = entity.transform;

  const current = Math.abs((entity.properties.current as number) ?? 5);
  const wireShape = (entity.properties.wireShape as string) ?? 'straight';

  c.save();

  if (wireShape === 'loop') {
    renderLoopCrossSection(c, position, entity.properties, coordinateTransform, current);
  } else {
    renderStraightWire(c, position, entity.properties, coordinateTransform, current);
  }

  c.restore();
};

function renderStraightWire(
  c: CanvasRenderingContext2D,
  position: { x: number; y: number },
  properties: Record<string, unknown>,
  coordinateTransform: { scale: number; origin: { x: number; y: number } },
  current: number,
): void {
  const width = (properties.width as number) ?? 0.1;
  const height = (properties.height as number) ?? 4;
  const previewEntity = buildPreviewEntity(position, properties);
  const direction = getStraightWireCurrentDirection(previewEntity);
  const paramValues = useSimulationStore.getState().paramValues;
  const hasTeachingView = paramValues.wireViewMode != null;

  if (hasTeachingView) {
    const viewMode = getStraightWireViewMode(paramValues);
    const transition = resolveStraightWireViewTransition(viewMode);

    if (transition.previous && transition.progress < 1) {
      renderTeachingStraightWireVariant(
        c,
        position,
        properties,
        coordinateTransform,
        current,
        direction,
        transition.previous,
        1 - transition.progress,
      );
    }

    renderTeachingStraightWireVariant(
      c,
      position,
      properties,
      coordinateTransform,
      current,
      direction,
      transition.mode,
      transition.progress,
    );
    return;
  }

  // Wire center line
  const centerX = position.x + width / 2;
  const bottom = worldToScreen({ x: centerX, y: position.y }, coordinateTransform);
  const top = worldToScreen({ x: centerX, y: position.y + height }, coordinateTransform);

  // Draw wire line
  c.strokeStyle = WIRE_COLOR;
  c.lineWidth = WIRE_LINE_WIDTH;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(bottom.x, bottom.y);
  c.lineTo(top.x, top.y);
  c.stroke();

  // Current direction arrow at midpoint
  const midScreen = {
    x: (bottom.x + top.x) / 2,
    y: (bottom.y + top.y) / 2,
  };
  const arrowSize = 8;
  c.fillStyle = CURRENT_ARROW_COLOR;
  c.beginPath();
  if (direction === 'up') {
    // Current flows upward (screen: downward Y means upward physical)
    c.moveTo(midScreen.x, midScreen.y - arrowSize);
    c.lineTo(midScreen.x - arrowSize * 0.6, midScreen.y + arrowSize * 0.4);
    c.lineTo(midScreen.x + arrowSize * 0.6, midScreen.y + arrowSize * 0.4);
  } else {
    // Current flows downward
    c.moveTo(midScreen.x, midScreen.y + arrowSize);
    c.lineTo(midScreen.x - arrowSize * 0.6, midScreen.y - arrowSize * 0.4);
    c.lineTo(midScreen.x + arrowSize * 0.6, midScreen.y - arrowSize * 0.4);
  }
  c.closePath();
  c.fill();

  // Label
  c.fillStyle = LABEL_COLOR;
  c.font = '12px Inter, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText(
    `I = ${current}A · ${getStraightWireCurrentDirectionLabel(previewEntity)}`,
    bottom.x + 12,
    midScreen.y,
  );
}

function renderTeachingStraightWireVariant(
  c: CanvasRenderingContext2D,
  position: { x: number; y: number },
  properties: Record<string, unknown>,
  coordinateTransform: { scale: number; origin: { x: number; y: number } },
  current: number,
  direction: 'up' | 'down',
  viewMode: StraightWireViewMode,
  alpha: number,
): void {
  if (alpha <= 0) return;

  const width = (properties.width as number) ?? 0.1;
  const height = (properties.height as number) ?? 4;
  const centerWorld = {
    x: position.x + width / 2,
    y: position.y + height / 2,
  };
  const center = worldToScreen(centerWorld, coordinateTransform);
  const halfHeight = worldLengthToScreen(height / 2, coordinateTransform);
  const strength = getStraightWireVisualStrength(current);
  const time = performance.now() * 0.001;

  c.save();
  c.globalAlpha = alpha;

  if (viewMode === 'isometric') {
    const planeRadiusX = worldLengthToScreen(2.8 + strength.normalized * 0.6, coordinateTransform);
    const planeRadiusY = planeRadiusX * 0.28;
    const planeGradient = c.createRadialGradient(
      center.x,
      center.y - planeRadiusY * 0.3,
      planeRadiusY * 0.12,
      center.x,
      center.y,
      planeRadiusX,
    );
    planeGradient.addColorStop(0, `rgba(255,255,255,${0.94 - strength.normalized * 0.06})`);
    planeGradient.addColorStop(0.45, `rgba(244,248,250,${0.86 - strength.normalized * 0.08})`);
    planeGradient.addColorStop(1, `rgba(228,237,243,${0.82 - strength.normalized * 0.1})`);
    c.fillStyle = planeGradient;
    c.strokeStyle = `rgba(109, 138, 160, ${0.18 + strength.accentAlpha * 0.38})`;
    c.lineWidth = 1.35;
    c.beginPath();
    c.ellipse(center.x, center.y, planeRadiusX, planeRadiusY, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();

    c.setLineDash([10, 8]);
    c.strokeStyle = 'rgba(104, 126, 144, 0.2)';
    c.beginPath();
    c.moveTo(center.x - planeRadiusX * 0.9, center.y);
    c.lineTo(center.x + planeRadiusX * 0.9, center.y);
    c.stroke();
    c.setLineDash([]);

    c.fillStyle = 'rgba(0, 0, 0, 0.08)';
    c.beginPath();
    c.ellipse(
      center.x,
      center.y + planeRadiusY * 0.14,
      strength.wireWidth * 1.5,
      strength.wireWidth * 0.62,
      0,
      0,
      Math.PI * 2,
    );
    c.fill();

    drawTeachingWireBody(
      c,
      center.x,
      center.y - halfHeight * 1.06,
      center.y + halfHeight * 0.92,
      strength,
      direction,
      time,
    );

    drawCurrentArrow(
      c,
      center.x,
      center.y - halfHeight * 0.3,
      direction,
      strength.currentArrowSize,
    );
  }

  if (viewMode === 'top') {
    drawTopWireCap(
      c,
      center.x,
      center.y,
      16 + strength.normalized * 6,
      getStraightWireTopViewCurrentSymbol(direction),
      strength,
    );
  }

  if (viewMode === 'front') {
    drawTeachingWireBody(
      c,
      center.x,
      center.y - halfHeight,
      center.y + halfHeight,
      strength,
      direction,
      time,
    );

    drawCurrentArrow(
      c,
      center.x,
      center.y - halfHeight * 0.1,
      direction,
      strength.currentArrowSize + 1,
    );
  }

  c.restore();
}

function renderLoopCrossSection(
  c: CanvasRenderingContext2D,
  position: { x: number; y: number },
  properties: Record<string, unknown>,
  coordinateTransform: { scale: number; origin: { x: number; y: number } },
  current: number,
): void {
  const paramValues = useSimulationStore.getState().paramValues;
  const hasTeachingView = paramValues.loopViewMode != null;

  if (hasTeachingView) {
    const viewMode = getLoopViewMode(paramValues);
    const transition = resolveLoopViewTransition(viewMode);

    if (transition.previous && transition.progress < 1) {
      renderTeachingLoopVariant(
        c,
        position,
        properties,
        coordinateTransform,
        current,
        transition.previous,
        1 - transition.progress,
      );
    }

    renderTeachingLoopVariant(
      c,
      position,
      properties,
      coordinateTransform,
      current,
      transition.mode,
      transition.progress,
    );
    return;
  }

  const loopRadius = (properties.loopRadius as number) ?? 1;
  const center = worldToScreen(position, coordinateTransform);
  const radiusPx = worldLengthToScreen(loopRadius, coordinateTransform);
  const previewEntity = buildPreviewEntity(position, properties);
  const directions = getLoopCrossSectionDirections(previewEntity);

  // Draw dashed circle representing the loop plane
  c.strokeStyle = WIRE_COLOR;
  c.lineWidth = 1.5;
  c.setLineDash([4, 3]);
  c.beginPath();
  c.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);

  // Two cross-section dots: left = into page (⊗), right = out of page (⊙)
  const dotRadius = 8;
  const leftX = center.x - radiusPx;
  const rightX = center.x + radiusPx;

  c.strokeStyle = CROSS_SECTION_COLOR;
  c.lineWidth = 1.5;
  drawCrossSectionSymbol(c, leftX, center.y, dotRadius, directions.left);
  drawCrossSectionSymbol(c, rightX, center.y, dotRadius, directions.right);

  // Label
  c.fillStyle = LABEL_COLOR;
  c.font = '12px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillText(
    `I = ${current}A · ${getLoopCurrentDirectionLabel(previewEntity)}`,
    center.x,
    center.y + radiusPx + 12,
  );
}

function renderTeachingLoopVariant(
  c: CanvasRenderingContext2D,
  position: { x: number; y: number },
  properties: Record<string, unknown>,
  coordinateTransform: { scale: number; origin: { x: number; y: number } },
  current: number,
  viewMode: LoopViewMode,
  alpha: number,
): void {
  if (alpha <= 0) return;

  const loopRadius = (properties.loopRadius as number) ?? 1;
  const center = worldToScreen(position, coordinateTransform);
  const radiusPx = worldLengthToScreen(loopRadius, coordinateTransform);
  const previewEntity = buildPreviewEntity(position, properties);
  const direction = getLoopCurrentDirection(previewEntity);
  const strength = getLoopVisualStrength(current, loopRadius);

  c.save();
  c.globalAlpha = alpha;

  if (viewMode === 'top') {
    drawTopLoopCoil(c, center.x, center.y, radiusPx, direction, strength);
  } else if (viewMode === 'front') {
    drawFrontLoopCoil(c, center.x, center.y, radiusPx, direction, strength);
  } else {
    drawIsometricLoopCoil(c, center.x, center.y, radiusPx, direction, strength);
  }

  c.restore();
}

function drawTopLoopCoil(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusPx: number,
  direction: 'clockwise' | 'counterclockwise',
  strength: ReturnType<typeof getLoopVisualStrength>,
): void {
  const rimWidth = Math.max(radiusPx * 0.12, 8);

  c.strokeStyle = WIRE_COLOR;
  c.lineWidth = strength.loopLineWidth + rimWidth * 0.16;
  c.beginPath();
  c.arc(x, y, radiusPx, 0, Math.PI * 2);
  c.stroke();

  c.strokeStyle = 'rgba(255,255,255,0.9)';
  c.lineWidth = Math.max(strength.loopLineWidth * 0.45, 1.2);
  c.beginPath();
  c.arc(x, y, radiusPx - rimWidth * 0.28, Math.PI * 0.12, Math.PI * 1.12);
  c.stroke();

  c.fillStyle = `rgba(52, 152, 219, ${strength.centerGlowAlpha})`;
  c.beginPath();
  c.arc(x, y, radiusPx * (0.34 + strength.centerNormalized * 0.08), 0, Math.PI * 2);
  c.fill();

  const arrowAngles = direction === 'counterclockwise'
    ? [Math.PI * 0.2, Math.PI * 0.92, Math.PI * 1.62]
    : [Math.PI * 0.38, Math.PI * 1.08, Math.PI * 1.78];
  for (const angle of arrowAngles) {
    drawLoopCircleArrow(c, x, y, radiusPx, angle, direction, strength.arrowSize);
  }
}

function drawFrontLoopCoil(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusPx: number,
  _direction: 'clockwise' | 'counterclockwise',
  strength: ReturnType<typeof getLoopVisualStrength>,
): void {
  const rx = radiusPx;
  const ry = Math.max(radiusPx * 0.22, 16);

  c.fillStyle = 'rgba(0, 0, 0, 0.05)';
  c.beginPath();
  c.ellipse(x, y + ry * 0.3, rx * 0.9, ry * 0.45, 0, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = 'rgba(120, 120, 120, 0.32)';
  c.lineWidth = strength.loopLineWidth;
  c.setLineDash([8, 6]);
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, Math.PI, Math.PI * 2);
  c.stroke();
  c.setLineDash([]);

  c.strokeStyle = WIRE_COLOR;
  c.lineWidth = strength.loopLineWidth + 0.8;
  c.beginPath();
  c.ellipse(x, y, rx, ry, 0, 0, Math.PI);
  c.stroke();
}

function drawIsometricLoopCoil(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusPx: number,
  direction: 'clockwise' | 'counterclockwise',
  strength: ReturnType<typeof getLoopVisualStrength>,
): void {
  const camera = getLoopCameraState(useSimulationStore.getState().paramValues);
  const center = { x, y };
  const ringWidth = strength.loopLineWidth + 1.15;
  const ringPoints = buildProjectedLoopCircle(center, radiusPx, camera, 120);
  const visibleSegments = getProjectedVisibleSegments(ringPoints, true);
  const bounds = ringPoints.reduce((acc, point) => ({
    minX: Math.min(acc.minX, point.x),
    maxX: Math.max(acc.maxX, point.x),
    minY: Math.min(acc.minY, point.y),
    maxY: Math.max(acc.maxY, point.y),
  }), {
    minX: Number.POSITIVE_INFINITY,
    maxX: Number.NEGATIVE_INFINITY,
    minY: Number.POSITIVE_INFINITY,
    maxY: Number.NEGATIVE_INFINITY,
  });

  c.fillStyle = 'rgba(0, 0, 0, 0.055)';
  c.beginPath();
  c.ellipse(
    (bounds.minX + bounds.maxX) / 2,
    bounds.maxY + Math.max(radiusPx * 0.08, 10),
    Math.max((bounds.maxX - bounds.minX) * 0.34, 28),
    Math.max((bounds.maxY - bounds.minY) * 0.07, 8),
    0,
    0,
    Math.PI * 2,
  );
  c.fill();

  c.strokeStyle = 'rgba(34, 42, 46, 0.1)';
  c.lineWidth = Math.max(ringWidth * 0.9, 2.2);
  c.lineCap = 'round';
  c.setLineDash([7, 7]);
  drawProjectedPath(c, ringPoints, true);
  c.stroke();
  c.setLineDash([]);

  c.strokeStyle = '#3A3A3A';
  c.lineWidth = ringWidth + 0.55;
  c.lineCap = 'round';
  for (const segment of visibleSegments) {
    drawProjectedPath(c, segment, false);
    c.stroke();
  }

  c.strokeStyle = 'rgba(255, 255, 255, 0.32)';
  c.lineWidth = Math.max((ringWidth + 0.4) * 0.16, 1.05);
  for (const segment of visibleSegments) {
    drawProjectedPath(c, segment, false);
    c.stroke();
  }

  const arrowCandidates = [0.08, 0.24, 0.42, 0.62, 0.82].map((ratio) => ratio * Math.PI * 2);
  let arrowCount = 0;
  for (const angle of arrowCandidates) {
    if (drawProjectedLoopArrow(c, center, radiusPx, camera, angle, direction, strength.arrowSize * 0.78)) {
      arrowCount += 1;
    }
    if (arrowCount >= 3) break;
  }

  if (arrowCount === 0) {
    drawProjectedLoopArrow(
      c,
      center,
      radiusPx,
      camera,
      Math.PI * 0.22,
      direction,
      strength.arrowSize * 0.78,
      true,
    );
  }
}

function drawCrossSectionSymbol(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  direction: 'into' | 'out',
): void {
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.stroke();

  if (direction === 'out') {
    c.fillStyle = CROSS_SECTION_COLOR;
    c.beginPath();
    c.arc(x, y, 2.5, 0, Math.PI * 2);
    c.fill();
    return;
  }

  c.beginPath();
  c.moveTo(x - radius * 0.6, y - radius * 0.6);
  c.lineTo(x + radius * 0.6, y + radius * 0.6);
  c.moveTo(x + radius * 0.6, y - radius * 0.6);
  c.lineTo(x - radius * 0.6, y + radius * 0.6);
  c.stroke();
}

function drawTeachingWireBody(
  c: CanvasRenderingContext2D,
  x: number,
  topY: number,
  bottomY: number,
  strength: ReturnType<typeof getStraightWireVisualStrength>,
  direction: 'up' | 'down',
  time: number,
): void {
  c.save();
  c.strokeStyle = rgbaValue(TEACHING_WIRE_GLOW_RGB, 0.12 + strength.wireGlowAlpha * 0.48);
  c.shadowColor = rgbaValue(TEACHING_WIRE_GLOW_RGB, 0.16 + strength.wireGlowAlpha * 0.5);
  c.shadowBlur = strength.wireHaloWidth;
  c.lineWidth = strength.wireWidth + 4.6;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, bottomY);
  c.lineTo(x, topY);
  c.stroke();
  c.restore();

  c.save();
  const wireGradient = c.createLinearGradient(x - strength.wireWidth, 0, x + strength.wireWidth, 0);
  wireGradient.addColorStop(0, TEACHING_WIRE_DARK);
  wireGradient.addColorStop(0.28, TEACHING_WIRE_MID);
  wireGradient.addColorStop(0.52, TEACHING_WIRE_LIGHT);
  wireGradient.addColorStop(0.68, '#A6B5C1');
  wireGradient.addColorStop(1, TEACHING_WIRE_DARK);
  c.strokeStyle = wireGradient;
  c.lineWidth = strength.wireWidth;
  c.lineCap = 'round';
  c.beginPath();
  c.moveTo(x, bottomY);
  c.lineTo(x, topY);
  c.stroke();

  c.strokeStyle = 'rgba(255,255,255,0.46)';
  c.lineWidth = Math.max(1.1, strength.wireWidth * 0.16);
  c.beginPath();
  c.moveTo(x - strength.wireWidth * 0.18, bottomY - 4);
  c.lineTo(x - strength.wireWidth * 0.18, topY + 4);
  c.stroke();
  c.restore();

  drawCurrentFlowSegments(c, x + strength.wireWidth * 0.22, topY, bottomY, direction, time, strength);
}

function drawCurrentFlowSegments(
  c: CanvasRenderingContext2D,
  x: number,
  topY: number,
  bottomY: number,
  direction: 'up' | 'down',
  time: number,
  strength: ReturnType<typeof getStraightWireVisualStrength>,
): void {
  const count = 3 + Math.round(strength.normalized * 2);
  const segmentLength = 16 + strength.normalized * 12;
  const padding = 14;
  const travel = Math.max(6, bottomY - topY - padding * 2);

  for (let index = 0; index < count; index += 1) {
    const loopProgress = (time * (0.28 + strength.particleSpeed * 0.42) + index / count) % 1;
    const progress = direction === 'up' ? 1 - loopProgress : loopProgress;
    const centerY = topY + padding + progress * travel;

    c.save();
    c.strokeStyle = rgbaValue(TEACHING_CURRENT_RGB, 0.2 + strength.currentFlowOpacity * 0.75);
    c.shadowColor = rgbaValue(TEACHING_CURRENT_RGB, 0.34 + strength.currentFlowOpacity * 0.7);
    c.shadowBlur = 10 + strength.normalized * 6;
    c.lineWidth = 2.4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(x, centerY - segmentLength * 0.5);
    c.lineTo(x, centerY + segmentLength * 0.5);
    c.stroke();
    c.restore();
  }
}

function drawTopWireCap(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  direction: 'into' | 'out',
  strength: ReturnType<typeof getStraightWireVisualStrength>,
): void {
  c.save();
  c.shadowColor = rgbaValue(TEACHING_WIRE_GLOW_RGB, 0.18 + strength.wireGlowAlpha * 0.54);
  c.shadowBlur = 14 + strength.normalized * 8;
  const shellGradient = c.createRadialGradient(
    x - radius * 0.25,
    y - radius * 0.3,
    radius * 0.16,
    x,
    y,
    radius * 1.08,
  );
  shellGradient.addColorStop(0, 'rgba(255,255,255,0.98)');
  shellGradient.addColorStop(0.34, TEACHING_WIRE_LIGHT);
  shellGradient.addColorStop(0.68, '#94A6B5');
  shellGradient.addColorStop(1, TEACHING_WIRE_DARK);
  c.fillStyle = shellGradient;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.fill();
  c.restore();

  c.save();
  c.strokeStyle = 'rgba(70, 94, 112, 0.42)';
  c.lineWidth = 2;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.stroke();

  c.strokeStyle = 'rgba(255,255,255,0.62)';
  c.lineWidth = 1.2;
  c.beginPath();
  c.arc(x, y, radius * 0.76, Math.PI * 1.05, Math.PI * 1.88);
  c.stroke();
  c.restore();

  drawTeachingSectionSymbol(c, x, y, radius - 4, direction, 1);
}

function drawTeachingSectionSymbol(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  direction: 'into' | 'out',
  alpha: number,
): void {
  c.save();
  c.globalAlpha = alpha;
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.beginPath();
  c.arc(x, y, radius * 1.08, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = 'rgba(66, 88, 104, 0.42)';
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(x, y, radius, 0, Math.PI * 2);
  c.stroke();

  if (direction === 'out') {
    c.fillStyle = rgbaValue(TEACHING_CURRENT_RGB, 1);
    c.shadowColor = rgbaValue(TEACHING_CURRENT_RGB, 0.55);
    c.shadowBlur = 10;
    c.beginPath();
    c.arc(x, y, Math.max(radius * 0.28, 3), 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }

  c.strokeStyle = rgbaValue(TEACHING_CURRENT_RGB, 1);
  c.shadowColor = rgbaValue(TEACHING_CURRENT_RGB, 0.42);
  c.shadowBlur = 8;
  c.lineWidth = 2.2;
  c.beginPath();
  c.moveTo(x - radius * 0.5, y - radius * 0.5);
  c.lineTo(x + radius * 0.5, y + radius * 0.5);
  c.moveTo(x + radius * 0.5, y - radius * 0.5);
  c.lineTo(x - radius * 0.5, y + radius * 0.5);
  c.stroke();
  c.restore();
}

function drawCurrentArrow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  direction: 'up' | 'down',
  size: number,
): void {
  const shaft = size * 1.7;
  const shaftGradient = c.createLinearGradient(x, y + shaft * 0.8, x, y - shaft * 0.8);
  shaftGradient.addColorStop(0, rgbaValue(TEACHING_CURRENT_RGB, 0.78));
  shaftGradient.addColorStop(0.5, rgbaValue(TEACHING_CURRENT_RGB, 1));
  shaftGradient.addColorStop(1, rgbaValue(TEACHING_CURRENT_RGB, 0.82));

  c.save();
  c.strokeStyle = shaftGradient;
  c.fillStyle = rgbaValue(TEACHING_CURRENT_RGB, 1);
  c.shadowColor = rgbaValue(TEACHING_CURRENT_RGB, 0.42);
  c.shadowBlur = 12;
  c.lineWidth = 3;
  c.lineCap = 'round';
  c.beginPath();

  if (direction === 'up') {
    c.moveTo(x, y + shaft * 0.45);
    c.lineTo(x, y - shaft * 0.45);
  } else {
    c.moveTo(x, y - shaft * 0.45);
    c.lineTo(x, y + shaft * 0.45);
  }
  c.stroke();

  c.shadowBlur = 0;
  c.beginPath();
  if (direction === 'up') {
    c.moveTo(x, y - shaft * 0.45 - size * 0.4);
    c.lineTo(x - size * 0.55, y - shaft * 0.45 + size * 0.1);
    c.lineTo(x + size * 0.55, y - shaft * 0.45 + size * 0.1);
  } else {
    c.moveTo(x, y + shaft * 0.45 + size * 0.4);
    c.lineTo(x - size * 0.55, y + shaft * 0.45 - size * 0.1);
    c.lineTo(x + size * 0.55, y + shaft * 0.45 - size * 0.1);
  }
  c.closePath();
  c.fill();

  c.strokeStyle = 'rgba(255,255,255,0.46)';
  c.lineWidth = 1.1;
  c.beginPath();
  if (direction === 'up') {
    c.moveTo(x - 0.8, y + shaft * 0.3);
    c.lineTo(x - 0.8, y - shaft * 0.2);
  } else {
    c.moveTo(x - 0.8, y - shaft * 0.3);
    c.lineTo(x - 0.8, y + shaft * 0.2);
  }
  c.stroke();
  c.restore();
}

function drawLoopCircleArrow(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  direction: 'clockwise' | 'counterclockwise',
  size: number,
): void {
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);
  const tangentAngle = direction === 'counterclockwise'
    ? angle - Math.PI / 2
    : angle + Math.PI / 2;
  drawTriangleArrow(c, x, y, tangentAngle, size);
}

function buildProjectedLoopCircle(
  center: { x: number; y: number },
  radiusPx: number,
  camera: ReturnType<typeof getLoopCameraState>,
  sampleCount: number,
): ProjectedLoopPoint[] {
  const points: ProjectedLoopPoint[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const angle = (index / sampleCount) * Math.PI * 2;
    points.push(projectLoopPoint({
      x: radiusPx * Math.cos(angle),
      y: radiusPx * Math.sin(angle),
      z: 0,
    }, center, camera));
  }
  return points;
}

function drawProjectedPath(
  c: CanvasRenderingContext2D,
  points: ProjectedLoopPoint[],
  closePath: boolean,
): void {
  if (points.length < 2) return;
  c.beginPath();
  c.moveTo(points[0]!.x, points[0]!.y);
  for (let index = 1; index < points.length; index += 1) {
    c.lineTo(points[index]!.x, points[index]!.y);
  }
  if (closePath) {
    c.closePath();
  }
}

function drawProjectedLoopArrow(
  c: CanvasRenderingContext2D,
  center: { x: number; y: number },
  radiusPx: number,
  camera: ReturnType<typeof getLoopCameraState>,
  angle: number,
  direction: 'clockwise' | 'counterclockwise',
  size: number,
  force = false,
): boolean {
  const point3D: LoopPoint3D = {
    x: radiusPx * Math.cos(angle),
    y: radiusPx * Math.sin(angle),
    z: 0,
  };
  const tangent: LoopPoint3D = direction === 'counterclockwise'
    ? { x: -Math.sin(angle), y: Math.cos(angle), z: 0 }
    : { x: Math.sin(angle), y: -Math.cos(angle), z: 0 };
  const head = projectLoopPoint(point3D, center, camera);
  if (!force && head.depth < -radiusPx * 0.04) {
    return false;
  }
  const tail = projectLoopPoint(
    {
      x: point3D.x - tangent.x * size * 1.9,
      y: point3D.y - tangent.y * size * 1.9,
      z: point3D.z - tangent.z * size * 1.9,
    },
    center,
    camera,
  );
  drawTriangleArrow(c, head.x, head.y, Math.atan2(head.y - tail.y, head.x - tail.x), size);
  return true;
}

function drawTriangleArrow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  size: number,
): void {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.fillStyle = CURRENT_ARROW_COLOR;
  c.beginPath();
  c.moveTo(size, 0);
  c.lineTo(-size * 0.5, -size * 0.45);
  c.lineTo(-size * 0.5, size * 0.45);
  c.closePath();
  c.fill();
  c.restore();
}

function buildPreviewEntity(
  position: { x: number; y: number },
  properties: Record<string, unknown>,
): Entity {
  return {
    id: 'preview',
    type: 'current-wire',
    category: 'field',
    transform: { position, rotation: 0 },
    properties,
  };
}

function rgbaValue(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${Math.max(0, Math.min(alpha, 1))})`;
}

export function registerCurrentWireRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'current-wire',
    renderer: currentWireRenderer,
    layer: 'field',
  });
}
