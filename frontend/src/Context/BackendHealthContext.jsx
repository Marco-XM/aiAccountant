import React, { createContext, useContext, useEffect } from "react";
import { useBackendStatus, refreshBackendHealth } from "../config/api";

const BackendHealthContext = createContext(null);

export const BackendHealthProvider = ({ children, pollInterval = 10000 }) => {
  const snapshot = useBackendStatus();

  useEffect(() => {
    let mounted = true;
    // Poll health periodically
    const id = setInterval(() => {
      refreshBackendHealth().catch(() => {});
    }, pollInterval);

    // initial ping
    refreshBackendHealth().catch(() => {});

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [pollInterval]);

  const value = {
    status: snapshot.status || "unknown",
    lastCheckedAt: snapshot.lastCheckedAt || 0,
    unavailableUntil: snapshot.unavailableUntil || 0,
    lastError: snapshot.lastError || null,
    reason: snapshot.reason || null,
    refresh: async () => {
      await refreshBackendHealth();
    },
    isOffline: snapshot.status === "offline",
    isDegraded: snapshot.status === "degraded",
    isOnline: snapshot.status === "online",
  };

  return <BackendHealthContext.Provider value={value}>{children}</BackendHealthContext.Provider>;
};

export const useBackendHealth = () => {
  const ctx = useContext(BackendHealthContext);
  if (!ctx) throw new Error("useBackendHealth must be used within BackendHealthProvider");
  return ctx;
};

export default BackendHealthContext;
