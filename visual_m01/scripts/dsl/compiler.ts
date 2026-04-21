/**
 * DSL 指令编译器
 *
 * SceneInstruction → EntityBuilder 调用 → SceneSnapshot
 *
 * 调试友好：
 * - debug 模式下输出每一步的编译日志
 * - 错误信息精确到具体标签/步骤
 * - 单条指令可独立编译测试
 */

import { buildGeometry } from '../../src/engine/builders/index';
import {
  calculateDihedralAngle,
  calculateLineFaceAngle,
  calculateLineLineAngle,
} from '../../src/engine/math/angleCalculator';
import {
  calculatePointFaceDistance,
  calculateLineLineDistance,
} from '../../src/engine/math/distanceCalculator';
import { buildCoordinateSystem } from '../../src/engine/math/coordinates';
import type { BuilderResult, PolyhedronResult, SurfaceResult, Vec3 } from '../../src/engine/types';
import type { GeometryType, GeometryParams } from '../../src/types/geometry';
import type {
  Entity,
  EntityType,
  EntityPropertiesMap,
  PointProperties,
  SegmentProperties,
  FaceProperties,
  CircumSphereProperties,
  CoordinateSystemProperties,
  AngleMeasurementProperties,
  AngleMeasurementKind,
  DistanceMeasurementProperties,
  DistanceMeasurementKind,
} from '../../src/editor/entities/types';

import type {
  SceneInstruction,
  SceneSnapshot,
  Construction,
  Measurement,
} from './types';
import { getGeometryEnv } from './geometry-env';
import {
  type CompileContext,
  log,
  resolveLabel,
  assertLabelExists,
  resolveFaceRef,
  resolveLineRef,
  findIntersectionLine,
  getFacePositions,
} from './resolvers';
import { DSLCompileError, labelDuplicate, facePointsTooFew } from './errors';

// ═══════════════════════════════════════════════════════════
// 编译选项
// ═══════════════════════════════════════════════════════════

export interface CompileOptions {
  /** 开启 debug 日志（默认 false） */
  debug?: boolean;
}

// ═══════════════════════════════════════════════════════════
// 编译结果
// ═══════════════════════════════════════════════════════════

export interface CompileResult {
  snapshot: SceneSnapshot;
  /** debug 模式下的编译日志 */
  logs: string[];
}

// ═══════════════════════════════════════════════════════════
// 内部 EntityBuilder（复用 generate-scenes.ts 中的逻辑）
// ═══════════════════════════════════════════════════════════

class InternalBuilder {
  private entities: Record<string, Entity> = {};
  private nextId = 1;
  private activeGeometryId: string | null = null;
  private builderResult: BuilderResult | null = null;
  private activeGeometryType: GeometryType | null = null;

  private vertexToPointId = new Map<number, string>();
  private edgeToSegmentId = new Map<string, string>();
  private faceIndexToId = new Map<number, string>();

  createEntity<T extends EntityType>(type: T, properties: EntityPropertiesMap[T]): Entity<T> {
    const id = String(this.nextId++);
    const entity = { id, type, properties, visible: true } as Entity<T>;
    this.entities[id] = entity as Entity;
    return entity;
  }

  createGeometry<T extends GeometryType>(geometryType: T, params: GeometryParams[T]): string {
    const geo = this.createEntity('geometry', { geometryType, params } as EntityPropertiesMap['geometry']);
    this.activeGeometryId = geo.id;
    this.activeGeometryType = geometryType;
    const result = buildGeometry(geometryType, params);
    if (result) {
      this.builderResult = result;
      this.createBuiltInEntities(geo.id, result);
    }
    return geo.id;
  }

