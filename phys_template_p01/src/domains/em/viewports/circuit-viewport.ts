import { rendererRegistry } from '@/core/registries/renderer-registry';
import { worldToScreen, worldLengthToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import type { ViewportRenderer } from '@/core/registries/renderer-registry';
import type { Entity, CoordinateTransform, Relation } from '@/core/types';
import { FORCE_COLORS } from '@/core/visual-constants';
import { drawRealisticEntity, hasRealisticRenderer } from '../renderers/realistic-renderers';

/** 标注统一颜色 */
const EMF_COLOR = '#1A1A2E';
const CURRENT_COLOR = '#1A1A2E';
const FLUX_COLOR = '#1A1A2E';
const CIRCLE_COMPONENT_TYPES = new Set(['ammeter', 'voltmeter', 'galvanometer', 'bulb', 'motor']);

interface CircuitComponentBounds {
  entity: Entity;
  type: string;
  label: string;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

interface CircuitDisplayComponent {
  entityId: string;
  type: string;
  label: string;
  screenX: number;
  screenY: number;
  screenW: number;
  screenH: number;
}

type CircuitPortSide = 'top' | 'bottom' | 'left' | 'right';

function collectCircuitComponentBounds(
  entities: Map<string, Entity>,
  coordinateTransform: CoordinateTransform,
): CircuitComponentBounds[] {
  const components: CircuitComponentBounds[] = [];

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const width = (entity.properties.width as number) ?? (entity.properties.radius as number) ?? 0.5;
    const height = (entity.properties.height as number) ?? width;
    const cx = CIRCLE_COMPONENT_TYPES.has(entity.type) ? pos.x : pos.x + width / 2;
    const cy = CIRCLE_COMPONENT_TYPES.has(entity.type) ? pos.y : pos.y + height / 2;
    const screenCenter = worldToScreen({ x: cx, y: cy }, coordinateTransform);
    components.push({
      entity,
      type: entity.type,
      label: entity.label ?? '',
      cx: screenCenter.x,
      cy: screenCenter.y,
      hw: worldLengthToScreen(width, coordinateTransform) / 2,
      hh: worldLengthToScreen(height, coordinateTransform) / 2,
    });
  }

  return components;
}

type CircuitFlowDirection = -1 | 0 | 1;

function getCircuitFlowDirection(current: number | undefined): CircuitFlowDirection {
  if (current === undefined || !Number.isFinite(current) || Math.abs(current) <= 1e-6) {
    return 0;
  }
  return current < 0 ? -1 : 1;
}

function drawDirectedCircuitArrow(
  c: CanvasRenderingContext2D,
  from: { x: number; y: number },
  to: { x: number; y: number },
  options: { color: string; lineWidth: number; arrowHeadSize: number },
  direction: CircuitFlowDirection,
): void {
  if (direction === 0) return;
  drawArrow(c, direction > 0 ? from : to, direction > 0 ? to : from, options);
}

function invertCircuitFlowDirection(direction: CircuitFlowDirection): CircuitFlowDirection {
  return direction === 1 ? -1 : direction === -1 ? 1 : 0;
}

function getStoredCircuitRelationDirection(
  relation: Relation | undefined,
): CircuitFlowDirection | null {
  if (!relation) return null;

  const magnitude = relation.properties.currentMagnitude as number | undefined;
  if (typeof magnitude === 'number' && (!Number.isFinite(magnitude) || Math.abs(magnitude) <= 1e-6)) {
    return 0;
  }

  const direction = relation.properties.currentDirection as number | undefined;
  if (direction === 1 || direction === -1 || direction === 0) {
    return direction;
  }

  return null;
}

function findCircuitConnectionRelation(
  relations: Relation[] | undefined,
  entityAId: string,
  entityBId: string,
): Relation | undefined {
  if (!relations) return undefined;

  const candidates = relations.filter((relation) => (
    relation.type === 'connection' &&
    (
      (relation.sourceEntityId === entityAId && relation.targetEntityId === entityBId) ||
      (relation.sourceEntityId === entityBId && relation.targetEntityId === entityAId)
    )
  ));

  if (candidates.length === 0) return undefined;

  return candidates.find((relation) => getStoredCircuitRelationDirection(relation) !== null) ?? candidates[0];
}

function resolveCircuitRelationPathDirection(
  relation: Relation | undefined,
  pathStartEntityId: string,
  pathEndEntityId: string,
): CircuitFlowDirection | null {
  const storedDirection = getStoredCircuitRelationDirection(relation);
  if (storedDirection === null) return null;
  if (storedDirection === 0) return 0;

  if (relation?.sourceEntityId === pathStartEntityId && relation.targetEntityId === pathEndEntityId) {
    return storedDirection;
  }
  if (relation?.sourceEntityId === pathEndEntityId && relation.targetEntityId === pathStartEntityId) {
    return invertCircuitFlowDirection(storedDirection);
  }

  return null;
}

function resolveCircuitArrowDirectionFromRelation(options: {
  relations: Relation[] | undefined;
  pathStartEntityId: string;
  pathEndEntityId: string;
  fallbackDirection: CircuitFlowDirection;
  reverseArrowBase?: boolean;
}): CircuitFlowDirection {
  const relation = findCircuitConnectionRelation(
    options.relations,
    options.pathStartEntityId,
    options.pathEndEntityId,
  );
  const relationDirection = resolveCircuitRelationPathDirection(
    relation,
    options.pathStartEntityId,
    options.pathEndEntityId,
  );

  if (relationDirection === null) return options.fallbackDirection;
  return options.reverseArrowBase ? invertCircuitFlowDirection(relationDirection) : relationDirection;
}

function getCircuitSourcePolarityOrientation(source: Entity): 'horizontal' | 'vertical' {
  const circuitType = source.properties.circuitType as string | undefined;
  return circuitType === 'ohmmeter' || circuitType === 'multi-range-ohmmeter'
    ? 'vertical'
    : 'horizontal';
}

function getCircuitSourcePortScore(
  side: CircuitPortSide | undefined,
  polarity: 'positive' | 'negative',
  orientation: 'horizontal' | 'vertical',
): number {
  if (!side) return 0;

  if (orientation === 'vertical') {
    const positiveScores: Record<CircuitPortSide, number> = {
      top: 4,
      right: 2,
      left: 2,
      bottom: 1,
    };
    const negativeScores: Record<CircuitPortSide, number> = {
      bottom: 4,
      left: 2,
      right: 2,
      top: 1,
    };
    return polarity === 'positive' ? positiveScores[side] : negativeScores[side];
  }

  const positiveScores: Record<CircuitPortSide, number> = {
    right: 4,
    top: 2,
    bottom: 2,
    left: 1,
  };
  const negativeScores: Record<CircuitPortSide, number> = {
    left: 4,
    bottom: 2,
    top: 2,
    right: 1,
  };
  return polarity === 'positive' ? positiveScores[side] : negativeScores[side];
}

function getCircuitRelationPortSide(
  relation: Relation,
  entityId: string,
): CircuitPortSide | undefined {
  if (relation.sourceEntityId === entityId) {
    return relation.properties.sourcePort as CircuitPortSide | undefined;
  }
  if (relation.targetEntityId === entityId) {
    return relation.properties.targetPort as CircuitPortSide | undefined;
  }
  return undefined;
}

function getCircuitNeighborOrientationBias(
  sourceComp: CircuitDisplayComponent,
  neighborComp: CircuitDisplayComponent,
  orientation: 'horizontal' | 'vertical',
): { positive: number; negative: number } {
  if (orientation === 'horizontal') {
    const deltaX = neighborComp.screenX - sourceComp.screenX;
    if (Math.abs(deltaX) <= 1) return { positive: 0, negative: 0 };
    return deltaX > 0
      ? { positive: 3, negative: 0 }
      : { positive: 0, negative: 3 };
  }

  const deltaY = neighborComp.screenY - sourceComp.screenY;
  if (Math.abs(deltaY) <= 1) return { positive: 0, negative: 0 };
  return deltaY < 0
    ? { positive: 3, negative: 0 }
    : { positive: 0, negative: 3 };
}

function resolveGenericTopFlowBaseDirection(
  source: Entity | undefined,
  components: CircuitDisplayComponent[],
  relations: Relation[] | undefined,
): CircuitFlowDirection {
  if (!source || !relations || relations.length === 0) return 1;

  const componentById = new Map(components.map((component) => [component.entityId, component] as const));
  const sourceComp = componentById.get(source.id);
  if (!sourceComp) return 1;

  const orientation = getCircuitSourcePolarityOrientation(source);
  const rankings = relations
    .filter((relation) =>
      relation.type === 'connection' &&
      (relation.sourceEntityId === source.id || relation.targetEntityId === source.id),
    )
    .map((relation) => {
      const neighborId =
        relation.sourceEntityId === source.id
          ? relation.targetEntityId
          : relation.sourceEntityId;
      const neighborComp = componentById.get(neighborId);
      if (!neighborComp || neighborComp.type === 'voltmeter') return null;

      const side = getCircuitRelationPortSide(relation, source.id);
      const bias = getCircuitNeighborOrientationBias(sourceComp, neighborComp, orientation);
      return {
        neighborComp,
        positiveScore: getCircuitSourcePortScore(side, 'positive', orientation) + bias.positive,
        negativeScore: getCircuitSourcePortScore(side, 'negative', orientation) + bias.negative,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null);

  if (rankings.length === 0) return 1;

  rankings.sort((left, right) => (
    right.positiveScore - left.positiveScore ||
    left.negativeScore - right.negativeScore
  ));

  const positiveNeighbor = rankings[0]!.neighborComp;
  if (positiveNeighbor.screenX > sourceComp.screenX + 1) return 1;
  if (positiveNeighbor.screenX < sourceComp.screenX - 1) return -1;

  const negativeNeighbor = [...rankings]
    .sort((left, right) => (
      right.negativeScore - left.negativeScore ||
      left.positiveScore - right.positiveScore
    ))[0]?.neighborComp;
  if (negativeNeighbor) {
    if (negativeNeighbor.screenX > sourceComp.screenX + 1) return -1;
    if (negativeNeighbor.screenX < sourceComp.screenX - 1) return 1;
  }

  return orientation === 'horizontal' ? 1 : -1;
}

/**
 * 电路视角渲染器（circuit viewport）
 *
 * 双模式：
 * 1. 电磁感应场景（wire-frame）：标注 ε/I/Φ + 安培力箭头
 * 2. 电路实验场景（dc-source）：导线 + 电流箭头 + 标注 + 公式 + 步骤 + 误差分析
 */
const circuitViewportRenderer: ViewportRenderer = (data, entities, ctx) => {
  if (data.type !== 'circuit') return;

  // 检测是否为电路实验场景（含 dc-source）
  let hasCircuitScene = false;
  for (const entity of entities.values()) {
    if (entity.type === 'dc-source') {
      hasCircuitScene = true;
      break;
    }
  }

  if (hasCircuitScene) {
    // 判断是否为 builder 模式：general-circuit 求解器写入 circuitType='general-circuit'
    // 预设场景的求解器写入 'voltammetry-internal'、'measure-emf-r' 等专用类型
    let circuitType: string | undefined;
    for (const entity of entities.values()) {
      if (entity.type === 'dc-source') {
        circuitType = entity.properties.circuitType as string | undefined;
        break;
      }
    }

    const isBuilder = circuitType === 'general-circuit' || circuitType === undefined;

    if (isBuilder) {
      // builder 模式：只渲染实物图叠加，导线由 BuilderCanvas 的 renderWires 处理
      renderRealisticOverlay(entities, ctx);
    } else {
      // 预设场景：完整渲染（导线+标注+实物图）
      renderCircuitExperiment(entities, ctx);
    }
    return;
  }

  // ── 电磁感应场景 ──
  renderWireFrameScene(entities, ctx);
};

/**
 * 电磁感应场景渲染（wire-frame）
 */
function renderWireFrameScene(
  entities: Map<string, Entity>,
  ctx: import('@/core/types').RenderContext,
): void {
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;

  for (const entity of entities.values()) {
    if (entity.type !== 'wire-frame') continue;

    const pos = entity.transform.position;
    const width = (entity.properties.width as number) ?? 1;
    const height = (entity.properties.height as number) ?? 0.8;
    const emf = (entity.properties.emf as number) ?? 0;
    const current = (entity.properties.current as number) ?? 0;
    const flux = (entity.properties.flux as number) ?? 0;

    const centerScreen = worldToScreen(
      { x: pos.x + width / 2, y: pos.y + height / 2 },
      coordinateTransform,
    );
    const topScreen = worldToScreen(
      { x: pos.x + width / 2, y: pos.y + height },
      coordinateTransform,
    );
    const screenW = worldLengthToScreen(width, coordinateTransform);

    drawWireFrameMetricCard(c, {
      centerScreen,
      topScreen,
      screenW,
      emf,
      current,
      flux,
    });

    // 安培力箭头
    if (Math.abs(current) > 1e-6) {
      const velocity = entity.properties.initialVelocity as { x: number; y: number } | undefined;
      if (velocity) {
        const speed = Math.hypot(velocity.x, velocity.y);
        if (speed > 1e-6) {
          const forceDir = { x: -velocity.x / speed, y: -velocity.y / speed };
          const arrowLen = Math.min(60, Math.abs(current) * 80 + 20);
          const screenFrom = {
            x: centerScreen.x + forceDir.x * (screenW / 2 + 5),
            y: centerScreen.y - forceDir.y * (screenW / 2 + 5),
          };
          const screenTo = {
            x: screenFrom.x + forceDir.x * arrowLen,
            y: screenFrom.y - forceDir.y * arrowLen,
          };
          drawArrow(c, screenFrom, screenTo, { color: FORCE_COLORS.ampere, lineWidth: 2.5, arrowHeadSize: 10 });
          drawTextLabel(c, 'F安', { x: screenTo.x + forceDir.x * 10, y: screenTo.y - forceDir.y * 10 }, {
            color: FORCE_COLORS.ampere, fontSize: 11, align: 'center',
          });
        }
      }
    }
  }
}

function drawWireFrameMetricCard(
  c: CanvasRenderingContext2D,
  params: {
    centerScreen: { x: number; y: number };
    topScreen: { x: number; y: number };
    screenW: number;
    emf: number;
    current: number;
    flux: number;
  },
): void {
  const rows = [
    {
      label: '感应电动势 ε',
      value: `${formatWireFrameMetric(params.emf, 3)} V`,
      color: EMF_COLOR,
    },
    {
      label: '电流 I',
      value: `${formatWireFrameMetric(params.current, 3)} A`,
      color: CURRENT_COLOR,
    },
    {
      label: '电流方向',
      value: getWireFrameCurrentDirectionLabel(params.current),
      color: CURRENT_COLOR,
    },
    {
      label: '磁通量 Φ',
      value: `${formatWireFrameMetric(params.flux, 4) } Wb`,
      color: FLUX_COLOR,
    },
  ];
  const cardWidth = 196;
  const headerHeight = 28;
  const rowHeight = 24;
  const cardHeight = headerHeight + rows.length * rowHeight;
  const canvasPadding = 12;
  const rightCandidate = params.centerScreen.x + params.screenW / 2 + 18;
  const leftCandidate = params.centerScreen.x - params.screenW / 2 - 18 - cardWidth;
  let cardX = rightCandidate;

  if (rightCandidate + cardWidth > c.canvas.width - canvasPadding && leftCandidate >= canvasPadding) {
    cardX = leftCandidate;
  } else if (rightCandidate + cardWidth > c.canvas.width - canvasPadding) {
    cardX = Math.max(
      canvasPadding,
      Math.min(params.centerScreen.x - cardWidth / 2, c.canvas.width - cardWidth - canvasPadding),
    );
  }

  const preferredY = params.topScreen.y - 12;
  const cardY = Math.max(
    canvasPadding,
    Math.min(preferredY, c.canvas.height - cardHeight - canvasPadding),
  );

  c.save();
  c.beginPath();
  c.roundRect(cardX, cardY, cardWidth, cardHeight, 10);
  c.fillStyle = 'rgba(255,255,255,0.94)';
  c.fill();
  c.strokeStyle = 'rgba(15,23,42,0.12)';
  c.lineWidth = 1;
  c.stroke();

  c.fillStyle = '#475569';
  c.font = "600 12px 'Inter', sans-serif";
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.fillText('感应数据', cardX + 12, cardY + headerHeight / 2);

  c.strokeStyle = 'rgba(15,23,42,0.08)';
  for (let index = 0; index < rows.length; index += 1) {
    const rowTop = cardY + headerHeight + index * rowHeight;
    if (index > 0) {
      c.beginPath();
      c.moveTo(cardX + 10, rowTop);
      c.lineTo(cardX + cardWidth - 10, rowTop);
      c.stroke();
    }

    const rowCenterY = rowTop + rowHeight / 2;
    const row = rows[index]!;
    c.fillStyle = '#64748B';
    c.font = "500 11px 'Inter', sans-serif";
    c.textAlign = 'left';
    c.fillText(row.label, cardX + 12, rowCenterY);

    c.fillStyle = row.color;
    c.font = "600 11px 'Inter', sans-serif";
    c.textAlign = 'right';
    c.fillText(row.value, cardX + cardWidth - 12, rowCenterY);
  }

  c.restore();
}

function formatWireFrameMetric(value: number, digits: number): string {
  if (!Number.isFinite(value) || Math.abs(value) <= 10 ** (-digits)) {
    return '0';
  }
  return value.toFixed(digits);
}

function getWireFrameCurrentDirectionLabel(current: number): string {
  if (!Number.isFinite(current) || Math.abs(current) <= 1e-6) {
    return '无感应电流';
  }
  return current > 0 ? '逆时针' : '顺时针';
}

/**
 * 电路实验场景的视角渲染
 *
 * 绘制内容：
 * 1. 元件间导线（通电时绿色 + 电流方向箭头）
 * 2. 电源参数标注（端电压、总电流）
 * 3. 测量结果标注（R_测、误差、误差原因）
 * 4. 接法对比表（voltammetry-compare 场景）
 * 5. 步骤引导卡片（半偏法/欧姆表/电桥）
 * 6. 公式推导区（所有电路实验）
 */
/**
 * builder 模式下的实物图叠加渲染（仅替换元件符号为实物图，不画导线和标注）
 */
function renderRealisticOverlay(
  entities: Map<string, Entity>,
  ctx: import('@/core/types').RenderContext,
): void {
  const isRealistic = ctx.viewport.density === 'detailed';
  if (!isRealistic) return;

  const { coordinateTransform } = ctx;
  const c = ctx.ctx;

  for (const entity of entities.values()) {
    if (!hasRealisticRenderer(entity.type)) continue;

    const pos = entity.transform.position;
    const radius = entity.properties.radius as number | undefined;
    const w = (entity.properties.width as number) ?? (radius ?? 0.5);
    const h = (entity.properties.height as number) ?? w;

    if (radius != null) {
      const centerScr = worldToScreen(pos, coordinateTransform);
      const screenR = worldLengthToScreen(radius, coordinateTransform);
      c.fillStyle = '#FAFAFA';
      c.fillRect(centerScr.x - screenR - 10, centerScr.y - screenR - 10, screenR * 2 + 20, screenR * 2 + 40);
    } else {
      const topLeft = worldToScreen({ x: pos.x - 0.05, y: pos.y + h + 0.05 }, coordinateTransform);
      const sw = worldLengthToScreen(w + 0.1, coordinateTransform);
      const sh = worldLengthToScreen(h + 0.1, coordinateTransform);
      c.fillStyle = '#FAFAFA';
      c.fillRect(topLeft.x, topLeft.y, sw, sh + 30);
    }

    drawRealisticEntity(c, entity, coordinateTransform);
  }
}

function renderCircuitExperiment(
  entities: Map<string, Entity>,
  ctx: import('@/core/types').RenderContext,
): void {
  const { coordinateTransform } = ctx;
  const c = ctx.ctx;

  // 查找电源实体
  let source: Entity | undefined;
  for (const entity of entities.values()) {
    if (entity.type === 'dc-source') { source = entity; break; }
  }

  const totalCurrent = source ? (source.properties.totalCurrent as number | undefined) : undefined;
  const currentDirection = getCircuitFlowDirection(totalCurrent);
  const hasCurrent = currentDirection !== 0;

  // 检测实物图模式（通过场景 paramValues 中的 viewMode 控制）
  const isRealistic = ctx.viewport.density === 'detailed'; // 暂用 density='detailed' 作为实物图触发条件

  // ── 0. 实物图叠加渲染 ──
  if (isRealistic) {
    for (const entity of entities.values()) {
      if (!hasRealisticRenderer(entity.type)) continue;

      // 覆盖标准符号：用白色不透明矩形盖住
      const pos = entity.transform.position;
      const radius = entity.properties.radius as number | undefined;
      const w = (entity.properties.width as number) ?? (radius ?? 0.5);
      const h = (entity.properties.height as number) ?? w;

      let coverX: number, coverY: number;
      if (radius != null) {
        const centerScr = worldToScreen(pos, coordinateTransform);
        const screenR = worldLengthToScreen(radius, coordinateTransform);
        coverX = centerScr.x - screenR - 10;
        coverY = centerScr.y - screenR - 10;
        c.fillStyle = '#FAFAFA';
        c.fillRect(coverX, coverY, screenR * 2 + 20, screenR * 2 + 40);
      } else {
        const topLeft = worldToScreen({ x: pos.x - 0.05, y: pos.y + h + 0.05 }, coordinateTransform);
        const sw = worldLengthToScreen(w + 0.1, coordinateTransform);
        const sh = worldLengthToScreen(h + 0.1, coordinateTransform);
        c.fillStyle = '#FAFAFA';
        c.fillRect(topLeft.x, topLeft.y, sw, sh + 30);
      }

      // 绘制实物图
      drawRealisticEntity(c, entity, coordinateTransform);
    }
  }

  // ── 专用电路渲染 ──
  const circuitT = source?.properties.circuitType as string | undefined;
  const effectiveVoltammetryCircuitT =
    circuitT === 'voltammetry-compare'
      ? (source?.properties.currentMethod === 'external'
          ? 'voltammetry-external'
          : 'voltammetry-internal')
      : circuitT;
  const voltmeterBranchDirection =
    effectiveVoltammetryCircuitT === 'voltammetry-internal' || effectiveVoltammetryCircuitT === 'voltammetry-external'
      ? getCircuitFlowDirection(source?.properties.voltmeterBranchCurrent as number | undefined)
      : 0;
  if (circuitT === 'wheatstone-bridge') {
    renderWheatstoneWires(entities, c, coordinateTransform, currentDirection);
    if (source) renderSourceAnnotations(c, source, coordinateTransform);
    return;
  }
  if (circuitT === 'ohmmeter') {
    renderOhmmeterWires(entities, c, coordinateTransform, currentDirection);
    if (source) renderSourceAnnotations(c, source, coordinateTransform);
    return;
  }
  if (circuitT === 'half-deflection-ammeter') {
    renderHalfDeflectionAmmeterWires(entities, c, coordinateTransform, currentDirection);
    if (source) renderSourceAnnotations(c, source, coordinateTransform);
    return;
  }
  if (circuitT === 'half-deflection-voltmeter') {
    renderHalfDeflectionVoltmeterWires(entities, c, coordinateTransform, currentDirection);
    if (source) renderSourceAnnotations(c, source, coordinateTransform);
    return;
  }
  if (circuitT === 'multi-range-ohmmeter') {
    renderMultiRangeOhmmeterWires(entities, c, coordinateTransform, currentDirection);
    if (source) renderSourceAnnotations(c, source, coordinateTransform);
    return;
  }
  if (circuitT === 'measure-emf-r') {
    renderMeasureEmfRWires(entities, c, coordinateTransform, currentDirection);
    if (source) renderSourceAnnotations(c, source, coordinateTransform);
    return;
  }

  // ── 1. 矩形回路导线 ──
  // 收集主路元件、电压表、并联支路元件
  type CompInfo = CircuitDisplayComponent;
  const mainComponents: CompInfo[] = [];
  const voltmeterComps: CompInfo[] = [];
  const parallelBranchComps: CompInfo[] = [];

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const w = (entity.properties.width as number) ?? (entity.properties.radius as number) ?? 0.5;
    const h = (entity.properties.height as number) ?? w;
    let centerX: number, centerY: number;
    if (entity.type === 'ammeter' || entity.type === 'voltmeter' || entity.type === 'galvanometer' || entity.type === 'bulb' || entity.type === 'motor') {
      centerX = pos.x; centerY = pos.y;
    } else {
      centerX = pos.x + w / 2; centerY = pos.y + h / 2;
    }
    const screenCenter = worldToScreen({ x: centerX, y: centerY }, coordinateTransform);
    const screenW = worldLengthToScreen(w, coordinateTransform);
    const screenH = worldLengthToScreen(h, coordinateTransform);
    const label = entity.label ?? '';
    const info: CompInfo = {
      entityId: entity.id,
      type: entity.type,
      label,
      screenX: screenCenter.x,
      screenY: screenCenter.y,
      screenW,
      screenH,
    };

    if (entity.type === 'voltmeter') {
      voltmeterComps.push(info);
    } else {
      mainComponents.push(info);
    }
  }

  // 半偏法：从主路中分离并联支路（重复类型中，Y 位置偏上的为并联支路元件）
  if (circuitT === 'half-deflection') {
    // 统计每种类型的出现次数
    const typeCounts = new Map<string, number>();
    for (const comp of mainComponents) {
      typeCounts.set(comp.type, (typeCounts.get(comp.type) ?? 0) + 1);
    }
    // 对于出现 2 次的类型（switch、resistance-box），screenY 较小的（屏幕上方）为并联支路
    const duplicateTypes = new Set<string>();
    for (const [type, count] of typeCounts) {
      if (count >= 2) duplicateTypes.add(type);
    }
    if (duplicateTypes.size > 0) {
      const remaining: CompInfo[] = [];
      for (const type of duplicateTypes) {
        const group = mainComponents.filter((c) => c.type === type);
        group.sort((a, b) => a.screenY - b.screenY); // screenY 小 = 屏幕上方
        parallelBranchComps.push(group[0]!); // 上方的进并联支路
        for (let i = 1; i < group.length; i++) remaining.push(group[i]!); // 下方的留主路
      }
      // 加上非重复类型的元件
      for (const comp of mainComponents) {
        if (!duplicateTypes.has(comp.type)) remaining.push(comp);
      }
      mainComponents.length = 0;
      mainComponents.push(...remaining);
    }
  }

  const sorted = mainComponents.sort((a, b) => a.screenX - b.screenX);
  const topFlowDirection = resolveGenericTopFlowBaseDirection(source, sorted, ctx.relations);
  const bottomFlowDirection = topFlowDirection === 1 ? -1 : 1;
  const rightVerticalDirection = topFlowDirection;
  const leftVerticalDirection = topFlowDirection === 1 ? -1 : 1;
  const topCurrentDirection =
    effectiveVoltammetryCircuitT === 'voltammetry-internal'
      ? getCircuitFlowDirection(
          (Array.from(entities.values()).find((entity) => entity.type === 'ammeter' || entity.type === 'galvanometer')
            ?.properties.reading as number | undefined),
        )
      : currentDirection;
  const resistorBranchDirection =
    effectiveVoltammetryCircuitT === 'voltammetry-internal' || effectiveVoltammetryCircuitT === 'voltammetry-external'
      ? getCircuitFlowDirection(
          (Array.from(entities.values()).find((entity) => entity.type === 'fixed-resistor' || entity.type === 'resistance-box')
            ?.properties.current as number | undefined),
        )
      : 0;
  const voltmeterBranchArrowDirection =
    effectiveVoltammetryCircuitT === 'voltammetry-internal'
      ? (topCurrentDirection === 0 ? voltmeterBranchDirection : 0)
      : effectiveVoltammetryCircuitT === 'voltammetry-external'
        ? (resistorBranchDirection === 0 ? voltmeterBranchDirection : 0)
        : 0;
  const sourceComp = source
    ? sorted.find((component) => component.entityId === source.id)
    : undefined;

  if (sorted.length >= 2) {
    c.save();
    const wireColor = '#1A1A2E';
    c.strokeStyle = wireColor;
    c.lineWidth = hasCurrent ? 2 : 1.5;
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (!hasCurrent) c.setLineDash([6, 3]);

    // 计算统一的上轨道 Y（所有元件中心行）和下轨道 Y（底部回路）
    const maxBottom = sorted.reduce((max, comp) => Math.max(max, comp.screenY + comp.screenH / 2), 0);
    const bottomY = maxBottom + 50;

    // 左右边界（留出余量不穿过元件，含并联支路）
    const leftX = sorted[0]!.screenX - sorted[0]!.screenW / 2 - 15;
    let rightX = sorted[sorted.length - 1]!.screenX + sorted[sorted.length - 1]!.screenW / 2 + 15;
    // 半偏法：右边界需覆盖并联支路元件
    if (parallelBranchComps.length > 0) {
      for (const bc of parallelBranchComps) {
        rightX = Math.max(rightX, bc.screenX + bc.screenW / 2 + 25);
      }
    }

    // 半偏法时，找到 ammeter(G) 在主路中的索引，用于调整连线
    const galvIdxInSorted = circuitT === 'half-deflection'
      ? sorted.findIndex((s) => s.type === 'ammeter')
      : -1;

    // 上半回路：元件之间水平连线
    for (let i = 0; i < sorted.length - 1; i++) {
      const from = sorted[i]!;
      const to = sorted[i + 1]!;

      // 半偏法：跳过 G 相关的连线段（由并联支路逻辑处理）
      if (galvIdxInSorted >= 0 && (to.type === 'ammeter' || from.type === 'ammeter')) {
        continue;
      }

      const x1 = from.screenX + from.screenW / 2 + 2;
      const x2 = to.screenX - to.screenW / 2 - 2;

      c.beginPath();
      if (Math.abs(from.screenY - to.screenY) > 3) {
        const midX = (x1 + x2) / 2;
        c.moveTo(x1, from.screenY);
        c.lineTo(midX, from.screenY);
        c.lineTo(midX, to.screenY);
        c.lineTo(x2, to.screenY);
      } else {
        c.moveTo(x1, from.screenY);
        c.lineTo(x2, to.screenY);
      }
      c.stroke();
    }

    // 右侧竖线：最右主路元件 → 底部（半偏法时由并联支路逻辑处理）
    if (galvIdxInSorted < 0) {
      const lastComp = sorted[sorted.length - 1]!;
      c.beginPath();
      c.moveTo(lastComp.screenX + lastComp.screenW / 2 + 2, lastComp.screenY);
      c.lineTo(rightX, lastComp.screenY);
      c.lineTo(rightX, bottomY);
      c.stroke();
    }

    // 底部水平线
    c.beginPath();
    c.moveTo(rightX, bottomY);
    c.lineTo(leftX, bottomY);
    c.stroke();

    // 左侧竖线：底部 → 最左元件
    const firstComp = sorted[0]!;
    c.beginPath();
    c.moveTo(leftX, bottomY);
    c.lineTo(leftX, firstComp.screenY);
    c.lineTo(firstComp.screenX - firstComp.screenW / 2 - 2, firstComp.screenY);
    c.stroke();

    c.setLineDash([]);

    // 电流方向箭头（上方→右，底部→左）
    if (hasCurrent) {
      const lastComp = sorted[sorted.length - 1]!;
      const returnPathDirection =
        sourceComp && sourceComp === sorted[0]
          ? resolveCircuitArrowDirectionFromRelation({
              relations: ctx.relations,
              pathStartEntityId: lastComp.entityId,
              pathEndEntityId: sourceComp.entityId,
              fallbackDirection: (rightVerticalDirection * currentDirection) as CircuitFlowDirection,
            })
          : (rightVerticalDirection * currentDirection) as CircuitFlowDirection;

      // 顶部中段
      if (sorted.length >= 2) {
        const mid = Math.floor(sorted.length / 2);
        const mFrom = sorted[mid - 1]!;
        const mTo = sorted[mid]!;
        const ax = (mFrom.screenX + mTo.screenX) / 2;
        const ay = (mFrom.screenY + mTo.screenY) / 2;
        const topArrowDirection = resolveCircuitArrowDirectionFromRelation({
          relations: ctx.relations,
          pathStartEntityId: mFrom.entityId,
          pathEndEntityId: mTo.entityId,
          fallbackDirection: (topFlowDirection * topCurrentDirection) as CircuitFlowDirection,
        });
        drawDirectedCircuitArrow(
          c,
          { x: ax - 8, y: ay },
          { x: ax + 8, y: ay },
          { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
          topArrowDirection,
        );
      }
      // 底部中段
      const bMidX = (leftX + rightX) / 2;
      const bottomArrowDirection =
        sourceComp && sourceComp === sorted[0]
          ? resolveCircuitArrowDirectionFromRelation({
              relations: ctx.relations,
              pathStartEntityId: lastComp.entityId,
              pathEndEntityId: sourceComp.entityId,
              fallbackDirection: (bottomFlowDirection * currentDirection) as CircuitFlowDirection,
              reverseArrowBase: true,
            })
          : (bottomFlowDirection * currentDirection) as CircuitFlowDirection;
      drawDirectedCircuitArrow(
        c,
        { x: bMidX - 8, y: bottomY },
        { x: bMidX + 8, y: bottomY },
        { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
        bottomArrowDirection,
      );
      // 右侧竖线
      const rMidY = (lastComp.screenY + bottomY) / 2;
      drawDirectedCircuitArrow(
        c,
        { x: rightX, y: rMidY - 8 },
        { x: rightX, y: rMidY + 8 },
        { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
        returnPathDirection,
      );
      // 左侧竖线
      const lMidY = (firstComp.screenY + bottomY) / 2;
      const leftArrowDirection =
        sourceComp && sourceComp === firstComp
          ? resolveCircuitArrowDirectionFromRelation({
              relations: ctx.relations,
              pathStartEntityId: lastComp.entityId,
              pathEndEntityId: sourceComp.entityId,
              fallbackDirection: (leftVerticalDirection * currentDirection) as CircuitFlowDirection,
              reverseArrowBase: true,
            })
          : (leftVerticalDirection * currentDirection) as CircuitFlowDirection;
      drawDirectedCircuitArrow(
        c,
        { x: leftX, y: lMidY - 8 },
        { x: leftX, y: lMidY + 8 },
        { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
        leftArrowDirection,
      );
    }

    // ── 并联支路（半偏法：S' + R' 并联在电流计G两端）──
    // 左节点 = G左边缘 vs 支路第一个元件左边缘，取更左的
    // 右节点 = G右边缘 vs 支路最后一个元件右边缘，取更右的
    // 两条支路（G 和 S'+R'）从同一对节点出发/汇合
    if (parallelBranchComps.length > 0 && circuitT === 'half-deflection') {
      const galv = sorted.find((s) => s.type === 'ammeter');
      if (galv) {
        const branchSorted = [...parallelBranchComps].sort((a, b) => a.screenX - b.screenX);
        const firstBranch = branchSorted[0]!;
        const lastBranch = branchSorted[branchSorted.length - 1]!;

        const galvL = galv.screenX - galv.screenW / 2 - 2;
        const galvR = galv.screenX + galv.screenW / 2 + 2;
        const branchL2 = firstBranch.screenX - firstBranch.screenW / 2 - 2;
        const branchR2 = lastBranch.screenX + lastBranch.screenW / 2 + 2;

        // 左节点：G左边缘 vs 支路首元件左边缘，取更左
        const nodeLeftX = Math.min(galvL, branchL2) - 10;
        // 右节点：G右边缘 vs 支路末元件右边缘，取更右
        const nodeRightX = Math.max(galvR, branchR2) + 10;

        const galvY = galv.screenY;
        const branchY = branchSorted.reduce((sum, c2) => sum + c2.screenY, 0) / branchSorted.length;

        c.strokeStyle = '#1A1A2E';
        c.lineWidth = hasCurrent ? 2 : 1.5;
        if (!hasCurrent) c.setLineDash([6, 3]);

        // ── 主路连接：box-R 右边缘 → 左节点，右节点 → 主路右边界 ──
        const galvIdx2 = sorted.indexOf(galv);
        const prevMainComp = galvIdx2 > 0 ? sorted[galvIdx2 - 1] : null;
        if (prevMainComp) {
          c.beginPath();
          c.moveTo(prevMainComp.screenX + prevMainComp.screenW / 2 + 2, prevMainComp.screenY);
          c.lineTo(nodeLeftX, prevMainComp.screenY);
          if (Math.abs(prevMainComp.screenY - galvY) > 3) {
            c.lineTo(nodeLeftX, galvY);
          }
          c.stroke();
        }
        // 右节点 → 主路右侧竖线起点
        c.beginPath();
        c.moveTo(nodeRightX, galvY);
        c.lineTo(rightX, galvY);
        c.lineTo(rightX, bottomY);
        c.stroke();

        // ── 下支路（电流计G）：左节点 → G → 右节点 ──
        c.beginPath();
        c.moveTo(nodeLeftX, galvY);
        c.lineTo(galvL, galvY);
        c.stroke();
        c.beginPath();
        c.moveTo(galvR, galvY);
        c.lineTo(nodeRightX, galvY);
        c.stroke();

        // ── 上支路（S' + R'）：左节点 → 上行 → S' → R' → 下行 → 右节点 ──
        c.beginPath();
        c.moveTo(nodeLeftX, galvY);
        c.lineTo(nodeLeftX, branchY);
        c.lineTo(branchL2, branchY);
        c.stroke();

        // 支路元件之间的连线
        for (let i = 0; i < branchSorted.length - 1; i++) {
          const from = branchSorted[i]!;
          const to = branchSorted[i + 1]!;
          c.beginPath();
          const x1 = from.screenX + from.screenW / 2 + 2;
          const x2 = to.screenX - to.screenW / 2 - 2;
          if (Math.abs(from.screenY - to.screenY) > 3) {
            const midX = (x1 + x2) / 2;
            c.moveTo(x1, from.screenY);
            c.lineTo(midX, from.screenY);
            c.lineTo(midX, to.screenY);
            c.lineTo(x2, to.screenY);
          } else {
            c.moveTo(x1, from.screenY);
            c.lineTo(x2, to.screenY);
          }
          c.stroke();
        }

        c.beginPath();
        c.moveTo(branchR2, lastBranch.screenY);
        c.lineTo(nodeRightX, lastBranch.screenY);
        c.lineTo(nodeRightX, galvY);
        c.stroke();

        c.setLineDash([]);

        // 左右节点标记（小圆点）
        c.beginPath(); c.arc(nodeLeftX, galvY, 3, 0, Math.PI * 2); c.fillStyle = '#1A1A2E'; c.fill();
        c.beginPath(); c.arc(nodeRightX, galvY, 3, 0, Math.PI * 2); c.fillStyle = '#1A1A2E'; c.fill();
      }
    }

    // 电压表：根据电路类型确定并联位置
    // - 内接法(voltammetry-internal)：电压表并联在 电流表+电阻 两端
    // - 外接法(voltammetry-external)：电压表只并联在 电阻 两端
    // - 测EMF(measure-emf-r)：电压表并联在 电源+开关 两端
    // - 其他：找电压表左右最近的主路元件

    for (const vm of voltmeterComps) {
      c.strokeStyle = '#1A1A2E';
      c.lineWidth = 1.5;
      if (!hasCurrent) c.setLineDash([4, 3]);

      // 确定电压表并联的左右锚点
      let anchorLeft: CompInfo | undefined;
      let anchorRight: CompInfo | undefined;

      if (effectiveVoltammetryCircuitT === 'voltammetry-internal') {
        // 内接法：电压表跨接在电流表左侧 ~ 电阻右侧
        anchorLeft = sorted.find((s) => s.type === 'ammeter' || s.type === 'galvanometer');
        anchorRight = [...sorted].reverse().find((s) => s.type === 'fixed-resistor' || s.type === 'resistance-box' || s.type === 'slide-rheostat');
      } else if (effectiveVoltammetryCircuitT === 'voltammetry-external') {
        // 外接法：电压表只跨接在电阻两端
        const resistors = sorted.filter((s) => s.type === 'fixed-resistor' || s.type === 'resistance-box' || s.type === 'slide-rheostat');
        anchorLeft = resistors[0];
        anchorRight = resistors[resistors.length - 1] ?? resistors[0];
      } else if (circuitT === 'measure-emf-r') {
        // 测EMF：电压表跨接在电源+开关两端
        anchorLeft = sorted.find((s) => s.type === 'dc-source') ?? sorted[0];
        anchorRight = sorted.find((s) => s.type === 'switch') ?? sorted[1];
      } else {
        // 默认：找电压表左右最近的主路元件
        anchorLeft = sorted.filter((s) => s.screenX < vm.screenX).pop();
        anchorRight = sorted.find((s) => s.screenX > vm.screenX);
      }

      if (anchorLeft && anchorRight) {
        // 分叉点：在主路横向导线上，位于锚点元件的外侧边缘
        // 左分叉点：在锚点元件前方的导线上（前一元件和锚点之间的中点）
        const anchorLeftIdx = sorted.indexOf(anchorLeft);
        const prevComp = anchorLeftIdx > 0 ? sorted[anchorLeftIdx - 1] : null;
        const lx = prevComp
          ? (prevComp.screenX + prevComp.screenW / 2 + anchorLeft.screenX - anchorLeft.screenW / 2) / 2
          : leftX; // 没有前一元件时，用主路左边界（和竖线对齐）
        const ly = prevComp ? (prevComp.screenY + anchorLeft.screenY) / 2 : anchorLeft.screenY;

        // 右分叉点：在锚点元件后方的导线上（锚点和后一元件之间的中点）
        const anchorRightIdx = sorted.indexOf(anchorRight);
        const nextComp = anchorRightIdx < sorted.length - 1 ? sorted[anchorRightIdx + 1] : null;
        const rx = nextComp
          ? (anchorRight.screenX + anchorRight.screenW / 2 + nextComp.screenX - nextComp.screenW / 2) / 2
          : rightX; // 没有后一元件时，用主路右边界（和竖线拐角对齐）
        const ry = nextComp ? (anchorRight.screenY + nextComp.screenY) / 2 : anchorRight.screenY;

        // 电压表连接点
        const vmL = vm.screenX - vm.screenW / 2 - 2;
        const vmR2 = vm.screenX + vm.screenW / 2 + 2;
        const vmY = vm.screenY;

        // 左侧：从主路分叉点垂直到电压表Y → 水平到电压表左端
        c.beginPath();
        c.moveTo(lx, ly);
        c.lineTo(lx, vmY);
        c.lineTo(vmL, vmY);
        c.stroke();

        // 分叉点标记（小圆点，表示导线接合处）
        c.beginPath();
        c.arc(lx, ly, 3, 0, Math.PI * 2);
        c.fillStyle = '#1A1A2E';
        c.fill();

        // 右侧：电压表右端 → 水平到右分叉点X → 垂直回主路
        c.beginPath();
        c.moveTo(vmR2, vmY);
        c.lineTo(rx, vmY);
        c.lineTo(rx, ry);
        c.stroke();

        // 右分叉点标记
        c.beginPath();
        c.arc(rx, ry, 3, 0, Math.PI * 2);
        c.fillStyle = '#1A1A2E';
        c.fill();

        if (voltmeterBranchArrowDirection !== 0) {
          const leftVerticalLength = Math.abs(vmY - ly);
          const leftHorizontalLength = Math.abs(vmL - lx);
          if (leftVerticalLength >= leftHorizontalLength) {
            drawDirectedCircuitArrow(
              c,
              { x: lx, y: ly },
              { x: lx, y: vmY },
              { color: '#2563EB', lineWidth: 2, arrowHeadSize: 7 },
              voltmeterBranchArrowDirection,
            );
          } else {
            drawDirectedCircuitArrow(
              c,
              { x: lx, y: vmY },
              { x: vmL, y: vmY },
              { color: '#2563EB', lineWidth: 2, arrowHeadSize: 7 },
              voltmeterBranchArrowDirection,
            );
          }

          const rightVerticalLength = Math.abs(ry - vmY);
          const rightHorizontalLength = Math.abs(rx - vmR2);
          if (rightHorizontalLength >= rightVerticalLength) {
            drawDirectedCircuitArrow(
              c,
              { x: vmR2, y: vmY },
              { x: rx, y: vmY },
              { color: '#2563EB', lineWidth: 2, arrowHeadSize: 7 },
              voltmeterBranchArrowDirection,
            );
          } else {
            drawDirectedCircuitArrow(
              c,
              { x: rx, y: vmY },
              { x: rx, y: ry },
              { color: '#2563EB', lineWidth: 2, arrowHeadSize: 7 },
              voltmeterBranchArrowDirection,
            );
          }
        }
      }
      c.setLineDash([]);
    }

    c.restore();
  }

  // ── 2. 电源标注（端电压 / 总电流 — 始终显示在元件旁） ──
  if (source) {
    renderSourceAnnotations(c, source, coordinateTransform);
  }

  // ── 3~6. 公式/步骤/对比表/U-I图 由 React 浮层卡片渲染，此处跳过 ──
}

/**
 * 电源位置标注：仅端电压、总电流（误差分析由 React 卡片渲染）
 */
function renderSourceAnnotations(
  c: CanvasRenderingContext2D,
  source: Entity,
  coordinateTransform: CoordinateTransform,
): void {
  const terminalV = source.properties.terminalVoltage as number | undefined;
  const totalI = source.properties.totalCurrent as number | undefined;

  const pos = source.transform.position;
  const w = (source.properties.width as number) ?? 0.8;
  const h = (source.properties.height as number) ?? 0.5;

  const topScreen = worldToScreen({ x: pos.x + w / 2, y: pos.y + h }, coordinateTransform);
  let yOffset = topScreen.y - 20;

  if (terminalV !== undefined) {
    drawTextLabel(c, `U端=${terminalV.toFixed(3)}V`, { x: topScreen.x, y: yOffset }, {
      color: EMF_COLOR, fontSize: 12, align: 'center', backgroundColor: 'rgba(255,255,255,0.85)', padding: 3,
    });
    yOffset -= 18;
  }

  if (totalI !== undefined) {
    drawTextLabel(c, `I总=${totalI.toFixed(3)}A`, { x: topScreen.x, y: yOffset }, {
      color: CURRENT_COLOR, fontSize: 12, align: 'center', backgroundColor: 'rgba(255,255,255,0.85)', padding: 3,
    });
  }
}

function renderMeasureEmfRWires(
  entities: Map<string, Entity>,
  c: CanvasRenderingContext2D,
  coordinateTransform: CoordinateTransform,
  currentDirection: CircuitFlowDirection,
): void {
  const comps = collectCircuitComponentBounds(entities, coordinateTransform);
  const source = comps.find((comp) => comp.type === 'dc-source');
  const sw = comps.find((comp) => comp.type === 'switch');
  const ammeter = comps.find((comp) => comp.type === 'ammeter' || comp.type === 'galvanometer');
  const rheostat = comps.find((comp) => comp.type === 'slide-rheostat');
  const voltmeter = comps.find((comp) => comp.type === 'voltmeter');
  const loadResistor = comps.find((comp) => comp.type === 'fixed-resistor' || comp.type === 'resistance-box');

  if (!source || !sw || !ammeter || !rheostat || !voltmeter) return;

  const mode = (rheostat.entity.properties.connectionMode as string) === 'divider' ? 'divider' : 'variable';
  const loadBranchDirection = getCircuitFlowDirection(
    (source.entity.properties.outputCurrent as number | undefined)
      ?? (ammeter.entity.properties.reading as number | undefined),
  );
  const totalCurrentDirection = currentDirection;
  const supplyCurrentDirection = mode === 'divider' ? totalCurrentDirection : loadBranchDirection;
  const hasLoadBranchCurrent = loadBranchDirection !== 0;
  const currentColor = hasLoadBranchCurrent ? '#D97706' : '#1A1A2E';
  const voltageColor = '#2563EB';
  const nodeColor = '#111827';

  const left = (comp: CircuitComponentBounds) => ({ x: comp.cx - comp.hw - 2, y: comp.cy });
  const right = (comp: CircuitComponentBounds) => ({ x: comp.cx + comp.hw + 2, y: comp.cy });
  const top = (comp: CircuitComponentBounds) => ({ x: comp.cx, y: comp.cy - comp.hh - 2 });
  const polyline = (
    points: Array<{ x: number; y: number }>,
    options?: { color?: string; width?: number; dashed?: boolean },
  ) => {
    if (points.length < 2) return;
    c.save();
    c.strokeStyle = options?.color ?? '#1A1A2E';
    c.lineWidth = options?.width ?? ((supplyCurrentDirection !== 0 || hasLoadBranchCurrent) ? 2.2 : 1.6);
    c.lineJoin = 'round';
    c.lineCap = 'round';
    if (options?.dashed) c.setLineDash([8, 4]);
    c.beginPath();
    c.moveTo(points[0]!.x, points[0]!.y);
    for (let index = 1; index < points.length; index += 1) {
      c.lineTo(points[index]!.x, points[index]!.y);
    }
    c.stroke();
    c.restore();
  };
  const drawNodeDots = (points: Array<{ x: number; y: number }>) => {
    const seen = new Set<string>();
    c.save();
    c.fillStyle = nodeColor;
    for (const point of points) {
      const key = `${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      c.beginPath();
      c.arc(point.x, point.y, 3.6, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  };
  const drawArrowOnSegment = (
    from: { x: number; y: number },
    to: { x: number; y: number },
    direction: CircuitFlowDirection,
    color: string,
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 28) return;
    const ux = dx / length;
    const uy = dy / length;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    drawDirectedCircuitArrow(
      c,
      { x: mid.x - ux * 10, y: mid.y - uy * 10 },
      { x: mid.x + ux * 10, y: mid.y + uy * 10 },
      { color, lineWidth: 2.2, arrowHeadSize: 7 },
      direction,
    );
  };
  const drawMeasurementArrowOnSegment = (
    from: { x: number; y: number },
    to: { x: number; y: number },
  ) => {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const length = Math.hypot(dx, dy);
    if (length < 28 || totalCurrentDirection === 0) return;
    const ux = dx / length;
    const uy = dy / length;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    drawDirectedCircuitArrow(
      c,
      { x: mid.x - ux * 10, y: mid.y - uy * 10 },
      { x: mid.x + ux * 10, y: mid.y + uy * 10 },
      { color: voltageColor, lineWidth: 2.1, arrowHeadSize: 7 },
      totalCurrentDirection,
    );
  };

  const sourcePositive = { x: source.cx + source.hw + 14, y: source.cy - 18 };
  const sourceNegative = { x: source.cx - source.hw - 14, y: source.cy + 18 };
  const topRailY = Math.min(sw.cy, rheostat.cy, sourcePositive.y);
  const bottomRailY = Math.max(sourceNegative.y, ammeter.cy + ammeter.hh, loadResistor?.cy ?? sourceNegative.y) + 44;
  const currentNodes: Array<{ x: number; y: number }> = [];
  const voltageNodes: Array<{ x: number; y: number }> = [];

  if (mode === 'variable') {
    const switchLeft = { x: left(sw).x, y: topRailY };
    const switchRight = { x: right(sw).x, y: topRailY };
    const ammeterLeft = { x: left(ammeter).x, y: topRailY };
    const ammeterRight = { x: right(ammeter).x, y: topRailY };
    const rheostatLeft = { x: left(rheostat).x, y: topRailY };
    const rheostatRightTerminal = { x: right(rheostat).x, y: topRailY };
    const rheostatRight = { x: right(rheostat).x, y: topRailY };
    const negRailJoin = { x: sourceNegative.x, y: bottomRailY };
    const posRailJoin = { x: sourcePositive.x, y: topRailY };
    const meterLeft = { x: left(voltmeter).x, y: voltmeter.cy };
    const meterRight = { x: right(voltmeter).x, y: voltmeter.cy };
    const voltLeftTapX = Math.min(meterLeft.x, sourcePositive.x) - 24;
    const voltRightTapX = meterRight.x + 18;
    const voltReturnY = bottomRailY - 18;

    polyline([sourcePositive, posRailJoin, switchLeft, left(sw)], { color: currentColor, width: 2.8 });
    polyline([right(sw), switchRight, ammeterLeft, left(ammeter)], { color: currentColor, width: 2.8 });
    polyline([right(ammeter), ammeterRight, rheostatLeft, left(rheostat)], { color: currentColor, width: 2.8 });
    polyline([
      right(rheostat),
      rheostatRightTerminal,
      rheostatRight,
      { x: rheostatRight.x + 22, y: topRailY },
      { x: rheostatRight.x + 22, y: bottomRailY },
      negRailJoin,
      sourceNegative,
    ], { color: currentColor, width: 2.8 });

    polyline([
      sourcePositive,
      { x: voltLeftTapX, y: sourcePositive.y },
      { x: voltLeftTapX, y: voltmeter.cy },
      meterLeft,
    ], { color: voltageColor, width: 2.4, dashed: true });
    polyline([
      meterRight,
      { x: voltRightTapX, y: voltmeter.cy },
      { x: voltRightTapX, y: voltReturnY },
      { x: sourceNegative.x, y: voltReturnY },
      sourceNegative,
    ], { color: voltageColor, width: 2.4, dashed: true });

    currentNodes.push(
      sourcePositive,
      posRailJoin,
      switchLeft,
      left(sw),
      switchRight,
      right(sw),
      ammeterLeft,
      left(ammeter),
      ammeterRight,
      right(ammeter),
      rheostatLeft,
      left(rheostat),
      rheostatRightTerminal,
      right(rheostat),
      rheostatRight,
      negRailJoin,
      sourceNegative,
    );
    voltageNodes.push(sourcePositive, meterLeft, meterRight, sourceNegative);

    drawArrowOnSegment(right(sw), ammeterLeft, loadBranchDirection, currentColor);
    drawArrowOnSegment(right(ammeter), rheostatLeft, loadBranchDirection, currentColor);
    if (!hasLoadBranchCurrent && totalCurrentDirection !== 0) {
      drawMeasurementArrowOnSegment({ x: voltLeftTapX, y: voltmeter.cy }, meterLeft);
      drawMeasurementArrowOnSegment(meterRight, { x: voltRightTapX, y: voltmeter.cy });
    }
  } else {
    const posRailJoin = { x: sourcePositive.x, y: topRailY };
    const switchLeft = { x: left(sw).x, y: topRailY };
    const switchRight = { x: right(sw).x, y: topRailY };
    const ammeterLeft = { x: left(ammeter).x, y: topRailY };
    const ammeterRight = { x: right(ammeter).x, y: topRailY };
    const rheostatLeftTop = { x: left(rheostat).x, y: topRailY };
    const rheostatRightTop = { x: right(rheostat).x, y: topRailY };
    const outputNode = { x: top(rheostat).x, y: top(rheostat).y - 12 };
    const returnNode = { x: sourceNegative.x, y: bottomRailY };
    const loadLeftNode = loadResistor ? { x: left(loadResistor).x, y: loadResistor.cy } : { x: outputNode.x + 22, y: bottomRailY - 42 };
    const loadRightNode = loadResistor ? { x: right(loadResistor).x, y: loadResistor.cy } : loadLeftNode;
    const loadReturnNode = { x: loadRightNode.x + 18, y: bottomRailY };
    const meterLeft = { x: left(voltmeter).x, y: voltmeter.cy };
    const meterRight = { x: right(voltmeter).x, y: voltmeter.cy };
    const voltLeftTapX = Math.min(meterLeft.x, sourcePositive.x) - 24;
    const voltRightTapX = meterRight.x + 18;
    const voltReturnY = bottomRailY - 18;

    polyline([sourcePositive, posRailJoin, switchLeft, left(sw)], { color: currentColor, width: 2.8 });
    polyline([right(sw), switchRight, ammeterLeft, left(ammeter)], { color: currentColor, width: 2.8 });
    polyline([right(ammeter), ammeterRight, rheostatLeftTop, left(rheostat)], { color: currentColor, width: 2.8 });
    polyline([
      right(rheostat),
      rheostatRightTop,
      { x: rheostatRightTop.x + 22, y: topRailY },
      { x: rheostatRightTop.x + 22, y: bottomRailY },
      returnNode,
      sourceNegative,
    ], { color: currentColor, width: 2.8 });

    if (loadResistor) {
      polyline([
        outputNode,
        { x: outputNode.x, y: loadResistor.cy },
        loadLeftNode,
      ], { color: currentColor, width: 2.8 });
      polyline([
        loadRightNode,
        { x: loadReturnNode.x, y: loadRightNode.y },
        loadReturnNode,
        returnNode,
        sourceNegative,
      ], { color: currentColor, width: 2.8 });
    }

    polyline([
      sourcePositive,
      { x: voltLeftTapX, y: sourcePositive.y },
      { x: voltLeftTapX, y: voltmeter.cy },
      meterLeft,
    ], { color: voltageColor, width: 2.4, dashed: true });
    polyline([
      meterRight,
      { x: voltRightTapX, y: voltmeter.cy },
      { x: voltRightTapX, y: voltReturnY },
      { x: sourceNegative.x, y: voltReturnY },
      sourceNegative,
    ], { color: voltageColor, width: 2.4, dashed: true });

    currentNodes.push(
      sourcePositive,
      posRailJoin,
      switchLeft,
      left(sw),
      switchRight,
      right(sw),
      ammeterLeft,
      left(ammeter),
      ammeterRight,
      right(ammeter),
      rheostatLeftTop,
      left(rheostat),
      outputNode,
      loadLeftNode,
      loadRightNode,
      loadReturnNode,
      returnNode,
      sourceNegative,
    );
    currentNodes.push(right(rheostat), rheostatRightTop);
    voltageNodes.push(sourcePositive, meterLeft, meterRight, sourceNegative);

    drawArrowOnSegment(right(sw), ammeterLeft, supplyCurrentDirection, currentColor);
    drawArrowOnSegment(right(ammeter), rheostatLeftTop, supplyCurrentDirection, currentColor);
    if (loadResistor && hasLoadBranchCurrent) {
      drawArrowOnSegment(outputNode, { x: outputNode.x, y: loadLeftNode.y }, loadBranchDirection, currentColor);
    }

    drawTextLabel(
      c,
      '滑片输出',
      { x: outputNode.x + 8, y: outputNode.y - 16 },
      { color: currentColor, fontSize: 11, align: 'left', backgroundColor: 'rgba(255,255,255,0.88)', padding: 3 },
    );
    drawTextLabel(
      c,
      'U端',
      { x: voltmeter.cx, y: voltmeter.cy - voltmeter.hh - 18 },
      { color: voltageColor, fontSize: 11, align: 'center', backgroundColor: 'rgba(255,255,255,0.88)', padding: 3 },
    );
  }

  drawNodeDots([...currentNodes, ...voltageNodes]);
  drawTextLabel(c, '+', { x: sourcePositive.x - 8, y: sourcePositive.y - 8 }, {
    color: '#C0392B', fontSize: 12, align: 'center', backgroundColor: 'rgba(255,255,255,0.88)', padding: 2,
  });
  drawTextLabel(c, '−', { x: sourceNegative.x + 8, y: sourceNegative.y + 8 }, {
    color: '#2980B9', fontSize: 12, align: 'center', backgroundColor: 'rgba(255,255,255,0.88)', padding: 2,
  });
  drawTextLabel(c, '电流路径', { x: rheostat.cx + 38, y: topRailY - 18 }, {
    color: currentColor, fontSize: 11, align: 'left', backgroundColor: 'rgba(255,255,255,0.88)', padding: 3,
  });
  drawTextLabel(c, '电压测量路径', { x: voltmeter.cx, y: voltmeter.cy + voltmeter.hh + 18 }, {
    color: voltageColor, fontSize: 11, align: 'center', backgroundColor: 'rgba(255,255,255,0.88)', padding: 3,
  });
}

function renderHalfDeflectionAmmeterWires(
  entities: Map<string, Entity>,
  c: CanvasRenderingContext2D,
  coordinateTransform: CoordinateTransform,
  currentDirection: CircuitFlowDirection,
): void {
  const comps = collectCircuitComponentBounds(entities, coordinateTransform);
  const source = comps.find((comp) => comp.type === 'dc-source');
  const meter = comps.find((comp) => comp.type === 'ammeter' || comp.type === 'galvanometer');
  const halfResistor = comps.find((comp) => comp.type === 'fixed-resistor' || comp.type === 'resistance-box');
  const switches = comps
    .filter((comp) => comp.type === 'switch')
    .sort((a, b) => a.cx - b.cx);

  if (!source || !meter || !halfResistor || switches.length < 2) return;

  const mainSwitch = switches[0]!;
  const halfSwitch = switches[1]!;
  const branchClosed = (halfSwitch.entity.properties.closed as boolean) !== false;
  const branchCurrentDirection = getCircuitFlowDirection(
    source.entity.properties.parallelBranchCurrent as number | undefined,
  );
  const wireColor = '#1A1A2E';
  const hasCurrent = currentDirection !== 0;

  const aL = (comp: CircuitComponentBounds) => ({ x: comp.cx - comp.hw - 2, y: comp.cy });
  const aR = (comp: CircuitComponentBounds) => ({ x: comp.cx + comp.hw + 2, y: comp.cy });
  const connectPoints = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    c.beginPath();
    c.moveTo(from.x, from.y);
    if (Math.abs(from.y - to.y) > 3) {
      const midX = (from.x + to.x) / 2;
      c.lineTo(midX, from.y);
      c.lineTo(midX, to.y);
    }
    c.lineTo(to.x, to.y);
    c.stroke();
  };

  const bottomY =
    Math.max(
      source.cy + source.hh,
      meter.cy + meter.hh,
      halfSwitch.cy + halfSwitch.hh,
      halfResistor.cy + halfResistor.hh,
    ) + 48;
  const leftX = source.cx - source.hw - 18;
  const meterLeftTerminal = aL(meter);
  const meterRightTerminal = aR(meter);
  const branchLeftTerminal = aL(halfSwitch);
  const branchRightTerminal = aR(halfResistor);
  // A_left / A_right 对应电流表两端所在节点；分叉与汇合都围绕同一对节点展开。
  const splitNode = { x: Math.min(meterLeftTerminal.x, branchLeftTerminal.x) - 16, y: meter.cy };
  const mergeNode = { x: Math.max(meterRightTerminal.x, branchRightTerminal.x) + 16, y: meter.cy };
  const branchY = Math.min(halfSwitch.cy, halfResistor.cy) - 10;

  c.save();
  c.strokeStyle = wireColor;
  c.lineWidth = hasCurrent ? 2 : 1.5;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (!hasCurrent) c.setLineDash([6, 3]);

  connectPoints(aR(source), aL(mainSwitch));
  connectPoints(aR(mainSwitch), splitNode);
  connectPoints(splitNode, meterLeftTerminal);
  connectPoints(meterRightTerminal, mergeNode);
  connectPoints(mergeNode, { x: mergeNode.x, y: bottomY });
  connectPoints({ x: mergeNode.x, y: bottomY }, { x: leftX, y: bottomY });
  connectPoints({ x: leftX, y: bottomY }, { x: leftX, y: source.cy });
  connectPoints({ x: leftX, y: source.cy }, aL(source));

  connectPoints(splitNode, { x: splitNode.x, y: branchY });
  connectPoints({ x: splitNode.x, y: branchY }, { x: branchLeftTerminal.x, y: branchY });
  connectPoints({ x: branchLeftTerminal.x, y: branchY }, branchLeftTerminal);
  connectPoints(aR(halfSwitch), aL(halfResistor));
  connectPoints(branchRightTerminal, { x: mergeNode.x, y: halfResistor.cy });
  connectPoints({ x: mergeNode.x, y: halfResistor.cy }, mergeNode);

  c.setLineDash([]);
  c.fillStyle = wireColor;
  c.beginPath();
  c.arc(splitNode.x, splitNode.y, 3, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(mergeNode.x, mergeNode.y, 3, 0, Math.PI * 2);
  c.fill();

  if (hasCurrent) {
    drawDirectedCircuitArrow(
      c,
      { x: (aR(mainSwitch).x + splitNode.x) / 2 - 8, y: mainSwitch.cy },
      { x: (aR(mainSwitch).x + splitNode.x) / 2 + 8, y: mainSwitch.cy },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    drawDirectedCircuitArrow(
      c,
      { x: (mergeNode.x + leftX) / 2 + 8, y: bottomY },
      { x: (mergeNode.x + leftX) / 2 - 8, y: bottomY },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    drawDirectedCircuitArrow(
      c,
      { x: mergeNode.x, y: (mergeNode.y + bottomY) / 2 - 8 },
      { x: mergeNode.x, y: (mergeNode.y + bottomY) / 2 + 8 },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    drawDirectedCircuitArrow(
      c,
      { x: (splitNode.x + meterRightTerminal.x) / 2 - 8, y: meter.cy },
      { x: (splitNode.x + meterRightTerminal.x) / 2 + 8, y: meter.cy },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    if (branchClosed && branchCurrentDirection !== 0) {
      drawDirectedCircuitArrow(
        c,
        { x: (aR(halfSwitch).x + aL(halfResistor).x) / 2 - 8, y: halfResistor.cy },
        { x: (aR(halfSwitch).x + aL(halfResistor).x) / 2 + 8, y: halfResistor.cy },
        { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
        branchCurrentDirection,
      );
    }
  }

  c.restore();
}

function renderHalfDeflectionVoltmeterWires(
  entities: Map<string, Entity>,
  c: CanvasRenderingContext2D,
  coordinateTransform: CoordinateTransform,
  currentDirection: CircuitFlowDirection,
): void {
  const comps = collectCircuitComponentBounds(entities, coordinateTransform);
  const source = comps.find((comp) => comp.type === 'dc-source');
  const rheostat = comps.find((comp) => comp.type === 'slide-rheostat');
  const halfResistor = comps.find((comp) => comp.type === 'fixed-resistor' || comp.type === 'resistance-box');
  const voltmeter = comps.find((comp) => comp.type === 'voltmeter');
  const switches = comps
    .filter((comp) => comp.type === 'switch')
    .sort((a, b) => a.cx - b.cx);

  if (!source || !rheostat || !halfResistor || !voltmeter || switches.length < 2) return;

  const mainSwitch = switches[0]!;
  const bypassSwitch = switches[1]!;
  const bypassClosed = (bypassSwitch.entity.properties.closed as boolean) !== false;
  const wireColor = '#1A1A2E';
  const hasCurrent = currentDirection !== 0;

  const aL = (comp: CircuitComponentBounds) => ({ x: comp.cx - comp.hw - 2, y: comp.cy });
  const aR = (comp: CircuitComponentBounds) => ({ x: comp.cx + comp.hw + 2, y: comp.cy });
  const connectPoints = (from: { x: number; y: number }, to: { x: number; y: number }) => {
    c.beginPath();
    c.moveTo(from.x, from.y);
    if (Math.abs(from.y - to.y) > 3) {
      const midX = (from.x + to.x) / 2;
      c.lineTo(midX, from.y);
      c.lineTo(midX, to.y);
    }
    c.lineTo(to.x, to.y);
    c.stroke();
  };

  const bottomY =
    Math.max(
      source.cy + source.hh,
      rheostat.cy + rheostat.hh,
      halfResistor.cy + halfResistor.hh,
      bypassSwitch.cy + bypassSwitch.hh,
      voltmeter.cy + voltmeter.hh,
    ) + 48;
  const leftX = source.cx - source.hw - 18;
  const rightX = voltmeter.cx + voltmeter.hw + 22;
  const nodeLeft = { x: halfResistor.cx - halfResistor.hw - 18, y: rheostat.cy };
  const nodeRight = { x: halfResistor.cx + halfResistor.hw + 18, y: voltmeter.cy };

  c.save();
  c.strokeStyle = wireColor;
  c.lineWidth = hasCurrent ? 2 : 1.5;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (!hasCurrent) c.setLineDash([6, 3]);

  connectPoints(aR(source), aL(mainSwitch));
  connectPoints(aR(mainSwitch), aL(rheostat));
  connectPoints(aR(rheostat), nodeLeft);

  connectPoints(nodeLeft, { x: nodeLeft.x, y: halfResistor.cy });
  connectPoints({ x: nodeLeft.x, y: halfResistor.cy }, aL(halfResistor));
  connectPoints(aR(halfResistor), { x: nodeRight.x, y: halfResistor.cy });
  connectPoints({ x: nodeRight.x, y: halfResistor.cy }, nodeRight);

  connectPoints(nodeLeft, { x: nodeLeft.x, y: bypassSwitch.cy });
  connectPoints({ x: nodeLeft.x, y: bypassSwitch.cy }, aL(bypassSwitch));
  connectPoints(aR(bypassSwitch), { x: nodeRight.x, y: bypassSwitch.cy });
  connectPoints({ x: nodeRight.x, y: bypassSwitch.cy }, nodeRight);

  connectPoints(nodeRight, aL(voltmeter));
  connectPoints(aR(voltmeter), { x: rightX, y: voltmeter.cy });
  connectPoints({ x: rightX, y: voltmeter.cy }, { x: rightX, y: bottomY });
  connectPoints({ x: rightX, y: bottomY }, { x: leftX, y: bottomY });
  connectPoints({ x: leftX, y: bottomY }, { x: leftX, y: source.cy });
  connectPoints({ x: leftX, y: source.cy }, aL(source));

  c.setLineDash([]);
  c.fillStyle = wireColor;
  c.beginPath();
  c.arc(nodeLeft.x, nodeLeft.y, 3, 0, Math.PI * 2);
  c.fill();
  c.beginPath();
  c.arc(nodeRight.x, nodeRight.y, 3, 0, Math.PI * 2);
  c.fill();

  if (hasCurrent) {
    drawDirectedCircuitArrow(
      c,
      { x: (aR(mainSwitch).x + aL(rheostat).x) / 2 - 8, y: mainSwitch.cy },
      { x: (aR(mainSwitch).x + aL(rheostat).x) / 2 + 8, y: mainSwitch.cy },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    drawDirectedCircuitArrow(
      c,
      { x: (rightX + leftX) / 2 + 8, y: bottomY },
      { x: (rightX + leftX) / 2 - 8, y: bottomY },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    drawDirectedCircuitArrow(
      c,
      { x: rightX, y: (voltmeter.cy + bottomY) / 2 - 8 },
      { x: rightX, y: (voltmeter.cy + bottomY) / 2 + 8 },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    const activeY = bypassClosed ? bypassSwitch.cy : halfResistor.cy;
    const activeStart = bypassClosed ? aR(bypassSwitch).x : aR(halfResistor).x - halfResistor.hw;
    const activeEnd = bypassClosed ? aR(bypassSwitch).x + 16 : aR(halfResistor).x + 16;
    drawDirectedCircuitArrow(
      c,
      { x: (nodeLeft.x + nodeRight.x) / 2 - 8, y: activeY },
      { x: (nodeLeft.x + nodeRight.x) / 2 + 8, y: activeY },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 },
      currentDirection,
    );
    void activeStart;
    void activeEnd;
  }

  c.restore();
}

/**
 * 欧姆表专用渲染 — 虚线框 + 单闭环串联布线（Rx 在下方）
 *
 * 闭合回路（串联）：
 *
 *   ┌── 开关 ── G(表头) ──┐
 *   │                      │
 *   E(电池)           R₀(调零)   ← 欧姆表内部（虚线框）
 *   │                      │
 *   └───●红              黑●───┘
 *        │                │
 *        └── Rx(待测) ────┘       ← 外部（下方）
 *
 * 回路路径：E+ → 开关 → G → R₀ → 黑端 → Rx → 红端 → E-
 */
function renderOhmmeterWires(
  entities: Map<string, Entity>,
  c: CanvasRenderingContext2D,
  coordinateTransform: CoordinateTransform,
  currentDirection: CircuitFlowDirection,
): void {
  const circleTypes = new Set(['ammeter', 'voltmeter', 'galvanometer', 'bulb', 'motor']);

  interface CB { type: string; label: string; cx: number; cy: number; hw: number; hh: number }
  const compList: CB[] = [];

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const w = (entity.properties.width as number) ?? (entity.properties.radius as number) ?? 0.5;
    const h = (entity.properties.height as number) ?? w;
    let cx2: number, cy2: number;
    if (circleTypes.has(entity.type)) { cx2 = pos.x; cy2 = pos.y; }
    else { cx2 = pos.x + w / 2; cy2 = pos.y + h / 2; }
    const sc = worldToScreen({ x: cx2, y: cy2 }, coordinateTransform);
    const screenW = worldLengthToScreen(w, coordinateTransform);
    const screenH = worldLengthToScreen(h, coordinateTransform);
    compList.push({ type: entity.type, label: entity.label ?? '', cx: sc.x, cy: sc.y, hw: screenW / 2, hh: screenH / 2 });
  }

  let src: CB | undefined, swc: CB | undefined, galv: CB | undefined;
  let r0: CB | undefined, rx: CB | undefined;
  for (const comp of compList) {
    if (comp.type === 'dc-source') src = comp;
    else if (comp.type === 'switch') swc = comp;
    else if (comp.type === 'galvanometer' || comp.type === 'ammeter') galv = comp;
    else if (comp.type === 'slide-rheostat') r0 = comp;
    else if (comp.type === 'resistance-box') rx = comp;
  }
  if (!src || !galv || !r0 || !rx) return;
  const hasCurrent = currentDirection !== 0;

  const aL = (comp: CB) => ({ x: comp.cx - comp.hw - 2, y: comp.cy });
  const aR = (comp: CB) => ({ x: comp.cx + comp.hw + 2, y: comp.cy });

  // ── 关键坐标 ──
  const topY = swc ? Math.min(swc.cy, galv.cy) : galv.cy;
  const leftX = src.cx;
  const rightX = Math.max(aR(galv).x, aR(r0).x) + 30;

  // 接线柱位置：红端在左下、黑端在右下（在虚线框底部）
  const termRedX = leftX;
  const termBlkX = rightX;

  // ── 虚线框 ──
  const internalComps = [src, galv, r0];
  if (swc) internalComps.push(swc);
  const boxPad = 28;
  const bxL = Math.min(...internalComps.map((cc) => cc.cx - cc.hw)) - boxPad;
  const bxR = rightX + boxPad - 5;
  const bxT = Math.min(topY - Math.max(galv.hh, swc?.hh ?? 0)) - boxPad;
  const bxB = Math.max(r0.cy + r0.hh, src.cy + src.hh) + boxPad + 35;
  const bxW = bxR - bxL;

  const wireColor = '#1A1A2E';
  c.save();

  c.strokeStyle = '#9CA3AF';
  c.lineWidth = 1.5;
  c.setLineDash([8, 4]);
  c.beginPath();
  c.moveTo(bxL + 8, bxT); c.lineTo(bxR - 8, bxT);
  c.quadraticCurveTo(bxR, bxT, bxR, bxT + 8);
  c.lineTo(bxR, bxB - 8);
  c.quadraticCurveTo(bxR, bxB, bxR - 8, bxB);
  c.lineTo(bxL + 8, bxB);
  c.quadraticCurveTo(bxL, bxB, bxL, bxB - 8);
  c.lineTo(bxL, bxT + 8);
  c.quadraticCurveTo(bxL, bxT, bxL + 8, bxT);
  c.stroke();
  c.setLineDash([]);

  c.fillStyle = '#9CA3AF';
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText('欧姆表内部', bxL + bxW / 2, bxT - 6);

  // ── 内部导线（串联闭环的上半部分和两侧）──
  c.strokeStyle = wireColor;
  c.lineWidth = hasCurrent ? 2 : 1.5;
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (!hasCurrent) c.setLineDash([6, 3]);

  // 路径1：E+ → 上行 → 开关 → G（上排）
  c.beginPath();
  c.moveTo(leftX, src.cy - src.hh - 2);
  c.lineTo(leftX, topY);
  if (swc) {
    c.lineTo(aL(swc).x, swc.cy);
    c.stroke();
    c.beginPath();
    c.moveTo(aR(swc).x, swc.cy);
    if (Math.abs(swc.cy - galv.cy) > 3) {
      const mx = (aR(swc).x + aL(galv).x) / 2;
      c.lineTo(mx, swc.cy); c.lineTo(mx, galv.cy);
    }
    c.lineTo(aL(galv).x, galv.cy);
  } else {
    c.lineTo(aL(galv).x, galv.cy);
  }
  c.stroke();

  // 路径2：G → 右竖线 → R₀（右侧下行）
  c.beginPath();
  c.moveTo(aR(galv).x, galv.cy);
  c.lineTo(rightX, galv.cy);
  c.lineTo(rightX, r0.cy);
  c.lineTo(aR(r0).x, r0.cy);
  c.stroke();

  // 路径3a：R₀左 → 水平到黑端X → 竖线到黑端接线柱
  const termY = bxB - 14;
  c.beginPath();
  c.moveTo(aL(r0).x, r0.cy);
  c.lineTo(termBlkX, r0.cy);
  c.stroke();
  c.beginPath();
  c.moveTo(termBlkX, r0.cy);
  c.lineTo(termBlkX, termY - 7);
  c.stroke();

  // 路径3b：红端 → 上行 → E-
  c.beginPath();
  c.moveTo(termRedX, termY - 7);
  c.lineTo(termRedX, src.cy + src.hh + 2);
  c.stroke();

  c.setLineDash([]);

  // 节点标记（闭环中的节点）
  c.fillStyle = wireColor;
  c.beginPath(); c.arc(leftX, topY, 3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(rightX, galv.cy, 3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(rightX, r0.cy, 3, 0, Math.PI * 2); c.fill();

  // ── 接线柱（闭环的断口，Rx 接在这里）──
  // 指针式欧姆表外接端：红表笔接内部负极，黑表笔接内部正极。
  // 这样短接红黑表笔时，外电路常规电流方向就是黑 → 红。
  // 红端（连接 E-）
  c.fillStyle = '#E74C3C';
  c.beginPath(); c.arc(termRedX, termY, 7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#C0392B'; c.lineWidth = 2;
  c.beginPath(); c.arc(termRedX, termY, 7, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#FFF'; c.font = 'bold 11px Inter, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('−', termRedX, termY);

  // 黑端（连接 R₀ 末端）
  c.fillStyle = '#333';
  c.beginPath(); c.arc(termBlkX, termY, 7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1A1A2E'; c.lineWidth = 2;
  c.beginPath(); c.arc(termBlkX, termY, 7, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#FFF';
  c.fillText('+', termBlkX, termY);

  // 标注端子文字
  c.fillStyle = '#E74C3C'; c.font = '10px Inter, sans-serif'; c.textAlign = 'center';
  c.fillText('红表笔', termRedX, termY + 18);
  c.fillStyle = '#555';
  c.fillText('黑表笔', termBlkX, termY + 18);

  // ── Rx 外部连接（红端 → 向下 → Rx → 向下回到黑端）──
  // Rx 在虚线框下方，红表笔和黑表笔垂直向下引出到 Rx 两端
  const rxLp = aL(rx);
  const rxRp = aR(rx);

  // 红端 → 垂直向下 → Rx 左锚点
  c.strokeStyle = '#E74C3C'; c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(termRedX, termY + 7);
  c.lineTo(termRedX, rx.cy);  // 垂直向下到 Rx 高度
  c.lineTo(rxLp.x, rxLp.y);   // 水平到 Rx 左端
  c.stroke();

  // Rx 右锚点 → 垂直向上回到黑端
  c.strokeStyle = '#333'; c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(rxRp.x, rxRp.y);
  c.lineTo(termBlkX, rx.cy);  // 水平到黑端X
  c.lineTo(termBlkX, termY + 7); // 垂直向上到黑端
  c.stroke();

  // ── 路径标注（教学用：标注电流方向） ──
  if (hasCurrent) {
    // 上排：E→G 方向（→）
    const topMidX = swc ? (aR(swc).x + aL(galv).x) / 2 : (leftX + aL(galv).x) / 2;
    drawDirectedCircuitArrow(c, { x: topMidX - 8, y: topY }, { x: topMidX + 8, y: topY },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
    // 右竖线：G→R₀（↓）
    const rMidY = (galv.cy + r0.cy) / 2;
    drawDirectedCircuitArrow(c, { x: rightX, y: rMidY - 8 }, { x: rightX, y: rMidY + 8 },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
    // 外部 Rx 段：黑端→Rx→红端（←）
    const rxMidX = (rxLp.x + rxRp.x) / 2;
    drawDirectedCircuitArrow(c, { x: rxMidX + 8, y: rxLp.y }, { x: rxMidX - 8, y: rxLp.y },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
  }

  c.restore();
}

/**
 * 多量程欧姆表专用渲染 — 虚线框 + 串联闭环（量程开关替代滑动变阻器）
 *
 * 闭合回路（串联）：
 *
 *   ┌── 开关 ── G(表头) ──┐
 *   │                      │
 *   E(电池)          量程选择开关  ← 欧姆表内部（虚线框）
 *   │                      │
 *   └───●红              黑●───┘
 *        │                │
 *        └── Rx(待测) ────┘       ← 外部（下方）
 *
 * 回路路径：E+ → 开关 → G → 量程开关(公共端→选中电阻→输出) → 黑端 → Rx → 红端 → E-
 */
function renderMultiRangeOhmmeterWires(
  entities: Map<string, Entity>,
  c: CanvasRenderingContext2D,
  coordinateTransform: CoordinateTransform,
  currentDirection: CircuitFlowDirection,
): void {
  const circleTypes = new Set(['ammeter', 'voltmeter', 'galvanometer', 'bulb', 'motor']);

  interface CB { type: string; label: string; cx: number; cy: number; hw: number; hh: number }
  const compList: CB[] = [];

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const w = (entity.properties.width as number) ?? (entity.properties.radius as number) ?? 0.5;
    const h = (entity.properties.height as number) ?? w;
    let cx2: number, cy2: number;
    if (circleTypes.has(entity.type)) { cx2 = pos.x; cy2 = pos.y; }
    else { cx2 = pos.x + w / 2; cy2 = pos.y + h / 2; }
    const sc = worldToScreen({ x: cx2, y: cy2 }, coordinateTransform);
    const screenW = worldLengthToScreen(w, coordinateTransform);
    const screenH = worldLengthToScreen(h, coordinateTransform);
    compList.push({ type: entity.type, label: entity.label ?? '', cx: sc.x, cy: sc.y, hw: screenW / 2, hh: screenH / 2 });
  }

  let src: CB | undefined, swc: CB | undefined, galv: CB | undefined;
  let rangeSw: CB | undefined, rx: CB | undefined;
  for (const comp of compList) {
    if (comp.type === 'dc-source') src = comp;
    else if (comp.type === 'switch') swc = comp;
    else if (comp.type === 'galvanometer' || comp.type === 'ammeter') galv = comp;
    else if (comp.type === 'range-switch') rangeSw = comp;
    else if (comp.type === 'resistance-box') rx = comp;
  }
  if (!src || !galv || !rangeSw || !rx) return;
  const hasCurrent = currentDirection !== 0;

  const aL = (comp: CB) => ({ x: comp.cx - comp.hw - 2, y: comp.cy });
  const aR = (comp: CB) => ({ x: comp.cx + comp.hw + 2, y: comp.cy });

  // ── 关键坐标 ──
  const topY = swc ? Math.min(swc.cy, galv.cy) : galv.cy;
  const leftX = src.cx;

  // 量程开关渲染器中 outputLineX = screenTopLeft.x + screenW * 0.88
  // 即 (rangeSw.cx - rangeSw.hw) + (2 * rangeSw.hw) * 0.88 = rangeSw.cx + 0.76 * rangeSw.hw
  // 右侧竖线必须精确穿过此 X，才能与渲染器画的输出端竖线重合
  const rangeSwOutputX = rangeSw.cx + 0.76 * rangeSw.hw;
  // rightX 取 G 右锚点和量程开关输出端的较大值（通常输出端更右）
  const rightX = Math.max(aR(galv).x + 15, rangeSwOutputX);

  // 接线柱位置：红端在左侧（E-），黑端在右侧（与右侧竖线同 X，确保连续）
  const termRedX = leftX;
  const termBlkX = rightX;

  // ── 虚线框 ──
  const internalComps = [src, galv, rangeSw];
  if (swc) internalComps.push(swc);
  const boxPad = 28;
  const bxL = Math.min(...internalComps.map((cc) => cc.cx - cc.hw)) - boxPad;
  const bxR = rightX + boxPad - 5;
  const bxT = Math.min(topY - Math.max(galv.hh, swc?.hh ?? 0)) - boxPad;
  const bxB = Math.max(rangeSw.cy + rangeSw.hh, src.cy + src.hh) + boxPad + 35;
  const bxW = bxR - bxL;

  const wireColor = '#1A1A2E';
  c.save();

  c.strokeStyle = '#9CA3AF';
  c.lineWidth = 1.5;
  c.setLineDash([8, 4]);
  c.beginPath();
  c.moveTo(bxL + 8, bxT); c.lineTo(bxR - 8, bxT);
  c.quadraticCurveTo(bxR, bxT, bxR, bxT + 8);
  c.lineTo(bxR, bxB - 8);
  c.quadraticCurveTo(bxR, bxB, bxR - 8, bxB);
  c.lineTo(bxL + 8, bxB);
  c.quadraticCurveTo(bxL, bxB, bxL, bxB - 8);
  c.lineTo(bxL, bxT + 8);
  c.quadraticCurveTo(bxL, bxT, bxL + 8, bxT);
  c.stroke();
  c.setLineDash([]);

  c.fillStyle = '#9CA3AF';
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  c.fillText('多量程欧姆表内部', bxL + bxW / 2, bxT - 6);

  // ── 内部导线 ──
  c.strokeStyle = wireColor;
  c.lineWidth = hasCurrent ? 2 : 1.5;
  c.lineJoin = 'round'; c.lineCap = 'round';
  if (!hasCurrent) c.setLineDash([6, 3]);

  // 路径1：E+ → 上行 → 开关 → G（上排）
  c.beginPath();
  c.moveTo(leftX, src.cy - src.hh - 2);
  c.lineTo(leftX, topY);
  if (swc) {
    c.lineTo(aL(swc).x, swc.cy);
    c.stroke();
    c.beginPath();
    c.moveTo(aR(swc).x, swc.cy);
    if (Math.abs(swc.cy - galv.cy) > 3) {
      const mx = (aR(swc).x + aL(galv).x) / 2;
      c.lineTo(mx, swc.cy); c.lineTo(mx, galv.cy);
    }
    c.lineTo(aL(galv).x, galv.cy);
  } else {
    c.lineTo(aL(galv).x, galv.cy);
  }
  c.stroke();

  // 路径2：G 右端 → 水平到 rightX → 竖直下行直达黑端接线柱
  // 全程同一 X（rightX = termBlkX = rangeSwOutputX），不留任何缝隙
  const termY = bxB - 14;

  // 一笔画：G 右端 → 水平到 rightX → 垂直到黑端圆圈顶部
  c.beginPath();
  c.moveTo(aR(galv).x, galv.cy);
  c.lineTo(rightX, galv.cy);       // 水平段
  c.lineTo(rightX, termY - 7);     // 垂直段：一条连续线直达黑端
  c.stroke();

  // 路径3：红端 → 上行 → E-
  c.beginPath();
  c.moveTo(termRedX, termY - 7);
  c.lineTo(termRedX, src.cy + src.hh + 2);
  c.stroke();

  c.setLineDash([]);

  // 节点标记（闭环拐点）
  c.fillStyle = wireColor;
  c.beginPath(); c.arc(leftX, topY, 3, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(rightX, galv.cy, 3, 0, Math.PI * 2); c.fill();

  // ── 接线柱 ──
  // 指针式欧姆表外接端：红表笔接内部负极，黑表笔接内部正极。
  // 红端（连接 E-）
  c.fillStyle = '#E74C3C';
  c.beginPath(); c.arc(termRedX, termY, 7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#C0392B'; c.lineWidth = 2;
  c.beginPath(); c.arc(termRedX, termY, 7, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#FFF'; c.font = 'bold 11px Inter, sans-serif';
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('−', termRedX, termY);

  // 黑端
  c.fillStyle = '#333';
  c.beginPath(); c.arc(termBlkX, termY, 7, 0, Math.PI * 2); c.fill();
  c.strokeStyle = '#1A1A2E'; c.lineWidth = 2;
  c.beginPath(); c.arc(termBlkX, termY, 7, 0, Math.PI * 2); c.stroke();
  c.fillStyle = '#FFF';
  c.fillText('+', termBlkX, termY);

  // 端子标注
  c.fillStyle = '#E74C3C'; c.font = '10px Inter, sans-serif'; c.textAlign = 'center';
  c.fillText('红表笔', termRedX, termY + 18);
  c.fillStyle = '#555';
  c.fillText('黑表笔', termBlkX, termY + 18);

  // ── Rx 外部连接 ──
  const rxLp = aL(rx);
  const rxRp = aR(rx);

  c.strokeStyle = '#E74C3C'; c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(termRedX, termY + 7);
  c.lineTo(termRedX, rx.cy);
  c.lineTo(rxLp.x, rxLp.y);
  c.stroke();

  c.strokeStyle = '#333'; c.lineWidth = 2.5;
  c.beginPath();
  c.moveTo(rxRp.x, rxRp.y);
  c.lineTo(termBlkX, rx.cy);
  c.lineTo(termBlkX, termY + 7);
  c.stroke();

  // ── 电流方向箭头 ──
  if (hasCurrent) {
    const topMidX = swc ? (aR(swc).x + aL(galv).x) / 2 : (leftX + aL(galv).x) / 2;
    drawDirectedCircuitArrow(c, { x: topMidX - 8, y: topY }, { x: topMidX + 8, y: topY },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
    // 右侧竖线：G→黑端方向（↓），箭头放在量程开关下方到黑端之间
    const rMidY = (rangeSw.cy + rangeSw.hh + termY) / 2;
    drawDirectedCircuitArrow(c, { x: rightX, y: rMidY - 8 }, { x: rightX, y: rMidY + 8 },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
    const rxMidX = (rxLp.x + rxRp.x) / 2;
    drawDirectedCircuitArrow(c, { x: rxMidX + 8, y: rxLp.y }, { x: rxMidX - 8, y: rxLp.y },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
  }

  c.restore();
}

/**
 * 惠斯通电桥专用渲染 — 基于锚点的正交布线
 *
 * 拓扑：
 *       电源─开关─┬─ R1 ─┬─ R2 ─┐
 *                 A      B      C
 *                 │      │      │
 *                 │     [G]     │
 *                 │      │      │
 *                 A      D      C
 *                 └─ R3 ─┴─ R4 ─┘
 *
 * 节点 A(左), B(上中), C(右), D(下中)
 * 电源+开关 在 A 的左侧串联
 */
function renderWheatstoneWires(
  entities: Map<string, Entity>,
  c: CanvasRenderingContext2D,
  coordinateTransform: CoordinateTransform,
  currentDirection: CircuitFlowDirection,
): void {
  // ── 收集元件信息 ──
  interface CompBox {
    entity: Entity;
    type: string;
    label: string;
    cx: number; cy: number; // 屏幕中心
    hw: number; hh: number; // 半宽、半高
  }

  const comps = new Map<string, CompBox>();
  const circleTypes = new Set(['ammeter', 'voltmeter', 'galvanometer', 'bulb', 'motor']);

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const w = (entity.properties.width as number) ?? (entity.properties.radius as number) ?? 0.5;
    const h = (entity.properties.height as number) ?? w;
    let cx: number, cy: number;
    if (circleTypes.has(entity.type)) {
      cx = pos.x; cy = pos.y;
    } else {
      cx = pos.x + w / 2; cy = pos.y + h / 2;
    }
    const sc = worldToScreen({ x: cx, y: cy }, coordinateTransform);
    const sw = worldLengthToScreen(w, coordinateTransform);
    const sh = worldLengthToScreen(h, coordinateTransform);
    comps.set(entity.type + ':' + (entity.label ?? ''), {
      entity,
      type: entity.type,
      label: entity.label ?? '',
      cx: sc.x, cy: sc.y,
      hw: sw / 2, hh: sh / 2,
    });
  }

  // ── 按位置识别各元件 ──
  // 电阻按 y 分上下（世界坐标 y 大 = 屏幕 y 小 = 上），再按 x 分左右
  const resistors: CompBox[] = [];
  let galvComp: CompBox | undefined;
  let sourceComp: CompBox | undefined;
  let switchComp: CompBox | undefined;

  for (const comp of comps.values()) {
    if (comp.type === 'fixed-resistor' || comp.type === 'resistance-box') {
      resistors.push(comp);
    } else if (comp.type === 'galvanometer' || comp.type === 'ammeter') {
      if (comp.label.includes('电流计') || comp.type === 'galvanometer') {
        galvComp = comp;
      }
    } else if (comp.type === 'dc-source') {
      sourceComp = comp;
    } else if (comp.type === 'switch') {
      switchComp = comp;
    }
  }

  if (resistors.length < 4 || !galvComp || !sourceComp) return;
  const hasCurrent = currentDirection !== 0;

  // 按 y 分上下（屏幕坐标，小=上）
  const yMid = resistors.reduce((s, r) => s + r.cy, 0) / resistors.length;
  const upper = resistors.filter((r) => r.cy < yMid).sort((a, b) => a.cx - b.cx);
  const lower = resistors.filter((r) => r.cy >= yMid).sort((a, b) => a.cx - b.cx);

  if (upper.length < 2 || lower.length < 2) return;

  const R1 = upper[0]!; // 上左
  const R2 = upper[1]!; // 上右
  const R3 = lower[0]!; // 下左
  const R4 = lower[1]!; // 下右

  // ── 计算 4 个桥节点位置 ──
  // 节点 A（左侧汇合点）：R1 左端和 R3 左端的中间 x，取更左的
  const nodeA_x = Math.min(R1.cx - R1.hw, R3.cx - R3.hw) - 40;
  const nodeA_yTop = R1.cy;
  const nodeA_yBot = R3.cy;
  const nodeA_yMid = (nodeA_yTop + nodeA_yBot) / 2;

  // 节点 B（上中，R1 和 R2 之间）：G 的上端
  const nodeB_x = galvComp.cx;
  const nodeB_y = Math.min(R1.cy, R2.cy);

  // 节点 C（右侧汇合点）：R2 右端和 R4 右端的中间 x，取更右的
  const nodeC_x = Math.max(R2.cx + R2.hw, R4.cx + R4.hw) + 40;
  const nodeC_yTop = R2.cy;
  const nodeC_yBot = R4.cy;

  // 节点 D（下中，R3 和 R4 之间）：G 的下端
  const nodeD_x = galvComp.cx;
  const nodeD_y = Math.max(R3.cy, R4.cy);

  const wireColor = '#1A1A2E';
  c.save();
  c.strokeStyle = wireColor;
  c.lineWidth = hasCurrent ? 2 : 1.5;
  c.lineJoin = 'round';
  c.lineCap = 'round';
  if (!hasCurrent) c.setLineDash([6, 3]);

  // ── 画导线（锚点到锚点，正交布线）──

  // 锚点：元件的左右边缘
  const anchorL = (comp: CompBox) => ({ x: comp.cx - comp.hw - 2, y: comp.cy });
  const anchorR = (comp: CompBox) => ({ x: comp.cx + comp.hw + 2, y: comp.cy });
  const anchorT = (comp: CompBox) => ({ x: comp.cx, y: comp.cy - comp.hh - 2 });
  const anchorB = (comp: CompBox) => ({ x: comp.cx, y: comp.cy + comp.hh + 2 });

  // 辅助：画正交折线
  function drawOrthoLine(from: {x:number,y:number}, to: {x:number,y:number}, midX?: number) {
    c.beginPath();
    if (midX !== undefined) {
      c.moveTo(from.x, from.y);
      c.lineTo(midX, from.y);
      c.lineTo(midX, to.y);
      c.lineTo(to.x, to.y);
    } else if (Math.abs(from.y - to.y) < 2) {
      c.moveTo(from.x, from.y);
      c.lineTo(to.x, to.y);
    } else {
      const mx = (from.x + to.x) / 2;
      c.moveTo(from.x, from.y);
      c.lineTo(mx, from.y);
      c.lineTo(mx, to.y);
      c.lineTo(to.x, to.y);
    }
    c.stroke();
  }

  // 辅助：画直线
  function drawLine(from: {x:number,y:number}, to: {x:number,y:number}) {
    c.beginPath();
    c.moveTo(from.x, from.y);
    c.lineTo(to.x, to.y);
    c.stroke();
  }

  // 1. 节点A → R1左锚点（竖线到上桥臂高度，水平到R1左端）
  drawOrthoLine({ x: nodeA_x, y: nodeA_yTop }, anchorL(R1));

  // 2. R1右锚点 → 节点B → R2左锚点
  //    R1右 → 水平到 nodeB_x → 如果 nodeB 和 R1/R2 不在同一 y，折线到 R2 左
  const r1R = anchorR(R1);
  const r2L = anchorL(R2);
  // R1右 → 水平到 B_x，再到 R2 高度，再到 R2 左
  drawOrthoLine(r1R, { x: nodeB_x, y: nodeB_y }, undefined);
  drawOrthoLine({ x: nodeB_x, y: nodeB_y }, r2L, undefined);

  // 3. R2右锚点 → 节点C
  drawOrthoLine(anchorR(R2), { x: nodeC_x, y: nodeC_yTop });

  // 4. 节点A → R3左锚点
  drawOrthoLine({ x: nodeA_x, y: nodeA_yBot }, anchorL(R3));

  // 5. R3右锚点 → 节点D → R4左锚点
  const r3R = anchorR(R3);
  const r4L = anchorL(R4);
  drawOrthoLine(r3R, { x: nodeD_x, y: nodeD_y }, undefined);
  drawOrthoLine({ x: nodeD_x, y: nodeD_y }, r4L, undefined);

  // 6. R4右锚点 → 节点C
  drawOrthoLine(anchorR(R4), { x: nodeC_x, y: nodeC_yBot });

  // 7. 节点A 左竖线（连接上下桥臂）
  drawLine({ x: nodeA_x, y: nodeA_yTop }, { x: nodeA_x, y: nodeA_yBot });

  // 8. 节点C 右竖线（连接上下桥臂）
  drawLine({ x: nodeC_x, y: nodeC_yTop }, { x: nodeC_x, y: nodeC_yBot });

  // 9. 检流计 G：节点B → G上锚点，G下锚点 → 节点D
  const gT = anchorT(galvComp);
  const gB = anchorB(galvComp);
  drawLine({ x: nodeB_x, y: nodeB_y }, gT);
  drawLine(gB, { x: nodeD_x, y: nodeD_y });

  // 10. 电源+开关 → 节点A
  //     电源在最左，开关在电源右边，开关右端连到节点A中点
  if (switchComp) {
    const swR = anchorR(switchComp);
    const swL = anchorL(switchComp);
    const srcR = anchorR(sourceComp);
    // 电源右 → 开关左
    drawOrthoLine(srcR, swL);
    // 开关右 → 节点A 中点
    drawOrthoLine(swR, { x: nodeA_x, y: nodeA_yMid });
  } else {
    const srcR = anchorR(sourceComp);
    drawOrthoLine(srcR, { x: nodeA_x, y: nodeA_yMid });
  }

  // 11. 节点C → 回路回到电源（底部走线）
  const srcL = anchorL(sourceComp);
  const bottomY = Math.max(nodeA_yBot, nodeC_yBot, sourceComp.cy + sourceComp.hh) + 40;
  // 节点C → 向下 → 水平回到电源下方 → 向上到电源左端
  c.beginPath();
  c.moveTo(nodeC_x, (nodeC_yTop + nodeC_yBot) / 2);
  c.lineTo(nodeC_x, bottomY);
  c.lineTo(srcL.x - 15, bottomY);
  c.lineTo(srcL.x - 15, srcL.y);
  c.lineTo(srcL.x, srcL.y);
  c.stroke();

  c.setLineDash([]);

  // ── 节点标记（小圆点）──
  const dotR = 3;
  c.fillStyle = wireColor;
  for (const pt of [
    { x: nodeA_x, y: nodeA_yTop }, { x: nodeA_x, y: nodeA_yBot }, { x: nodeA_x, y: nodeA_yMid },
    { x: nodeB_x, y: nodeB_y }, { x: nodeD_x, y: nodeD_y },
    { x: nodeC_x, y: nodeC_yTop }, { x: nodeC_x, y: nodeC_yBot },
  ]) {
    c.beginPath(); c.arc(pt.x, pt.y, dotR, 0, Math.PI * 2); c.fill();
  }

  // ── 电流方向箭头 ──
  if (hasCurrent) {
    // 上桥臂：A→B 方向（R1 上）
    const r1Mid = { x: (anchorL(R1).x + anchorR(R1).x) / 2 - 20, y: R1.cy };
    drawDirectedCircuitArrow(c, { x: r1Mid.x - 8, y: r1Mid.y }, { x: r1Mid.x + 8, y: r1Mid.y },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
    // 下桥臂：A→D 方向（R3 上）
    const r3Mid = { x: (anchorL(R3).x + anchorR(R3).x) / 2 - 20, y: R3.cy };
    drawDirectedCircuitArrow(c, { x: r3Mid.x - 8, y: r3Mid.y }, { x: r3Mid.x + 8, y: r3Mid.y },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
    // 底部回路：右→左
    const bMidX = (nodeC_x + srcL.x) / 2;
    drawDirectedCircuitArrow(c, { x: bMidX + 8, y: bottomY }, { x: bMidX - 8, y: bottomY },
      { color: wireColor, lineWidth: 2, arrowHeadSize: 7 }, currentDirection);
  }

  const galvanometerCurrent = (galvComp.entity.properties.current as number | undefined)
    ?? (((galvComp.entity.properties.reading as number | undefined) ?? 0) / 1e6);
  const galvanometerDirection = getCircuitFlowDirection(galvanometerCurrent);
  if (galvanometerDirection !== 0) {
    drawDirectedCircuitArrow(
      c,
      { x: nodeB_x, y: gT.y + 10 },
      { x: nodeD_x, y: gB.y - 10 },
      { color: '#D97706', lineWidth: 2.2, arrowHeadSize: 8 },
      galvanometerDirection,
    );
    drawTextLabel(c, 'Ig', { x: nodeB_x + 18, y: (nodeB_y + nodeD_y) / 2 }, {
      color: '#D97706',
      fontSize: 11,
      align: 'left',
      backgroundColor: 'rgba(255,255,255,0.88)',
      padding: 2,
    });
  }

  // ── 节点标签 ──
  c.fillStyle = '#6B7280';
  c.font = '11px Inter, sans-serif';
  c.textAlign = 'center';
  drawTextLabel(c, 'A', { x: nodeA_x - 12, y: nodeA_yMid }, {
    color: '#6B7280', fontSize: 11, align: 'center',
  });
  drawTextLabel(c, 'B', { x: nodeB_x, y: nodeB_y - 10 }, {
    color: '#6B7280', fontSize: 11, align: 'center',
  });
  drawTextLabel(c, 'C', { x: nodeC_x + 12, y: (nodeC_yTop + nodeC_yBot) / 2 }, {
    color: '#6B7280', fontSize: 11, align: 'center',
  });
  drawTextLabel(c, 'D', { x: nodeD_x, y: nodeD_y + 14 }, {
    color: '#6B7280', fontSize: 11, align: 'center',
  });

  c.restore();
}

export function registerCircuitViewport(): void {
  rendererRegistry.registerViewport('circuit', circuitViewportRenderer);
}
