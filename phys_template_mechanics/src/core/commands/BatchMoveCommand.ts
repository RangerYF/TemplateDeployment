import type { Command } from './Command'
import { useSceneStore } from '@/store/sceneStore'

/** 一次移动多个物体，Ctrl+Z 一次全部撤销 */
export class BatchMoveCommand implements Command {
  description: string
  private readonly moves: {
    bodyId: string
    fromPos: { x: number; y: number }
    toPos: { x: number; y: number }
  }[]

  constructor(
    moves: {
      bodyId: string
      fromPos: { x: number; y: number }
      toPos: { x: number; y: number }
    }[],
  ) {
    this.moves = moves
    this.description = `移动 ${moves.length} 个物体`
  }

  execute(): void {
    for (const m of this.moves) {
      useSceneStore.getState().moveBody(m.bodyId, m.toPos)
    }
  }

  undo(): void {
    for (const m of this.moves) {
      useSceneStore.getState().moveBody(m.bodyId, m.fromPos)
    }
  }
}
