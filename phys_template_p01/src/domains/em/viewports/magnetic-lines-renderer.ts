import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import type { Entity, Vec2 } from '@/core/types';
import { useSimulationStore } from '@/store';
import {
  getLoopCenterFieldDirectionLabel,
  getLoopCurrentDirection,
  getLoopCrossSectionDirections,
  getStraightWireCurrentDirection,
  getSolenoidFieldDirection,
} from '../logic/current-direction';
import { buildSolenoidSceneGeometry } from '../logic/solenoid-teaching';
import {
  computeLoopCenterField,
  getLoopFrontAxisDirection,
  getLoopFrontAxisLabel,
  getLoopTopFieldLabel,
  getLoopTopFieldSymbol,
  getLoopViewMode,
  getLoopVisualStrength,
  resolveLoopViewTransition,
  type LoopViewMode,
} from '../logic/loop-current-teaching';
import {
  getLoopCameraState,
  getLoopShowAuxiliaryLabels,
  getProjectedVisibleSegments,
  projectLoopPoint,
  type ProjectedLoopPoint,
} from '../logic/loop-current-3d';
import { traceLoopFieldLinePlanePoints } from '../logic/loop-lab-visuals';
import {
  getStraightWireFrontViewSides,
  getStraightWireReferenceRadius,
  getStraightWireViewMode,
  getStraightWireVisualStrength,
  resolveStraightWireViewTransition,
  type StraightWireViewMode,
} from '../logic/straight-wire-teaching';

/** 磁感线颜色 */
const BLINE_COLOR = '#3498DB';
/** 磁感线标注颜色 */
const BLINE_LABEL_COLOR = '#2980B9';
/** 箭头大小（像素） */
const ARROW_SIZE = 6;
const BLINE_RGB = '52, 152, 219';
const BLINE_LABEL_RGB = '41, 128, 185';

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * 磁感线渲染子模块
 *
 * 根据载流导线/螺线管类型绘制磁感线：
 * - 直导线：同心圆弧 + 右手定则方向箭头
 * - 圆环截面：偶极子型磁感线
 * - 螺线管：内部平行线 + 外部回路线
 */
export function renderMagneticLines(
  c: CanvasRenderingContext2D,
  entity: Entity,
  coordinateTransform: { scale: number; origin: Vec2 },
): void {
  const entityType = entity.type;
  const wireShape = entity.properties.wireShape as string | undefined;

  if (entityType === 'current-wire') {
    if (wireShape === 'loop') {
      renderLoopFieldLines(c, entity, coordinateTransform);
    } else {
      renderStraightWireFieldLines(c, entity, coordinateTransform);
    }
  } else if (entityType === 'solenoid') {
    renderSolenoidFieldLines(c, entity, coordinateTransform);
  }
}

// ── Straight wire: concentric circular arcs ──

function renderStraightWireFieldLines(
  c: CanvasRenderingContext2D,
  entity: Entity,
  ct: { scale: number; origin: Vec2 },
): void {
  const paramValues = useSimulationStore.getState().paramValues;
  if (paramValues.wireViewMode != null) {
    const viewMode = getStraightWireViewMode(paramValues);
    const transition = resolveStraightWireViewTransition(viewMode);

    if (transition.previous && transition.progress < 1) {
      renderTeachingStraightWireFieldLinesVariant(
        c,
        entity,
        ct,
        transition.previous,
        1 - transition.progress,
      );
    }

    renderTeachingStraightWireFieldLinesVariant(
      c,
      entity,
      ct,
      transition.mode,
      transition.progress,
    );
    return;
  }

  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 0.1;
  const height = (entity.properties.height as number) ?? (entity.properties.length as number) ?? 4;

  // Wire center in physical coords
  const wireCenterPhys = { x: position.x + width / 2, y: position.y + height / 2 };
  const wireCenter = worldToScreen(wireCenterPhys, ct);

  // Teaching top view is true top-down: current down → into screen → clockwise on screen.
  const clockwise = getStraightWireCurrentDirection(entity) === 'down';

  // 6 concentric arcs with increasing radius
  const radii = [0.3, 0.5, 0.8, 1.2, 1.7, 2.3];

  c.save();
  c.strokeStyle = BLINE_COLOR;
  c.lineWidth = 1.2;

  for (const r of radii) {
    const rPx = worldLengthToScreen(r, ct);
    // Draw arc (270° to show it's not a full circle, leaving gap for arrow)
    const startAngle = 0;
    const endAngle = Math.PI * 1.75;

    c.beginPath();
    c.arc(wireCenter.x, wireCenter.y, rPx, startAngle, endAngle, !clockwise);
    c.stroke();

    // Arrow at the end of the arc
    const arrowAngle = clockwise ? endAngle : -endAngle + Math.PI * 2;
    const ax = wireCenter.x + rPx * Math.cos(arrowAngle);
    const ay = wireCenter.y + rPx * Math.sin(arrowAngle);

    // Tangent direction for arrow
    const tangentAngle = clockwise ? arrowAngle + Math.PI / 2 : arrowAngle - Math.PI / 2;
    drawArrowHead(c, ax, ay, tangentAngle);
  }

  // Label near the first arc
  const labelR = worldLengthToScreen(radii[1] ?? 0.5, ct);
  c.fillStyle = BLINE_LABEL_COLOR;
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'bottom';
  c.fillText(
    `B=μ₀I/(2πr) · ${clockwise ? '顺时针' : '逆时针'}`,
    wireCenter.x + labelR + 8,
    wireCenter.y - 4,
  );

  c.restore();
}

