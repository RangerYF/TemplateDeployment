import type { Command } from './Command'
import type { SceneJoint } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class AddJointCommand implements Command {
  description: string
  private readonly joint: SceneJoint

  constructor(joint: SceneJoint) {
    this.joint = joint
    this.description = `添加 ${joint.label}`
  }

  execute(): void {
    useSceneStore.getState().addJoint(this.joint)
  }

  undo(): void {
    useSceneStore.getState().removeJoint(this.joint.id)
  }
}
