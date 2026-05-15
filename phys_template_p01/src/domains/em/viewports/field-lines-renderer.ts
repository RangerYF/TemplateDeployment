/**
 * 电场线与等势线渲染子模块
 *
 * 由 field-viewport.ts 在检测到点电荷场景时调用
 *
 * - 正电荷电场线：红色 (#E53E3E)
 * - 负电荷电场线：蓝色 (#3182CE)
 * - 等势线：绿色虚线 (#27AE60)
 * - 方向箭头：三角形，沿曲线切线方向
 * - 线条使用 quadratic bezier 平滑绘制
 */

import type { Vec2, CoordinateTransform } from '@/core/types';
import type { FieldLine, EquipotentialLine } from '@/domains/em/logic/field-line-calculator';

const POSITIVE_COLOR = '#E53E3E'; // 正电荷电场线（红色）
const NEGATIVE_COLOR = '#3182CE'; // 负电荷电场线（蓝色）
const EQUIPOTENTIAL_COLOR = '#27AE60'; // 等势线（绿色）
const ARROW_INTERVAL_PX = 80; // 每隔约80px画一个方向箭头
const ARROW_SIZE = 7;
const LINE_WIDTH = 1.8;

/** 物理坐标 → 屏幕坐标 */
function toScreen(p: Vec2, ct: CoordinateTransform): Vec2 {
  return {
    x: ct.origin.x + p.x * ct.scale,
    y: ct.origin.y - p.y * ct.scale, // Y 翻转
  };
}

/**
 * 渲染电场线和等势线
 */
export function renderFieldLines(
  c: CanvasRenderingContext2D,
  fieldLines: FieldLine[],
  equipotentialLines: EquipotentialLine[],
  coordinateTransform: CoordinateTransform,
  options?: {
    showFieldLines?: boolean;
    showEquipotentialLines?: boolean;
    depthStrength?: number;
    perspectiveDeg?: number;
  },
): void {
  const ct = coordinateTransform;
  const showFieldLines = options?.showFieldLines ?? true;
  const showEquipotentialLines = options?.showEquipotentialLines ?? true;
  const depthStrength = clamp(options?.depthStrength ?? 0, 0, 1);
  const perspectiveDeg = options?.perspectiveDeg ?? 0;

  // ─── 电场线 ─────────────────────────────────────
  if (showFieldLines) {
    const projectedLines = fieldLines
      .map((line) => ({
        line,
        screenPts: line.points.map((point) => projectFieldPoint(toScreen(point, ct), point, depthStrength, perspectiveDeg)),
        depth: computeAverageDepth(line.points),
      }))
      .sort((left, right) => left.depth - right.depth);

    for (const projected of projectedLines) {
      const { line, screenPts, depth } = projected;
      if (line.points.length < 2) continue;

      const color = line.sourceSign === 1 ? POSITIVE_COLOR : NEGATIVE_COLOR;
      const alpha = lerp(0.32, 0.88, 1 - ((depthStrength * 0.5) + (depth * 0.5)));
      const widthScale = lerp(0.82, 1.22, 1 - ((depthStrength * 0.45) + (depth * 0.55)));

      c.save();
      c.strokeStyle = color;
      c.lineWidth = LINE_WIDTH * widthScale;
      c.lineJoin = 'round';
      c.lineCap = 'round';
      c.globalAlpha = alpha;
      c.shadowColor = color;
      c.shadowBlur = lerp(1.5, 8, depthStrength * (1 - depth));

      c.beginPath();
      c.moveTo(screenPts[0]!.x, screenPts[0]!.y);

      if (screenPts.length === 2) {
        c.lineTo(screenPts[1]!.x, screenPts[1]!.y);
      } else {
        // 使用 quadratic bezier：控制点为当前点，终点为当前点与下一点的中点
        for (let i = 0; i < screenPts.length - 2; i++) {
          const curr = screenPts[i]!;
          const next = screenPts[i + 1]!;
          const midX = (curr.x + next.x) / 2;
          const midY = (curr.y + next.y) / 2;
          c.quadraticCurveTo(curr.x, curr.y, midX, midY);
        }
        // 最后一段连到终点
        const secondLast = screenPts[screenPts.length - 2]!;
        const last = screenPts[screenPts.length - 1]!;
        c.quadraticCurveTo(secondLast.x, secondLast.y, last.x, last.y);
      }
      c.stroke();
      c.restore();

      drawDirectionArrows(
        c,
        screenPts,
        color,
        line.sourceSign === -1 ? -1 : 1,
        alpha,
        widthScale,
      );
    }
  }

  // ─── 等势线 ─────────────────────────────────────
  if (showEquipotentialLines) {
    c.save();
    c.strokeStyle = EQUIPOTENTIAL_COLOR;
    c.lineWidth = 1;
    c.setLineDash([6, 4]);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    c.globalAlpha = lerp(0.54, 0.74, 1 - (depthStrength * 0.5));

    for (const eqLine of equipotentialLines) {
      if (eqLine.points.length < 2) continue;

      c.beginPath();
      const sp0 = projectFieldPoint(toScreen(eqLine.points[0]!, ct), eqLine.points[0]!, depthStrength, perspectiveDeg);
      c.moveTo(sp0.x, sp0.y);

      for (let i = 1; i < eqLine.points.length; i++) {
        const sp = projectFieldPoint(toScreen(eqLine.points[i]!, ct), eqLine.points[i]!, depthStrength, perspectiveDeg);
        c.lineTo(sp.x, sp.y);
      }
      c.stroke();
    }

    c.setLineDash([]);
    c.restore();
  }
}

