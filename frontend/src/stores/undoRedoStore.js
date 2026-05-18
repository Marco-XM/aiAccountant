// frontend/src/stores/undoRedoStore.js
import { create } from 'zustand';

export const useUndoRedoStore = create((set, get) => ({
  undoStack: [],
  redoStack: [],
  maxStackSize: 100,

  // Push state to undo stack
  pushUndo: (state) => {
    set((current) => {
      // Keep only last maxStackSize items
      const newStack = [
        ...current.undoStack.slice(-(current.maxStackSize - 1)),
        state,
      ];

      return {
        undoStack: newStack,
        redoStack: [], // Clear redo when new action
      };
    });
  },

  // Undo to previous state
  undo: () => {
    const { undoStack, redoStack } = get();

    if (undoStack.length === 0) return false;

    const previousState = undoStack[undoStack.length - 1];

    set((state) => ({
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, previousState],
    }));

    return true;
  },

  // Redo to next state
  redo: () => {
    const { redoStack, undoStack } = get();

    if (redoStack.length === 0) return false;

    const nextState = redoStack[redoStack.length - 1];

    set((state) => ({
      redoStack: redoStack.slice(0, -1),
      undoStack: [...undoStack, nextState],
    }));

    return true;
  },

  // Check if can undo/redo
  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  // Clear history
  clearHistory: () => {
    set({
      undoStack: [],
      redoStack: [],
    });
  },

  // Get history size
  getHistorySize: () => ({
    undo: get().undoStack.length,
    redo: get().redoStack.length,
  }),
}));
