/**
 * UpdateTransformCommand — M04 Phase 3
 *
 * Records a full-transform snapshot change for Undo/Redo.
 * Created by TrigTransformPanel on slider release (onValueCommit).
 *
 * Stores snapshots of the FULL TrigTransform so that multi-parameter
 * Undo always restores a consistent state, regardless of which slider
 * was adjusted.
 */

import type { Command } from '@/editor/commands/types';
import type { TrigTransform } from '@/types';
import { useM04FunctionStore } from '@/editor/store/m04FunctionStore';

export class UpdateTransformCommand implements Command {
  readonly type  = 'update-trig-transform';
  readonly label = '变换参数';

  constructor(
    private readonly before: TrigTransform,
    private readonly after:  TrigTransform,
  ) {}

  execute(): void {
    useM04FunctionStore.getState().setTransform(this.after);
  }

  undo(): void {
    useM04FunctionStore.getState().setTransform(this.before);
  }
}
