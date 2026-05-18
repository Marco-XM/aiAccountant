// frontend/src/stores/editorStore.js
import { create } from 'zustand';
import { excelApi } from '../services/api/excelApi';

const createEmptyCell = () => ({
  value: '',
  formula: null,
  type: 'empty',
  format: 'General',
  style: {
    bold: false,
    italic: false,
    color: '000000',
    bgColor: 'FFFFFF',
  },
});

const normalizeCell = (cell) => {
  if (cell && typeof cell === 'object' && !Array.isArray(cell)) {
    return {
      value: cell.value ?? cell.text ?? cell.displayValue ?? '',
      formula: cell.formula ?? null,
      type: cell.type ?? (cell.formula ? 'formula' : 'value'),
      format: cell.format ?? 'General',
      style: {
        bold: Boolean(cell.style?.bold),
        italic: Boolean(cell.style?.italic),
        color: cell.style?.color ?? '000000',
        bgColor: cell.style?.bgColor ?? 'FFFFFF',
      },
    };
  }

  if (cell === null || cell === undefined) {
    return createEmptyCell();
  }

  return {
    value: cell,
    formula: null,
    type: typeof cell === 'number' ? 'number' : 'value',
    format: 'General',
    style: {
      bold: false,
      italic: false,
      color: '000000',
      bgColor: 'FFFFFF',
    },
  };
};

const normalizeRow = (row, columnCount = 0) => {
  const source = Array.isArray(row) ? row : [];
  const totalColumns = Math.max(columnCount, source.length);

  return Array.from({ length: totalColumns }, (_, colIndex) =>
    normalizeCell(source[colIndex]),
  );
};

