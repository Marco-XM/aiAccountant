import axios from "axios";
import toast from "react-hot-toast";

const normalizeOrigin = (value) => {
  if (!value) return value;
  return String(value).replace(/\/$/, "");
};

// Prefer explicit origin + base URL; keep backwards compatibility with older env var names.
const API_ORIGIN = normalizeOrigin(
  import.meta.env.VITE_API_ORIGIN ||
    import.meta.env.VITE_API_URL ||
    "http://localhost:5000",
);

const API_BASE_URL = normalizeOrigin(
  import.meta.env.VITE_API_BASE_URL || `${API_ORIGIN}/api`,
);

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes - increased for file uploads with AI processing
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Handle specific error codes
      switch (error.response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem("token");
          if (window.location.pathname !== "/login") {
            toast.error("Session expired. Please login again.");
            window.location.href = "/login";
          }
          break;
        case 403:
          toast.error("You do not have permission to perform this action.");
          break;
        case 404:
          toast.error("Resource not found.");
          break;
        case 429:
          toast.error("Too many requests. Please try again later.");
          break;
        case 500:
          toast.error("Server error. Please try again later.");
          break;
        default:
          // Show error message from server if available
          const errorMessage =
            error.response.data?.message ||
            error.response.data?.error ||
            "An error occurred";
          toast.error(errorMessage);
      }
    } else if (error.request) {
      // Request made but no response
      toast.error("No response from server. Please check your connection.");
    } else {
      // Something else happened
      toast.error("An unexpected error occurred.");
    }
    return Promise.reject(error);
  },
);

// API endpoints
export const api = {
  // Auth
  auth: {
    register: (data) => apiClient.post("/auth/register", data),
    login: (data) => apiClient.post("/auth/login", data),
    forgotPassword: (data) => apiClient.post("/auth/forgot-password", data),
    resetPassword: (data) => apiClient.post("/auth/reset-password", data),
  },

  // Transactions
  transactions: {
    getAll: (params) => apiClient.get("/transactions", { params }),
    getStats: () => apiClient.get("/transactions/stats"),
    getById: (id) => apiClient.get(`/transactions/${id}`),
    create: (data) => apiClient.post("/transactions", data),
    update: (id, data) => apiClient.put(`/transactions/${id}`, data),
    delete: (id) => apiClient.delete(`/transactions/${id}`),
    bulkDelete: (ids) =>
      apiClient.delete("/transactions/bulk", { data: { ids } }),
    deleteAll: () => apiClient.delete("/transactions/all"),
    upload: (formData) =>
      apiClient.post("/transactions/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      }),
  },

  // Chat
  chat: {
    getSessions: () => apiClient.get("/chat/sessions"),
    getSession: (id) => apiClient.get(`/chat/sessions/${id}`),
    createSession: (data) => apiClient.post("/chat/sessions", data),
    updateSession: (id, data) => apiClient.put(`/chat/sessions/${id}`, data),
    deleteSession: (id) => apiClient.delete(`/chat/sessions/${id}`),
  },

  // Chatbot
  chatbot: {
    sendMessage: (data) => apiClient.post("/chatbot/chat", data),
  },

  // Charts
  charts: {
    generate: (data) => apiClient.post("/charts/generate", data),
  },

  // AI Excel
  aiExcel: {
    generate: (data) => apiClient.post("/ai-excel/generate", data),
  },

  // Excel Generator
  excel: {
    downloadExpenses: (count) =>
      `${API_ORIGIN}/api/excel/expenses/download?count=${count}`,
    downloadSales: (count) =>
      `${API_ORIGIN}/api/excel/sales/download?count=${count}`,
    getExpenseStats: (count) =>
      apiClient.get(`/excel/expenses/stats?count=${count}`),
    getSalesStats: (count) =>
      apiClient.get(`/excel/sales/stats?count=${count}`),
  },
};

export { API_BASE_URL, API_ORIGIN };
export const API_URL = API_ORIGIN; // Backwards compatibility alias
export default apiClient;
