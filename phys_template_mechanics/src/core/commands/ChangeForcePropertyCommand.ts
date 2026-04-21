import type { Command } from './Command'
import type { SceneForce } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

export class ChangeForcePropertyCommand implements Command {
  description: string
  private readonly forceId: string
  private readonly key: keyof SceneForce
  private readonly oldValue: unknown
  private readonly newValue: unknown

  constructor(
    forceId: string,
    key: keyof SceneForce,
    oldValue: unknown,
    newValue: unknown,
  ) {
    this.forceId = forceId
    this.key = key
    this.oldValue = oldValue
    this.newValue = newValue
    this.description = `修改力属性 ${key}`
  }

  execute(): void {
    useSceneStore.getState().updateForce(this.forceId, { [this.key]: this.newValue } as Partial<SceneForce>)
  }

  undo(): void {
    useSceneStore.getState().updateForce(this.forceId, { [this.key]: this.oldValue } as Partial<SceneForce>)
  }
}
