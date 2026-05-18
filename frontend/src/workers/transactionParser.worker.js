let cancelled = false;

const emitLog = (message, data = {}) => {
  self.postMessage({ type: "log", message, data });
};

const emitError = (message, data = {}) => {
  self.postMessage({ type: "error", message, data });
};

const createCsvState = () => ({
  headers: null,
  row: [],
  field: "",
  inQuotes: false,
  pendingRows: [],
  processedRows: 0,
});

const pushField = (state) => {
  state.row.push(state.field);
  state.field = "";
};

const pushRow = (state) => {
  const rawRow = state.row.slice();
  state.row = [];

  if (!state.headers) {
    state.headers = rawRow.map((header) => String(header || "").trim());
    return;
  }

  const obj = {};
  state.headers.forEach((header, index) => {
    obj[header || `col${index}`] = rawRow[index] === undefined ? "" : rawRow[index];
  });
  state.pendingRows.push(obj);
  state.processedRows += 1;
};

const processCsvText = (state, text) => {
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (cancelled) break;

    if (char === '"') {
      if (state.inQuotes && nextChar === '"') {
        state.field += '"';
        index += 1;
      } else {
        state.inQuotes = !state.inQuotes;
      }
      continue;
    }

    if (!state.inQuotes && (char === ',')) {
      pushField(state);
      continue;
    }

    if (!state.inQuotes && char === '\n') {
      pushField(state);
      pushRow(state);
      continue;
    }

    if (char === '\r') {
      continue;
    }

    state.field += char;
  }
};

const finalizeCsvState = (state) => {
  if (state.field.length || state.row.length) {
    pushField(state);
    pushRow(state);
  }
};

const streamCsv = async (file, chunkSize) => {
  const state = createCsvState();
  const reader = file.stream().getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let chunkIndex = 0;

  emitLog("csv:stream-start", { fileName: file.name, fileSize: file.size, chunkSize });

  while (!cancelled) {
    const { value, done } = await reader.read();
    if (done) break;

    bytesRead += value.byteLength;
    const text = decoder.decode(value, { stream: true });
    processCsvText(state, text);

    while (state.pendingRows.length >= chunkSize) {
      const rows = state.pendingRows.splice(0, chunkSize);
      self.postMessage({ type: "chunk", chunkIndex, rows, totalRows: state.processedRows });
      chunkIndex += 1;
    }

    const percent = file.size ? Math.min(99, Math.round((bytesRead / file.size) * 100)) : 0;
    self.postMessage({ type: "progress", percent, totalRows: state.processedRows, stage: "parsing" });
  }

  finalizeCsvState(state);

  while (state.pendingRows.length > 0 && !cancelled) {
    const rows = state.pendingRows.splice(0, chunkSize);
    self.postMessage({ type: "chunk", chunkIndex, rows, totalRows: state.processedRows });
    chunkIndex += 1;
  }

  self.postMessage({
    type: "done",
    totalChunks: chunkIndex,
    totalRows: state.processedRows,
    fileName: file.name || "upload",
    fileType: "csv",
  });
};

self.onmessage = async (event) => {
  const { type } = event.data || {};

  if (type === "cancel") {
    cancelled = true;
    emitLog("upload:cancelled");
    return;
  }

  if (type !== "parse") return;

  cancelled = false;
  const { file, chunkSize = 500 } = event.data;

  if (!file) {
    emitError("No file provided");
    return;
  }

  const fileName = file.name || "upload";
  const lower = String(fileName).toLowerCase();
  const isCsv = lower.endsWith(".csv") || file.type === "text/csv" || file.type === "application/csv";
  const isXlsx = lower.endsWith(".xlsx") || lower.endsWith(".xls");

  try {
    emitLog("parse:start", { fileName, fileType: file.type || "unknown", size: file.size });

    if (isCsv) {
      await streamCsv(file, chunkSize);
      return;
    }

    if (isXlsx) {
      emitLog("xlsx:loading-module", { fileName });
      const XLSX = await import("xlsx");
      if (cancelled) return;

      const arrayBuffer = await file.arrayBuffer();
      if (cancelled) return;

      const workbook = XLSX.read(arrayBuffer, { type: "array" });
      emitLog("xlsx:workbook-loaded", { sheets: workbook.SheetNames.length, sheetsNames: workbook.SheetNames });

      let allRows = [];
      for (const sheetName of workbook.SheetNames) {
        if (cancelled) break;
        const worksheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        for (const row of rows) row.__sheetName = sheetName;
        allRows = allRows.concat(rows);
        self.postMessage({ type: "progress", percent: 5, stage: "reading-sheet", sheetName, totalRows: allRows.length });
      }

      let chunkIndex = 0;
      let processed = 0;
      for (let index = 0; index < allRows.length; index += chunkSize) {
        if (cancelled) break;
        const slice = allRows.slice(index, index + chunkSize);
        self.postMessage({ type: "chunk", chunkIndex, rows: slice, totalRows: allRows.length });
        processed += slice.length;
        chunkIndex += 1;
        self.postMessage({
          type: "progress",
          percent: Math.min(99, Math.round((processed / Math.max(1, allRows.length)) * 100)),
          totalRows: processed,
          stage: "chunking",
        });
      }

      self.postMessage({
        type: "done",
        totalChunks: Math.max(0, chunkIndex),
        totalRows: allRows.length,
        fileName,
        fileType: "excel",
      });
      return;
    }

    emitLog("fallback:text", { fileName });
    const text = await file.text();
    if (cancelled) return;
    self.postMessage({ type: "chunk", chunkIndex: 0, rows: [{ raw: text }], totalRows: 1 });
    self.postMessage({ type: "done", totalChunks: 1, totalRows: 1, fileName, fileType: "text" });
  } catch (error) {
    emitError(error.message || String(error), { fileName, stage: "parse" });
  }
};
