import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { useSimulationStore } from '@/store/simulation-store';
import type { EntityRenderer } from '@/core/registries/renderer-registry';
import type { FieldLineDensity, Vec2 } from '@/core/types';
import { isDynamicPointCharge } from '../logic/point-charge-role';
import {
  getEFieldGap,
  getUniformEFieldDerivedState,
  getUniformEFieldModelLabel,
} from '../logic/electric-force';
import { isStaticElectrostaticScene } from '../logic/static-electrostatic-scene';
import {
  getFlowmeterSceneValues,
  getFlowmeterTeachingState,
} from '../logic/flowmeter-teaching';

/** 电场区域边框颜色 */
const EFIELD_BORDER_COLOR = '#F39C12';
/** 电场区域背景填充色（半透明） */
const EFIELD_FILL_COLOR = 'rgba(243, 156, 18, 0.06)';
/** 电场箭头/场线颜色 */
const EFIELD_ARROW_COLOR = '#F39C12';
/** 等势线颜色 */
const EQUIPOTENTIAL_COLOR = '#27AE60';
/** 极板颜色 */
const PLATE_COLOR = '#E74C3C';
/** 箭头网格间距（物理单位 m）— 仅无极板时使用 */
const ARROW_SPACING = 0.6;
/** 箭头长度（像素）— 仅无极板时使用 */
const ARROW_LENGTH = 30;

// ─── 场线密度参数 ───
/** 最少/最多场线条数 */
const MIN_LINES = 3;
const MAX_LINES = 24;
/**
 * E → 场线条数映射：对数缩放，使低场强区间也有明显变化
 * E=50 → 3条, E=100 → 5条, E=200 → 8条, E=500 → 14条, E=1000 → 18条
 */
function eToLineCount(e: number): number {
  if (e <= 0) return MIN_LINES;
  // log 映射：lineCount = 4 * ln(E/20)，clamp 到 [MIN, MAX]
  const raw = 4 * Math.log(e / 20);
  return Math.max(MIN_LINES, Math.min(MAX_LINES, Math.round(raw)));
}
/** 中间直线区域占板长比例 */
const INNER_RATIO = 0.65;
/** 边缘弯曲区域每侧条数 */
const EDGE_LINES_PER_SIDE = 3;
/** 场线上箭头间距（像素） */
const LINE_ARROW_INTERVAL = 80;
/** 场线箭头大小 */
const LINE_ARROW_SIZE = 7;
/** 边缘等势线最小可见电压 */
const MIN_VISIBLE_EQUIPOTENTIAL_VOLTAGE = 0.5;

function densityFactor(density: FieldLineDensity): number {
  switch (density) {
    case 'sparse':
      return 0.7;
    case 'dense':
      return 1.4;
    case 'standard':
    default:
      return 1;
  }
}

function equipotentialStep(density: FieldLineDensity): number {
  switch (density) {
    case 'sparse':
      return 30;
    case 'dense':
      return 12;
    case 'standard':
    default:
      return 20;
  }
}

/**
 * 匀强电场实体渲染器
 *
 * 绘制内容：
 * - showPlates=false：等距电场方向箭头阵列（通用匀强电场）
 * - showPlates=true：平行板电容器场线（默认含边缘弯曲，可按需切换为纯匀强场表达）
 */