/** 沿电场线绘制方向三角形箭头 */
function drawDirectionArrows(
  c: CanvasRenderingContext2D,
  screenPts: Vec2[],
  color: string,
  direction: 1 | -1 = 1,
  alpha: number = 1,
  widthScale: number = 1,
): void {
  if (screenPts.length < 2) return;

  // 计算累积距离
  const cumDist: number[] = [0];
  for (let i = 1; i < screenPts.length; i++) {
    const cur = screenPts[i]!;
    const prev = screenPts[i - 1]!;
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    cumDist.push(cumDist[i - 1]! + Math.sqrt(dx * dx + dy * dy));
  }

  const totalDist = cumDist[cumDist.length - 1]!;
  if (totalDist < ARROW_INTERVAL_PX * 0.5) return;

  // 从 ARROW_INTERVAL_PX * 0.4 开始，每隔 ARROW_INTERVAL_PX 画一个
  let nextArrowDist = ARROW_INTERVAL_PX * 0.4;
  let segIdx = 0;

  while (nextArrowDist < totalDist - ARROW_SIZE * 2) {
    // 找到对应线段
    while (segIdx < cumDist.length - 1 && cumDist[segIdx + 1]! < nextArrowDist) {
      segIdx++;
    }
    if (segIdx >= screenPts.length - 1) break;

    const segStart = screenPts[segIdx]!;
    const segEnd = screenPts[segIdx + 1]!;
    const segLen = cumDist[segIdx + 1]! - cumDist[segIdx]!;
    if (segLen < 1e-6) {
      nextArrowDist += ARROW_INTERVAL_PX;
      continue;
    }

    const t = (nextArrowDist - cumDist[segIdx]!) / segLen;
    const px = segStart.x + t * (segEnd.x - segStart.x);
    const py = segStart.y + t * (segEnd.y - segStart.y);
    const angle = Math.atan2(segEnd.y - segStart.y, segEnd.x - segStart.x)
      + (direction === -1 ? Math.PI : 0);

    // 三角形箭头（等腰三角形，尖端朝前进方向）
    c.save();
    c.fillStyle = color;
    c.globalAlpha = alpha;
    c.beginPath();
    c.moveTo(
      px + (ARROW_SIZE * widthScale) * Math.cos(angle),
      py + (ARROW_SIZE * widthScale) * Math.sin(angle),
    );
    c.lineTo(
      px + (ARROW_SIZE * widthScale) * Math.cos(angle + 2.5),
      py + (ARROW_SIZE * widthScale) * Math.sin(angle + 2.5),
    );
    c.lineTo(
      px + (ARROW_SIZE * widthScale) * Math.cos(angle - 2.5),
      py + (ARROW_SIZE * widthScale) * Math.sin(angle - 2.5),
    );
    c.closePath();
    c.fill();
    c.restore();

    nextArrowDist += ARROW_INTERVAL_PX;
  }
}

function projectFieldPoint(
  screenPoint: Vec2,
  worldPoint: Vec2,
  depthStrength: number,
  perspectiveDeg: number,
): Vec2 {
  if (depthStrength <= 1e-3 && Math.abs(perspectiveDeg) <= 1e-3) return screenPoint;

  const tilt = (perspectiveDeg * Math.PI) / 180;
  const depth = computePointDepth(worldPoint);
  const perspectiveScale = 1 - (depthStrength * 0.12 * depth);
  const elevatedY = screenPoint.y - (Math.sin(tilt) * depthStrength * 26 * depth);

  return {
    x: screenPoint.x * perspectiveScale + (1 - perspectiveScale) * screenPoint.x,
    y: elevatedY,
  };
}

function computePointDepth(point: Vec2): number {
  return clamp((point.y + 1.4) / 2.8, 0, 1);
}

function computeAverageDepth(points: Vec2[]): number {
  if (points.length === 0) return 0;
  const total = points.reduce((sum, point) => sum + computePointDepth(point), 0);
  return total / points.length;
}

function lerp(start: number, end: number, t: number): number {
  return start + ((end - start) * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
