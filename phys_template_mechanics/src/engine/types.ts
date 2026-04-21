export type ShapeConfig =
  | { type: 'box'; width: number; height: number }
  | { type: 'circle'; radius: number }
  | { type: 'edge'; x1: number; y1: number; x2: number; y2: number }
  | { type: 'polygon'; vertices: Array<{ x: number; y: number }> }
  | { type: 'chain'; vertices: Array<{ x: number; y: number }>; loop: boolean }

export interface BodyConfig {
  id: string
  type: 'static' | 'dynamic' | 'kinematic'
  position: { x: number; y: number }
  angle: number
  shape: ShapeConfig | ShapeConfig[]
  density: number
  friction: number
  restitution: number
  fixedRotation: boolean
  userData?: {
    bodyType?: string
    beltSpeed?: number
    flipped?: boolean
  }
}

// --- Joint types ---

export type JointConfigType = 'rope' | 'distance' | 'pulley'

export interface JointConfig {
  id: string
  type: JointConfigType
  sceneType?: string // 场景层类型（如 'rod'），用于渲染 descriptor 查找
  bodyIdA: string
  bodyIdB: string
  anchorA: { x: number; y: number } // 世界坐标
  anchorB: { x: number; y: number } // 世界坐标
  // RopeJoint
  maxLength?: number
  // DistanceJoint
  length?: number
  frequencyHz?: number
  dampingRatio?: number
  // PulleyJoint
  groundA?: { x: number; y: number }
  groundB?: { x: number; y: number }
  ratio?: number
  totalLength?: number
}

export interface JointState {
  id: string
  type: JointConfigType
  sceneType?: string // 场景层类型，用于渲染 descriptor 查找
  anchorA: { x: number; y: number } // 世界坐标（仿真时更新）
  anchorB: { x: number; y: number } // 世界坐标
  groundA?: { x: number; y: number } // 滑轮固定点（pulley 用）
  groundB?: { x: number; y: number }
  maxLength?: number // 绳最大长度（rope 用，供松弛渲染）
  length?: number    // 杆/弹簧固定长度（distance 用）
}

// --- Force collection types (6.2) ---

export type CollectedForceType =
  | 'gravity'      // 重力
  | 'gravity_parallel' // 重力沿接触面分力（教学派生）
  | 'gravity_perpendicular' // 重力垂直接触面分力（教学派生）
  | 'normal'       // 支持力（接触法向）
  | 'friction'     // 摩擦力（接触切向）
  | 'static_friction' // 静摩擦（教学派生）
  | 'kinetic_friction' // 滑动摩擦（教学派生）
  | 'tension'      // 张力/弹簧力（约束反力）
  | 'external'     // 用户外力
  | 'resultant'    // 合力（由独立力向量求和计算）

export interface ForceData {
  bodyId: string
  forceType: CollectedForceType
  vector: { x: number; y: number }  // 力向量（N）
  magnitude: number                  // 力大小（N）
  sourceId?: string                  // 来源 ID（jointId 或 forceId）
  label?: string                     // 自定义标签（如 F1、F2，外力用）
  contactNormal?: { x: number; y: number }  // 接触法线方向（仅接触力）
}

export interface BodyState {
  id: string
  position: { x: number; y: number }
  angle: number
  linearVelocity: { x: number; y: number }
  angularVelocity: number
  shape: ShapeConfig
  shapes?: ShapeConfig[]
  type: 'static' | 'dynamic' | 'kinematic'
  userData?: {
    bodyType?: string
    beltSpeed?: number
    flipped?: boolean
  }
}
