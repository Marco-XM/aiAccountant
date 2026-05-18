import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import { api } from "../../config/api";

const palette = [
  "#00c2ff",
  "#16f2b3",
  "#ffa726",
  "#ff6b9d",
  "#8d8bff",
  "#7dd3fc",
  "#4ade80",
  "#f97316",
  "#f43f5e",
];

const smartPromptsFallback = [
  "Show my monthly expenses",
  "Compare income vs expenses",
  "Show suspicious spending spikes",
  "Visualize cash flow for last 6 months",
  "Top expense categories as a donut",
  "Compare clients by revenue",
];

const defaultFilters = {
  dateRange: "12m",
  type: "all",
  category: "all",
  search: "",
};

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const dateFmt = (value) => {
  if (value === null || value === undefined) return "--";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const toCurrency = (value) => currency.format(Number(value || 0));
const toCompact = (value) => compact.format(Number(value || 0));

const Card = ({ children, className = "" }) => (
  <section
    className={`rounded-3xl border border-white/15 bg-slate-950/55 shadow-[0_24px_90px_rgba(2,6,23,0.38)] backdrop-blur-xl ${className}`}
    style={{ fontFamily: "Space Grotesk, Manrope, Segoe UI, sans-serif" }}
  >
    {children}
  </section>
);

const KpiTile = ({ label, value, delta, tone = "cyan" }) => {
  const toneClass = {
    cyan: "from-cyan-500/60 to-sky-500/20",
    green: "from-emerald-500/60 to-teal-500/20",
    rose: "from-rose-500/60 to-orange-500/20",
    violet: "from-violet-500/60 to-indigo-500/20",
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/55 px-4 py-3">
      <div className={`pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${toneClass[tone] || toneClass.cyan}`} />
      <p className="text-xs uppercase tracking-[0.24em] text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-400">{delta}</p>
    </div>
  );
};

const Heatmap = ({ matrix = [] }) => {
  const max = Math.max(
    1,
    ...matrix.flatMap((row) => row.weeks.map((week) => Math.abs(week.value || 0)))
  );

  const getBg = (value) => {
    const ratio = Math.min(1, Math.abs(value || 0) / max);
    if (value >= 0) {
      return `rgba(22, 242, 179, ${0.08 + ratio * 0.82})`;
    }
    return `rgba(255, 107, 157, ${0.08 + ratio * 0.82})`;
  };

  return (
    <div className="grid grid-cols-[64px_1fr] gap-2">
      <div className="space-y-2 pt-1">
        {matrix.map((row) => (
          <div key={row.day} className="h-6 text-xs text-slate-400">
            {row.day}
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {matrix.map((row) => (
          <div key={row.day} className="grid grid-cols-12 gap-1">
            {row.weeks.map((week) => (
              <div
                key={`${row.day}-${week.weekIndex}`}
                className="h-6 rounded-md border border-white/10"
                style={{ background: getBg(week.value) }}
                title={`${row.day} / Week ${week.weekIndex + 1}: ${toCurrency(week.value)}`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const ChartRenderer = ({ chart, widgetTitle }) => {
  if (!chart) {
    return <p className="text-sm text-slate-400">No chart selected yet.</p>;
  }

  const title = widgetTitle || chart.title || "Analytics View";
  const type = chart.type;
  const data = chart.data || [];

  const commonAxes = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
      <XAxis dataKey={chart.xKey || "label"} stroke="rgba(203,213,225,0.8)" tick={{ fontSize: 12 }} />
      <YAxis stroke="rgba(203,213,225,0.8)" tick={{ fontSize: 12 }} />
      <Tooltip
        contentStyle={{
          borderRadius: 12,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(2,6,23,0.95)",
          color: "#f8fafc",
        }}
      />
      <Legend />
    </>
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <p className="text-xs text-slate-400">{chart.description || "Dynamic chart generated from your live accounting data."}</p>
      </div>

      <div className="h-[420px] rounded-2xl border border-white/10 bg-slate-950/40 p-3">
        {type === "bar" || type === "stackedBar" ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 12, right: 14, left: 6, bottom: 8 }}>
              {commonAxes}
              {(chart.yKeys || ["amount"]).map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  stackId={type === "stackedBar" ? "stack" : undefined}
                  fill={palette[index % palette.length]}
                  radius={[6, 6, 0, 0]}
                />
              ))}
              <Brush dataKey={chart.xKey || "label"} height={20} stroke="#38bdf8" />
            </BarChart>
          </ResponsiveContainer>
        ) : null}

        {type === "line" ? (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 12, right: 14, left: 6, bottom: 8 }}>
              {commonAxes}
              {(chart.yKeys || ["amount"]).map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={palette[index % palette.length]}
                  strokeWidth={2.8}
                  dot={false}
                />
              ))}
              <Brush dataKey={chart.xKey || "label"} height={20} stroke="#38bdf8" />
            </LineChart>
          </ResponsiveContainer>
        ) : null}

        {type === "area" ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 14, left: 6, bottom: 8 }}>
              {commonAxes}
              {(chart.yKeys || ["amount"]).map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={palette[index % palette.length]}
                  fill={palette[index % palette.length]}
                  fillOpacity={0.24}
                  strokeWidth={2}
                />
              ))}
              <Brush dataKey={chart.xKey || "label"} height={20} stroke="#38bdf8" />
            </AreaChart>
          </ResponsiveContainer>
        ) : null}

        {(type === "pie" || type === "donut") && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(2,6,23,0.95)",
                  color: "#f8fafc",
                }}
              />
              <Legend />
              <Pie
                data={data}
                dataKey={chart.valueKey || "expense"}
                nameKey={chart.nameKey || "name"}
                innerRadius={type === "donut" ? 70 : 0}
                outerRadius={130}
                paddingAngle={2}
                label
              >
                {data.map((item, index) => (
                  <Cell key={`${item.name || item.label}-${index}`} fill={palette[index % palette.length]} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        )}

        {type === "scatter" && (
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 12, right: 14, left: 6, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.15)" />
              <XAxis
                type="number"
                dataKey={chart.xKey || "x"}
                stroke="rgba(203,213,225,0.8)"
                tickFormatter={(value) => dateFmt(value)}
                domain={["auto", "auto"]}
              />
              <YAxis type="number" dataKey={chart.yKey || "y"} stroke="rgba(203,213,225,0.8)" />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.15)",
                  background: "rgba(2,6,23,0.95)",
                  color: "#f8fafc",
                }}
                formatter={(value, key, payload) => {
                  if (key === "y") return [toCurrency(value), "Signed amount"];
                  if (key === "x") return [payload?.payload?.dateLabel || dateFmt(value), "Date"];
                  return [value, key];
                }}
              />
              <Scatter data={data} fill="#00c2ff" />
            </ScatterChart>
          </ResponsiveContainer>
        )}

        {type === "forecast" && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={[...(data || []), ...((chart.forecast || []).map((item) => ({ ...item, projected: true })))]}>
              {commonAxes}
              <Bar dataKey="income" fill="#16f2b3" radius={[6, 6, 0, 0]} />
              <Bar dataKey="expense" fill="#ff6b9d" radius={[6, 6, 0, 0]} />
              <Line type="monotone" dataKey="net" stroke="#00c2ff" strokeWidth={3} dot={false} />
              <Line type="monotone" dataKey="projectedNet" stroke="#fbbf24" strokeWidth={3} strokeDasharray="4 4" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}

        {type === "heatmap" && <Heatmap matrix={data} />}
      </div>
    </div>
  );
};

