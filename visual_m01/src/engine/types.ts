/** 3D 坐标 */
export type Vec3 = [number, number, number];

/** 带标签的点 */
export interface LabeledPoint {
  position: Vec3;
  label: string;
}

/** 曲面体渲染线条 */
export interface SurfaceLine {
  /** 线条类型标识（generatrix=母线, baseCircle=底圆等） */
  type: string;
  /** 线条点序列 */
  points: Vec3[];
}

/** 曲面体的面 */
export interface SurfaceFace {
  /** 面类型：disk=圆盘面(底/顶), lateral=侧面, sphere=球面 */
  surfaceType: 'disk' | 'lateral' | 'sphere';
  /** 圆盘面的边界采样点（用于渲染多边形近似和 raycasting） */
  samplePoints?: Vec3[];
}

// ─── 判别联合：多面体 vs 曲面体 ───

/** 多面体 Builder 输出 */
export interface PolyhedronResult {
  kind: 'polyhedron';
  /** 顶点（带标签） */
  vertices: LabeledPoint[];
  /** 面索引（每个面由顶点索引组成的多边形，需三角化后渲染） */
  faces: number[][];
  /** 棱线索引 [startVertexIndex, endVertexIndex] */
  edges: [number, number][];
}

/** 曲面体 Builder 输出 */
export interface SurfaceResult {
  kind: 'surface';
  /** Three.js 几何体类型标识 */
  geometryType: 'cone' | 'cylinder' | 'sphere' | 'truncatedCone';
  /** 几何体构造参数（传给对应 Three.js 构造函数） */
  geometryArgs: number[];
  /** 几何体位置偏移（使底面对齐 y=0） */
  positionOffset: Vec3;
  /** 特征点（带标签，如顶点、圆心） */
  featurePoints: LabeledPoint[];
  /** 母线 / 轮廓线 */
  lines: SurfaceLine[];
  /** 曲面体的面（底面/顶面/侧面/球面） */
  faces: SurfaceFace[];
}

/** Builder 统一输出（判别联合） */
export type BuilderResult = PolyhedronResult | SurfaceResult;
