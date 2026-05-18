// models/FileVersion.js
const mongoose = require('mongoose');

const fileVersionSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExcelFile',
      required: true,
      index: true,
    },

    versionNumber: {
      type: Number,
      required: true,
    },

    s3Key: {
      type: String,
      required: true,
    },

    // Change tracking
    changeType: {
      type: String,
      enum: ['manual_save', 'autosave', 'formula_update', 'restore'],
      default: 'manual_save',
    },

    changedCells: Number, // Count of modified cells
    changedSheets: [String], // Sheet names that changed
    changedRows: [Number], // Row indices changed
    changedColumns: [Number], // Column indices changed

    // Metadata
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Description
    comment: String,

    // File info
    fileSize: Number,
    isCompressed: {
      type: Boolean,
      default: false,
    },

    // Rollback reference
    parentVersionId: mongoose.Schema.Types.ObjectId,

    // Approval workflow
    requiresApproval: Boolean,
    approvedBy: mongoose.Schema.Types.ObjectId,
    approvalDate: Date,
  },
  {
    collection: 'file_versions',
  }
);

// Composite index for efficient querying
fileVersionSchema.index({ fileId: 1, versionNumber: -1 });
fileVersionSchema.index({ createdAt: -1 });

module.exports = mongoose.model('FileVersion', fileVersionSchema);