function renderTeachingStraightWireFieldLinesVariant(
  c: CanvasRenderingContext2D,
  entity: Entity,
  ct: { scale: number; origin: Vec2 },
  viewMode: StraightWireViewMode,
  alpha: number,
): void {
  if (alpha <= 0) return;

  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 0.1;
  const height = (entity.properties.height as number) ?? (entity.properties.length as number) ?? 4;
  const centerWorld = { x: position.x + width / 2, y: position.y + height / 2 };
  const center = worldToScreen(centerWorld, ct);
  const current = Math.abs((entity.properties.current as number) ?? 5);
  const direction = getStraightWireCurrentDirection(entity);
  const strength = getStraightWireVisualStrength(current);
  const referenceRadius = getStraightWireReferenceRadius(useSimulationStore.getState().paramValues);

  c.save();
  c.globalAlpha = alpha;

  if (viewMode === 'isometric') {
    renderIsometricStraightWireFieldLines(c, center, ct, direction, strength);
  } else if (viewMode === 'top') {
    renderTopStraightWireFieldLines(c, center, ct, direction, strength);
  } else {
    renderFrontStraightWireFieldLines(c, center, ct, direction, strength);
  }

  drawStraightWireReferenceHalo(c, center, ct, direction, strength, viewMode, referenceRadius);
  c.restore();
}

