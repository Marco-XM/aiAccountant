// frontend/src/components/ExcelEditor/StatusBar.jsx
import React from 'react';
import { columnToLabel } from './editorUtils.js';

export default function StatusBar({
  selectedCells,
  totalRows,
  totalColumns,
  sheetName,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
}) {
  const getStatusText = () => {
    if (selectedCells.length === 0) {
      return `Rows: ${totalRows} | Columns: ${totalColumns}`;
    }

    if (selectedCells.length === 1) {
      const [row, col] = selectedCells[0];
      const colRef = columnToLabel(col);
      return `Cell: ${colRef}${row + 1}`;
    }

    return `Selected: ${selectedCells.length} cells`;
  };

  const saveState = isSaving
    ? 'Saving changes...'
    : hasUnsavedChanges
      ? 'Unsaved changes'
      : lastSavedAt
        ? `Saved ${new Date(lastSavedAt).toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          })}`
        : 'Ready';

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/85 px-4 py-3 text-xs text-slate-500 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80 dark:text-slate-400">
      <div className="flex flex-wrap items-center gap-3">
        <span className="font-medium text-slate-700 dark:text-slate-200">
          {sheetName}
        </span>
        <span>{getStatusText()}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">
          {saveState}
        </span>
      </div>
    </div>
  );
}
