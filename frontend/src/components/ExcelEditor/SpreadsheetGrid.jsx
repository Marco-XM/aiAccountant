// frontend/src/components/ExcelEditor/SpreadsheetGrid.jsx
import React from 'react';
import { columnToLabel, getCellDisplayValue, getCellTitle } from './editorUtils.js';

export default function SpreadsheetGrid({
  sheetData,
  selectedCells,
  onSelectionChange,
  onCellChange,
  onInsertRow,
  onInsertColumn,
  onDeleteRow,
  onDeleteColumn,
}) {
  const handleCellClick = (row, col) => {
    onSelectionChange([[row, col]]);
  };

  const handleCellChange = (row, col, value) => {
    onCellChange(row, col, value);
  };

  const handleContextMenu = (e, row, col) => {
    e.preventDefault();

    const menu = [
      {
        label: 'Insert Row Above',
        onClick: () => onInsertRow('above'),
      },
      {
        label: 'Insert Row Below',
        onClick: () => onInsertRow('below'),
      },
      {
        label: 'Delete Row',
        onClick: () => onDeleteRow(row),
      },
      { divider: true },
      {
        label: 'Insert Column Left',
        onClick: () => onInsertColumn('left'),
      },
      {
        label: 'Insert Column Right',
        onClick: () => onInsertColumn('right'),
      },
      {
        label: 'Delete Column',
        onClick: () => onDeleteColumn(col),
      },
    ];

    // Show context menu (would need ContextMenu component)
    // For now, just call first action
    if (menu[0]) {
      menu[0].onClick();
    }
  };

  if (!sheetData) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-slate-500">
        No sheet selected
      </div>
    );
  }

  const isSelected = (row, col) => {
    return selectedCells.some(([r, c]) => r === row && c === col);
  };

  // Limit visible rows/cols for performance
  const maxVisibleRows = 100;
  const maxVisibleCols = 24;

  if (!sheetData.metadata?.rows || !sheetData.metadata?.columns) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center dark:border-slate-700 dark:bg-slate-900/70">
          <h3 className="text-lg font-semibold">Empty sheet</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Add a sheet or insert rows and columns to start editing.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-[linear-gradient(180deg,rgba(248,250,252,0.8),rgba(241,245,249,0.95))] dark:bg-slate-950">
      <table className="min-w-max border-separate border-spacing-0">
        <thead className="sticky top-0 z-20">
          <tr>
            <th className="sticky left-0 z-30 h-10 w-14 border-b border-r border-slate-200 bg-slate-100/95 text-xs font-semibold text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400" />
            {Array.from({ length: Math.min(maxVisibleCols, sheetData.metadata.columns) }).map(
              (_, col) => (
                <th
                  key={`col-${col}`}
                  className="h-10 min-w-28 border-b border-r border-slate-200 bg-slate-100/95 px-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400"
                >
                  {columnToLabel(col)}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: Math.min(maxVisibleRows, sheetData.metadata.rows) }).map(
            (_, row) => (
              <tr key={`row-${row}`} className="group">
                <th className="sticky left-0 z-10 h-11 w-14 border-b border-r border-slate-200 bg-slate-100/95 text-xs font-semibold text-slate-500 backdrop-blur group-hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400 dark:group-hover:bg-slate-900">
                  {row + 1}
                </th>
                {Array.from({ length: Math.min(maxVisibleCols, sheetData.metadata.columns) }).map(
                  (_, col) => {
                    const cell = sheetData.data[row]?.[col];
                    const selected = isSelected(row, col);
                    const displayValue = getCellDisplayValue(cell);

                    return (
                      <td
                        key={`cell-${row}-${col}`}
                        className={`relative h-11 min-w-28 border-b border-r border-slate-200 p-0 transition-colors dark:border-slate-800 ${
                          selected
                            ? 'bg-blue-50 ring-2 ring-inset ring-blue-500 dark:bg-blue-950/60'
                            : 'bg-white hover:bg-slate-50 dark:bg-slate-950 dark:hover:bg-slate-900/80'
                        }`}
                        onClick={() => handleCellClick(row, col)}
                        onContextMenu={(e) => handleContextMenu(e, row, col)}
                      >
                        <input
                          type="text"
                          value={displayValue}
                          onChange={(e) => handleCellChange(row, col, e.target.value)}
                          className="h-full w-full border-0 bg-transparent px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-0 dark:text-slate-100"
                          title={getCellTitle(cell)}
                          spellCheck={false}
                        />
                      </td>
                    );
                  },
                )}
              </tr>
            ),
          )}
        </tbody>
      </table>
    </div>
  );
}
