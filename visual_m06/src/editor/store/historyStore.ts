import { create } from 'zustand';
import type { Command } from '../commands/types';
import { signals } from '../signals';

const MAX_HISTORY = 50;

interface HistoryStoreState {
  undoStack: Command[];
  redoStack: Command[];
  canUndo: boolean;
  canRedo: boolean;

  execute(command: Command): void;
  undo(): void;
  redo(): void;
}

export const useHistoryStore = create<HistoryStoreState>()((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  execute(command: Command): void {
    command.execute();

    set((state) => {
      const newUndoStack = [...state.undoStack, command];
      if (newUndoStack.length > MAX_HISTORY) {
        newUndoStack.shift();
      }
      return {
        undoStack: newUndoStack,
        redoStack: [],
        canUndo: true,
        canRedo: false,
      };
    });

    signals.commandExecuted.emit({ label: command.label, direction: 'do' });
  },

  undo(): void {
    const state = get();
    if (state.undoStack.length === 0) return;

    const command = state.undoStack[state.undoStack.length - 1];
    command.undo();

    set({
      undoStack: state.undoStack.slice(0, -1),
      redoStack: [...state.redoStack, command],
      canUndo: state.undoStack.length > 1,
      canRedo: true,
    });

    signals.commandExecuted.emit({ label: command.label, direction: 'undo' });
  },

  redo(): void {
    const state = get();
    if (state.redoStack.length === 0) return;

    const command = state.redoStack[state.redoStack.length - 1];
    command.execute();

    set({
      undoStack: [...state.undoStack, command],
      redoStack: state.redoStack.slice(0, -1),
      canUndo: true,
      canRedo: state.redoStack.length > 1,
    });

    signals.commandExecuted.emit({ label: command.label, direction: 'redo' });
  },
}));
