import type { Command } from './Command'
import type { SceneBody } from '@/models/types'
import { useSceneStore } from '@/store/sceneStore'

/**
 * Command that changes multiple properties of a body at once.
 * Used for resize (width+height) and rotate (angle) operations
 * that may also shift the body position.
 */
export class BatchPropertyCommand implements Command {
  description: string
  private readonly bodyId: string
  private readonly oldProps: Partial<SceneBody>
  private readonly newProps: Partial<SceneBody>

  constructor(
    bodyId: string,
    oldProps: Partial<SceneBody>,
    newProps: Partial<SceneBody>,
    description?: string,
  ) {
    this.bodyId = bodyId
    this.oldProps = oldProps
    this.newProps = newProps
    this.description = description ?? '修改属性'
  }

  execute(): void {
    useSceneStore.getState().updateBody(this.bodyId, this.newProps)
  }

  undo(): void {
    useSceneStore.getState().updateBody(this.bodyId, this.oldProps)
  }
}