function renderIsometricStraightWireFieldLines(
  c: CanvasRenderingContext2D,
  center: Vec2,
  ct: { scale: number; origin: Vec2 },
  direction: 'up' | 'down',
  strength: ReturnType<typeof getStraightWireVisualStrength>,
): void {
  const clockwise = direction === 'down';
  const ringCount = strength.ringCount;
  const minRadiusWorld = 0.42;
  const step = (strength.maxRadiusWorld - minRadiusWorld) / Math.max(ringCount - 1, 1);
  const time = performance.now() * 0.001;
  const glowRadiusX = worldLengthToScreen(strength.maxRadiusWorld * 1.08, ct);
  const glowRadiusY = glowRadiusX * 0.42;

  c.save();
  c.fillStyle = buildEllipticalGlow(
    c,
    center.x,
    center.y,
    glowRadiusX,
    glowRadiusY,
    strength.glowAlpha * 0.78,
  );
  c.beginPath();
  c.ellipse(center.x, center.y, glowRadiusX, glowRadiusY, 0, 0, Math.PI * 2);
  c.fill();
  c.restore();

  for (let index = 0; index < ringCount; index += 1) {
    const radiusWorld = minRadiusWorld + step * index;
    const radiusPx = worldLengthToScreen(radiusWorld, ct);
    const radiusYPx = radiusPx * (0.21 + strength.fieldSpread * 0.1);
    const depthFactor = 1 - index / Math.max(ringCount - 1, 1);
    const opacity = Math.max(0.08, strength.strokeAlpha * (0.28 + depthFactor * 0.9));

    c.save();
    c.strokeStyle = rgba(BLINE_RGB, opacity);
    c.lineWidth = Math.max(1, strength.lineWidth * (0.54 + depthFactor * 0.9));
    c.shadowColor = rgba(BLINE_RGB, strength.glowAlpha * (0.18 + depthFactor * 0.42));
    c.shadowBlur = 5 + depthFactor * (10 + strength.normalized * 9);
    c.beginPath();
    c.ellipse(center.x, center.y, radiusPx, radiusYPx, 0, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    drawEllipseArrow(
      c,
      center.x,
      center.y,
      radiusPx,
      radiusYPx,
      clockwise ? Math.PI * (0.1 + index * 0.03) : Math.PI * (0.9 - index * 0.03),
      clockwise,
      {
        color: rgba(BLINE_RGB, Math.min(0.96, opacity + 0.18)),
        size: strength.arrowSize * (0.72 + depthFactor * 0.4),
      },
    );

    drawStraightWireOrbitParticles(
      c,
      center.x,
      center.y,
      radiusPx,
      radiusYPx,
      clockwise,
      time,
      strength,
      index,
      depthFactor,
    );
  }

  drawStraightWireGuideArc(
    c,
    center.x,
    center.y,
    worldLengthToScreen(Math.min(strength.maxRadiusWorld * 0.88, 2.3), ct),
    worldLengthToScreen(Math.min(strength.maxRadiusWorld * 0.88, 2.3), ct) * (0.21 + strength.fieldSpread * 0.1),
    clockwise,
    strength,
  );
}

function renderTopStraightWireFieldLines(
  c: CanvasRenderingContext2D,
  center: Vec2,
  ct: { scale: number; origin: Vec2 },
  direction: 'up' | 'down',
  strength: ReturnType<typeof getStraightWireVisualStrength>,
): void {
  const clockwise = direction === 'down';
  const ringCount = strength.ringCount;
  const minRadiusWorld = 0.34;
  const step = (strength.maxRadiusWorld - minRadiusWorld) / Math.max(ringCount - 1, 1);
  const time = performance.now() * 0.001;
  const glowRadius = worldLengthToScreen(strength.maxRadiusWorld * 1.04, ct);

  c.save();
  const glow = c.createRadialGradient(center.x, center.y, glowRadius * 0.04, center.x, center.y, glowRadius);
  glow.addColorStop(0, rgba(BLINE_RGB, strength.glowAlpha * 0.62));
  glow.addColorStop(0.42, rgba(BLINE_RGB, strength.glowAlpha * 0.22));
  glow.addColorStop(1, rgba(BLINE_RGB, 0));
  c.fillStyle = glow;
  c.beginPath();
  c.arc(center.x, center.y, glowRadius, 0, Math.PI * 2);
  c.fill();
  c.restore();

  for (let index = 0; index < ringCount; index += 1) {
    const radiusWorld = minRadiusWorld + step * index;
    const radiusPx = worldLengthToScreen(radiusWorld, ct);
    const depthFactor = 1 - index / Math.max(ringCount - 1, 1);
    const opacity = Math.max(0.08, strength.strokeAlpha * (0.28 + depthFactor * 0.92));

    c.save();
    c.strokeStyle = rgba(BLINE_RGB, opacity);
    c.lineWidth = Math.max(1, strength.lineWidth * (0.58 + depthFactor * 0.88));
    c.shadowColor = rgba(BLINE_RGB, strength.glowAlpha * (0.22 + depthFactor * 0.44));
    c.shadowBlur = 5 + depthFactor * (9 + strength.normalized * 10);
    c.beginPath();
    c.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
    c.stroke();
    c.restore();

    drawCircleArrow(
      c,
      center.x,
      center.y,
      radiusPx,
      clockwise ? Math.PI * (0.14 + index * 0.035) : Math.PI * (0.86 - index * 0.035),
      clockwise,
      {
        color: rgba(BLINE_RGB, Math.min(0.96, opacity + 0.18)),
        size: strength.arrowSize * (0.76 + depthFactor * 0.38),
      },
    );

    drawStraightWireOrbitParticles(
      c,
      center.x,
      center.y,
      radiusPx,
      radiusPx,
      clockwise,
      time,
      strength,
      index,
      depthFactor,
    );
  }

  drawStraightWireGuideArc(
    c,
    center.x,
    center.y,
    worldLengthToScreen(Math.min(strength.maxRadiusWorld * 0.82, 2.1), ct),
    worldLengthToScreen(Math.min(strength.maxRadiusWorld * 0.82, 2.1), ct),
    clockwise,
    strength,
  );
}

function renderFrontStraightWireFieldLines(
  c: CanvasRenderingContext2D,
  center: Vec2,
  ct: { scale: number; origin: Vec2 },
  direction: 'up' | 'down',
  strength: ReturnType<typeof getStraightWireVisualStrength>,
): void {
  const sides = getStraightWireFrontViewSides(direction);
  const columnCount = Math.max(3, strength.symbolColumns - 1);
  const rowCount = Math.max(4, strength.symbolRows - 1);
  const columnGap = 34 + strength.normalized * 4;
  const rowGap = 30;
  const startOffset = worldLengthToScreen(0.66, ct);
  const halfRows = (rowCount - 1) / 2;

  drawStraightWireFrontBands(c, center, startOffset, columnGap, rowGap, columnCount, rowCount, strength);

  for (let column = 0; column < columnCount; column += 1) {
    for (let row = 0; row < rowCount; row += 1) {
      const distanceScale = Math.max(0.24, 1 - column * 0.18);
      const y = center.y + (row - halfRows) * rowGap;
      const leftX = center.x - startOffset - column * columnGap;
      const rightX = center.x + startOffset + column * columnGap;
      const alpha = strength.strokeAlpha * (0.18 + distanceScale * 0.9);
      const size = strength.symbolSize * (0.74 + distanceScale * 0.64);

      drawStraightWireSectionSymbol(c, leftX, y, size, sides.left, alpha, column <= 1);
      drawStraightWireSectionSymbol(c, rightX, y, size, sides.right, alpha, column <= 1);
    }
  }
}

function drawStraightWireReferenceHalo(
  c: CanvasRenderingContext2D,
  center: Vec2,
  ct: { scale: number; origin: Vec2 },
  direction: 'up' | 'down',
  strength: ReturnType<typeof getStraightWireVisualStrength>,
  viewMode: StraightWireViewMode,
  referenceRadius: number,
): void {
  const referenceOffset = worldLengthToScreen(referenceRadius, ct);
  const marker = getStraightWireReferenceScreenPoint(center, referenceOffset, viewMode);
  const markerOpacity = Math.min(0.94, strength.strokeAlpha + 0.24);

  c.save();
  if (viewMode === 'front') {
    const sides = getStraightWireFrontViewSides(direction);
    drawStraightWireSectionSymbol(
      c,
      marker.x,
      marker.y,
      strength.symbolSize + 3.4,
      sides.right,
      markerOpacity,
      true,
    );
    c.strokeStyle = rgba(BLINE_LABEL_RGB, 0.22 + strength.accentAlpha * 0.44);
    c.lineWidth = 1.1;
    c.setLineDash([4, 4]);
    c.beginPath();
    c.moveTo(center.x + 8, center.y);
    c.lineTo(marker.x - 10, marker.y);
    c.stroke();
    c.setLineDash([]);
  } else {
    c.fillStyle = rgba(BLINE_RGB, markerOpacity);
    c.shadowColor = rgba(BLINE_RGB, strength.glowAlpha * 0.7);
    c.shadowBlur = 12 + strength.normalized * 10;
    c.beginPath();
    c.arc(marker.x, marker.y, 4.8 + strength.normalized * 2.6, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

function buildEllipticalGlow(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  alpha: number,
): CanvasGradient {
  const gradient = c.createRadialGradient(x, y, radiusY * 0.08, x, y, radiusX);
  gradient.addColorStop(0, rgba(BLINE_RGB, alpha));
  gradient.addColorStop(0.42, rgba(BLINE_RGB, alpha * 0.28));
  gradient.addColorStop(1, rgba(BLINE_RGB, 0));
  return gradient;
}

function drawStraightWireOrbitParticles(
  c: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radiusX: number,
  radiusY: number,
  clockwise: boolean,
  time: number,
  strength: ReturnType<typeof getStraightWireVisualStrength>,
  index: number,
  depthFactor: number,
): void {
  const count = Math.max(1, Math.round(strength.particleCount * (0.7 + depthFactor * 0.75)));
  const directionSign = clockwise ? 1 : -1;

  for (let particle = 0; particle < count; particle += 1) {
    const angle = directionSign * time * (0.8 + strength.particleSpeed * (1 + depthFactor * 0.36))
      + index * 0.72
      + (particle / count) * Math.PI * 2;
    const x = centerX + radiusX * Math.cos(angle);
    const y = centerY + radiusY * Math.sin(angle);
    const particleRadius = Math.max(1.4, 1.8 + depthFactor * 1.9);
    const opacity = Math.max(0.08, strength.glowAlpha * (0.34 + depthFactor * 0.56));

    c.save();
    c.fillStyle = rgba(BLINE_RGB, opacity);
    c.shadowColor = rgba(BLINE_RGB, opacity * 1.2);
    c.shadowBlur = 8 + depthFactor * 10;
    c.beginPath();
    c.arc(x, y, particleRadius, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
}

function drawStraightWireGuideArc(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  radiusX: number,
  radiusY: number,
  clockwise: boolean,
  strength: ReturnType<typeof getStraightWireVisualStrength>,
): void {
  const startAngle = clockwise ? Math.PI * 0.08 : Math.PI * 0.92;
  const endAngle = clockwise ? Math.PI * 0.84 : Math.PI * 1.68;

  c.save();
  c.strokeStyle = rgba(BLINE_LABEL_RGB, strength.guideAlpha * 0.46);
  c.lineWidth = 1.4;
  c.setLineDash([10, 10]);
  c.beginPath();
  c.ellipse(x, y, radiusX, radiusY, 0, startAngle, endAngle, !clockwise);
  c.stroke();
  c.setLineDash([]);

  drawEllipseArrow(
    c,
    x,
    y,
    radiusX,
    radiusY,
    clockwise ? Math.PI * 0.84 : Math.PI * 1.16,
    clockwise,
    {
      color: rgba(BLINE_LABEL_RGB, strength.guideAlpha * 0.92),
      size: strength.arrowSize + 1.4,
    },
  );
  c.restore();
}

function drawStraightWireFrontBands(
  c: CanvasRenderingContext2D,
  center: Vec2,
  startOffset: number,
  columnGap: number,
  rowGap: number,
  columnCount: number,
  rowCount: number,
  strength: ReturnType<typeof getStraightWireVisualStrength>,
): void {
  const bandHeight = rowGap * (rowCount + 0.68);
  const bandWidth = columnGap * (columnCount - 0.05);
  const bandRadius = 18;

  const leftX = center.x - startOffset - bandWidth;
  const rightX = center.x + startOffset;
  const topY = center.y - bandHeight / 2;

  c.save();
  fillRoundedRect(
    c,
    leftX,
    topY,
    bandWidth,
    bandHeight,
    bandRadius,
    buildBandGradient(c, leftX, bandWidth, topY, strength.frontBandAlpha, true),
  );
  fillRoundedRect(
    c,
    rightX,
    topY,
    bandWidth,
    bandHeight,
    bandRadius,
    buildBandGradient(c, rightX, bandWidth, topY, strength.frontBandAlpha, false),
  );
  c.strokeStyle = rgba(BLINE_LABEL_RGB, 0.1 + strength.accentAlpha * 0.18);
  c.lineWidth = 1;
  buildRoundedRectPath(c, leftX, topY, bandWidth, bandHeight, bandRadius);
  c.stroke();
  buildRoundedRectPath(c, rightX, topY, bandWidth, bandHeight, bandRadius);
  c.stroke();

  c.strokeStyle = rgba(BLINE_LABEL_RGB, 0.14 + strength.accentAlpha * 0.24);
  c.lineWidth = 1.2;
  c.setLineDash([6, 8]);
  c.beginPath();
  c.moveTo(leftX + bandWidth, topY + 12);
  c.lineTo(leftX + bandWidth, topY + bandHeight - 12);
  c.moveTo(rightX, topY + 12);
  c.lineTo(rightX, topY + bandHeight - 12);
  c.stroke();
  c.setLineDash([]);
  c.restore();
}

function buildBandGradient(
  c: CanvasRenderingContext2D,
  x: number,
  width: number,
  topY: number,
  alpha: number,
  isLeft: boolean,
): CanvasGradient {
  const gradient = c.createLinearGradient(
    isLeft ? x : x + width,
    topY,
    isLeft ? x + width : x,
    topY,
  );
  gradient.addColorStop(0, rgba(BLINE_RGB, alpha * 0.08));
  gradient.addColorStop(0.55, rgba(BLINE_RGB, alpha * (isLeft ? 0.18 : 0.16)));
  gradient.addColorStop(1, rgba(BLINE_RGB, alpha * 0.46));
  return gradient;
}

function drawStraightWireSectionSymbol(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  direction: 'into' | 'out',
  alpha: number,
  emphasize: boolean,
): void {
  c.save();
  c.globalAlpha = alpha;
  c.shadowColor = rgba(BLINE_RGB, emphasize ? 0.28 : 0.18);
  c.shadowBlur = emphasize ? 12 : 8;
  c.fillStyle = 'rgba(255,255,255,0.92)';
  c.beginPath();
  c.arc(x, y, size * 1.18, 0, Math.PI * 2);
  c.fill();

  c.strokeStyle = rgba(BLINE_RGB, emphasize ? 0.92 : 0.78);
  c.lineWidth = emphasize ? 2.2 : 1.7;
  c.beginPath();
  c.arc(x, y, size, 0, Math.PI * 2);
  c.stroke();

  if (direction === 'out') {
    c.fillStyle = rgba(BLINE_RGB, 0.96);
    c.beginPath();
    c.arc(x, y, Math.max(2.6, size * 0.32), 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }

  c.strokeStyle = rgba(BLINE_RGB, 0.96);
  c.lineWidth = emphasize ? 2.4 : 2;
  c.beginPath();
  c.moveTo(x - size * 0.46, y - size * 0.46);
  c.lineTo(x + size * 0.46, y + size * 0.46);
  c.moveTo(x + size * 0.46, y - size * 0.46);
  c.lineTo(x - size * 0.46, y + size * 0.46);
  c.stroke();
  c.restore();
}

function getStraightWireReferenceScreenPoint(
  center: Vec2,
  referenceOffset: number,
  viewMode: StraightWireViewMode,
): Vec2 {
  if (viewMode === 'isometric') {
    return {
      x: center.x + referenceOffset * 0.94,
      y: center.y - referenceOffset * 0.22,
    };
  }
  return {
    x: center.x + referenceOffset,
    y: center.y,
  };
}

function renderTeachingLoopFieldLinesVariant(
  c: CanvasRenderingContext2D,
  entity: Entity,
  ct: { scale: number; origin: Vec2 },
  viewMode: LoopViewMode,
  alpha: number,
): void {
  if (alpha <= 0) return;

  const loopRadius = (entity.properties.loopRadius as number) ?? 1;
  const center = worldToScreen(entity.transform.position, ct);
  const radiusPx = worldLengthToScreen(loopRadius, ct);
  const current = Math.abs((entity.properties.current as number) ?? 5);
  const direction = getLoopCurrentDirection(entity);
  const paramValues = useSimulationStore.getState().paramValues;
  const camera = getLoopCameraState(paramValues);
  const showAuxiliaryLabels = getLoopShowAuxiliaryLabels(paramValues);
  const strength = getLoopVisualStrength(
    current,
    loopRadius,
  );

  c.save();
  c.globalAlpha = alpha;

  if (viewMode === 'top') {
    renderTopLoopFieldLines(c, center, radiusPx, direction, strength);
  } else if (viewMode === 'front') {
    renderFrontLoopFieldLines(c, center, radiusPx, direction, strength);
  } else {
    renderIsometricLoopFieldLines(
      c,
      center,
      radiusPx,
      loopRadius,
      current,
      direction,
      strength,
      camera,
      showAuxiliaryLabels,
    );
  }

  if (showAuxiliaryLabels && viewMode !== 'isometric') {
    drawLoopReferenceLabel(c, center, radiusPx, entity, direction, viewMode, strength);
  }
  c.restore();
}

function renderTopLoopFieldLines(
  c: CanvasRenderingContext2D,
  center: Vec2,
  radiusPx: number,
  direction: 'clockwise' | 'counterclockwise',
  strength: ReturnType<typeof getLoopVisualStrength>,
): void {
  const symbol = getLoopTopFieldSymbol(direction);
  const count = strength.centerSymbolCount;
  const spacing = Math.max(radiusPx * 0.18, 18);
  const half = (count - 1) / 2;

  c.fillStyle = rgba(BLINE_RGB, strength.centerGlowAlpha);
  c.beginPath();
  c.arc(center.x, center.y, radiusPx * (0.34 + strength.centerNormalized * 0.08), 0, Math.PI * 2);
  c.fill();

  for (let row = 0; row < count; row += 1) {
    for (let column = 0; column < count; column += 1) {
      const dx = (column - half) * spacing;
      const dy = (row - half) * spacing;
      const distanceFactor = 1 - Math.min(Math.hypot(dx, dy) / (spacing * Math.max(half, 1) * 1.4), 0.78);
      drawFieldSectionSymbol(
        c,
        center.x + dx,
        center.y + dy,
        strength.arrowSize + distanceFactor * 3.2,
        symbol,
        0.24 + distanceFactor * strength.fieldAlpha,
      );
    }
  }
}

function renderFrontLoopFieldLines(
  c: CanvasRenderingContext2D,
  center: Vec2,
  radiusPx: number,
  direction: 'clockwise' | 'counterclockwise',
  strength: ReturnType<typeof getLoopVisualStrength>,
): void {
  const loops = strength.fieldLoopCount;
  const innerHalf = Math.max(radiusPx * 0.18, 14);

  for (let index = 0; index < loops; index += 1) {
    const width = radiusPx * (0.72 + index * 0.22);
    const height = radiusPx * (0.82 + index * 0.24);
    const opacity = strength.fieldAlpha * (1 - index * 0.07);

    c.strokeStyle = rgba(BLINE_RGB, opacity);
    c.lineWidth = strength.fieldLineWidth + index * 0.08;
    c.beginPath();
    c.moveTo(center.x, center.y - innerHalf);
    c.bezierCurveTo(
      center.x + width * 0.18, center.y - height * 0.78,
      center.x + width, center.y - height * 0.36,
      center.x + width, center.y,
    );
    c.bezierCurveTo(
      center.x + width, center.y + height * 0.36,
      center.x + width * 0.18, center.y + height * 0.78,
      center.x, center.y + innerHalf,
    );
    c.bezierCurveTo(
      center.x - width * 0.18, center.y + height * 0.78,
      center.x - width, center.y + height * 0.36,
      center.x - width, center.y,
    );
    c.bezierCurveTo(
      center.x - width, center.y - height * 0.36,
      center.x - width * 0.18, center.y - height * 0.78,
      center.x, center.y - innerHalf,
    );
    c.stroke();

    const outerArrowY = direction === 'counterclockwise'
      ? center.y + height * 0.24
      : center.y - height * 0.24;
    const outerArrowAngle = direction === 'counterclockwise' ? Math.PI / 2 : -Math.PI / 2;
    drawArrowHead(
      c,
      center.x + width,
      outerArrowY,
      outerArrowAngle,
      {
        color: rgba(BLINE_RGB, Math.min(0.95, opacity + 0.18)),
        size: strength.arrowSize * 0.9,
      },
    );
  }

  const axisDirection = getLoopFrontAxisDirection(direction);
  const axisLength = radiusPx * (1.1 + strength.centerNormalized * 0.18);
  c.strokeStyle = rgba(BLINE_LABEL_RGB, 0.84);
  c.lineWidth = 2.3;
  c.beginPath();
  c.moveTo(center.x, center.y + axisLength * 0.7);
  c.lineTo(center.x, center.y - axisLength * 0.7);
  c.stroke();
  drawArrowHead(
    c,
    center.x,
    axisDirection === 'up' ? center.y - axisLength * 0.7 : center.y + axisLength * 0.7,
    axisDirection === 'up' ? -Math.PI / 2 : Math.PI / 2,
    {
      color: rgba(BLINE_LABEL_RGB, 0.92),
      size: strength.arrowSize + 1,
    },
  );
}

function renderIsometricLoopFieldLines(
  c: CanvasRenderingContext2D,
  center: Vec2,
  radiusPx: number,
  loopRadius: number,
  current: number,
  direction: 'clockwise' | 'counterclockwise',
  strength: ReturnType<typeof getLoopVisualStrength>,
  camera: ReturnType<typeof getLoopCameraState>,
  showAuxiliaryLabels: boolean,
): void {
  const loops = Math.max(strength.fieldLoopCount, 5);
  const projectionScale = radiusPx / Math.max(loopRadius, 1e-6);
  const fieldPlaneAngles = [0, -0.48, 0.48, -0.96, 0.96];

  for (let planeIndex = 0; planeIndex < fieldPlaneAngles.length; planeIndex += 1) {
    const azimuth = fieldPlaneAngles[planeIndex]!;
    const planeOpacity = planeIndex === 0
      ? 1
      : planeIndex <= 2
        ? 0.72
        : 0.5;

    for (let index = 0; index < loops; index += 1) {
      const radialScale = (index + 0.65) / (loops + 0.35);
      const opacity = Math.max(
        0.08,
        strength.fieldAlpha * (0.96 - index * 0.09) * planeOpacity,
      );
      const linePoints = traceLoopFieldLinePlanePoints(
        radialScale,
        current,
        loopRadius,
        direction,
        140,
      ).map((point) =>
        projectLoopPoint({
          x: point.x * projectionScale * Math.cos(azimuth),
          y: point.x * projectionScale * Math.sin(azimuth),
          z: point.z * projectionScale,
        }, center, camera),
      );

      if (linePoints.length < 2) continue;
      const visibleSegments = getProjectedVisibleSegments(linePoints, true);

      c.strokeStyle = rgba(BLINE_RGB, opacity * (planeIndex === 0 ? 0.22 : 0.12));
      c.lineWidth = Math.max(1, strength.fieldLineWidth + index * 0.02);
      c.setLineDash(planeIndex === 0 ? [9, 8] : [7, 9]);
      drawProjectedFieldPath(c, linePoints, true);
      c.stroke();
      c.setLineDash([]);

      c.strokeStyle = rgba(BLINE_RGB, opacity);
      c.lineWidth = (strength.fieldLineWidth + index * 0.1) * (planeIndex === 0 ? 1 : 0.92);
      c.lineCap = 'round';
      for (const segment of visibleSegments) {
        drawProjectedFieldPath(c, segment, false);
        c.stroke();
      }

      if (planeIndex <= 2) {
        drawProjectedFieldPathArrow(
          c,
          linePoints,
          0.1 + radialScale * 0.08 + planeIndex * 0.07,
          {
            color: rgba(BLINE_RGB, Math.min(0.92, opacity + 0.18)),
            size: Math.max(4.2, strength.arrowSize * (planeIndex === 0 ? 0.7 : 0.62)),
          },
        );
      }
    }
  }

  const axisDirection = direction === 'counterclockwise' ? 1 : -1;
  const axisTail = projectLoopPoint({ x: 0, y: 0, z: -radiusPx * 0.22 * axisDirection }, center, camera);
  const axisTip = projectLoopPoint({ x: 0, y: 0, z: radiusPx * 1.05 * axisDirection }, center, camera);

  c.strokeStyle = rgba(BLINE_LABEL_RGB, 0.84);
  c.lineWidth = 2.4;
  c.beginPath();
  c.moveTo(axisTail.x, axisTail.y);
  c.lineTo(axisTip.x, axisTip.y);
  c.stroke();
  drawArrowHead(
    c,
    axisTip.x,
    axisTip.y,
    Math.atan2(axisTip.y - axisTail.y, axisTip.x - axisTail.x),
    {
      color: rgba(BLINE_LABEL_RGB, 0.92),
      size: strength.arrowSize * 0.92,
    },
  );

  if (showAuxiliaryLabels) {
    c.fillStyle = rgba(BLINE_LABEL_RGB, 0.9);
    c.font = '12px Inter, sans-serif';
    c.textAlign = axisTip.x >= center.x ? 'left' : 'right';
    c.textBaseline = 'middle';
    c.fillText('B₀', axisTip.x + (axisTip.x >= center.x ? 10 : -10), axisTip.y);
  }
}

function drawLoopReferenceLabel(
  c: CanvasRenderingContext2D,
  center: Vec2,
  radiusPx: number,
  entity: Entity,
  direction: 'clockwise' | 'counterclockwise',
  viewMode: LoopViewMode,
  strength: ReturnType<typeof getLoopVisualStrength>,
): void {
  const radius = (entity.properties.loopRadius as number) ?? 1;
  const current = Math.abs((entity.properties.current as number) ?? 5);
  const centerB = computeLoopCenterField(current, radius);
  const markerX = center.x + radiusPx + 30;
  const markerY = center.y - radiusPx * 0.18;

  c.strokeStyle = rgba(BLINE_LABEL_RGB, 0.28 + strength.centerGlowAlpha);
  c.lineWidth = 1.2;
  c.setLineDash([4, 4]);
  c.beginPath();
  c.moveTo(center.x, center.y);
  c.lineTo(markerX - 8, markerY + 2);
  c.stroke();
  c.setLineDash([]);

  c.fillStyle = rgba(BLINE_LABEL_RGB, 0.94);
  c.font = '12px Inter, sans-serif';
  c.textAlign = 'left';
  c.textBaseline = 'bottom';
  c.fillText('中心区域', markerX, markerY - 6);

  c.font = '11px Inter, sans-serif';
  c.fillStyle = rgba(BLINE_LABEL_RGB, 0.8);
  c.textBaseline = 'top';
  c.fillText(
    viewMode === 'top'
      ? `B₀ ${getLoopTopFieldLabel(direction)}`
      : `B₀ ${getLoopFrontAxisLabel(direction)}`,
    markerX,
    markerY + 4,
  );
  c.fillText(`B₀ = ${centerB.toExponential(2)} T`, markerX, markerY + 20);
}

function drawProjectedFieldPath(
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

function drawProjectedFieldPathArrow(
  c: CanvasRenderingContext2D,
  points: ProjectedLoopPoint[],
  progress: number,
  options: { color: string; size: number },
): void {
  if (points.length < 3) return;

  const normalized = ((progress % 1) + 1) % 1;
  const headIndex = Math.floor(normalized * points.length) % points.length;
  const tailIndex = (headIndex - 2 + points.length) % points.length;
  const head = points[headIndex]!;
  const tail = points[tailIndex]!;

  drawArrowHead(c, head.x, head.y, Math.atan2(head.y - tail.y, head.x - tail.x), options);
}

// ── Loop cross-section: dipole-like field lines ──

function renderLoopFieldLines(
  c: CanvasRenderingContext2D,
  entity: Entity,
  ct: { scale: number; origin: Vec2 },
): void {
  const paramValues = useSimulationStore.getState().paramValues;
  if (paramValues.loopViewMode != null) {
    const viewMode = getLoopViewMode(paramValues);
    const transition = resolveLoopViewTransition(viewMode);

    if (transition.previous && transition.progress < 1) {
      renderTeachingLoopFieldLinesVariant(
        c,
        entity,
        ct,
        transition.previous,
        1 - transition.progress,
      );
    }

    renderTeachingLoopFieldLinesVariant(
      c,
      entity,
      ct,
      transition.mode,
      transition.progress,
    );
    return;
  }

  const { position } = entity.transform;
  const loopRadius = (entity.properties.loopRadius as number) ?? 1;
  const center = worldToScreen(position, ct);
  const rPx = worldLengthToScreen(loopRadius, ct);
  const directions = getLoopCrossSectionDirections(entity);
  const fieldRight = directions.centerField === 'right';

  c.save();
  c.strokeStyle = BLINE_COLOR;
  c.lineWidth = 1.2;

  // Simplified dipole field: 5 curves going from right to left around the outside
  const offsets = [0.3, 0.6, 1.0, 1.5, 2.1];

  for (const off of offsets) {
    const oPx = worldLengthToScreen(off, ct);

    // Right-side outgoing curve (upward then around)
    c.beginPath();
    c.moveTo(center.x + rPx * 0.2, center.y - oPx);
    c.bezierCurveTo(
      center.x + rPx + oPx * 1.2, center.y - oPx * 1.5,
      center.x + rPx + oPx * 1.2, center.y + oPx * 1.5,
      center.x + rPx * 0.2, center.y + oPx,
    );
    c.stroke();

    // Left-side return curve
    c.beginPath();
    c.moveTo(center.x - rPx * 0.2, center.y - oPx);
    c.bezierCurveTo(
      center.x - rPx - oPx * 1.2, center.y - oPx * 1.5,
      center.x - rPx - oPx * 1.2, center.y + oPx * 1.5,
      center.x - rPx * 0.2, center.y + oPx,
    );
    c.stroke();

    // Through-center horizontal line connecting left and right
    c.beginPath();
    c.moveTo(center.x - rPx * 0.2, center.y - oPx);
    c.lineTo(center.x + rPx * 0.2, center.y - oPx);
    c.stroke();

    c.beginPath();
    c.moveTo(center.x - rPx * 0.2, center.y + oPx);
    c.lineTo(center.x + rPx * 0.2, center.y + oPx);
    c.stroke();

    const arrowX = fieldRight ? center.x + rPx + oPx * 1.0 : center.x - rPx - oPx * 1.0;
    const arrowY = center.y;
    drawArrowHead(c, arrowX, arrowY, fieldRight ? Math.PI / 2 : -Math.PI / 2);
  }

  const axisStart = fieldRight ? center.x - rPx * 0.45 : center.x + rPx * 0.45;
  const axisEnd = fieldRight ? center.x + rPx * 0.45 : center.x - rPx * 0.45;
  c.beginPath();
  c.moveTo(axisStart, center.y);
  c.lineTo(axisEnd, center.y);
  c.stroke();
  drawArrowHead(c, axisEnd, center.y, fieldRight ? 0 : Math.PI);

  // Label
  c.fillStyle = BLINE_LABEL_COLOR;
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillText(
    `环形电流磁场 · ${getLoopCenterFieldDirectionLabel(entity)}`,
    center.x,
    center.y + rPx + worldLengthToScreen(2.5, ct),
  );

  c.restore();
}

// ── Solenoid: parallel internal lines + external return paths ──

function renderSolenoidFieldLines(
  c: CanvasRenderingContext2D,
  entity: Entity,
  ct: { scale: number; origin: Vec2 },
): void {
  const { position } = entity.transform;
  const turns = (entity.properties.turns as number) ?? 500;
  const length = (entity.properties.length as number) ?? 3;
  const width = (entity.properties.width as number) ?? length;
  const height = (entity.properties.height as number) ?? 1.2;
  const current = Math.abs((entity.properties.current as number) ?? 2);
  const radius = height / 2;
  const directionSign = getSolenoidFieldDirection(entity) === 'right' ? 1 : -1;
  const teachingStep = turns <= 120 ? 1 : turns <= 480 ? 2 : 3;
  const sceneGeometry = buildSolenoidSceneGeometry({
    current,
    turns,
    length,
    radius,
    directionSign,
    displayMode: 'textbook',
    teachingStep,
    quality: 0.85,
  });

  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    ct,
  );
  const screenW = worldLengthToScreen(width, ct);
  const screenH = worldLengthToScreen(height, ct);
  const centerY = screenTopLeft.y + screenH / 2;

  // Field direction: right-hand rule, current>0 → field to the right
  const fieldRight = getSolenoidFieldDirection(entity) === 'right';

  c.save();
  const depthThreshold = radius * 0.24;
  const lineStep = teachingStep === 3 ? 2 : 1;

  sceneGeometry.fieldLines.forEach((line, lineIndex) => {
    const depth = Math.abs(line.positions[2] ?? 0);
    if (depth > depthThreshold || lineIndex % lineStep !== 0) return;

    c.strokeStyle = rgba(BLINE_RGB, clamp(0.14 + line.averageStrength * 0.28, 0.16, 0.5));
    c.lineWidth = 0.95 + line.averageStrength * 0.9;
    c.beginPath();

    const firstPoint = worldToScreen(
      { x: line.positions[0] ?? 0, y: line.positions[1] ?? 0 },
      ct,
    );
    c.moveTo(firstPoint.x, firstPoint.y);

    for (let index = 3; index < line.positions.length; index += 3) {
      const nextPoint = worldToScreen(
        { x: line.positions[index] ?? 0, y: line.positions[index + 1] ?? 0 },
        ct,
      );
      c.lineTo(nextPoint.x, nextPoint.y);
    }

    c.stroke();

    const segmentIndex = Math.max(3, Math.floor((line.positions.length / 3) * 0.24) * 3);
    const tailIndex = Math.max(0, segmentIndex - 3);
    const headX = line.positions[segmentIndex] ?? line.positions[0] ?? 0;
    const headY = line.positions[segmentIndex + 1] ?? line.positions[1] ?? 0;
    const tailX = line.positions[tailIndex] ?? headX;
    const tailY = line.positions[tailIndex + 1] ?? headY;
    const head = worldToScreen({ x: headX, y: headY }, ct);
    const tail = worldToScreen({ x: tailX, y: tailY }, ct);
    drawArrowHead(
      c,
      head.x,
      head.y,
      Math.atan2(head.y - tail.y, head.x - tail.x),
      {
        color: rgba(BLINE_RGB, clamp(0.26 + line.averageStrength * 0.44, 0.28, 0.78)),
        size: 5.5,
      },
    );
  });

  sceneGeometry.sectionArrows.forEach((arrow, index) => {
    if (arrow.region !== 'inside' || index % 2 !== 0) return;
    if (Math.abs(arrow.point.y) > radius * 0.52 || Math.abs(arrow.point.x) > length * 0.42) return;

    const magnitude = Math.hypot(arrow.vector.x, arrow.vector.y, arrow.vector.z);
    if (magnitude < 1e-8) return;

    const arrowLength = 0.24 + Math.min(arrow.magnitude / Math.max(sceneGeometry.centerField, 1e-9), 1) * 0.4;
    const direction = {
      x: arrow.vector.x / magnitude,
      y: arrow.vector.y / magnitude,
    };
    const start = worldToScreen({
      x: arrow.point.x - direction.x * arrowLength * 0.24,
      y: arrow.point.y - direction.y * arrowLength * 0.24,
    }, ct);
    const end = worldToScreen({
      x: arrow.point.x + direction.x * arrowLength * 0.76,
      y: arrow.point.y + direction.y * arrowLength * 0.76,
    }, ct);

    c.strokeStyle = rgba(BLINE_LABEL_RGB, 0.78);
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(start.x, start.y);
    c.lineTo(end.x, end.y);
    c.stroke();
    drawArrowHead(c, end.x, end.y, Math.atan2(end.y - start.y, end.x - start.x), {
      color: rgba(BLINE_LABEL_RGB, 0.88),
      size: 5.8,
    });
  });

  if (sceneGeometry.sectionCells.length > 0) {
    c.fillStyle = rgba(BLINE_RGB, 0.06);
    c.beginPath();
    c.ellipse(
      screenTopLeft.x + screenW / 2,
      centerY,
      Math.max(screenW * 0.38, 10),
      Math.max(screenH * 0.36, 10),
      0,
      0,
      Math.PI * 2,
    );
    c.fill();
  }

  // Internal field label
  const n = (turns / length).toFixed(0);
  c.fillStyle = BLINE_LABEL_COLOR;
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'bottom';
  c.fillText(
    `B=μ₀nI (n=${n}) · ${fieldRight ? '向右' : '向左'}`,
    screenTopLeft.x + screenW / 2,
    screenTopLeft.y - 4,
  );

  c.restore();
}

function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${Math.max(0, Math.min(alpha, 1))})`;
}

function drawFieldSectionSymbol(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  direction: 'into' | 'out',
  alpha: number,
): void {
  c.save();
  c.globalAlpha = alpha;
  c.strokeStyle = BLINE_COLOR;
  c.lineWidth = 1.8;
  c.beginPath();
  c.arc(x, y, size, 0, Math.PI * 2);
  c.stroke();

  if (direction === 'out') {
    c.fillStyle = BLINE_COLOR;
    c.beginPath();
    c.arc(x, y, Math.max(2.2, size * 0.28), 0, Math.PI * 2);
    c.fill();
    c.restore();
    return;
  }

  c.strokeStyle = BLINE_COLOR;
  c.lineWidth = 1.8;
  c.beginPath();
  c.moveTo(x - size * 0.48, y - size * 0.48);
  c.lineTo(x + size * 0.48, y + size * 0.48);
  c.moveTo(x + size * 0.48, y - size * 0.48);
  c.lineTo(x - size * 0.48, y + size * 0.48);
  c.stroke();
  c.restore();
}

function drawCircleArrow(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  angle: number,
  clockwise: boolean,
  options: { color: string; size: number },
): void {
  const x = cx + radius * Math.cos(angle);
  const y = cy + radius * Math.sin(angle);
  const tangentAngle = clockwise ? angle + Math.PI / 2 : angle - Math.PI / 2;
  drawArrowHead(c, x, y, tangentAngle, options);
}

function drawEllipseArrow(
  c: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radiusX: number,
  radiusY: number,
  angle: number,
  clockwise: boolean,
  options: { color: string; size: number },
): void {
  const x = cx + radiusX * Math.cos(angle);
  const y = cy + radiusY * Math.sin(angle);
  const dx = clockwise ? -radiusX * Math.sin(angle) : radiusX * Math.sin(angle);
  const dy = clockwise ? radiusY * Math.cos(angle) : -radiusY * Math.cos(angle);
  drawArrowHead(c, x, y, Math.atan2(dy, dx), options);
}

// ── Arrow head helper ──

function drawArrowHead(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  options?: { color?: string; size?: number },
): void {
  const size = options?.size ?? ARROW_SIZE;
  c.save();
  c.fillStyle = options?.color ?? BLINE_COLOR;
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(size, 0);
  c.lineTo(-size * 0.5, -size * 0.5);
  c.lineTo(-size * 0.5, size * 0.5);
  c.closePath();
  c.fill();
  c.restore();
}

function fillRoundedRect(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string | CanvasGradient,
): void {
  c.save();
  c.fillStyle = fillStyle;
  buildRoundedRectPath(c, x, y, width, height, radius);
  c.fill();
  c.restore();
}

function buildRoundedRectPath(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2));
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + width - r, y);
  c.quadraticCurveTo(x + width, y, x + width, y + r);
  c.lineTo(x + width, y + height - r);
  c.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  c.lineTo(x + r, y + height);
  c.quadraticCurveTo(x, y + height, x, y + height - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}
