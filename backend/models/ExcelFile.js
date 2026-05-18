// models/ExcelFile.js
const mongoose = require('mongoose');

const excelFileSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['xlsx', 'xls', 'csv'],
      required: true,
    },
    originalFileName: String,
    fileSize: {
      type: Number,
      required: true,
    },
    s3Key: String,
    s3Url: String,

    // Sheet information (cached)
    sheetNames: [String],
    totalRows: Number,
    totalColumns: Number,

    // Versioning
    currentVersionId: mongoose.Schema.Types.ObjectId,
    versionCount: {
      type: Number,
      default: 1,
    },

    // Status
    status: {
      type: String,
      enum: ['active', 'archived', 'deleted'],
      default: 'active',
    },

    // Locking (prevent concurrent edits)
    isLocked: {
      type: Boolean,
      default: false,
    },
    lockedBy: mongoose.Schema.Types.ObjectId,
    lockExpiresAt: Date,

    // Organization
    category: String, // "expenses", "invoices", "ledger"
    tags: [String],
    description: String,

    // Sharing
    isPublic: {
      type: Boolean,
      default: false,
    },
    permissions: [mongoose.Schema.Types.ObjectId],

    // Tracking
    lastOpenedAt: Date,
    lastModifiedBy: mongoose.Schema.Types.ObjectId,

    // Cache
    cachedData: {
      lastParsedAt: Date,
      cellCount: Number,
      hasFormulas: Boolean,
    },
  },
  {
    timestamps: true,
    collection: 'excel_files',
  }
);

// Indexes for performance
excelFileSchema.index({ userId: 1, createdAt: -1 });
excelFileSchema.index({ status: 1 });
excelFileSchema.index({ category: 1 });
excelFileSchema.index({ tags: 1 });

module.exports = mongoose.model('ExcelFile', excelFileSchema);
