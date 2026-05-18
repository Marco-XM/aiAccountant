// services/excel/excelService.js
const ExcelJS = require('exceljs');
const XLSX = require('xlsx');
const path = require('path');

class ExcelService {
  /**
   * Parse Excel file and extract workbook data
   */
  async parseExcelFile(filePath, originalName = '') {
    try {
      const extFromPath = path.extname(filePath || '').toLowerCase();
      const extFromOriginal = path.extname(originalName || '').toLowerCase();
      const ext = extFromOriginal || extFromPath || '';

      console.log('[excelService] parseExcelFile', { filePath, originalName, extFromPath, extFromOriginal, ext });

      // Handle CSV via xlsx package
      if (ext.endsWith('.csv')) {
        try {
          const wb = XLSX.readFile(filePath, { type: 'file', raw: true });
          const sheets = (wb.SheetNames || []).map((name) => {
            const sheet = wb.Sheets[name];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });
            const data = rows.map((r) => r.map((cell) => ({ value: cell || '' })));
            return {
              name,
              data,
              metadata: {
                rows: rows.length,
                columns: rows[0] ? rows[0].length : 0,
              },
              formulas: {},
            };
          });

          return {
            sheets,
            hasFormulas: false,
            sheetNames: sheets.map((s) => s.name),
          };
        } catch (err) {
          throw new Error(`Failed to parse CSV file: ${err.message}`);
        }
      }

      // Default: treat as xlsx/xls
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.readFile(filePath);

      const sheets = [];
      const formulas = {};

      workbook.eachSheet((worksheet) => {
        const sheetData = [];
        const sheetFormulas = {};

        worksheet.eachRow({ includeEmpty: false }, (row, rowNum) => {
          const rowData = [];

          row.eachCell({ includeEmpty: false }, (cell, colNum) => {
            const cellRef = cell.address;

            const cellData = {
              value: cell.value,
              type: cell.type,
              format: cell.numFmt?.formatCode || 'General',
              formula: null,
              style: {
                bold: cell.font?.bold || false,
                italic: cell.font?.italic || false,
                color: cell.font?.color?.rgb || '000000',
                bgColor: cell.fill?.fgColor?.rgb || 'FFFFFF',
              },
            };

            // Capture formula if present
            if (cell.type === 'formula') {
              cellData.formula = cell.formula;
              sheetFormulas[cellRef] = cell.formula;
            }

            rowData.push(cellData);
          });

          sheetData.push(rowData);
        });

        sheets.push({
          name: worksheet.name,
          data: sheetData,
          metadata: {
            rows: worksheet.lastRow?.number || 0,
            columns: worksheet.lastColumn?.number || 0,
          },
          formulas: sheetFormulas,
        });
      });

