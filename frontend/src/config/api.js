import axios from "axios";
import toast from "react-hot-toast";
import { useSyncExternalStore } from "react";

const normalizeUrl = (value) => {
  if (!value) return value;
  return String(value).replace(/\/+$/, "");
};

const normalizeOrigin = (value) => normalizeUrl(value).replace(/\/api$/i, "");

const getAuthToken = () => localStorage.getItem("token") || "";

// Prefer explicit origin + base URL; keep backwards compatibility with older env var names.
const API_ORIGIN = normalizeOrigin(
  import.meta.env.VITE_API_ORIGIN ||
    import.meta.env.VITE_API_URL ||
    (import.meta.env.PROD ? "/_/backend" : "http://localhost:5000")
);

const API_BASE_URL = normalizeUrl(
  import.meta.env.VITE_API_BASE_URL || `${API_ORIGIN}/api`,
);

let backendHealthState = {
  status: "unknown",
  lastCheckedAt: 0,
  unavailableUntil: 0,
  lastError: null,
  lastStatusCode: null,
  reason: null,
};

const backendHealthListeners = new Set();

const notifyBackendHealth = () => {
  backendHealthListeners.forEach((listener) => listener());
};

const setBackendHealth = (nextState) => {
  backendHealthState = { ...backendHealthState, ...nextState };
  notifyBackendHealth();
};

const getBackendHealthSnapshot = () => backendHealthState;

const subscribeBackendHealth = (listener) => {
  backendHealthListeners.add(listener);
  return () => backendHealthListeners.delete(listener);
};

export const getBackendStatus = () => getBackendHealthSnapshot();

export const useBackendStatus = () =>
  useSyncExternalStore(subscribeBackendHealth, getBackendHealthSnapshot, getBackendHealthSnapshot);

const isBackendShortCircuited = () =>
  backendHealthState.status === "offline" && Date.now() < backendHealthState.unavailableUntil;

const healthClient = axios.create({
  baseURL: API_ORIGIN,
  timeout: 4000,
  headers: { "Content-Type": "application/json" },
});

const refreshBackendHealth = async () => {
  try {
    const response = await healthClient.get("/health");
    const healthStatus = response.data?.status || "unknown";
    const databaseStatus = response.data?.database?.status || "unknown";

    if (healthStatus === "ok" && databaseStatus === "connected") {
      setBackendHealth({
        status: "online",
        lastCheckedAt: Date.now(),
        unavailableUntil: 0,
        lastError: null,
        lastStatusCode: 200,
        reason: null,
      });
      return;
    }

    setBackendHealth({
      status: "degraded",
      lastCheckedAt: Date.now(),
      unavailableUntil: Date.now() + 10 * 1000,
      lastError: response.data?.database?.lastError || null,
      lastStatusCode: response.status,
      reason: healthStatus,
    });
  } catch (error) {
    setBackendHealth({
      status: "offline",
      lastCheckedAt: Date.now(),
      unavailableUntil: Date.now() + 10 * 1000,
      lastError: error.response?.data?.message || error.message || "Backend unavailable",
      lastStatusCode: error.response?.status || null,
      reason: error.response?.status === 503 ? "degraded" : "offline",
    });
  }
};

// expose refresh for consumers (e.g. HealthContext)
export { refreshBackendHealth };

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes - increased for file uploads with AI processing
  headers: {
    "Content-Type": "application/json",
  },
});

