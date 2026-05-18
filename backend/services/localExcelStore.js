const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

const STORE_DIR = path.join(__dirname, '..', 'uploads', 'excel-local');
const STORE_FILE = path.join(STORE_DIR, 'store.json');
const FILES_DIR = path.join(STORE_DIR, 'files');
const VERSIONS_DIR = path.join(STORE_DIR, 'versions');

async function ensureStore() {
  await fs.mkdir(FILES_DIR, { recursive: true });
  await fs.mkdir(VERSIONS_DIR, { recursive: true });

  try {
    await fs.access(STORE_FILE);
  } catch {
    await fs.writeFile(STORE_FILE, JSON.stringify({ files: [] }, null, 2));
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_FILE, 'utf8');
  return JSON.parse(raw || '{"files":[]}');
}

async function writeStore(store) {
  await ensureStore();
  await fs.writeFile(STORE_FILE, JSON.stringify(store, null, 2));
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '')}`;
}

async function createFileRecord({ userId, originalName, fileType, fileSize, tempPath, sheetNames, hasFormulas }) {
  const store = await readStore();
  const fileId = createId('excel');
  const storedName = `${fileId}-${originalName}`;
  const storedPath = path.join(FILES_DIR, storedName);

  await fs.copyFile(tempPath, storedPath);

  const now = new Date().toISOString();
  const record = {
    fileId,
    userId: String(userId || 'local'),
    fileName: originalName,
    fileType,
    originalFileName: originalName,
    fileSize,
    filePath: storedPath,
    sheetNames,
    currentVersionNumber: 1,
    versions: [],
    auditLogs: [],
    cachedData: {
      lastParsedAt: now,
      hasFormulas: Boolean(hasFormulas),
    },
    createdAt: now,
    updatedAt: now,
  };

  const versionPath = path.join(VERSIONS_DIR, `${fileId}-v1${path.extname(originalName) || '.xlsx'}`);
  await fs.copyFile(storedPath, versionPath);
  record.versions.push({
    versionId: createId('version'),
    versionNumber: 1,
    filePath: versionPath,
    createdAt: now,
    changeType: 'manual_save',
    comment: 'Initial upload',
  });

  store.files.push(record);
  await writeStore(store);
  return record;
}

async function getFileRecord(fileId) {
  const store = await readStore();
  return store.files.find((file) => file.fileId === fileId) || null;
}

async function updateFileRecord(fileId, updater) {
  const store = await readStore();
  const index = store.files.findIndex((file) => file.fileId === fileId);
  if (index === -1) return null;

  const nextRecord = await updater({ ...store.files[index] });
  nextRecord.updatedAt = new Date().toISOString();
  store.files[index] = nextRecord;
  await writeStore(store);
  return nextRecord;
}

async function appendAuditLog(fileId, entry) {
  return updateFileRecord(fileId, (record) => {
    record.auditLogs = record.auditLogs || [];
    record.auditLogs.unshift({
      auditId: createId('audit'),
      timestamp: new Date().toISOString(),
      ...entry,
    });
    return record;
  });
}

async function createNewVersion(fileId, sourcePath, meta = {}) {
  return updateFileRecord(fileId, async (record) => {
    const versionNumber = (record.currentVersionNumber || 1) + 1;
    const versionPath = path.join(
      VERSIONS_DIR,
      `${fileId}-v${versionNumber}${path.extname(record.fileName) || '.xlsx'}`
    );

    await fs.copyFile(sourcePath, versionPath);

    record.filePath = sourcePath;
    record.currentVersionNumber = versionNumber;
    record.versions = record.versions || [];
    record.versions.unshift({
      versionId: createId('version'),
      versionNumber,
      filePath: versionPath,
      createdAt: new Date().toISOString(),
      changeType: meta.changeType || 'manual_save',
      comment: meta.comment || '',
      parentVersionPath: meta.parentVersionPath || null,
    });

    return record;
  });
}

module.exports = {
  ensureStore,
  createFileRecord,
  getFileRecord,
  updateFileRecord,
  appendAuditLog,
  createNewVersion,
};
