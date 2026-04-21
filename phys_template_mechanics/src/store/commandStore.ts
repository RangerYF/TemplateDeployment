import { create } from 'zustand'
import type { Command } from '@/core/commands/Command'

interface CommandState {
  undoStack: Command[]
  redoStack: Command[]
  canUndo: boolean
  canRedo: boolean
}

interface CommandActions {
  execute: (command: Command) => void
  pushExecuted: (command: Command) => void
  undo: () => void
  redo: () => void
  clear: () => void
}

export const useCommandStore = create<CommandState & CommandActions>()(
  (set, get) => ({
    undoStack: [],
    redoStack: [],
    canUndo: false,
    canRedo: false,

    execute: (command) => {
      command.execute()
      const { undoStack } = get()
      const newUndoStack = [...undoStack, command]
      set({
        undoStack: newUndoStack,
        redoStack: [],
        canUndo: true,
        canRedo: false,
      })
    },

    /** Push a command that was already executed (e.g. drag move) */
    pushExecuted: (command) => {
      const { undoStack } = get()
      const newUndoStack = [...undoStack, command]
      set({
        undoStack: newUndoStack,
        redoStack: [],
        canUndo: true,
        canRedo: false,
      })
    },

    undo: () => {
      const { undoStack, redoStack } = get()
      if (undoStack.length === 0) return

      const command = undoStack[undoStack.length - 1]
      command.undo()

      const newUndoStack = undoStack.slice(0, -1)
      const newRedoStack = [...redoStack, command]
      set({
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: newUndoStack.length > 0,
        canRedo: true,
      })
    },

    redo: () => {
      const { undoStack, redoStack } = get()
      if (redoStack.length === 0) return

      const command = redoStack[redoStack.length - 1]
      command.execute()

      const newRedoStack = redoStack.slice(0, -1)
      const newUndoStack = [...undoStack, command]
      set({
        undoStack: newUndoStack,
        redoStack: newRedoStack,
        canUndo: true,
        canRedo: newRedoStack.length > 0,
      })
    },

    clear: () =>
      set({
        undoStack: [],
        redoStack: [],
        canUndo: false,
        canRedo: false,
      }),
  }),
)
