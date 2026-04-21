import type { Command } from './Command'
import type { SceneForce } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class AddForceCommand implements Command {
  description: string
  private readonly force: SceneForce

  constructor(force: SceneForce) {
    this.force = force
    this.description = `添加 ${force.label}`
  }

  execute(): void {
    useSceneStore.getState().addForce(this.force)
  }

  undo(): void {
    useSceneStore.getState().removeForce(this.force.id)
  }
}
