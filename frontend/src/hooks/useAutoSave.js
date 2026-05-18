// frontend/src/hooks/useAutoSave.js
import { useEffect, useRef, useState } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSyncStore } from '../stores/syncStore';
import excelApi from '../services/api/excelApi';

export function useAutoSave(fileId, autoSaveInterval = 30000) {
  const { sheets } = useEditorStore();
  const {
    isSaving,
    pendingChanges,
    setIsSaving,
    setLastSavedAt,
    clearPendingChanges,
    setSyncError,
  } = useSyncStore();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [lastSavedAt, setLastSavedAtLocal] = useState(null);
  const timeoutRef = useRef(null);
  const lastSheetsRef = useRef(sheets);

  useEffect(() => {
    setHasUnsavedChanges(pendingChanges.length > 0);
  }, [pendingChanges.length]);

  // Detect changes
  useEffect(() => {
    if (JSON.stringify(sheets) !== JSON.stringify(lastSheetsRef.current)) {
      if (pendingChanges.length === 0) {
        lastSheetsRef.current = sheets;
        setHasUnsavedChanges(false);
        return;
      }

      setHasUnsavedChanges(true);

      // Clear existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Schedule auto-save
      timeoutRef.current = setTimeout(async () => {
        await triggerAutoSave();
      }, autoSaveInterval);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [sheets, autoSaveInterval, pendingChanges.length]);

  const triggerAutoSave = async () => {
    if (!fileId || pendingChanges.length === 0) return;

    setIsSaving(true);
    setSyncError(null);

    try {
      const response = await excelApi.autoSave(fileId, {
        changes: pendingChanges,
        clientTimestamp: new Date(),
      });

      setLastSavedAtLocal(new Date());
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      clearPendingChanges();
      lastSheetsRef.current = sheets;

      return response;
    } catch (error) {
      setSyncError(error.message);
      console.error('Auto-save failed:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const manualSave = async () => {
    return triggerAutoSave();
  };

  return {
    isSaving,
    hasUnsavedChanges,
    lastSavedAt,
    triggerAutoSave,
    manualSave,
  };
}
