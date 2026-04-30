import { useRef, useEffect, useCallback, useState } from 'react';
import {
  type BuilderInteraction,
  getBuilderWorkspaceSnapshot,
  type BuilderWorkspaceId,
  useBuilderStore,
  useBuilderWorkspace,
} from '@/store/builder-store';
import { entityRegistry } from '@/core/registries/entity-registry';
import {
  getProtectedBuilderEntityIds,
  resolveBuilderInstrumentSlotBindings,
} from '@/domains/em/builder/template-library';
import {
  BuilderEntityParamFields,
  filterEntitySchemasForTemplate,
  getTemplateSpecificEntityNote,
} from '@/shell/panels/BuilderParamEditor';
import { createRenderLoop } from '@/renderer/render-loop';
import { computeCenteredOrigin } from '@/renderer/fit-entities';
import { screenToWorld, worldLengthToScreen, worldToScreen } from '@/renderer/coordinate';
import { drawArrow } from '@/renderer/primitives/arrow';
import { drawTextLabel } from '@/renderer/primitives/text-label';
import { COLORS, RADIUS, SHADOWS } from '@/styles/tokens';
import type { Entity, EntityId, Relation, CoordinateTransform, Vec2 } from '@/core/types';

interface BuilderCanvasProps {
  workspaceId: BuilderWorkspaceId;
  entryMode?: 'template' | 'free';
  showTemplateLibraryInFree?: boolean;
  advancedEditEnabled?: boolean;
  isRealistic?: boolean;
  onToggleRealistic?: () => void;
}

// ═══════════════════════════════════════════
// 连接点系统
// ═══════════════════════════════════════════

type PortSide = 'top' | 'bottom' | 'left' | 'right';

interface Port {
  entityId: EntityId;
  side: PortSide;
  world: Vec2;
}

const PORT_RADIUS = 6;
const PORT_SHOW_DISTANCE = 60;
const PORT_SNAP_DISTANCE = 14;
/** 导线从连接点向外延伸的距离（物理坐标） */
const WIRE_MARGIN = 0.15;


function getEntityPorts(entity: Entity): Port[] {
  const pos = entity.transform.position;
  const radius = entity.properties.radius as number | undefined;
  const w = (entity.properties.width as number) ?? (radius ? radius * 2 : 0.5);
  const h = (entity.properties.height as number) ?? w;

  let cx: number, cy: number;
  if (radius != null) { cx = pos.x; cy = pos.y; }
  else { cx = pos.x + w / 2; cy = pos.y + h / 2; }

  const halfW = radius ?? w / 2;
  const halfH = radius ?? h / 2;

  return [
    { entityId: entity.id, side: 'top', world: { x: cx, y: cy + halfH } },
    { entityId: entity.id, side: 'bottom', world: { x: cx, y: cy - halfH } },
    { entityId: entity.id, side: 'left', world: { x: cx - halfW, y: cy } },
    { entityId: entity.id, side: 'right', world: { x: cx + halfW, y: cy } },
  ];
}

function findNearestPort(
  pixel: Vec2, entities: Map<EntityId, Entity>, transform: CoordinateTransform,
  excludeEntityId?: string, maxDist = PORT_SNAP_DISTANCE,
): Port | null {
  let best: Port | null = null;
  let bestDist = maxDist;
  for (const entity of entities.values()) {
    if (entity.id === excludeEntityId) continue;
    for (const port of getEntityPorts(entity)) {
      const screen = worldToScreen(port.world, transform);
      const d = Math.hypot(pixel.x - screen.x, pixel.y - screen.y);
      if (d < bestDist) { bestDist = d; best = port; }
    }
  }
  return best;
}

function findPortBySide(entity: Entity, side: string): Port | null {
  return getEntityPorts(entity).find((p) => p.side === side) ?? null;
}

// ═══════════════════════════════════════════
// 正交路由算法
// ═══════════════════════════════════════════

/**
 * 计算从端口A到端口B的正交路径（屏幕坐标点列表）
 *
 * 策略：
 * - 同侧水平（如都从 right/left 出发）：先向外延伸 margin 避免穿过元件，再 Z 形连接
 * - 对向水平（left→right 或 right→left）：直线或简单 L 形
 * - 混合方向：L 形连接
 * - 不产生多余的短线段
 */
function routeWire(
  portA: { screen: Vec2; side: PortSide },
  portB: { screen: Vec2; side: PortSide },
  margin: number,
): Vec2[] {
  const a = portA.screen;
  const b = portB.screen;
  const dirA = screenDir(portA.side);
  const dirB = screenDir(portB.side);
  const startA = offsetPoint(a, dirA, margin);
  const startB = offsetPoint(b, dirB, margin);

  const isHorizA = portA.side === 'left' || portA.side === 'right';
  const isHorizB = portB.side === 'left' || portB.side === 'right';

  // 判断是否"对向"连接（A 的出口方向指向 B）
  const toB = { x: b.x - a.x, y: b.y - a.y };
  const facingB = dirA.x * toB.x + dirA.y * toB.y > 0;

  const toA = { x: a.x - b.x, y: a.y - b.y };
  const facingA = dirB.x * toA.x + dirB.y * toA.y > 0;

  let path: Vec2[];

  if (isHorizA && isHorizB) {
    if (portA.side === portB.side) {
      const outX = portA.side === 'right'
        ? Math.max(startA.x, startB.x)
        : Math.min(startA.x, startB.x);
      path = [a, startA, { x: outX, y: startA.y }, { x: outX, y: startB.y }, startB, b];
    } else if (facingB && facingA) {
      if (Math.abs(a.y - b.y) < 3) {
        path = [a, b];
      } else {
        const midX = (startA.x + startB.x) / 2;
        path = [a, startA, { x: midX, y: startA.y }, { x: midX, y: startB.y }, startB, b];
      }
    } else {
      const routeY = chooseOuterY(startA, startB, margin);
      path = [a, startA, { x: startA.x, y: routeY }, { x: startB.x, y: routeY }, startB, b];
    }
  } else if (!isHorizA && !isHorizB) {
    if (portA.side === portB.side) {
      const outY = portA.side === 'bottom'
        ? Math.max(startA.y, startB.y)
        : Math.min(startA.y, startB.y);
      path = [a, startA, { x: startA.x, y: outY }, { x: startB.x, y: outY }, startB, b];
    } else if (facingB && facingA) {
      if (Math.abs(a.x - b.x) < 3) {
        path = [a, b];
      } else {
        const midY = (startA.y + startB.y) / 2;
        path = [a, startA, { x: startA.x, y: midY }, { x: startB.x, y: midY }, startB, b];
      }
    } else {
      const routeX = chooseOuterX(startA, startB, margin);
      path = [a, startA, { x: routeX, y: startA.y }, { x: routeX, y: startB.y }, startB, b];
    }
  } else {
    const corner = isHorizA
      ? { x: startB.x, y: startA.y }
      : { x: startA.x, y: startB.y };
    path = [a, startA, corner, startB, b];
  }

  return simplifyOrthogonalPath(path);
}

/** 端口方向在屏幕坐标中的单位向量（Y向下） */
function screenDir(side: PortSide): Vec2 {
  switch (side) {
    case 'top': return { x: 0, y: -1 };    // 屏幕 Y 向下
    case 'bottom': return { x: 0, y: 1 };
    case 'left': return { x: -1, y: 0 };
    case 'right': return { x: 1, y: 0 };
  }
}

function offsetPoint(point: Vec2, dir: Vec2, distance: number): Vec2 {
  return { x: point.x + dir.x * distance, y: point.y + dir.y * distance };
}

function chooseOuterY(a: Vec2, b: Vec2, margin: number): number {
  const topY = Math.min(a.y, b.y) - margin;
  const bottomY = Math.max(a.y, b.y) + margin;
  const topCost = Math.abs(a.y - topY) + Math.abs(b.y - topY);
  const bottomCost = Math.abs(a.y - bottomY) + Math.abs(b.y - bottomY);
  return topCost <= bottomCost ? topY : bottomY;
}

function chooseOuterX(a: Vec2, b: Vec2, margin: number): number {
  const leftX = Math.min(a.x, b.x) - margin;
  const rightX = Math.max(a.x, b.x) + margin;
  const leftCost = Math.abs(a.x - leftX) + Math.abs(b.x - leftX);
  const rightCost = Math.abs(a.x - rightX) + Math.abs(b.x - rightX);
  return leftCost <= rightCost ? leftX : rightX;
}

function simplifyOrthogonalPath(points: Vec2[]): Vec2[] {
  const deduped: Vec2[] = [];

  for (const point of points) {
    const last = deduped[deduped.length - 1];
    if (!last || !samePoint(last, point)) {
      deduped.push(point);
    }
  }

  const simplified: Vec2[] = [];
  for (const point of deduped) {
    while (
      simplified.length >= 2 &&
      isCollinearOrthogonal(
        simplified[simplified.length - 2]!,
        simplified[simplified.length - 1]!,
        point,
      )
    ) {
      simplified.pop();
    }
    simplified.push(point);
  }

  return simplified;
}

function isOrthogonalPath(points: Vec2[], epsilon = 0.5): boolean {
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    const horizontal = Math.abs(a.y - b.y) < epsilon;
    const vertical = Math.abs(a.x - b.x) < epsilon;
    if (!horizontal && !vertical) return false;
  }
  return true;
}

function samePoint(a: Vec2, b: Vec2, epsilon = 0.5): boolean {
  return Math.abs(a.x - b.x) < epsilon && Math.abs(a.y - b.y) < epsilon;
}

function isCollinearOrthogonal(a: Vec2, b: Vec2, c: Vec2, epsilon = 0.5): boolean {
  const sameX = Math.abs(a.x - b.x) < epsilon && Math.abs(b.x - c.x) < epsilon;
  const sameY = Math.abs(a.y - b.y) < epsilon && Math.abs(b.y - c.y) < epsilon;
  return sameX || sameY;
}

/** 绘制路径折线 */
function drawPath(ctx: CanvasRenderingContext2D, points: Vec2[]): void {
  if (points.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(points[0]!.x, points[0]!.y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i]!.x, points[i]!.y);
  }
  ctx.stroke();
}

function isEditableKeyboardTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return (
    target.isContentEditable ||
    tagName === 'INPUT' ||
    tagName === 'TEXTAREA' ||
    tagName === 'SELECT' ||
    Boolean(target.closest('[contenteditable="true"]'))
  );
}

const TEACHING_CIRCLE_COMPONENT_TYPES = new Set([
  'ammeter',
  'voltmeter',
  'galvanometer',
  'bulb',
  'motor',
]);

const MEASURE_EMF_R_CURRENT_COLOR = '#D97706';
const MEASURE_EMF_R_VOLTAGE_COLOR = '#2563EB';

interface TeachingCircuitComponentBounds {
  entity: Entity;
  type: string;
  cx: number;
  cy: number;
  hw: number;
  hh: number;
}

interface StyledWirePath {
  relationId: string;
  points: Vec2[];
  color: string;
  width: number;
  dashed?: boolean;
}

interface WireLabelOverlay {
  text: string;
  position: Vec2;
  color: string;
  align?: 'left' | 'center';
}

interface WirePolarityMarker {
  text: string;
  position: Vec2;
  color: string;
}

interface WireArrowOverlay {
  from: Vec2;
  to: Vec2;
  color: string;
}

interface TemplateWireLayout {
  relationPaths: StyledWirePath[];
  nodePoints: Vec2[];
  hiddenRelationIds: string[];
  labels: WireLabelOverlay[];
  polarityMarkers: WirePolarityMarker[];
  arrows: WireArrowOverlay[];
}

