// frontend/src/components/ExcelEditor/ExcelEditorPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import useExcelEditor from '../../hooks/useExcelEditor';
import { useAutoSave } from '../../hooks/useAutoSave';
import { useUndoRedoStore } from '../../stores/undoRedoStore';
import { useEditorStore } from '../../stores/editorStore';

import ExcelToolbar from './ExcelToolbar';
import SheetTabs from './SheetTabs';
import FormulaBar from './FormulaBar';
import SpreadsheetGrid from './SpreadsheetGrid';
import StatusBar from './StatusBar';

export default function ExcelEditorPage() {
  const { fileId } = useParams();
  const {
    sheets,
    activeSheet: activeSheetIndex,
    isLoading,
    error,
    changeCell,
    insertRow,
    insertColumn,
    deleteRow,
    deleteColumn,
    addSheet,
    deleteSheet,
    renameSheet,
    setActiveSheet,
    setSelectedCells,
    fileData,
  } = useExcelEditor(fileId);

  const { canUndo, canRedo, undo, redo } = useUndoRedoStore();
  const { selectedCells } = useEditorStore();
  const { isSaving, hasUnsavedChanges, lastSavedAt, manualSave } = useAutoSave(
    fileId
  );

  const [formulaBarValue, setFormulaBarValue] = useState('');
  const [darkMode, setDarkMode] = useState(false);
  const activeSheet = sheets[activeSheetIndex] || null;
  const hasWorkbook = sheets.length > 0;
  const hasVisibleCells = Boolean(
    activeSheet?.metadata?.rows && activeSheet?.metadata?.columns,
  );

  // Update formula bar on selection
  useEffect(() => {
    if (selectedCells.length === 1) {
      const [row, col] = selectedCells[0];
      const cell = sheets[activeSheetIndex]?.data?.[row]?.[col];
      setFormulaBarValue(cell?.formula || cell?.value || '');
    } else {
      setFormulaBarValue('');
    }
  }, [selectedCells, activeSheetIndex, sheets]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4 h-20 animate-pulse rounded-3xl border border-slate-200 bg-white/70 shadow-sm dark:border-slate-800 dark:bg-slate-900/80" />
          <div className="mb-4 h-14 animate-pulse rounded-2xl border border-slate-200 bg-white/60 shadow-sm dark:border-slate-800 dark:bg-slate-900/70" />
          <div className="flex flex-1 flex-col gap-4 overflow-hidden rounded-3xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/80">
            <div className="grid grid-cols-3 gap-3">
              <div className="h-6 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
              <div className="h-6 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
            </div>
            <div className="grid flex-1 grid-cols-1 gap-2 overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
              <div className="h-12 animate-pulse rounded-xl bg-slate-200/80 dark:bg-slate-800/80" />
              <div className="grid flex-1 gap-2">
                {Array.from({ length: 10 }).map((_, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-6 gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-slate-900"
                  >
                    {Array.from({ length: 6 }).map((__, cellIndex) => (
                      <div
                        key={cellIndex}
                        className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-slate-950">
        <div className="w-full max-w-lg rounded-3xl border border-rose-200 bg-white p-8 shadow-xl dark:border-rose-900/50 dark:bg-slate-900">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-2xl dark:bg-rose-900/40">
            !
          </div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-rose-500">
            Workbook load failed
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900 dark:text-white">
            We couldn’t open this spreadsheet
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">
            {error}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Retry loading
            </button>
            <button
              onClick={() => window.location.assign('/excel-editor')}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Upload another file
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(37,99,235,0.08),_transparent_30%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-900 transition-colors dark:bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),linear-gradient(180deg,#020617_0%,#0f172a_100%)] dark:text-slate-50">
        <div className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-3 py-3 sm:px-6 sm:py-6 lg:px-8">
          <div className="mb-4 rounded-3xl border border-white/70 bg-white/85 px-5 py-4 shadow-sm backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-blue-600 dark:text-cyan-400">
                  Spreadsheet workspace
                </p>
                <h1 className="mt-1 truncate text-2xl font-semibold tracking-tight sm:text-3xl">
                  {fileData.fileName || 'Untitled workbook'}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide dark:bg-slate-800">
                    {fileData.fileType || 'spreadsheet'}
                  </span>
                  <span>{sheets.length} sheet{ sheets.length === 1 ? '' : 's' }</span>
                  <span>•</span>
                  <span>{fileData.canEdit ? 'Editable' : 'Read only'}</span>
                  <span>•</span>
                  <span>{hasVisibleCells ? 'Data loaded' : 'No cells detected'}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                  Ctrl/Cmd + S
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                  Ctrl/Cmd + Z
                </span>
                <span className="rounded-full border border-slate-200 bg-white px-3 py-1 dark:border-slate-700 dark:bg-slate-900">
                  Double click tab to rename
                </span>
              </div>
            </div>
          </div>

          <ExcelToolbar
            fileId={fileId}
            fileName={fileData.fileName}
            fileType={fileData.fileType}
            sheetCount={sheets.length}
            onUndo={undo}
            onRedo={redo}
            canUndo={canUndo()}
            canRedo={canRedo()}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
            onSave={manualSave}
            onDarkModeToggle={() => setDarkMode(!darkMode)}
          />

          <FormulaBar
            value={formulaBarValue}
            onChange={setFormulaBarValue}
            onSubmit={(value) => {
              if (selectedCells.length === 1) {
                const [row, col] = selectedCells[0];
                changeCell(row, col, value);
              }
            }}
          />

          <div className="flex-1 overflow-hidden px-0 pb-0 pt-3">
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/70 bg-white/85 shadow-xl backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/80">
              <SheetTabs
                sheets={sheets}
                activeSheetIndex={activeSheetIndex}
                onSelectSheet={setActiveSheet}
                onAddSheet={addSheet}
                onRenameSheet={renameSheet}
                onDeleteSheet={deleteSheet}
              />

              {!hasWorkbook ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-3xl text-blue-600 dark:bg-blue-950 dark:text-cyan-300">
                      +
                    </div>
                    <h2 className="text-xl font-semibold">This workbook is empty</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      Add a new sheet or upload a file to start editing.
                    </p>
                    <div className="mt-6 flex flex-wrap justify-center gap-3">
                      <button
                        onClick={addSheet}
                        className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                      >
                        Add sheet
                      </button>
                      <button
                        onClick={() => window.location.assign('/excel-editor')}
                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
                      >
                        Upload another file
                      </button>
                    </div>
                  </div>
                </div>
              ) : !hasVisibleCells ? (
                <div className="flex flex-1 items-center justify-center p-8">
                  <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
                    <h2 className="text-xl font-semibold">This sheet has no visible cells</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
                      The file loaded correctly, but this sheet does not contain any cells yet.
                    </p>
                    <button
                      onClick={addSheet}
                      className="mt-6 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900"
                    >
                      Add a working sheet
                    </button>
                  </div>
                </div>
              ) : (
                <SpreadsheetGrid
                  sheetData={activeSheet}
                  selectedCells={selectedCells}
                  onSelectionChange={setSelectedCells}
                  onCellChange={(row, col, value) => changeCell(row, col, value)}
                  onInsertRow={insertRow}
                  onInsertColumn={insertColumn}
                  onDeleteRow={deleteRow}
                  onDeleteColumn={deleteColumn}
                />
              )}
            </div>
          </div>

          <StatusBar
            selectedCells={selectedCells}
            totalRows={activeSheet?.metadata?.rows || 0}
            totalColumns={activeSheet?.metadata?.columns || 0}
            sheetName={activeSheet?.name || 'Sheet1'}
            isSaving={isSaving}
            hasUnsavedChanges={hasUnsavedChanges}
            lastSavedAt={lastSavedAt}
          />
        </div>
      </div>
    </div>
  );
}
