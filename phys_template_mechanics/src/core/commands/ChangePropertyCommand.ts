import type { Command } from './Command'
import type { SceneBody } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class ChangePropertyCommand implements Command {
  description: string
  private readonly bodyId: string
  private readonly key: keyof SceneBody
  private readonly oldValue: unknown
  private readonly newValue: unknown

  constructor(
    bodyId: string,
    key: keyof SceneBody,
    oldValue: unknown,
    newValue: unknown,
  ) {
    this.bodyId = bodyId
    this.key = key
    this.oldValue = oldValue
    this.newValue = newValue
    this.description = `修改属性 ${String(key)}`
  }

  execute(): void {
    useSceneStore
      .getState()
      .updateBody(this.bodyId, { [this.key]: this.newValue } as Partial<SceneBody>)
  }

  undo(): void {
    useSceneStore
      .getState()
      .updateBody(this.bodyId, { [this.key]: this.oldValue } as Partial<SceneBody>)
  }
}