const uniformEFieldRenderer: EntityRenderer = (entity, _result, ctx) => {
  const { coordinateTransform } = ctx;
  const { position } = entity.transform;
  const width = (entity.properties.width as number) ?? 3;
  const height = (entity.properties.height as number) ?? 2;
  const direction = (entity.properties.direction as Vec2) ?? { x: 0, y: -1 };
  const showPlates = (entity.properties.showPlates as boolean) ?? false;
  const showEdgeFieldLines = (entity.properties.showEdgeFieldLines as boolean | undefined) ?? true;
  const fieldState = getUniformEFieldDerivedState(entity);
  const gap = getEFieldGap(entity);
  const storeState = useSimulationStore.getState();
  const fieldLineDensity = storeState.fieldLineDensity;
  const sceneEntities = Array.from(storeState.simulationState.scene.entities.values());
  const hideSceneAnnotations = isStaticElectrostaticScene(
    sceneEntities,
    storeState.simulationState.timeline.duration,
  );
  const hasDynamicPointCharges = sceneEntities.some(isDynamicPointCharge);
  const isStaticCapacitorScene = showPlates && !hasDynamicPointCharges;
  const flowmeterSceneValues = showPlates
    ? getFlowmeterSceneValues(sceneEntities, storeState.paramValues)
    : null;
  const flowmeterTeachingState = flowmeterSceneValues
    ? getFlowmeterTeachingState({
      time: _result?.time ?? 0,
      speed: flowmeterSceneValues.speed,
      magneticField: flowmeterSceneValues.magneticField,
      pipeDiameter: flowmeterSceneValues.pipeDiameter,
    })
    : null;
  const shouldRenderFieldLines = !isStaticCapacitorScene || storeState.showFieldLines;
  const shouldRenderEquipotentialLines =
    isStaticCapacitorScene &&
    storeState.showEquipotentialLines &&
    fieldState.model !== 'direct' &&
    fieldState.voltage != null &&
    gap > 0;

  const effectiveE = fieldState.effectiveE;
  const renderedE = flowmeterTeachingState?.currentElectricField ?? Math.abs(effectiveE);
  const renderedVoltage = flowmeterTeachingState?.currentVoltage ?? Math.abs(fieldState.voltage ?? 0);

  const screenTopLeft = worldToScreen(
    { x: position.x, y: position.y + height },
    coordinateTransform,
  );
  const screenW = worldLengthToScreen(width, coordinateTransform);
  const screenH = worldLengthToScreen(height, coordinateTransform);

  const c = ctx.ctx;
  c.save();

  // 1. 背景填充
  c.fillStyle = EFIELD_FILL_COLOR;
  c.fillRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);

  // 2. 虚线边框
  c.strokeStyle = EFIELD_BORDER_COLOR;
  c.lineWidth = 1.5;
  c.setLineDash([6, 4]);
  c.strokeRect(screenTopLeft.x, screenTopLeft.y, screenW, screenH);
  c.setLineDash([]);

  // 3. 电场可视化
  if (showPlates) {
    if (shouldRenderFieldLines && (!flowmeterTeachingState || renderedE > 0.1)) {
      c.save();
      if (flowmeterTeachingState) {
        c.globalAlpha *= clamp(0.18 + flowmeterTeachingState.buildupRatio * 0.82, 0.18, 1);
      }
      drawCapacitorFieldLines(
        c,
        screenTopLeft,
        screenW,
        screenH,
        direction,
        renderedE,
        fieldLineDensity,
        showEdgeFieldLines,
      );
      c.restore();
    }
    if (shouldRenderEquipotentialLines && renderedVoltage > MIN_VISIBLE_EQUIPOTENTIAL_VOLTAGE) {
      drawCapacitorEquipotentialLines(
        c,
        screenTopLeft,
        screenW,
        screenH,
        direction,
        renderedVoltage,
        fieldLineDensity,
      );
    }
    drawPlates(c, screenTopLeft, screenW, screenH, direction, !hideSceneAnnotations);
    if (flowmeterTeachingState) {
      drawFlowmeterTeachingOverlay(
        c,
        screenTopLeft,
        screenW,
        screenH,
        direction,
        flowmeterTeachingState,
      );
    }
  } else {
    drawArrowGrid(c, screenTopLeft, screenW, screenH, direction, coordinateTransform);
  }

  // 4. 标签
  if (entity.label && !hideSceneAnnotations) {
    c.fillStyle = EFIELD_BORDER_COLOR;
    c.font = '12px Inter, sans-serif';
    c.textAlign = 'left';
    c.textBaseline = 'top';
    // 平行板模式：显示 E=U/d 完整信息
    let labelText: string;
    if (flowmeterTeachingState) {
      labelText = `${entity.label} ${flowmeterTeachingState.stageIndex}/3  E≈${renderedE.toFixed(1)}/${flowmeterTeachingState.targetElectricField.toFixed(1)} V/m`;
    } else if (showPlates) {
      labelText = `${entity.label} ${buildEFieldLabel(fieldState, Math.abs(effectiveE))}`;
    } else {
      labelText = `${entity.label} E=${formatFieldValue(Math.abs(effectiveE))} V/m`;
    }
    c.fillText(labelText, screenTopLeft.x + 4, screenTopLeft.y + 4);
  }

  c.restore();
};

function buildEFieldLabel(
  fieldState: ReturnType<typeof getUniformEFieldDerivedState>,
  effectiveMagnitude: number,
): string {
  if (fieldState.model === 'constant-charge') {
    return `${getUniformEFieldModelLabel(fieldState.model)} E≈${formatFieldValue(effectiveMagnitude)} V/m  U≈${formatFieldValue(Math.abs(fieldState.voltage ?? 0))} V`;
  }

  if (fieldState.model === 'constant-voltage') {
    return `${getUniformEFieldModelLabel(fieldState.model)} E=U/d≈${formatFieldValue(effectiveMagnitude)} V/m`;
  }

  return `${getUniformEFieldModelLabel(fieldState.model)} E=${formatFieldValue(effectiveMagnitude)} V/m`;
}

