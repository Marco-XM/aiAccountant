// frontend/src/stores/syncStore.js
import { create } from 'zustand';

export const useSyncStore = create((set) => ({
  // Sync state
  isSaving: false,
  lastSavedAt: null,
  hasUnsavedChanges: false,
  syncError: null,

  // Pending changes
  pendingChanges: [],
  lastSyncVersion: 0,

  // Actions
  setIsSaving: (saving) => set({ isSaving: saving }),
  setHasUnsavedChanges: (hasChanges) => set({ hasUnsavedChanges: hasChanges }),
  setLastSavedAt: (timestamp) => set({ lastSavedAt: timestamp }),
  setSyncError: (error) => set({ syncError: error }),

  addPendingChange: (change) => {
    set((state) => ({
      pendingChanges: [...state.pendingChanges, change],
      hasUnsavedChanges: true,
    }));
  },

  clearPendingChanges: () => {
    set({
      pendingChanges: [],
      hasUnsavedChanges: false,
    });
  },

  updateLastSyncVersion: (version) => {
    set({ lastSyncVersion: version });
  },
}));
