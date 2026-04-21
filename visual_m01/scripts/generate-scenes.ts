/**
 * 场景数据生成脚本 (v3)
 *
 * 使用方式：npx tsx scripts/generate-scenes.ts
 *
 * v3 改进：
 * - 棱去重：已有内置棱不再创建重复自定义线段
 * - 坐标系修复：pyramid/prism 使用 Z 轴朝上（底面为 XY 平面）
 * - 高度统一为 2（pyramid/prism/cylinder/cone）
 * - S05 场景移除多余高线
 */

import { writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ─── 引入引擎模块 ───

import { buildGeometry } from '../src/engine/builders/index';
import {
  calculateDihedralAngle,
  calculateLineFaceAngle,
  calculateLineLineAngle,
} from '../src/engine/math/angleCalculator';
import {
  calculatePointFaceDistance,
  calculateLineLineDistance,
} from '../src/engine/math/distanceCalculator';
import { buildCoordinateSystem } from '../src/engine/math/coordinates';
import type { BuilderResult, PolyhedronResult, SurfaceResult, Vec3 } from '../src/engine/types';
import type { GeometryType, GeometryParams } from '../src/types/geometry';
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
} from '../src/editor/entities/types';

// ─── EntityBuilder ───

class EntityBuilder {
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

  // ─── 查找方法 ───

  findPointByLabel(label: string): string | null {
    for (const entity of Object.values(this.entities)) {
      if (entity.type === 'point') {
        const p = entity.properties as PointProperties;
        if (p.label === label) return entity.id;
      }
    }
    return null;
  }