function formatFieldValue(value: number): string {
  if (!Number.isFinite(value)) return '—';
  const abs = Math.abs(value);
  if (abs >= 1e4 || (abs > 0 && abs < 1e-2)) {
    return value.toExponential(2);
  }
  return value.toFixed(abs >= 100 ? 0 : 1);
}

// ═════════════════════════════════════════════════
// 平行板电容器场线渲染（showPlates=true）
// ═════════════════════════════════════════════════

/**
 * 绘制平行板电容器电场线
 *
 * - 中间区域：等间距平行直线 + 方向箭头，线数随 E 变化
 * - 边缘区域：每侧 3 条弯曲场线（贝塞尔曲线），表现边缘效应
 */
function drawCapacitorFieldLines(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  direction: Vec2,
  magnitude: number,
  density: FieldLineDensity,
  showEdgeFieldLines: boolean,
): void {
  // 根据电场强度计算场线条数（对数映射，低场强区间也有明显变化）
  const lineCount = Math.max(
    MIN_LINES,
    Math.min(MAX_LINES, Math.round(eToLineCount(magnitude) * densityFactor(density))),
  );

  const isVertical = Math.abs(direction.y) > Math.abs(direction.x);

  if (isVertical) {
    drawVerticalFieldLines(c, topLeft, w, h, direction.y < 0, lineCount, showEdgeFieldLines);
  } else {
    drawHorizontalFieldLines(c, topLeft, w, h, direction.x > 0, lineCount, showEdgeFieldLines);
  }
}

function drawCapacitorEquipotentialLines(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  direction: Vec2,
  voltage: number,
  density: FieldLineDensity,
): void {
  const intervalCount = Math.max(
    2,
    Math.min(14, Math.round(Math.max(voltage, 1) / equipotentialStep(density))),
  );
  const isVerticalField = Math.abs(direction.y) > Math.abs(direction.x);

  c.save();
  c.strokeStyle = EQUIPOTENTIAL_COLOR;
  c.lineWidth = 1;
  c.globalAlpha = 0.72;
  c.setLineDash([6, 4]);

  if (isVerticalField) {
    drawVerticalEquipotentialCurves(c, topLeft, w, h, intervalCount);
  } else {
    drawHorizontalEquipotentialCurves(c, topLeft, w, h, intervalCount);
  }

  c.setLineDash([]);
  c.restore();
}

function drawVerticalEquipotentialCurves(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  intervalCount: number,
): void {
  const plateMargin = w * 0.05;
  const plateLeft = topLeft.x + plateMargin;
  const plateRight = topLeft.x + w - plateMargin;
  const plateLength = plateRight - plateLeft;
  const innerWidth = plateLength * INNER_RATIO;
  const innerLeft = plateLeft + (plateLength - innerWidth) / 2;
  const innerRight = innerLeft + innerWidth;
  const edgeWidth = innerLeft - plateLeft;
  const aspectRatio = plateLength / Math.max(h, 1);
  const edgeStrength = clamp(3.8 / Math.max(aspectRatio, 1), 0.22, 1);
  const topLimit = topLeft.y + h * 0.04;
  const bottomLimit = topLeft.y + h * 0.96;

  for (let i = 1; i < intervalCount; i++) {
    const t = i / intervalCount;
    const y = topLeft.y + t * h;
    const signedBias = (2 * t) - 1;
    const bend = signedBias
      * h
      * (0.03 + 0.12 * edgeStrength)
      * Math.pow(Math.abs(signedBias), 0.9);
    const edgeY = clamp(y + bend, topLimit, bottomLimit);

    c.beginPath();
    c.moveTo(plateLeft, edgeY);
    c.bezierCurveTo(
      plateLeft + edgeWidth * 0.35,
      edgeY,
      plateLeft + edgeWidth * 0.72,
      y,
      innerLeft,
      y,
    );
    c.lineTo(innerRight, y);
    c.bezierCurveTo(
      plateRight - edgeWidth * 0.72,
      y,
      plateRight - edgeWidth * 0.35,
      edgeY,
      plateRight,
      edgeY,
    );
    c.stroke();
  }
}

