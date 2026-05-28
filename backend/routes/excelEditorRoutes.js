// routes/excelEditorRoutes.js
const express = require('express');
const multer = require('multer');
const os = require('os');
const path = require('path');
const auth = require('../middleware/auth.mw');
const excelController = require('../controllers/excelEditorController');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  dest: os.tmpdir(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).slice(1).toLowerCase();
    if (['xlsx', 'xls', 'csv'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files allowed (.xlsx, .xls, .csv)'));
    }
  },
});

/**
 * FILE MANAGEMENT
 */

// Upload file
router.post('/upload', auth, upload.single('file'), excelController.uploadFile);

// Get file metadata
router.get('/:fileId', auth, excelController.getFileMetadata);

// Get file data
router.get('/:fileId/data', auth, excelController.getFileData);

// Delete file (soft delete)
router.delete('/:fileId', auth, excelController.deleteFile);

/**
 * EDITING & CHANGES
 */

// Apply changes
router.post('/:fileId/changes', auth, excelController.applyChanges);

// Autosave changes
router.post('/:fileId/auto-save', auth, excelController.autoSave);

/**
 * EXPORT
 */

// Export file
router.get('/:fileId/export', auth, excelController.exportFile);

/**
 * VERSIONING
 */

// Get versions
router.get('/:fileId/versions', auth, excelController.getVersions);

// Restore version
router.post('/:fileId/restore/:versionId', auth, excelController.restoreVersion);

/**
 * AUDIT
 */

// Get audit log
router.get('/:fileId/audit', auth, excelController.getAuditLog);

module.exports = router;
