// controllers/excelEditorController.js
const path = require('path');
const fs = require('fs').promises;
const mongoose = require('mongoose');
const ExcelFile = require('../models/ExcelFile');
const FileVersion = require('../models/FileVersion');
const AuditLog = require('../models/AuditLog');
const excelService = require('../services/excelService');
const localExcelStore = require('../services/localExcelStore');

const isDatabaseReady = () => mongoose.connection.readyState === 1;

const parseAndValidateUpload = async (filePath, originalname, size) => {
  const fileType = path.extname(originalname).slice(1).toLowerCase();

  if (!['xlsx', 'xls', 'csv'].includes(fileType)) {
    await fs.unlink(filePath);
    const error = new Error('Invalid file type');
    error.statusCode = 400;
    throw error;
  }

  if (size > 50 * 1024 * 1024) {
    await fs.unlink(filePath);
    const error = new Error('File too large (max 50MB)');
    error.statusCode = 400;
    throw error;
  }

  const parsedData = await excelService.parseExcelFile(filePath, originalname);
  
  return { fileType, parsedData };
};

/**
 * Upload and parse Excel file
 */
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, path: filePath, size } = req.file;
    console.log('[excelController] uploadFile req.file:', { originalname, filePath, size, user: req.user?.id });

    const { fileType, parsedData } = await parseAndValidateUpload(filePath, originalname, size);

    if (!isDatabaseReady()) {
      const localRecord = await localExcelStore.createFileRecord({
        userId: req.user?.id,
        originalName: originalname,
        fileType,
        fileSize: size,
        tempPath: filePath,
        sheetNames: parsedData.sheetNames,
        hasFormulas: parsedData.hasFormulas,
      });

      return res.status(201).json({
        fileId: localRecord.fileId,
        fileName: localRecord.fileName,
        sheets: parsedData.sheets.map((s) => ({
          name: s.name,
          rows: s.metadata.rows,
          columns: s.metadata.columns,
        })),
        metadata: {
          createdAt: localRecord.createdAt,
          fileSize: localRecord.fileSize,
        },
      });
    }

    // TODO: Upload to S3
    // const s3Key = `excel/${req.user.id}/${Date.now()}-${originalname}`;
    // const s3Url = await fileService.uploadFile(filePath, s3Key);

    // For now, save locally
    const uploadDir = path.join(__dirname, '../uploads/excel');
    await fs.mkdir(uploadDir, { recursive: true });
    const savedPath = path.join(uploadDir, `${Date.now()}-${originalname}`);
    await fs.rename(filePath, savedPath);

    // Create database record
    const excelFile = new ExcelFile({
      userId: req.user.id,
      fileName: originalname,
      fileType,
      originalFileName: originalname,
      fileSize: size,
      s3Key: savedPath,
      sheetNames: parsedData.sheetNames,
      cachedData: {
        lastParsedAt: new Date(),
        hasFormulas: parsedData.hasFormulas,
      },
    });

    await excelFile.save();

    // Log audit
    await AuditLog.create({
      fileId: excelFile._id,
      userId: req.user.id,
      action: 'file_upload',
      changeDescription: `Uploaded file: ${originalname}`,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.status(201).json({
      fileId: excelFile._id,
      fileName: excelFile.fileName,
      sheets: parsedData.sheets.map((s) => ({
        name: s.name,
        rows: s.metadata.rows,
        columns: s.metadata.columns,
      })),
      metadata: {
        createdAt: excelFile.createdAt,
        fileSize: excelFile.fileSize,
      },
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
};

/**
 * Get file metadata
 */
exports.getFileMetadata = async (req, res) => {
  try {
    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(req.params.fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      return res.json({
        fileId: file.fileId,
        fileName: file.fileName,
        fileType: file.fileType,
        sheetNames: file.sheetNames,
        createdAt: file.createdAt,
        updatedAt: file.updatedAt,
        canEdit: true,
        owner: file.userId,
      });
    }

    const file = await ExcelFile.findById(req.params.fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    res.json({
      fileId: file._id,
      fileName: file.fileName,
      fileType: file.fileType,
      sheetNames: file.sheetNames,
      createdAt: file.createdAt,
      updatedAt: file.updatedAt,
      canEdit: file.userId.toString() === req.user.id.toString(),
      owner: file.userId,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get file data (all sheets)
 */
exports.getFileData = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { sheet } = req.query;

    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const fileData = await excelService.parseExcelFile(file.filePath);

      if (sheet) {
        const sheetData = fileData.sheets.find((s) => s.name === sheet);
        if (!sheetData) {
          return res.status(404).json({ error: 'Sheet not found' });
        }
        return res.json({ sheets: [sheetData] });
      }

      return res.json({ sheets: fileData.sheets });
    }

    const file = await ExcelFile.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Read from saved file
    const fileData = await excelService.parseExcelFile(file.s3Key);

    if (sheet) {
      const sheetData = fileData.sheets.find((s) => s.name === sheet);
      if (!sheetData) {
        return res.status(404).json({ error: 'Sheet not found' });
      }
      return res.json({ sheets: [sheetData] });
    }

    res.json({ sheets: fileData.sheets });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Apply changes to spreadsheet
 */
exports.applyChanges = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { changes, metadata } = req.body;

    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'Changes must be array' });
    }

    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const parsedData = await excelService.parseExcelFile(file.filePath);
      let sheets = excelService.applyChanges(parsedData.sheets, changes);

      const validation = excelService.validate(sheets);
      if (!validation.valid) {
        return res.status(400).json({ error: 'Invalid changes', errors: validation.errors });
      }

      const buffer = await excelService.generateExcelFile(sheets);
      const nextFilePath = path.join(
        path.dirname(file.filePath),
        `${Date.now()}-${file.fileName}`,
      );
      await fs.writeFile(nextFilePath, buffer);

      await localExcelStore.createNewVersion(fileId, nextFilePath, {
        changeType: metadata?.source === 'autosave' ? 'autosave' : 'manual_save',
        comment: metadata?.comment || '',
        parentVersionPath: file.filePath,
      });

      await localExcelStore.appendAuditLog(fileId, {
        userId: req.user?.id,
        action: 'file_save',
        changeDescription: metadata?.comment || 'Saved workbook changes',
      });

      const updated = await localExcelStore.getFileRecord(fileId);
      return res.json({
        success: true,
        versionId: updated.currentVersionNumber,
        newVersion: updated.currentVersionNumber,
      });
    }

    const file = await ExcelFile.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    // Load current data
    let parsedData = await excelService.parseExcelFile(file.s3Key);
    let sheets = parsedData.sheets;

    // Apply changes
    sheets = excelService.applyChanges(sheets, changes);

    // Validate
    const validation = excelService.validate(sheets);
    if (!validation.valid) {
      return res.status(400).json({ error: 'Invalid changes', errors: validation.errors });
    }

    // Generate new file
    const buffer = await excelService.generateExcelFile(sheets);

    // Save file (TODO: to S3)
    const uploadDir = path.join(__dirname, '../uploads/excel');
    await fs.mkdir(uploadDir, { recursive: true });
    const newFilePath = path.join(uploadDir, `${Date.now()}-${file.fileName}`);
    await fs.writeFile(newFilePath, buffer);

    // Create version
    const version = new FileVersion({
      fileId: file._id,
      versionNumber: file.versionCount + 1,
      s3Key: newFilePath,
      changeType: 'manual_save',
      changedCells: changes.filter((c) => c.type === 'cell').length,
      changedSheets: [...new Set(changes.map((c) => c.sheetName))],
      createdBy: req.user.id,
      comment: metadata?.comment || '',
    });

    await version.save();

    // Log audit
    await Promise.all(
      changes.map((change) =>
        AuditLog.create({
          fileId: file._id,
          userId: req.user.id,
          action: change.type === 'cell' ? 'cell_edit' : `${change.type}_${change.action}`,
          sheetName: change.sheetName,
          cellReference: change.cellRef,
          newValue: change.value,
          newFormula: change.formula,
          versionId: version._id,
          ipAddress: req.ip,
        })
      )
    );

    // Update file
    file.currentVersionId = version._id;
    file.versionCount++;
    file.lastModifiedBy = req.user.id;
    file.s3Key = newFilePath;
    await file.save();

    res.json({
      success: true,
      versionId: version._id,
      newVersion: version.versionNumber,
    });
  } catch (error) {
    console.error('Apply changes error:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * Autosave changes to spreadsheet
 */
exports.autoSave = async (req, res) => {
  req.body = {
    ...req.body,
    metadata: {
      ...(req.body?.metadata || {}),
      source: 'autosave',
    },
  };

  return exports.applyChanges(req, res);
};

/**
 * Export file
 */
exports.exportFile = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { format = 'xlsx' } = req.query;

    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const parsedData = await excelService.parseExcelFile(file.filePath);
      let buffer;

      if (format === 'xlsx') {
        buffer = await excelService.generateExcelFile(parsedData.sheets);
      } else if (format === 'csv') {
        const csv = excelService.convertToCSV(parsedData.sheets[0]);
        buffer = Buffer.from(csv);
      } else {
        return res.status(400).json({ error: 'Invalid format' });
      }

      return res.set({
        'Content-Type':
          format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${file.fileName.replace(/\.[^/.]+$/, '')}.${format}"`,
      }).send(buffer);
    }

    const file = await ExcelFile.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const parsedData = await excelService.parseExcelFile(file.s3Key);
    let buffer;

    if (format === 'xlsx') {
      buffer = await excelService.generateExcelFile(parsedData.sheets);
    } else if (format === 'csv') {
      const csv = excelService.convertToCSV(parsedData.sheets[0]);
      buffer = Buffer.from(csv);
    } else {
      return res.status(400).json({ error: 'Invalid format' });
    }

    // Log audit
    await AuditLog.create({
      fileId: file._id,
      userId: req.user.id,
      action: 'file_export',
      changeDescription: `Exported as ${format.toUpperCase()}`,
      ipAddress: req.ip,
    });

    res.set({
      'Content-Type':
        format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${file.fileName.replace(/\.[^/.]+$/, '')}.${format}"`,
    });

    res.send(buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get versions
 */
exports.getVersions = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { page = 1, limit = 20 } = req.query;

    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const versions = (file.versions || []).slice((page - 1) * limit, page * limit);
      return res.json({
        versions,
        total: (file.versions || []).length,
        page: parseInt(page),
        hasMore: page * limit < (file.versions || []).length,
      });
    }

    const versions = await FileVersion.find({ fileId })
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await FileVersion.countDocuments({ fileId });

    res.json({
      versions,
      total,
      page: parseInt(page),
      hasMore: page * limit < total,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Restore version
 */
exports.restoreVersion = async (req, res) => {
  try {
    const { fileId, versionId } = req.params;

    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const version = (file.versions || []).find((item) => item.versionId === versionId);
      if (!version) return res.status(404).json({ error: 'Version not found' });

      const restoredPath = path.join(
        path.dirname(file.filePath),
        `${Date.now()}-${file.fileName}`,
      );
      await fs.copyFile(version.filePath, restoredPath);

      await localExcelStore.createNewVersion(fileId, restoredPath, {
        changeType: 'restore',
        comment: `Restored from version ${version.versionNumber}`,
        parentVersionPath: version.filePath,
      });

      const updated = await localExcelStore.getFileRecord(fileId);
      return res.json({
        success: true,
        newVersionId: updated.currentVersionNumber,
        newVersion: updated.currentVersionNumber,
      });
    }

    const file = await ExcelFile.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    const version = await FileVersion.findById(versionId);
    if (!version) return res.status(404).json({ error: 'Version not found' });

    // Copy version file to new location
    const uploadDir = path.join(__dirname, '../uploads/excel');
    const newFilePath = path.join(uploadDir, `${Date.now()}-${file.fileName}`);
    await fs.copyFile(version.s3Key, newFilePath);

    // Create new version
    const newVersion = new FileVersion({
      fileId: file._id,
      versionNumber: file.versionCount + 1,
      s3Key: newFilePath,
      changeType: 'restore',
      createdBy: req.user.id,
      comment: `Restored from version ${version.versionNumber}`,
      parentVersionId: versionId,
    });

    await newVersion.save();

    // Log audit
    await AuditLog.create({
      fileId: file._id,
      userId: req.user.id,
      action: 'file_restore',
      changeDescription: `Restored from version ${version.versionNumber}`,
      versionId: newVersion._id,
      ipAddress: req.ip,
    });

    // Update file
    file.currentVersionId = newVersion._id;
    file.versionCount++;
    file.lastModifiedBy = req.user.id;
    file.s3Key = newFilePath;
    await file.save();

    res.json({
      success: true,
      newVersionId: newVersion._id,
      newVersion: newVersion.versionNumber,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Get audit log
 */
exports.getAuditLog = async (req, res) => {
  try {
    const { fileId } = req.params;
    const { startDate, endDate, page = 1, limit = 50 } = req.query;

    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      const logs = (file.auditLogs || []).slice((page - 1) * limit, page * limit);
      return res.json({
        logs,
        total: (file.auditLogs || []).length,
        page: parseInt(page),
      });
    }

    const query = { fileId };

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const logs = await AuditLog.find(query)
      .populate('userId', 'name email')
      .sort({ timestamp: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await AuditLog.countDocuments(query);

    res.json({
      logs,
      total,
      page: parseInt(page),
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

/**
 * Delete file
 */
exports.deleteFile = async (req, res) => {
  try {
    const { fileId } = req.params;

    if (!isDatabaseReady()) {
      const file = await localExcelStore.getFileRecord(fileId);
      if (!file) return res.status(404).json({ error: 'File not found' });

      await localExcelStore.updateFileRecord(fileId, (record) => {
        record.status = 'deleted';
        record.deletedAt = new Date().toISOString();
        return record;
      });

      await localExcelStore.appendAuditLog(fileId, {
        userId: req.user?.id,
        action: 'file_delete',
        changeDescription: 'Deleted workbook',
      });

      return res.json({ success: true, deleted: true });
    }

    const file = await ExcelFile.findById(fileId);
    if (!file) return res.status(404).json({ error: 'File not found' });

    file.status = 'deleted';
    file.deletedAt = new Date();
    await file.save();

    await AuditLog.create({
      fileId: file._id,
      userId: req.user.id,
      action: 'file_delete',
      ipAddress: req.ip,
    });

    res.json({ success: true, deleted: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