function drawHorizontalEquipotentialCurves(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  intervalCount: number,
): void {
  const plateMargin = h * 0.05;
  const plateTop = topLeft.y + plateMargin;
  const plateBottom = topLeft.y + h - plateMargin;
  const plateLength = plateBottom - plateTop;
  const innerHeight = plateLength * INNER_RATIO;
  const innerTop = plateTop + (plateLength - innerHeight) / 2;
  const innerBottom = innerTop + innerHeight;
  const edgeHeight = innerTop - plateTop;
  const aspectRatio = plateLength / Math.max(w, 1);
  const edgeStrength = clamp(3.8 / Math.max(aspectRatio, 1), 0.22, 1);
  const leftLimit = topLeft.x + w * 0.04;
  const rightLimit = topLeft.x + w * 0.96;

  for (let i = 1; i < intervalCount; i++) {
    const t = i / intervalCount;
    const x = topLeft.x + t * w;
    const signedBias = (2 * t) - 1;
    const bend = signedBias
      * w
      * (0.03 + 0.12 * edgeStrength)
      * Math.pow(Math.abs(signedBias), 0.9);
    const edgeX = clamp(x + bend, leftLimit, rightLimit);

    c.beginPath();
    c.moveTo(edgeX, plateTop);
    c.bezierCurveTo(
      edgeX,
      plateTop + edgeHeight * 0.35,
      x,
      plateTop + edgeHeight * 0.72,
      x,
      innerTop,
    );
    c.lineTo(x, innerBottom);
    c.bezierCurveTo(
      x,
      plateBottom - edgeHeight * 0.72,
      edgeX,
      plateBottom - edgeHeight * 0.35,
      edgeX,
      plateBottom,
    );
    c.stroke();
  }
}

/**
 * 竖直方向电场线（上下极板）
 * @param downward - true 表示从上到下（direction.y < 0 → 屏幕上到下）
 */
function drawVerticalFieldLines(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  downward: boolean,
  lineCount: number,
  showEdgeFieldLines: boolean,
): void {
  const plateMargin = w * 0.05;
  const plateLen = w - 2 * plateMargin;

  // ── 中间直线场线 ──
  const innerWidth = plateLen * INNER_RATIO;
  const innerLeft = topLeft.x + plateMargin + (plateLen - innerWidth) / 2;
  const spacing = innerWidth / (lineCount + 1);

  c.strokeStyle = EFIELD_ARROW_COLOR;
  c.lineWidth = 1.4;

  for (let i = 1; i <= lineCount; i++) {
    const x = innerLeft + i * spacing;
    const y0 = topLeft.y;
    const y1 = topLeft.y + h;

    // 直线
    c.beginPath();
    c.moveTo(x, y0);
    c.lineTo(x, y1);
    c.stroke();

    // 方向箭头（沿线等间距放置）
    const lineLen = h;
    const arrowCount = Math.max(1, Math.floor(lineLen / LINE_ARROW_INTERVAL));
    for (let a = 0; a < arrowCount; a++) {
      const t = (a + 0.5) / arrowCount;
      const ay = y0 + t * lineLen;
      const angle = downward ? Math.PI / 2 : -Math.PI / 2;
      drawFieldArrowHead(c, x, ay, angle);
    }
  }

  // ── 边缘弯曲场线 ──
  if (showEdgeFieldLines) {
    const edgeLines = Math.min(EDGE_LINES_PER_SIDE, Math.max(1, Math.round(lineCount * 0.3)));
    drawEdgeLinesVertical(c, topLeft, w, h, downward, edgeLines, plateMargin);
  }
}

/**
 * 水平方向电场线（左右极板）
 */
function drawHorizontalFieldLines(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  rightward: boolean,
  lineCount: number,
  showEdgeFieldLines: boolean,
): void {
  const plateMargin = h * 0.05;
  const plateLen = h - 2 * plateMargin;
  const innerHeight = plateLen * INNER_RATIO;
  const innerTop = topLeft.y + plateMargin + (plateLen - innerHeight) / 2;
  const spacing = innerHeight / (lineCount + 1);

  c.strokeStyle = EFIELD_ARROW_COLOR;
  c.lineWidth = 1.4;

  for (let i = 1; i <= lineCount; i++) {
    const y = innerTop + i * spacing;
    const x0 = topLeft.x;
    const x1 = topLeft.x + w;

    c.beginPath();
    c.moveTo(x0, y);
    c.lineTo(x1, y);
    c.stroke();

    const lineLen = w;
    const arrowCount = Math.max(1, Math.floor(lineLen / LINE_ARROW_INTERVAL));
    for (let a = 0; a < arrowCount; a++) {
      const t = (a + 0.5) / arrowCount;
      const ax = x0 + t * lineLen;
      const angle = rightward ? 0 : Math.PI;
      drawFieldArrowHead(c, ax, y, angle);
    }
  }

  if (showEdgeFieldLines) {
    const edgeLines = Math.min(EDGE_LINES_PER_SIDE, Math.max(1, Math.round(lineCount * 0.3)));
    drawEdgeLinesHorizontal(c, topLeft, w, h, rightward, edgeLines, plateMargin);
  }
}

