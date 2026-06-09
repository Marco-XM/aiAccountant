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
  MAX_REQUESTS: 2000, // Very high limit (2000 requests per 15 min = ~2 per second sustained)
  MAX_LOGIN_ATTEMPTS: 10, // Increased from 5 to 10
  LOGIN_WINDOW_MS: 15 * 60 * 1000, // 15 minutes
};

// Subscription Plans
const SUBSCRIPTION_PLANS = {
  free: {
    id: "free",
    name: "Free",
    description: "Perfect for getting started",
    price: { monthly: 0, annual: 0 },
    limits: {
      transactions: 50,
      excelUploads: 2,
      aiChartGenerations: 10,
      aiChatMessages: 20,
      aiExcelGenerations: 5,
    },
    features: [
      "Up to 50 transactions/month",
      "2 Excel file uploads",
      "10 AI chart generations",
      "20 AI chat messages",
      "5 AI Excel generations",
      "Basic dashboard",
      "Email support",
    ],
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "For growing businesses",
    price: { monthly: 19, annual: 190 },
    limits: {
      transactions: 500,
      excelUploads: 20,
      aiChartGenerations: 100,
      aiChatMessages: 500,
      aiExcelGenerations: 50,
    },
    features: [
      "Up to 500 transactions/month",
      "20 Excel file uploads",
      "100 AI chart generations",
      "500 AI chat messages",
      "50 AI Excel generations",
      "Advanced dashboard",
      "Priority email support",
      "Export to PDF",
      "Team collaboration (up to 3)",
    ],
  },
  business: {
    id: "business",
    name: "Business",
    description: "For enterprises & agencies",
    price: { monthly: 49, annual: 490 },
    limits: {
      transactions: -1,
      excelUploads: -1,
      aiChartGenerations: -1,
      aiChatMessages: -1,
      aiExcelGenerations: -1,
    },
    features: [
      "Unlimited transactions",
      "Unlimited Excel file uploads",
      "Unlimited AI chart generations",
      "Unlimited AI chat messages",
      "Unlimited AI Excel generations",
      "Full analytics suite",
      "Dedicated support",
      "Export to PDF & CSV",
      "Team collaboration (unlimited)",
      "API access",
      "Custom integrations",
    ],
  },
};

// Fake Payment Test Cards
const FAKE_PAYMENT_CARDS = {
  SUCCESS: ["4242424242424242", "5555555555554444"],
  DECLINED: ["4000000000000002"],
  INSUFFICIENT_FUNDS: ["4000000000009995"],
  EXPIRED_CARD: ["4000000000000069"],
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
  SUBSCRIPTION_PLANS,
  FAKE_PAYMENT_CARDS,
};