const normalizeSheet = (sheet, index = 0) => {
  const rawRows = Array.isArray(sheet?.data) ? sheet.data : [];
  const rawColumns = rawRows.reduce(
    (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
    0,
  );

  const rowsFromMeta = Number.isFinite(sheet?.metadata?.rows)
    ? sheet.metadata.rows
    : 0;
  const columnsFromMeta = Number.isFinite(sheet?.metadata?.columns)
    ? sheet.metadata.columns
    : 0;

  const totalRows = Math.max(rowsFromMeta, rawRows.length, 0);
  const totalColumns = Math.max(columnsFromMeta, rawColumns, 0);

  return {
    name: sheet?.name || `Sheet${index + 1}`,
    data: Array.from({ length: totalRows }, (_, rowIndex) =>
      normalizeRow(rawRows[rowIndex], totalColumns),
    ),
    metadata: {
      rows: totalRows,
      columns: totalColumns,
    },
    formulas:
      sheet?.formulas && typeof sheet.formulas === 'object'
        ? { ...sheet.formulas }
        : {},
  };
};

const normalizeSheets = (sheets) =>
  Array.isArray(sheets) ? sheets.map((sheet, index) => normalizeSheet(sheet, index)) : [];

const createBlankSheet = (name, rows = 20, columns = 10) => ({
  name,
  data: Array.from({ length: rows }, () =>
    Array.from({ length: columns }, () => createEmptyCell()),
  ),
  metadata: { rows, columns },
  formulas: {},
});

const ensureSheetGrid = (sheet, minRows = 0, minColumns = 0) => {
  const currentRows = Array.isArray(sheet?.data) ? sheet.data.length : 0;
  const currentColumns = Array.isArray(sheet?.data)
    ? sheet.data.reduce(
        (max, row) => Math.max(max, Array.isArray(row) ? row.length : 0),
        0,
      )
    : 0;

  const rows = Math.max(sheet?.metadata?.rows || 0, currentRows, minRows);
  const columns = Math.max(
    sheet?.metadata?.columns || 0,
    currentColumns,
    minColumns,
  );

  return {
    ...sheet,
    data: Array.from({ length: rows }, (_, rowIndex) => {
      const row = Array.isArray(sheet?.data?.[rowIndex]) ? sheet.data[rowIndex] : [];

      return Array.from({ length: columns }, (_, colIndex) =>
        normalizeCell(row[colIndex]),
      );
    }),
    metadata: {
      ...(sheet?.metadata || { rows: 0, columns: 0 }),
      rows,
      columns,
    },
  };
};

const initialState = {
  sheets: [],
  activeSheetIndex: 0,
  sheetNames: [],
  selectedCells: [],
  editingCell: null,
  formulaBarValue: '',
  fileId: null,
  fileName: '',
  fileType: '',
  canEdit: false,
  isLoading: false,
  error: null,
};

export const useEditorStore = create((set, get) => ({
  ...initialState,

  // Actions - Sheet operations
  resetFileState: () => set({ ...initialState }),
  setSheets: (sheets) =>
    set({
      sheets: normalizeSheets(sheets),
      activeSheetIndex: 0,
    }),
  setActiveSheet: (index) => set({ activeSheetIndex: index }),
  setSelectedCells: (cells) => set({ selectedCells: cells }),
  setEditingCell: (cell) => set({ editingCell: cell }),
  setFormulaBarValue: (value) => set({ formulaBarValue: value }),

  // File operations
  setFileMetadata: (metadata) =>
    set({
      fileId: metadata.fileId,
      fileName: metadata.fileName,
      fileType: metadata.fileType,
      canEdit: Boolean(metadata.canEdit),
      sheetNames: Array.isArray(metadata.sheetNames) ? metadata.sheetNames : [],
    }),

  // Load file data
  loadFileData: async (fileId) => {
    set({ isLoading: true, error: null });
    try {
      const data = await excelApi.getFileData(fileId);
      const normalizedSheets = normalizeSheets(data?.sheets);

      set({
        sheets: normalizedSheets,
        activeSheetIndex: 0,
        isLoading: false,
        error: null,
      });

      return normalizedSheets;
    } catch (err) {
      set({ error: err.message, isLoading: false });
      throw err;
    }
  },

  // Cell update
  updateCell: (sheetIndex, row, col, value, formula = null) => {
    set((state) => {
      const newSheets = state.sheets.map((sheet, idx) => {
        if (idx !== sheetIndex) return sheet;

        const targetSheet = ensureSheetGrid(sheet, row + 1, col + 1);

        const newData = targetSheet.data.map((rowData, rowIdx) =>
          rowData.map((cell, colIdx) => {
            if (rowIdx !== row || colIdx !== col) return cell;

            return {
              ...cell,
              value: value ?? '',
              formula: formula || null,
              type: formula ? 'formula' : 'value',
            };
          }),
        );

        const newFormulas = { ...(targetSheet.formulas || {}) };
        if (formula) {
          const cellRef = get().cellIndexToRef(row, col);
          newFormulas[cellRef] = formula;
        }

        return {
          ...targetSheet,
          data: newData,
          formulas: newFormulas,
        };
      });

      return { sheets: newSheets };
    });
  },

  // Sheet operations
  insertRow: (sheetIndex, atIndex) => {
    set((state) => {
      const newSheets = state.sheets.map((sheet, idx) => {
        if (idx !== sheetIndex) return sheet;

        const targetSheet = ensureSheetGrid(sheet, atIndex + 1, sheet?.metadata?.columns || 0);

        const newRow = Array.from({
          length: targetSheet.metadata.columns,
        }, () => createEmptyCell());
        const newData = [...targetSheet.data];
        newData.splice(atIndex, 0, newRow);

        return {
          ...targetSheet,
          data: newData,
          metadata: {
            ...targetSheet.metadata,
            rows: targetSheet.metadata.rows + 1,
          },
        };
      });

      return { sheets: newSheets };
    });
  },

  insertColumn: (sheetIndex, atIndex) => {
    set((state) => {
      const newSheets = state.sheets.map((sheet, idx) => {
        if (idx !== sheetIndex) return sheet;

        const targetSheet = ensureSheetGrid(sheet, sheet?.metadata?.rows || 0, atIndex + 1);

        const newData = targetSheet.data.map((row) => {
          const newRow = [...row];
          newRow.splice(atIndex, 0, createEmptyCell());
          return newRow;
        });

        return {
          ...targetSheet,
          data: newData,
          metadata: {
            ...targetSheet.metadata,
            columns: targetSheet.metadata.columns + 1,
          },
        };
      });

      return { sheets: newSheets };
    });
  },

  deleteRow: (sheetIndex, atIndex) => {
    set((state) => {
      const newSheets = state.sheets.map((sheet, idx) => {
        if (idx !== sheetIndex) return sheet;

        const newData = sheet.data.filter((_, rowIdx) => rowIdx !== atIndex);

        return {
          ...sheet,
          data: newData,
          metadata: {
            ...sheet.metadata,
            rows: Math.max(0, (sheet.metadata?.rows || newData.length) - 1),
          },
        };
      });

      return { sheets: newSheets };
    });
  },

  deleteColumn: (sheetIndex, atIndex) => {
    set((state) => {
      const newSheets = state.sheets.map((sheet, idx) => {
        if (idx !== sheetIndex) return sheet;

        const newData = sheet.data.map((row) => {
          return row.filter((_, colIdx) => colIdx !== atIndex);
        });

        return {
          ...sheet,
          data: newData,
          metadata: {
            ...sheet.metadata,
            columns: Math.max(0, (sheet.metadata?.columns || 0) - 1),
          },
        };
      });

      return { sheets: newSheets };
    });
  },

  addSheet: (name) => {
    set((state) => {
      const newSheet = createBlankSheet(name || `Sheet${state.sheets.length + 1}`);

      return {
        sheets: [...state.sheets, newSheet],
        sheetNames: [...state.sheetNames, newSheet.name],
      };
    });
  },

  deleteSheet: (index) => {
    set((state) => {
      const newSheets = state.sheets.filter((_, i) => i !== index);
      const newSheetNames = state.sheetNames.filter((_, i) => i !== index);

      return {
        sheets: newSheets,
        sheetNames: newSheetNames,
        activeSheetIndex:
          newSheets.length === 0
            ? 0
            : Math.min(state.activeSheetIndex, newSheets.length - 1),
      };
    });
  },

  renameSheet: (index, newName) => {
    set((state) => {
      const newSheets = state.sheets.map((sheet, idx) => {
        if (idx !== index) return sheet;
        return { ...sheet, name: newName };
      });

      const newSheetNames = state.sheetNames.map((name, idx) => {
        if (idx !== index) return name;
        return newName;
      });

      return {
        sheets: newSheets,
        sheetNames: newSheetNames,
      };
    });
  },

  // Utility
  cellIndexToRef: (row, col) => {
    let colRef = '';
    let c = col + 1;
    while (c > 0) {
      colRef = String.fromCharCode((c - 1) % 26 + 65) + colRef;
      c = Math.floor((c - 1) / 26);
    }
    return `${colRef}${row + 1}`;
  },
}));