/**
 * 竖直电场的边缘弯曲场线（左右两侧各 edgeCount 条）
 *
 * 弯曲方式：从正极板边缘附近出发，以向外鼓出的贝塞尔曲线
 * 连接到负极板边缘附近，形成经典"边缘效应"外观。
 */
function drawEdgeLinesVertical(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  downward: boolean,
  edgeCount: number,
  plateMargin: number,
): void {
  c.strokeStyle = EFIELD_ARROW_COLOR;
  c.lineWidth = 1.2;
  c.globalAlpha = 0.7;

  const plateLeft = topLeft.x + plateMargin;
  const plateRight = topLeft.x + w - plateMargin;
  // y0=正极板(场线起点), y1=负极板(场线终点)
  const y0 = downward ? topLeft.y : topLeft.y + h;
  const y1 = downward ? topLeft.y + h : topLeft.y;

  for (let i = 1; i <= edgeCount; i++) {
    // 起/终点紧贴极板边缘，逐条向内缩进少许
    const inset = plateMargin * 0.3 * (edgeCount - i);
    // 控制点向外偏移量：h 的 25%~55%，逐条递增，确保明显离开区域
    const bulge = h * (0.25 + 0.30 * (i / edgeCount));

    // ── 左侧边缘线 ──
    const lx = plateLeft + inset;
    // 控制点位于极板外侧，y 方向分别靠近起/终极板
    const lcp1: Vec2 = { x: lx - bulge, y: lerp(y0, y1, 0.20) };
    const lcp2: Vec2 = { x: lx - bulge, y: lerp(y0, y1, 0.80) };

    c.beginPath();
    c.moveTo(lx, y0);
    c.bezierCurveTo(lcp1.x, lcp1.y, lcp2.x, lcp2.y, lx, y1);
    c.stroke();

    // 箭头：采样曲线 t=0.5 处切线方向
    const midPt = cubicBezierPoint(lx, y0, lcp1.x, lcp1.y, lcp2.x, lcp2.y, lx, y1, 0.5);
    const midTan = cubicBezierTangent(lx, y0, lcp1.x, lcp1.y, lcp2.x, lcp2.y, lx, y1, 0.5);
    drawFieldArrowHead(c, midPt.x, midPt.y, Math.atan2(midTan.y, midTan.x));

    // ── 右侧边缘线 ──
    const rx = plateRight - inset;
    const rcp1: Vec2 = { x: rx + bulge, y: lerp(y0, y1, 0.20) };
    const rcp2: Vec2 = { x: rx + bulge, y: lerp(y0, y1, 0.80) };

    c.beginPath();
    c.moveTo(rx, y0);
    c.bezierCurveTo(rcp1.x, rcp1.y, rcp2.x, rcp2.y, rx, y1);
    c.stroke();

    const midPtR = cubicBezierPoint(rx, y0, rcp1.x, rcp1.y, rcp2.x, rcp2.y, rx, y1, 0.5);
    const midTanR = cubicBezierTangent(rx, y0, rcp1.x, rcp1.y, rcp2.x, rcp2.y, rx, y1, 0.5);
    drawFieldArrowHead(c, midPtR.x, midPtR.y, Math.atan2(midTanR.y, midTanR.x));
  }

  c.globalAlpha = 1.0;
}

/**
 * 水平电场的边缘弯曲场线（上下两侧各 edgeCount 条）
 */
