import { QueryClient } from "@tanstack/react-query";

const defaultRetry = (failureCount, error) => {
  // Only retry for network errors or transient 502/503/504 server errors
  const status = error?.response?.status;
  const isNetworkError = !!error?.request && !error?.response;
  if (isNetworkError) return failureCount < 2;
  if ([502, 503, 504].includes(status)) return failureCount < 2;
  return false;
};

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: defaultRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** (attempt - 1), 30000),
      staleTime: 1000 * 60, // 1 minute
      cacheTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      refetchInterval: false,
    },
    mutations: {
      retry: false,
    },
  },
});

export default queryClient;