// Safe request helper with limited retries for transient network/server errors
const safeRequest = async (fn, { retries = 2, backoffMs = 500 } = {}) => {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (err) {
      attempt += 1;
      const status = err.response?.status;
      const isRetryableServerError = [502, 503, 504].includes(status);
      const isNetworkError = !!err.request && !err.response;

      if (attempt > retries || (!isRetryableServerError && !isNetworkError)) {
        throw err;
      }

      // exponential backoff
      await new Promise((res) => setTimeout(res, backoffMs * Math.pow(2, attempt - 1)));
    }
  }
};

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    if (config?.url !== "/health" && isBackendShortCircuited()) {
      const offlineError = new Error("Backend unavailable");
      offlineError.code = "BACKEND_UNAVAILABLE";
      return Promise.reject(offlineError);
    }

    // If we've marked the backend as offline for a short window, short-circuit outgoing requests
    if (apiClient._offlineUntil && Date.now() < apiClient._offlineUntil) {
      return Promise.reject(new Error("Backend offline - request short-circuited"));
    }

    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // Attach timestamp for duration logging
    if (import.meta.env.DEV) {
      config.metadata = { startTime: Date.now() };
      try {
        const rid = sessionStorage.getItem("requestId") || `${Date.now()}`;
        config.headers["x-request-id"] = rid;
      } catch (e) {}
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => {
    try {
      if (import.meta.env.DEV && response?.config?.metadata) {
        const start = response.config.metadata.startTime;
        const duration = start ? Date.now() - start : null;
        const route = response.config.url || response.config?.baseURL || "unknown";
        // eslint-disable-next-line no-console
        console.debug("API OK", { route, status: response.status, duration, requestId: response.config.headers?.["x-request-id"] });
      }
    } catch (e) {}
    return response;
  },
  (error) => {
    // Development request logging: route, status, duration
    try {
      if (import.meta.env.DEV && error?.config?.metadata) {
        const start = error.config.metadata.startTime;
        const duration = start ? Date.now() - start : null;
        const route = error.config.url || error.config?.baseURL || "unknown";
        // eslint-disable-next-line no-console
        console.debug("API ERROR", { route, status: error.response?.status || null, duration, requestId: error.config.headers?.["x-request-id"] });
      }
    } catch (e) {}
    // If we short-circuited due to backend offline, don't show a toast (handled in-component)
    if (error?.message === "Backend offline - request short-circuited" || error?.code === "BACKEND_UNAVAILABLE") {
      return Promise.reject(error);
    }

    // Basic dedupe for global error toasts to avoid spamming the user
    if (!apiClient._lastToastTimes) apiClient._lastToastTimes = {};
    const now = Date.now();
    const cooldownMs = 30 * 1000; // 30 seconds for high level backend messages

    if (error.response) {
      // Handle specific error codes
      switch (error.response.status) {
        case 503:
          setBackendHealth({
            status: "offline",
            lastCheckedAt: Date.now(),
            unavailableUntil: Date.now() + 10 * 1000,
            lastError: error.response.data?.message || error.response.data?.error || "Backend unavailable",
            lastStatusCode: 503,
            reason: "service-unavailable",
          });
          refreshBackendHealth().catch(() => {});
          // show a single backend-unavailable toast (deduped)
          if (!apiClient._lastToastTimes._backend || now - apiClient._lastToastTimes._backend > cooldownMs) {
            apiClient._lastToastTimes._backend = now;
            toast.error("Backend temporarily unavailable. Some features may be degraded.");
          }
          break;
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem("token");
          if (window.location.pathname !== "/login") {
            toast.error("Session expired. Please login again.");
            window.location.href = "/login";
          }
          break;
        case 403:
          if (!apiClient._lastToastTimes._403 || now - apiClient._lastToastTimes._403 > cooldownMs) {
            apiClient._lastToastTimes._403 = now;
            toast.error("You do not have permission to perform this action.");
          }
          break;
        case 404:
          if (!apiClient._lastToastTimes._404 || now - apiClient._lastToastTimes._404 > cooldownMs) {
            apiClient._lastToastTimes._404 = now;
            toast.error("Resource not found.");
          }
          break;
        case 429:
          if (!apiClient._lastToastTimes._429 || now - apiClient._lastToastTimes._429 > cooldownMs) {
            apiClient._lastToastTimes._429 = now;
            toast.error("Too many requests. Please try again later.");
          }
          break;
        case 500:
            if (!apiClient._lastToastTimes._500 || now - apiClient._lastToastTimes._500 > cooldownMs) {
              apiClient._lastToastTimes._500 = now;
              toast.error("Server error. Please try again later.");
            }
          break;
        default:
          // Show error message from server if available
          const errorMessage =
            error.response.data?.message ||
            error.response.data?.error ||
            "An error occurred";
          // dedupe identical server messages for a short window
          const key = `msg:${errorMessage}`;
          if (!apiClient._lastToastTimes[key] || now - apiClient._lastToastTimes[key] > cooldownMs) {
            apiClient._lastToastTimes[key] = now;
            toast.error(errorMessage);
          }
      }
    } else if (error.request) {
      // Request made but no response — mark backend as offline for a short window
      const offlineWindowMs = 10 * 1000; // 10s short-circuit period
      apiClient._offlineUntil = Date.now() + offlineWindowMs;
      setBackendHealth({
        status: "offline",
        lastCheckedAt: Date.now(),
        unavailableUntil: Date.now() + offlineWindowMs,
        lastError: error.message || "No response from server",
        lastStatusCode: null,
        reason: "no-response",
      });
      refreshBackendHealth().catch(() => {});

      if (!apiClient._lastToastTimes._noreply || now - apiClient._lastToastTimes._noreply > cooldownMs) {
        apiClient._lastToastTimes._noreply = now;
        toast.error("No response from server. Please check your connection.");
      }
    } else {
      // Something else happened
      toast.error("An unexpected error occurred.");
    }
    return Promise.reject(error);
  },
);

