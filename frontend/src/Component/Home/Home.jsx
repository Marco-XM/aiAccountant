import React, { useCallback, useContext, useEffect, useState } from "react";
import { Helmet } from "../../components/Head/Helmet";
import { Link } from "react-router-dom";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import toast from "react-hot-toast";
import { AuthContext } from "../../Context/AuthContext";
import { api } from "../../config/api";
import { useBackendHealth } from "../../Context/BackendHealthContext";

const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const EMPTY_DASHBOARD = {
  summary: {
    totalTransactions: 0,
    revenue: 0,
    expenses: 0,
    netProfit: 0,
    cashFlow: 0,
    monthlyGrowth: 0,
    burnRate: 0,
    runway: 0,
    taxEstimate: 0,
    profitMargin: 0,
    pendingCount: 0,
    outstandingInvoices: 0,
    bankBalance: 0,
    budgetUsage: 0,
    payrollEstimate: 0,
    subscriptionCosts: 0,
    reconciliationCount: 0,
  },
  monthlyTrend: [],
  topCategories: [],
  topVendors: [],
  heatmap: [],
  recentTransactions: [],
  suspicious: [],
  insights: [],
  workflow: { approvals: 0, reconciliation: 0, duplicateCount: 0, uncategorized: 0, reminders: [], tasks: [] },
};

const icons = {
  search: "m21 21-4.35-4.35M18 11a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z",
  spark: "M13 3 4 14h7l-1 7 9-12h-7l1-6Z",
  arrow: "M13 7l5 5m0 0-5 5m5-5H6",
  upload: "M12 16V4m0 0 4 4m-4-4-4 4M4 20h16",
  report: "M8 3h8l4 4v14H4V3h4Zm8 0v5h5M8 13h8M8 17h5",
  command: "M8 9h8M8 15h8M5 5h14v14H5z",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 13 4 4L19 7",
  alert: "M12 9v4m0 4h.01M10.3 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.7 3.86a2 2 0 0 0-3.4 0Z",
};

const Icon = ({ name, className = "h-4 w-4" }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
    <path d={icons[name]} strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
  </svg>
);

const cn = (...values) => values.filter(Boolean).join(" ");

const Button = ({ children, variant = "secondary", className = "", ...props }) => {
  const variants = {
    primary: "bg-slate-950 text-white shadow-[0_14px_34px_rgba(15,23,42,.22)] hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200",
    secondary: "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900",
    quiet: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
  };
  return (
    <button type="button" className={cn("inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition disabled:pointer-events-none disabled:opacity-50", variants[variant], className)} {...props}>
      {children}
    </button>
  );
};

const Panel = ({ children, className = "" }) => (
  <section className={cn("min-w-0 rounded-2xl border border-slate-200 bg-white shadow-[0_16px_44px_rgba(15,23,42,.07)] dark:border-white/10 dark:bg-slate-950", className)}>
    {children}
  </section>
);

