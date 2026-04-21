/**
 * 截面计算核心逻辑（从 crossSectionTool.ts 提取）
 * 供鼠标点击方式和文本指令方式共同复用
 */
import type { Vec3, PolyhedronResult } from '@/engine/types';
import type { Entity, PointProperties, GeometryProperties } from './entities/types';
import { useEntityStore } from './store/entityStore';
import { useHistoryStore } from './store/historyStore';
import { CreateCrossSectionCommand } from './commands/createCrossSection';
import type { PolygonPoint, SubFace } from './commands/createCrossSection';
import { buildGeometry } from '@/engine/builders';

// ─── 公开接口 ───

interface CrossSectionResult {
  success: boolean;
  message: string;
}

/**
 * 从给定的点 ID 列表创建截面
 * @param geometryId 几何体 ID
 * @param pointIds 定义截面的点 ID 列表（至少 3 个）
 * @returns 执行结果
 */
export function createCrossSectionFromPoints(
  geometryId: string,
  pointIds: string[],
): CrossSectionResult {
  const entityStore = useEntityStore.getState();

  // 获取定义点的 Entity
  const pointEntities: Entity<'point'>[] = [];
  for (const pid of pointIds) {
    const entity = entityStore.getEntity(pid);
    if (!entity || entity.type !== 'point') {
      return { success: false, message: `点 ${pid} 无效` };
    }
    pointEntities.push(entity as Entity<'point'>);
  }

  // 获取几何体
  const geometry = entityStore.getEntity(geometryId);
  if (!geometry || geometry.type !== 'geometry') {
    return { success: false, message: '未找到几何体' };
  }

  // 获取 BuilderResult
  const geoProps = geometry.properties as GeometryProperties;
  const builderResult = buildGeometry(geoProps.geometryType, geoProps.params);
  if (!builderResult || builderResult.kind !== 'polyhedron') {
    return { success: false, message: '仅多面体支持截面' };
  }

  // 解析定义点坐标
  const definingPositions = resolvePointPositions(pointEntities, builderResult, entityStore);
  if (!definingPositions || definingPositions.length < 3) {
    return { success: false, message: '无法解析点坐标' };
  }

  // 拟合平面
  const plane = fitPlane(definingPositions);
  if (!plane) {
    return { success: false, message: '选定的点共线，无法确定截面' };
  }

  // 遍历所有棱计算交点
  const rawIntersections = computeEdgeIntersections(builderResult, plane);
  if (rawIntersections.length < 3) {
    return { success: false, message: '截面与几何体交点不足，无法形成截面' };
  }

  // 去重：将交点转为 PolygonPoint
  const polygonPoints = resolveIntersections(
    rawIntersections,
    builderResult,
    geometryId,
    entityStore,
  );

  // 按平面内角度排序
  sortPolygonPointsByAngle(polygonPoints, builderResult, plane);

  // 面分割
  const definingIds = pointIds.slice();
  const subFaces = splitIntoSubFaces(polygonPoints, definingIds);

  // 构造并执行 Command
  const command = new CreateCrossSectionCommand(
    geometryId,
    definingIds,
    polygonPoints,
    subFaces,
  );
  useHistoryStore.getState().execute(command);

  return { success: true, message: '已创建截面' };
}

// ─── 内部辅助函数 ───

interface Plane {
  normal: Vec3;
  d: number;
}

interface EdgeIntersection {
  edgeStart: number;
  edgeEnd: number;
  t: number;
}

function resolvePointPositions(
  points: Entity<'point'>[],
  builderResult: PolyhedronResult,
  entityStore: ReturnType<typeof useEntityStore.getState>,
): Vec3[] | null {
  const positions: Vec3[] = [];
  for (const point of points) {
    const props = point.properties as PointProperties;
    const pos = resolvePointPosition(props, builderResult, entityStore);
    if (!pos) return null;
    positions.push(pos);
  }
  return positions;
}

