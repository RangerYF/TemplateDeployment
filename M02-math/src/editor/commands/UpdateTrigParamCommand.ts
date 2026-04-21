import type { Command } from '@/editor/commands/types';
import { useTrigStore } from '@/editor/store/trigStore';
import type { TrigParams } from '@/canvas/renderers/trigCurveRenderer';

/**
 * Records a parameter change on the trig comparison canvas (Canvas B)
 * for Undo/Redo via the shared historyStore.
 *
 * Created by `useParamSlider.handleCommit` after the user releases a slider.
 * During drag, the store is updated directly (no command) for live preview.
 *
 * @example
 * ```typescript
 * const aSlider = useParamSlider<number>({
 *   getValue:     () => useTrigStore.getState().userParams.A,
 *   onLiveUpdate: (A) => useTrigStore.getState().setUserParam('A', A),
 *   onCommit: (before, after) =>
 *     editorRef.current?.execute(
 *       new UpdateTrigParamCommand({ A: before }, { A: after }),
 *     ),
 * });
 * ```
 */
export class UpdateTrigParamCommand implements Command {
  readonly type  = 'update-trig-param';
  readonly label = '修改三角函数参数';

  constructor(
    private readonly before: Partial<TrigParams>,
    private readonly after:  Partial<TrigParams>,
  ) {}

  execute(): void {
    useTrigStore.getState().applyTrigParams(this.after);
  }

  undo(): void {
    useTrigStore.getState().applyTrigParams(this.before);
  }
}
