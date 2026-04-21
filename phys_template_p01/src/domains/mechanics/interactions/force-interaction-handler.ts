import { rendererRegistry } from '@/core/registries/renderer-registry';
import type { ViewportInteractionHandler } from '@/core/registries/renderer-registry';
import type { EntityId, RenderContext, Selection, Vec2 } from '@/core/types';
import { useSimulationStore } from '@/store';
import { FORCE_COLORS } from '@/core/visual-constants';
import { worldToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { PlacementBox } from '@/renderer/placement';
import { segmentToBox, measureText, placeLabel, directionToPreferred } from '@/renderer/placement';
import {
  getForceArrowAtPoint,
  getCachedForceArrows,
  forceToLength,
  getEdgeStart,
  generateCandidates,
  labelBoxFromAlign,
} from '../viewports/force-viewport';
import {
  getForceInteractionState,
  setHoveredForce,
  resetForceInteraction,
  updateDecompositionProgress,
  easeOut,
} from './force-interaction-state';

/**
 * 力视角交互处理器
 * 实现力箭头的 hover/选中/分解渲染
 */
const forceInteractionHandler: ViewportInteractionHandler = {
  hitTest(screenPoint): Selection | null {
    return getForceArrowAtPoint(screenPoint);
  },

  getCursor(): string {
    return 'pointer';
  },

  onHover(selection): void {
    if (selection && selection.type === 'force-arrow') {
      setHoveredForce(selection.id);
    } else {
      setHoveredForce(null);
    }
  },

  onSelectionChange(selection): void {
    if (!selection || selection.type !== 'force-arrow') {
      resetForceInteraction();
    }
  },

  renderOverlay(renderCtx: RenderContext): void {
    const { ctx } = renderCtx;
    const store = useSimulationStore.getState();
    const selection = store.selection;
    const interactionState = getForceInteractionState();
    const allArrows = getCachedForceArrows();

    // 更新分解动画进度
    if (interactionState.decompositionTarget) {
      updateDecompositionProgress(renderCtx.dt);
    }

    // ── hover 效果：加粗 + 发光 ──
    const hoveredKey = interactionState.hoveredForceKey;
    if (hoveredKey) {
      const arrow = allArrows.find((a) => `${a.entityId}/${a.forceIndex}` === hoveredKey);
      if (arrow) {
        const color = FORCE_COLORS[arrow.force.type] ?? '#666';
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 6;
        drawArrow(ctx, arrow.screenFrom, arrow.screenTo, {
          color,
          lineWidth: 4,
          arrowHeadSize: 10,
          dashed: false,
        });
        ctx.restore();
      }
    }

    // ── 选中效果：被选中力加粗 + 发光（其他力保持不变） ──
    if (selection?.type === 'force-arrow') {
      const selectedData = selection.data as { entityId: EntityId; forceIndex: number };
      const selectedKey = `${selectedData.entityId}/${selectedData.forceIndex}`;

      const selectedArrow = allArrows.find((a) => `${a.entityId}/${a.forceIndex}` === selectedKey);
      if (selectedArrow) {
        const color = FORCE_COLORS[selectedArrow.force.type] ?? '#666';
        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        drawArrow(ctx, selectedArrow.screenFrom, selectedArrow.screenTo, {
          color,
          lineWidth: 3.5,
          arrowHeadSize: 11,
          dashed: false,
        });
        ctx.restore();
      }
    }

    // ── 正交分解渲染 ──
    const decomp = interactionState.decompositionTarget;
    if (decomp && decomp.progress > 0) {
      renderDecomposition(renderCtx, decomp.entityId, decomp.forceIndex, decomp.progress);
    }
  },

  getFloatingUI() {
    const selection = useSimulationStore.getState().selection;
    if (!selection || selection.type !== 'force-arrow') return null;

    const { entityId, forceIndex } = selection.data as {
      entityId: EntityId;
      forceIndex: number;
    };
    const cachedArrows = getCachedForceArrows();
    const arrow = cachedArrows.find(
      (a) => a.entityId === entityId && a.forceIndex === forceIndex,
    );
    if (!arrow) return null;

    // 锚点 = 箭头中点，半尺寸 = 箭头包围盒的一半
    const midX = (arrow.screenFrom.x + arrow.screenTo.x) / 2;
    const midY = (arrow.screenFrom.y + arrow.screenTo.y) / 2;
    const halfW = Math.abs(arrow.screenTo.x - arrow.screenFrom.x) / 2;
    const halfH = Math.abs(arrow.screenTo.y - arrow.screenFrom.y) / 2;

    return {
      anchorScreenPos: { x: midX, y: midY },
      anchorHalfSize: { w: halfW, h: halfH },
      preferredDirection: directionToPreferred(arrow.force.direction.x, arrow.force.direction.y),
      componentType: 'force-popover',
      data: { entityId, forceIndex },
    };
  },
};

/**
 * 渲染正交分解（坐标轴参考线 + 分量箭头 + 引导虚线 + 直角标记 + 标签）
 */
function renderDecomposition(
  renderCtx: RenderContext,
  entityId: EntityId,
  forceIndex: number,
  progress: number,
): void {
  const { ctx, coordinateTransform } = renderCtx;
  const store = useSimulationStore.getState();
  const result = store.simulationState.currentResult;
  if (!result) return;

  const analysis = result.forceAnalyses.get(entityId);
  if (!analysis || !analysis.decomposition) return;

  const entity = store.simulationState.scene.entities.get(entityId);
  if (!entity) return;

  const force = analysis.forces[forceIndex];
  if (!force) return;

  const { axis1, axis2, components } = analysis.decomposition;

  // 找到这个力对应的分解分量
  const comp = components.find((c) => c.force.type === force.type && c.force.label === force.label);
  if (!comp) return;

  const easedProgress = easeOut(progress);

  // 物块中心
  const pos = entity.transform.position;
  const entityHeight = (entity.properties.height as number) ?? 0;
  const rotation = entity.transform.rotation ?? 0;
  const center = {
    x: pos.x + (-Math.sin(rotation)) * (entityHeight / 2),
    y: pos.y + Math.cos(rotation) * (entityHeight / 2),
  };
  const screenCenter = worldToScreen(center, coordinateTransform);

  // 1. 坐标轴参考线（淡入）
  const axisAlpha = 0.3 * easedProgress;
  const axisLen = 200; // px
  ctx.save();
  ctx.globalAlpha = axisAlpha;
  ctx.strokeStyle = '#CBD5E0';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  // axis1
  ctx.beginPath();
  ctx.moveTo(screenCenter.x - axis1.x * axisLen, screenCenter.y + axis1.y * axisLen);
  ctx.lineTo(screenCenter.x + axis1.x * axisLen, screenCenter.y - axis1.y * axisLen);
  ctx.stroke();
  // axis2
  ctx.beginPath();
  ctx.moveTo(screenCenter.x - axis2.x * axisLen, screenCenter.y + axis2.y * axisLen);
  ctx.lineTo(screenCenter.x + axis2.x * axisLen, screenCenter.y - axis2.y * axisLen);
  ctx.stroke();
  ctx.restore();

  // 2. 分量箭头（从物体边缘出发，跟其他独立力一样）
  const forceColor = FORCE_COLORS[force.type] ?? '#666';
  const forceArrowLen = forceToLength(force.magnitude);
  const scale = force.magnitude > 0 ? forceArrowLen / force.magnitude : 0;

  const dir1: Vec2 = {
    x: comp.component1 > 0 ? axis1.x : -axis1.x,
    y: comp.component1 > 0 ? axis1.y : -axis1.y,
  };
  const dir2: Vec2 = {
    x: comp.component2 > 0 ? axis2.x : -axis2.x,
    y: comp.component2 > 0 ? axis2.y : -axis2.y,
  };

  const fullMag1 = Math.abs(comp.component1) * scale;
  const fullMag2 = Math.abs(comp.component2) * scale;
  const mag1 = fullMag1 * easedProgress;
  const mag2 = fullMag2 * easedProgress;

  // 分量箭头各自从实体边缘出发，与共线的独立力/合力做垂直偏移避免重叠
  const DECOMP_PERP_OFFSET = 10;
  const rDir = analysis.resultant.direction;
  const rMag = analysis.resultant.magnitude;
  const allDirs = analysis.forces.map((f) => f.direction);
  if (rMag > 0.01) allDirs.push(rDir);

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
  const screen1To: Vec2 = {
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
  const screen2To: Vec2 = {
    x: screen2From.x + dir2.x * mag2,
    y: screen2From.y - dir2.y * mag2,
  };

  // 局部已占用区域（分量箭头）
  const occupied: PlacementBox[] = [
    segmentToBox(screen1From, screen1To, 1.8),
    segmentToBox(screen2From, screen2To, 1.8),
  ];

  ctx.save();
  ctx.globalAlpha = 0.7 * easedProgress;
  drawArrow(ctx, screen1From, screen1To, {
    color: forceColor,
    lineWidth: 1.8,
    arrowHeadSize: 7,
    dashed: true,
  });
  drawArrow(ctx, screen2From, screen2To, {
    color: forceColor,
    lineWidth: 1.8,
    arrowHeadSize: 7,
    dashed: true,
  });
  ctx.restore();

  // 3. 引导虚线（从原力终点向两条分量轴作垂线，保证严格垂直）
  // 原力终点
  const forceEdge = getEdgeStart(center, force.direction, entity);
  const screenForceFrom = worldToScreen(forceEdge, coordinateTransform);
  const forceTip: Vec2 = {
    x: screenForceFrom.x + force.direction.x * forceArrowLen,
    y: screenForceFrom.y - force.direction.y * forceArrowLen,
  };

  if (easedProgress > 0.3) {
    const guideAlpha = 0.35 * Math.min(1, (easedProgress - 0.3) / 0.3);

    // 从原力终点向分量方向投影 → 投影点（引导线严格垂直于分量方向）
    // 屏幕坐标中 dir1 的屏幕方向 = (dir1.x, -dir1.y)
    const sDir1 = { x: dir1.x, y: -dir1.y };
    const sDir2 = { x: dir2.x, y: -dir2.y };

    // 投影：从 forceTip 向分量1所在直线（过 screen1From）投影
    const dx1 = forceTip.x - screen1From.x;
    const dy1 = forceTip.y - screen1From.y;
    const dot1 = dx1 * sDir1.x + dy1 * sDir1.y;
    const proj1: Vec2 = {
      x: screen1From.x + sDir1.x * dot1,
      y: screen1From.y + sDir1.y * dot1,
    };

    // 投影：从 forceTip 向分量2所在直线（过 screen2From）投影
    const dx2 = forceTip.x - screen2From.x;
    const dy2 = forceTip.y - screen2From.y;
    const dot2 = dx2 * sDir2.x + dy2 * sDir2.y;
    const proj2: Vec2 = {
      x: screen2From.x + sDir2.x * dot2,
      y: screen2From.y + sDir2.y * dot2,
    };

    ctx.save();
    ctx.globalAlpha = guideAlpha;
    ctx.strokeStyle = forceColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    // 引导线：forceTip → 投影点1（垂直于分量1方向）
    ctx.beginPath();
    ctx.moveTo(forceTip.x, forceTip.y);
    ctx.lineTo(proj1.x, proj1.y);
    ctx.stroke();
    // 引导线：forceTip → 投影点2（垂直于分量2方向）
    ctx.beginPath();
    ctx.moveTo(forceTip.x, forceTip.y);
    ctx.lineTo(proj2.x, proj2.y);
    ctx.stroke();

    // 4. 直角标记（在原力终点处）
    if (easedProgress > 0.5) {
      const markAlpha = Math.min(1, (easedProgress - 0.5) / 0.3);
      ctx.globalAlpha = markAlpha * 0.6;
      ctx.strokeStyle = '#94A3B8';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      const markSize = 8;
      const d1g = { x: proj1.x - forceTip.x, y: proj1.y - forceTip.y };
      const d2g = { x: proj2.x - forceTip.x, y: proj2.y - forceTip.y };
      const len1g = Math.hypot(d1g.x, d1g.y);
      const len2g = Math.hypot(d2g.x, d2g.y);
      if (len1g > 0.1 && len2g > 0.1) {
        const u1 = { x: d1g.x / len1g * markSize, y: d1g.y / len1g * markSize };
        const u2 = { x: d2g.x / len2g * markSize, y: d2g.y / len2g * markSize };
        ctx.beginPath();
        ctx.moveTo(forceTip.x + u1.x, forceTip.y + u1.y);
        ctx.lineTo(forceTip.x + u1.x + u2.x, forceTip.y + u1.y + u2.y);
        ctx.lineTo(forceTip.x + u2.x, forceTip.y + u2.y);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  // 5. 分量标签（淡入，使用 PlacementContext 避让）
  if (easedProgress > 0.6) {
    const labelAlpha = Math.min(1, (easedProgress - 0.6) / 0.3);
    const label1 = comp.label1 ?? `F₁`;
    const label2 = comp.label2 ?? `F₂`;
    const label1Text = `${label1}=${Number(Math.abs(comp.component1).toFixed(1))}N`;
    const label2Text = `${label2}=${Number(Math.abs(comp.component2).toFixed(1))}N`;

    const fullScreen1To: Vec2 = {
      x: screen1From.x + dir1.x * fullMag1,
      y: screen1From.y - dir1.y * fullMag1,
    };
    const fullScreen2To: Vec2 = {
      x: screen2From.x + dir2.x * fullMag2,
      y: screen2From.y - dir2.y * fullMag2,
    };

    const fontSize = 11;
    const candidates1 = generateCandidates(screen1From, fullScreen1To, dir1);
    const candidates2 = generateCandidates(screen2From, fullScreen2To, dir2);

    const textW1 = measureText(label1Text, fontSize, ctx);
    const textW2 = measureText(label2Text, fontSize, ctx);

    const pcands1 = candidates1.map((c, idx) => {
      const box = labelBoxFromAlign(c.x, c.y, c.align, textW1, fontSize);
      return { left: box.left, top: box.top, preference: idx };
    });
    const pcands2 = candidates2.map((c, idx) => {
      const box = labelBoxFromAlign(c.x, c.y, c.align, textW2, fontSize);
      return { left: box.left, top: box.top, preference: idx };
    });

    const result1 = placeLabel(pcands1, textW1, fontSize, occupied);
    const result2 = placeLabel(pcands2, textW2, fontSize, occupied);

    ctx.save();
    ctx.globalAlpha = labelAlpha;
    drawTextLabel(ctx, label1Text, {
      x: result1.left + textW1 / 2,
      y: result1.top + fontSize / 2,
    }, { color: forceColor, fontSize, align: 'center' });
    drawTextLabel(ctx, label2Text, {
      x: result2.left + textW2 / 2,
      y: result2.top + fontSize / 2,
    }, { color: forceColor, fontSize, align: 'center' });
    ctx.restore();
  }
}

export function registerForceInteraction(): void {
  rendererRegistry.registerViewportInteraction('force', forceInteractionHandler);
}
