// frontend/src/components/ExcelEditor/SheetTabs.jsx
import React, { useState } from 'react';

export default function SheetTabs({
  sheets,
  activeSheetIndex,
  onSelectSheet,
  onAddSheet,
  onRenameSheet,
  onDeleteSheet,
}) {
  const [renameIndex, setRenameIndex] = useState(null);
  const [renameName, setRenameName] = useState('');

  const handleRenameStart = (index, name) => {
    setRenameIndex(index);
    setRenameName(name);
  };

  const handleRenameSubmit = (index) => {
    if (renameName.trim()) {
      onRenameSheet(index, renameName.trim());
    }
    setRenameIndex(null);
  };

  return (
    <div className="flex items-center gap-3 border-b border-slate-200/80 bg-slate-50/90 px-3 py-3 dark:border-slate-800 dark:bg-slate-900/90">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto">
        {sheets.length === 0 && (
          <div className="rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            No sheets yet
          </div>
        )}

        {sheets.map((sheet, index) => (
          <div
            key={`sheet-${index}`}
            className={`group flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 transition ${
              activeSheetIndex === index
                ? 'border-blue-200 bg-white text-slate-900 shadow-sm dark:border-blue-500/30 dark:bg-slate-800 dark:text-white'
                : 'border-transparent bg-transparent text-slate-500 hover:border-slate-200 hover:bg-white hover:text-slate-800 dark:hover:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-100'
            }`}
          >
            {renameIndex === index ? (
              <input
                type="text"
                value={renameName}
                onChange={(e) => setRenameName(e.target.value)}
                onBlur={() => handleRenameSubmit(index)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleRenameSubmit(index);
                  } else if (e.key === 'Escape') {
                    setRenameIndex(null);
                  }
                }}
                className="min-w-28 rounded-lg border border-blue-200 bg-white px-2 py-1 text-sm outline-none ring-0 dark:border-blue-500/30 dark:bg-slate-900"
                autoFocus
              />
            ) : (
              <>
                <button
                  onClick={() => onSelectSheet(index)}
                  onDoubleClick={() => handleRenameStart(index, sheet.name)}
                  className="max-w-36 truncate text-sm font-medium"
                  title="Select sheet"
                >
                  {sheet.name}
                </button>

                <button
                  onClick={() => onDeleteSheet(index)}
                  className="rounded-full p-1 text-slate-400 opacity-0 transition hover:bg-rose-50 hover:text-rose-600 group-hover:opacity-100 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                  title="Delete sheet"
                >
                  ×
                </button>
              </>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={() => onAddSheet()}
        className="shrink-0 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-200 dark:hover:bg-blue-950/70"
        title="Add new sheet"
      >
        + Sheet
      </button>
    </div>
  );
}