interface EntityScreenBox {
  entityId: EntityId;
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface WireSegment {
  a: Vec2;
  b: Vec2;
  orientation: 'horizontal' | 'vertical';
}

interface ResolvedWireRoute {
  relationId: string;
  sourceEntityId: EntityId;
  targetEntityId: EntityId;
  points: Vec2[];
  networkId: string;
  color: string;
  width: number;
  dashed?: boolean;
  isSpecialized?: boolean;
}

interface ResolvedWireGraph {
  routes: ResolvedWireRoute[];
  nodePoints: Array<{ point: Vec2; networkId: string }>;
  relationToNetwork: Map<string, string>;
  entityToNetwork: Map<string, string>;
  labels: WireLabelOverlay[];
  polarityMarkers: WirePolarityMarker[];
  arrows: WireArrowOverlay[];
}

const GENERIC_WIRE_COLOR = '#555';
const WIRE_CLEARANCE = 10;
const WIRE_SOFT_CLEARANCE = 18;
const WIRE_EXIT_MARGIN = 18;
const WIRE_LANE_CANDIDATE_LIMIT = 20;
const WIRE_ROUTE_PENALTY_BLOCKED = 120000;
const WIRE_ROUTE_PENALTY_OVERLAP = 50000;
const WIRE_ROUTE_PENALTY_CROSS = 18000;
const WIRE_ROUTE_PENALTY_TAP = 14000;
const WIRE_ROUTE_PENALTY_NEAR = 2400;

type CircuitArrowDirection = -1 | 0 | 1;

function getCircuitArrowDirection(current: number | undefined): CircuitArrowDirection {
  if (current === undefined || !Number.isFinite(current) || Math.abs(current) <= 1e-6) {
    return 0;
  }
  return current < 0 ? -1 : 1;
}

function getStoredRelationCurrentDirection(
  relation: Relation | undefined,
): CircuitArrowDirection | null {
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

function pushDirectionalWireArrow(
  arrows: WireArrowOverlay[],
  from: Vec2,
  to: Vec2,
  color: string,
  direction: CircuitArrowDirection,
): void {
  if (direction === 0) return;
  arrows.push(direction > 0 ? { from, to, color } : { from: to, to: from, color });
}
const WIRE_ROUTE_PENALTY_BOX_NEAR = 520;
const WIRE_ROUTE_PENALTY_SELF_INTERSECTION = 60000;

function getSourcePolarityOrientation(source: Entity): 'horizontal' | 'vertical' {
  const circuitType = source.properties.circuitType as string | undefined;
  return circuitType === 'ohmmeter' || circuitType === 'multi-range-ohmmeter'
    ? 'vertical'
    : 'horizontal';
}

function getSourcePolarityScore(
  side: PortSide | undefined,
  polarity: 'positive' | 'negative',
  orientation: 'horizontal' | 'vertical',
): number {
  if (!side) return 0;

  if (orientation === 'vertical') {
    const positiveScores: Record<PortSide, number> = {
      top: 4,
      right: 2,
      left: 2,
      bottom: 1,
    };
    const negativeScores: Record<PortSide, number> = {
      bottom: 4,
      left: 2,
      right: 2,
      top: 1,
    };
    return polarity === 'positive' ? positiveScores[side] : negativeScores[side];
  }

  const positiveScores: Record<PortSide, number> = {
    right: 4,
    top: 2,
    bottom: 2,
    left: 1,
  };
  const negativeScores: Record<PortSide, number> = {
    left: 4,
    bottom: 2,
    top: 2,
    right: 1,
  };

  return polarity === 'positive' ? positiveScores[side] : negativeScores[side];
}

function getRelationEndpointPortSide(
  route: ResolvedWireRoute,
  relation: Relation | undefined,
  entityId: EntityId,
): PortSide | undefined {
  if (!relation) return undefined;
  if (route.sourceEntityId === entityId) {
    return relation.properties.sourcePort as PortSide | undefined;
  }
  if (route.targetEntityId === entityId) {
    return relation.properties.targetPort as PortSide | undefined;
  }
  return undefined;
}

function getRouteEndpointAndNeighbor(
  route: ResolvedWireRoute,
  entityId: EntityId,
): { endpoint: Vec2; neighbor: Vec2 | null; remoteEndpoint: Vec2 } | null {
  if (route.points.length === 0) return null;

  if (route.sourceEntityId === entityId) {
    return {
      endpoint: route.points[0]!,
      neighbor: route.points[1] ?? null,
      remoteEndpoint: route.points[route.points.length - 1]!,
    };
  }

  if (route.targetEntityId === entityId) {
    return {
      endpoint: route.points[route.points.length - 1]!,
      neighbor: route.points[route.points.length - 2] ?? null,
      remoteEndpoint: route.points[0]!,
    };
  }

  return null;
}

function getRouteOrientationBias(
  route: ResolvedWireRoute,
  entityId: EntityId,
  orientation: 'horizontal' | 'vertical',
): { positive: number; negative: number } {
  const endpointInfo = getRouteEndpointAndNeighbor(route, entityId);
  if (!endpointInfo) return { positive: 0, negative: 0 };

  const axisDelta =
    orientation === 'horizontal'
      ? endpointInfo.remoteEndpoint.x - endpointInfo.endpoint.x
      : endpointInfo.remoteEndpoint.y - endpointInfo.endpoint.y;
  const fallbackDelta =
    orientation === 'horizontal'
      ? ((endpointInfo.neighbor?.x ?? endpointInfo.endpoint.x) - endpointInfo.endpoint.x)
      : ((endpointInfo.neighbor?.y ?? endpointInfo.endpoint.y) - endpointInfo.endpoint.y);
  const delta = Math.abs(axisDelta) > 1 ? axisDelta : fallbackDelta;

  if (Math.abs(delta) <= 1) return { positive: 0, negative: 0 };

  if (orientation === 'horizontal') {
    return delta > 0
      ? { positive: 3, negative: 0 }
      : { positive: 0, negative: 3 };
  }

  return delta < 0
    ? { positive: 3, negative: 0 }
    : { positive: 0, negative: 3 };
}

function buildEntityCurrentDistances(
  routes: ResolvedWireRoute[],
  sourceEntityId: EntityId,
  positiveNeighborIds: EntityId[],
): Map<EntityId, number> {
  const adjacency = new Map<EntityId, Set<EntityId>>();

  for (const route of routes) {
    if (route.sourceEntityId === sourceEntityId || route.targetEntityId === sourceEntityId) {
      continue;
    }

    if (!adjacency.has(route.sourceEntityId)) adjacency.set(route.sourceEntityId, new Set());
    if (!adjacency.has(route.targetEntityId)) adjacency.set(route.targetEntityId, new Set());
    adjacency.get(route.sourceEntityId)!.add(route.targetEntityId);
    adjacency.get(route.targetEntityId)!.add(route.sourceEntityId);
  }

  const distances = new Map<EntityId, number>();
  const queue: EntityId[] = [];

  for (const entityId of positiveNeighborIds) {
    if (entityId === sourceEntityId || distances.has(entityId)) continue;
    distances.set(entityId, 0);
    queue.push(entityId);
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const baseDistance = distances.get(current) ?? 0;
    for (const next of adjacency.get(current) ?? []) {
      if (distances.has(next)) continue;
      distances.set(next, baseDistance + 1);
      queue.push(next);
    }
  }

  return distances;
}

function buildAutoArrowOverlay(
  route: ResolvedWireRoute,
  direction: CircuitArrowDirection,
  color: string,
): WireArrowOverlay | null {
  if (direction === 0) return null;

  let bestSegment: { from: Vec2; to: Vec2; length: number } | null = null;

  for (let index = 0; index < route.points.length - 1; index += 1) {
    const from = route.points[index]!;
    const to = route.points[index + 1]!;
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    if (length < 24) continue;
    if (!bestSegment || length > bestSegment.length) {
      bestSegment = { from, to, length };
    }
  }

  if (!bestSegment) return null;

  const ux = (bestSegment.to.x - bestSegment.from.x) / bestSegment.length;
  const uy = (bestSegment.to.y - bestSegment.from.y) / bestSegment.length;
  const halfLength = Math.min(12, bestSegment.length / 2 - 4);
  if (halfLength < 6) return null;

  const mid = {
    x: (bestSegment.from.x + bestSegment.to.x) / 2,
    y: (bestSegment.from.y + bestSegment.to.y) / 2,
  };
  const forwardFrom = {
    x: mid.x - ux * halfLength,
    y: mid.y - uy * halfLength,
  };
  const forwardTo = {
    x: mid.x + ux * halfLength,
    y: mid.y + uy * halfLength,
  };

  return direction > 0
    ? { from: forwardFrom, to: forwardTo, color }
    : { from: forwardTo, to: forwardFrom, color };
}

function resolveAutoCurrentRouteArrows(params: {
  entities: Map<EntityId, Entity>;
  relations: Relation[];
  routes: ResolvedWireRoute[];
}): WireArrowOverlay[] {
  const candidateRoutes = params.routes.filter((route) => !route.isSpecialized);
  if (candidateRoutes.length === 0) return [];

  const relationsById = new Map(
    params.relations
      .filter((relation) => relation.type === 'connection')
      .map((relation) => [relation.id, relation] as const),
  );
  const routesByNetwork = new Map<string, ResolvedWireRoute[]>();

  for (const route of candidateRoutes) {
    const group = routesByNetwork.get(route.networkId) ?? [];
    group.push(route);
    routesByNetwork.set(route.networkId, group);
  }

  const arrows: WireArrowOverlay[] = [];

  for (const networkRoutes of routesByNetwork.values()) {
    const networkEntityIds = new Set<EntityId>();
    for (const route of networkRoutes) {
      networkEntityIds.add(route.sourceEntityId);
      networkEntityIds.add(route.targetEntityId);
    }

    const source = Array.from(networkEntityIds)
      .map((entityId) => params.entities.get(entityId))
      .find((entity): entity is Entity => entity?.type === 'dc-source');
    if (!source) continue;

    const currentDirection = getCircuitArrowDirection(
      source.properties.totalCurrent as number | undefined,
    );
    if (currentDirection === 0) continue;

    const sourceRoutes = networkRoutes.filter(
      (route) => route.sourceEntityId === source.id || route.targetEntityId === source.id,
    );
    if (sourceRoutes.length === 0) continue;

    const orientation = getSourcePolarityOrientation(source);
    const rankedSourceRoutes = sourceRoutes
      .map((route) => {
        const relation = relationsById.get(route.relationId);
        const side = getRelationEndpointPortSide(route, relation, source.id);
        const bias = getRouteOrientationBias(route, source.id, orientation);
        return {
          route,
          positiveScore: getSourcePolarityScore(side, 'positive', orientation) + bias.positive,
          negativeScore: getSourcePolarityScore(side, 'negative', orientation) + bias.negative,
        };
      })
      .sort((left, right) => (
        right.positiveScore - left.positiveScore ||
        left.negativeScore - right.negativeScore
      ));

    const positiveRoute = rankedSourceRoutes[0]?.route;
    const negativeRoute = rankedSourceRoutes
      .filter((item) => item.route.relationId !== positiveRoute?.relationId)
      .sort((left, right) => (
        right.negativeScore - left.negativeScore ||
        left.positiveScore - right.positiveScore
      ))[0]?.route;

    const positiveNeighborIds = positiveRoute
      ? [
          positiveRoute.sourceEntityId === source.id
            ? positiveRoute.targetEntityId
            : positiveRoute.sourceEntityId,
        ]
      : [];
    const distances = buildEntityCurrentDistances(networkRoutes, source.id, positiveNeighborIds);

    for (const route of networkRoutes) {
      const explicitDirection = getStoredRelationCurrentDirection(relationsById.get(route.relationId));
      if (explicitDirection !== null) {
        const arrow = buildAutoArrowOverlay(route, explicitDirection, '#D97706');
        if (arrow) arrows.push(arrow);
        continue;
      }

      let routeDirection: CircuitArrowDirection = 0;
      const touchesSource =
        route.sourceEntityId === source.id || route.targetEntityId === source.id;

      if (touchesSource) {
        const sourceIsStart = route.sourceEntityId === source.id;
        if (positiveRoute && route.relationId === positiveRoute.relationId) {
          routeDirection = sourceIsStart ? 1 : -1;
        } else if (negativeRoute && route.relationId === negativeRoute.relationId) {
          routeDirection = sourceIsStart ? -1 : 1;
        } else {
          const relation = relationsById.get(route.relationId);
          const side = getRelationEndpointPortSide(route, relation, source.id);
          const leaveSource =
            getSourcePolarityScore(side, 'positive', orientation) >=
            getSourcePolarityScore(side, 'negative', orientation);
          routeDirection = leaveSource
            ? (sourceIsStart ? 1 : -1)
            : (sourceIsStart ? -1 : 1);
        }
      } else {
        const sourceDistance = distances.get(route.sourceEntityId);
        const targetDistance = distances.get(route.targetEntityId);

        if (sourceDistance != null && targetDistance != null && sourceDistance !== targetDistance) {
          routeDirection = sourceDistance < targetDistance ? 1 : -1;
        } else if (sourceDistance != null && targetDistance == null) {
          routeDirection = 1;
        } else if (targetDistance != null && sourceDistance == null) {
          routeDirection = -1;
        } else {
          routeDirection = 1;
        }
      }

      if (currentDirection < 0) {
        routeDirection = routeDirection === 1
          ? -1
          : (routeDirection === -1 ? 1 : 0);
      }

      const arrow = buildAutoArrowOverlay(route, routeDirection, '#D97706');
      if (arrow) arrows.push(arrow);
    }
  }

  return arrows;
}

function collectEntityScreenBoxes(
  entities: Map<EntityId, Entity>,
  transform: CoordinateTransform,
): EntityScreenBox[] {
  const boxes: EntityScreenBox[] = [];

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const radius = entity.properties.radius as number | undefined;
    const width = (entity.properties.width as number) ?? (radius ? radius * 2 : 0.5);
    const height = (entity.properties.height as number) ?? width;
    const centerWorld = radius != null
      ? { x: pos.x, y: pos.y }
      : { x: pos.x + width / 2, y: pos.y + height / 2 };
    const center = worldToScreen(centerWorld, transform);
    const halfW = worldLengthToScreen(radius != null ? radius * 2 : width, transform) / 2;
    const halfH = worldLengthToScreen(radius != null ? radius * 2 : height, transform) / 2;
    boxes.push({
      entityId: entity.id,
      left: center.x - halfW,
      right: center.x + halfW,
      top: center.y - halfH,
      bottom: center.y + halfH,
    });
  }

  return boxes;
}

function inflateScreenBox(box: EntityScreenBox, padding: number): EntityScreenBox {
  return {
    ...box,
    left: box.left - padding,
    right: box.right + padding,
    top: box.top - padding,
    bottom: box.bottom + padding,
  };
}

function buildWireSegments(points: Vec2[]): WireSegment[] {
  const segments: WireSegment[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    if (samePoint(a, b)) continue;
    segments.push({
      a,
      b,
      orientation: Math.abs(a.y - b.y) < 0.5 ? 'horizontal' : 'vertical',
    });
  }

  return segments;
}

function getSegmentBounds(segment: WireSegment): { left: number; right: number; top: number; bottom: number } {
  return {
    left: Math.min(segment.a.x, segment.b.x),
    right: Math.max(segment.a.x, segment.b.x),
    top: Math.min(segment.a.y, segment.b.y),
    bottom: Math.max(segment.a.y, segment.b.y),
  };
}

function segmentIntersectsBox(segment: WireSegment, box: EntityScreenBox): boolean {
  const bounds = getSegmentBounds(segment);

  if (segment.orientation === 'horizontal') {
    const y = segment.a.y;
    return y > box.top && y < box.bottom && bounds.right > box.left && bounds.left < box.right;
  }

  const x = segment.a.x;
  return x > box.left && x < box.right && bounds.bottom > box.top && bounds.top < box.bottom;
}

function rangesOverlap(aMin: number, aMax: number, bMin: number, bMax: number): number {
  return Math.max(0, Math.min(aMax, bMax) - Math.max(aMin, bMin));
}

function isEndpointPoint(point: Vec2, segment: WireSegment): boolean {
  return samePoint(point, segment.a, 1) || samePoint(point, segment.b, 1);
}

function isPointOnSegment(point: Vec2, segment: WireSegment, epsilon = 1): boolean {
  const bounds = getSegmentBounds(segment);

  if (segment.orientation === 'horizontal') {
    return Math.abs(point.y - segment.a.y) <= epsilon &&
      point.x >= bounds.left - epsilon &&
      point.x <= bounds.right + epsilon;
  }

  return Math.abs(point.x - segment.a.x) <= epsilon &&
    point.y >= bounds.top - epsilon &&
    point.y <= bounds.bottom + epsilon;
}

function isPointOnSegmentInterior(point: Vec2, segment: WireSegment, epsilon = 1): boolean {
  return isPointOnSegment(point, segment, epsilon) && !isEndpointPoint(point, segment);
}

function classifySegmentConflict(
  segmentA: WireSegment,
  segmentB: WireSegment,
): 'none' | 'cross' | 'tap' | 'overlap' {
  if (segmentA.orientation === segmentB.orientation) {
    if (segmentA.orientation === 'horizontal') {
      if (Math.abs(segmentA.a.y - segmentB.a.y) > 1) return 'none';
      const boundsA = getSegmentBounds(segmentA);
      const boundsB = getSegmentBounds(segmentB);
      return rangesOverlap(boundsA.left, boundsA.right, boundsB.left, boundsB.right) > 1
        ? 'overlap'
        : 'none';
    }

    if (Math.abs(segmentA.a.x - segmentB.a.x) > 1) return 'none';
    const boundsA = getSegmentBounds(segmentA);
    const boundsB = getSegmentBounds(segmentB);
    return rangesOverlap(boundsA.top, boundsA.bottom, boundsB.top, boundsB.bottom) > 1
      ? 'overlap'
      : 'none';
  }

  const horizontal = segmentA.orientation === 'horizontal' ? segmentA : segmentB;
  const vertical = segmentA.orientation === 'vertical' ? segmentA : segmentB;
  const crossing = { x: vertical.a.x, y: horizontal.a.y };

  if (!isPointOnSegment(crossing, horizontal, 1) || !isPointOnSegment(crossing, vertical, 1)) {
    return 'none';
  }

  const horizontalInterior = isPointOnSegmentInterior(crossing, horizontal, 1);
  const verticalInterior = isPointOnSegmentInterior(crossing, vertical, 1);

  if (horizontalInterior && verticalInterior) return 'cross';
  if (horizontalInterior || verticalInterior) return 'tap';
  return 'none';
}

function countInternalBends(points: Vec2[]): number {
  return Math.max(0, points.length - 2);
}

function getPathLength(points: Vec2[]): number {
  let length = 0;
  for (let index = 0; index < points.length - 1; index += 1) {
    length += Math.abs(points[index]!.x - points[index + 1]!.x) + Math.abs(points[index]!.y - points[index + 1]!.y);
  }
  return length;
}

function uniqueNumbers(values: number[], epsilon = 1): number[] {
  const result: number[] = [];
  for (const value of values) {
    if (!result.some((existing) => Math.abs(existing - value) < epsilon)) {
      result.push(value);
    }
  }
  return result;
}

function createRelationNetworkMaps(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
): {
  relationToNetwork: Map<string, string>;
  entityToNetwork: Map<string, string>;
} {
  const adjacency = new Map<string, Set<string>>();

  for (const entity of entities.values()) {
    adjacency.set(entity.id, new Set());
  }

  for (const relation of relations) {
    if (relation.type !== 'connection') continue;
    adjacency.get(relation.sourceEntityId)?.add(relation.targetEntityId);
    adjacency.get(relation.targetEntityId)?.add(relation.sourceEntityId);
  }

  const entityToNetwork = new Map<string, string>();
  let networkIndex = 0;

  for (const entityId of adjacency.keys()) {
    if (entityToNetwork.has(entityId)) continue;
    const neighbors = adjacency.get(entityId);
    if (!neighbors || neighbors.size === 0) continue;

    networkIndex += 1;
    const networkId = `network-${networkIndex}`;
    const stack = [entityId];

    while (stack.length > 0) {
      const current = stack.pop()!;
      if (entityToNetwork.has(current)) continue;
      entityToNetwork.set(current, networkId);
      for (const next of adjacency.get(current) ?? []) {
        if (!entityToNetwork.has(next)) stack.push(next);
      }
    }
  }

  const relationToNetwork = new Map<string, string>();
  for (const relation of relations) {
    if (relation.type !== 'connection') continue;
    const networkId =
      entityToNetwork.get(relation.sourceEntityId) ??
      entityToNetwork.get(relation.targetEntityId) ??
      `network-isolated-${relation.id}`;
    relationToNetwork.set(relation.id, networkId);
  }

  return {
    relationToNetwork,
    entityToNetwork,
  };
}

function collectTeachingCircuitComponentBounds(
  entities: Map<EntityId, Entity>,
  transform: CoordinateTransform,
): TeachingCircuitComponentBounds[] {
  const components: TeachingCircuitComponentBounds[] = [];

  for (const entity of entities.values()) {
    const pos = entity.transform.position;
    const width = (entity.properties.width as number) ?? (entity.properties.radius as number) ?? 0.5;
    const height = (entity.properties.height as number) ?? width;
    const cx = TEACHING_CIRCLE_COMPONENT_TYPES.has(entity.type) ? pos.x : pos.x + width / 2;
    const cy = TEACHING_CIRCLE_COMPONENT_TYPES.has(entity.type) ? pos.y : pos.y + height / 2;
    const screenCenter = worldToScreen({ x: cx, y: cy }, transform);
    components.push({
      entity,
      type: entity.type,
      cx: screenCenter.x,
      cy: screenCenter.y,
      hw: worldLengthToScreen(width, transform) / 2,
      hh: worldLengthToScreen(height, transform) / 2,
    });
  }

  return components;
}

function getSpecializedTemplateWireMode(
  entities: Map<EntityId, Entity>,
  currentTemplateFamilyId: string | null,
) {
  if (currentTemplateFamilyId === 'voltammetry') {
    for (const entity of entities.values()) {
      if (entity.type !== 'dc-source') continue;
      const circuitType = entity.properties.circuitType as string | undefined;
      if (circuitType === 'voltammetry-internal' || circuitType === 'voltammetry-external') {
        return circuitType;
      }
    }
  }

  for (const entity of entities.values()) {
    if (entity.type !== 'dc-source') continue;
    const circuitType = entity.properties.circuitType as string | undefined;
    if (
      circuitType === 'measure-emf-r' ||
      circuitType === 'voltammetry-internal' ||
      circuitType === 'voltammetry-external'
    ) return circuitType;
  }

  return null;
}

function reversePath(points: Vec2[]): Vec2[] {
  return [...points].reverse();
}

function findRelationBetween(
  relations: Relation[],
  firstId: EntityId,
  secondId: EntityId,
  topology?: string,
): { relation: Relation; reversed: boolean } | null {
  for (const relation of relations) {
    if (relation.type !== 'connection') continue;
    if (topology && relation.properties.topology !== topology) continue;

    if (relation.sourceEntityId === firstId && relation.targetEntityId === secondId) {
      return { relation, reversed: false };
    }
    if (relation.sourceEntityId === secondId && relation.targetEntityId === firstId) {
      return { relation, reversed: true };
    }
  }

  return null;
}

function resolveMeasureEmfRWireLayout(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
  transform: CoordinateTransform,
): TemplateWireLayout | null {
  const components = collectTeachingCircuitComponentBounds(entities, transform);
  const source = components.find((component) => component.type === 'dc-source');
  const sw = components.find((component) => component.type === 'switch');
  const ammeter = components.find(
    (component) => component.type === 'ammeter' || component.type === 'galvanometer',
  );
  const rheostat = components.find((component) => component.type === 'slide-rheostat');
  const voltmeter = components.find((component) => component.type === 'voltmeter');
  const loadResistor = components.find(
    (component) => component.type === 'fixed-resistor' || component.type === 'resistance-box',
  );

  if (!source || !sw || !ammeter || !rheostat || !voltmeter) {
    return null;
  }

  const mode =
    (rheostat.entity.properties.connectionMode as string | undefined) === 'divider'
      ? 'divider'
      : 'variable';

  const left = (component: TeachingCircuitComponentBounds): Vec2 => ({
    x: component.cx - component.hw - 2,
    y: component.cy,
  });
  const right = (component: TeachingCircuitComponentBounds): Vec2 => ({
    x: component.cx + component.hw + 2,
    y: component.cy,
  });
  const top = (component: TeachingCircuitComponentBounds): Vec2 => ({
    x: component.cx,
    y: component.cy - component.hh - 2,
  });

  const currentDirection = getCircuitArrowDirection(source.entity.properties.totalCurrent as number | undefined);
  const sourcePositive = { x: source.cx + source.hw + 14, y: source.cy - 18 };
  const sourceNegative = { x: source.cx - source.hw - 14, y: source.cy + 18 };
  const topRailY = Math.min(sw.cy, rheostat.cy, sourcePositive.y);
  const bottomRailY =
    Math.max(sourceNegative.y, ammeter.cy + ammeter.hh, loadResistor?.cy ?? sourceNegative.y) + 44;

  const relationPaths: StyledWirePath[] = [];
  const nodePoints: Vec2[] = [];
  const labels: TemplateWireLayout['labels'] = [];
  const polarityMarkers: TemplateWireLayout['polarityMarkers'] = [];
  const arrows: TemplateWireLayout['arrows'] = [];

  const addRelationPath = (params: {
    firstId: EntityId;
    secondId: EntityId;
    topology?: string;
    points: Vec2[];
    color: string;
    width: number;
    dashed?: boolean;
  }): void => {
    const match = findRelationBetween(relations, params.firstId, params.secondId, params.topology);
    if (!match) return;

    relationPaths.push({
      relationId: match.relation.id,
      points: match.reversed ? reversePath(params.points) : params.points,
      color: params.color,
      width: params.width,
      dashed: params.dashed,
    });
  };

  if (mode === 'variable') {
    const switchLeft = { x: left(sw).x, y: topRailY };
    const switchRight = { x: right(sw).x, y: topRailY };
    const ammeterLeft = { x: left(ammeter).x, y: topRailY };
    const ammeterRight = { x: right(ammeter).x, y: topRailY };
    const rheostatLeft = { x: left(rheostat).x, y: topRailY };
    const rheostatRight = { x: right(rheostat).x, y: topRailY };
    const negRailJoin = { x: sourceNegative.x, y: bottomRailY };
    const posRailJoin = { x: sourcePositive.x, y: topRailY };
    const meterLeft = { x: left(voltmeter).x, y: voltmeter.cy };
    const meterRight = { x: right(voltmeter).x, y: voltmeter.cy };
    const voltLeftTapX = Math.min(meterLeft.x, sourcePositive.x) - 24;
    const voltRightTapX = meterRight.x + 18;
    const voltReturnY = bottomRailY + 18;

    addRelationPath({
      firstId: source.entity.id,
      secondId: sw.entity.id,
      points: [sourcePositive, posRailJoin, switchLeft, left(sw)],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    addRelationPath({
      firstId: sw.entity.id,
      secondId: ammeter.entity.id,
      points: [right(sw), switchRight, ammeterLeft, left(ammeter)],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    addRelationPath({
      firstId: ammeter.entity.id,
      secondId: rheostat.entity.id,
      topology: 'series',
      points: [right(ammeter), ammeterRight, rheostatLeft, left(rheostat)],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    addRelationPath({
      firstId: rheostat.entity.id,
      secondId: source.entity.id,
      topology: 'return',
      points: [
        right(rheostat),
        rheostatRight,
        { x: rheostatRight.x + 22, y: topRailY },
        { x: rheostatRight.x + 22, y: bottomRailY },
        negRailJoin,
        sourceNegative,
      ],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    addRelationPath({
      firstId: source.entity.id,
      secondId: voltmeter.entity.id,
      topology: 'parallel-terminal',
      points: [
        sourcePositive,
        { x: voltLeftTapX, y: sourcePositive.y },
        { x: voltLeftTapX, y: voltmeter.cy },
        meterLeft,
      ],
      color: MEASURE_EMF_R_VOLTAGE_COLOR,
      width: 2.4,
      dashed: true,
    });
    addRelationPath({
      firstId: voltmeter.entity.id,
      secondId: source.entity.id,
      topology: 'parallel-terminal',
      points: [
        meterRight,
        { x: voltRightTapX, y: voltmeter.cy },
        { x: voltRightTapX, y: voltReturnY },
        { x: sourceNegative.x, y: voltReturnY },
        sourceNegative,
      ],
      color: MEASURE_EMF_R_VOLTAGE_COLOR,
      width: 2.4,
      dashed: true,
    });

    nodePoints.push(
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
      rheostatRight,
      right(rheostat),
      negRailJoin,
      sourceNegative,
      meterLeft,
      meterRight,
    );

    pushDirectionalWireArrow(
      arrows,
      { x: (right(sw).x + ammeterLeft.x) / 2 - 10, y: right(sw).y },
      { x: (right(sw).x + ammeterLeft.x) / 2 + 10, y: right(sw).y },
      MEASURE_EMF_R_CURRENT_COLOR,
      currentDirection,
    );
    pushDirectionalWireArrow(
      arrows,
      { x: (right(ammeter).x + rheostatLeft.x) / 2 - 10, y: right(ammeter).y },
      { x: (right(ammeter).x + rheostatLeft.x) / 2 + 10, y: right(ammeter).y },
      MEASURE_EMF_R_CURRENT_COLOR,
      currentDirection,
    );
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
    const loadLeftNode = loadResistor
      ? { x: left(loadResistor).x, y: loadResistor.cy }
      : { x: outputNode.x + 22, y: bottomRailY - 42 };
    const loadRightNode = loadResistor
      ? { x: right(loadResistor).x, y: loadResistor.cy }
      : loadLeftNode;
    const loadReturnNode = { x: loadRightNode.x + 18, y: bottomRailY };
    const meterLeft = { x: left(voltmeter).x, y: voltmeter.cy };
    const meterRight = { x: right(voltmeter).x, y: voltmeter.cy };
    const voltLeftTapX = Math.min(meterLeft.x, sourcePositive.x) - 24;
    const voltRightTapX = meterRight.x + 18;
    const voltReturnY = bottomRailY + 18;

    addRelationPath({
      firstId: source.entity.id,
      secondId: sw.entity.id,
      points: [sourcePositive, posRailJoin, { x: left(sw).x, y: topRailY }, left(sw)],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    addRelationPath({
      firstId: sw.entity.id,
      secondId: ammeter.entity.id,
      points: [right(sw), switchRight, ammeterLeft, left(ammeter)],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    addRelationPath({
      firstId: ammeter.entity.id,
      secondId: rheostat.entity.id,
      topology: 'divider-supply',
      points: [right(ammeter), ammeterRight, rheostatLeftTop, left(rheostat)],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    addRelationPath({
      firstId: rheostat.entity.id,
      secondId: source.entity.id,
      topology: 'divider-supply',
      points: [
        right(rheostat),
        rheostatRightTop,
        { x: rheostatRightTop.x + 22, y: topRailY },
        { x: rheostatRightTop.x + 22, y: bottomRailY },
        returnNode,
        sourceNegative,
      ],
      color: MEASURE_EMF_R_CURRENT_COLOR,
      width: 2.8,
    });
    if (loadResistor) {
      addRelationPath({
        firstId: rheostat.entity.id,
        secondId: loadResistor.entity.id,
        topology: 'output-branch',
        points: [outputNode, { x: outputNode.x, y: loadResistor.cy }, loadLeftNode],
        color: MEASURE_EMF_R_CURRENT_COLOR,
        width: 2.8,
      });
      addRelationPath({
        firstId: loadResistor.entity.id,
        secondId: source.entity.id,
        topology: 'output-return',
        points: [loadRightNode, { x: loadReturnNode.x, y: loadRightNode.y }, loadReturnNode, returnNode, sourceNegative],
        color: MEASURE_EMF_R_CURRENT_COLOR,
        width: 2.8,
      });
    }
    addRelationPath({
      firstId: source.entity.id,
      secondId: voltmeter.entity.id,
      topology: 'parallel-terminal',
      points: [sourcePositive, { x: voltLeftTapX, y: sourcePositive.y }, { x: voltLeftTapX, y: voltmeter.cy }, meterLeft],
      color: MEASURE_EMF_R_VOLTAGE_COLOR,
      width: 2.4,
      dashed: true,
    });
    addRelationPath({
      firstId: voltmeter.entity.id,
      secondId: source.entity.id,
      topology: 'parallel-terminal',
      points: [meterRight, { x: voltRightTapX, y: voltmeter.cy }, { x: voltRightTapX, y: voltReturnY }, { x: sourceNegative.x, y: voltReturnY }, sourceNegative],
      color: MEASURE_EMF_R_VOLTAGE_COLOR,
      width: 2.4,
      dashed: true,
    });

    nodePoints.push(
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
      right(rheostat),
      rheostatRightTop,
      meterLeft,
      meterRight,
    );

    pushDirectionalWireArrow(
      arrows,
      { x: (right(sw).x + ammeterLeft.x) / 2 - 10, y: topRailY },
      { x: (right(sw).x + ammeterLeft.x) / 2 + 10, y: topRailY },
      MEASURE_EMF_R_CURRENT_COLOR,
      currentDirection,
    );
    pushDirectionalWireArrow(
      arrows,
      { x: (right(ammeter).x + rheostatLeftTop.x) / 2 - 10, y: topRailY },
      { x: (right(ammeter).x + rheostatLeftTop.x) / 2 + 10, y: topRailY },
      MEASURE_EMF_R_CURRENT_COLOR,
      currentDirection,
    );
    if (loadResistor) {
      const loadBranchDirection = getCircuitArrowDirection(source.entity.properties.outputCurrent as number | undefined);
      pushDirectionalWireArrow(
        arrows,
        { x: outputNode.x, y: (outputNode.y + loadLeftNode.y) / 2 - 10 },
        { x: outputNode.x, y: (outputNode.y + loadLeftNode.y) / 2 + 10 },
        MEASURE_EMF_R_CURRENT_COLOR,
        loadBranchDirection,
      );
    }

    labels.push(
      {
        text: '滑片输出',
        position: { x: outputNode.x + 8, y: outputNode.y - 16 },
        color: MEASURE_EMF_R_CURRENT_COLOR,
        align: 'left',
      },
      {
        text: 'U端',
        position: { x: voltmeter.cx, y: voltmeter.cy - voltmeter.hh - 18 },
        color: MEASURE_EMF_R_VOLTAGE_COLOR,
        align: 'center',
      },
    );
  }

  polarityMarkers.push(
    {
      text: '+',
      position: { x: sourcePositive.x - 8, y: sourcePositive.y - 8 },
      color: '#C0392B',
    },
    {
      text: '−',
      position: { x: sourceNegative.x + 8, y: sourceNegative.y + 8 },
      color: '#2980B9',
    },
  );

  labels.push(
    {
      text: '电流路径',
      position: { x: rheostat.cx + 38, y: topRailY - 18 },
      color: MEASURE_EMF_R_CURRENT_COLOR,
      align: 'left',
    },
    {
      text: '电压测量路径',
      position: { x: voltmeter.cx, y: voltmeter.cy + voltmeter.hh + 18 },
      color: MEASURE_EMF_R_VOLTAGE_COLOR,
      align: 'center',
    },
  );

  return {
    relationPaths,
    nodePoints,
    hiddenRelationIds: [],
    labels,
    polarityMarkers,
    arrows,
  };
}

function resolveVoltammetryWireLayout(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
  transform: CoordinateTransform,
  circuitType: 'voltammetry-internal' | 'voltammetry-external',
): TemplateWireLayout | null {
  const components = collectTeachingCircuitComponentBounds(entities, transform);
  const source = components.find((component) => component.type === 'dc-source');
  const sw = components.find((component) => component.type === 'switch');
  const ammeter = components.find(
    (component) => component.type === 'ammeter' || component.type === 'galvanometer',
  );
  const resistor = components.find(
    (component) => component.type === 'fixed-resistor' || component.type === 'resistance-box',
  );
  const voltmeter = components.find((component) => component.type === 'voltmeter');

  if (!source || !sw || !ammeter || !resistor || !voltmeter) {
    return null;
  }

  const left = (component: TeachingCircuitComponentBounds): Vec2 => ({
    x: component.cx - component.hw - 2,
    y: component.cy,
  });
  const right = (component: TeachingCircuitComponentBounds): Vec2 => ({
    x: component.cx + component.hw + 2,
    y: component.cy,
  });
  const connectOrthogonal = (from: Vec2, to: Vec2): Vec2[] => {
    if (Math.abs(from.y - to.y) <= 3) return [from, to];
    const midX = (from.x + to.x) / 2;
    return [from, { x: midX, y: from.y }, { x: midX, y: to.y }, to];
  };

  const sourceLeft = left(source);
  const sourceRight = right(source);
  const currentDirection = getCircuitArrowDirection(source.entity.properties.totalCurrent as number | undefined);
  const switchLeft = left(sw);
  const switchRight = right(sw);
  const ammeterLeft = left(ammeter);
  const ammeterRight = right(ammeter);
  const resistorLeft = left(resistor);
  const resistorRight = right(resistor);

  const bottoms = [
    source.cy + source.hh,
    sw.cy + sw.hh,
    ammeter.cy + ammeter.hh,
    resistor.cy + resistor.hh,
    voltmeter.cy + voltmeter.hh,
  ];
  const bottomY = Math.max(...bottoms) + 48;
  const leftX = source.cx - source.hw - 18;
  const returnLaneX = resistorRight.x + Math.max(42, resistor.hw + 22);
  const meterLeft = left(voltmeter);
  const meterRight = right(voltmeter);
  const branchTopY = Math.min(voltmeter.cy, resistor.cy) - 22;
  const currentColor = '#D97706';

  const relationPaths: StyledWirePath[] = [];
  const nodePoints: Vec2[] = [];
  const labels: TemplateWireLayout['labels'] = [];
  const polarityMarkers: TemplateWireLayout['polarityMarkers'] = [];
  const arrows: TemplateWireLayout['arrows'] = [];

  const addRelationPath = (params: {
    firstId: EntityId;
    secondId: EntityId;
    topology?: string;
    points: Vec2[];
  }): void => {
    const match = findRelationBetween(relations, params.firstId, params.secondId, params.topology);
    if (!match) return;
    relationPaths.push({
      relationId: match.relation.id,
      points: match.reversed ? reversePath(params.points) : params.points,
      color: '#555',
      width: 2,
    });
  };

  addRelationPath({
    firstId: source.entity.id,
    secondId: sw.entity.id,
    points: connectOrthogonal(sourceRight, switchLeft),
  });
  addRelationPath({
    firstId: sw.entity.id,
    secondId: ammeter.entity.id,
    points: connectOrthogonal(switchRight, ammeterLeft),
  });
  addRelationPath({
    firstId: ammeter.entity.id,
    secondId: resistor.entity.id,
    topology: circuitType === 'voltammetry-external' ? 'external' : 'series',
    points: connectOrthogonal(ammeterRight, resistorLeft),
  });
  addRelationPath({
    firstId: resistor.entity.id,
    secondId: source.entity.id,
    topology: 'return',
    points: [
      resistorRight,
      { x: returnLaneX, y: resistorRight.y },
      { x: returnLaneX, y: bottomY },
      { x: leftX, y: bottomY },
      { x: leftX, y: source.cy },
      sourceLeft,
    ],
  });

  const leftParallelRelation = findRelationBetween(
    relations,
    ammeter.entity.id,
    voltmeter.entity.id,
    'parallel',
  );
  if (leftParallelRelation) {
    relationPaths.push({
      relationId: leftParallelRelation.relation.id,
      points: leftParallelRelation.reversed
        ? reversePath([
            resistorLeft,
            { x: resistorLeft.x, y: branchTopY },
            { x: meterLeft.x, y: branchTopY },
            meterLeft,
          ])
        : [
            resistorLeft,
            { x: resistorLeft.x, y: branchTopY },
            { x: meterLeft.x, y: branchTopY },
            meterLeft,
          ],
      color: '#555',
      width: 2,
    });
  }

  const rightParallelRelation = findRelationBetween(
    relations,
    voltmeter.entity.id,
    resistor.entity.id,
    'parallel',
  );
  if (rightParallelRelation) {
    relationPaths.push({
      relationId: rightParallelRelation.relation.id,
      points: rightParallelRelation.reversed
        ? reversePath([
            meterRight,
            { x: meterRight.x, y: branchTopY },
            { x: resistorRight.x, y: branchTopY },
            resistorRight,
          ])
        : [
            meterRight,
            { x: meterRight.x, y: branchTopY },
            { x: resistorRight.x, y: branchTopY },
            resistorRight,
          ],
      color: '#555',
      width: 2,
    });
  }

  nodePoints.push(resistorLeft, resistorRight);
  pushDirectionalWireArrow(
    arrows,
    { x: (switchRight.x + ammeterLeft.x) / 2 - 10, y: switchRight.y },
    { x: (switchRight.x + ammeterLeft.x) / 2 + 10, y: switchRight.y },
    currentColor,
    currentDirection,
  );
  pushDirectionalWireArrow(
    arrows,
    { x: (ammeterRight.x + resistorLeft.x) / 2 - 10, y: ammeterRight.y },
    { x: (ammeterRight.x + resistorLeft.x) / 2 + 10, y: ammeterRight.y },
    currentColor,
    currentDirection,
  );
  pushDirectionalWireArrow(
    arrows,
    { x: (leftX + returnLaneX) / 2 + 10, y: bottomY },
    { x: (leftX + returnLaneX) / 2 - 10, y: bottomY },
    currentColor,
    currentDirection,
  );
  polarityMarkers.push(
    {
      text: '+',
      position: { x: sourceRight.x + 12, y: source.cy - source.hh - 14 },
      color: '#C0392B',
    },
    {
      text: '−',
      position: { x: sourceLeft.x - 12, y: source.cy - source.hh - 14 },
      color: '#2980B9',
    },
  );
  labels.push({
    text: circuitType === 'voltammetry-internal' ? '电流方向（内接）' : '电流方向（外接）',
    position: { x: (switchRight.x + resistorLeft.x) / 2, y: Math.min(sw.cy, ammeter.cy) - 20 },
    color: currentColor,
    align: 'center',
  });

  return {
    relationPaths,
    nodePoints,
    hiddenRelationIds: [],
    labels,
    polarityMarkers,
    arrows,
  };
}

function buildLaneCandidates(
  start: Vec2,
  end: Vec2,
  boxes: EntityScreenBox[],
  occupiedSegments: WireSegment[],
  spacing: number,
  axis: 'x' | 'y',
): number[] {
  const startValue = axis === 'x' ? start.x : start.y;
  const endValue = axis === 'x' ? end.x : end.y;
  const minBoxEdge = boxes.length > 0
    ? Math.min(...boxes.map((box) => axis === 'x' ? box.left : box.top))
    : Math.min(startValue, endValue);
  const maxBoxEdge = boxes.length > 0
    ? Math.max(...boxes.map((box) => axis === 'x' ? box.right : box.bottom))
    : Math.max(startValue, endValue);

  const raw = [
    (startValue + endValue) / 2,
    startValue - spacing,
    startValue + spacing,
    endValue - spacing,
    endValue + spacing,
    minBoxEdge - spacing,
    minBoxEdge - spacing * 2,
    minBoxEdge - spacing * 3,
    maxBoxEdge + spacing,
    maxBoxEdge + spacing * 2,
    maxBoxEdge + spacing * 3,
  ];

  for (const box of boxes) {
    if (axis === 'x') {
      raw.push(
        box.left - spacing,
        box.left - spacing * 2,
        box.right + spacing,
        box.right + spacing * 2,
      );
    } else {
      raw.push(
        box.top - spacing,
        box.top - spacing * 2,
        box.bottom + spacing,
        box.bottom + spacing * 2,
      );
    }
  }

  for (const segment of occupiedSegments) {
    const bounds = getSegmentBounds(segment);
    if (axis === 'x') {
      raw.push(bounds.left - spacing, bounds.right + spacing);
      if (segment.orientation === 'vertical') {
        raw.push(
          segment.a.x - spacing,
          segment.a.x + spacing,
          segment.a.x - WIRE_SOFT_CLEARANCE,
          segment.a.x + WIRE_SOFT_CLEARANCE,
        );
      }
    } else {
      raw.push(bounds.top - spacing, bounds.bottom + spacing);
      if (segment.orientation === 'horizontal') {
        raw.push(
          segment.a.y - spacing,
          segment.a.y + spacing,
          segment.a.y - WIRE_SOFT_CLEARANCE,
          segment.a.y + WIRE_SOFT_CLEARANCE,
        );
      }
    }
  }

  return uniqueNumbers(raw).sort((left, right) =>
    Math.abs(left - startValue) + Math.abs(left - endValue) -
    (Math.abs(right - startValue) + Math.abs(right - endValue)),
  );
}

function buildRoutePenalty(
  path: Vec2[],
  blockedBoxes: EntityScreenBox[],
  softBoxes: EntityScreenBox[],
  occupiedSegments: WireSegment[],
): number {
  let penalty = 0;
  const segments = buildWireSegments(path);

  for (const segment of segments) {
    let intersectsBlockedBox = false;
    for (const box of blockedBoxes) {
      if (segmentIntersectsBox(segment, box)) {
        penalty += WIRE_ROUTE_PENALTY_BLOCKED;
        intersectsBlockedBox = true;
      }
    }

    if (!intersectsBlockedBox) {
      for (const box of softBoxes) {
        if (segmentIntersectsBox(segment, box)) {
          penalty += WIRE_ROUTE_PENALTY_BOX_NEAR;
        }
      }
    }

    const segmentBounds = getSegmentBounds(segment);
    for (const occupied of occupiedSegments) {
      const occupiedBounds = getSegmentBounds(occupied);
      const conflictType = classifySegmentConflict(segment, occupied);
      if (conflictType === 'overlap') {
        penalty += WIRE_ROUTE_PENALTY_OVERLAP;
        continue;
      }
      if (conflictType === 'cross') {
        penalty += WIRE_ROUTE_PENALTY_CROSS;
        continue;
      }
      if (conflictType === 'tap') {
        penalty += WIRE_ROUTE_PENALTY_TAP;
        continue;
      }

      if (segment.orientation === occupied.orientation) {
        if (segment.orientation === 'horizontal') {
          const overlap = rangesOverlap(segmentBounds.left, segmentBounds.right, occupiedBounds.left, occupiedBounds.right);
          const distance = Math.abs(segment.a.y - occupied.a.y);
          if (overlap > 0) {
            if (distance < WIRE_SOFT_CLEARANCE) {
              penalty += WIRE_ROUTE_PENALTY_NEAR +
                (WIRE_SOFT_CLEARANCE - distance) * 180 +
                Math.min(overlap, 120) * 16;
            }
          }
        } else {
          const overlap = rangesOverlap(segmentBounds.top, segmentBounds.bottom, occupiedBounds.top, occupiedBounds.bottom);
          const distance = Math.abs(segment.a.x - occupied.a.x);
          if (overlap > 0) {
            if (distance < WIRE_SOFT_CLEARANCE) {
              penalty += WIRE_ROUTE_PENALTY_NEAR +
                (WIRE_SOFT_CLEARANCE - distance) * 180 +
                Math.min(overlap, 120) * 16;
            }
          }
        }
      }
    }
  }

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]!;
    for (let compareIndex = index + 1; compareIndex < segments.length; compareIndex += 1) {
      if (Math.abs(compareIndex - index) <= 1) continue;

      const compare = segments[compareIndex]!;
      const conflictType = classifySegmentConflict(segment, compare);
      if (conflictType === 'overlap' || conflictType === 'cross' || conflictType === 'tap') {
        penalty += WIRE_ROUTE_PENALTY_SELF_INTERSECTION;
      }
    }
  }

  penalty += countInternalBends(path) * 44;
  penalty += getPathLength(path) * 0.05;
  return penalty;
}

function buildManhattanInternalCandidates(
  startExit: Vec2,
  endExit: Vec2,
  blockedBoxes: EntityScreenBox[],
  occupiedSegments: WireSegment[],
  spacing: number,
): Vec2[][] {
  const xLanes = buildLaneCandidates(
    startExit,
    endExit,
    blockedBoxes,
    occupiedSegments,
    spacing,
    'x',
  ).slice(0, WIRE_LANE_CANDIDATE_LIMIT);
  const yLanes = buildLaneCandidates(
    startExit,
    endExit,
    blockedBoxes,
    occupiedSegments,
    spacing,
    'y',
  ).slice(0, WIRE_LANE_CANDIDATE_LIMIT);
  const candidates: Vec2[][] = [
    [startExit, { x: startExit.x, y: endExit.y }, endExit],
    [startExit, { x: endExit.x, y: startExit.y }, endExit],
  ];

  if (Math.abs(startExit.x - endExit.x) < 0.5 || Math.abs(startExit.y - endExit.y) < 0.5) {
    candidates.unshift([startExit, endExit]);
  }

  for (const laneY of yLanes) {
    candidates.push([
      startExit,
      { x: startExit.x, y: laneY },
      { x: endExit.x, y: laneY },
      endExit,
    ]);
  }

  for (const laneX of xLanes) {
    candidates.push([
      startExit,
      { x: laneX, y: startExit.y },
      { x: laneX, y: endExit.y },
      endExit,
    ]);
  }

  for (const laneX of xLanes) {
    for (const laneY of yLanes) {
      candidates.push([
        startExit,
        { x: laneX, y: startExit.y },
        { x: laneX, y: laneY },
        { x: endExit.x, y: laneY },
        endExit,
      ]);
      candidates.push([
        startExit,
        { x: startExit.x, y: laneY },
        { x: laneX, y: laneY },
        { x: laneX, y: endExit.y },
        endExit,
      ]);
    }
  }

  const unique = new Map<string, Vec2[]>();
  for (const candidate of candidates) {
    const simplified = simplifyOrthogonalPath(candidate);
    if (!isOrthogonalPath(simplified)) continue;
    if (countInternalBends(simplified) > 4) continue;
    const key = simplified.map((point) => `${Math.round(point.x)}:${Math.round(point.y)}`).join('|');
    if (!unique.has(key)) unique.set(key, simplified);
  }

  return Array.from(unique.values());
}

function resolveGenericRoutePath(
  sourcePort: Port,
  targetPort: Port,
  transform: CoordinateTransform,
  entityBoxes: EntityScreenBox[],
  occupiedSegments: WireSegment[],
): Vec2[] {
  const sourceScreen = worldToScreen(sourcePort.world, transform);
  const targetScreen = worldToScreen(targetPort.world, transform);
  const margin = Math.max(WIRE_EXIT_MARGIN, WIRE_MARGIN * transform.scale);
  const startExit = offsetPoint(sourceScreen, screenDir(sourcePort.side), margin);
  const endExit = offsetPoint(targetScreen, screenDir(targetPort.side), margin);
  const relevantBoxes = entityBoxes
    .filter((box) => box.entityId !== sourcePort.entityId && box.entityId !== targetPort.entityId);
  const blockedBoxes = relevantBoxes.map((box) => inflateScreenBox(box, WIRE_CLEARANCE));
  const softBoxes = relevantBoxes.map((box) => inflateScreenBox(box, WIRE_SOFT_CLEARANCE));

  let bestPath: Vec2[] | null = null;
  let bestPenalty = Number.POSITIVE_INFINITY;

  for (const internalCandidate of buildManhattanInternalCandidates(
    startExit,
    endExit,
    blockedBoxes,
    occupiedSegments,
    WIRE_CLEARANCE,
  )) {
    const fullPath = simplifyOrthogonalPath([sourceScreen, ...internalCandidate, targetScreen]);
    if (!isOrthogonalPath(fullPath)) continue;
    const penalty = buildRoutePenalty(fullPath, blockedBoxes, softBoxes, occupiedSegments);
    if (penalty < bestPenalty) {
      bestPenalty = penalty;
      bestPath = fullPath;
    }
  }

  if (bestPath) return bestPath;

  return routeWire(
    { screen: sourceScreen, side: sourcePort.side },
    { screen: targetScreen, side: targetPort.side },
    margin,
  );
}

function convertTemplateLayoutToRoutes(
  layout: TemplateWireLayout,
  relations: Relation[],
  relationToNetwork: Map<string, string>,
): ResolvedWireRoute[] {
  const relationsById = new Map(relations.map((relation) => [relation.id, relation]));
  const routes: ResolvedWireRoute[] = [];

  for (const relationPath of layout.relationPaths) {
    const relation = relationsById.get(relationPath.relationId);
    if (!relation) continue;
    routes.push({
      relationId: relation.id,
      sourceEntityId: relation.sourceEntityId,
      targetEntityId: relation.targetEntityId,
      points: relationPath.points,
      networkId: relationToNetwork.get(relation.id) ?? `network-isolated-${relation.id}`,
      color: relationPath.color,
      width: relationPath.width,
      dashed: relationPath.dashed,
      isSpecialized: true,
    });
  }

  return routes;
}

function resolveGenericWireRoutes(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
  transform: CoordinateTransform,
  occupiedSegments: WireSegment[],
  relationToNetwork: Map<string, string>,
): ResolvedWireRoute[] {
  const routes: ResolvedWireRoute[] = [];
  const entityBoxes = collectEntityScreenBoxes(entities, transform);

  for (const relation of relations) {
    if (relation.type !== 'connection') continue;
    const sourceEntity = entities.get(relation.sourceEntityId);
    const targetEntity = entities.get(relation.targetEntityId);
    if (!sourceEntity || !targetEntity) continue;

    const sourceSide = (relation.properties.sourcePort as PortSide | undefined) ?? 'right';
    const targetSide = (relation.properties.targetPort as PortSide | undefined) ?? 'left';
    const sourcePort = findPortBySide(sourceEntity, sourceSide);
    const targetPort = findPortBySide(targetEntity, targetSide);
    if (!sourcePort || !targetPort) continue;

    const points = resolveGenericRoutePath(
      sourcePort,
      targetPort,
      transform,
      entityBoxes,
      occupiedSegments,
    );

    routes.push({
      relationId: relation.id,
      sourceEntityId: relation.sourceEntityId,
      targetEntityId: relation.targetEntityId,
      points,
      networkId: relationToNetwork.get(relation.id) ?? `network-isolated-${relation.id}`,
      color: GENERIC_WIRE_COLOR,
      width: 2,
      isSpecialized: false,
    });

    occupiedSegments.push(...buildWireSegments(points));
  }

  return routes;
}

function collectWireNodePoints(
  routes: ResolvedWireRoute[],
  layoutNodePoints: Vec2[],
): Array<{ point: Vec2; networkId: string }> {
  const nodes: Array<{ point: Vec2; networkId: string }> = [];
  const seen = new Set<string>();

  for (const route of routes) {
    const endpointPoints = [route.points[0], route.points[route.points.length - 1]].filter(Boolean) as Vec2[];
    for (const point of endpointPoints) {
      const key = `${route.networkId}:${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      nodes.push({ point, networkId: route.networkId });
    }
  }

  for (const route of routes) {
    for (const point of layoutNodePoints) {
      const key = `${route.networkId}:${Math.round(point.x)}:${Math.round(point.y)}`;
      if (seen.has(key)) continue;
      if (!route.points.some((routePoint) => samePoint(routePoint, point, 1))) continue;
      seen.add(key);
      nodes.push({ point, networkId: route.networkId });
    }
  }

  return nodes;
}

function resolveWireGraph(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
  transform: CoordinateTransform,
  currentTemplateFamilyId: string | null,
): ResolvedWireGraph {
  const connectionRelations = relations.filter((relation) => relation.type === 'connection');
  const { relationToNetwork, entityToNetwork } = createRelationNetworkMaps(entities, connectionRelations);
  const specializedLayout = resolveSpecializedTemplateWireLayout(
    entities,
    connectionRelations,
    transform,
    currentTemplateFamilyId,
  );
  const specializedRoutes = specializedLayout
    ? convertTemplateLayoutToRoutes(specializedLayout, connectionRelations, relationToNetwork)
    : [];
  const specializedRelationIds = new Set([
    ...specializedRoutes.map((route) => route.relationId),
    ...(specializedLayout?.hiddenRelationIds ?? []),
  ]);
  const occupiedSegments = specializedRoutes.flatMap((route) => buildWireSegments(route.points));
  const genericRoutes = resolveGenericWireRoutes(
    entities,
    connectionRelations.filter((relation) => !specializedRelationIds.has(relation.id)),
    transform,
    occupiedSegments,
    relationToNetwork,
  );
  const routes = [...specializedRoutes, ...genericRoutes];
  const nodePoints = collectWireNodePoints(routes, specializedLayout?.nodePoints ?? []);

  return {
    routes,
    nodePoints,
    relationToNetwork,
    entityToNetwork,
    labels: specializedLayout?.labels ?? [],
    polarityMarkers: specializedLayout?.polarityMarkers ?? [],
    arrows: specializedLayout?.arrows ?? [],
  };
}

function hitTestResolvedRoutes(
  pixel: Vec2,
  routes: ResolvedWireRoute[],
  threshold = 6,
): string | null {
  for (const route of routes) {
    for (const segment of buildWireSegments(route.points)) {
      if (distToSeg(pixel, segment.a, segment.b) < threshold) {
        return route.relationId;
      }
    }
  }
  return null;
}

function resolveSpecializedTemplateWireLayout(
  entities: Map<EntityId, Entity>,
  relations: Relation[],
  transform: CoordinateTransform,
  currentTemplateFamilyId: string | null,
): TemplateWireLayout | null {
  const mode = getSpecializedTemplateWireMode(entities, currentTemplateFamilyId);
  if (mode === 'measure-emf-r') {
    return resolveMeasureEmfRWireLayout(entities, relations, transform);
  }
  if (mode === 'voltammetry-internal' || mode === 'voltammetry-external') {
    return resolveVoltammetryWireLayout(entities, relations, transform, mode);
  }
  return null;
}

function renderWireOverlays(
  ctx: CanvasRenderingContext2D,
  overlays: Pick<ResolvedWireGraph, 'labels' | 'polarityMarkers' | 'arrows'>,
): void {
  for (const arrow of overlays.arrows) {
    drawArrow(ctx, arrow.from, arrow.to, {
      color: arrow.color,
      lineWidth: 2.2,
      arrowHeadSize: 7,
    });
  }

  for (const marker of overlays.polarityMarkers) {
    drawTextLabel(ctx, marker.text, marker.position, {
      color: marker.color,
      fontSize: 12,
      align: 'center',
      baseline: 'middle',
      backgroundColor: 'rgba(255,255,255,0.9)',
      padding: 2,
    });
  }

  for (const label of overlays.labels) {
    drawTextLabel(ctx, label.text, label.position, {
      color: label.color,
      fontSize: 11,
      align: label.align ?? 'center',
      baseline: 'middle',
      backgroundColor: 'rgba(255,255,255,0.9)',
      padding: 3,
    });
  }
}

function renderResolvedWireGraph(
  ctx: CanvasRenderingContext2D,
  graph: ResolvedWireGraph,
): void {
  for (const route of graph.routes) {
    ctx.save();
    ctx.strokeStyle = route.color;
    ctx.lineWidth = route.width;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (route.dashed) {
      ctx.setLineDash([8, 4]);
    }
    drawPath(ctx, route.points);
    ctx.restore();
  }

  for (const node of graph.nodePoints) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(node.point.x, node.point.y, 3.6, 0, Math.PI * 2);
    ctx.fillStyle = '#111827';
    ctx.fill();
    ctx.restore();
  }

  renderWireOverlays(ctx, graph);
}

// ═══════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════

export function BuilderCanvas({
  workspaceId,
  entryMode = 'template',
  showTemplateLibraryInFree = false,
  advancedEditEnabled = false,
  isRealistic = false,
  onToggleRealistic,
}: BuilderCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderLoopRef = useRef<ReturnType<typeof createRenderLoop> | null>(null);
  const isRealisticRef = useRef(isRealistic);
  isRealisticRef.current = isRealistic;

  const mousePosRef = useRef<Vec2 | null>(null);
  const wiringRef = useRef<{ fromPort: Port; currentMouse: Vec2 } | null>(null);
  const movingRef = useRef<{ entityId: string; offsetX: number; offsetY: number } | null>(null);
  const panningRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const sliderDragRef = useRef<{ entityId: string; leftX: number; width: number } | null>(null);
  const clickStartRef = useRef<{ entityId: string; x: number; y: number } | null>(null);
  const [, forceUpdate] = useState(0);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entityId: string } | null>(null);
  const [dialTarget, setDialTarget] = useState<{ entityId: string; screenX: number; screenY: number } | null>(null);
  const [paramPopup, setParamPopup] = useState<{ entityId: string; x: number; y: number } | null>(null);
  const activeWorkspaceId = useBuilderStore((state) => state.activeWorkspaceId);
  const selectWorkspace = useBuilderStore((state) => state.selectWorkspace);
  const currentTemplateFamilyId = useBuilderWorkspace(
    workspaceId,
    (state) => state.currentTemplateFamilyId,
  );
  const currentTemplateVariantId = useBuilderWorkspace(
    workspaceId,
    (state) => state.currentTemplateVariantId,
  );
  const isActiveWorkspace = activeWorkspaceId === workspaceId;
  const canInsertClipboard = entryMode === 'free' || advancedEditEnabled;
  const activateWorkspace = useCallback(() => {
    if (useBuilderStore.getState().activeWorkspaceId !== workspaceId) {
      selectWorkspace(workspaceId);
    }
  }, [selectWorkspace, workspaceId]);

  const recenterCanvasToEntities = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const store = useBuilderStore.getState();
    const workspace = getBuilderWorkspaceSnapshot(workspaceId, store);
    const origin = computeCenteredOrigin({
      entities: workspace.entities.values(),
      scale: workspace.canvasTransform.scale,
      canvasWidth: canvas.width / dpr,
      canvasHeight: canvas.height / dpr,
    });

    store.setCanvasTransform({
      scale: workspace.canvasTransform.scale,
      origin,
    }, workspaceId);
  }, [workspaceId]);

  const setupCanvas = useCallback(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    recenterCanvasToEntities();

    renderLoopRef.current?.stop();

    const loop = createRenderLoop({
      canvas,
      getEntities: () => getBuilderWorkspaceSnapshot(workspaceId).entities,
      getResult: () => getBuilderWorkspaceSnapshot(workspaceId).currentResult,
      getViewport: () => ({
        primary: 'circuit' as const,
        overlays: [] as const,
        density: (isRealisticRef.current ? 'detailed' : 'standard') as 'standard' | 'detailed',
      }),
      getSelectedEntityId: () => getBuilderWorkspaceSnapshot(workspaceId).selectedEntityId,
      getCoordinateTransform: () => getBuilderWorkspaceSnapshot(workspaceId).canvasTransform,
      getRelations: () => getBuilderWorkspaceSnapshot(workspaceId).relations,
      onRenderWires: (c, ents, rels, tf) => {
        const workspace = getBuilderWorkspaceSnapshot(workspaceId);
        renderWires(c, ents, rels, tf, workspace.currentTemplateFamilyId, workspace.interaction);
        renderTemplateSlotBadges(
          c,
          ents,
          tf,
          workspace.currentTemplateFamilyId,
          workspace.currentTemplateVariantId,
        );
        renderPorts(c, ents, tf, mousePosRef.current, wiringRef.current, advancedEditEnabled);
      },
    });

    renderLoopRef.current = loop;
    loop.start();
  }, [advancedEditEnabled, recenterCanvasToEntities, workspaceId]);

  useEffect(() => {
    setupCanvas();
    const observer = new ResizeObserver(setupCanvas);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { observer.disconnect(); renderLoopRef.current?.stop(); };
  }, [setupCanvas]);

  useEffect(() => {
    if (!currentTemplateFamilyId || !currentTemplateVariantId) return;
    const frameId = requestAnimationFrame(() => {
      recenterCanvasToEntities();
    });
    return () => cancelAnimationFrame(frameId);
  }, [currentTemplateFamilyId, currentTemplateVariantId, recenterCanvasToEntities]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isActiveWorkspace) return;
      if (event.repeat || event.altKey || isEditableKeyboardTarget(event.target)) {
        return;
      }
      if (!event.metaKey && !event.ctrlKey) return;

      const key = event.key.toLowerCase();
      const store = useBuilderStore.getState();
      const workspace = getBuilderWorkspaceSnapshot(workspaceId, store);

      if (key === 'c') {
        const hasSelectedEntity =
          Boolean(workspace.selectedEntityId) &&
          workspace.selectedEntityId != null &&
          workspace.entities.has(workspace.selectedEntityId);
        const copied = hasSelectedEntity
          ? store.copySelectedEntity(workspaceId)
          : store.copyScene(workspaceId);
        if (copied) {
          event.preventDefault();
        }
        return;
      }

      if (key === 'v') {
        if (!canInsertClipboard) return;
        const pasted = store.pasteClipboard(workspaceId);
        if (pasted) {
          event.preventDefault();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canInsertClipboard, isActiveWorkspace, workspaceId]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (!advancedEditEnabled) return;
    activateWorkspace();
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }, [activateWorkspace, advancedEditEnabled]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    if (!advancedEditEnabled) return;
    activateWorkspace();
    e.preventDefault();
  }, [activateWorkspace, advancedEditEnabled]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!advancedEditEnabled) return;
    activateWorkspace();
    e.preventDefault();
    const entityType = e.dataTransfer.getData('entityType');
    if (!entityType) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const store = useBuilderStore.getState();
    const tf = getBuilderWorkspaceSnapshot(workspaceId, store).canvasTransform;
    const wp = screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, tf);
    const id = store.addEntity(entityType, wp, workspaceId);
    if (id) store.selectEntity(id, workspaceId);
  }, [activateWorkspace, advancedEditEnabled, workspaceId]);

  const getPixel = useCallback((e: React.MouseEvent): Vec2 => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    activateWorkspace();
    // 关闭已打开的弹窗
    setContextMenu(null);
    setParamPopup(null);

    // 中键 → 拖动画布
    if (e.button === 1) {
      e.preventDefault();
      panningRef.current = { lastX: e.clientX, lastY: e.clientY };
      return;
    }

    // 右键 → 由 onContextMenu 处理
    if (e.button === 2) return;

    if (e.button !== 0) return;
    const pixel = getPixel(e);
    const store = useBuilderStore.getState();
    const workspace = getBuilderWorkspaceSnapshot(workspaceId, store);
    const tf = workspace.canvasTransform;

    // 0. 滑动变阻器滑片拖拽检测（优先于连接点）
    for (const ent of workspace.entities.values()) {
      if (ent.type !== 'slide-rheostat') continue;
      const pos = ent.transform.position;
      const w = (ent.properties.width as number) ?? 1.0;
      const h = (ent.properties.height as number) ?? 0.5;
      const ratio = (ent.properties.sliderRatio as number) ?? 0.5;

      const leftScreen = worldToScreen(pos, tf);
      const screenW = w * tf.scale;
      const screenH = h * tf.scale;
      // 滑片在渲染中的位置：screenTopLeft.x + screenW * ratio, 在电阻体下方
      const topLeftY = leftScreen.y - screenH; // worldToScreen Y 翻转
      const sliderScreenX = leftScreen.x + screenW * ratio;
      const sliderScreenY = topLeftY + screenH + 12; // 箭头中心大致位置

      if (Math.abs(pixel.x - sliderScreenX) < 14 && Math.abs(pixel.y - sliderScreenY) < 20) {
        sliderDragRef.current = { entityId: ent.id, leftX: leftScreen.x, width: screenW };
        store.selectEntity(ent.id, workspaceId);
        return;
      }
    }

    // 1. 实体命中检测（优先于连接点，确保单击元件能触发交互）
    const wp = screenToWorld(pixel, tf);
    let hitId: string | null = null;
    for (const ent of workspace.entities.values()) {
      const reg = entityRegistry.get(ent.type);
      if (reg?.hitTest(ent, wp, tf)) { hitId = ent.id; break; }
    }

    if (hitId) {
      const ent = workspace.entities.get(hitId)!;
      store.selectEntity(hitId, workspaceId);
      clickStartRef.current = { entityId: hitId, x: pixel.x, y: pixel.y };
      if (advancedEditEnabled) {
        movingRef.current = {
          entityId: hitId,
          offsetX: wp.x - ent.transform.position.x,
          offsetY: wp.y - ent.transform.position.y,
        };
      }
      return;
    }

    // 2. 连接点命中 → 开始连线（只在未命中元件时检测）
    if (advancedEditEnabled) {
      const port = findNearestPort(pixel, workspace.entities, tf);
      if (port) {
        wiringRef.current = { fromPort: port, currentMouse: pixel };
        store.selectEntity(port.entityId, workspaceId);
        forceUpdate((n) => n + 1);
        return;
      }
    }

    // 3. 导线命中 → 删除
    if (advancedEditEnabled) {
      const relId = hitTestWire(
        pixel,
        workspace.entities,
        workspace.relations,
        tf,
        workspace.currentTemplateFamilyId,
      );
      if (relId) { store.removeConnection(relId, workspaceId); return; }
    }

    // 4. 空白区域左键 → 拖动画布
    panningRef.current = { lastX: e.clientX, lastY: e.clientY };
    store.selectEntity(null, workspaceId);
  }, [activateWorkspace, advancedEditEnabled, getPixel, workspaceId]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pixel = getPixel(e);
    mousePosRef.current = pixel;

    // 滑片拖拽
    if (sliderDragRef.current) {
      const { entityId, leftX, width } = sliderDragRef.current;
      const newRatio = Math.max(0, Math.min(1, (pixel.x - leftX) / width));
      useBuilderStore
        .getState()
        .updateEntityProperty(entityId, 'sliderRatio', Math.round(newRatio * 100) / 100, workspaceId);
      return;
    }

    // 画布平移
    if (panningRef.current) {
      const dx = e.clientX - panningRef.current.lastX;
      const dy = e.clientY - panningRef.current.lastY;
      panningRef.current = { lastX: e.clientX, lastY: e.clientY };
      const store = useBuilderStore.getState();
      const tf = getBuilderWorkspaceSnapshot(workspaceId, store).canvasTransform;
      store.setCanvasTransform({
        scale: tf.scale,
        origin: { x: tf.origin.x + dx, y: tf.origin.y + dy },
      }, workspaceId);
      return;
    }

    if (wiringRef.current) {
      wiringRef.current.currentMouse = pixel;
      const store = useBuilderStore.getState();
      const tf = getBuilderWorkspaceSnapshot(workspaceId, store).canvasTransform;
      store.setInteraction({
        type: 'wiring',
        fromEntityId: wiringRef.current.fromPort.entityId,
        fromPortSide: wiringRef.current.fromPort.side,
        mousePos: screenToWorld(pixel, tf),
      }, workspaceId);
      return;
    }

    if (movingRef.current) {
      const store = useBuilderStore.getState();
      const tf = getBuilderWorkspaceSnapshot(workspaceId, store).canvasTransform;
      const wp = screenToWorld(pixel, tf);
      store.moveEntity(movingRef.current.entityId, {
        x: wp.x - movingRef.current.offsetX,
        y: wp.y - movingRef.current.offsetY,
      }, workspaceId);
    }
  }, [getPixel, workspaceId]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (sliderDragRef.current) {
      sliderDragRef.current = null;
      return;
    }

    if (panningRef.current) {
      panningRef.current = null;
      return;
    }

    if (wiringRef.current) {
      const pixel = getPixel(e);
      const store = useBuilderStore.getState();
      const workspace = getBuilderWorkspaceSnapshot(workspaceId, store);
      const tf = workspace.canvasTransform;
      const targetPort = findNearestPort(
        pixel,
        workspace.entities,
        tf,
        wiringRef.current.fromPort.entityId,
      );
      if (targetPort) {
        store.addConnection(
          wiringRef.current.fromPort.entityId,
          targetPort.entityId,
          wiringRef.current.fromPort.side,
          targetPort.side,
          workspaceId,
        );
      }
      wiringRef.current = null;
      store.setInteraction({ type: 'idle' }, workspaceId);
      forceUpdate((n) => n + 1);
      return;
    }
    // 单击检测：鼠标没移动 → 特殊交互或弹出参数面板
    if (movingRef.current && clickStartRef.current) {
      const pixel = getPixel(e);
      const dist = Math.hypot(pixel.x - clickStartRef.current.x, pixel.y - clickStartRef.current.y);
      if (dist < 5) {
        const store = useBuilderStore.getState();
        const ent = getBuilderWorkspaceSnapshot(workspaceId, store).entities.get(
          clickStartRef.current.entityId,
        );
        if (ent?.type === 'switch') {
          const closed = (ent.properties.closed as boolean) ?? true;
          store.updateEntityProperty(ent.id, 'closed', !closed, workspaceId);
        } else if (ent?.type === 'resistance-box') {
          setDialTarget({ entityId: ent.id, screenX: e.clientX, screenY: e.clientY });
        } else if (ent) {
          // 其他元件：弹出参数调节小窗口
          setParamPopup({ entityId: ent.id, x: e.clientX, y: e.clientY });
        }
      }
    }
    movingRef.current = null;
    clickStartRef.current = null;
  }, [getPixel, workspaceId]);

  // 滚轮缩放（以鼠标位置为中心）
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    activateWorkspace();
    e.preventDefault();
    const store = useBuilderStore.getState();
    const tf = getBuilderWorkspaceSnapshot(workspaceId, store).canvasTransform;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    const newScale = Math.max(30, Math.min(400, tf.scale * factor));
    const ratio = newScale / tf.scale;

    // 以鼠标位置为中心缩放
    store.setCanvasTransform({
      scale: newScale,
      origin: {
        x: mouseX - (mouseX - tf.origin.x) * ratio,
        y: mouseY - (mouseY - tf.origin.y) * ratio,
      },
    }, workspaceId);
  }, [activateWorkspace, workspaceId]);

  const zoom = useCallback((factor: number) => {
    const store = useBuilderStore.getState();
    const tf = getBuilderWorkspaceSnapshot(workspaceId, store).canvasTransform;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // 以画布中心为缩放中心
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const newScale = Math.max(30, Math.min(400, tf.scale * factor));
    const ratio = newScale / tf.scale;

    store.setCanvasTransform({
      scale: newScale,
      origin: {
        x: cx - (cx - tf.origin.x) * ratio,
        y: cy - (cy - tf.origin.y) * ratio,
      },
    }, workspaceId);
  }, [workspaceId]);

  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!advancedEditEnabled) return;
    activateWorkspace();
    const pixel = getPixel(e);
    const store = useBuilderStore.getState();
    const workspace = getBuilderWorkspaceSnapshot(workspaceId, store);
    const tf = workspace.canvasTransform;
    const wp = screenToWorld(pixel, tf);

    let hitId: string | null = null;
    for (const ent of workspace.entities.values()) {
      const reg = entityRegistry.get(ent.type);
      if (reg?.hitTest(ent, wp, tf)) { hitId = ent.id; break; }
    }

    if (hitId) {
      store.selectEntity(hitId, workspaceId);
      setContextMenu({ x: e.clientX, y: e.clientY, entityId: hitId });
    }
  }, [activateWorkspace, advancedEditEnabled, getPixel, workspaceId]);

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-0 flex-1 overflow-hidden"
      style={{ backgroundColor: '#FAFAFA' }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onWheel={handleWheel}
    >
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{
          cursor: sliderDragRef.current
            ? 'ew-resize'
            : panningRef.current
              ? 'grabbing'
              : wiringRef.current
                ? 'crosshair'
                : advancedEditEnabled
                  ? 'default'
                  : 'default',
        }}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { mousePosRef.current = null; }}
        onContextMenu={handleContextMenu}
      />
      <StatusOverlay
        workspaceId={workspaceId}
        entryMode={entryMode}
        showTemplateLibraryInFree={showTemplateLibraryInFree}
        advancedEditEnabled={advancedEditEnabled}
      />
      {/* 电路图 ↔ 实物图切换 */}
      {onToggleRealistic && (
        <button
          onClick={onToggleRealistic}
          style={{
            position: 'absolute',
            top: 12,
            right: 12,
            zIndex: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 14px',
            borderRadius: 8,
            border: `1px solid ${isRealistic ? '#3B82F6' : '#D1D5DB'}`,
            backgroundColor: isRealistic ? '#EFF6FF' : 'rgba(255,255,255,0.95)',
            color: isRealistic ? '#3B82F6' : '#374151',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
          }}
        >
          {isRealistic ? '实物图模式' : '电路图模式'}
          <span style={{ color: '#9CA3AF', fontSize: 10 }}>点击切换</span>
        </button>
      )}
      {/* 缩放控制按钮 */}
      <div
        style={{
          position: 'absolute',
          bottom: 48,
          right: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          zIndex: 50,
        }}
      >
        <button
          onClick={() => zoom(1.25)}
          style={{
            width: 32, height: 32,
            borderRadius: '6px 6px 0 0',
            border: '1px solid #D1D5DB',
            backgroundColor: 'rgba(255,255,255,0.95)',
            color: '#374151',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="放大"
        >+</button>
        <button
          onClick={() => zoom(1 / 1.25)}
          style={{
            width: 32, height: 32,
            borderRadius: '0 0 6px 6px',
            border: '1px solid #D1D5DB',
            borderTop: 'none',
            backgroundColor: 'rgba(255,255,255,0.95)',
            color: '#374151',
            fontSize: 16,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          title="缩小"
        >-</button>
      </div>
      {/* 参数调节弹窗 */}
      {paramPopup && (
        <ParamPopup
          workspaceId={workspaceId}
          entityId={paramPopup.entityId}
          x={paramPopup.x}
          y={paramPopup.y}
          onClose={() => setParamPopup(null)}
        />
      )}
      {/* 电阻箱圆盘调节 */}
      {dialTarget && (
        <ResistanceBoxDial
          workspaceId={workspaceId}
          entityId={dialTarget.entityId}
          x={dialTarget.screenX}
          y={dialTarget.screenY}
          onClose={() => setDialTarget(null)}
        />
      )}
      {/* 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          workspaceId={workspaceId}
          x={contextMenu.x}
          y={contextMenu.y}
          entityId={contextMenu.entityId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 连接点渲染
// ═══════════════════════════════════════════

function renderPorts(
  ctx: CanvasRenderingContext2D,
  entities: Map<EntityId, Entity>,
  transform: CoordinateTransform,
  mousePixel: Vec2 | null,
  wiring: { fromPort: Port; currentMouse: Vec2 } | null,
  advancedEditEnabled: boolean,
): void {
  if (!advancedEditEnabled && !wiring) return;

  for (const entity of entities.values()) {
    const ports = getEntityPorts(entity);
    const center = getEntityScreenCenter(entity, transform);

    const near = mousePixel && Math.hypot(mousePixel.x - center.x, mousePixel.y - center.y) < PORT_SHOW_DISTANCE;
    const showForWiring = wiring && wiring.fromPort.entityId !== entity.id;

    if (!near && !showForWiring) continue;

    for (const port of ports) {
      const screen = worldToScreen(port.world, transform);
      let snapped = false;
      if (wiring) {
        snapped = Math.hypot(wiring.currentMouse.x - screen.x, wiring.currentMouse.y - screen.y) < PORT_SNAP_DISTANCE;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, PORT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = snapped ? '#3B82F6' : 'rgba(255,255,255,0.9)';
      ctx.fill();
      ctx.strokeStyle = snapped ? '#2563EB' : '#9CA3AF';
      ctx.lineWidth = snapped ? 2 : 1.5;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(screen.x, screen.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = snapped ? '#2563EB' : '#6B7280';
      ctx.fill();
      ctx.restore();
    }
  }

  // 起点高亮
  if (wiring) {
    const fs = worldToScreen(wiring.fromPort.world, transform);
    ctx.save();
    ctx.beginPath();
    ctx.arc(fs.x, fs.y, PORT_RADIUS + 1, 0, Math.PI * 2);
    ctx.fillStyle = '#10B981';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(fs.x, fs.y, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }
}

function renderTemplateSlotBadges(
  ctx: CanvasRenderingContext2D,
  entities: Map<EntityId, Entity>,
  transform: CoordinateTransform,
  currentTemplateFamilyId: string | null,
  currentTemplateVariantId: string | null,
): void {
  if (!currentTemplateFamilyId || !currentTemplateVariantId) return;

  const slotBindings = resolveBuilderInstrumentSlotBindings({
    familyId: currentTemplateFamilyId,
    variantId: currentTemplateVariantId,
    entities,
  });

  for (const binding of slotBindings) {
    if (!binding.entity) continue;

    const center = getEntityScreenCenter(binding.entity, transform);
    const label = binding.slot.activityRole === 'voltage'
      ? `${binding.slot.label} · V`
      : binding.slot.activityRole === 'current'
        ? `${binding.slot.label} · A`
        : binding.slot.label;
    const strokeColor = binding.slot.activityRole === 'voltage'
      ? '#0EA5E9'
      : binding.slot.activityRole === 'current'
        ? COLORS.primary
        : COLORS.textSecondary;
    const fillColor = binding.slot.activityRole === 'voltage'
      ? '#0369A1'
      : binding.slot.activityRole === 'current'
        ? COLORS.primary
        : COLORS.textSecondary;

    ctx.save();
    ctx.font = '11px sans-serif';
    const textWidth = ctx.measureText(label).width;
    const badgeWidth = textWidth + 14;
    const badgeHeight = 20;
    const x = center.x - badgeWidth / 2;
    const y = center.y - 42;

    ctx.fillStyle = 'rgba(255,255,255,0.94)';
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.2;
    roundRect(ctx, x, y, badgeWidth, badgeHeight, 10);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = fillColor;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, center.x, y + badgeHeight / 2 + 0.5);
    ctx.restore();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

// ═══════════════════════════════════════════
// 连线渲染（正交路由）
// ═══════════════════════════════════════════

function renderWires(
  ctx: CanvasRenderingContext2D,
  entities: Map<EntityId, Entity>,
  relations: Relation[],
  transform: CoordinateTransform,
  currentTemplateFamilyId: string | null,
  interaction: BuilderInteraction,
): void {
  const specializedMode = getSpecializedTemplateWireMode(entities, currentTemplateFamilyId);
  const shouldDeferToViewport =
    specializedMode === 'voltammetry-internal' || specializedMode === 'voltammetry-external';
  const graph = resolveWireGraph(entities, relations, transform, currentTemplateFamilyId);
  const graphWithAutoArrows = shouldDeferToViewport
    ? graph
    : {
        ...graph,
        arrows: [
          ...graph.arrows,
          ...resolveAutoCurrentRouteArrows({
            entities,
            relations,
            routes: graph.routes,
          }),
        ],
      };

  if (!shouldDeferToViewport) {
    renderResolvedWireGraph(ctx, graphWithAutoArrows);
  } else {
    renderWireOverlays(ctx, graph);
  }

  // 连线预览
  if (interaction.type === 'wiring') {
    const fromEnt = entities.get(interaction.fromEntityId);
    if (fromEnt) {
      const fromPort = findPortBySide(fromEnt, interaction.fromPortSide);
      const toScreen = worldToScreen(interaction.mousePos, transform);
      if (!fromPort) return;

      // 目标端口吸附检测
      const snap = findNearestPort(
        toScreen, entities, transform, interaction.fromEntityId,
      );
      const targetPort: Port = snap
        ? snap
        : {
            entityId: '__preview__',
            side: inferSide(toScreen, worldToScreen(fromPort.world, transform)),
            world: screenToWorld(toScreen, transform),
          };
      const occupiedSegments = graph.routes.flatMap((route) => buildWireSegments(route.points));
      const path = resolveGenericRoutePath(
        fromPort,
        targetPort,
        transform,
        collectEntityScreenBoxes(entities, transform),
        occupiedSegments,
      );

      ctx.save();
      ctx.strokeStyle = '#3B82F6';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 4]);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      drawPath(ctx, path);
      ctx.setLineDash([]);
      ctx.restore();
    }
  }
}

/** 根据鼠标相对位置推断到达方向 */
function inferSide(target: Vec2, from: Vec2): PortSide {
  const dx = target.x - from.x;
  const dy = target.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? 'left' : 'right';
  }
  return dy > 0 ? 'top' : 'bottom';
}

// ═══════════════════════════════════════════
// 导线命中检测
// ═══════════════════════════════════════════

function hitTestWire(
  pixel: Vec2, entities: Map<EntityId, Entity>,
  relations: Relation[], transform: CoordinateTransform,
  currentTemplateFamilyId: string | null,
): string | null {
  const specializedMode = getSpecializedTemplateWireMode(entities, currentTemplateFamilyId);
  if (specializedMode === 'voltammetry-internal' || specializedMode === 'voltammetry-external') {
    return null;
  }
  const graph = resolveWireGraph(entities, relations, transform, currentTemplateFamilyId);
  return hitTestResolvedRoutes(pixel, graph.routes, 6);
}

function distToSeg(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

// ═══════════════════════════════════════════
// 单击参数调节弹窗
// ═══════════════════════════════════════════

function ParamPopup({ workspaceId, entityId, x, y, onClose }: {
  workspaceId: BuilderWorkspaceId; entityId: string; x: number; y: number; onClose: () => void;
}) {
  const entity = useBuilderWorkspace(workspaceId, (state) => state.entities.get(entityId));
  const updateProperty = useBuilderStore((s) => s.updateEntityProperty);
  const currentTemplateFamilyId = useBuilderWorkspace(
    workspaceId,
    (state) => state.currentTemplateFamilyId,
  );

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-param-popup]')) onClose();
    };
    const timer = setTimeout(() => window.addEventListener('click', handler), 50);
    return () => { clearTimeout(timer); window.removeEventListener('click', handler); };
  }, [onClose]);

  if (!entity) return null;

  const reg = entityRegistry.get(entity.type);
  if (!reg) return null;

  const schemas = filterEntitySchemasForTemplate({
    familyId: currentTemplateFamilyId,
    entity,
    schemas: reg.paramSchemas,
  });
  const templateSpecificNote = getTemplateSpecificEntityNote(currentTemplateFamilyId, entity);
  if (schemas.length === 0 && !templateSpecificNote) return null;

  const label = entity.label ?? reg.label;
  const panelW = 240;
  const left = Math.max(8, Math.min(window.innerWidth - panelW - 8, x - panelW / 2));
  const top = Math.max(8, Math.min(window.innerHeight - 300, y + 20));

  return (
    <div
      data-param-popup
      style={{
        position: 'fixed',
        left,
        top,
        width: panelW,
        zIndex: 1000,
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        boxShadow: SHADOWS.md,
        overflow: 'hidden',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '8px 12px',
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: COLORS.text }}>{label}</span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.textMuted, fontSize: 14, padding: 0 }}
        >×</button>
      </div>

      <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {templateSpecificNote && (
          <div
            style={{
              borderRadius: RADIUS.sm,
              border: `1px solid ${COLORS.border}`,
              backgroundColor: COLORS.bgMuted,
              padding: '8px 10px',
              fontSize: 11,
              lineHeight: 1.6,
              color: COLORS.textSecondary,
            }}
          >
            {templateSpecificNote}
          </div>
        )}
        <BuilderEntityParamFields
          entity={entity}
          schemas={schemas}
          onUpdate={(key, value) => updateProperty(entityId, key, value, workspaceId)}
          variant="popup"
        />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// 电阻箱圆盘调节器
// ═══════════════════════════════════════════

const DIAL_LABELS = ['×1000', '×100', '×10', '×1'];
const DIAL_RADIUS = 30;
const DIAL_KNOB_COLOR = '#E67E22';

function ResistanceBoxDial({ workspaceId, entityId, x, y, onClose }: {
  workspaceId: BuilderWorkspaceId; entityId: string; x: number; y: number; onClose: () => void;
}) {
  const entity = useBuilderWorkspace(workspaceId, (state) => state.entities.get(entityId));
  const updateProperty = useBuilderStore((s) => s.updateEntityProperty);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-dial-panel]')) onClose();
    };
    // 延迟绑定避免本次点击立即触发关闭
    const timer = setTimeout(() => window.addEventListener('mousedown', handler), 50);
    return () => { clearTimeout(timer); window.removeEventListener('mousedown', handler); };
  }, [onClose]);

  if (!entity) return null;

  const R = Math.max(0, Math.min(9999, Math.round((entity.properties.resistance as number) ?? 0)));
  const digits = [
    Math.floor(R / 1000) % 10,
    Math.floor(R / 100) % 10,
    Math.floor(R / 10) % 10,
    R % 10,
  ];

  const setDigit = (index: number, newDigit: number) => {
    const d = [...digits];
    d[index] = ((newDigit % 10) + 10) % 10;
    const newR = d[0]! * 1000 + d[1]! * 100 + d[2]! * 10 + d[3]!;
    updateProperty(entityId, 'resistance', newR, workspaceId);
  };

  // 面板居中对齐到点击位置，确保不超出视口
  const panelW = 310;
  const panelH = 200;
  const left = Math.max(8, Math.min(window.innerWidth - panelW - 8, x - panelW / 2));
  const top = Math.max(8, Math.min(window.innerHeight - panelH - 8, y - panelH - 20));

  return (
    <div
      data-dial-panel
      style={{
        position: 'fixed',
        left,
        top,
        width: panelW,
        zIndex: 1000,
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.md,
        boxShadow: SHADOWS.lg,
        padding: '12px 16px',
        overflow: 'hidden',
      }}
    >
      {/* 标题 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>电阻箱 R = {R}Ω</span>
        <button
          onClick={onClose}
          style={{ border: 'none', background: 'none', cursor: 'pointer', color: COLORS.textMuted, fontSize: 16 }}
        >
          ×
        </button>
      </div>

      {/* 四个圆盘 */}
      <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '8px 0' }}>
        {digits.map((digit, i) => (
          <DialKnob
            key={i}
            digit={digit}
            label={DIAL_LABELS[i]!}
            onChange={(d) => setDigit(i, d)}
          />
        ))}
      </div>
    </div>
  );
}

function DialKnob({ digit, label, onChange }: {
  digit: number; label: string; onChange: (d: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ startY: number; startDigit: number } | null>(null);

  // 绘制圆盘
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const c = cvs.getContext('2d');
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const size = DIAL_RADIUS * 2;
    cvs.width = size * dpr;
    cvs.height = size * dpr;
    cvs.style.width = `${size}px`;
    cvs.style.height = `${size}px`;
    c.scale(dpr, dpr);

    const cx = DIAL_RADIUS;
    const cy = DIAL_RADIUS;
    const r = DIAL_RADIUS - 3;

    // 外环
    c.beginPath();
    c.arc(cx, cy, r, 0, Math.PI * 2);
    c.fillStyle = '#F5F0EB';
    c.fill();
    c.strokeStyle = '#C0A882';
    c.lineWidth = 2;
    c.stroke();

    // 刻度数字（0-9 围一圈）
    c.font = '10px Inter, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (let n = 0; n < 10; n++) {
      const angle = (n / 10) * Math.PI * 2 - Math.PI / 2;
      const tx = cx + Math.cos(angle) * (r - 12);
      const ty = cy + Math.sin(angle) * (r - 12);
      c.fillStyle = n === digit ? DIAL_KNOB_COLOR : '#999';
      c.font = n === digit ? 'bold 13px Inter, sans-serif' : '10px Inter, sans-serif';
      c.fillText(String(n), tx, ty);
    }

    // 指针（指向当前数字）
    const pointerAngle = (digit / 10) * Math.PI * 2 - Math.PI / 2;
    const px = cx + Math.cos(pointerAngle) * (r - 26);
    const py = cy + Math.sin(pointerAngle) * (r - 26);
    c.beginPath();
    c.moveTo(cx, cy);
    c.lineTo(px, py);
    c.strokeStyle = DIAL_KNOB_COLOR;
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    c.stroke();

    // 中心圆
    c.beginPath();
    c.arc(cx, cy, 5, 0, Math.PI * 2);
    c.fillStyle = DIAL_KNOB_COLOR;
    c.fill();
  }, [digit]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startY: e.clientY, startDigit: digit };

    const handleMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dy = dragRef.current.startY - ev.clientY;
      const steps = Math.round(dy / 20);
      if (steps !== 0) {
        const newDigit = ((dragRef.current.startDigit + steps) % 10 + 10) % 10;
        onChange(newDigit);
        dragRef.current = { startY: ev.clientY, startDigit: newDigit };
      }
    };

    const handleUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    const delta = e.deltaY > 0 ? -1 : 1;
    onChange(((digit + delta) % 10 + 10) % 10);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <canvas
        ref={canvasRef}
        style={{ cursor: 'ns-resize' }}
        onMouseDown={handleMouseDown}
        onWheel={handleWheel}
      />
      <span style={{ fontSize: 10, color: COLORS.textMuted }}>{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════
// 右键菜单
// ═══════════════════════════════════════════

/** 元件可替换的同族类型映射 */
const REPLACE_MAP: Record<string, Array<{ type: string; label: string }>> = {
  'fixed-resistor': [
    { type: 'slide-rheostat', label: '滑动变阻器' },
    { type: 'resistance-box', label: '电阻箱' },
  ],
  'slide-rheostat': [
    { type: 'fixed-resistor', label: '定值电阻' },
    { type: 'resistance-box', label: '电阻箱' },
  ],
  'resistance-box': [
    { type: 'fixed-resistor', label: '定值电阻' },
    { type: 'slide-rheostat', label: '滑动变阻器' },
  ],
  'ammeter': [
    { type: 'galvanometer', label: '灵敏电流计' },
  ],
  'galvanometer': [
    { type: 'ammeter', label: '电流表' },
  ],
};

function ContextMenu({ workspaceId, x, y, entityId, onClose }: {
  workspaceId: BuilderWorkspaceId; x: number; y: number; entityId: string; onClose: () => void;
}) {
  const entity = useBuilderWorkspace(workspaceId, (state) => state.entities.get(entityId));
  const removeEntity = useBuilderStore((s) => s.removeEntity);
  const currentTemplateFamilyId = useBuilderWorkspace(
    workspaceId,
    (state) => state.currentTemplateFamilyId,
  );
  const currentTemplateVariantId = useBuilderWorkspace(
    workspaceId,
    (state) => state.currentTemplateVariantId,
  );
  const entities = useBuilderWorkspace(workspaceId, (state) => state.entities);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      // 点击菜单外部关闭
      const target = e.target as HTMLElement;
      if (!target.closest('[data-context-menu]')) onClose();
    };
    window.addEventListener('mousedown', handler);
    return () => window.removeEventListener('mousedown', handler);
  }, [onClose]);

  if (!entity) return null;

  const replacements = REPLACE_MAP[entity.type] ?? [];
  const label = entityRegistry.get(entity.type)?.label ?? entity.type;
  const protectedEntityIds =
    currentTemplateFamilyId && currentTemplateVariantId
      ? getProtectedBuilderEntityIds({
          familyId: currentTemplateFamilyId,
          variantId: currentTemplateVariantId,
          entities,
        })
      : null;
  const isDeleteDisabled = Boolean(protectedEntityIds?.has(entity.id));

  const handleDuplicate = () => {
    const store = useBuilderStore.getState();
    store.selectEntity(entityId, workspaceId);
    const copied = store.copySelectedEntity(workspaceId);
    if (copied) {
      store.pasteClipboard(workspaceId);
    }

    onClose();
  };

  const handleDelete = () => {
    if (isDeleteDisabled) return;
    removeEntity(entityId, workspaceId);
    onClose();
  };

  const handleReplace = (newType: string) => {
    const store = useBuilderStore.getState();
    if (!entityRegistry.get(newType)) return;

    // 属性适配：在同族元件之间转换阻值
    const adaptedProps: Record<string, unknown> = {};
    const oldType = entity.type;
    const oldR = (entity.properties.resistance as number)
      ?? ((entity.properties.maxResistance as number) ?? 30) * ((entity.properties.sliderRatio as number) ?? 0.5);

    if (newType === 'slide-rheostat') {
      // 目标是滑动变阻器：把阻值映射到 maxResistance + sliderRatio
      const maxR = Math.max(oldR, 30);
      adaptedProps.maxResistance = maxR;
      adaptedProps.sliderRatio = Math.min(1, oldR / maxR);
    } else if (newType === 'fixed-resistor' || newType === 'resistance-box') {
      // 目标是定值电阻或电阻箱
      adaptedProps.resistance = oldR;
    }

    // 电流计互换：保留内阻和量程
    if ((oldType === 'ammeter' || oldType === 'galvanometer') &&
        (newType === 'ammeter' || newType === 'galvanometer')) {
      const ir = entity.properties.internalResistance;
      if (ir != null) adaptedProps.internalResistance = ir;
    }

    store.replaceEntityType(entityId, newType, adaptedProps, workspaceId);

    onClose();
  };

  return (
    <div
      data-context-menu
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 1000,
        minWidth: 160,
        backgroundColor: COLORS.bg,
        border: `1px solid ${COLORS.border}`,
        borderRadius: RADIUS.sm,
        boxShadow: SHADOWS.md,
        padding: '4px 0',
        overflow: 'hidden',
      }}
    >
      {/* 标题 */}
      <div style={{
        padding: '6px 12px',
        fontSize: 11,
        color: COLORS.textMuted,
        borderBottom: `1px solid ${COLORS.border}`,
      }}>
        {label}
      </div>

      {/* 替换选项 */}
      {replacements.length > 0 && (
        <>
          <div style={{
            padding: '4px 12px 2px',
            fontSize: 10,
            color: COLORS.textPlaceholder,
          }}>
            替换为
          </div>
          {replacements.map((r) => (
            <button
              key={r.type}
              onClick={() => handleReplace(r.type)}
              style={{
                display: 'block',
                width: '100%',
                padding: '6px 12px',
                fontSize: 12,
                color: COLORS.text,
                backgroundColor: 'transparent',
                border: 'none',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = COLORS.bgHover; }}
              onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
            >
              {r.label}
            </button>
          ))}
          <div style={{ height: 1, backgroundColor: COLORS.border, margin: '4px 0' }} />
        </>
      )}

      {/* 复制 */}
      <button
        onClick={handleDuplicate}
        style={{
          display: 'block',
          width: '100%',
          padding: '6px 12px',
          fontSize: 12,
          color: COLORS.text,
          backgroundColor: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => { (e.target as HTMLElement).style.backgroundColor = COLORS.bgHover; }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        复制元件
      </button>

      <div style={{ height: 1, backgroundColor: COLORS.border, margin: '4px 0' }} />

      {/* 删除 */}
      <button
        onClick={handleDelete}
        disabled={isDeleteDisabled}
        style={{
          display: 'block',
          width: '100%',
          padding: '6px 12px',
          fontSize: 12,
          color: COLORS.error,
          backgroundColor: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: isDeleteDisabled ? 'not-allowed' : 'pointer',
          opacity: isDeleteDisabled ? 0.6 : 1,
        }}
        onMouseEnter={(e) => {
          if (!isDeleteDisabled) (e.target as HTMLElement).style.backgroundColor = COLORS.errorLight;
        }}
        onMouseLeave={(e) => { (e.target as HTMLElement).style.backgroundColor = 'transparent'; }}
      >
        {isDeleteDisabled ? '模板核心元件不可删除' : '删除元件'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════
// 状态提示
// ═══════════════════════════════════════════

function StatusOverlay({
  workspaceId,
  entryMode,
  showTemplateLibraryInFree,
  advancedEditEnabled,
}: {
  workspaceId: BuilderWorkspaceId;
  entryMode: 'template' | 'free';
  showTemplateLibraryInFree: boolean;
  advancedEditEnabled: boolean;
}) {
  const isRunning = useBuilderWorkspace(workspaceId, (state) => state.isRunning);
  const solverError = useBuilderWorkspace(workspaceId, (state) => state.solverError);
  const entityCount = useBuilderWorkspace(workspaceId, (state) => state.entities.size);
  const interaction = useBuilderWorkspace(workspaceId, (state) => state.interaction);

  if (entityCount === 0) {
    return (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="max-w-sm text-center text-sm" style={{ color: COLORS.textMuted, lineHeight: 1.7 }}>
          {entryMode === 'free' ? (
            showTemplateLibraryInFree ? (
              <>
                可直接从左侧模板区加载实验骨架，或从元件库拖元件到画布。
                <br />
                同一个自由搭建工作台里支持空白起步和模板起步。
              </>
            ) : (
              <>
                从左侧元件库直接拖元件到画布。
                <br />
                自由搭建入口默认不预设模板骨架。
              </>
            )
          ) : (
            <>
              先从左侧选择实验模板，再在模板基础上调接法、改参数。
              <br />
              只有模板不够时，再展开进阶元件库补元件。
            </>
          )}
        </span>
      </div>
    );
  }
  if (interaction.type === 'wiring') {
    return (
      <div className="pointer-events-none absolute left-1/2 top-4 -translate-x-1/2">
        <div className="rounded-lg px-4 py-2 text-xs font-medium"
          style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #93C5FD' }}>
          拖拽到目标元件的连接点松开
        </div>
      </div>
    );
  }
  if (solverError) {
    return (
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="max-w-md rounded-lg px-4 py-2 text-xs text-center"
          style={{ backgroundColor: COLORS.warningLight, color: '#92400E' }}>
          {solverError}
        </div>
      </div>
    );
  }
  if (isRunning) {
    return (
      <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2">
        <div className="rounded-lg px-4 py-2 text-xs"
          style={{ backgroundColor: COLORS.successLight, color: '#065F46' }}>
          电路运行中 · 调整参数实时更新
        </div>
      </div>
    );
  }
  if (entityCount > 0 && !advancedEditEnabled) {
    return (
      <div className="pointer-events-none absolute top-4 left-1/2 -translate-x-1/2">
        <div className="rounded-lg px-4 py-2 text-xs"
          style={{ backgroundColor: 'rgba(255,255,255,0.94)', color: COLORS.textSecondary, border: `1px solid ${COLORS.border}` }}>
          {entryMode === 'free'
            ? '当前自由搭建入口已锁定编辑。需要拖拽元件或改连线时，请先开启编辑。'
            : '当前为模板模式，只做结构切换和参数调整。需要拖拽补元件或改连线时，请先开启进阶编辑。'}
        </div>
      </div>
    );
  }
  return null;
}

// ═══════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════

function getEntityScreenCenter(entity: Entity, transform: CoordinateTransform): Vec2 {
  const pos = entity.transform.position;
  const radius = entity.properties.radius as number | undefined;
  if (radius != null) return worldToScreen(pos, transform);
  const w = (entity.properties.width as number) ?? 0.5;
  const h = (entity.properties.height as number) ?? 0.5;
  return worldToScreen({ x: pos.x + w / 2, y: pos.y + h / 2 }, transform);
}