  private createBuiltInEntities(geometryId: string, builderResult: BuilderResult): void {
    if (builderResult.kind === 'polyhedron') {
      const poly = builderResult as PolyhedronResult;
      for (let i = 0; i < poly.vertices.length; i++) {
        const point = this.createEntity('point', {
          builtIn: true, geometryId,
          constraint: { type: 'vertex', vertexIndex: i },
          label: poly.vertices[i].label,
        } as PointProperties);
        this.vertexToPointId.set(i, point.id);
      }
      for (const [startIdx, endIdx] of poly.edges) {
        const seg = this.createEntity('segment', {
          builtIn: true, geometryId,
          startPointId: this.vertexToPointId.get(startIdx)!,
          endPointId: this.vertexToPointId.get(endIdx)!,
          style: { color: '#000000', dashed: false },
        } as SegmentProperties);
        this.edgeToSegmentId.set(`${startIdx}-${endIdx}`, seg.id);
        this.edgeToSegmentId.set(`${endIdx}-${startIdx}`, seg.id);
      }
      for (let i = 0; i < poly.faces.length; i++) {
        const face = this.createEntity('face', {
          builtIn: true, geometryId,
          pointIds: poly.faces[i].map((idx) => this.vertexToPointId.get(idx)!),
          source: { type: 'geometry', faceIndex: i },
        } as FaceProperties);
        this.faceIndexToId.set(i, face.id);
      }
    } else {
      const surface = builderResult as SurfaceResult;
      for (let i = 0; i < surface.featurePoints.length; i++) {
        const point = this.createEntity('point', {
          builtIn: true, geometryId,
          constraint: { type: 'vertex', vertexIndex: i },
          label: surface.featurePoints[i].label,
        } as PointProperties);
        this.vertexToPointId.set(i, point.id);
      }
      for (let i = 0; i < surface.lines.length; i++) {
        this.createEntity('segment', {
          builtIn: true, geometryId,
          startPointId: '', endPointId: '',
          style: { color: '#000000', dashed: false },
          curvePoints: surface.lines[i].points as [number, number, number][],
          lineIndex: i,
        } as SegmentProperties);
      }
      for (let i = 0; i < surface.faces.length; i++) {
        const face = this.createEntity('face', {
          builtIn: true, geometryId,
          pointIds: [],
          source: { type: 'surface', surfaceType: surface.faces[i].surfaceType, faceIndex: i },
        } as FaceProperties);
        this.faceIndexToId.set(i, face.id);
      }
    }
  }

  // ─── 查找 ───

  findPointByLabel(label: string): string | null {
    for (const entity of Object.values(this.entities)) {
      if (entity.type === 'point') {
        const p = entity.properties as PointProperties;
        if (p.label === label) return entity.id;
      }
    }
    return null;
  }

  getVertexPosition(vertexIndex: number): Vec3 | null {
    if (!this.builderResult) return null;
    if (this.builderResult.kind === 'polyhedron') {
      const v = (this.builderResult as PolyhedronResult).vertices[vertexIndex];
      return v ? v.position : null;
    } else {
      const p = (this.builderResult as SurfaceResult).featurePoints[vertexIndex];
      return p ? p.position : null;
    }
  }

  getVertexPositionByLabel(label: string): Vec3 | null {
    if (!this.builderResult) return null;
    if (this.builderResult.kind === 'polyhedron') {
      const v = (this.builderResult as PolyhedronResult).vertices.find((v) => v.label === label);
      return v ? v.position : null;
    } else {
      const p = (this.builderResult as SurfaceResult).featurePoints.find((p) => p.label === label);
      return p ? p.position : null;
    }
  }

  getPointPositionById(pointId: string): Vec3 {
    const entity = this.entities[pointId] as Entity<'point'>;
    const p = entity.properties as PointProperties;
    if (p.constraint.type === 'vertex') return this.getVertexPosition(p.constraint.vertexIndex)!;
    if (p.constraint.type === 'edge') {
      const start = this.getVertexPosition(p.constraint.edgeStart)!;
      const end = this.getVertexPosition(p.constraint.edgeEnd)!;
      const t = p.constraint.t;
      return [
        start[0] + t * (end[0] - start[0]),
        start[1] + t * (end[1] - start[1]),
        start[2] + t * (end[2] - start[2]),
      ];
    }
    if (p.constraint.type === 'free') return p.constraint.position as Vec3;
    throw new Error(`不支持的约束类型: ${p.constraint.type}`);
  }

  findFaceByIndex(faceIndex: number): string | null {
    return this.faceIndexToId.get(faceIndex) ?? null;
  }

