import type { Command } from './Command'
import type { SceneBody } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class AddBodyCommand implements Command {
  description: string
  private readonly body: SceneBody

  constructor(body: SceneBody) {
    this.body = body
    this.description = `添加 ${body.label}`
  }

  execute(): void {
    useSceneStore.getState().addBody(this.body)
  }

  undo(): void {
    useSceneStore.getState().removeBody(this.body.id)
  }
}
