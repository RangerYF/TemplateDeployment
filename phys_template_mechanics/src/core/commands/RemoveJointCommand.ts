import type { Command } from './Command'
import type { SceneJoint } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class RemoveJointCommand implements Command {
  description: string
  private joint: SceneJoint

  constructor(joint: SceneJoint) {
    this.joint = { ...joint }
    this.description = `删除 ${joint.label}`
  }

  execute(): void {
    useSceneStore.getState().removeJoint(this.joint.id)
  }

  undo(): void {
    useSceneStore.getState().addJoint(this.joint)
  }
}
