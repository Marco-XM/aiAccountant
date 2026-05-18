const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    // Basic transaction info
    transactionId: {
        type: String
    },
    date: {
        type: Date,
        required: true
    },
    desc: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    currency: {
        type: String,
        default: 'USD'
    },
    
    // Categorization
    category: {
        type: String,
        required: true
    },
    subcategory: {
        type: String
    },
    type: {
        type: String,
        enum: ['income', 'expense', 'transfer'],
        default: 'expense'
    },
    
    // Additional details
    vendor: {
        type: String
    },
    account: {
        type: String
    },
    paymentMethod: {
        type: String,
        enum: ['cash', 'credit_card', 'debit_card', 'bank_transfer', 'check', 'other']
    },
    reference: {
        type: String
    },
    notes: {
        type: String
    },
    
    // File upload info
    sourceFile: {
        filename: String,
        originalName: String,
        fileType: String, // 'excel' or 'pdf'
        uploadDate: Date
    },
    
    // AI Analysis
    aiAnalysis: {
        confidence: Number, // 0-1 confidence score
        extractedText: String,
        suggestedCategory: String,
        processingNotes: String
    },
    
    // Status and metadata
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'needs_review', 'reconciled', 'flagged'],
        default: 'pending'
    },
    isReconciled: {
        type: Boolean,
        default: false
    },
    tags: [{
        type: String,
        trim: true
    }],
    duplicateHash: {
        type: String
    },
    importJobId: {
        type: String
    },
    source: {
        type: String
    },
    importSheet: {
        type: String
    },
    importRow: {
        type: Number
    },
    rawData: {
        type: mongoose.Schema.Types.Mixed
    },
    
    // User association
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    
    // Legacy metadata field (keeping for backward compatibility)
    metaData: { 
        type: Object 
    }

}, { timestamps: true });

// Index for better query performance
transactionSchema.index({ userId: 1, date: -1, _id: -1 });
transactionSchema.index({ userId: 1, status: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ userId: 1, category: 1, date: -1 });
transactionSchema.index({ userId: 1, duplicateHash: 1 });
transactionSchema.index({ userId: 1, importJobId: 1 });
transactionSchema.index({ userId: 1, desc: 'text', vendor: 'text', category: 'text', reference: 'text' });
transactionSchema.index({ userId: 1, createdAt: -1 });
transactionSchema.index({ transactionId: 1 });
transactionSchema.index({ category: 1 });

// Generate unique transaction ID if not provided
transactionSchema.pre('save', async function(next) {
    if (!this.transactionId) {
        // Use timestamp + random string for uniqueness
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8).toUpperCase();
        this.transactionId = `TXN${timestamp}${random}`;
    }
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
