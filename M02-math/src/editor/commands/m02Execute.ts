import type { Command } from '@/editor/commands/types';
import { useHistoryStore } from '@/editor/store/historyStore';

/**
 * Execute a command and record it in the shared Undo/Redo history.
 *
 * Same pattern as `executeM03Command` — avoids depending on the global
 * `editorInstance` singleton which may be null due to module load order or HMR.
 */
export function executeM02Command(command: Command): void {
  command.execute();
  useHistoryStore.getState().execute(command);
}
