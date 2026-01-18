// Application Constants

// Transaction Types
const TRANSACTION_TYPES = {
  INCOME: "income",
  EXPENSE: "expense",
  TRANSFER: "transfer",
};

// Transaction Status
const TRANSACTION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  NEEDS_REVIEW: "needs_review",
};

// Payment Methods
const PAYMENT_METHODS = {
  CASH: "cash",
  CREDIT_CARD: "credit_card",
  DEBIT_CARD: "debit_card",
  BANK_TRANSFER: "bank_transfer",
  CHECK: "check",
  OTHER: "other",
};

// Business Types
const BUSINESS_TYPES = {
  RETAIL: "retail",
  WHOLESALE: "wholesale",
  SERVICE: "service",
};

// File Upload
const FILE_CONFIG = {
  MAX_SIZE: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/pdf",
  ],
  ALLOWED_EXTENSIONS: [".xlsx", ".xls", ".pdf"],
};

// Pagination
const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 20,
  MAX_LIMIT: 100,
};

// JWT Configuration
const JWT_CONFIG = {
  EXPIRES_IN: "72h",
  REFRESH_EXPIRES_IN: "7d",
};

// Rate Limiting
const RATE_LIMIT = {
  WINDOW_MS: 15 * 60 * 1000, // 15 minutes
  MAX_REQUESTS: 100,
  MAX_LOGIN_ATTEMPTS: 5,
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
};

module.exports = {
  TRANSACTION_TYPES,
  TRANSACTION_STATUS,
  PAYMENT_METHODS,
  BUSINESS_TYPES,
  FILE_CONFIG,
  PAGINATION,
  JWT_CONFIG,
  RATE_LIMIT,
};
