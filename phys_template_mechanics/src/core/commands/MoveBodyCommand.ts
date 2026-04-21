import type { Command } from './Command'
import { useSceneStore } from '@/store/sceneStore'

export class MoveBodyCommand implements Command {
  description: string
  private readonly bodyId: string
  private readonly fromPos: { x: number; y: number }
  private readonly toPos: { x: number; y: number }

  constructor(
    bodyId: string,
    fromPos: { x: number; y: number },
    toPos: { x: number; y: number },
  ) {
    this.bodyId = bodyId
    this.fromPos = fromPos
    this.toPos = toPos
    this.description = `移动物体`
  }

  execute(): void {
    useSceneStore.getState().moveBody(this.bodyId, this.toPos)
  }

  undo(): void {
    useSceneStore.getState().moveBody(this.bodyId, this.fromPos)
  }
}
