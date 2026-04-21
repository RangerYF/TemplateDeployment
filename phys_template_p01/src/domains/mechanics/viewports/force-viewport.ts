import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import type { Entity, EntityId, Force, Selection, Vec2 } from '@/core/types';
import { FORCE_COLORS } from '@/core/visual-constants';
import type { PlacementBox } from '@/renderer/placement';
import { segmentToBox, measureText, placeLabel } from '@/renderer/placement';

const MIN_LENGTH = 30;
const MAX_LENGTH = 180;
const EDGE_GAP = 0.02;
const LABEL_FONT_SIZE = 12;

// ─── 力箭头屏幕坐标缓存（每帧渲染时更新，供 hitTest 读取） ───

export interface CachedForceArrow {
  entityId: EntityId;
  forceIndex: number;
  screenFrom: Vec2;
  screenTo: Vec2;
  force: Force;
}

let cachedForceArrows: CachedForceArrow[] = [];

/** 查询某个屏幕坐标点是否命中力箭头 */
export function getForceArrowAtPoint(screenPoint: Vec2): Selection | null {
  const HIT_THRESHOLD = 8; // px

  for (const arrow of cachedForceArrows) {
    if (pointToSegmentDistance(screenPoint, arrow.screenFrom, arrow.screenTo) <= HIT_THRESHOLD) {
      return {
        type: 'force-arrow',
        id: `${arrow.entityId}/${arrow.forceIndex}`,
        data: {
          entityId: arrow.entityId,
          forceIndex: arrow.forceIndex,
          force: arrow.force,
        },
      };
    }
  }
  return null;
}

/** 获取力箭头终点屏幕坐标 */
export function getForceArrowTip(entityId: EntityId, forceIndex: number): Vec2 | null {
  const arrow = cachedForceArrows.find(
    (a) => a.entityId === entityId && a.forceIndex === forceIndex,
  );
  return arrow ? arrow.screenTo : null;
}

/** 获取缓存的所有力箭头 */
export function getCachedForceArrows(): readonly CachedForceArrow[] {
  return cachedForceArrows;
}

/** 点到线段距离 */
function pointToSegmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-6) return Math.hypot(p.x - a.x, p.y - a.y);

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = a.x + t * dx;
  const projY = a.y + t * dy;
  return Math.hypot(p.x - projX, p.y - projY);
}

// ─── 标签候选位置 ───

interface LabelCandidate {
  x: number;
  y: number;
  align: CanvasTextAlign;
}

