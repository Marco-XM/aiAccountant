import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { api } from "../../config/api";
import FiltersSidebar from "./FiltersSidebar";
import ChartGrid from "./ChartGrid";
import InsightsPanel from "./InsightsPanel";
import SavedReportsPanel from "./SavedReportsPanel";

const defaultFilters = { dateRange: "all", type: "all", category: "all", search: "" };

const WorkspaceLayout = () => {
  const [workspace, setWorkspace] = useState(null);
  const [reports, setReports] = useState([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState("Show monthly expenses and anomalies");
  const [filters, setFilters] = useState(defaultFilters);
  const [result, setResult] = useState(null);
  const hasBootstrapped = useRef(false);
  const chartCanvasRef = useRef(null);

  // ── Load workspace ───────────────────────────────────────────────────────
  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const [wsRes, rpRes] = await Promise.all([
        api.charts.workspace(filters),
        api.charts.getReports(),
      ]);
      setWorkspace(wsRes.data);
      setReports(rpRes.data?.reports || []);
      if (!hasBootstrapped.current && wsRes.data?.suggestedCharts?.[0]?.payload) {
        setResult({
          query: "Auto workspace recommendation",
          chart: wsRes.data.suggestedCharts[0].payload,
          insights: wsRes.data.quickInsights || [],
          kpis: wsRes.data.kpis || null,
          anomalies: [],
          recommendations: [],
          profile: wsRes.data.profile || null,
        });
        hasBootstrapped.current = true;
      }
    } catch (err) {
      console.error("Failed to load AI chart workspace", err);
      toast.error("Unable to load AI chart workspace");
    } finally {
      setLoadingWorkspace(false);
    }
  }, [filters]);

  useEffect(() => { loadWorkspace(); }, [loadWorkspace]);

  // ── Categories from workspace ────────────────────────────────────────────
  const categories = useMemo(() => {
    const items = new Set(["all"]);
    (workspace?.suggestedCharts?.find((c) => c.id === "category-donut")?.payload?.data || []).forEach(
      (row) => { if (row.name) items.add(row.name); }
    );
    return Array.from(items);
  }, [workspace]);

  // ── Chart generation ─────────────────────────────────────────────────────
  const generate = useCallback(async (queryText = prompt) => {
    if (!String(queryText || "").trim()) { toast.error("Type a prompt first"); return; }
    setGenerating(true);
    try {
      const res = await api.charts.generate({ query: queryText, filters });
      setResult(res.data);
      toast.success("Chart generated");
      // Scroll the canvas into view so the user can see the result
      setTimeout(() => {
        chartCanvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to generate chart");
    } finally {
      setGenerating(false);
    }
  }, [filters, prompt]);

  // ── Report management ────────────────────────────────────────────────────
  const saveReport = async () => {
    if (!result?.chart) { toast.error("Generate a chart first"); return; }
    const title = `${result.chart.title || "AI Chart"} (${new Date().toLocaleDateString()})`;
    try {
      const res = await api.charts.saveReport({ title, payload: result });
      setReports((prev) => [res.data.report, ...prev]);
      toast.success("Report saved");
    } catch { toast.error("Failed to save report"); }
  };

  const deleteReport = async (id) => {
    try {
      await api.charts.deleteReport(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      toast.success("Report removed");
    } catch { toast.error("Delete failed"); }
  };

  const loadReport = (report) => { setResult(report.payload || null); toast.success("Loaded saved report"); };

  // ── Export ────────────────────────────────────────────────────────────────
  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `ai-chart-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported as JSON");
  };

  const kpis = result?.kpis ?? workspace?.kpis;
  const fmt = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v ?? 0);
  const compact = (v) => new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(v ?? 0);

  return (
    <div className="min-h-screen px-4 py-6 text-ink" style={{ fontFamily: "Space Grotesk, Manrope, Segoe UI, sans-serif" }}>
      <div className="mx-auto max-w-[1600px] space-y-5">

        {/* ── Header / KPIs ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-3xl border border-theme bg-surface p-6 shadow-sm">
          <div className="pointer-events-none absolute -right-12 -top-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-2xl" />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-accent">AI Financial Analytics Workspace</p>
              <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">Enterprise AI Charts</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Build investor-grade financial narratives from your real accounting data using natural language,
                dynamic chart intelligence, anomaly detection, and forecasting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={exportJson} disabled={!result}
                className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-700 dark:text-cyan-100 disabled:opacity-40">
                Export JSON
              </button>
              <button type="button" onClick={saveReport} disabled={!result?.chart}
                className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-700 dark:text-emerald-100 disabled:opacity-40">
                Save Report
              </button>
              <button type="button" onClick={loadWorkspace} disabled={loadingWorkspace}
                className="rounded-xl border border-theme bg-surface-alt px-4 py-2 text-sm text-ink disabled:opacity-40">
                {loadingWorkspace ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>
          <div className="relative mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Transactions", value: compact(kpis?.totalTransactions), tone: "cyan" },
              { label: "Income", value: fmt(kpis?.totalIncome), tone: "green" },
              { label: "Expenses", value: fmt(kpis?.totalExpense), tone: "rose" },
              { label: "Net Cash Flow", value: fmt(kpis?.netCashFlow), tone: "violet" },
            ].map(({ label, value, tone }) => {
              const bar = { cyan: "from-cyan-500/50 to-sky-500/20", green: "from-emerald-500/50 to-teal-500/20", rose: "from-rose-500/50 to-orange-500/20", violet: "from-violet-500/50 to-indigo-500/20" };
              return (
                <div key={label} className="relative overflow-hidden rounded-2xl border border-theme bg-surface-alt px-4 py-3">
                  <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${bar[tone]}`} />
                  <p className="text-xs uppercase tracking-[0.2em] text-muted">{label}</p>
                  <p className="mt-2 text-2xl font-semibold text-ink">{value}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Ask AI + Filters ──────────────────────────────────────── */}
        <FiltersSidebar
          filters={filters}
          categories={categories}
          prompt={prompt}
          generating={generating}
          loadingWorkspace={loadingWorkspace}
          suggestedPrompts={workspace?.suggestedPrompts}
          onFiltersChange={setFilters}
          onPromptChange={setPrompt}
          onGenerate={generate}
        />

        {/* ── Chart canvas + AI insights ────────────────────────────── */}
        <div ref={chartCanvasRef} className="grid gap-5 xl:grid-cols-[1.6fr_0.6fr]">
          <ChartGrid result={result} />
          <InsightsPanel result={result} workspace={workspace} />
        </div>

        {/* ── Suggested charts ─────────────────────────────────────── */}
        {workspace?.suggestedCharts?.length ? (
          <div className="rounded-3xl border border-theme bg-surface p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Suggested charts</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {workspace.suggestedCharts.map((w) => (
                <button key={w.id} type="button"
                  onClick={() => {
                    setResult((prev) => ({ ...(prev || {}), chart: w.payload, insights: workspace.quickInsights || [], kpis: workspace.kpis || null }));
                    setTimeout(() => {
                      chartCanvasRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                  }}
                  className="rounded-2xl border border-theme bg-surface-alt p-4 text-left transition hover:border-[color:var(--ui-accent)]">
                  <p className="text-sm font-semibold text-ink">{w.title}</p>
                  <p className="mt-1 text-xs text-muted">{w.subtitle}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-accent">{w.type}</p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {/* ── Saved reports ─────────────────────────────────────────── */}
        <SavedReportsPanel reports={reports} onLoad={loadReport} onDelete={deleteReport} />

        {/* ── Dataset intelligence ──────────────────────────────────── */}
        {workspace?.profile && (
          <div className="rounded-3xl border border-theme bg-surface p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Dataset intelligence</h3>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: "Rows available", value: compact(workspace.profile.rowCount) },
                { label: "Detected columns", value: workspace.profile.columns?.length ?? 0 },
                {
                  label: "Date range",
                  value: workspace.profile.dateRange?.from
                    ? `${new Date(workspace.profile.dateRange.from).toLocaleDateString()} → ${new Date(workspace.profile.dateRange.to).toLocaleDateString()}`
                    : "—"
                },
                { label: "Currencies", value: (workspace.profile.currencies || []).join(", ") || "USD" },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-xl border border-theme bg-surface-alt p-3">
                  <p className="text-xs text-muted">{label}</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{String(value)}</p>
                </div>
              ))}
            </div>
            {workspace.profile.columns?.length > 0 && (
              <div className="mt-4 overflow-x-auto rounded-2xl border border-theme">
                <table className="min-w-full divide-y divide-[color:var(--ui-border)] text-sm">
                  <thead className="bg-surface-alt text-xs uppercase tracking-[0.2em] text-muted">
                    <tr>{["Column", "Type", "Numeric", "Date", "Text", "Nulls"].map((h) => <th key={h} className="px-3 py-2 text-left">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-[color:var(--ui-border)] bg-surface text-ink">
                    {workspace.profile.columns.slice(0, 14).map((col) => (
                      <tr key={col.name}>
                        <td className="px-3 py-2">{col.name}</td>
                        <td className="px-3 py-2">{col.detectedType}</td>
                        <td className="px-3 py-2">{col.numeric}</td>
                        <td className="px-3 py-2">{col.date}</td>
                        <td className="px-3 py-2">{col.text}</td>
                        <td className="px-3 py-2">{col.nulls}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkspaceLayout;
