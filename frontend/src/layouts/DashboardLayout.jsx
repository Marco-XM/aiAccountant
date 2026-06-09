import React, { useState, useEffect, useCallback, useContext } from "react";
import { api, useBackendStatus } from "../config/api";
import normalizeOverview from "../utils/normalizeOverview";
import KPITile from "../components/Dashboard/KPITile";
import FinancialHealth from "../components/Dashboard/FinancialHealth";
import AIInsightsPanel from "../components/Dashboard/AIInsightsPanel";
import OperationsSnapshot from "../components/Dashboard/OperationsSnapshot";
import QuickActionsHub from "../components/Dashboard/QuickActionsHub";
import { AuthContext } from "../Context/AuthContext";
import AlertsWidget from "../components/Dashboard/AlertsWidget";
import ErrorBoundary from "../components/ErrorBoundary";

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
};

const DashboardLayout = () => {
  const { user } = useContext(AuthContext);
  const [overview, setOverview] = useState(null);
  const backendStatus = useBackendStatus();
  // Hard-offline means no connection at all; degraded means backend is up but
  // DB is still warming (cold start). Only skip the fetch on hard offline.
  const backendUnavailable = backendStatus.status === "offline";
  const backendDegraded = backendStatus.status === "degraded";

  const fetchOverview = useCallback(async () => {
    if (backendUnavailable) return;
    try {
      const res = await api.dashboard.overview();
      setOverview(normalizeOverview(res.data || {}));
    } catch {
      // sub-components handle their own errors
    }
  }, [backendUnavailable]);

  useEffect(() => { fetchOverview(); }, [fetchOverview]);

  const firstName = user?.name?.split(" ")[0] || "there";

  return (
    <div className="min-h-screen" style={{ background: "var(--ui-bg)" }}>

      {/* ── Welcome Banner ───────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--ui-nav-bg) 0%, #1a3c8a 55%, #1e4fa0 100%)",
          borderBottom: "1px solid rgba(255,250,255,0.08)",
        }}
        className="px-6 pt-8 pb-10"
      >
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium" style={{ color: "rgba(255,250,255,0.65)" }}>
                {greeting()},
              </p>
              <h1 className="mt-0.5 text-3xl font-extrabold tracking-tight text-white">
                {firstName}!
              </h1>
              <p className="mt-1 text-sm" style={{ color: "rgba(255,250,255,0.55)" }}>
                Here's your financial overview for today.
              </p>
            </div>

            {backendUnavailable && (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                style={{
                  background: "rgba(216,49,91,0.20)",
                  border: "1px solid rgba(216,49,91,0.45)",
                  color: "#fca5a5",
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-red-400" />
                Backend offline — data unavailable
              </div>
            )}
            {!backendUnavailable && backendDegraded && (
              <div
                className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium"
                style={{
                  background: "rgba(234,179,8,0.15)",
                  border: "1px solid rgba(234,179,8,0.35)",
                  color: "#fde68a",
                }}
              >
                <span className="inline-block h-2 w-2 rounded-full bg-yellow-400 animate-pulse" />
                Connecting to server…
              </div>
            )}
          </div>

          {/* KPI Row */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
            <KPITile primary label="Revenue"   value={overview?.revenue   ?? "$--"} delta={overview?.growthPct} tone="blue"   />
            <KPITile       label="Expenses"   value={overview?.expenses  ?? "$--"}                             tone="rose"   />
            <KPITile       label="Net Profit" value={overview?.netProfit ?? "$--"}                             tone="green"  />
            <KPITile       label="Cash Flow"  value={overview?.cashFlow  ?? "$--"}                             tone="cyan"   />
            <KPITile       label="Growth"     value={overview?.growthPct ?? "--%"}                             tone="violet" />
          </div>
        </div>
      </div>

      {/* ── Main Grid ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* Left / main column */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            <ErrorBoundary>
              <FinancialHealth />
              <AIInsightsPanel insights={overview?.insights} />
              <OperationsSnapshot />
            </ErrorBoundary>
          </div>

          {/* Right / sidebar */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-6">
            <div className="sticky top-6 space-y-6">
              <QuickActionsHub />
              <AlertsWidget alerts={overview?.alerts} />
            </div>
          </aside>

        </div>
      </div>
    </div>
  );
};

export default DashboardLayout;