function resolvePointPosition(
  props: PointProperties,
  builderResult: PolyhedronResult,
  _entityStore: ReturnType<typeof useEntityStore.getState>,
): Vec3 | null {
  if (props.positionOverride) return props.positionOverride;

  const constraint = props.constraint;

  if (constraint.type === 'vertex') {
    const vertex = builderResult.vertices[constraint.vertexIndex];
    return vertex ? vertex.position : null;
  }

  if (constraint.type === 'edge') {
    const a = builderResult.vertices[constraint.edgeStart]?.position;
    const b = builderResult.vertices[constraint.edgeEnd]?.position;
    if (!a || !b) return null;
    const t = constraint.t;
    return [
      a[0] + t * (b[0] - a[0]),
      a[1] + t * (b[1] - a[1]),
      a[2] + t * (b[2] - a[2]),
    ];
  }

  if (constraint.type === 'free') {
    return constraint.position;
  }

  return null;
}

function fitPlane(points: Vec3[]): Plane | null {
  for (let i = 0; i < points.length - 2; i++) {
    for (let j = i + 1; j < points.length - 1; j++) {
      for (let k = j + 1; k < points.length; k++) {
        const normal = cross(sub(points[j], points[i]), sub(points[k], points[i]));
        const len = vecLen(normal);
        if (len > 1e-8) {
          const n: Vec3 = [normal[0] / len, normal[1] / len, normal[2] / len];
          const d = dot(n, points[i]);
          return { normal: n, d };
        }
      }
    }
  }
  return null;
}

function computeEdgeIntersections(
  result: PolyhedronResult,
  plane: Plane,
): EdgeIntersection[] {
  const intersections: EdgeIntersection[] = [];

  for (const [ai, bi] of result.edges) {
    const a = result.vertices[ai].position;
    const b = result.vertices[bi].position;

    const da = dot(plane.normal, a) - plane.d;
    const db = dot(plane.normal, b) - plane.d;

    if (da * db > 1e-10) continue;

    const denom = da - db;
    if (Math.abs(denom) < 1e-10) continue;

    const t = da / denom;
    if (t < -1e-6 || t > 1 + 1e-6) continue;

    const clampedT = Math.max(0, Math.min(1, t));
    intersections.push({ edgeStart: ai, edgeEnd: bi, t: clampedT });
  }

  return intersections;
}

function resolveIntersections(
  intersections: EdgeIntersection[],
  builderResult: PolyhedronResult,
  geometryId: string,
  entityStore: ReturnType<typeof useEntityStore.getState>,
): PolygonPoint[] {
  const EPSILON = 1e-6;
  const result: PolygonPoint[] = [];
  const addedCoords: Vec3[] = [];

  function isDuplicateCoord(pos: Vec3): boolean {
    for (const existing of addedCoords) {
      const dx = pos[0] - existing[0];
      const dy = pos[1] - existing[1];
      const dz = pos[2] - existing[2];
      if (dx * dx + dy * dy + dz * dz < EPSILON * EPSILON) return true;
    }
    return false;
  }

  for (const inter of intersections) {
    const a = builderResult.vertices[inter.edgeStart].position;
    const b = builderResult.vertices[inter.edgeEnd].position;
    const pos: Vec3 = [
      a[0] + inter.t * (b[0] - a[0]),
      a[1] + inter.t * (b[1] - a[1]),
      a[2] + inter.t * (b[2] - a[2]),
    ];

    if (isDuplicateCoord(pos)) continue;
    addedCoords.push(pos);

    if (inter.t < EPSILON) {
      const existingPoint = entityStore.findPointAtVertex(geometryId, inter.edgeStart);
      if (existingPoint) {
        result.push({ type: 'reuse', pointId: existingPoint.id });
      } else {
        result.push({ type: 'create', edgeStart: inter.edgeStart, edgeEnd: inter.edgeEnd, t: inter.t });
      }
    } else if (inter.t > 1 - EPSILON) {
      const existingPoint = entityStore.findPointAtVertex(geometryId, inter.edgeEnd);
      if (existingPoint) {
        result.push({ type: 'reuse', pointId: existingPoint.id });
      } else {
        result.push({ type: 'create', edgeStart: inter.edgeStart, edgeEnd: inter.edgeEnd, t: inter.t });
      }
    } else {
      const existingPoint = entityStore.findPointOnEdge(geometryId, inter.edgeStart, inter.edgeEnd, inter.t);
      if (existingPoint) {
        result.push({ type: 'reuse', pointId: existingPoint.id });
      } else {
        result.push({ type: 'create', edgeStart: inter.edgeStart, edgeEnd: inter.edgeEnd, t: inter.t });
      }
    }
  }

  return result;
}

