import React, { useEffect, useState, useCallback } from "react";
import DataGrid from "../Transactions/DataGrid";
import { api, useBackendStatus } from "../../config/api";
import Card from "../ui/Card";
import ErrorBanner from "../ui/ErrorBanner";

const OperationsSnapshot = () => {
  const [loading, setLoading] = useState(true);
  const [recent, setRecent] = useState([]);
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);
  const backendStatus = useBackendStatus();
  const backendUnavailable = ["offline", "degraded"].includes(backendStatus.status);

  const fetch = useCallback(async () => {
    if (backendUnavailable) {
      setLoading(false);
      setRecent([]);
      setStats({});
      setError("Backend unavailable. Showing offline state until the server recovers.");
      return;
    }

    setLoading(true);
    setError(null);

    const normalizeRows = (payload) => {
      if (Array.isArray(payload)) return payload;
      if (Array.isArray(payload?.transactions)) return payload.transactions;
      if (Array.isArray(payload?.rows)) return payload.rows;
      return [];
    };

    try {
      const [allRes, statsRes] = await Promise.allSettled([
        api.transactions.getAll({ limit: 8 }),
        api.transactions.getStats(),
      ]);

      if (allRes.status === "fulfilled") {
        setRecent(normalizeRows(allRes.value.data));
      } else {
        setRecent([]);
      }

      if (statsRes.status === "fulfilled") {
        setStats(statsRes.value.data || {});
      } else {
        setStats({});
      }

      if (allRes.status === "rejected" && statsRes.status === "rejected") {
        setError("Failed to load operations data.");
      }
    } catch (err) {
      setError(
        err.response?.status === 503
          ? "Backend unavailable. Showing offline state until the server recovers."
          : "Failed to load operations data.",
      );
      setRecent([]);
      setStats({});
    } finally {
      setLoading(false);
    }
  }, [backendUnavailable]);

  useEffect(() => {
    fetch();
  }, [backendUnavailable, fetch]);

  return (
    <Card title="Operations Snapshot">
      {error && <ErrorBanner message={error} onRetry={fetch} />}

      <p className="text-xs text-slate-400">Recent transactions & pending items</p>

      <div className="mt-4">
        {loading ? (
          <div className="space-y-3">
            <div className="h-10 rounded bg-slate-800/40 animate-pulse" />
            <div className="h-10 rounded bg-slate-800/30 animate-pulse" />
            <div className="h-10 rounded bg-slate-800/30 animate-pulse" />
          </div>
        ) : (
          <div className="min-h-[120px]">
            <DataGrid rows={recent} />
          </div>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        <div className="rounded-lg bg-slate-900/40 p-3 text-xs text-slate-300">Pending reconciliations: {stats.pendingReconciliations ?? "-"}</div>
        <div className="rounded-lg bg-slate-900/40 p-3 text-xs text-slate-300">Uploads in progress: {stats.uploadsInProgress ?? "-"}</div>
        <div className="rounded-lg bg-slate-900/40 p-3 text-xs text-slate-300">Unreviewed: {stats.unreviewedCount ?? "-"}</div>
      </div>
    </Card>
  );
};

export default OperationsSnapshot;