  findPointByVertex(vertexIndex: number): string | null {
    return this.vertexToPointId.get(vertexIndex) ?? null;
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
    throw new Error(`Unsupported constraint type: ${p.constraint.type}`);
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

  // ─── 实体创建方法 ───

  addSegment(startLabel: string, endLabel: string, options?: { color?: string; dashed?: boolean }): string {
    const startId = this.findPointByLabel(startLabel);
    const endId = this.findPointByLabel(endLabel);
    if (!startId || !endId) throw new Error(`addSegment: 点 ${startLabel} 或 ${endLabel} 不存在`);
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
      if (!id) throw new Error(`addCustomFace: 点 ${l} 不存在`);
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

  /** 添加坐标系 — cube/cuboid 用 engine 内置算法 */
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

  /** 添加坐标系 — Z 轴朝上，底面为 XY 平面（用于 pyramid/prism） */
  addCoordinateSystemWithUpZ(originLabel: string, xDirStartLabel: string, xDirEndLabel: string): void {
    const originId = this.findPointByLabel(originLabel)!;
    const startPos = this.getVertexPositionByLabel(xDirStartLabel)!;
    const endPos = this.getVertexPositionByLabel(xDirEndLabel)!;

    // X 轴：沿底面棱方向（投影到 y=0 平面）
    const dx = endPos[0] - startPos[0];
    const dz = endPos[2] - startPos[2];
    const len = Math.sqrt(dx * dx + dz * dz);
    const xAxis: [number, number, number] = [dx / len, 0, dz / len];

    // Z 轴：朝上
    const zAxis: [number, number, number] = [0, 1, 0];

    // Y 轴 = Z × X（右手系）
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

  addDihedralAngleByIndex(faceIndex1: number, faceIndex2: number, edgeStartIdx: number, edgeEndIdx: number): void {
    this.addDihedralAngle(
      this.findFaceByIndex(faceIndex1)!, this.findFaceByIndex(faceIndex2)!,
      this.getVertexPosition(edgeStartIdx)!, this.getVertexPosition(edgeEndIdx)!,
    );
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

  getSnapshot() {
    return { entities: this.entities, nextId: this.nextId, activeGeometryId: this.activeGeometryId };
  }
}

// ─── 辅助 ───

function baseCentroid(b: EntityBuilder, vertexIndices: number[]): [number, number, number] {
  const positions = vertexIndices.map((i) => b.getVertexPosition(i)!);
  const n = positions.length;
  return [
    positions.reduce((s, v) => s + v[0], 0) / n,
    positions.reduce((s, v) => s + v[1], 0) / n,
    positions.reduce((s, v) => s + v[2], 0) / n,
  ];
}

// ─── 作品生成清单 ───

interface WorkSpec {
  id: string;
  geometryType: GeometryType;
  params: Record<string, number>;
  enhance?: (builder: EntityBuilder) => void;
}

const WORK_SPECS: WorkSpec[] = [
  // ═══ 正方体（12 个）═══
  // Vertices: A(0) B(1) C(2) D(3) A₁(4) B₁(5) C₁(6) D₁(7)
  // Faces: 0=底面(ADCB) 1=顶面 2=前面(ABB₁A₁) 3=后面 4=左面 5=右面(BCC₁B₁)

  { id: 'cube-S01-1', geometryType: 'cube', params: { sideLength: 2 } },

  { id: 'cube-S02-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      b.addSegment('A', 'C₁', { color: '#e74c3c' });
      b.addSegment('A', 'C', { color: '#3498db', dashed: true });
    },
  },

  { id: 'cube-S03-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => { b.addCircumSphere(); },
  },

  { id: 'cube-S04-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      b.addEdgePoint('M₁', 0, 1, 0.5);
      b.addEdgePoint('M₂', 1, 2, 0.5);
      b.addEdgePoint('M₃', 2, 6, 0.5);
      b.addEdgePoint('M₄', 6, 7, 0.5);
      b.addEdgePoint('M₅', 7, 4, 0.5);
      b.addEdgePoint('M₆', 0, 4, 0.5);
      b.addSegment('M₁', 'M₂', { color: '#e74c3c' });
      b.addSegment('M₂', 'M₃', { color: '#e74c3c' });
      b.addSegment('M₃', 'M₄', { color: '#e74c3c' });
      b.addSegment('M₄', 'M₅', { color: '#e74c3c' });
      b.addSegment('M₅', 'M₆', { color: '#e74c3c' });
      b.addSegment('M₆', 'M₁', { color: '#e74c3c' });
      const defIds = ['M₁', 'M₂', 'M₃'].map((l) => b.findPointByLabel(l)!);
      b.addCustomFace(['M₁', 'M₂', 'M₃', 'M₄', 'M₅', 'M₆'], { type: 'crossSection', definingPointIds: defIds });
    },
  },

  { id: 'cube-S05-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      // [B] 移除多余 AC₁；只保留 BD/B₁D₁ + 二面角度量
      b.addSegment('B', 'D', { color: '#3498db', dashed: true });
      b.addSegment('B₁', 'D₁', { color: '#3498db', dashed: true });
      const diagFaceId = b.addCustomFace(['B', 'D', 'D₁', 'B₁']);
      const bottomFaceId = b.findFaceByIndex(0)!;
      b.addDihedralAngle(bottomFaceId, diagFaceId, b.getVertexPositionByLabel('B')!, b.getVertexPositionByLabel('D')!);
    },
  },

  { id: 'cube-S06-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      // [A] CC₁ 是内置棱不再重复创建
      const diagId = b.addSegment('A', 'C₁', { color: '#e74c3c' });
      b.addSegment('A', 'C', { color: '#3498db', dashed: true });
      b.addLineFaceAngle(diagId, b.findFaceByIndex(0)!);
    },
  },

