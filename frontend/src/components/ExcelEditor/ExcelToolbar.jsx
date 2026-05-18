// frontend/src/components/ExcelEditor/ExcelToolbar.jsx
import React from 'react';
import toast from 'react-hot-toast';
import excelApi from '../../services/api/excelApi';

export default function ExcelToolbar({
  fileId,
  fileName,
  fileType,
  sheetCount,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  isSaving,
  hasUnsavedChanges,
  lastSavedAt,
  onSave,
  onDarkModeToggle,
}) {
  const handleExport = async (format) => {
    try {
      const blob = await excelApi.exportFile(fileId, format);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `export.${format}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Exported as ${format.toUpperCase()}`);
    } catch (error) {
      toast.error(`Export failed: ${error.message}`);
    }
  };

  const formatLastSaved = (date) => {
    if (!date) return 'Never';
    const now = new Date();
    const seconds = Math.floor((now - date) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="sticky top-4 z-30 mb-3 rounded-3xl border border-white/70 bg-white/85 px-4 py-4 shadow-lg backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900">
              XLS
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                Workbook
              </p>
              <h2 className="truncate text-lg font-semibold text-slate-900 dark:text-white">
                {fileName || 'Untitled workbook'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {fileType || 'spreadsheet'} · {sheetCount || 0} sheet{sheetCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          <div className="hidden h-10 w-px bg-slate-200 xl:block dark:bg-slate-800" />

          <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Undo (Ctrl+Z)"
          >
            <span>↶</span>
          </button>

          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Redo (Ctrl+Y)"
          >
            <span>↷</span>
          </button>

          <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>

          {/* Format buttons */}
          <button
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            title="Bold"
          >
            B
          </button>

          <button
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 italic text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            title="Italic"
          >
            I
          </button>

          <button
            className="rounded-2xl border border-slate-200 bg-white px-3 py-2 underline text-slate-800 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            title="Underline"
          >
            U
          </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 xl:min-w-[320px] xl:justify-end">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            {isSaving && <span className="text-blue-600 dark:text-blue-400">Saving...</span>}
            {!isSaving && hasUnsavedChanges && (
              <span className="text-orange-600 dark:text-orange-400">Unsaved changes</span>
            )}
            {!isSaving && !hasUnsavedChanges && lastSavedAt && (
              <span>Saved {formatLastSaved(lastSavedAt)}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onSave}
              className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Save workbook now"
            >
              Save
            </button>

            <button
              onClick={() => handleExport('xlsx')}
              className="rounded-2xl bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
              title="Download as Excel"
            >
              Export XLSX
            </button>

            <button
              onClick={() => handleExport('csv')}
              className="rounded-2xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700"
              title="Download as CSV"
            >
              Export CSV
            </button>

            <button
              onClick={onDarkModeToggle}
              className="rounded-2xl border border-slate-200 bg-white p-2.5 text-sm text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
              title="Toggle dark mode"
            >
              🌓
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
