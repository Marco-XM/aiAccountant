import React, { useEffect, useState, useCallback } from "react";
import { api, useBackendStatus } from "../../config/api";
import normalizeOverview from "../../utils/normalizeOverview";
import Card from "../ui/Card";
import ErrorBanner from "../ui/ErrorBanner";

const SummaryTile = ({ label, value, hint }) => (
    <div className="h-20 rounded-xl bg-surface-alt border border-theme p-3 flex flex-col justify-between">
    <p className="text-xs text-muted uppercase">{label}</p>
    <div>
      <p className="text-2xl font-bold text-ink-2">{value ?? "--"}</p>
      {hint && <p className="text-xs text-muted">{hint}</p>}
    </div>
  </div>
);

const ExecutiveHeader = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({});
  const [error, setError] = useState(null);
  const backendStatus = useBackendStatus();
  const backendUnavailable = backendStatus.status === "offline";

  const fetch = useCallback(async () => {
    if (backendUnavailable) {
      setLoading(false);
      setSummary({});
      setError("Backend unavailable. Executive summary will return when the server is back online.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.dashboard.overview();
      const normalized = normalizeOverview(res.data || {});
      setSummary(normalized);
    } catch (err) {
      setSummary({});
      setError(
        err.response?.status === 503
          ? "Backend unavailable. Executive summary will return when the server is back online."
          : err.response?.data?.message || "Failed to load executive summary.",
      );
    } finally {
      setLoading(false);
    }
  }, [backendUnavailable]);

  useEffect(() => {
    fetch();
  }, [backendUnavailable, fetch]);

  return (
    <Card title="Executive Summary" className="p-6">
      {error && <ErrorBanner message={error} onRetry={fetch} />}

      <div className="flex items-start justify-between gap-6">
        <div className="flex-1">
          <p className="mt-1 text-sm text-muted">High-level snapshot with AI-driven summary and alerts</p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {loading ? (
              <>
                <div className="h-20 rounded-2xl bg-skeleton animate-pulse" />
                <div className="h-20 rounded-2xl bg-skeleton animate-pulse" />
                <div className="h-20 rounded-2xl bg-skeleton animate-pulse" />
              </>
            ) : (
              <>
                <SummaryTile label="Total Revenue" value={summary.revenue ?? "$--"} hint="Trailing 12 months" />
                <SummaryTile label="Net Profit" value={summary.netProfit ?? "$--"} hint="After-tax" />
                <SummaryTile label="Cash Flow" value={summary.cashFlow ?? "$--"} hint="30-day liquidity" />
              </>
            )}
          </div>
        </div>

        <div className="w-80">
          <Card title={null} className="bg-surface-alt p-4">
            <p className="text-xs text-muted">AI Summary</p>
            <p className="mt-2 text-sm text-ink">{loading ? "Loading insights…" : summary.aiSummary ?? "No summary available."}</p>
          </Card>

          <div className="mt-3">
            <Card title="Alerts" className="p-3">
              <ul className="mt-2 text-xs text-muted-2 space-y-2 min-h-[56px]">
                {loading ? (
                  <li className="h-3 w-full bg-skeleton rounded animate-pulse" />
                ) : summary.alerts && summary.alerts.length ? (
                  summary.alerts.map((a, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className={`mt-0.5 shrink-0 h-2 w-2 rounded-full ${a.tone === "rose" ? "bg-[#D8315B]" : "bg-violet-400"}`} />
                      <span><span className="font-medium text-ink">{a.title}</span>{a.detail ? ` — ${a.detail}` : ""}</span>
                    </li>
                  ))
                ) : (
                  <li>- No critical alerts</li>
                )}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </Card>
  );
};

export default ExecutiveHeader;
