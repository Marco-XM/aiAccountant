let cancelRequested = false;

const splitCsvLine = (line) => {
  const cells = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const emit = (type, payload = {}) => {
  self.postMessage({ type, payload });
};

const emitChunk = (rows, chunkIndex, totalChunks, totalRows) => {
  emit("CHUNK", {
    rows,
    chunkIndex,
    totalChunks,
    totalRows,
  });
};

const parseCsvStream = async (file, chunkSize) => {
  const stream = file.stream();
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();

  let header = null;
  let buffered = "";
  let rowBuffer = [];
  let chunkIndex = 0;
  let parsedRows = 0;
  const approximateTotalChunks = Math.max(1, Math.ceil(file.size / (chunkSize * 120)));

  while (true) {
    if (cancelRequested) {
      emit("CANCELED", { message: "Import canceled by user" });
      return;
    }

    const { value, done } = await reader.read();
    if (done) break;

    buffered += value;
    const lines = buffered.split(/\r?\n/);
    buffered = lines.pop() || "";

    for (const line of lines) {
      if (!line.trim()) continue;

      if (!header) {
        header = splitCsvLine(line);
        continue;
      }

      const values = splitCsvLine(line);
      const row = {};
      header.forEach((key, index) => {
        row[key || `column_${index + 1}`] = values[index] ?? "";
      });

      rowBuffer.push(row);
      parsedRows += 1;

      if (rowBuffer.length >= chunkSize) {
        emitChunk(rowBuffer, chunkIndex, Math.max(approximateTotalChunks, chunkIndex + 1), parsedRows);
        rowBuffer = [];
        chunkIndex += 1;
      }
    }

    const loadedApprox = Math.min(99, Math.round((parsedRows / Math.max(1, parsedRows + rowBuffer.length + 1)) * 100));
    emit("PARSING_PROGRESS", {
      phase: "parsing",
      progress: loadedApprox,
      parsedRows,
      chunkIndex,
      approximateTotalChunks,
    });
  }

  if (buffered.trim()) {
    if (!header) {
      header = splitCsvLine(buffered);
    } else {
      const values = splitCsvLine(buffered);
      const row = {};
      header.forEach((key, index) => {
        row[key || `column_${index + 1}`] = values[index] ?? "";
      });
      rowBuffer.push(row);
      parsedRows += 1;
    }
  }

  if (rowBuffer.length > 0) {
    emitChunk(rowBuffer, chunkIndex, chunkIndex + 1, parsedRows);
    chunkIndex += 1;
  }

  emit("COMPLETE", {
    totalRows: parsedRows,
    totalChunks: chunkIndex,
    columns: header || [],
    fileType: "csv",
  });
};

const parseXlsxFile = async (file, chunkSize) => {
  const xlsxModule = await import("xlsx");
  const XLSX = xlsxModule.default || xlsxModule;

  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    dense: true,
    cellDates: true,
  });

  const mergedRows = [];
  for (const sheetName of workbook.SheetNames) {
    if (cancelRequested) {
      emit("CANCELED", { message: "Import canceled by user" });
      return;
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, {
      defval: "",
      raw: false,
      blankrows: false,
    });

    for (let index = 0; index < rows.length; index += 1) {
      mergedRows.push({
        ...rows[index],
        __sheetName: sheetName,
        __rowIndex: index + 1,
      });
    }
  }

  const totalRows = mergedRows.length;
  const totalChunks = Math.max(1, Math.ceil(totalRows / chunkSize));

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex += 1) {
    if (cancelRequested) {
      emit("CANCELED", { message: "Import canceled by user" });
      return;
    }

    const start = chunkIndex * chunkSize;
    const end = Math.min(totalRows, start + chunkSize);
    const rows = mergedRows.slice(start, end);
    emitChunk(rows, chunkIndex, totalChunks, totalRows);
    emit("PARSING_PROGRESS", {
      phase: "parsing",
      progress: Math.round(((chunkIndex + 1) / totalChunks) * 100),
      parsedRows: end,
      chunkIndex,
      totalChunks,
    });
  }

  emit("COMPLETE", {
    totalRows,
    totalChunks,
    columns: Object.keys(mergedRows[0] || {}),
    fileType: "xlsx",
  });
};

self.onmessage = async (event) => {
  const { type, payload } = event.data || {};

  if (type === "CANCEL") {
    cancelRequested = true;
    return;
  }

  if (type !== "START") {
    return;
  }

  const { file, chunkSize = 500 } = payload || {};

  if (!file) {
    emit("ERROR", { message: "No file provided for import" });
    return;
  }

  cancelRequested = false;

  try {
    emit("STARTED", {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
    });

    const nameLower = String(file.name || "").toLowerCase();
    const isCsv = nameLower.endsWith(".csv");
    const isSpreadsheet =
      nameLower.endsWith(".xlsx") ||
      nameLower.endsWith(".xls") ||
      file.type.includes("sheet") ||
      file.type.includes("excel");

    if (isCsv) {
      await parseCsvStream(file, chunkSize);
      return;
    }

    if (isSpreadsheet) {
      await parseXlsxFile(file, chunkSize);
      return;
    }

    emit("ERROR", {
      message: "Unsupported file format for worker parsing. Use CSV or XLSX.",
    });
  } catch (error) {
    emit("ERROR", { message: error.message || "Worker failed to parse file" });
  }
};
