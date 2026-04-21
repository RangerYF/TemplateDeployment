import { create } from 'zustand';
import type { Command } from '@/editor/commands/types';

const MAX_DEPTH = 50;

interface HistoryState {
  undoStack: Command[];
  redoStack: Command[];
  canUndo: boolean;
  canRedo: boolean;
  execute: (cmd: Command) => void;
  undo: () => void;
  redo: () => void;
}

export const useHistoryStore = create<HistoryState>((set, get) => ({
  undoStack: [],
  redoStack: [],
  canUndo: false,
  canRedo: false,

  execute(cmd) {
    // Execution already called by Editor.execute(); this method only manages stacks.
    set((s) => {
      const undoStack = [...s.undoStack, cmd].slice(-MAX_DEPTH);
      return { undoStack, redoStack: [], canUndo: true, canRedo: false };
    });
  },

  undo() {
    const { undoStack, redoStack } = get();
    if (undoStack.length === 0) return;
    const cmd = undoStack[undoStack.length - 1];
    cmd.undo();
    set({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, cmd],
      canUndo: undoStack.length > 1,
      canRedo: true,
    });
  },

  redo() {
    const { undoStack, redoStack } = get();
    if (redoStack.length === 0) return;
    const cmd = redoStack[redoStack.length - 1];
    cmd.execute();
    set({
      undoStack: [...undoStack, cmd],
      redoStack: redoStack.slice(0, -1),
      canUndo: true,
      canRedo: redoStack.length > 1,
    });
  },
}));
