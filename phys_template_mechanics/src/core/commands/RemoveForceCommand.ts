import type { Command } from './Command'
import type { SceneForce } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class RemoveForceCommand implements Command {
  description: string
  private force: SceneForce

  constructor(force: SceneForce) {
    this.force = { ...force }
    this.description = `删除 ${force.label}`
  }

  execute(): void {
    useSceneStore.getState().removeForce(this.force.id)
  }

  undo(): void {
    useSceneStore.getState().addForce(this.force)
  }
}
