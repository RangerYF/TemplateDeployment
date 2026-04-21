import type { Command } from '@/editor/commands/types';
import { useEntityStore } from '@/editor/store/entityStore';
import type { ConicEntity } from '@/types';

/**
 * Records a parameter change on a conic entity for Undo/Redo.
 *
 * The `before` and `after` snapshots are complete `ConicEntity` values
 * (including recomputed `derived` fields) so Undo/Redo restores everything
 * — parameters and all derived elements — in one atomic step.
 *
 * Created by `ConicParamPanel` after the user releases a slider.
 * During drag, the store is updated directly (no command) for live preview.
 *
 * @example
 * ```typescript
 * onCommit: (beforeValue, afterValue) => {
 *   if (beforeValue === afterValue) return;
 *   const store = useEntityStore.getState();
 *   const afterEntity = store.entities.find(e => e.id === entityId)!;
 *   const beforeEntity = updateEntityParams(afterEntity, { a: beforeValue });
 *   executeM03Command(
 *     new UpdateCurveParamCommand(entityId, beforeEntity, afterEntity),
 *   );
 * }
 * ```
 */
export class UpdateCurveParamCommand implements Command {
  readonly type  = 'update-curve-param';
  readonly label = '修改曲线参数';

  constructor(
    private readonly entityId: string,
    private readonly before:   ConicEntity,
    private readonly after:    ConicEntity,
  ) {}

  execute(): void {
    useEntityStore.getState().updateEntity(this.entityId, this.after);
  }

  undo(): void {
    useEntityStore.getState().updateEntity(this.entityId, this.before);
  }
}