function drawEdgeLinesHorizontal(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  rightward: boolean,
  edgeCount: number,
  plateMargin: number,
): void {
  c.strokeStyle = EFIELD_ARROW_COLOR;
  c.lineWidth = 1.2;
  c.globalAlpha = 0.7;

  const plateTop = topLeft.y + plateMargin;
  const plateBottom = topLeft.y + h - plateMargin;
  // x0=正极板(场线起点), x1=负极板(场线终点)
  const x0 = rightward ? topLeft.x : topLeft.x + w;
  const x1 = rightward ? topLeft.x + w : topLeft.x;

  for (let i = 1; i <= edgeCount; i++) {
    const inset = plateMargin * 0.3 * (edgeCount - i);
    const bulge = w * (0.25 + 0.30 * (i / edgeCount));

    // ── 上侧边缘线 ──
    const ty = plateTop + inset;
    const tcp1: Vec2 = { x: lerp(x0, x1, 0.20), y: ty - bulge };
    const tcp2: Vec2 = { x: lerp(x0, x1, 0.80), y: ty - bulge };

    c.beginPath();
    c.moveTo(x0, ty);
    c.bezierCurveTo(tcp1.x, tcp1.y, tcp2.x, tcp2.y, x1, ty);
    c.stroke();

    const tMid = cubicBezierPoint(x0, ty, tcp1.x, tcp1.y, tcp2.x, tcp2.y, x1, ty, 0.5);
    const tTan = cubicBezierTangent(x0, ty, tcp1.x, tcp1.y, tcp2.x, tcp2.y, x1, ty, 0.5);
    drawFieldArrowHead(c, tMid.x, tMid.y, Math.atan2(tTan.y, tTan.x));

    // ── 下侧边缘线 ──
    const by = plateBottom - inset;
    const bcp1: Vec2 = { x: lerp(x0, x1, 0.20), y: by + bulge };
    const bcp2: Vec2 = { x: lerp(x0, x1, 0.80), y: by + bulge };

    c.beginPath();
    c.moveTo(x0, by);
    c.bezierCurveTo(bcp1.x, bcp1.y, bcp2.x, bcp2.y, x1, by);
    c.stroke();

    const bMid = cubicBezierPoint(x0, by, bcp1.x, bcp1.y, bcp2.x, bcp2.y, x1, by, 0.5);
    const bTan = cubicBezierTangent(x0, by, bcp1.x, bcp1.y, bcp2.x, bcp2.y, x1, by, 0.5);
    drawFieldArrowHead(c, bMid.x, bMid.y, Math.atan2(bTan.y, bTan.x));
  }

  c.globalAlpha = 1.0;
}

// ═════════════════════════════════════════════════
// 通用箭头网格（showPlates=false）
// ═════════════════════════════════════════════════

function drawArrowGrid(
  c: CanvasRenderingContext2D,
  screenTopLeft: Vec2,
  screenW: number,
  screenH: number,
  direction: Vec2,
  coordinateTransform: { scale: number; origin: Vec2 },
): void {
  const spacingPx = worldLengthToScreen(ARROW_SPACING, coordinateTransform);
  const startX = screenTopLeft.x + spacingPx / 2;
  const startY = screenTopLeft.y + spacingPx / 2;
  const cols = Math.floor(screenW / spacingPx);
  const rows = Math.floor(screenH / spacingPx);

  const screenDirX = direction.x;
  const screenDirY = -direction.y;
  const dirLen = Math.hypot(screenDirX, screenDirY);
  const normDirX = dirLen > 0 ? screenDirX / dirLen : 0;
  const normDirY = dirLen > 0 ? screenDirY / dirLen : 0;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const cx = startX + col * spacingPx;
      const cy = startY + row * spacingPx;
      const from: Vec2 = {
        x: cx - normDirX * ARROW_LENGTH * 0.4,
        y: cy - normDirY * ARROW_LENGTH * 0.4,
      };
      const to: Vec2 = {
        x: cx + normDirX * ARROW_LENGTH * 0.4,
        y: cy + normDirY * ARROW_LENGTH * 0.4,
      };
      drawArrow(c, from, to, {
        color: EFIELD_ARROW_COLOR,
        lineWidth: 1.5,
        arrowHeadSize: 6,
      });
    }
  }
}

// ═════════════════════════════════════════════════
// 极板绘制
// ═════════════════════════════════════════════════

/** 极板厚度（像素） */
const PLATE_THICKNESS = 6;
/** 极板颜色（深灰金属质感） */
const PLATE_BODY_COLOR = '#8B4513';
/** 极板高光色 */
const PLATE_HIGHLIGHT = '#A0522D';

