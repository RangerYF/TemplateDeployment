import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import type { Entity, Vec2 } from '@/core/types';
import { FORCE_COLORS } from '@/core/visual-constants';

const MIN_LENGTH = 30;
const MAX_LENGTH = 180;
const EDGE_GAP = 0.02;
const LABEL_FONT_SIZE = 12;
const LABEL_PAD = 6; // 标签与障碍物的最小间距 px

// ─── AABB 工具 ───

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

function boxesOverlap(a: Box, b: Box): boolean {
  return !(
    a.left + a.width + LABEL_PAD <= b.left ||
    b.left + b.width + LABEL_PAD <= a.left ||
    a.top + a.height + LABEL_PAD <= b.top ||
    b.top + b.height + LABEL_PAD <= a.top
  );
}

/** 两个 box 的重叠面积（用于评分，越大越差） */
function overlapArea(a: Box, b: Box): number {
  const xOverlap = Math.max(0,
    Math.min(a.left + a.width + LABEL_PAD, b.left + b.width + LABEL_PAD) -
    Math.max(a.left - LABEL_PAD, b.left - LABEL_PAD));
  const yOverlap = Math.max(0,
    Math.min(a.top + a.height + LABEL_PAD, b.top + b.height + LABEL_PAD) -
    Math.max(a.top - LABEL_PAD, b.top - LABEL_PAD));
  return xOverlap * yOverlap;
}

function arrowToBox(from: Vec2, to: Vec2, lineWidth: number): Box {
  const pad = lineWidth / 2 + 4;
  const left = Math.min(from.x, to.x) - pad;
  const top = Math.min(from.y, to.y) - pad;
  return {
    left,
    top,
    width: Math.abs(to.x - from.x) + pad * 2,
    height: Math.abs(to.y - from.y) + pad * 2,
  };
}

// ─── 标签候选位置系统 ───

interface LabelCandidate {
  x: number;
  y: number;
  align: CanvasTextAlign;
}

interface PlacedLabel {
  text: string;
  x: number;
  y: number;
  align: CanvasTextAlign;
  color: string;
  fontSize: number;
  box: Box;
}

/** 测量标签文本的像素宽度 */
function measureLabel(text: string, fontSize: number, canvasCtx: CanvasRenderingContext2D): number {
  canvasCtx.font = `${fontSize}px 'Inter', sans-serif`;
  return canvasCtx.measureText(text).width;
}

/** 根据位置和对齐方式计算标签 AABB */
function labelBox(x: number, y: number, align: CanvasTextAlign, textWidth: number, fontSize: number): Box {
  let left: number;
  if (align === 'left') left = x;
  else if (align === 'right') left = x - textWidth;
  else left = x - textWidth / 2;
  return { left, top: y - fontSize / 2, width: textWidth, height: fontSize };
}

/**
 * 为一个箭头的标签生成候选位置（箭头中点和终点各 4 个方向）
 * 返回按偏好排序的候选列表
 */
function generateCandidates(
  screenFrom: Vec2,
  screenTo: Vec2,
  direction: Vec2,
): LabelCandidate[] {
  const mid = {
    x: (screenFrom.x + screenTo.x) / 2,
    y: (screenFrom.y + screenTo.y) / 2,
  };
  const tip = screenTo;
  const off = 12; // 偏移距离

  // 基于力方向确定首选方位
  const isHorizontal = Math.abs(direction.x) > Math.abs(direction.y);
  const goesRight = direction.x > 0;
  const goesUp = direction.y > 0; // 物理向上 = 屏幕向上(screenTo.y < screenFrom.y)

  const candidates: LabelCandidate[] = [];

  if (isHorizontal) {
    // 水平力：首选终点外侧上方，备选下方、中点上方/下方
    const tipAlign: CanvasTextAlign = goesRight ? 'left' : 'right';
    const tipOffX = goesRight ? off : -off;
    candidates.push({ x: tip.x + tipOffX, y: tip.y - off, align: tipAlign });  // 终点上方
    candidates.push({ x: tip.x + tipOffX, y: tip.y + off, align: tipAlign });  // 终点下方
    candidates.push({ x: mid.x, y: mid.y - off, align: 'center' });           // 中点上方
    candidates.push({ x: mid.x, y: mid.y + off, align: 'center' });           // 中点下方
  } else {
    // 竖直力：首选中点右侧，备选左侧、终点右侧/左侧
    const tipOffY = goesUp ? -off : off;
    candidates.push({ x: mid.x + off + 4, y: mid.y, align: 'left' });         // 中点右侧
    candidates.push({ x: mid.x - off - 4, y: mid.y, align: 'right' });        // 中点左侧
    candidates.push({ x: tip.x + off + 4, y: tip.y + tipOffY, align: 'left' });   // 终点右侧
    candidates.push({ x: tip.x - off - 4, y: tip.y + tipOffY, align: 'right' });  // 终点左侧
  }

  return candidates;
}

