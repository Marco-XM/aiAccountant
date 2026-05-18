import apiClient, { api, API_BASE_URL } from "../../config/api";

export const parseApiError = (error) => {
  if (!error) return { type: "UNKNOWN", message: "Unknown error" };
  if (error?.code === "BACKEND_UNAVAILABLE" || error?.message === "Backend offline - request short-circuited") {
    return { type: "BACKEND_UNAVAILABLE", message: error.message || "Backend unavailable" };
  }

  if (error.request && !error.response) {
    return { type: "NETWORK_ERROR", message: error.message || "Network error" };
  }

  const status = error.response?.status;
  const data = error.response?.data;
  if (status === 400) return { type: "VALIDATION_ERROR", status, message: data?.message || data?.error || "Validation error" };
  if (status === 401) return { type: "AUTH_ERROR", status, message: data?.message || "Authentication required" };
  if (status === 403) return { type: "AUTH_ERROR", status, message: data?.message || "Forbidden" };
  if ([500, 502, 503, 504].includes(status)) return { type: "SERVER_ERROR", status, message: data?.message || "Server error" };

  return { type: "UNKNOWN", status, message: data?.message || error.message || "An error occurred" };
};

export { apiClient, api, API_BASE_URL };
export default apiClient;