function drawPlates(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  direction: Vec2,
  showPolarityMarkers: boolean,
): void {
  if (Math.abs(direction.y) > Math.abs(direction.x)) {
    // 上下极板（竖直电场）
    const margin = w * 0.03;
    const plateW = w - 2 * margin;
    const plateX = topLeft.x + margin;

    // 上极板（填充矩形 + 高光边）
    c.fillStyle = PLATE_BODY_COLOR;
    c.fillRect(plateX, topLeft.y - PLATE_THICKNESS, plateW, PLATE_THICKNESS);
    c.fillStyle = PLATE_HIGHLIGHT;
    c.fillRect(plateX, topLeft.y - PLATE_THICKNESS, plateW, 1.5);

    // 下极板
    c.fillStyle = PLATE_BODY_COLOR;
    c.fillRect(plateX, topLeft.y + h, plateW, PLATE_THICKNESS);
    c.fillStyle = PLATE_HIGHLIGHT;
    c.fillRect(plateX, topLeft.y + h, plateW, 1.5);

    if (showPolarityMarkers) {
      c.font = 'bold 16px Inter, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = PLATE_COLOR;
      if (direction.y < 0) {
        c.fillText('+', topLeft.x + w / 2, topLeft.y - PLATE_THICKNESS - 10);
        c.fillText('−', topLeft.x + w / 2, topLeft.y + h + PLATE_THICKNESS + 12);
      } else {
        c.fillText('−', topLeft.x + w / 2, topLeft.y - PLATE_THICKNESS - 10);
        c.fillText('+', topLeft.x + w / 2, topLeft.y + h + PLATE_THICKNESS + 12);
      }
    }
  } else {
    // 左右极板（水平电场）
    const margin = h * 0.03;
    const plateH = h - 2 * margin;
    const plateY = topLeft.y + margin;

    // 左极板
    c.fillStyle = PLATE_BODY_COLOR;
    c.fillRect(topLeft.x - PLATE_THICKNESS, plateY, PLATE_THICKNESS, plateH);
    c.fillStyle = PLATE_HIGHLIGHT;
    c.fillRect(topLeft.x - 1, plateY, 1.5, plateH);

    // 右极板
    c.fillStyle = PLATE_BODY_COLOR;
    c.fillRect(topLeft.x + w, plateY, PLATE_THICKNESS, plateH);
    c.fillStyle = PLATE_HIGHLIGHT;
    c.fillRect(topLeft.x + w, plateY, 1.5, plateH);

    if (showPolarityMarkers) {
      c.font = 'bold 16px Inter, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillStyle = PLATE_COLOR;
      if (direction.x > 0) {
        c.fillText('+', topLeft.x - PLATE_THICKNESS - 12, topLeft.y + h / 2);
        c.fillText('−', topLeft.x + w + PLATE_THICKNESS + 12, topLeft.y + h / 2);
      } else {
        c.fillText('−', topLeft.x - PLATE_THICKNESS - 12, topLeft.y + h / 2);
        c.fillText('+', topLeft.x + w + PLATE_THICKNESS + 12, topLeft.y + h / 2);
      }
    }
  }
}

