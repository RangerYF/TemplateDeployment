import type {
  GeometryType,
  CubeParams,
  CuboidParams,
  PyramidParams,
  ConeParams,
  CylinderParams,
  SphereParams,
  RegularTetrahedronParams,
  CornerTetrahedronParams,
  PrismParams,
  TruncatedConeParams,
  FrustumParams,
  IsoscelesTetrahedronParams,
  OrthogonalTetrahedronParams,
} from '../../types/geometry';

// ─── EntityType ───

export type EntityType =
  | 'geometry'
  | 'point'
  | 'segment'
  | 'face'
  | 'coordinateSystem'
  | 'circumSphere'
  | 'circumCircle'
  | 'angleMeasurement'
  | 'distanceMeasurement';

// ─── Properties ───

export interface GeometryProperties {
  geometryType: GeometryType;
  params: CubeParams | CuboidParams | PyramidParams | ConeParams | CylinderParams | SphereParams
    | RegularTetrahedronParams | CornerTetrahedronParams | PrismParams | TruncatedConeParams
    | FrustumParams | IsoscelesTetrahedronParams | OrthogonalTetrahedronParams;
}

export type PointConstraint =
  | { type: 'vertex'; vertexIndex: number }
  | { type: 'edge'; edgeStart: number; edgeEnd: number; t: number }
  | { type: 'curve'; lineIndex: number; t: number }
  | { type: 'coordinate'; coordSystemId: string; coords: [number, number, number] }
  | { type: 'free'; position: [number, number, number] }
  | { type: 'face'; faceId: string; u: number; v: number };

export interface PointProperties {
  builtIn: boolean;
  geometryId: string;
  constraint: PointConstraint;
  label: string;
  positionOverride?: [number, number, number];
}

export interface SegmentProperties {
  builtIn: boolean;
  geometryId: string;
  startPointId: string;
  endPointId: string;
  style: { color: string; dashed: boolean };
  label?: string;
  /** 曲线离散点序列（存在时渲染曲线而非直线） */
  curvePoints?: [number, number, number][];
  /** 曲面体线索引（对应 SurfaceResult.lines 的下标，用于 curve 约束） */
  lineIndex?: number;
}

export type FaceSource =
  | { type: 'geometry'; faceIndex: number }
  | { type: 'crossSection'; definingPointIds: string[] }
  | { type: 'surface'; surfaceType: 'disk' | 'lateral' | 'sphere'; faceIndex: number }
  | { type: 'custom' };

export interface FaceProperties {
  builtIn: boolean;
  geometryId: string;
  pointIds: string[];
  source: FaceSource;
}

export interface CoordinateSystemProperties {
  originPointId: string;
  geometryId: string;
  /** 用户选定的 Z 轴面 Entity ID（法向 → Z 轴方向） */
  zFaceId?: string;
  /** 用户选定的 X 轴参考点 Entity ID（原点→该点方向投影到 Z⊥平面 → X 轴） */
  xRefPointId?: string;
  /** 最终计算出的轴方向（缓存，供 coordinate 约束点的位置计算） */
  axes?: [[number, number, number], [number, number, number], [number, number, number]];
}

export interface CircumSphereProperties {
  geometryId: string;
}

export interface CircumCircleProperties {
  pointIds: [string, string, string];
  geometryId: string;
}

// ─── 角度度量 ───

export type AngleMeasurementKind = 'dihedral' | 'lineFace' | 'lineLine';

export interface AngleMeasurementProperties {
  geometryId: string;
  kind: AngleMeasurementKind;
  /** 引用的实体 ID 列表 */
  entityIds: string[];
  // dihedral: [segmentId]（棱线，自动找两个邻接面）
  // lineFace: [segmentId, faceId]
  // lineLine: [segmentId1, segmentId2]
  /** 缓存的角度值（弧度） */
  angleRadians: number;
  /** 角度精确值 LaTeX */
  angleLatex: string;
  /** 角度近似值（度数） */
  angleDegrees: number;
}

// ─── 距离度量 ───

export type DistanceMeasurementKind = 'pointPoint' | 'pointLine' | 'pointFace' | 'lineLine' | 'lineFace';

export interface DistanceMeasurementProperties {
  geometryId: string;
  kind: DistanceMeasurementKind;
  /** 引用的实体 ID：pointFace=[pointId, faceId]，lineLine=[segmentId1, segmentId2] */
  entityIds: string[];
  distanceValue: number;
  distanceLatex: string;
  distanceApprox: string;
}

// ─── EntityPropertiesMap ───

export interface EntityPropertiesMap {
  geometry: GeometryProperties;
  point: PointProperties;
  segment: SegmentProperties;
  face: FaceProperties;
  coordinateSystem: CoordinateSystemProperties;
  circumSphere: CircumSphereProperties;
  circumCircle: CircumCircleProperties;
  angleMeasurement: AngleMeasurementProperties;
  distanceMeasurement: DistanceMeasurementProperties;
}

export type EntityProperties = EntityPropertiesMap[EntityType];

// ─── Entity ───

export interface Entity<T extends EntityType = EntityType> {
  id: string;
  type: T;
  properties: EntityPropertiesMap[T];
  visible: boolean;
  locked?: boolean;
}

// ─── 类型守卫 ───

export function isGeometryEntity(e: Entity): e is Entity<'geometry'> {
  return e.type === 'geometry';
}

export function isPointEntity(e: Entity): e is Entity<'point'> {
  return e.type === 'point';
}

export function isSegmentEntity(e: Entity): e is Entity<'segment'> {
  return e.type === 'segment';
}

export function isFaceEntity(e: Entity): e is Entity<'face'> {
  return e.type === 'face';
}

export function isCoordinateSystemEntity(e: Entity): e is Entity<'coordinateSystem'> {
  return e.type === 'coordinateSystem';
}

export function isCircumSphereEntity(e: Entity): e is Entity<'circumSphere'> {
  return e.type === 'circumSphere';
}

export function isCircumCircleEntity(e: Entity): e is Entity<'circumCircle'> {
  return e.type === 'circumCircle';
}

export function isAngleMeasurementEntity(e: Entity): e is Entity<'angleMeasurement'> {
  return e.type === 'angleMeasurement';
}

export function isDistanceMeasurementEntity(e: Entity): e is Entity<'distanceMeasurement'> {
  return e.type === 'distanceMeasurement';
}