  findBuiltInSegment(vertexIdx1: number, vertexIdx2: number): string | null {
    return this.edgeToSegmentId.get(`${vertexIdx1}-${vertexIdx2}`) ?? null;
  }

  getFaceVertexPositions(faceIndex: number): Vec3[] {
    if (this.builderResult?.kind === 'polyhedron') {
      const poly = this.builderResult as PolyhedronResult;
      return poly.faces[faceIndex].map((idx) => poly.vertices[idx].position);
    }
    return [];
  }

  getSegmentEndpoints(segmentId: string): [Vec3, Vec3] {
    const seg = this.entities[segmentId] as Entity<'segment'>;
    const props = seg.properties as SegmentProperties;
    return [this.getPointPositionById(props.startPointId), this.getPointPositionById(props.endPointId)];
  }

  getFacePositionsByEntityId(faceId: string): Vec3[] {
    const face = this.entities[faceId] as Entity<'face'>;
    const props = face.properties as FaceProperties;
    return props.pointIds.map((pid) => this.getPointPositionById(pid));
  }

  // ─── 构造方法 ───

  addSegment(startLabel: string, endLabel: string, options?: { color?: string; dashed?: boolean }): string {
    const startId = this.findPointByLabel(startLabel);
    const endId = this.findPointByLabel(endLabel);
    if (!startId || !endId) throw new Error(`addSegment: 点 "${startLabel}" 或 "${endLabel}" 不存在`);
    const seg = this.createEntity('segment', {
      builtIn: false, geometryId: this.activeGeometryId!,
      startPointId: startId, endPointId: endId,
      style: { color: options?.color ?? '#e74c3c', dashed: options?.dashed ?? false },
    } as SegmentProperties);
    return seg.id;
  }

  addEdgePoint(label: string, edgeStartVertex: number, edgeEndVertex: number, t: number = 0.5): string {
    const point = this.createEntity('point', {
      builtIn: false, geometryId: this.activeGeometryId!,
      constraint: { type: 'edge', edgeStart: edgeStartVertex, edgeEnd: edgeEndVertex, t },
      label,
    } as PointProperties);
    return point.id;
  }

  addFreePoint(label: string, position: [number, number, number]): string {
    const point = this.createEntity('point', {
      builtIn: false, geometryId: this.activeGeometryId!,
      constraint: { type: 'free', position },
      label,
    } as PointProperties);
    return point.id;
  }

  addCustomFace(
    pointLabels: string[],
    source?: { type: 'crossSection'; definingPointIds: string[] },
  ): string {
    const pointIds = pointLabels.map((l) => {
      const id = this.findPointByLabel(l);
      if (!id) throw new Error(`addCustomFace: 点 "${l}" 不存在`);
      return id;
    });
    const face = this.createEntity('face', {
      builtIn: false, geometryId: this.activeGeometryId!,
      pointIds,
      source: source ?? ({ type: 'custom' } as FaceProperties['source']),
    } as FaceProperties);
    return face.id;
  }

  addCircumSphere(): void {
    this.createEntity('circumSphere', {
      geometryId: this.activeGeometryId!,
    } as CircumSphereProperties);
  }

  addCoordinateSystem(originLabel: string): void {
    const originId = this.findPointByLabel(originLabel);
    if (!originId) return;
    let axes: [[number, number, number], [number, number, number], [number, number, number]] | undefined;
    if (this.builderResult && this.activeGeometryType) {
      const originProps = (this.entities[originId] as Entity<'point'>).properties as PointProperties;
      if (originProps.constraint.type === 'vertex') {
        const cs = buildCoordinateSystem(this.activeGeometryType, this.builderResult, originProps.constraint.vertexIndex);
        if (cs) {
          axes = cs.axes as [[number, number, number], [number, number, number], [number, number, number]];
        }
      }
    }
    this.createEntity('coordinateSystem', {
      originPointId: originId,
      geometryId: this.activeGeometryId!,
      ...(axes ? { axes } : {}),
    } as CoordinateSystemProperties);
  }