      return {
        sheets,
        hasFormulas: Object.keys(formulas).length > 0,
        sheetNames: sheets.map((s) => s.name),
      };
    } catch (error) {
      throw new Error(`Failed to parse Excel file: ${error.message}`);
    }
  }

  /**
   * Generate Excel file from data
   */
  async generateExcelFile(sheets) {
    try {
      const workbook = new ExcelJS.Workbook();

      sheets.forEach((sheetData) => {
        const worksheet = workbook.addWorksheet(sheetData.name);

        sheetData.data.forEach((row, rowIdx) => {
          row.forEach((cell, colIdx) => {
            const excelCell = worksheet.getCell(rowIdx + 1, colIdx + 1);

            if (cell?.formula) {
              excelCell.value = { formula: cell.formula };
            } else {
              excelCell.value = cell?.value || '';
            }

            // Apply formatting
            if (cell?.format) {
              excelCell.numFmt = cell.format;
            }

            if (cell?.style) {
              excelCell.font = {
                bold: cell.style.bold,
                italic: cell.style.italic,
              };
            }
          });
        });

        // Set column widths
        worksheet.columns = sheets[0].data[0]?.map(() => ({
          width: 12,
        })) || [];
      });

      const buffer = await workbook.xlsx.writeBuffer();
      return buffer;
    } catch (error) {
      throw new Error(`Failed to generate Excel file: ${error.message}`);
    }
  }

  /**
   * Apply changes to spreadsheet
   */
  applyChanges(sheets, changes) {
    changes.forEach((change) => {
      const sheetIndex = sheets.findIndex((s) => s.name === change.sheetName);
      if (sheetIndex === -1) return;

      const sheet = sheets[sheetIndex];

      switch (change.type) {
        case 'cell':
          this.applyCellChange(sheet, change);
          break;
        case 'row':
          this.applyRowChange(sheet, change);
          break;
        case 'column':
          this.applyColumnChange(sheet, change);
          break;
      }
    });

    return sheets;
  }

  applyCellChange(sheet, change) {
    const { action, cellRef, value, formula } = change;

    if (action === 'set' || action === 'edit') {
      const { row, col } = this.parseA1Reference(cellRef);

      // Ensure row exists
      while (sheet.data.length <= row) {
        sheet.data.push([]);
      }

      // Ensure column exists
      while (sheet.data[row].length <= col) {
        sheet.data[row].push(null);
      }

      sheet.data[row][col] = {
        value: value || '',
        formula: formula || null,
        type: formula ? 'formula' : 'string',
      };

      if (formula) {
        sheet.formulas[cellRef] = formula;
      } else if (sheet.formulas[cellRef]) {
        delete sheet.formulas[cellRef];
      }

      // Update metadata
      sheet.metadata.rows = Math.max(sheet.metadata.rows, row + 1);
      sheet.metadata.columns = Math.max(sheet.metadata.columns, col + 1);
    }
  }

  applyRowChange(sheet, change) {
    const { action, atIndex, count = 1 } = change;

    if (action === 'insert') {
      for (let i = 0; i < count; i++) {
        const newRow = new Array(sheet.metadata.columns).fill(null);
        sheet.data.splice(atIndex, 0, newRow);
      }
      sheet.metadata.rows += count;
    } else if (action === 'delete') {
      sheet.data.splice(atIndex, count);
      sheet.metadata.rows -= count;
    }
  }

  applyColumnChange(sheet, change) {
    const { action, atIndex, count = 1 } = change;

    if (action === 'insert') {
      sheet.data.forEach((row) => {
        for (let i = 0; i < count; i++) {
          row.splice(atIndex, 0, null);
        }
      });
      sheet.metadata.columns += count;
    } else if (action === 'delete') {
      sheet.data.forEach((row) => {
        row.splice(atIndex, count);
      });
      sheet.metadata.columns -= count;
    }
  }

  /**
   * Parse cell reference (A1, B2, AA5, etc.)
   */
  parseA1Reference(ref) {
    const match = ref.match(/([A-Z]+)(\d+)/i);
    if (!match) throw new Error(`Invalid cell reference: ${ref}`);

    const colStr = match[1].toUpperCase();
    const row = parseInt(match[2]) - 1;

    // Convert column letter to number
    let col = 0;
    for (let i = 0; i < colStr.length; i++) {
      col = col * 26 + (colStr.charCodeAt(i) - 64);
    }
    col--;

    return { row, col };
  }

  /**
   * Validate spreadsheet structure
   */
  validate(sheets) {
    const errors = [];

    sheets.forEach((sheet, sheetIdx) => {
      // Check for circular formulas
      Object.entries(sheet.formulas).forEach(([cellRef, formula]) => {
        if (formula.includes(cellRef)) {
          errors.push({
            type: 'circular_reference',
            sheetName: sheet.name,
            cellRef,
            message: `Circular reference in ${sheet.name}!${cellRef}`,
          });
        }
      });

      // Check data consistency
      const maxCols = Math.max(...sheet.data.map((r) => r.length));
      if (maxCols > sheet.metadata.columns) {
        sheet.metadata.columns = maxCols;
      }
    });

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Convert to CSV format
   */
  convertToCSV(sheet) {
    const rows = [];
    sheet.data.forEach((row) => {
      const csvRow = row
        .map((cell) => {
          const value = cell?.value || '';
          const escaped = String(value).replace(/"/g, '""');
          return `"${escaped}"`;
        })
        .join(',');
      rows.push(csvRow);
    });
    return rows.join('\n');
  }
}

module.exports = new ExcelService();
