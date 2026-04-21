import type { BodyType, ForceType, JointType, SceneBody, SceneForce, SceneJoint } from '@/models/types'

export type TemplateCommandApiCategory =
  | 'scene'
  | 'body'
  | 'placement'
  | 'joint'
  | 'force'

export const TEMPLATE_COMMAND_API_CATEGORIES: ReadonlyArray<{
  category: TemplateCommandApiCategory
  commands: readonly TemplateCommandKind[]
}> = [
  {
    category: 'scene',
    commands: ['setGravity'],
  },
  {
    category: 'body',
    commands: ['addBody', 'patchBody'],
  },
  {
    category: 'placement',
    commands: ['snapTo'],
  },
  {
    category: 'joint',
    commands: ['addJoint', 'patchJoint'],
  },
  {
    category: 'force',
    commands: ['addForce', 'patchForce'],
  },
] as const

export interface Vec2 {
  x: number
  y: number
}

type BodyPatch = Partial<Omit<SceneBody, 'id' | 'type'>>
type JointPatch = Partial<Omit<SceneJoint, 'id' | 'type' | 'bodyIdA' | 'bodyIdB'>>
type ForcePatch = Partial<Omit<SceneForce, 'id' | 'type' | 'targetBodyId'>>

export interface SetGravityCommand {
  kind: 'setGravity'
  gravity: Vec2
}

export interface AddBodyCommand {
  kind: 'addBody'
  ref: string
  bodyType: BodyType
  label?: string
  patch?: BodyPatch
}

export interface PatchBodyCommand {
  kind: 'patchBody'
  bodyRef: string
  patch: BodyPatch
}

export interface SnapToCommand {
  kind: 'snapTo'
  bodyRef: string
  targetBodyRefs?: string[]
  threshold?: number
  allowNoSnap?: boolean
}

export interface AddJointCommand {
  kind: 'addJoint'
  ref: string
  jointType: JointType
  bodyRefA: string
  bodyRefB: string
  pulleyMountRef?: string
  label?: string
  anchorA?: Vec2
  anchorB?: Vec2
  patch?: JointPatch
}

export interface PatchJointCommand {
  kind: 'patchJoint'
  jointRef: string
  patch: JointPatch
}

export interface AddForceCommand {
  kind: 'addForce'
  ref: string
  targetBodyRef: string
  forceType?: ForceType
  label?: string
  patch?: ForcePatch
}

export interface PatchForceCommand {
  kind: 'patchForce'
  forceRef: string
  patch: ForcePatch
}

export type TemplateCommand =
  | SetGravityCommand
  | AddBodyCommand
  | PatchBodyCommand
  | SnapToCommand
  | AddJointCommand
  | PatchJointCommand
  | AddForceCommand
  | PatchForceCommand

export type TemplateCommandKind = TemplateCommand['kind']

export interface TemplateCommandProgram {
  templateId: string
  sceneName: string
  version: '1.0'
  /** 默认 false：若存在非零初速度，必须显式声明 */
  allowNonZeroInitialVelocity?: boolean
  /** 默认 false：若 block/ball 尺寸偏离默认值，必须显式声明 */
  allowCustomBodySize?: boolean
  commands: TemplateCommand[]
}

export interface TemplateCommandRefs {
  bodyIds: Readonly<Record<string, string>>
  jointIds: Readonly<Record<string, string>>
  forceIds: Readonly<Record<string, string>>
}