const SavedReports = ({ reports, onLoad, onDelete }) => (
  <Card className="p-4">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Saved reports</h3>
      <span className="rounded-full border border-white/15 px-2 py-1 text-[11px] text-slate-300">{reports.length}</span>
    </div>

    <div className="mt-4 space-y-2">
      {reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/20 p-4 text-xs text-slate-400">
          No saved reports yet. Generate a chart and save it for stakeholders.
        </div>
      ) : (
        reports.map((report) => (
          <div key={report.id} className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
            <p className="text-sm font-medium text-white">{report.title}</p>
            <p className="mt-1 text-xs text-slate-400">{dateFmt(report.createdAt)}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => onLoad(report)}
                className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-200"
              >
                Open
              </button>
              <button
                type="button"
                onClick={() => onDelete(report.id)}
                className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-200"
              >
                Delete
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </Card>
);

const ChartGenerator = () => {
  const [workspace, setWorkspace] = useState(null);
  const [reports, setReports] = useState([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [prompt, setPrompt] = useState("Show monthly expenses and anomalies");
  const [filters, setFilters] = useState(defaultFilters);
  const [result, setResult] = useState(null);
  const [selectedWidget, setSelectedWidget] = useState(null);
  const [layout, setLayout] = useState(["main", "insights"]);
  const hasBootstrappedResult = useRef(false);
  const dragRef = useRef(null);
  const chartRegionRef = useRef(null);

  const loadWorkspace = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const [workspaceResponse, reportsResponse] = await Promise.all([
        api.charts.workspace(filters),
        api.charts.getReports(),
      ]);
      setWorkspace(workspaceResponse.data);
      setReports(reportsResponse.data?.reports || []);
      if (!hasBootstrappedResult.current && workspaceResponse.data?.suggestedCharts?.[0]?.payload) {
        setResult({
          query: "Auto workspace recommendation",
          chart: workspaceResponse.data.suggestedCharts[0].payload,
          insights: workspaceResponse.data.quickInsights || [],
          kpis: workspaceResponse.data.kpis || null,
          recommendations: [],
          profile: workspaceResponse.data.profile || null,
          anomalies: [],
        });
        hasBootstrappedResult.current = true;
      }
    } catch (error) {
      console.error("Failed to load AI chart workspace", error);
      toast.error("Unable to load AI chart workspace");
    } finally {
      setLoadingWorkspace(false);
    }
  }, [filters]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const categories = useMemo(() => {
    const items = new Set(["all"]);
    (workspace?.suggestedCharts?.find((item) => item.id === "category-donut")?.payload?.data || []).forEach((row) => {
      if (row.name) items.add(row.name);
    });
    return Array.from(items);
  }, [workspace]);

  const runGeneration = useCallback(async (queryText = prompt) => {
    if (!String(queryText || "").trim()) {
      toast.error("Type a prompt for the analytics assistant");
      return;
    }

    setGenerating(true);
    try {
      const response = await api.charts.generate({
        query: queryText,
        filters,
      });
      setResult(response.data);
      setSelectedWidget(null);
      toast.success("Analytics chart generated");
    } catch (error) {
      console.error("Failed to generate AI chart", error);
      toast.error(error.response?.data?.error || "Failed to generate chart");
    } finally {
      setGenerating(false);
    }
  }, [filters, prompt]);

  const onSaveReport = async () => {
    if (!result?.chart) {
      toast.error("Generate a chart first");
      return;
    }

    const title = `${result.chart.title || "AI Chart"} (${new Date().toLocaleDateString()})`;
    try {
      const response = await api.charts.saveReport({
        title,
        payload: result,
      });
      setReports((current) => [response.data.report, ...current]);
      toast.success("Report saved");
    } catch (error) {
      console.error("Failed to save report", error);
      toast.error("Failed to save report");
    }
  };

  const onDeleteReport = async (reportId) => {
    try {
      await api.charts.deleteReport(reportId);
      setReports((current) => current.filter((report) => report.id !== reportId));
      toast.success("Report removed");
    } catch (error) {
      console.error("Failed deleting report", error);
      toast.error("Delete failed");
    }
  };

  const onLoadReport = (report) => {
    setResult(report.payload || null);
    toast.success("Loaded saved report");
  };

  const fullscreenChart = async () => {
    if (!chartRegionRef.current) return;
    try {
      if (!document.fullscreenElement) {
        await chartRegionRef.current.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch (error) {
      console.error("Fullscreen failed", error);
      toast.error("Fullscreen not available in this browser");
    }
  };

  const exportJson = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai-chart-report-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported as JSON");
  };

  const swapLayout = (target) => {
    const source = dragRef.current;
    if (!source || source === target) return;

    setLayout((current) => {
      const next = [...current];
      const from = next.indexOf(source);
      const to = next.indexOf(target);
      if (from < 0 || to < 0) return current;
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });

    dragRef.current = null;
  };

  const renderInsights = (
    <Card className="p-5">
      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-fuchsia-200">AI insights</h3>
      <div className="mt-4 space-y-3">
        {(result?.insights || workspace?.quickInsights || []).map((line, index) => (
          <div key={`${line}-${index}`} className="rounded-xl border border-white/10 bg-slate-900/55 p-3 text-sm text-slate-100">
            {line}
          </div>
        ))}
      </div>

      {!!result?.recommendations?.length && (
        <div className="mt-4 space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Recommendations</p>
          {result.recommendations.map((line, index) => (
            <p key={`${line}-${index}`} className="text-sm text-slate-300">{line}</p>
          ))}
        </div>
      )}

      {!!result?.anomalies?.length && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-[0.2em] text-rose-300">Anomaly detections</p>
          <div className="mt-2 space-y-2">
            {result.anomalies.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-100">
                <div className="flex items-center justify-between gap-3">
                  <span>{item.category || "Uncategorized"}</span>
                  <span>{toCurrency(item.amount)}</span>
                </div>
                <p className="mt-1 text-rose-200/90">{item.desc || item.vendor || "Potential outlier"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );

  const renderMainChart = (
    <div ref={chartRegionRef}>
      <Card className="p-5">
        <ChartRenderer
          chart={selectedWidget?.payload || result?.chart || workspace?.suggestedCharts?.[0]?.payload}
          widgetTitle={selectedWidget?.title}
        />
      </Card>
    </div>
  );

  return (
    <div
      className="min-h-screen px-5 py-6 text-slate-100"
      style={{
        background:
          "radial-gradient(circle at 0% 0%, rgba(14,165,233,0.18), transparent 36%), radial-gradient(circle at 100% 0%, rgba(217,70,239,0.14), transparent 32%), linear-gradient(180deg, #020617 0%, #020617 44%, #030b1f 100%)",
        fontFamily: "Space Grotesk, Manrope, Segoe UI, sans-serif",
      }}
    >
      <div className="mx-auto max-w-[1600px] space-y-5">
        <Card className="relative overflow-hidden p-6">
          <div className="pointer-events-none absolute -right-12 -top-10 h-36 w-36 rounded-full bg-cyan-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-fuchsia-500/20 blur-2xl" />

          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-cyan-200">AI Financial Analytics Workspace</p>
              <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-white">Enterprise AI Charts</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-300">
                Build investor-grade financial narratives from your real accounting data using natural language, dynamic chart intelligence, anomaly detection, and forecasting.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={fullscreenChart} className="rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-sm text-white">
                Fullscreen
              </button>
              <button type="button" onClick={exportJson} className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-100">
                Export
              </button>
              <button type="button" onClick={onSaveReport} className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-100">
                Save Report
              </button>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-4">
            <KpiTile label="Transactions" value={toCompact(result?.kpis?.totalTransactions ?? workspace?.kpis?.totalTransactions ?? 0)} delta="Rows currently indexed" tone="cyan" />
            <KpiTile label="Income" value={toCurrency(result?.kpis?.totalIncome ?? workspace?.kpis?.totalIncome ?? 0)} delta="Filtered dataset income" tone="green" />
            <KpiTile label="Expenses" value={toCurrency(result?.kpis?.totalExpense ?? workspace?.kpis?.totalExpense ?? 0)} delta="Filtered dataset expense" tone="rose" />
            <KpiTile label="Net cash flow" value={toCurrency(result?.kpis?.netCashFlow ?? workspace?.kpis?.netCashFlow ?? 0)} delta="Income minus expenses" tone="violet" />
          </div>
        </Card>

        <div className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
          <Card className="p-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Ask AI</h2>
              <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">Real transaction-aware</span>
            </div>

            <div className="mt-4 flex flex-col gap-3 md:flex-row">
              <textarea
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                placeholder="Show software spending trend and flag unusual spikes"
                className="min-h-[110px] flex-1 rounded-2xl border border-white/15 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400"
              />

              <div className="grid w-full gap-2 md:w-[220px]">
                <select
                  value={filters.dateRange}
                  onChange={(event) => setFilters((current) => ({ ...current, dateRange: event.target.value }))}
                  className="rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="30d">Last 30 days</option>
                  <option value="90d">Last 90 days</option>
                  <option value="6m">Last 6 months</option>
                  <option value="12m">Last 12 months</option>
                  <option value="all">All time</option>
                </select>

                <select
                  value={filters.type}
                  onChange={(event) => setFilters((current) => ({ ...current, type: event.target.value }))}
                  className="rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                >
                  <option value="all">All transaction types</option>
                  <option value="income">Income only</option>
                  <option value="expense">Expense only</option>
                  <option value="transfer">Transfer only</option>
                </select>

                <select
                  value={filters.category}
                  onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
                  className="rounded-xl border border-white/15 bg-slate-950/60 px-3 py-2 text-sm text-slate-200"
                >
                  {categories.map((item) => (
                    <option key={item} value={item}>
                      {item === "all" ? "All categories" : item}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  disabled={generating || loadingWorkspace}
                  onClick={() => runGeneration(prompt)}
                  className="rounded-xl border border-cyan-400/30 bg-cyan-500/20 px-3 py-2 text-sm font-semibold text-cyan-100 disabled:opacity-50"
                >
                  {generating ? "Analyzing..." : "Generate"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {(workspace?.suggestedPrompts || smartPromptsFallback).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    setPrompt(item);
                    runGeneration(item);
                  }}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 hover:border-cyan-400/40"
                >
                  {item}
                </button>
              ))}
            </div>
          </Card>

          <SavedReports reports={reports} onLoad={onLoadReport} onDelete={onDeleteReport} />
        </div>

        {workspace?.suggestedCharts?.length ? (
          <Card className="p-5">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Suggested charts</h3>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {workspace.suggestedCharts.map((widget) => (
                <button
                  key={widget.id}
                  type="button"
                  onClick={() => setSelectedWidget(widget)}
                  className={`rounded-2xl border p-4 text-left transition ${selectedWidget?.id === widget.id ? "border-cyan-300/60 bg-cyan-500/10" : "border-white/10 bg-slate-900/45 hover:border-cyan-500/30"}`}
                >
                  <p className="text-sm font-semibold text-white">{widget.title}</p>
                  <p className="mt-1 text-xs text-slate-400">{widget.subtitle}</p>
                  <p className="mt-3 text-[11px] uppercase tracking-[0.2em] text-cyan-300">{widget.type}</p>
                </button>
              ))}
            </div>
          </Card>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-2">
          {layout.map((slot) => (
            <div
              key={slot}
              draggable
              onDragStart={() => {
                dragRef.current = slot;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => swapLayout(slot)}
            >
              {slot === "main" ? renderMainChart : renderInsights}
            </div>
          ))}
        </div>

        <Card className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-200">Dataset intelligence</h3>
            <button
              type="button"
              onClick={loadWorkspace}
              disabled={loadingWorkspace}
              className="rounded-xl border border-white/15 bg-white/5 px-3 py-1.5 text-xs text-slate-200 disabled:opacity-50"
            >
              Refresh profile
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <p className="text-xs text-slate-400">Rows available</p>
              <p className="mt-2 text-xl font-semibold text-white">{toCompact(workspace?.profile?.rowCount || 0)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <p className="text-xs text-slate-400">Detected columns</p>
              <p className="mt-2 text-xl font-semibold text-white">{workspace?.profile?.columns?.length || 0}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <p className="text-xs text-slate-400">Date range</p>
              <p className="mt-2 text-sm font-semibold text-white">
                {workspace?.profile?.dateRange?.from ? `${dateFmt(workspace.profile.dateRange.from)} to ${dateFmt(workspace.profile.dateRange.to)}` : "No date range"}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/55 p-3">
              <p className="text-xs text-slate-400">Currencies</p>
              <p className="mt-2 text-sm font-semibold text-white">{(workspace?.profile?.currencies || []).join(", ") || "USD"}</p>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
            <table className="min-w-full divide-y divide-white/10 text-sm">
              <thead className="bg-slate-900/70 text-xs uppercase tracking-[0.2em] text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left">Column</th>
                  <th className="px-3 py-2 text-left">Detected type</th>
                  <th className="px-3 py-2 text-right">Numeric</th>
                  <th className="px-3 py-2 text-right">Date</th>
                  <th className="px-3 py-2 text-right">Text</th>
                  <th className="px-3 py-2 text-right">Nulls</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 bg-slate-950/40 text-slate-200">
                {(workspace?.profile?.columns || []).slice(0, 12).map((column) => (
                  <tr key={column.name}>
                    <td className="px-3 py-2">{column.name}</td>
                    <td className="px-3 py-2">{column.detectedType}</td>
                    <td className="px-3 py-2 text-right">{column.numeric}</td>
                    <td className="px-3 py-2 text-right">{column.date}</td>
                    <td className="px-3 py-2 text-right">{column.text}</td>
                    <td className="px-3 py-2 text-right">{column.nulls}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default ChartGenerator;