const Pill = ({ children, tone = "neutral" }) => {
  const tones = {
    neutral: "border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
    blue: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-200",
    red: "border-red-200 bg-red-50 text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200",
    amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
  };
  return <span className={cn("inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone])}><span className="truncate">{children}</span></span>;
};

const Skeleton = ({ className = "" }) => <div className={cn("animate-pulse rounded-2xl bg-slate-200/80 dark:bg-slate-800", className)} />;

const formatMoney = (value) => currency.format(Number(value || 0));
const formatCompact = (value) => compact.format(Number(value || 0));

const MetricCard = ({ label, value, change, detail, tone = "slate", trend = [] }) => {
  const colors = {
    slate: { line: "#475467", fill: "rgba(71,84,103,.12)", accent: "bg-slate-900" },
    green: { line: "#10b981", fill: "rgba(16,185,129,.14)", accent: "bg-emerald-500" },
    red: { line: "#f04438", fill: "rgba(240,68,56,.12)", accent: "bg-red-500" },
    blue: { line: "#2563eb", fill: "rgba(37,99,235,.12)", accent: "bg-blue-500" },
    amber: { line: "#f59e0b", fill: "rgba(245,158,11,.14)", accent: "bg-amber-500" },
  };
  const color = colors[tone] || colors.slate;
  const positive = Number(change || 0) >= 0;

  return (
    <Panel className="relative overflow-hidden p-4">
      <span className={cn("absolute inset-x-0 top-0 h-1", color.accent)} />
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{value}</p>
          <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{detail}</p>
        </div>
        <Pill tone={positive ? "green" : "red"}>{positive ? "+" : ""}{percent.format(change || 0)}%</Pill>
      </div>
      <div className="mt-3 flex h-12 items-end gap-1">
        {(trend.length ? trend : [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }]).slice(-8).map((point, index, all) => {
          const max = Math.max(1, ...all.map((item) => Math.abs(item.value || 0)));
          const height = 18 + (Math.abs(point.value || 0) / max) * 28;
          return <span key={`${point.value}-${index}`} className="flex-1 rounded-t-md" style={{ height, background: color.line, opacity: 0.18 + (index / Math.max(1, all.length - 1)) * 0.5 }} />;
        })}
      </div>
    </Panel>
  );
};

const CommandPalette = ({ open, onClose, actions }) => {
  const [query, setQuery] = useState("");
  const filtered = actions.filter((action) => action.label.toLowerCase().includes(query.toLowerCase()));
  useEffect(() => { if (open) setQuery(""); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/55 p-3 backdrop-blur-sm" onMouseDown={onClose}>
      <div className="mx-auto mt-16 w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl dark:bg-slate-950" onMouseDown={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Icon name="command" className="h-5 w-5 text-blue-500" />
          <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm font-medium text-slate-950 outline-none dark:text-white" placeholder="Search commands, reports, workflows..." />
          <Button variant="quiet" className="min-h-8 px-2" onClick={onClose}><Icon name="close" /></Button>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.map((action) => (
            <button key={action.label} type="button" onClick={() => { action.run(); onClose(); }} className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-900">
              <span>{action.label}</span>
              <span className="shrink-0 text-xs text-slate-400">{action.hint}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

const Heatmap = ({ data = [] }) => {
  const map = new Map(data.map((item) => [`${item.day}-${item.hour}`, item]));
  const max = Math.max(1, ...data.map((item) => item.count || 0));
  return (
    <div className="grid grid-cols-12 gap-1">
      {Array.from({ length: 84 }).map((_, index) => {
        const day = Math.floor(index / 12);
        const hour = (index % 12) * 2;
        const item = map.get(`${day}-${hour}`) || { count: 0 };
        const opacity = item.count ? 0.18 + (item.count / max) * 0.72 : 0.08;
        return <div key={`${day}-${hour}`} title={`${item.count || 0} transactions`} className="aspect-square rounded-md bg-blue-500" style={{ opacity }} />;
      })}
    </div>
  );
};

const Home = () => {
  const { token } = useContext(AuthContext);
  const { isOffline, isDegraded, refresh } = useBackendHealth();
  const [dashboard, setDashboard] = useState(EMPTY_DASHBOARD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [darkMode, setDarkMode] = useState(() => window.localStorage.getItem("dashboard-theme") === "dark");
  const [commandOpen, setCommandOpen] = useState(false);
  const [widgetOrder, setWidgetOrder] = useState(["overview", "analytics", "ai", "transactions", "workflow"]);
  const [chartQuery, setChartQuery] = useState("");
  const [chartLoading, setChartLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [chartExplanation, setChartExplanation] = useState("");

  useEffect(() => {
    document.documentElement.classList.toggle("dark", darkMode);
    window.localStorage.setItem("dashboard-theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  const loadDashboard = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (isOffline) {
        setError("Backend temporarily unavailable");
        setLoading(false);
        return;
      }

      const response = await api.dashboard.overview();
      setDashboard({ ...EMPTY_DASHBOARD, ...response.data });
    } catch (loadError) {
      const msg = loadError.response?.data?.message || loadError.message || "Unable to load dashboard.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [token, isOffline]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const summary = dashboard.summary || EMPTY_DASHBOARD.summary;
  const monthlyTrend = dashboard.monthlyTrend?.length ? dashboard.monthlyTrend : [
    { month: "Jan", revenue: 0, expenses: 0, profit: 0, cashFlow: 0 },
    { month: "Feb", revenue: 0, expenses: 0, profit: 0, cashFlow: 0 },
  ];
  const miniTrend = monthlyTrend.map((item) => ({ value: item.profit || item.revenue || 0 }));
  const categoryPie = (dashboard.topCategories || []).slice(0, 6);

  const moveWidget = (id, direction) => {
    setWidgetOrder((current) => {
      const index = current.indexOf(id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const handleGenerateChart = async () => {
    if (!chartQuery.trim()) {
      toast.error("Enter a chart request first.");
      return;
    }
    setChartLoading(true);
    try {
      const response = await api.charts.generate({ query: chartQuery });
      setChartData(response.data.chartConfig);
      setChartExplanation(response.data.explanation);
      toast.success("AI chart generated");
    } catch (chartError) {
      console.error("Chart generation failed:", chartError);
    } finally {
      setChartLoading(false);
    }
  };

  const actions = [
    { label: "Refresh dashboard", hint: "R", run: loadDashboard },
    { label: "Open transactions workspace", hint: "Ledger", run: () => { window.location.href = "/transactions"; } },
    { label: "Open import center", hint: "Upload", run: () => { window.location.href = "/transactions"; } },
    { label: "Generate report", hint: "AI", run: () => setChartQuery("Monthly income vs expenses") },
    { label: darkMode ? "Switch to light mode" : "Switch to dark mode", hint: "Theme", run: () => setDarkMode(!darkMode) },
  ];

  const renderAiChart = () => {
    if (!chartData) return null;
    if (chartData.type === "pie" || chartData.type === "donut") {
      return (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={chartData.data} dataKey={chartData.valueKey} nameKey={chartData.nameKey} innerRadius={chartData.type === "donut" ? 64 : 0} outerRadius={102}>
              {chartData.data.map((_, index) => <Cell key={index} fill={["#2563eb", "#10b981", "#f04438", "#f59e0b", "#7c3aed", "#06b6d4"][index % 6]} />)}
            </Pie>
            <Tooltip formatter={(value) => formatMoney(value)} />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData.data}>
          <CartesianGrid vertical={false} stroke="rgba(148,163,184,.22)" />
          <XAxis dataKey={chartData.xKey} tickLine={false} axisLine={false} fontSize={11} />
          <YAxis tickLine={false} axisLine={false} fontSize={11} />
          <Tooltip />
          {(chartData.yKeys || []).map((key, index) => <Bar key={key} dataKey={key} fill={["#2563eb", "#10b981", "#f04438"][index % 3]} radius={[6, 6, 0, 0]} />)}
        </BarChart>
      </ResponsiveContainer>
    );
  };

  const widgets = {
    overview: (
      <div className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total revenue" value={formatMoney(summary.revenue)} change={summary.monthlyGrowth} detail="Compared with previous month" tone="green" trend={miniTrend} />
        <MetricCard label="Total expenses" value={formatMoney(summary.expenses)} change={summary.previousExpenses ? ((summary.currentExpenses - summary.previousExpenses) / summary.previousExpenses) * 100 : 0} detail="Current spend pressure" tone="red" trend={monthlyTrend.map((item) => ({ value: item.expenses }))} />
        <MetricCard label="Net profit" value={formatMoney(summary.netProfit)} change={summary.previousProfit ? ((summary.currentProfit - summary.previousProfit) / Math.abs(summary.previousProfit || 1)) * 100 : 0} detail={`${percent.format(summary.profitMargin)}% profit margin`} tone="blue" trend={monthlyTrend.map((item) => ({ value: item.profit }))} />
        <MetricCard label="Cash flow" value={formatMoney(summary.cashFlow)} change={summary.monthlyGrowth} detail={`${summary.runway ? `${percent.format(summary.runway)} months runway` : "Runway unavailable"}`} tone="slate" trend={monthlyTrend.map((item) => ({ value: item.cashFlow }))} />
      </div>
    ),
    analytics: (
      <div className="grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
        <Panel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Financial analytics</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Revenue, expenses, and profit</h2>
            </div>
            <Pill tone="blue">12 month trend</Pill>
          </div>
          <div className="mt-4 h-80 min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="revenue" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.22}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient>
                  <linearGradient id="expenses" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f04438" stopOpacity={0.18}/><stop offset="95%" stopColor="#f04438" stopOpacity={0}/></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="rgba(148,163,184,.22)" />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={11} tickFormatter={formatCompact} />
                <Tooltip formatter={(value) => formatMoney(value)} />
                <Area type="monotone" dataKey="revenue" stroke="#10b981" fill="url(#revenue)" strokeWidth={2} />
                <Area type="monotone" dataKey="expenses" stroke="#f04438" fill="url(#expenses)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Expense breakdown</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Top categories</h2>
          <div className="mt-4 h-56">
            {categoryPie.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={categoryPie} dataKey="amount" nameKey="category" innerRadius={58} outerRadius={86} paddingAngle={3}>
                    {categoryPie.map((_, index) => <Cell key={index} fill={["#2563eb", "#10b981", "#f04438", "#f59e0b", "#7c3aed", "#06b6d4"][index % 6]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatMoney(value)} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
                Import transactions to build category analytics.
              </div>
            )}
          </div>
          <div className="mt-3 space-y-2">
            {categoryPie.slice(0, 5).map((item) => (
              <div key={item.category} className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate font-medium text-slate-700 dark:text-slate-200">{item.category}</span>
                <span className="shrink-0 text-slate-500">{formatMoney(item.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    ),
    ai: (
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,.85fr)_minmax(0,1.15fr)]">
        <Panel className="p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">AI finance copilot</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Executive insights</h2>
            </div>
            <Pill tone="blue"><Icon name="spark" /> AI</Pill>
          </div>
          <div className="mt-4 space-y-3">
            {(dashboard.insights || []).map((insight) => (
              <div key={insight.title} className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900">
                <div className="flex items-start gap-3">
                  <span className={cn("mt-1 h-2.5 w-2.5 shrink-0 rounded-full", insight.type === "warning" ? "bg-amber-500" : insight.type === "positive" ? "bg-emerald-500" : "bg-blue-500")} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-950 dark:text-white">{insight.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">{insight.text}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel className="p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Natural-language BI</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Ask for a chart</h2>
            </div>
          </div>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <input value={chartQuery} onChange={(event) => setChartQuery(event.target.value)} onKeyDown={(event) => event.key === "Enter" && handleGenerateChart()} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-500/10 dark:border-slate-800 dark:bg-slate-950 dark:text-white" placeholder="Example: monthly income vs expenses" />
            <Button variant="primary" onClick={handleGenerateChart} disabled={chartLoading}>{chartLoading ? "Generating..." : "Generate"}</Button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {["Monthly income vs expenses", "Top vendors by spend", "Expense trend by category"].map((query) => <Button key={query} className="min-h-8 px-2.5 text-xs" onClick={() => setChartQuery(query)}>{query}</Button>)}
          </div>
          {chartData ? <div className="mt-4">{renderAiChart()}</div> : <div className="mt-4 grid h-64 place-items-center rounded-2xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">AI-generated chart output appears here.</div>}
          {chartExplanation ? <p className="mt-3 rounded-2xl bg-blue-50 p-3 text-sm leading-6 text-slate-700 dark:bg-blue-400/10 dark:text-slate-200">{chartExplanation}</p> : null}
        </Panel>
      </div>
    ),
    transactions: (
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4 dark:border-slate-800">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Transactions</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Recent ledger activity</h2>
            </div>
            <Link to="/transactions"><Button variant="primary">Open workspace <Icon name="arrow" /></Button></Link>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {(dashboard.recentTransactions || []).slice(0, 8).map((transaction) => (
              <div key={transaction._id || `${transaction.date}-${transaction.desc}`} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_120px_110px] sm:items-center">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-950 dark:text-white">{transaction.desc}</p>
                  <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{new Date(transaction.date).toLocaleDateString()} · {transaction.category || "Uncategorized"} · {transaction.vendor || "No vendor"}</p>
                </div>
                <Pill tone={transaction.status === "approved" ? "green" : ["pending", "needs_review"].includes(transaction.status) ? "amber" : "neutral"}>{String(transaction.status || "pending").replaceAll("_", " ")}</Pill>
                <p className={cn("font-semibold sm:text-right", transaction.type === "income" ? "text-emerald-600" : "text-red-600")}>{transaction.type === "income" ? "+" : "-"}{formatMoney(transaction.amount)}</p>
              </div>
            ))}
            {!dashboard.recentTransactions?.length ? <div className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">No transactions yet. Import a workbook to activate the dashboard.</div> : null}
          </div>
        </Panel>

        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Review queue</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Risk and reconciliation</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">Pending</p><p className="mt-1 text-2xl font-semibold">{formatCompact(dashboard.workflow?.approvals || 0)}</p></div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><p className="text-xs text-slate-500">Duplicates</p><p className="mt-1 text-2xl font-semibold">{formatCompact(dashboard.workflow?.duplicateCount || 0)}</p></div>
          </div>
          <div className="mt-4 space-y-2">
            {(dashboard.suspicious || []).slice(0, 4).map((item) => (
              <div key={item._id || item.desc} className="rounded-2xl border border-amber-200 bg-amber-50 p-3 dark:border-amber-400/25 dark:bg-amber-400/10">
                <p className="truncate text-sm font-semibold text-slate-950 dark:text-white">{item.desc}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatMoney(item.amount)} · {item.category}</p>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    ),
    workflow: (
      <div className="grid min-w-0 gap-4 xl:grid-cols-4">
        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Tax center</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{formatMoney(summary.taxEstimate)}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Estimated reserve from current profit</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Budget usage</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{percent.format(summary.budgetUsage)}%</p>
          <div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(100, summary.budgetUsage || 0)}%` }} /></div>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Payroll overview</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{formatMoney(summary.payrollEstimate)}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Estimated payroll allocation</p>
        </Panel>
        <Panel className="p-4">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Bank balances</p>
          <p className="mt-2 text-3xl font-semibold text-slate-950 dark:text-white">{formatMoney(summary.bankBalance)}</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Modeled cash position</p>
        </Panel>
        <Panel className="p-4 xl:col-span-2">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Activity heatmap</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Transaction density</h2>
          <div className="mt-4"><Heatmap data={dashboard.heatmap} /></div>
        </Panel>
        <Panel className="p-4 xl:col-span-2">
          <p className="text-xs font-bold uppercase tracking-[.14em] text-slate-500 dark:text-slate-400">Close workflow</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">Tasks and reminders</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {dashboard.workflow?.tasks?.map((task) => <div key={task.title} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900"><p className="font-semibold">{task.title}</p><p className="mt-1 text-sm text-slate-500">{formatCompact(task.count)} items</p></div>)}
            {dashboard.workflow?.reminders?.map((reminder) => <div key={reminder.title} className="rounded-2xl border border-slate-200 p-3 dark:border-slate-800"><p className="font-semibold">{reminder.title}</p><p className="mt-1 text-sm text-slate-500">{reminder.due} · {reminder.priority}</p></div>)}
          </div>
        </Panel>
      </div>
    ),
  };

  if (loading) {
    return (
      <div className="min-h-full bg-[#f6f8fb] p-4 dark:bg-slate-950">
        <div className="mx-auto max-w-[1680px] space-y-4">
          <Skeleton className="h-36" />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn(darkMode ? "dark" : "", "min-h-full w-full max-w-full overflow-x-hidden bg-[#f6f8fb] text-slate-950 dark:bg-slate-950 dark:text-slate-100")}>
      <Helmet><title>Dashboard - AI Accountant</title></Helmet>
      <div className="mx-auto flex w-full max-w-[1680px] flex-col gap-4 px-3 py-4 sm:px-5 lg:px-6">
        {isOffline ? (
          <Panel className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            Backend temporarily unavailable — showing cached data where available. <button type="button" onClick={() => refresh()} className="ml-3 underline">Retry connection</button>
          </Panel>
        ) : isDegraded ? (
          <Panel className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            Backend responding slowly — some features may be degraded.
          </Panel>
        ) : null}

        <header className="sticky top-0 z-30 rounded-2xl border border-slate-200 bg-white/92 p-4 shadow-[0_12px_34px_rgba(15,23,42,.08)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/92">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.8fr)] xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Pill tone="blue">AI finance OS</Pill>
                <Pill>{formatCompact(summary.totalTransactions)} transactions</Pill>
                <Pill tone={summary.netProfit >= 0 ? "green" : "red"}>{formatMoney(summary.netProfit)} net profit</Pill>
              </div>
              <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-3xl">Executive finance dashboard</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">A premium AI-powered workspace for cash visibility, close workflows, anomaly detection, forecasting, and accounting operations.</p>
            </div>
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex min-w-0 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                <Icon name="search" className="h-5 w-5 shrink-0 text-slate-400" />
                <input className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none dark:text-white" placeholder="Search dashboard, reports, actions..." onFocus={() => setCommandOpen(true)} />
                <span className="hidden rounded-lg border border-slate-200 px-2 py-1 text-xs font-bold text-slate-400 sm:block dark:border-slate-800">Ctrl K</span>
              </div>
              <div className="flex flex-wrap justify-start gap-2 xl:justify-end">
                <Button onClick={loadDashboard}>Refresh</Button>
                <Button onClick={() => setDarkMode(!darkMode)}>{darkMode ? "Light" : "Dark"}</Button>
                <Link to="/transactions"><Button variant="primary"><Icon name="upload" /> Import / review</Button></Link>
              </div>
            </div>
          </div>
        </header>

        {error ? <Panel className="border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-400/30 dark:bg-red-400/10 dark:text-red-200">{error}</Panel> : null}

        <div className="flex flex-wrap gap-2">
          {widgetOrder.map((id, index) => (
            <div key={id} className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-500 dark:border-slate-800 dark:bg-slate-950">
              <span className="capitalize">{id}</span>
              <button type="button" onClick={() => moveWidget(id, -1)} disabled={index === 0} className="px-1 disabled:opacity-30">↑</button>
              <button type="button" onClick={() => moveWidget(id, 1)} disabled={index === widgetOrder.length - 1} className="px-1 disabled:opacity-30">↓</button>
            </div>
          ))}
        </div>

        {widgetOrder.map((id) => <React.Fragment key={id}>{widgets[id]}</React.Fragment>)}
      </div>
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} actions={actions} />
    </div>
  );
};

export default Home;
