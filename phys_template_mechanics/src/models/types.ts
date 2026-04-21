export type BodyType =
  | 'block' | 'ball' | 'ground' | 'slope' | 'wall' | 'anchor'
  | 'pulley-mount' | 'conveyor' | 'hemisphere' | 'half-sphere' | 'groove'

export interface SceneBody {
  id: string
  type: BodyType
  label: string
  position: { x: number; y: number }
  angle: number
  flipped?: boolean
  isStatic: boolean
  fixedRotation: boolean
  // Physics properties
  mass: number // kg
  friction: number // 0-1
  restitution: number // 0-1
  initialVelocity: { x: number; y: number }
  initialAcceleration: { x: number; y: number }
  // Shape properties (by type)
  width?: number // block
  height?: number // block
  radius?: number // ball
  // slope (斜面)
  baseLength?: number // 底边长度 (m)
  slopeHeight?: number // 斜面高度 (m)
  // wall (墙壁)
  wallWidth?: number // 墙壁宽度 (m)
  wallHeight?: number // 墙壁高度 (m)
  // anchor (固定锚点)
  anchorRadius?: number // 锚点半径 (m)
  mountSide?: 'top' | 'left' | 'right' | 'center' // 挂载侧
  // pulley-mount (滑轮座)
  pulleyRadius?: number // 滑轮半径 (m)
  // conveyor (传送带)
  conveyorWidth?: number // 传送带宽度 (m)
  conveyorHeight?: number // 传送带厚度 (m)
  beltSpeed?: number // 皮带速度 (m/s，正=向右)
  // hemisphere (半球面)
  hemisphereRadius?: number // 半球半径 (m)
  hemisphereAngle?: number // 弧线张角 (rad)
  // half-sphere (凸面半球)
  halfSphereRadius?: number // 凸面半球半径 (m)
  // groove (V形槽)
  grooveWidth?: number // V形槽开口宽度 (m)
  grooveDepth?: number // V形槽深度 (m)
  grooveThickness?: number // 槽壁厚度 (m)
}

export interface SceneSettings {
  gravity: { x: number; y: number }
}

export type JointType = 'rope' | 'rod' | 'spring' | 'pulley'

export interface SceneJoint {
  id: string
  type: JointType
  label: string
  bodyIdA: string
  bodyIdB: string
  anchorA: { x: number; y: number } // 物体A上的锚点（局部坐标）
  anchorB: { x: number; y: number } // 物体B上的锚点（局部坐标）
  // Rope 属性
  maxLength?: number // 绳最大长度 (m)
  // Rod 属性
  length?: number // 杆固定长度 (m)
  // Spring 属性
  springLength?: number // 弹簧自然长度 (m)
  stiffness?: number // 刚度 frequencyHz (Hz)
  damping?: number // 阻尼比 (0-1)
  // Pulley 属性
  pulleyMountId?: string // 滑轮座物体 ID
  ratio?: number // 传动比（定滑轮=1，默认1）
  totalLength?: number // 滑轮绳总长 (m)
  sideA?: 'left' | 'right' // A 物体从滑轮哪侧出绳（创建时确定，不再动态计算）
}

export type ForceType = 'external'

export interface SceneForce {
  id: string
  type: ForceType
  targetBodyId: string
  label: string
  magnitude: number
  direction: number
  visible: boolean
  decompose: boolean
  decomposeAngle: number
}

export interface Scene {
  id: string
  name: string
  bodies: SceneBody[]
  joints: SceneJoint[] // Stage 4
  forces: SceneForce[] // Stage 5
  settings: SceneSettings
}
