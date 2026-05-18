import React, { useEffect, useState, useCallback } from "react";
import { api, useBackendStatus } from "../../config/api";
import normalizeOverview from "../../utils/normalizeOverview";
import Card from "../ui/Card";
import ErrorBanner from "../ui/ErrorBanner";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";

const MiniSpark = ({ label }) => (
  <div className="rounded-md bg-slate-900/50 p-3">
    <p className="text-xs text-slate-400">{label}</p>
    <div className="mt-2 h-10 bg-gradient-to-r from-cyan-500/20 to-rose-500/10 rounded" />
  </div>
);

const FinancialHealth = () => {
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [error, setError] = useState(null);
  const backendStatus = useBackendStatus();
  const backendUnavailable = ["offline", "degraded"].includes(backendStatus.status);

  const fetch = useCallback(async () => {
    if (backendUnavailable) {
      setLoading(false);
      setOverview(null);
      setError("Backend unavailable. Financial health will resume when the server is back online.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await api.dashboard.overview();
      const normalized = normalizeOverview(res.data || {});
      setOverview(normalized || null);
    } catch (err) {
      setOverview(null);
      setError(
        err.response?.status === 503
          ? "Backend unavailable. Financial health will resume when the server is back online."
          : err.response?.data?.message || "Failed to load financial health.",
      );
    } finally {
      setLoading(false);
    }
  }, [backendUnavailable]);

  useEffect(() => {
    fetch();
  }, [backendUnavailable, fetch]);

  return (
    <section>
      <Card title="Financial Health">
        {error && <ErrorBanner message={error} onRetry={fetch} />}

        <p className="text-xs text-slate-400">Trends, forecasts and KPI comparisons</p>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {loading ? (
              <div className="animate-pulse space-y-4">
                <div className="h-10 rounded bg-slate-800/40" />
                <div className="h-48 rounded bg-slate-800/30" />
              </div>
            ) : (
              <>
                <MiniSpark label="Monthly Net" />

                <div className="rounded-md bg-slate-900/40 p-4">
                  <p className="text-sm text-slate-300">Income vs Expense (last 12 months)</p>
                  <div className="mt-3 h-48 rounded">
                    {overview?.trends && overview.trends.length > 0 ? (
                      <ResponsiveContainer width="100%" height={190}>
                        <AreaChart data={overview.trends} margin={{ top: 6, right: 12, left: 0, bottom: 6 }}>
                          <defs>
                            <linearGradient id="colorIncome" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="colorExpense" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.18} />
                              <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid stroke="rgba(255,255,255,0.03)" vertical={false} />
                          <XAxis dataKey="date" tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <YAxis tickFormatter={(v) => (typeof v === "number" ? `$${(v >= 1000 ? v / 1000 + 'k' : v)}` : v)} tick={{ fill: "#94a3b8", fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{ background: "#0f1724", border: "1px solid rgba(255,255,255,0.04)", color: "#fff" }}
                            formatter={(value, name) => {
                              return [typeof value === "number" ? `$${value.toLocaleString()}` : value, name];
                            }}
                          />
                          <Legend verticalAlign="top" align="right" wrapperStyle={{ color: "#94a3b8", fontSize: 12 }} />
                          <Area type="monotone" dataKey="income" stroke="#06b6d4" fillOpacity={1} fill="url(#colorIncome)" strokeWidth={2} />
                          <Area type="monotone" dataKey="expense" stroke="#fb7185" fillOpacity={1} fill="url(#colorExpense)" strokeWidth={2} />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full w-full bg-gradient-to-b from-slate-800 to-slate-900 rounded" />
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <aside className="space-y-4">
            {loading ? (
              <div className="animate-pulse space-y-3">
                <div className="h-12 rounded bg-slate-800/40" />
                <div className="h-12 rounded bg-slate-800/40" />
              </div>
            ) : (
              <>
                <div className="rounded-md bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-300">KPI Comparison</p>
                  <div className="mt-3 text-white text-2xl font-semibold">{overview?.kpiComparison ?? "+--%"}</div>
                </div>

                <div className="rounded-md bg-slate-900/40 p-4">
                  <p className="text-xs text-slate-300">Forecast</p>
                  <div className="mt-3 text-sm text-slate-300">{overview?.forecast?.summary ?? "N/A"}</div>
                </div>
              </>
            )}
          </aside>
        </div>
      </Card>
    </section>
  );
};

export default FinancialHealth;
