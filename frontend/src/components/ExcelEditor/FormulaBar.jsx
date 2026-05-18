// frontend/src/components/ExcelEditor/FormulaBar.jsx
import React from 'react';

export default function FormulaBar({ value, onChange, onSubmit }) {
  return (
    <div className="sticky top-[5.75rem] z-20 border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-slate-900 px-3 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
            f(x)
          </span>
          <div className="hidden text-xs text-slate-500 dark:text-slate-400 lg:block">
            Formula bar
          </div>
        </div>

        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onSubmit(value);
            }
          }}
          placeholder="Enter cell content or formula (start with =)"
          className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 font-mono text-sm text-slate-900 outline-none ring-0 transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:ring-blue-900/40"
        />

        <button
          onClick={() => onSubmit(value)}
          className="rounded-2xl bg-blue-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-200 dark:focus:ring-blue-900/50"
        >
          Enter
        </button>

        <div className="text-xs text-slate-500 dark:text-slate-400">
          Press Enter to commit
        </div>
      </div>
    </div>
  );
}