/** 根据位置和对齐方式计算标签 AABB */
export function labelBoxFromAlign(x: number, y: number, align: CanvasTextAlign, textWidth: number, fontSize: number): PlacementBox {
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
export function generateCandidates(
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


// ─── 物理工具（导出供交互 handler 使用） ───

export function forceToLength(magnitude: number): number {
  if (magnitude <= 0) return 0;
  const len = MIN_LENGTH + (MAX_LENGTH - MIN_LENGTH) * Math.log(1 + magnitude) / Math.log(1 + 100);
  return Math.max(MIN_LENGTH, Math.min(MAX_LENGTH, len));
}

export function getEdgeStart(center: Vec2, direction: Vec2, entity: Entity): Vec2 {
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

// ─── 主渲染器 ───

const forceViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'force') return;

  const { analyses } = data.data;
  const { coordinateTransform } = ctx;

  // 每帧清空力箭头缓存
  const newCachedArrows: CachedForceArrow[] = [];

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
    // 记录已渲染力的方向，用于力-力共线检测
    const renderedDirs: Vec2[] = [];
    const COLLINEAR_OFFSET = 10; // 共线力垂直偏移 px

    // 计算关联连接件（绳/杆/弹簧）方向，用于统一防重叠
    const connectorDirs: Vec2[] = [];
    for (const e of entities.values()) {
      if (e.type !== 'rope' && e.type !== 'rod' && e.type !== 'spring') continue;
      const aId = (e.properties.entityAId as string) || (e.properties.pivotEntityId as string);
      const bId = (e.properties.entityBId as string) || (e.properties.blockEntityId as string);
      if (aId !== entity.id && bId !== entity.id) continue;
      const otherId = aId === entity.id ? bId : aId;
      const other = entities.get(otherId);
      if (!other) continue;
      const otherH = (other.properties.height as number) ?? 0;
      const otherRot = other.transform.rotation ?? 0;
      const otherCenter = {
        x: other.transform.position.x + (-Math.sin(otherRot)) * (otherH / 2),
        y: other.transform.position.y + Math.cos(otherRot) * (otherH / 2),
      };
      const dx = otherCenter.x - center.x;
      const dy = otherCenter.y - center.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-9) {
        connectorDirs.push({ x: dx / len, y: dy / len });
      }
    }
    let connSlot = 0; // 连接件共线偏移轨道计数

    for (let i = 0; i < analysis.forces.length; i++) {
      const force = analysis.forces[i]!;
      const arrowLen = forceToLength(force.magnitude);
      const edgeStart = getEdgeStart(center, force.direction, entity);
      let screenFrom = worldToScreen(edgeStart, coordinateTransform);
      let screenTo = {
        x: screenFrom.x + force.direction.x * arrowLen,
        y: screenFrom.y - force.direction.y * arrowLen,
      };

      // 独立力共线偏移：与已渲染的力方向共线（含反向）时，垂直偏移
      const dot = renderedDirs.reduce((found, d) => {
        const dp = Math.abs(d.x * force.direction.x + d.y * force.direction.y);
        return dp > found ? dp : found;
      }, 0);
      if (dot > 0.87) {
        const sdx = screenTo.x - screenFrom.x;
        const sdy = screenTo.y - screenFrom.y;
        const slen = Math.hypot(sdx, sdy);
        if (slen > 1) {
          const perpX = -sdy / slen * COLLINEAR_OFFSET;
          const perpY = sdx / slen * COLLINEAR_OFFSET;
          screenFrom = { x: screenFrom.x + perpX, y: screenFrom.y + perpY };
          screenTo = { x: screenTo.x + perpX, y: screenTo.y + perpY };
        }
      }
      renderedDirs.push(force.direction);

      // 统一连接件共线偏移：任何力与连接件（绳/杆/弹簧）共线时，
      // 分配递增轨道避免力之间重合
      if (connectorDirs.length > 0) {
        const connDot = connectorDirs.reduce((found, d) => {
          const dp = Math.abs(d.x * force.direction.x + d.y * force.direction.y);
          return dp > found ? dp : found;
        }, 0);
        if (connDot > 0.87) {
          connSlot++;
          const offset = connSlot * COLLINEAR_OFFSET;
          const sdx = screenTo.x - screenFrom.x;
          const sdy = screenTo.y - screenFrom.y;
          const slen = Math.hypot(sdx, sdy);
          if (slen > 1) {
            const perpX = -sdy / slen * offset;
            const perpY = sdx / slen * offset;
            screenFrom = { x: screenFrom.x + perpX, y: screenFrom.y + perpY };
            screenTo = { x: screenTo.x + perpX, y: screenTo.y + perpY };
          }
        }
      }

      // 缓存力箭头屏幕坐标
      newCachedArrows.push({
        entityId: analysis.entityId,
        forceIndex: i,
        screenFrom,
        screenTo,
        force,
      });

      const color = FORCE_COLORS[force.type] ?? '#666';
      const arrowIdx = arrows.length;
      arrows.push({ from: screenFrom, to: screenTo, color, lineWidth: 2.5, dashed: false });

      const labelText = `${force.label}=${Number(force.magnitude.toFixed(1))}N`;
      let labelCandidates = generateCandidates(screenFrom, screenTo, force.direction);

      // 张力/弹簧力标签额外偏移，确保在远离绳/杆/弹簧的一侧
      if (force.type === 'tension' || force.type === 'spring') {
        const sdx = screenTo.x - screenFrom.x;
        const sdy = screenTo.y - screenFrom.y;
        const slen = Math.hypot(sdx, sdy);
        if (slen > 1) {
          const LABEL_EXTRA = 6; // px
          const px = -sdy / slen * LABEL_EXTRA;
          const py = sdx / slen * LABEL_EXTRA;
          labelCandidates = labelCandidates.map((c) => ({
            ...c,
            x: c.x + px,
            y: c.y + py,
          }));
        }
      }

      labelItems.push({
        text: labelText,
        color,
        fontSize: LABEL_FONT_SIZE,
        candidates: labelCandidates,
        arrowIndex: arrowIdx,
      });
    }

    // 阶段3：分解渲染已移至 force-interaction-handler.renderOverlay()

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
      const arrowLen = forceToLength(rMag);

      const PERP_OFFSET = 14;
      const nearCollinearForce = analysis.forces.some((f) => isNearlyCollinear(f.direction, rDir));
      const nearCollinearConn = connectorDirs.some((d) => Math.abs(d.x * rDir.x + d.y * rDir.y) > 0.87);
      const nearCollinear = nearCollinearForce || nearCollinearConn;
      // 合力偏移到负方向轨道（与独立力的正方向轨道分开）
      const perpX = nearCollinear ? -rDir.y * PERP_OFFSET : 0;
      const perpY = nearCollinear ? -rDir.x * PERP_OFFSET : 0;

      const resultantEdge = getEdgeStart(center, rDir, entity);
      const screenFrom = worldToScreen(resultantEdge, coordinateTransform);
      const offsetFrom = { x: screenFrom.x + perpX, y: screenFrom.y + perpY };
      const offsetTo = {
        x: offsetFrom.x + rDir.x * arrowLen,
        y: offsetFrom.y - rDir.y * arrowLen,
      };

      const rArrowIdx = arrows.length;
      arrows.push({ from: offsetFrom, to: offsetTo, color: resultantColor, lineWidth: 2, dashed: true });

      const labelText = `${analysis.resultant.label}=${Number(rMag.toFixed(1))}N`;
      labelItems.push({
        text: labelText,
        color: resultantColor,
        fontSize: LABEL_FONT_SIZE,
        candidates: generateCandidates(offsetFrom, offsetTo, rDir),
        arrowIndex: rArrowIdx,
      });
    }
    // 合力为零时不在画布上显示标签（InfoPanel 已显示"合力为零，受力平衡"）

    // ── 标签布局（局部防重叠，不依赖全局障碍物池） ──
    const occupied: PlacementBox[] = [];
    // 先把箭头注册为已占用区域
    for (const arrow of arrows) {
      occupied.push(segmentToBox(arrow.from, arrow.to, arrow.lineWidth));
    }

    for (const item of labelItems) {
      const textW = measureText(item.text, item.fontSize, ctx.ctx);
      const textH = item.fontSize;
      const placementCands = item.candidates.map((c, idx) => {
        const box = labelBoxFromAlign(c.x, c.y, c.align, textW, textH);
        return { left: box.left, top: box.top, preference: idx };
      });
      const result = placeLabel(placementCands, textW, textH, occupied);
      drawTextLabel(ctx.ctx, item.text, {
        x: result.left + textW / 2,
        y: result.top + textH / 2,
      }, {
        color: item.color,
        fontSize: item.fontSize,
        align: 'center',
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

  // 更新全局缓存
  cachedForceArrows = newCachedArrows;
};

export function registerForceViewport(): void {
  rendererRegistry.registerViewport('force', forceViewportRenderer);
}