  addCoordinateSystemWithUpZ(originLabel: string, xDirStartLabel: string, xDirEndLabel: string): void {
    const originId = this.findPointByLabel(originLabel)!;
    const startPos = this.getVertexPositionByLabel(xDirStartLabel)!;
    const endPos = this.getVertexPositionByLabel(xDirEndLabel)!;
    const dx = endPos[0] - startPos[0];
    const dz = endPos[2] - startPos[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    const xAxis: [number, number, number] = [dx / len, 0, dz / len];
    const zAxis: [number, number, number] = [0, 1, 0];
    const yAxis: [number, number, number] = [
      zAxis[1] * xAxis[2] - zAxis[2] * xAxis[1],
      zAxis[2] * xAxis[0] - zAxis[0] * xAxis[2],
      zAxis[0] * xAxis[1] - zAxis[1] * xAxis[0],
    ];
    this.createEntity('coordinateSystem', {
      originPointId: originId,
      geometryId: this.activeGeometryId!,
      axes: [xAxis, yAxis, zAxis],
    } as CoordinateSystemProperties);
  }

  // ─── 度量方法 ───

  addDihedralAngle(faceId1: string, faceId2: string, edgeStartPos: Vec3, edgeEndPos: Vec3): void {
    const face1Points = this.getFacePositionsByEntityId(faceId1);
    const face2Points = this.getFacePositionsByEntityId(faceId2);
    const result = calculateDihedralAngle(edgeStartPos, edgeEndPos, face1Points, face2Points);
    this.createEntity('angleMeasurement', {
      geometryId: this.activeGeometryId!, kind: 'dihedral' as AngleMeasurementKind,
      entityIds: [faceId1, faceId2],
      angleRadians: result.radians, angleLatex: result.latex, angleDegrees: result.degrees,
    } as AngleMeasurementProperties);
  }

  addLineFaceAngle(segmentId: string, faceId: string): void {
    const [start, end] = this.getSegmentEndpoints(segmentId);
    const facePoints = this.getFacePositionsByEntityId(faceId);
    const result = calculateLineFaceAngle(start, end, facePoints);
    this.createEntity('angleMeasurement', {
      geometryId: this.activeGeometryId!, kind: 'lineFace' as AngleMeasurementKind,
      entityIds: [segmentId, faceId],
      angleRadians: result.radians, angleLatex: result.latex, angleDegrees: result.degrees,
    } as AngleMeasurementProperties);
  }

  addLineLineAngle(segmentId1: string, segmentId2: string): void {
    const [start1, end1] = this.getSegmentEndpoints(segmentId1);
    const [start2, end2] = this.getSegmentEndpoints(segmentId2);
    const result = calculateLineLineAngle(start1, end1, start2, end2);
    this.createEntity('angleMeasurement', {
      geometryId: this.activeGeometryId!, kind: 'lineLine' as AngleMeasurementKind,
      entityIds: [segmentId1, segmentId2],
      angleRadians: result.radians, angleLatex: result.latex, angleDegrees: result.degrees,
    } as AngleMeasurementProperties);
  }

  addPointFaceDistance(pointLabel: string, faceIndex: number): void {
    const pointId = this.findPointByLabel(pointLabel)!;
    const faceId = this.findFaceByIndex(faceIndex)!;
    const pointPos = this.getPointPositionById(pointId);
    const facePoints = this.getFaceVertexPositions(faceIndex);
    const result = calculatePointFaceDistance(pointPos, facePoints);
    this.createEntity('distanceMeasurement', {
      geometryId: this.activeGeometryId!, kind: 'pointFace' as DistanceMeasurementKind,
      entityIds: [pointId, faceId],
      distanceValue: result.value, distanceLatex: result.latex, distanceApprox: result.approxStr,
    } as DistanceMeasurementProperties);
  }

  addPointFaceDistanceByFaceId(pointLabel: string, faceId: string): void {
    const pointId = this.findPointByLabel(pointLabel)!;
    const pointPos = this.getPointPositionById(pointId);
    const facePoints = this.getFacePositionsByEntityId(faceId);
    const result = calculatePointFaceDistance(pointPos, facePoints);
    this.createEntity('distanceMeasurement', {
      geometryId: this.activeGeometryId!, kind: 'pointFace' as DistanceMeasurementKind,
      entityIds: [pointId, faceId],
      distanceValue: result.value, distanceLatex: result.latex, distanceApprox: result.approxStr,
    } as DistanceMeasurementProperties);
  }

  addLineLineDistance(segmentId1: string, segmentId2: string): void {
    const [start1, end1] = this.getSegmentEndpoints(segmentId1);
    const [start2, end2] = this.getSegmentEndpoints(segmentId2);
    const result = calculateLineLineDistance(start1, end1, start2, end2);
    this.createEntity('distanceMeasurement', {
      geometryId: this.activeGeometryId!, kind: 'lineLine' as DistanceMeasurementKind,
      entityIds: [segmentId1, segmentId2],
      distanceValue: result.value, distanceLatex: result.latex, distanceApprox: result.approxStr,
    } as DistanceMeasurementProperties);
  }

  getSnapshot(): SceneSnapshot {
    return { entities: this.entities, nextId: this.nextId, activeGeometryId: this.activeGeometryId };
  }

  // 暴露内部映射（供 compiler 初始化 context）
  getVertexToPointId(): Map<number, string> { return this.vertexToPointId; }
  getBuilderResult(): BuilderResult | null { return this.builderResult; }
  getActiveGeometryType(): GeometryType | null { return this.activeGeometryType; }
}

// ═══════════════════════════════════════════════════════════
// 主编译函数
// ═══════════════════════════════════════════════════════════

/**
 * 编译单条 DSL 指令为 SceneSnapshot
 *
 * @example
 * ```ts
 * const result = compileInstruction({
 *   id: 'cube-S05-1',
 *   geometry: { type: 'cube', params: { sideLength: 2 } },
 *   constructions: [
 *     { type: 'segment', from: 'B', to: 'D', color: '#3498db', dashed: true },
 *     { type: 'face', label: 'diagFace', points: ['B', 'D', 'D₁', 'B₁'] },
 *   ],
 *   measurements: [
 *     { kind: 'dihedral_angle', face1: '底面', face2: 'diagFace' },
 *   ],
 * }, { debug: true });
 *
 * console.log(result.logs); // 查看编译过程
 * ```
 */
export function compileInstruction(instruction: SceneInstruction, options?: CompileOptions): CompileResult {
  const debug = options?.debug ?? false;
  const logs: string[] = [];

  // 1. 创建几何体
  const builder = new InternalBuilder();
  const { type, params } = instruction.geometry;

  if (debug) logs.push(`[1/6] 创建几何体: ${type}(${JSON.stringify(params)})`);
  builder.createGeometry(type, params as GeometryParams[typeof type]);

  // 2. 加载环境
  const env = getGeometryEnv(type, params);
  if (debug) logs.push(`[2/6] 加载环境: ${env.vertices.length}个顶点, ${Object.keys(env.faces).length}个面`);

  // 3. 建立编译上下文
  const labelToVertexIndex = new Map<string, number>();
  for (let i = 0; i < env.vertices.length; i++) {
    labelToVertexIndex.set(env.vertices[i], i);
  }

  const ctx: CompileContext = {
    instructionId: instruction.id,
    env,
    labelToVertexIndex,
    knownLabels: new Set(env.vertices),
    constructedFaces: new Map(),
    constructedSegments: new Map(),
    builder: {
      findPointByLabel: (l) => builder.findPointByLabel(l),
      findBuiltInSegment: (i1, i2) => builder.findBuiltInSegment(i1, i2),
      findFaceByIndex: (fi) => builder.findFaceByIndex(fi),
      getVertexPositionByLabel: (l) => builder.getVertexPositionByLabel(l),
      getPointPositionById: (pid) => builder.getPointPositionById(pid),
      getFacePositionsByEntityId: (fid) => builder.getFacePositionsByEntityId(fid),
      getSegmentEndpoints: (sid) => builder.getSegmentEndpoints(sid),
      addCustomFace: (labels, source) => builder.addCustomFace(labels, source),
    },
    logs,
    debug,
  };

  // 4. 逐步编译 constructions
  if (instruction.constructions) {
    if (debug) logs.push(`[3/6] 编译 ${instruction.constructions.length} 个构造步骤`);
    for (let i = 0; i < instruction.constructions.length; i++) {
      compileConstruction(ctx, builder, instruction.constructions[i], i);
    }
  } else {
    if (debug) logs.push(`[3/6] 无构造步骤`);
  }

  // 5. 编译 measurements
  if (instruction.measurements) {
    if (debug) logs.push(`[4/6] 编译 ${instruction.measurements.length} 个度量`);
    for (let i = 0; i < instruction.measurements.length; i++) {
      compileMeasurement(ctx, builder, instruction.measurements[i], i);
    }
  } else {
    if (debug) logs.push(`[4/6] 无度量`);
  }

  // 6. 编译 coordinateSystem
  if (instruction.coordinateSystem) {
    if (debug) logs.push(`[5/6] 编译坐标系: origin=${instruction.coordinateSystem.origin}`);
    compileCoordinateSystem(ctx, builder, instruction.coordinateSystem);
  } else {
    if (debug) logs.push(`[5/6] 无坐标系`);
  }

  // 7. 编译 circumSphere
  if (instruction.circumSphere) {
    if (debug) logs.push(`[6/6] 添加外接球`);
    builder.addCircumSphere();
  } else {
    if (debug) logs.push(`[6/6] 无外接球`);
  }

  if (debug) logs.push(`编译完成: ${instruction.id}`);

  return { snapshot: builder.getSnapshot(), logs };
}

// ═══════════════════════════════════════════════════════════
// 构造步骤编译
// ═══════════════════════════════════════════════════════════

function compileConstruction(
  ctx: CompileContext,
  builder: InternalBuilder,
  step: Construction,
  stepIndex: number,
): void {
  log(ctx, `  step[${stepIndex}] ${step.type}: ${JSON.stringify(step)}`);

  switch (step.type) {
    case 'midpoint': {
      // midpoint 是 edge_point 的语法糖，t=0.5
      checkNewLabel(ctx, step.label, stepIndex);
      const [startLabel, endLabel] = step.of;
      assertLabelExists(ctx, startLabel, 'construction');
      assertLabelExists(ctx, endLabel, 'construction');

      const startIdx = ctx.labelToVertexIndex.get(startLabel);
      const endIdx = ctx.labelToVertexIndex.get(endLabel);

      if (startIdx !== undefined && endIdx !== undefined) {
        builder.addEdgePoint(step.label, startIdx, endIdx, 0.5);
      } else {
        // 非内置顶点，用 free_point（计算中点坐标）
        const startPos = builder.getVertexPositionByLabel(startLabel) ?? builder.getPointPositionById(resolveLabel(ctx, startLabel, 'construction'));
        const endPos = builder.getVertexPositionByLabel(endLabel) ?? builder.getPointPositionById(resolveLabel(ctx, endLabel, 'construction'));
        const mid: [number, number, number] = [
          (startPos[0] + endPos[0]) / 2,
          (startPos[1] + endPos[1]) / 2,
          (startPos[2] + endPos[2]) / 2,
        ];
        builder.addFreePoint(step.label, mid);
      }

      ctx.knownLabels.add(step.label);
      log(ctx, `    → 创建中点 "${step.label}" on [${step.of.join(',')}]`);
      break;
    }

    case 'edge_point': {
      checkNewLabel(ctx, step.label, stepIndex);
      const [startLabel, endLabel] = step.edge;
      assertLabelExists(ctx, startLabel, 'construction');
      assertLabelExists(ctx, endLabel, 'construction');

      const startIdx = ctx.labelToVertexIndex.get(startLabel);
      const endIdx = ctx.labelToVertexIndex.get(endLabel);

      if (startIdx !== undefined && endIdx !== undefined) {
        builder.addEdgePoint(step.label, startIdx, endIdx, step.t);
      } else {
        const startPos = builder.getVertexPositionByLabel(startLabel) ?? builder.getPointPositionById(resolveLabel(ctx, startLabel, 'construction'));
        const endPos = builder.getVertexPositionByLabel(endLabel) ?? builder.getPointPositionById(resolveLabel(ctx, endLabel, 'construction'));
        const pos: [number, number, number] = [
          startPos[0] + step.t * (endPos[0] - startPos[0]),
          startPos[1] + step.t * (endPos[1] - startPos[1]),
          startPos[2] + step.t * (endPos[2] - startPos[2]),
        ];
        builder.addFreePoint(step.label, pos);
      }

      ctx.knownLabels.add(step.label);
      log(ctx, `    → 创建棱上点 "${step.label}" on [${step.edge.join(',')}] t=${step.t}`);
      break;
    }

    case 'free_point': {
      checkNewLabel(ctx, step.label, stepIndex);
      builder.addFreePoint(step.label, step.position);
      ctx.knownLabels.add(step.label);
      log(ctx, `    → 创建自由点 "${step.label}" at [${step.position.join(',')}]`);
      break;
    }

    case 'centroid': {
      checkNewLabel(ctx, step.label, stepIndex);
      for (const l of step.of) {
        assertLabelExists(ctx, l, 'construction');
      }
      // 计算质心坐标
      const positions = step.of.map((l) => {
        return builder.getVertexPositionByLabel(l) ?? builder.getPointPositionById(resolveLabel(ctx, l, 'construction'));
      });
      const n = positions.length;
      const centroid: [number, number, number] = [
        positions.reduce((s, v) => s + v[0], 0) / n,
        positions.reduce((s, v) => s + v[1], 0) / n,
        positions.reduce((s, v) => s + v[2], 0) / n,
      ];
      builder.addFreePoint(step.label, centroid);
      ctx.knownLabels.add(step.label);
      log(ctx, `    → 创建质心 "${step.label}" of [${step.of.join(',')}] at [${centroid.map(v => v.toFixed(3)).join(',')}]`);
      break;
    }

    case 'segment': {
      assertLabelExists(ctx, step.from, 'construction');
      assertLabelExists(ctx, step.to, 'construction');
      const segId = builder.addSegment(step.from, step.to, {
        color: step.color,
        dashed: step.dashed,
      });
      // 记录自定义线段
      ctx.constructedSegments.set(`${step.from}-${step.to}`, segId);
      log(ctx, `    → 创建线段 ${step.from}→${step.to} id=${segId}`);
      break;
    }

    case 'face': {
      if (step.points.length < 3) {
        throw facePointsTooFew(ctx.instructionId, stepIndex, step.points.length);
      }
      for (const l of step.points) {
        assertLabelExists(ctx, l, 'construction');
      }

      let faceId: string;
      if (step.style === 'crossSection') {
        const defIds = step.points.map((l) => resolveLabel(ctx, l, 'construction'));
        faceId = builder.addCustomFace(step.points, { type: 'crossSection', definingPointIds: defIds });
      } else {
        faceId = builder.addCustomFace(step.points);
      }

      if (step.label) {
        ctx.constructedFaces.set(step.label, faceId);
      }
      log(ctx, `    → 创建面 [${step.points.join(',')}]${step.label ? ` label="${step.label}"` : ''} id=${faceId}`);
      break;
    }

    default:
      throw new DSLCompileError(ctx.instructionId, 'construction', `未知构造类型: ${(step as Construction).type}`, stepIndex);
  }
}

// ═══════════════════════════════════════════════════════════
// 度量编译
// ═══════════════════════════════════════════════════════════

function compileMeasurement(
  ctx: CompileContext,
  builder: InternalBuilder,
  measurement: Measurement,
  index: number,
): void {
  log(ctx, `  measurement[${index}] ${measurement.kind}`);

  switch (measurement.kind) {
    case 'dihedral_angle': {
      const faceId1 = resolveFaceRef(ctx, measurement.face1, 'measurement');
      const faceId2 = resolveFaceRef(ctx, measurement.face2, 'measurement');
      const face1Points = getFacePositions(ctx, faceId1);
      const face2Points = getFacePositions(ctx, faceId2);

      let edgeStart: Vec3;
      let edgeEnd: Vec3;

      if (measurement.edge) {
        // 显式指定棱
        assertLabelExists(ctx, measurement.edge[0], 'measurement');
        assertLabelExists(ctx, measurement.edge[1], 'measurement');
        edgeStart = builder.getVertexPositionByLabel(measurement.edge[0]) ??
          builder.getPointPositionById(resolveLabel(ctx, measurement.edge[0], 'measurement'));
        edgeEnd = builder.getVertexPositionByLabel(measurement.edge[1]) ??
          builder.getPointPositionById(resolveLabel(ctx, measurement.edge[1], 'measurement'));
      } else {
        // 自动计算交线
        [edgeStart, edgeEnd] = findIntersectionLine(face1Points, face2Points);
        log(ctx, `    交线自动计算: [${edgeStart.map(v => v.toFixed(3))}] → [${edgeEnd.map(v => v.toFixed(3))}]`);
      }

      builder.addDihedralAngle(faceId1, faceId2, edgeStart, edgeEnd);
      log(ctx, `    → 二面角度量完成`);
      break;
    }

    case 'line_face_angle': {
      const segId = resolveLineRef(ctx, measurement.line, 'measurement');
      const faceId = resolveFaceRef(ctx, measurement.face, 'measurement');
      builder.addLineFaceAngle(segId, faceId);
      log(ctx, `    → 线面角度量完成`);
      break;
    }

    case 'line_line_angle': {
      const segId1 = resolveLineRef(ctx, measurement.line1, 'measurement');
      const segId2 = resolveLineRef(ctx, measurement.line2, 'measurement');
      builder.addLineLineAngle(segId1, segId2);
      log(ctx, `    → 线线角度量完成`);
      break;
    }

    case 'point_face_distance': {
      assertLabelExists(ctx, measurement.point, 'measurement');
      const faceId = resolveFaceRef(ctx, measurement.face, 'measurement');

      // 尝试从 faceId 反查 faceIndex（内置面）
      const faceIndex = findFaceIndexOrNull(ctx, faceId);
      if (faceIndex !== null) {
        builder.addPointFaceDistance(measurement.point, faceIndex);
      } else {
        // 自定义面：直接用 faceId
        builder.addPointFaceDistanceByFaceId(measurement.point, faceId);
      }
      log(ctx, `    → 点面距度量完成`);
      break;
    }

    case 'line_line_distance': {
      const segId1 = resolveLineRef(ctx, measurement.line1, 'measurement');
      const segId2 = resolveLineRef(ctx, measurement.line2, 'measurement');
      builder.addLineLineDistance(segId1, segId2);
      log(ctx, `    → 异面距离度量完成`);
      break;
    }

    default:
      throw new DSLCompileError(ctx.instructionId, 'measurement', `未知度量类型: ${(measurement as Measurement).kind}`);
  }
}

// ═══════════════════════════════════════════════════════════
// 坐标系编译
// ═══════════════════════════════════════════════════════════

function compileCoordinateSystem(
  ctx: CompileContext,
  builder: InternalBuilder,
  decl: SceneInstruction['coordinateSystem'] & {},
): void {
  assertLabelExists(ctx, decl.origin, 'coordinateSystem');

  const mode = decl.mode ?? 'auto';

  if (mode === 'upZ' && decl.xDirection) {
    assertLabelExists(ctx, decl.xDirection[0], 'coordinateSystem');
    assertLabelExists(ctx, decl.xDirection[1], 'coordinateSystem');
    builder.addCoordinateSystemWithUpZ(decl.origin, decl.xDirection[0], decl.xDirection[1]);
    log(ctx, `  坐标系: upZ, origin="${decl.origin}", xDir=[${decl.xDirection.join(',')}]`);
  } else {
    builder.addCoordinateSystem(decl.origin);
    log(ctx, `  坐标系: auto, origin="${decl.origin}"`);
  }
}

// ═══════════════════════════════════════════════════════════
// 辅助
// ═══════════════════════════════════════════════════════════

function checkNewLabel(ctx: CompileContext, label: string, stepIndex: number): void {
  if (ctx.knownLabels.has(label)) {
    throw labelDuplicate(ctx.instructionId, label, stepIndex);
  }
}

/**
 * 从 faceId 反查 faceIndex（用于 addPointFaceDistance）
 * 返回 null 表示是自定义面（无 faceIndex）
 */
function findFaceIndexOrNull(ctx: CompileContext, faceId: string): number | null {
  for (const [, index] of Object.entries(ctx.env.faceNameToIndex)) {
    const id = ctx.builder.findFaceByIndex(index);
    if (id === faceId) return index;
  }
  return null;
}