function getPolygonPointPosition(
  pp: PolygonPoint,
  builderResult: PolyhedronResult,
  entityStore: ReturnType<typeof useEntityStore.getState>,
): Vec3 {
  if (pp.type === 'reuse') {
    const entity = entityStore.getEntity(pp.pointId);
    if (entity && entity.type === 'point') {
      const props = entity.properties as PointProperties;
      const pos = resolvePointPosition(props, builderResult, entityStore);
      if (pos) return pos;
    }
    return [0, 0, 0];
  }
  const a = builderResult.vertices[pp.edgeStart].position;
  const b = builderResult.vertices[pp.edgeEnd].position;
  return [
    a[0] + pp.t * (b[0] - a[0]),
    a[1] + pp.t * (b[1] - a[1]),
    a[2] + pp.t * (b[2] - a[2]),
  ];
}

function sortPolygonPointsByAngle(
  polygonPoints: PolygonPoint[],
  builderResult: PolyhedronResult,
  plane: Plane,
): void {
  const entityStore = useEntityStore.getState();
  const positions = polygonPoints.map((pp) =>
    getPolygonPointPosition(pp, builderResult, entityStore),
  );

  const cx = positions.reduce((s, p) => s + p[0], 0) / positions.length;
  const cy = positions.reduce((s, p) => s + p[1], 0) / positions.length;
  const cz = positions.reduce((s, p) => s + p[2], 0) / positions.length;

  const d0: Vec3 = [positions[0][0] - cx, positions[0][1] - cy, positions[0][2] - cz];
  const d0Len = vecLen(d0);
  if (d0Len < 1e-10) return;
  const u: Vec3 = [d0[0] / d0Len, d0[1] / d0Len, d0[2] / d0Len];
  const v = cross(plane.normal, u);

  const angles = positions.map((p) => {
    const dx = p[0] - cx;
    const dy = p[1] - cy;
    const dz = p[2] - cz;
    const pu = dx * u[0] + dy * u[1] + dz * u[2];
    const pv = dx * v[0] + dy * v[1] + dz * v[2];
    return Math.atan2(pv, pu);
  });

  const indices = polygonPoints.map((_, i) => i);
  indices.sort((a, b) => angles[a] - angles[b]);
  const sorted = indices.map((i) => polygonPoints[i]);
  for (let i = 0; i < polygonPoints.length; i++) {
    polygonPoints[i] = sorted[i];
  }
}

function splitIntoSubFaces(
  polygonPoints: PolygonPoint[],
  definingPointIds: string[],
): SubFace[] {
  const n = polygonPoints.length;

  const defIndices: number[] = [];
  for (const dpId of definingPointIds) {
    const idx = polygonPoints.findIndex(
      (pp) => pp.type === 'reuse' && pp.pointId === dpId,
    );
    if (idx !== -1) defIndices.push(idx);
  }

  if (defIndices.length < 2) {
    return [{ pointIndices: polygonPoints.map((_, i) => i) }];
  }

  if (n === defIndices.length) {
    return [{ pointIndices: polygonPoints.map((_, i) => i) }];
  }

  defIndices.sort((a, b) => a - b);

  const subFaces: SubFace[] = [];

  if (defIndices.length >= 3) {
    subFaces.push({ pointIndices: defIndices.slice() });
  }

  for (let di = 0; di < defIndices.length; di++) {
    const startIdx = defIndices[di];
    const endIdx = defIndices[(di + 1) % defIndices.length];

    const between: number[] = [];
    let cur = (startIdx + 1) % n;
    while (cur !== endIdx) {
      between.push(cur);
      cur = (cur + 1) % n;
    }

    if (between.length === 0) continue;

    const allPoints = [startIdx, ...between, endIdx];
    for (let i = 0; i < allPoints.length - 2; i++) {
      subFaces.push({
        pointIndices: [allPoints[0], allPoints[i + 1], allPoints[i + 2]],
      });
    }
  }

  return subFaces;
}

// ─── 向量工具 ───

function sub(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function vecLen(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}
