import type { SceneJoint, JointType, SceneBody } from '../types'
import type { JointConfig, JointState } from '@/engine/types'
import type { Viewport } from '@/renderer/CoordinateSystem'

export interface JointPropertyDef {
  key: keyof SceneJoint
  label: string
  type: 'number' | 'select'
  min?: number
  max?: number
  step?: number
  unit?: string
  options?: Array<{ value: string; label: string }>
}

export interface JointTypeDescriptor {
  type: JointType
  label: string
  icon: string
  category: 'constraint'

  /** 默认属性 */
  defaults: Partial<SceneJoint>

  /** 编辑模式渲染 */
  renderEdit(
    ctx: CanvasRenderingContext2D,
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    isSelected: boolean,
    isHovered: boolean,
    viewport: Viewport,
  ): void

  /** 仿真模式渲染 */
  renderSim(
    ctx: CanvasRenderingContext2D,
    jointState: JointState,
    viewport: Viewport,
  ): void

  /** 点击检测 */
  hitTest(
    worldPos: { x: number; y: number },
    joint: SceneJoint,
    bodyA: SceneBody,
    bodyB: SceneBody,
    threshold: number,
  ): boolean

  /** 属性面板字段 */
  properties: JointPropertyDef[]

  /** 转换为引擎配置 */
  toJointConfig(joint: SceneJoint, bodyA: SceneBody, bodyB: SceneBody): JointConfig
}