  { id: 'cube-S07-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      // [A] 用内置棱 ID，不创建重复
      const abId = b.findBuiltInSegment(0, 1)!;      // AB
      const a1d1Id = b.findBuiltInSegment(7, 4)!;    // D₁A₁ (= A₁D₁ 方向)
      b.addLineLineAngle(abId, a1d1Id);
    },
  },

  { id: 'cube-S10-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => { b.addCoordinateSystem('A'); },
  },

  { id: 'cube-S13-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      b.addEdgePoint('E', 0, 1, 0.5);
      b.addEdgePoint('F', 6, 7, 0.5);
      b.addSegment('E', 'F', { color: '#e74c3c' });
      b.addSegment('E', 'B', { color: '#9b59b6', dashed: true });
      b.addSegment('F', 'C₁', { color: '#9b59b6', dashed: true });
      b.addSegment('B', 'C₁', { color: '#3498db', dashed: true });
    },
  },

  { id: 'cube-S07-2', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      // 体对角线AC₁与上底面对角线B₁D₁所成角 = 90°
      const ac1Id = b.addSegment('A', 'C₁', { color: '#e74c3c' });
      const b1d1Id = b.addSegment('B₁', 'D₁', { color: '#3498db', dashed: true });
      b.addLineLineAngle(ac1Id, b1d1Id);
    },
  },

  { id: 'cube-S14-1', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      // BD₁ ⊥ 面ACB₁（线面垂直证明）
      const bd1Id = b.addSegment('B', 'D₁', { color: '#e74c3c' });
      b.addSegment('A', 'C', { color: '#3498db', dashed: true });
      b.addSegment('C', 'B₁', { color: '#3498db', dashed: true });
      b.addSegment('B₁', 'A', { color: '#3498db', dashed: true });
      const faceId = b.addCustomFace(['A', 'C', 'B₁']);
      b.addLineFaceAngle(bd1Id, faceId);
    },
  },

  { id: 'cube-S14-2', geometryType: 'cube', params: { sideLength: 2 },
    enhance: (b) => {
      // 面ABD₁ ⊥ 面A₁BD（面面垂直证明）
      b.addSegment('A', 'D₁', { color: '#e74c3c' });
      b.addSegment('B', 'D₁', { color: '#e74c3c' });
      const face1 = b.addCustomFace(['A', 'B', 'D₁']);
      b.addSegment('A₁', 'D', { color: '#3498db' });
      b.addSegment('B', 'D', { color: '#3498db', dashed: true });
      const face2 = b.addCustomFace(['A₁', 'B', 'D']);
      // 二面角沿两面的交线（过B点，方向(-2,1,-1)）
      const bPos = b.getVertexPositionByLabel('B')!;
      const edgeEnd: Vec3 = [bPos[0] - 2, bPos[1] + 1, bPos[2] - 1];
      b.addDihedralAngle(face1, face2, bPos, edgeEnd);
    },
  },

  // ═══ 长方体（6 个）═══

  { id: 'cuboid-S01-1', geometryType: 'cuboid', params: { length: 3, width: 2, height: 2 } },

  { id: 'cuboid-S02-1', geometryType: 'cuboid', params: { length: 3, width: 2, height: 2 },
    enhance: (b) => {
      b.addSegment('A', 'C₁', { color: '#e74c3c' });
      b.addSegment('A', 'C', { color: '#3498db', dashed: true });
    },
  },

  { id: 'cuboid-S03-1', geometryType: 'cuboid', params: { length: 3, width: 2, height: 2 },
    enhance: (b) => { b.addCircumSphere(); },
  },

  { id: 'cuboid-S06-1', geometryType: 'cuboid', params: { length: 3, width: 2, height: 2 },
    enhance: (b) => {
      const diagId = b.addSegment('A', 'C₁', { color: '#e74c3c' });
      b.addSegment('A', 'C', { color: '#3498db', dashed: true });
      b.addLineFaceAngle(diagId, b.findFaceByIndex(0)!);
    },
  },

  { id: 'cuboid-S07-1', geometryType: 'cuboid', params: { length: 3, width: 2, height: 2 },
    enhance: (b) => {
      const abId = b.findBuiltInSegment(0, 1)!;
      const a1d1Id = b.findBuiltInSegment(7, 4)!;
      b.addLineLineAngle(abId, a1d1Id);
    },
  },

  { id: 'cuboid-S10-1', geometryType: 'cuboid', params: { length: 3, width: 2, height: 2 },
    enhance: (b) => { b.addCoordinateSystem('A'); },
  },

  // ═══ 正四棱锥（7 个）═══  [F] height: 2
  // Vertices: A(0) B(1) C(2) D(3) P(4)
  // Faces: 0=底面(DCBA) 1=ABP 2=BCP 3=CDP 4=DAP

  { id: 'pyramid4-S01-1', geometryType: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 } },

  { id: 'pyramid4-S03-1', geometryType: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 },
    enhance: (b) => { b.addCircumSphere(); },
  },

  { id: 'pyramid4-S05-1', geometryType: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [C] 移除 PO 高线；只保留 M(AB中点)、OM、PM + 二面角度量
      const center = baseCentroid(b, [0, 1, 2, 3]);
      b.addFreePoint('O', center);
      b.addEdgePoint('M', 0, 1, 0.5);
      b.addSegment('O', 'M', { color: '#3498db', dashed: true });
      b.addSegment('P', 'M', { color: '#e74c3c' });
      b.addDihedralAngleByIndex(0, 1, 0, 1);
    },
  },

  { id: 'pyramid4-S06-1', geometryType: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [A] PA 是内置棱，用 findBuiltInSegment
      const center = baseCentroid(b, [0, 1, 2, 3]);
      b.addFreePoint('O', center);
      const paId = b.findBuiltInSegment(0, 4)!;
      b.addSegment('A', 'O', { color: '#3498db', dashed: true });
      b.addSegment('P', 'O', { color: '#9b59b6', dashed: true });
      b.addLineFaceAngle(paId, b.findFaceByIndex(0)!);
    },
  },

  { id: 'pyramid4-S10-1', geometryType: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [D] 底面中心为原点，Z轴朝上
      const center = baseCentroid(b, [0, 1, 2, 3]);
      b.addFreePoint('O', center);
      b.addCoordinateSystemWithUpZ('O', 'A', 'B');
    },
  },

  { id: 'pyramid4-S07-1', geometryType: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 },
    enhance: (b) => {
      // 侧棱PA与对侧底边CD所成角
      const paId = b.findBuiltInSegment(0, 4)!;  // PA
      const cdId = b.findBuiltInSegment(2, 3)!;  // CD
      b.addLineLineAngle(paId, cdId);
    },
  },

  { id: 'pyramid4-S14-1', geometryType: 'pyramid', params: { sides: 4, sideLength: 2, height: 2 },
    enhance: (b) => {
      // 对角面PAC ⊥ 对角面PBD
      b.addSegment('A', 'C', { color: '#e74c3c', dashed: true });
      const face1 = b.addCustomFace(['P', 'A', 'C']);
      b.addSegment('B', 'D', { color: '#3498db', dashed: true });
      const face2 = b.addCustomFace(['P', 'B', 'D']);
      // 二面角沿对称轴PO（Y轴方向）
      const pPos = b.getVertexPositionByLabel('P')!;
      const center = baseCentroid(b, [0, 1, 2, 3]);
      b.addFreePoint('O', center);
      b.addDihedralAngle(face1, face2, pPos, center);
    },
  },

  // ═══ 正三棱锥（4 个）═══  [F] height: 2
  // Vertices: A(0) B(1) C(2) P(3)
  // Faces: 0=底面(CBA) 1=ABP 2=BCP 3=CAP

  { id: 'pyramid3-S01-1', geometryType: 'pyramid', params: { sides: 3, sideLength: 2, height: 2 } },

  { id: 'pyramid3-S03-1', geometryType: 'pyramid', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => { b.addCircumSphere(); },
  },

  { id: 'pyramid3-S05-1', geometryType: 'pyramid', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [C] 移除 PO 高线
      const center = baseCentroid(b, [0, 1, 2]);
      b.addFreePoint('O', center);
      b.addEdgePoint('M', 0, 1, 0.5);
      b.addSegment('O', 'M', { color: '#3498db', dashed: true });
      b.addSegment('P', 'M', { color: '#e74c3c' });
      b.addDihedralAngleByIndex(0, 1, 0, 1);
    },
  },

  { id: 'pyramid3-S10-1', geometryType: 'pyramid', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [D] Z轴朝上
      b.addCoordinateSystemWithUpZ('A', 'A', 'B');
    },
  },

  // ═══ 正三棱柱（8 个）═══  [F] height: 2
  // Vertices: A(0) B(1) C(2) A₁(3) B₁(4) C₁(5)
  // Faces: 0=底面(CBA) 1=顶面(A₁B₁C₁) 2=ABB₁A₁ 3=BCC₁B₁ 4=CAA₁C₁

  { id: 'prism3-S01-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 } },

  { id: 'prism3-S02-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => { b.addSegment('A', 'B₁', { color: '#e74c3c' }); },
  },

  { id: 'prism3-S04-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      b.addEdgePoint('M₁', 1, 4, 0.5);
      b.addEdgePoint('M₂', 2, 5, 0.5);
      b.addSegment('A', 'M₁', { color: '#e74c3c' });
      b.addSegment('M₁', 'M₂', { color: '#e74c3c' });
      b.addSegment('M₂', 'A', { color: '#e74c3c' });
      const defIds = [b.findPointByLabel('A')!, b.findPointByLabel('M₁')!, b.findPointByLabel('M₂')!];
      b.addCustomFace(['A', 'M₁', 'M₂'], { type: 'crossSection', definingPointIds: defIds });
    },
  },

  { id: 'prism3-S05-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      b.addDihedralAngleByIndex(0, 2, 0, 1);
    },
  },

  { id: 'prism3-S07-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [A] 用内置棱 ID
      const abId = b.findBuiltInSegment(0, 1)!;
      const b1c1Id = b.findBuiltInSegment(4, 5)!;
      b.addLineLineAngle(abId, b1c1Id);
    },
  },

  { id: 'prism3-S09-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [A] 用内置棱 ID；公垂线由度量渲染器绘制
      const abId = b.findBuiltInSegment(0, 1)!;
      const a1c1Id = b.findBuiltInSegment(5, 3)!;  // C₁A₁ edge
      b.addLineLineDistance(abId, a1c1Id);
    },
  },

  { id: 'prism3-S10-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      // [E] 手动计算坐标系（engine 不支持 prism 类型）
      b.addCoordinateSystemWithUpZ('A', 'A', 'B');
    },
  },

  { id: 'prism3-S13-1', geometryType: 'prism', params: { sides: 3, sideLength: 2, height: 2 },
    enhance: (b) => {
      b.addEdgePoint('M', 0, 1, 0.5);
      b.addEdgePoint('N', 3, 4, 0.5);
      b.addSegment('M', 'N', { color: '#e74c3c' });
    },
  },

  // ═══ 圆柱（2 个）═══  [F] height: 2

  { id: 'cylinder-S01-1', geometryType: 'cylinder', params: { radius: 1, height: 2 } },

  { id: 'cylinder-S03-1', geometryType: 'cylinder', params: { radius: 1, height: 2 },
    enhance: (b) => { b.addCircumSphere(); },
  },

  // ═══ 圆锥（2 个）═══  [F] height: 2

  { id: 'cone-S01-1', geometryType: 'cone', params: { radius: 1, height: 2 } },

  { id: 'cone-S03-1', geometryType: 'cone', params: { radius: 1, height: 2 },
    enhance: (b) => { b.addCircumSphere(); },
  },

  // ═══ 球（2 个）═══

  { id: 'sphere-S01-1', geometryType: 'sphere', params: { radius: 2 } },
  { id: 'sphere-S04-1', geometryType: 'sphere', params: { radius: 2 } },

  // ═══ 正四面体（3 个）═══
  // Vertices: A(0) B(1) C(2) D(3)
  // Faces: 0=底面(CBA) 1=ABD 2=BCD 3=CAD

  { id: 'regTet-S01-1', geometryType: 'regularTetrahedron', params: { sideLength: 2 } },

  { id: 'regTet-S03-1', geometryType: 'regularTetrahedron', params: { sideLength: 2 },
    enhance: (b) => { b.addCircumSphere(); },
  },

  { id: 'regTet-S08-1', geometryType: 'regularTetrahedron', params: { sideLength: 2 },
    enhance: (b) => {
      const center = baseCentroid(b, [0, 1, 2]);
      b.addFreePoint('H', center);
      b.addSegment('D', 'H', { color: '#e74c3c' });
      b.addPointFaceDistance('D', 0);
    },
  },
];

// ─── 生成主流程 ───

const OUTPUT_DIR = resolve(__dirname, '../src/data/projects/math/m01/scenes');
mkdirSync(OUTPUT_DIR, { recursive: true });

let successCount = 0;
let failCount = 0;

for (const spec of WORK_SPECS) {
  try {
    const builder = new EntityBuilder();
    builder.createGeometry(spec.geometryType, spec.params as GeometryParams[typeof spec.geometryType]);
    if (spec.enhance) spec.enhance(builder);
    const snapshot = builder.getSnapshot();
    writeFileSync(resolve(OUTPUT_DIR, `${spec.id}.json`), JSON.stringify(snapshot, null, 2), 'utf-8');
    successCount++;
    console.log(`✓ ${spec.id}`);
  } catch (err) {
    failCount++;
    console.error(`✗ ${spec.id}:`, err);
  }
}

console.log(`\n生成完成：${successCount} 成功，${failCount} 失败，共 ${WORK_SPECS.length} 个`);
