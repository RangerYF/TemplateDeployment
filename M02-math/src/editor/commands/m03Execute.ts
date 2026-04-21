import type { Command } from '@/editor/commands/types';
import { useHistoryStore } from '@/editor/store/historyStore';

/**
 * Execute a command and record it in the shared Undo/Redo history.
 *
 * Mirrors the behaviour of `Editor.execute()` from M02 without requiring a
 * global Editor singleton.  M03 panels call this instead of going through an
 * EditorInjectable instance.
 *
 * Note: `historyStore.execute()` only manages the stacks — it does NOT call
 * `command.execute()` itself.  This function calls both in the correct order.
 *
 * @example
 * ```typescript
 * executeM03Command(new AddEntityCommand(entity));
 * executeM03Command(new UpdateCurveParamCommand(id, before, after));
 * ```
 */
export function executeM03Command(command: Command): void {
  command.execute();
  useHistoryStore.getState().execute(command);
}