function drawFlowmeterTeachingOverlay(
  c: CanvasRenderingContext2D,
  topLeft: Vec2,
  w: number,
  h: number,
  direction: Vec2,
  teachingState: ReturnType<typeof getFlowmeterTeachingState>,
): void {
  const badgeW = Math.min(220, Math.max(150, w * 0.62));
  const badgeX = topLeft.x + (w - badgeW) / 2;
  const badgeY = topLeft.y + 8;
  const chargeAlpha = clamp(0.22 + teachingState.buildupRatio * 0.78, 0.22, 1);
  const arrowAlpha = clamp(0.18 + teachingState.buildupRatio * 0.82, 0.18, 1);

  c.save();
  c.fillStyle = 'rgba(255, 255, 255, 0.92)';
  c.strokeStyle = 'rgba(39, 174, 96, 0.28)';
  c.lineWidth = 1;
  c.fillRect(badgeX, badgeY, badgeW, 34);
  c.strokeRect(badgeX, badgeY, badgeW, 34);

  c.fillStyle = '#1F2937';
  c.font = '600 11px Inter, sans-serif';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  c.fillText(teachingState.stageLabel, badgeX + badgeW / 2, badgeY + 12);

  c.fillStyle = '#6B7280';
  c.font = '10px Inter, sans-serif';
  c.fillText(
    `E感 ≈ ${teachingState.currentElectricField.toFixed(1)} / ${teachingState.targetElectricField.toFixed(1)} V/m`,
    badgeX + badgeW / 2,
    badgeY + 24,
  );

  const isVertical = Math.abs(direction.y) > Math.abs(direction.x);
  if (isVertical) {
    const positiveAtTop = direction.y < 0;
    const positiveY = positiveAtTop ? topLeft.y - PLATE_THICKNESS - 18 : topLeft.y + h + PLATE_THICKNESS + 14;
    const negativeY = positiveAtTop ? topLeft.y + h + PLATE_THICKNESS + 14 : topLeft.y - PLATE_THICKNESS - 18;
    const plateCenterX = topLeft.x + w / 2;

    c.fillStyle = `rgba(231, 76, 60, ${chargeAlpha})`;
    c.font = 'bold 18px Inter, sans-serif';
    c.fillText('+', plateCenterX, positiveY);
    c.fillStyle = `rgba(52, 152, 219, ${chargeAlpha})`;
    c.fillText('−', plateCenterX, negativeY);

    const arrowX = topLeft.x + w - 18;
    const startY = direction.y < 0 ? topLeft.y + 18 : topLeft.y + h - 18;
    const endY = direction.y < 0 ? topLeft.y + h - 18 : topLeft.y + 18;
    const shownEndY = lerp(startY, endY, 0.18 + 0.72 * teachingState.buildupRatio);
    c.strokeStyle = `rgba(39, 174, 96, ${arrowAlpha})`;
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(arrowX, startY);
    c.lineTo(arrowX, shownEndY);
    c.stroke();
    drawFieldArrowHead(c, arrowX, shownEndY, direction.y < 0 ? Math.PI / 2 : -Math.PI / 2);
  } else {
    const positiveAtLeft = direction.x > 0;
    const positiveX = positiveAtLeft ? topLeft.x - PLATE_THICKNESS - 14 : topLeft.x + w + PLATE_THICKNESS + 14;
    const negativeX = positiveAtLeft ? topLeft.x + w + PLATE_THICKNESS + 14 : topLeft.x - PLATE_THICKNESS - 14;
    const plateCenterY = topLeft.y + h / 2;

    c.fillStyle = `rgba(231, 76, 60, ${chargeAlpha})`;
    c.font = 'bold 18px Inter, sans-serif';
    c.fillText('+', positiveX, plateCenterY);
    c.fillStyle = `rgba(52, 152, 219, ${chargeAlpha})`;
    c.fillText('−', negativeX, plateCenterY);

    const arrowY = topLeft.y + 18;
    const startX = direction.x > 0 ? topLeft.x + 18 : topLeft.x + w - 18;
    const endX = direction.x > 0 ? topLeft.x + w - 18 : topLeft.x + 18;
    const shownEndX = lerp(startX, endX, 0.18 + 0.72 * teachingState.buildupRatio);
    c.strokeStyle = `rgba(39, 174, 96, ${arrowAlpha})`;
    c.lineWidth = 1.8;
    c.beginPath();
    c.moveTo(startX, arrowY);
    c.lineTo(shownEndX, arrowY);
    c.stroke();
    drawFieldArrowHead(c, shownEndX, arrowY, direction.x > 0 ? 0 : Math.PI);
  }

  c.restore();
}

// ═════════════════════════════════════════════════
// 辅助函数
// ═════════════════════════════════════════════════

/** 线性插值 */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/** 三次贝塞尔曲线在参数 t 处的坐标 */
function cubicBezierPoint(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, t: number,
): Vec2 {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x: mt2 * mt * x0 + 3 * mt2 * t * x1 + 3 * mt * t2 * x2 + t2 * t * x3,
    y: mt2 * mt * y0 + 3 * mt2 * t * y1 + 3 * mt * t2 * y2 + t2 * t * y3,
  };
}

/** 三次贝塞尔曲线在参数 t 处的切线向量（未归一化） */
function cubicBezierTangent(
  x0: number, y0: number, x1: number, y1: number,
  x2: number, y2: number, x3: number, y3: number, t: number,
): Vec2 {
  const mt = 1 - t;
  return {
    x: 3 * mt * mt * (x1 - x0) + 6 * mt * t * (x2 - x1) + 3 * t * t * (x3 - x2),
    y: 3 * mt * mt * (y1 - y0) + 6 * mt * t * (y2 - y1) + 3 * t * t * (y3 - y2),
  };
}

/** 绘制场线上的方向箭头（三角形） */
function drawFieldArrowHead(
  c: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
): void {
  c.save();
  c.fillStyle = EFIELD_ARROW_COLOR;
  c.translate(x, y);
  c.rotate(angle);
  c.beginPath();
  c.moveTo(LINE_ARROW_SIZE, 0);
  c.lineTo(-LINE_ARROW_SIZE * 0.5, -LINE_ARROW_SIZE * 0.5);
  c.lineTo(-LINE_ARROW_SIZE * 0.5, LINE_ARROW_SIZE * 0.5);
  c.closePath();
  c.fill();
  c.restore();
}

export function registerUniformEFieldRenderer(): void {
  rendererRegistry.registerEntity({
    entityType: 'uniform-efield',
    renderer: uniformEFieldRenderer,
    layer: 'field',
  });
}
