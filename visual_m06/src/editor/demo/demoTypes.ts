// ─── 演示台实体类型 ───

export type DemoEntityType =
  | 'demoPoint' | 'demoVector' | 'demoVecOp'
  | 'demoMarker' | 'demoSegment' | 'demoCircle' | 'demoText'
  | 'demoAngleMark' | 'demoDistanceMark'
  | 'demoLine' | 'demoRay' | 'demoPolygon' | 'demoSlider';

export type MotionPath =
  | { kind: 'circular'; cx: number; cy: number; radius: number;
      startAngle: number; speed: number; direction: 1 | -1 }
  | { kind: 'linear'; x1: number; y1: number; x2: number; y2: number;
      speed: number; bounce: boolean };

export interface DemoPoint {
  id: string;
  type: 'demoPoint';
  x: number;
  y: number;
  xExpr?: string;
  yExpr?: string;
  label: string;
  motion?: MotionPath;
  showLocus?: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoVector {
  id: string;
  type: 'demoVector';
  startId: string;
  endId: string;
  color: string;
  label: string;
  showLabel: boolean;
  constraint?: 'free' | 'fixedStart' | 'fixedEnd'
    | 'lineStart' | 'lineEnd' | 'regionStart' | 'regionEnd';
  constraintLength?: number;
  constraintLengthExpr?: string;
  constraintLineP1?: { x: number; y: number };
  constraintLineP2?: { x: number; y: number };
  constraintRegionMin?: { x: number; y: number };
  constraintRegionMax?: { x: number; y: number };
  visible?: boolean;
  opacity?: number;
}

export interface DemoVecOp {
  id: string;
  type: 'demoVecOp';
  kind: 'add' | 'subtract' | 'dotProduct' | 'scale' | 'projection';
  vec1Id: string;
  vec2Id?: string;
  scalarK?: number;
  scalarKExpr?: string;
  originX?: number;
  originY?: number;
  originXExpr?: string;
  originYExpr?: string;
  visible?: boolean;
  opacity?: number;
}

export interface DemoMarker {
  id: string;
  type: 'demoMarker';
  x: number;
  y: number;
  xExpr?: string;
  yExpr?: string;
  label: string;
  color: string;
  showCoord: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoSegment {
  id: string;
  type: 'demoSegment';
  startId: string;
  endId: string;
  color: string;
  style: 'solid' | 'dashed';
  showLength: boolean;
  showSlope?: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoCircle {
  id: string;
  type: 'demoCircle';
  centerId: string;
  radiusPointId: string;
  color: string;
  style: 'solid' | 'dashed';
  fill: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoText {
  id: string;
  type: 'demoText';
  x: number;
  y: number;
  xExpr?: string;
  yExpr?: string;
  text: string;
  fontSize: number;
  color: string;
  latex?: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoAngleMark {
  id: string;
  type: 'demoAngleMark';
  pointAId: string;
  vertexId: string;
  pointCId: string;
  color: string;
  showValue: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoDistanceMark {
  id: string;
  type: 'demoDistanceMark';
  pointAId: string;
  pointBId: string;
  color: string;
  offset: number;
  visible?: boolean;
  opacity?: number;
}

export interface DemoLine {
  id: string;
  type: 'demoLine';
  point1Id: string;
  point2Id: string;
  color: string;
  style: 'solid' | 'dashed';
  showSlope: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoRay {
  id: string;
  type: 'demoRay';
  originId: string;
  throughId: string;
  color: string;
  style: 'solid' | 'dashed';
  visible?: boolean;
  opacity?: number;
}

export interface DemoPolygon {
  id: string;
  type: 'demoPolygon';
  vertexIds: string[];
  color: string;
  fill: boolean;
  showArea: boolean;
  visible?: boolean;
  opacity?: number;
}

export interface DemoSlider {
  id: string;
  type: 'demoSlider';
  x: number;
  y: number;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  width: number;
  color: string;
  visible?: boolean;
  opacity?: number;
}

export type DemoEntity =
  | DemoPoint | DemoVector | DemoVecOp
  | DemoMarker | DemoSegment | DemoCircle | DemoText
  | DemoAngleMark | DemoDistanceMark
  | DemoLine | DemoRay | DemoPolygon | DemoSlider;

/** 端点绑定（两点来自不同向量，始终同步位置） */
export interface DemoBinding {
  id: string;
  pointA: string;
  pointB: string;
}

export interface DemoSnapshot {
  entities: Record<string, DemoEntity>;
  bindings: DemoBinding[];
  nextId: number;
}

// ─── 演示台工具类型 ───

export type DemoTool =
  | 'select' | 'createVector' | 'vectorOp'
  | 'markerPoint' | 'segment' | 'circle' | 'textLabel'
  | 'angleMark' | 'distanceMark'
  | 'perpendicular' | 'parallelLine' | 'midpoint'
  | 'perpBisector' | 'angleBisector' | 'pointLineDist'
  | 'line' | 'ray' | 'polygon'
  | 'translate' | 'rotate' | 'reflect' | 'dilate' | 'centralSymmetry'
  | 'tangent' | 'commonTangent'
  | 'slider';

export type DemoOpKind = 'add' | 'subtract' | 'dotProduct' | 'scale' | 'projection';

// ─── 预设向量色板 ───

export const DEMO_COLORS = [
  '#8C8C8C',
  '#FF6B6B',
  '#4ECDC4',
  '#FFD700',
  '#9C27B0',
  '#2196F3',
  '#FF9800',
  '#00C06B',
  '#90A4AE',
] as const;
