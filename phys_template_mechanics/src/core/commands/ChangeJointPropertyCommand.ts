import type { Command } from './Command'
import type { SceneJoint } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class ChangeJointPropertyCommand implements Command {
  description: string
  private readonly jointId: string
  private readonly key: keyof SceneJoint
  private readonly oldValue: unknown
  private readonly newValue: unknown

  constructor(
    jointId: string,
    key: keyof SceneJoint,
    oldValue: unknown,
    newValue: unknown,
  ) {
    this.jointId = jointId
    this.key = key
    this.oldValue = oldValue
    this.newValue = newValue
    this.description = `修改约束属性 ${String(key)}`
  }

  execute(): void {
    useSceneStore
      .getState()
      .updateJoint(this.jointId, { [this.key]: this.newValue } as Partial<SceneJoint>)
  }

  undo(): void {
    useSceneStore
      .getState()
      .updateJoint(this.jointId, { [this.key]: this.oldValue } as Partial<SceneJoint>)
  }
}