/**
 * 贪心最优放置：为每个标签从候选位置中选择重叠最小的。
 * obstacles = 其他箭头的 box（排除自身箭头）。
 */
function placeLabels(
  items: Array<{
    text: string;
    color: string;
    fontSize: number;
    candidates: LabelCandidate[];
    arrowIndex: number;
  }>,
  arrowBoxes: Box[],
  canvasCtx: CanvasRenderingContext2D,
): PlacedLabel[] {
  const placed: PlacedLabel[] = [];

  for (const item of items) {
    const textW = measureLabel(item.text, item.fontSize, canvasCtx);
    let bestScore = Infinity;
    let bestCandidate = item.candidates[0]!;

    for (const cand of item.candidates) {
      const box = labelBox(cand.x, cand.y, cand.align, textW, item.fontSize);
      let score = 0;

      // 与已放置标签的重叠
      for (const p of placed) {
        if (boxesOverlap(box, p.box)) {
          score += overlapArea(box, p.box);
        }
      }

      // 与其他箭头的重叠（跳过自己的箭头）
      for (let k = 0; k < arrowBoxes.length; k++) {
        if (k === item.arrowIndex) continue;
        const aBox = arrowBoxes[k]!;
        if (boxesOverlap(box, aBox)) {
          score += overlapArea(box, aBox);
        }
      }

      if (score < bestScore) {
        bestScore = score;
        bestCandidate = cand;
        if (score === 0) break; // 完美位置，无需继续
      }
    }

    const finalBox = labelBox(bestCandidate.x, bestCandidate.y, bestCandidate.align, textW, item.fontSize);
    placed.push({
      text: item.text,
      x: bestCandidate.x,
      y: bestCandidate.y,
      align: bestCandidate.align,
      color: item.color,
      fontSize: item.fontSize,
      box: finalBox,
    });
  }

  return placed;
}

// ─── 物理工具 ───

function forceToLength(magnitude: number): number {
  if (magnitude <= 0) return 0;
  const len = MIN_LENGTH + (MAX_LENGTH - MIN_LENGTH) * Math.log(1 + magnitude) / Math.log(1 + 100);
  return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, len));
}

function getEdgeStart(center: Vec2, direction: Vec2, entity: Entity): Vec2 {
  const dx = direction.x;
  const dy = direction.y;
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) return center;

  const radius = entity.properties.radius as number | undefined;
  const width = entity.properties.width as number | undefined;
  const height = entity.properties.height as number | undefined;

  let offset: number;

  if (radius != null && radius > 0) {
    offset = radius + EDGE_GAP;
  } else if (width != null && height != null && width > 0 && height > 0) {
    // 将力方向旋转到物块局部坐标系（处理旋转矩形）
    const rot = entity.transform.rotation ?? 0;
    let localDx = dx;
    let localDy = dy;
    if (Math.abs(rot) > 1e-6) {
      const cosR = Math.cos(-rot);
      const sinR = Math.sin(-rot);
      localDx = dx * cosR - dy * sinR;
      localDy = dx * sinR + dy * cosR;
    }

    const halfW = width / 2;
    const halfH = height / 2;
    const absLocalDx = Math.abs(localDx);
    const absLocalDy = Math.abs(localDy);
    const tX = absLocalDx > 1e-9 ? halfW / absLocalDx : Infinity;
    const tY = absLocalDy > 1e-9 ? halfH / absLocalDy : Infinity;
    offset = Math.min(tX, tY) + EDGE_GAP;
  } else {
    return center;
  }

  const len = Math.hypot(dx, dy);
  return {
    x: center.x + (dx / len) * offset,
    y: center.y + (dy / len) * offset,
  };
}

function isNearlyCollinear(a: Vec2, b: Vec2): boolean {
  return a.x * b.x + a.y * b.y > 0.87;
}

function formatForceArrowLabel(force: import('@/core/types').Force): string {
  if (force.label.includes('=') || force.label.includes('≈')) {
    return force.label;
  }
  return `${force.label}=${Number(force.magnitude.toFixed(1))}N`;
}

// ─── 主渲染器 ───

const forceViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'force') return;

  const { analyses } = data.data;
  const { coordinateTransform } = ctx;

  for (const analysis of analyses) {
    const entity = entities.get(analysis.entityId);
    if (!entity) continue;

    const pos = entity.transform.position;
    const entityHeight = (entity.properties.height as number) ?? 0;
    const rotation = entity.transform.rotation ?? 0;
    // 物块中心 = 底边中心 + 旋转后的"向上半高"向量
    const center = {
      x: pos.x + (-Math.sin(rotation)) * (entityHeight / 2),
      y: pos.y + Math.cos(rotation) * (entityHeight / 2),
    };

    const arrows: Array<{
      from: Vec2;
      to: Vec2;
      color: string;
      lineWidth: number;
      dashed: boolean;
      arrowHeadSize?: number;
      alpha?: number;
    }> = [];

    const labelItems: Array<{
      text: string;
      color: string;
      fontSize: number;
      candidates: LabelCandidate[];
      arrowIndex: number;
    }> = [];

    // ── 独立力 ──
    for (const force of analysis.forces) {
      const arrowLen = forceToLength(force.displayMagnitude ?? force.magnitude);
      const edgeStart = getEdgeStart(center, force.direction, entity);
      const screenFrom = worldToScreen(edgeStart, coordinateTransform);
      const screenTo = {
        x: screenFrom.x + force.direction.x * arrowLen,
        y: screenFrom.y - force.direction.y * arrowLen,
      };

      const color = FORCE_COLORS[force.type] ?? '#666';
      const arrowIdx = arrows.length;
      arrows.push({ from: screenFrom, to: screenTo, color, lineWidth: 2.5, dashed: false });

      const labelText = formatForceArrowLabel(force);
      labelItems.push({
        text: labelText,
        color,
        fontSize: LABEL_FONT_SIZE,
        candidates: generateCandidates(screenFrom, screenTo, force.direction),
        arrowIndex: arrowIdx,
      });
    }

    // ── 正交分解渲染 ──
    // 分量箭头从物体中心出发（跟其他力一样，从边缘开始画），用虚线
    // 从原力（G）终点向两个分力所在直线画垂直引导虚线
    if (analysis.decomposition) {
      const { axis1, axis2, components } = analysis.decomposition;
      const DECOMP_FONT_SIZE = 11;

      for (const comp of components) {
        const forceColor = FORCE_COLORS[comp.force.type] ?? '#666';
        const forceArrowLen = forceToLength(comp.force.displayMagnitude ?? comp.force.magnitude);

        // 比例缩放
        const scale = forceArrowLen / comp.force.magnitude;

        // 分量物理方向（带符号）
        const dir1 = {
          x: comp.component1 > 0 ? axis1.x : -axis1.x,
          y: comp.component1 > 0 ? axis1.y : -axis1.y,
        };
        const dir2 = {
          x: comp.component2 > 0 ? axis2.x : -axis2.x,
          y: comp.component2 > 0 ? axis2.y : -axis2.y,
        };
        const mag1 = Math.abs(comp.component1) * scale;
        const mag2 = Math.abs(comp.component2) * scale;

        // 分量箭头从物体边缘出发，与近共线的独立力/合力做垂直偏移避免重叠
        const DECOMP_PERP_OFFSET = 10;
        // 检测目标：所有独立力 + 合力（如果合力有效）
        const rDir = analysis.resultant.direction;
        const rMag2 = analysis.resultant.magnitude;
        const allDirs = analysis.forces.map((f) => f.direction);
        if (rMag2 > 0.01) allDirs.push(rDir);

        const edge1 = getEdgeStart(center, dir1, entity);
        let screen1From = worldToScreen(edge1, coordinateTransform);
        const collinear1 = allDirs.some((d) =>
          Math.abs(d.x * dir1.x + d.y * dir1.y) > 0.87,
        );
        if (collinear1) {
          screen1From = {
            x: screen1From.x + dir1.y * DECOMP_PERP_OFFSET,
            y: screen1From.y + dir1.x * DECOMP_PERP_OFFSET,
          };
        }
        const screen1To = {
          x: screen1From.x + dir1.x * mag1,
          y: screen1From.y - dir1.y * mag1,
        };

        const edge2 = getEdgeStart(center, dir2, entity);
        let screen2From = worldToScreen(edge2, coordinateTransform);
        const collinear2 = allDirs.some((d) =>
          Math.abs(d.x * dir2.x + d.y * dir2.y) > 0.87,
        );
        if (collinear2) {
          screen2From = {
            x: screen2From.x + dir2.y * DECOMP_PERP_OFFSET,
            y: screen2From.y + dir2.x * DECOMP_PERP_OFFSET,
          };
        }
        const screen2To = {
          x: screen2From.x + dir2.x * mag2,
          y: screen2From.y - dir2.y * mag2,
        };

        // G 的终点（屏幕坐标）
        const edgeG = getEdgeStart(center, comp.force.direction, entity);
        const screenGFrom = worldToScreen(edgeG, coordinateTransform);
        const forceTip = {
          x: screenGFrom.x + comp.force.direction.x * forceArrowLen,
          y: screenGFrom.y - comp.force.direction.y * forceArrowLen,
        };

        // 分量箭头纳入统一 arrows 数组（参与碰撞检测和统一绘制）
        arrows.push({ from: screen1From, to: screen1To, color: forceColor, lineWidth: 1.8, dashed: true, arrowHeadSize: 7 });
        arrows.push({ from: screen2From, to: screen2To, color: forceColor, lineWidth: 1.8, dashed: true, arrowHeadSize: 7 });
        // 引导虚线（无箭头，低透明度）
        arrows.push({ from: screen1To, to: forceTip, color: forceColor, lineWidth: 1, dashed: true, arrowHeadSize: 0, alpha: 0.35 });
        arrows.push({ from: forceTip, to: screen2To, color: forceColor, lineWidth: 1, dashed: true, arrowHeadSize: 0, alpha: 0.35 });

        // 分量1标注（mgsinθ — 沿斜面分量）
        const comp1LabelText = `mgsinθ=${Number(Math.abs(comp.component1).toFixed(1))}N`;
        labelItems.push({
          text: comp1LabelText,
          color: forceColor,
          fontSize: DECOMP_FONT_SIZE,
          candidates: generateCandidates(screen1From, screen1To, dir1),
          arrowIndex: arrows.length - 4, // 分量1箭头
        });

        // 分量2标注（mgcosθ — 垂直斜面分量）
        const comp2LabelText = `mgcosθ=${Number(Math.abs(comp.component2).toFixed(1))}N`;
        labelItems.push({
          text: comp2LabelText,
          color: forceColor,
          fontSize: DECOMP_FONT_SIZE,
          candidates: generateCandidates(screen2From, screen2To, dir2),
          arrowIndex: arrows.length - 3, // 分量2箭头
        });
      }
    }

    // ── 合力 ──
    const resultantColor = FORCE_COLORS.resultant!;
    const rMag = analysis.resultant.magnitude;
    const rDir = analysis.resultant.direction;

    const resultantRedundant = rMag > 0.01 &&
      analysis.forces.some((f) =>
        Math.abs(f.magnitude - rMag) < 0.01 &&
        Math.abs(f.direction.x - rDir.x) < 0.01 &&
        Math.abs(f.direction.y - rDir.y) < 0.01,
      );

    if (rMag > 0.01 && !resultantRedundant) {
      const arrowLen = forceToLength(analysis.resultant.displayMagnitude ?? rMag);

      const PERP_OFFSET = 14;
      const nearCollinear = analysis.forces.some((f) => isNearlyCollinear(f.direction, rDir));
      const perpX = nearCollinear ? rDir.y * PERP_OFFSET : 0;
      const perpY = nearCollinear ? rDir.x * PERP_OFFSET : 0;

      const resultantEdge = getEdgeStart(center, rDir, entity);
      const screenFrom = worldToScreen(resultantEdge, coordinateTransform);
      const offsetFrom = { x: screenFrom.x + perpX, y: screenFrom.y + perpY };
      const offsetTo = {
        x: offsetFrom.x + rDir.x * arrowLen,
        y: offsetFrom.y - rDir.y * arrowLen,
      };

      const rArrowIdx = arrows.length;
      arrows.push({ from: offsetFrom, to: offsetTo, color: resultantColor, lineWidth: 2, dashed: true });

      const labelText = formatForceArrowLabel(analysis.resultant);
      labelItems.push({
        text: labelText,
        color: resultantColor,
        fontSize: LABEL_FONT_SIZE,
        candidates: generateCandidates(offsetFrom, offsetTo, rDir),
        arrowIndex: rArrowIdx,
      });
    }
    // 合力为零时不在画布上显示标签（InfoPanel 已显示"合力为零，受力平衡"）

    // ── 最优放置 ──
    const arrowBoxes = arrows.map((a) => arrowToBox(a.from, a.to, a.lineWidth));
    const placedLabels = placeLabels(labelItems, arrowBoxes, ctx.ctx);

    // ── 绘制：先标签后箭头（箭头在上层） ──
    for (const label of placedLabels) {
      drawTextLabel(ctx.ctx, label.text, { x: label.x, y: label.y }, {
        color: label.color,
        fontSize: label.fontSize,
        align: label.align,
      });
    }

    for (const arrow of arrows) {
      if (arrow.alpha != null && arrow.alpha < 1) {
        ctx.ctx.save();
        ctx.ctx.globalAlpha = arrow.alpha;
      }
      drawArrow(ctx.ctx, arrow.from, arrow.to, {
        color: arrow.color,
        lineWidth: arrow.lineWidth,
        arrowHeadSize: arrow.arrowHeadSize ?? 10,
        dashed: arrow.dashed,
      });
      if (arrow.alpha != null && arrow.alpha < 1) {
        ctx.ctx.restore();
      }
    }
  }
};

export function registerForceViewport(): void {
  rendererRegistry.registerViewport('force', forceViewportRenderer);
}
