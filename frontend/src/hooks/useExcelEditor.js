// frontend/src/hooks/useExcelEditor.js
import { useEffect, useCallback } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useSyncStore } from '../stores/syncStore';
import { excelApi } from '../services/api/excelApi';

export default function useExcelEditor(fileId) {
  const {
    sheets,
    activeSheetIndex,
    selectedCells,
    fileId: storeFileId,
    fileName,
    fileType,
    canEdit,
    sheetNames,
    isLoading,
    error,
    setFileMetadata,
    loadFileData,
    resetFileState,
    updateCell,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    addSheet,
    deleteSheet,
    renameSheet,
  } = useEditorStore();

  const { addPendingChange } = useSyncStore();

  // Load file on mount
  useEffect(() => {
    if (!fileId || storeFileId === fileId) {
      return undefined;
    }

    let cancelled = false;

    const loadFile = async () => {
      try {
        resetFileState();
        useEditorStore.setState({ isLoading: true, error: null });

        const metadata = await excelApi.getFileMetadata(fileId);
        if (cancelled) return;

        setFileMetadata(metadata);
        await loadFileData(fileId);
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load file:', err);
          useEditorStore.setState({
            error: err.message || 'Failed to load file',
            isLoading: false,
          });
        }
      }
    };

    loadFile();

    return () => {
      cancelled = true;
    };
  }, [fileId, storeFileId, setFileMetadata, loadFileData, resetFileState]);

  // Wrapped functions that track changes
  const changeCell = useCallback(
    (row, col, value, formula = null) => {
      updateCell(activeSheetIndex, row, col, value, formula);

      const cellRef = useEditorStore.getState().cellIndexToRef(row, col);
      addPendingChange({
        type: 'cell',
        action: 'set',
        sheetName: sheets[activeSheetIndex]?.name,
        cellRef,
        value,
        formula,
      });
    },
    [activeSheetIndex, sheets, updateCell, addPendingChange]
  );

  const handleInsertRow = useCallback(
    (position = 'after') => {
      const index = selectedCells.length > 0 ? selectedCells[0][0] : 0;
      const atIndex = position === 'after' ? index + 1 : index;

      insertRow(activeSheetIndex, atIndex);

      addPendingChange({
        type: 'row',
        action: 'insert',
        sheetName: sheets[activeSheetIndex]?.name,
        atIndex,
        count: 1,
      });
    },
    [activeSheetIndex, selectedCells, sheets, insertRow, addPendingChange]
  );

  const handleInsertColumn = useCallback(
    (position = 'after') => {
      const index = selectedCells.length > 0 ? selectedCells[0][1] : 0;
      const atIndex = position === 'after' ? index + 1 : index;

      insertColumn(activeSheetIndex, atIndex);

      addPendingChange({
        type: 'column',
        action: 'insert',
        sheetName: sheets[activeSheetIndex]?.name,
        atIndex,
        count: 1,
      });
    },
    [activeSheetIndex, selectedCells, sheets, insertColumn, addPendingChange]
  );

  const handleDeleteRow = useCallback(
    (index) => {
      deleteRow(activeSheetIndex, index);

      addPendingChange({
        type: 'row',
        action: 'delete',
        sheetName: sheets[activeSheetIndex]?.name,
        atIndex: index,
      });
    },
    [activeSheetIndex, sheets, deleteRow, addPendingChange]
  );

  const handleDeleteColumn = useCallback(
    (index) => {
      deleteColumn(activeSheetIndex, index);

      addPendingChange({
        type: 'column',
        action: 'delete',
        sheetName: sheets[activeSheetIndex]?.name,
        atIndex: index,
      });
    },
    [activeSheetIndex, sheets, deleteColumn, addPendingChange]
  );

  return {
    fileData: {
      fileId: storeFileId,
      fileName,
      fileType,
      canEdit,
      sheetNames,
    },
    sheets,
    activeSheet: activeSheetIndex,
    selectedCells,
    isLoading,
    error,

    // Actions
    changeCell,
    insertRow: handleInsertRow,
    insertColumn: handleInsertColumn,
    deleteRow: handleDeleteRow,
    deleteColumn: handleDeleteColumn,
    addSheet,
    deleteSheet,
    renameSheet,

    // Utils
    setActiveSheet: (index) => useEditorStore.setState({ activeSheetIndex: index }),
    setSelectedCells: (cells) => useEditorStore.setState({ selectedCells: cells }),
  };
}
