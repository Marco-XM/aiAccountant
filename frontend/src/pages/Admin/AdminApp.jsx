import React, { useContext, useState, useEffect, useCallback } from "react";
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";

/* ─── helpers ──────────────────────────────────────────────────────── */
const API_ORIGIN =
  (import.meta.env.VITE_API_ORIGIN || import.meta.env.VITE_API_URL || "http://localhost:5000")
    .replace(/\/+$/, "")
    .replace(/\/api$/i, "");

const BASE = `${API_ORIGIN}/api/admin`;

async function adminFetch(path, options = {}) {
  const token = localStorage.getItem("token");
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}

/* ─── Shared UI primitives ─────────────────────────────────────────── */
const Spinner = () => (
  <svg className="animate-spin h-5 w-5 text-indigo-500" viewBox="0 0 24 24" fill="none">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
);

const PageLoader = ({ label = "Loading..." }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-3 text-slate-400">
    <Spinner />
    <span className="text-sm">{label}</span>
  </div>
);

const PageHeader = ({ title, description, action }) => (
  <div className="flex items-start justify-between mb-8">
    <div>
      <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
    {action}
  </div>
);

const Btn = ({ children, onClick, disabled, variant = "primary", size = "md", className = "", type = "button" }) => {
  const base = "inline-flex items-center justify-center gap-1.5 font-semibold rounded-xl transition-all focus:outline-none focus:ring-2 focus:ring-offset-1 disabled:opacity-40 disabled:cursor-not-allowed";
  const sizes = { sm: "text-xs px-3 py-1.5", md: "text-sm px-4 py-2", lg: "text-sm px-6 py-2.5" };
  const variants = {
    primary: "bg-indigo-600 hover:bg-indigo-700 text-white focus:ring-indigo-500 shadow-sm",
    secondary: "bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 focus:ring-slate-400 shadow-sm",
    danger: "bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 focus:ring-rose-400",
    ghost: "text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:ring-slate-400",
    success: "bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500 shadow-sm",
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
};

const Badge = ({ children, color = "slate" }) => {
  const colors = {
    slate: "bg-slate-100 text-slate-600",
    blue: "bg-blue-50 text-blue-700 ring-1 ring-blue-600/20",
    green: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20",
    red: "bg-rose-50 text-rose-700 ring-1 ring-rose-600/20",
    yellow: "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20",
    purple: "bg-violet-50 text-violet-700 ring-1 ring-violet-600/20",
    orange: "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20",
  };
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${colors[color]}`}>{children}</span>;
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const Input = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>}
    <input
      {...props}
      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
    />
  </div>
);

const Textarea = ({ label, ...props }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>}
    <textarea
      {...props}
      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
    />
  </div>
);

const Select = ({ label, children, ...props }) => (
  <div>
    {label && <label className="block text-xs font-semibold text-slate-600 mb-1.5">{label}</label>}
    <select
      {...props}
      className="w-full border border-slate-300 rounded-xl px-3 py-2 text-sm text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
    >
      {children}
    </select>
  </div>
);

function Modal({ title, onClose, children, maxWidth = "max-w-xl" }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-10 px-4" style={{ background: "rgba(15,23,42,0.6)", backdropFilter: "blur(4px)" }}>
      <div className={`bg-white rounded-2xl shadow-2xl w-full ${maxWidth} mx-auto`}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 rounded-lg p-1 hover:bg-slate-100 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

/* ─── Guard ────────────────────────────────────────────────────────── */
function AdminGuard({ children }) {
  const { token, isAdmin, authReady } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    if (authReady && (!token || !isAdmin)) navigate("/login", { replace: true });
  }, [authReady, token, isAdmin]);

  if (!authReady) return (
    <div className="grid min-h-screen place-items-center bg-slate-50">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Spinner />
        <span className="text-sm font-medium">Verifying access...</span>
      </div>
    </div>
  );
  if (!token || !isAdmin) return null;
  return children;
}

/* ─── Layout / Sidebar ─────────────────────────────────────────────── */
function AdminLayout({ children }) {
  const location = useLocation();
  const { userId, Logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const nav = [
    { to: "/admin",       label: "Overview",        exact: true, iconPath: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { to: "/admin/users", label: "Users",            iconPath: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" },
    { to: "/admin/tiers", label: "Plans & Limits",   iconPath: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { to: "/admin/nav",   label: "Navigation",       iconPath: "M4 6h16M4 12h16M4 18h7" },
    { to: "/admin/blog",  label: "Blog",             iconPath: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h6" },
    { to: "/admin/pages", label: "Landing Pages",    iconPath: "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" },
  ];

  const isActive = (to, exact) =>
    exact ? location.pathname === "/admin" : location.pathname.startsWith(to);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 flex flex-col bg-slate-900 text-white">
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 11h.01M12 11h.01M15 11h.01M4 19h16a2 2 0 002-2V7a2 2 0 00-2-2H4a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-sm text-white leading-none">AI Accountant</div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-medium tracking-wide uppercase">Admin</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, iconPath, exact }) => {
            const active = isActive(to, exact);
            return (
              <Link
                key={to}
                to={to}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  active
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-900/40"
                    : "text-slate-400 hover:text-white hover:bg-white/10"
                }`}
              >
                <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={iconPath} />
                </svg>
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 py-4 border-t border-white/10 space-y-0.5">
          <Link
            to={userId ? `/app/${userId}/` : "/"}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-white/10 transition-all font-medium"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to App
          </Link>
          <button
            onClick={() => { Logout(); navigate("/login"); }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-rose-400 hover:text-rose-300 hover:bg-white/10 transition-all font-medium w-full"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="h-14 shrink-0 bg-white border-b border-slate-200 flex items-center px-6 gap-3">
          <div className="flex-1 text-sm text-slate-500 font-medium">
            {nav.find((n) => isActive(n.to, n.exact))?.label || "Admin"}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold flex items-center justify-center">A</div>
            <span className="text-sm font-medium text-slate-700 hidden sm:block">Admin</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}

/* ─── Free Plan Quick-Edit ─────────────────────────────────────────── */
const FREE_LIMIT_FIELDS = [
  { key: "transactions",       label: "Transactions",          icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" },
  { key: "excelUploads",       label: "Excel uploads",         icon: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" },
  { key: "aiChartGenerations", label: "AI chart generations",  icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
  { key: "aiChatMessages",     label: "AI chat messages",      icon: "M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" },
  { key: "aiExcelGenerations", label: "AI Excel generations",  icon: "M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" },
];

function FreePlanLimits() {
  const emptyLimits = { transactions: "", excelUploads: "", aiChartGenerations: "", aiChatMessages: "", aiExcelGenerations: "" };
  const [limits, setLimits] = useState(emptyLimits);
  const [original, setOriginal] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadErr, setLoadErr] = useState(null);

  useEffect(() => {
    adminFetch("/tiers")
      .then((d) => {
        const free = (d.tiers || []).find((t) => t.id === "free");
        const l = {};
        FREE_LIMIT_FIELDS.forEach(({ key }) => { l[key] = free?.limits?.[key] ?? -1; });
        setLimits(l);
        setOriginal(l);
      })
      .catch(() => setLoadErr("Could not load free plan limits."));
  }, []);

  const isDirty = original && FREE_LIMIT_FIELDS.some(({ key }) => String(limits[key]) !== String(original[key]));

  const save = async () => {
    setSaving(true);
    try {
      const payload = {};
      FREE_LIMIT_FIELDS.forEach(({ key }) => { payload[key] = Number(limits[key]); });
      await adminFetch("/tiers/free", { method: "PUT", body: JSON.stringify({ limits: payload }) });
      setOriginal({ ...limits });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) { alert("Save failed: " + e.message); }
    setSaving(false);
  };

  if (loadErr) return <p className="text-xs text-rose-500">{loadErr}</p>;

  return (
    <Card className="p-6 mb-8 border-orange-200 bg-gradient-to-br from-orange-50/60 to-white">
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-base font-bold text-slate-900">Free Plan Limits</span>
            <Badge color="orange">Unsubscribed users</Badge>
          </div>
          <p className="text-xs text-slate-500">Monthly allowances for users without a paid plan. Use <code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded text-[11px]">-1</code> for unlimited.</p>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        {FREE_LIMIT_FIELDS.map(({ key, label, icon }) => (
          <div key={key} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm">
            <div className="flex items-center gap-1.5 mb-2">
              <svg className="w-3.5 h-3.5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} />
              </svg>
              <span className="text-[11px] font-semibold text-slate-600 leading-tight">{label}</span>
            </div>
            <input
              type="number"
              min="-1"
              value={limits[key] ?? ""}
              onChange={(e) => setLimits((prev) => ({ ...prev, [key]: e.target.value }))}
              className="w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 mt-4 pt-4 border-t border-orange-100">
        <Btn onClick={save} disabled={saving || !isDirty} variant="primary" className="bg-orange-500 hover:bg-orange-600 focus:ring-orange-400">
          {saving ? "Saving..." : saved ? "Saved!" : "Save changes"}
        </Btn>
        {isDirty && <Btn onClick={() => setLimits({ ...original })} variant="ghost" size="sm">Reset</Btn>}
        {!isDirty && original && <span className="text-xs text-slate-400">No unsaved changes</span>}
      </div>
    </Card>
  );
}

/* ─── Overview ─────────────────────────────────────────────────────── */
function AdminOverview() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminFetch("/stats").then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoader label="Loading platform stats..." />;
  if (!stats) return <div className="p-8 text-sm text-rose-500">Failed to load stats.</div>;

  const totalUsers = stats.totalUsers || 1;
  const planDistribution = Object.entries(stats.planCounts || {});

  const statCards = [
    { label: "Total Users", value: stats.totalUsers, iconPath: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z", bg: "bg-blue-50", text: "text-blue-600" },
    { label: "Monthly Revenue", value: `$${(stats.monthlyRevenue || 0).toLocaleString()}`, iconPath: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z", bg: "bg-emerald-50", text: "text-emerald-600" },
    { label: "New signups (7d)", value: stats.recentSignups, iconPath: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z", bg: "bg-violet-50", text: "text-violet-600" },
    { label: "Blog Posts", value: stats.totalBlogPosts, iconPath: "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 12h6m-6-4h6", bg: "bg-amber-50", text: "text-amber-600" },
  ];

  const planColors = { free: "bg-slate-400", pro: "bg-indigo-500", business: "bg-violet-600" };
  const planBadge = { free: "slate", pro: "blue", business: "purple" };

  return (
    <div className="p-8">
      <PageHeader title="Platform Overview" description="Real-time snapshot of your platform metrics and user activity." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 mb-8">
        {statCards.map(({ label, value, iconPath, bg, text }) => (
          <Card key={label} className="p-5 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-2xl ${bg} flex items-center justify-center shrink-0`}>
              <svg className={`w-6 h-6 ${text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d={iconPath} />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-900">{value}</div>
              <div className="text-xs font-medium text-slate-500 mt-0.5">{label}</div>
            </div>
          </Card>
        ))}
      </div>

      <Card className="p-6">
        <h2 className="text-base font-bold text-slate-900 mb-5">Plan Distribution</h2>
        <div className="space-y-4">
          {planDistribution.map(([plan, count]) => {
            const pct = Math.round((count / totalUsers) * 100);
            const bar = planColors[plan] || "bg-slate-400";
            return (
              <div key={plan}>
                <div className="flex items-center justify-between mb-1.5">
                  <Badge color={planBadge[plan] || "slate"}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</Badge>
                  <div className="flex items-center gap-3 text-sm">
                    <span className="font-bold text-slate-900">{count}</span>
                    <span className="text-slate-400 text-xs">{pct}%</span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.max(pct, 2)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

/* ─── Users ─────────────────────────────────────────────────────────── */
function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updating, setUpdating] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      adminFetch("/users").then((d) => setUsers(d.users)),
      adminFetch("/tiers").then((d) => setTiers(d.tiers || [])),
    ]).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const changePlan = async (userId, plan) => {
    setUpdating(userId);
    try {
      await adminFetch(`/users/${userId}/subscription`, { method: "PUT", body: JSON.stringify({ plan }) });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, plan } : u)));
    } catch (e) { alert(e.message); }
    setUpdating(null);
  };

  const toggleAdmin = async (userId, isAdmin, email) => {
    if (!confirm(isAdmin ? `Grant admin access to ${email}?` : `Revoke admin access from ${email}?`)) return;
    setUpdating(userId);
    try {
      await adminFetch(`/users/${userId}/admin`, { method: "PATCH", body: JSON.stringify({ isAdmin }) });
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, isAdmin } : u)));
    } catch (e) { alert(e.message); }
    setUpdating(null);
  };

  const deleteUser = async (userId, email) => {
    if (!confirm(`Delete user ${email}? This cannot be undone.`)) return;
    try {
      await adminFetch(`/users/${userId}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e) { alert(e.message); }
  };

  const filtered = users.filter(
    (u) => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase())
  );

  const initials = (name) => (name || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  const avatarColor = (name) => {
    const colors = ["bg-violet-100 text-violet-700", "bg-blue-100 text-blue-700", "bg-emerald-100 text-emerald-700", "bg-amber-100 text-amber-700", "bg-rose-100 text-rose-700"];
    return colors[(name || "").charCodeAt(0) % colors.length];
  };

  return (
    <div className="p-8">
      <PageHeader
        title="Users"
        description={`${users.length} registered accounts`}
        action={
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input type="text" placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 border border-slate-300 rounded-xl text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white" />
          </div>
        }
      />

      {loading ? <PageLoader label="Loading users..." /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["User", "Business", "Plan", "Role", "Joined", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${avatarColor(user.name)}`}>
                        {initials(user.name)}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-900">{user.name || "—"}</div>
                        <div className="text-xs text-slate-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 capitalize text-slate-600">{user.businessType || "—"}</td>
                  <td className="px-5 py-3.5">
                    <select value={user.plan || "free"} onChange={(e) => changePlan(user.id, e.target.value)} disabled={updating === user.id}
                      className="border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-medium capitalize bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50">
                      {tiers.length > 0
                        ? tiers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)
                        : ["free", "pro", "business"].map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2">
                      <Badge color={user.isAdmin ? "purple" : "slate"}>{user.isAdmin ? "Admin" : "User"}</Badge>
                      <Btn
                        onClick={() => toggleAdmin(user.id, !user.isAdmin, user.email)}
                        variant={user.isAdmin ? "ghost" : "secondary"}
                        size="sm"
                        disabled={updating === user.id}
                      >
                        {user.isAdmin ? "Revoke" : "Make admin"}
                      </Btn>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <Btn onClick={() => deleteUser(user.id, user.email)} variant="danger" size="sm">Delete</Btn>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No users found.</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ─── Blog ──────────────────────────────────────────────────────────── */
function AdminBlog() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ title: "", slug: "", excerpt: "", content: "", status: "draft", tags: "" });
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); adminFetch("/blog").then((d) => setPosts(d.posts)).catch(console.error).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setForm({ title: "", slug: "", excerpt: "", content: "", status: "draft", tags: "" }); setEditing("new"); };
  const openEdit = (post) => {
    setForm({ title: post.title, slug: post.slug, excerpt: post.excerpt || "", content: post.content || "", status: post.status, tags: (post.tags || []).join(", ") });
    setEditing(post);
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...form, tags: form.tags.split(",").map((t) => t.trim()).filter(Boolean) };
    try {
      if (editing === "new") await adminFetch("/blog", { method: "POST", body: JSON.stringify(payload) });
      else await adminFetch(`/blog/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      load(); setEditing(null);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const deletePost = async (id, title) => {
    if (!confirm(`Delete "${title}"?`)) return;
    try { await adminFetch(`/blog/${id}`, { method: "DELETE" }); load(); } catch (e) { alert(e.message); }
  };

  const setF = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="p-8">
      <PageHeader title="Blog Posts" description={`${posts.length} posts published or in draft`} action={<Btn onClick={openNew} variant="primary">+ New Post</Btn>} />

      {editing && (
        <Modal title={editing === "new" ? "New Blog Post" : "Edit Post"} onClose={() => setEditing(null)} maxWidth="max-w-2xl">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Input label="Title" value={form.title} onChange={(e) => setF("title", e.target.value)} placeholder="Post title" />
              <Input label="Slug" value={form.slug} onChange={(e) => setF("slug", e.target.value)} placeholder="url-slug" />
            </div>
            <Input label="Excerpt" value={form.excerpt} onChange={(e) => setF("excerpt", e.target.value)} placeholder="Short summary..." />
            <Input label="Tags (comma-separated)" value={form.tags} onChange={(e) => setF("tags", e.target.value)} placeholder="tag1, tag2" />
            <Textarea label="Content (Markdown)" value={form.content} onChange={(e) => setF("content", e.target.value)} rows={8} placeholder="Write your post content here..." />
            <Select label="Status" value={form.status} onChange={(e) => setF("status", e.target.value)}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </Select>
          </div>
          <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
            <Btn onClick={save} disabled={saving} variant="primary">{saving ? "Saving..." : "Save Post"}</Btn>
            <Btn onClick={() => setEditing(null)} variant="secondary">Cancel</Btn>
          </div>
        </Modal>
      )}

      {loading ? <PageLoader label="Loading posts..." /> : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                {["Title", "Tags", "Status", "Created", "Actions"].map((h) => (
                  <th key={h} className="px-5 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3.5 font-semibold text-slate-900 max-w-[260px] truncate">{post.title}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {(post.tags || []).slice(0, 3).map((tag) => <Badge key={tag} color="blue">{tag}</Badge>)}
                    </div>
                  </td>
                  <td className="px-5 py-3.5">
                    <Badge color={post.status === "published" ? "green" : "slate"}>
                      {post.status === "published" ? "Published" : "Draft"}
                    </Badge>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">
                    {post.createdAt ? new Date(post.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex gap-2">
                      <Btn onClick={() => openEdit(post)} variant="ghost" size="sm">Edit</Btn>
                      <Btn onClick={() => deletePost(post.id, post.title)} variant="danger" size="sm">Delete</Btn>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-400">No posts yet. Create your first one!</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}

/* ─── Landing Pages ─────────────────────────────────────────────────── */
function AdminPages() {
  const [sections, setSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("hero");
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    adminFetch("/pages")
      .then((d) => {
        setSections(d.sections || {});
        const first = Object.keys(d.sections || {})[0] || "hero";
        setActiveSection(first);
        setForm(d.sections[first] || {});
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const switchSection = (key) => { setActiveSection(key); setForm(sections[key] || {}); setSaved(false); };

  const save = async () => {
    setSaving(true);
    try {
      const updated = await adminFetch(`/pages/${activeSection}`, { method: "PUT", body: JSON.stringify(form) });
      setSections((prev) => ({ ...prev, [activeSection]: updated.section }));
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const sectionLabels = { hero: "Hero Section", features: "Features", stats: "Stats Bar", cta: "Call to Action" };

  if (loading) return <PageLoader label="Loading page content..." />;

  return (
    <div className="p-8">
      <PageHeader title="Landing Page Content" description="Edit the content shown to visitors on your public landing page." />
      <div className="flex gap-6">
        <Card className="w-48 shrink-0 overflow-hidden">
          {Object.keys(sections).map((key) => (
            <button key={key} onClick={() => switchSection(key)}
              className={`w-full text-left px-4 py-3 text-sm font-medium border-b border-slate-100 last:border-0 transition-colors ${activeSection === key ? "bg-indigo-50 text-indigo-700 font-semibold" : "text-slate-700 hover:bg-slate-50"}`}>
              {sectionLabels[key] || key}
            </button>
          ))}
        </Card>

        <Card className="flex-1 p-6">
          <h2 className="text-base font-bold text-slate-900 mb-5">{sectionLabels[activeSection] || activeSection}</h2>
          <div className="space-y-4">
            {Object.entries(form).map(([key, value]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5 capitalize">{key.replace(/_/g, " ")}</label>
                {typeof value === "string" && value.length > 80 ? (
                  <Textarea value={value} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} rows={3} />
                ) : typeof value === "object" ? (
                  <Textarea value={JSON.stringify(value, null, 2)} onChange={(e) => { try { setForm((f) => ({ ...f, [key]: JSON.parse(e.target.value) })); } catch {} }} rows={5} />
                ) : (
                  <Input type="text" value={String(value)} onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))} />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100 items-center">
            <Btn onClick={save} disabled={saving} variant="primary">{saving ? "Saving..." : "Save Changes"}</Btn>
            {saved && <span className="text-emerald-600 text-sm font-semibold">Saved!</span>}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ─── Plans & Limits (Tiers) ────────────────────────────────────────── */
const LIMIT_FIELDS = [
  { key: "transactions",       label: "Transactions / month" },
  { key: "excelUploads",       label: "Excel file uploads / month" },
  { key: "aiChartGenerations", label: "AI chart generations / month" },
  { key: "aiChatMessages",     label: "AI chat messages / month" },
  { key: "aiExcelGenerations", label: "AI Excel generations / month" },
];

function AdminTiers() {
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [offerEditing, setOfferEditing] = useState(null);
  const emptyLimits = { transactions: -1, excelUploads: -1, aiChartGenerations: -1, aiChatMessages: -1, aiExcelGenerations: -1 };
  const emptyTier = { id: "", name: "", description: "", price: { monthly: 0, annual: 0 }, limits: emptyLimits, features: "", highlight: false, badge: "", active: true };
  const emptyOffer = { label: "", description: "", discountPct: "", discountFlat: "", validFrom: "", validUntil: "", code: "", active: true };
  const [form, setForm] = useState(emptyTier);
  const [offerForm, setOfferForm] = useState(emptyOffer);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); adminFetch("/tiers").then((d) => setTiers(d.tiers || [])).catch(console.error).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = () => { setForm(emptyTier); setEditing("new"); };
  const openEdit = (t) => {
    setForm({ ...t, features: (t.features || []).join("\n"), price: { monthly: t.price?.monthly || 0, annual: t.price?.annual || 0 }, limits: { ...emptyLimits, ...(t.limits || {}) } });
    setEditing(t);
  };

  const saveTier = async () => {
    setSaving(true);
    const limits = {};
    for (const { key } of LIMIT_FIELDS) limits[key] = Number(form.limits[key] ?? -1);
    const payload = { ...form, features: form.features.split("\n").map((f) => f.trim()).filter(Boolean), price: { monthly: Number(form.price.monthly), annual: Number(form.price.annual) }, limits };
    try {
      if (editing === "new") await adminFetch("/tiers", { method: "POST", body: JSON.stringify(payload) });
      else await adminFetch(`/tiers/${editing.id}`, { method: "PUT", body: JSON.stringify(payload) });
      load(); setEditing(null);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const deleteTier = async (id, name) => {
    if (!confirm(`Delete tier "${name}"?`)) return;
    try { await adminFetch(`/tiers/${id}`, { method: "DELETE" }); load(); } catch (e) { alert(e.message); }
  };

  const openNewOffer = (tierId) => { setOfferForm(emptyOffer); setOfferEditing({ tierId, offer: "new" }); };
  const openEditOffer = (tierId, offer) => { setOfferForm({ ...offer, discountPct: offer.discountPct || "", discountFlat: offer.discountFlat || "" }); setOfferEditing({ tierId, offer }); };

  const saveOffer = async () => {
    setSaving(true);
    const { tierId, offer } = offerEditing;
    const payload = { ...offerForm, discountPct: offerForm.discountPct !== "" ? Number(offerForm.discountPct) : null, discountFlat: offerForm.discountFlat !== "" ? Number(offerForm.discountFlat) : null };
    try {
      if (offer === "new") await adminFetch(`/tiers/${tierId}/offers`, { method: "POST", body: JSON.stringify(payload) });
      else await adminFetch(`/tiers/${tierId}/offers/${offer.id}`, { method: "PUT", body: JSON.stringify(payload) });
      load(); setOfferEditing(null);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const deleteOffer = async (tierId, offerId, label) => {
    if (!confirm(`Delete offer "${label}"?`)) return;
    try { await adminFetch(`/tiers/${tierId}/offers/${offerId}`, { method: "DELETE" }); load(); } catch (e) { alert(e.message); }
  };

  const setF = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const setPrice = (key, val) => setForm((f) => ({ ...f, price: { ...f.price, [key]: val } }));
  const setLimit = (key, val) => setForm((f) => ({ ...f, limits: { ...f.limits, [key]: val } }));

  const tierAccent = { free: "border-l-slate-400", pro: "border-l-indigo-500", business: "border-l-violet-600" };

  return (
    <div className="p-8">
      <PageHeader title="Plans & Limits" description="Manage subscription tiers, monthly limits, and promotional offers." action={<Btn onClick={openNew} variant="primary">+ New Tier</Btn>} />

      <FreePlanLimits />

      {editing && (
        <Modal title={editing === "new" ? "New Tier" : `Edit "${editing.name}"`} onClose={() => setEditing(null)}>
          <div className="space-y-4">
            {editing === "new" && (
              <Input label='ID (slug, e.g. "pro")' value={form.id} onChange={(e) => setF("id", e.target.value)} placeholder="my-plan" />
            )}
            <div className="grid grid-cols-2 gap-4">
              <Input label="Name" value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="Pro" />
              <Input label="Description" value={form.description} onChange={(e) => setF("description", e.target.value)} placeholder="For growing teams" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Monthly Price ($)" type="number" min="0" value={form.price.monthly} onChange={(e) => setPrice("monthly", e.target.value)} />
              <Input label="Annual Price ($)" type="number" min="0" value={form.price.annual} onChange={(e) => setPrice("annual", e.target.value)} />
            </div>
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="text-xs font-bold text-indigo-700 uppercase tracking-wider mb-3">
                Monthly Usage Limits <span className="font-normal text-indigo-500 normal-case ml-1">(-1 = unlimited)</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {LIMIT_FIELDS.map(({ key, label }) => (
                  <Input key={key} label={label} type="number" min="-1" value={form.limits[key] ?? -1} onChange={(e) => setLimit(key, e.target.value)} />
                ))}
              </div>
            </div>
            <Textarea label="Features (one per line)" value={form.features} onChange={(e) => setF("features", e.target.value)} rows={4} placeholder={"Up to 50 transactions/month\n10 AI chart generations\nBasic dashboard"} />
            <div className="grid grid-cols-2 gap-4">
              <Input label='Badge text (e.g. "Most Popular")' value={form.badge} onChange={(e) => setF("badge", e.target.value)} placeholder="Most Popular" />
              <div className="flex flex-col gap-2 justify-end pb-0.5">
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input type="checkbox" checked={form.highlight} onChange={(e) => setF("highlight", e.target.checked)} className="rounded accent-indigo-600" />
                  Highlight this plan
                </label>
                <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
                  <input type="checkbox" checked={form.active} onChange={(e) => setF("active", e.target.checked)} className="rounded accent-indigo-600" />
                  Active
                </label>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
            <Btn onClick={saveTier} disabled={saving} variant="primary">{saving ? "Saving..." : "Save Tier"}</Btn>
            <Btn onClick={() => setEditing(null)} variant="secondary">Cancel</Btn>
          </div>
        </Modal>
      )}

      {offerEditing && (
        <Modal title={offerEditing.offer === "new" ? "New Offer" : "Edit Offer"} onClose={() => setOfferEditing(null)} maxWidth="max-w-md">
          <div className="space-y-3">
            <Input label="Label" value={offerForm.label} onChange={(e) => setOfferForm((f) => ({ ...f, label: e.target.value }))} placeholder='e.g. "50% off first month"' />
            <Input label="Description" value={offerForm.description} onChange={(e) => setOfferForm((f) => ({ ...f, description: e.target.value }))} placeholder="Optional details" />
            <Input label="Promo Code (optional)" value={offerForm.code} onChange={(e) => setOfferForm((f) => ({ ...f, code: e.target.value }))} placeholder="SAVE50" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Discount %" type="number" value={offerForm.discountPct} onChange={(e) => setOfferForm((f) => ({ ...f, discountPct: e.target.value }))} placeholder="0" />
              <Input label="Discount $" type="number" value={offerForm.discountFlat} onChange={(e) => setOfferForm((f) => ({ ...f, discountFlat: e.target.value }))} placeholder="0" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label="Valid From" type="date" value={offerForm.validFrom} onChange={(e) => setOfferForm((f) => ({ ...f, validFrom: e.target.value }))} />
              <Input label="Valid Until" type="date" value={offerForm.validUntil} onChange={(e) => setOfferForm((f) => ({ ...f, validUntil: e.target.value }))} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer select-none">
              <input type="checkbox" checked={offerForm.active} onChange={(e) => setOfferForm((f) => ({ ...f, active: e.target.checked }))} className="rounded accent-indigo-600" />
              Active
            </label>
          </div>
          <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
            <Btn onClick={saveOffer} disabled={saving} variant="primary">{saving ? "Saving..." : "Save Offer"}</Btn>
            <Btn onClick={() => setOfferEditing(null)} variant="secondary">Cancel</Btn>
          </div>
        </Modal>
      )}

      {loading ? <PageLoader label="Loading tiers..." /> : tiers.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No tiers yet.</p>
          <Btn onClick={openNew} variant="primary" className="mt-4">Create your first tier</Btn>
        </div>
      ) : (
        <div className="space-y-5">
          {tiers.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0)).map((tier) => (
            <Card key={tier.id} className={`overflow-hidden border-l-4 ${tierAccent[tier.id] || "border-l-slate-300"}`}>
              <div className="p-5 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="text-lg font-bold text-slate-900">{tier.name}</span>
                    {tier.badge && <Badge color="blue">{tier.badge}</Badge>}
                    {tier.highlight && <Badge color="yellow">Highlighted</Badge>}
                    {!tier.active && <Badge color="red">Inactive</Badge>}
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{tier.description}</p>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-bold text-slate-800">
                      ${tier.price?.monthly}<span className="font-normal text-slate-500">/mo</span>
                      &nbsp;·&nbsp;
                      ${tier.price?.annual}<span className="font-normal text-slate-500">/yr</span>
                    </span>
                  </div>
                  {tier.limits && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {LIMIT_FIELDS.map(({ key, label }) => {
                        const v = tier.limits[key];
                        const unlimited = v === -1 || v === undefined;
                        return (
                          <span key={key} className={`text-xs px-2.5 py-1 rounded-full font-semibold ${unlimited ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20" : "bg-orange-50 text-orange-700 ring-1 ring-orange-600/20"}`}>
                            {label.split("/")[0].trim()}: {unlimited ? "∞" : v}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {tier.features?.length > 0 && (
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-0.5">
                      {tier.features.map((f, i) => (
                        <li key={i} className="text-xs text-slate-500 flex items-center gap-1">
                          <svg className="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Btn onClick={() => openEdit(tier)} variant="secondary" size="sm">Edit</Btn>
                  <Btn onClick={() => deleteTier(tier.id, tier.name)} variant="danger" size="sm">Delete</Btn>
                </div>
              </div>

              <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Promotional Offers ({(tier.offers || []).length})</span>
                  <Btn onClick={() => openNewOffer(tier.id)} variant="ghost" size="sm">+ Add Offer</Btn>
                </div>
                {(tier.offers || []).length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No offers configured for this tier.</p>
                ) : (
                  <div className="space-y-2">
                    {tier.offers.map((offer) => (
                      <div key={offer.id} className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-2.5 shadow-sm">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-slate-800">{offer.label}</span>
                          {offer.code && <code className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">{offer.code}</code>}
                          {offer.discountPct ? <Badge color="green">{offer.discountPct}% off</Badge> : null}
                          {offer.discountFlat ? <Badge color="green">${offer.discountFlat} off</Badge> : null}
                          {!offer.active && <Badge color="slate">Inactive</Badge>}
                        </div>
                        <div className="flex gap-2 shrink-0 ml-4">
                          <Btn onClick={() => openEditOffer(tier.id, offer)} variant="ghost" size="sm">Edit</Btn>
                          <Btn onClick={() => deleteOffer(tier.id, offer.id, offer.label)} variant="danger" size="sm">Delete</Btn>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Navigation ────────────────────────────────────────────────────── */
function AdminNavPages() {
  const [nav, setNav] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const emptyItem = { label: "", href: "", target: "_self", order: 0 };
  const [form, setForm] = useState(emptyItem);
  const [saving, setSaving] = useState(false);

  const load = () => { setLoading(true); adminFetch("/nav").then((d) => setNav(d.nav || [])).catch(console.error).finally(() => setLoading(false)); };
  useEffect(load, []);

  const openNew = (parentId = null) => { setForm(emptyItem); setEditing({ item: "new", parentId }); };
  const openEdit = (item, parentId = null) => { setForm({ label: item.label, href: item.href, target: item.target || "_self", order: item.order || 0 }); setEditing({ item, parentId }); };

  const save = async () => {
    setSaving(true);
    const { item, parentId } = editing;
    const payload = { ...form, order: Number(form.order) };
    try {
      if (item === "new") {
        if (parentId) payload.parentId = parentId;
        await adminFetch("/nav", { method: "POST", body: JSON.stringify(payload) });
      } else {
        await adminFetch(`/nav/${item.id}`, { method: "PUT", body: JSON.stringify(payload) });
      }
      load(); setEditing(null);
    } catch (e) { alert(e.message); }
    setSaving(false);
  };

  const deleteItem = async (id, label) => {
    if (!confirm(`Delete nav item "${label}"? Any sub-items will also be removed.`)) return;
    try { await adminFetch(`/nav/${id}`, { method: "DELETE" }); load(); } catch (e) { alert(e.message); }
  };

  const setF = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  return (
    <div className="p-8">
      <PageHeader title="Landing Page Navigation" description="Control the links shown in your public site's navigation bar." action={<Btn onClick={() => openNew()} variant="primary">+ Add Nav Item</Btn>} />

      {editing && (
        <Modal title={editing.item === "new" ? (editing.parentId ? "Add Sub-item" : "Add Nav Item") : "Edit Nav Item"} onClose={() => setEditing(null)} maxWidth="max-w-md">
          <div className="space-y-4">
            <Input label="Label" value={form.label} onChange={(e) => setF("label", e.target.value)} placeholder="e.g. Pricing" />
            <Input label="URL / href" value={form.href} onChange={(e) => setF("href", e.target.value)} placeholder="e.g. /pricing or #features" />
            <div className="grid grid-cols-2 gap-4">
              <Select label="Open in" value={form.target} onChange={(e) => setF("target", e.target.value)}>
                <option value="_self">Same tab</option>
                <option value="_blank">New tab</option>
              </Select>
              <Input label="Order" type="number" value={form.order} onChange={(e) => setF("order", e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3 mt-6 pt-5 border-t border-slate-100">
            <Btn onClick={save} disabled={saving} variant="primary">{saving ? "Saving..." : "Save"}</Btn>
            <Btn onClick={() => setEditing(null)} variant="secondary">Cancel</Btn>
          </div>
        </Modal>
      )}

      {loading ? <PageLoader label="Loading navigation..." /> : nav.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No nav items yet.</p>
          <Btn onClick={() => openNew()} variant="primary" className="mt-4">Add your first item</Btn>
        </div>
      ) : (
        <div className="space-y-3">
          {nav.sort((a, b) => (a.order || 0) - (b.order || 0)).map((item) => (
            <Card key={item.id} className="overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <svg className="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                    </svg>
                  </div>
                  <div>
                    <span className="font-semibold text-slate-900 text-sm">{item.label}</span>
                    <span className="ml-2 text-xs text-slate-400 font-mono">{item.href}</span>
                    {item.target === "_blank" && <span className="ml-2"><Badge color="blue">new tab</Badge></span>}
                  </div>
                </div>
                <div className="flex gap-2 items-center">
                  <Btn onClick={() => openNew(item.id)} variant="ghost" size="sm">+ Sub-item</Btn>
                  <Btn onClick={() => openEdit(item)} variant="ghost" size="sm">Edit</Btn>
                  <Btn onClick={() => deleteItem(item.id, item.label)} variant="danger" size="sm">Delete</Btn>
                </div>
              </div>

              {(item.children || []).length > 0 && (
                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-3 space-y-2">
                  {item.children.sort((a, b) => (a.order || 0) - (b.order || 0)).map((child) => (
                    <div key={child.id} className="flex items-center justify-between pl-6">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-400">↳</span>
                        <span className="font-medium text-slate-700">{child.label}</span>
                        <span className="text-xs text-slate-400 font-mono">{child.href}</span>
                      </div>
                      <div className="flex gap-2">
                        <Btn onClick={() => openEdit(child, item.id)} variant="ghost" size="sm">Edit</Btn>
                        <Btn onClick={() => deleteItem(child.id, child.label)} variant="danger" size="sm">Delete</Btn>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Main AdminApp ─────────────────────────────────────────────────── */
export default function AdminApp() {
  return (
    <AdminGuard>
      <AdminLayout>
        <Routes>
          <Route index element={<AdminOverview />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="tiers" element={<AdminTiers />} />
          <Route path="nav" element={<AdminNavPages />} />
          <Route path="blog" element={<AdminBlog />} />
          <Route path="pages" element={<AdminPages />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Routes>
      </AdminLayout>
    </AdminGuard>
  );
}
