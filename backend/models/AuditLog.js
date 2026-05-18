// models/AuditLog.js
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema(
  {
    fileId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ExcelFile',
      required: true,
      index: true,
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Change details
    action: {
      type: String,
      enum: [
        'cell_edit',
        'row_insert',
        'row_delete',
        'column_insert',
        'column_delete',
        'sheet_add',
        'sheet_delete',
        'sheet_rename',
        'formula_change',
        'format_change',
        'file_upload',
        'file_export',
        'file_delete',
        'file_restore',
      ],
      required: true,
      index: true,
    },

    sheetName: String,
    cellReference: String, // "A1", "B2:D5"

    // Old vs New values
    oldValue: mongoose.Schema.Types.Mixed,
    newValue: mongoose.Schema.Types.Mixed,

    // Formula tracking (critical for audit)
    formulaChanged: Boolean,
    oldFormula: String,
    newFormula: String,

    // Metadata
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    ipAddress: String,
    userAgent: String,

    // Approval workflow
    requiresApproval: Boolean,
    approvedBy: mongoose.Schema.Types.ObjectId,
    approvalDate: Date,

    // Version reference
    versionId: mongoose.Schema.Types.ObjectId,
    reversible: Boolean,

    // Additional context
    changeDescription: String,
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'medium',
    },
  },
  {
    collection: 'audit_logs',
  }
);

// Indexes for compliance queries
auditLogSchema.index({ fileId: 1, timestamp: -1 });
auditLogSchema.index({ userId: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ cellReference: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