void refreshBackendHealth();

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
    getAll: (params) => safeRequest(() => apiClient.get("/transactions", { params })),
    getStats: (params) => safeRequest(() => apiClient.get("/transactions/stats", { params })),
    getById: (id) => apiClient.get(`/transactions/${id}`),
    create: (data) => apiClient.post("/transactions", data),
    update: (id, data) => apiClient.put(`/transactions/${id}`, data),
    delete: (id) => apiClient.delete(`/transactions/${id}`),
    bulkDelete: (ids) =>
      apiClient.delete("/transactions/bulk", { data: { ids } }),
    deleteAll: () => apiClient.delete("/transactions/all"),
    upload: (formData, config = {}) =>
      apiClient.post("/transactions/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        ...config,
      }),
    createImportJob: (data) => apiClient.post("/transactions/import-jobs", data),
    getImportJob: (jobId) => apiClient.get(`/transactions/import-jobs/${jobId}`),
    streamImportJob: (jobId) => {
      const token = getAuthToken();
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      return `${API_BASE_URL}/transactions/import-jobs/${jobId}/stream${query}`;
    },
    addImportChunk: (jobId, data) =>
      apiClient.post(`/transactions/import-jobs/${jobId}/chunks`, data),
    finalizeImportJob: (jobId) =>
      apiClient.post(`/transactions/import-jobs/${jobId}/finalize`),
    retryImportChunks: (jobId, data) =>
      apiClient.post(`/transactions/import-jobs/${jobId}/retry`, data),
    cancelImportJob: (jobId) =>
      apiClient.post(`/transactions/import-jobs/${jobId}/cancel`),
  },

  dashboard: {
    overview: () => safeRequest(() => apiClient.get("/dashboard/overview")),
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
    workspace: (params) => apiClient.get("/charts/workspace", { params }),
    generate: (data) => apiClient.post("/charts/generate", data),
    getReports: () => apiClient.get("/charts/reports"),
    saveReport: (data) => apiClient.post("/charts/reports", data),
    deleteReport: (reportId) => apiClient.delete(`/charts/reports/${reportId}`),
  },

  // AI Charts (async jobs)
  aiCharts: {
    createJob: (data) => apiClient.post(`/ai-charts/jobs`, data),
    getJob: (jobId) => apiClient.get(`/ai-charts/jobs/${jobId}`),
    streamJobUrl: (jobId) => {
      const token = getAuthToken();
      const query = token ? `?token=${encodeURIComponent(token)}` : "";
      return `${API_BASE_URL}/ai-charts/jobs/${jobId}/stream${query}`;
    },
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
