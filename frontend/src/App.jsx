import React, { useContext, useState, useEffect } from "react";
import {
  Routes,
  Route,
  Link,
  Navigate,
  useNavigate,
  useLocation,
  useParams,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthContext } from "./Context/AuthContext";
import { ThemeProvider } from "./Context/ThemeContext";
import SubscriptionProvider, { useSubscription } from "./Context/SubscriptionContext";
import ThemeToggle from "./components/ui/ThemeToggle";
import { api } from "./config/api";
import Login from "./Component/Login/Login.jsx";
import Register from "./Component/Register/Register.jsx";
import ForgotPassword from "./Component/ForgotPassword/ForgotPassword.jsx";
import ResetPassword from "./Component/ResetPassword/ResetPassword.jsx";
import DashboardLayout from "./layouts/DashboardLayout";
import ExcelGenerator from "./Component/BoxCalculator/BoxCalculator.jsx";
const Transactions = React.lazy(() => import("./components/Transactions/TransactionsPage.jsx"));
import TransactionsLayout from "./layouts/TransactionsLayout";
import AIExcelGenerator from "./Component/AIExcelGenerator/AIExcelGenerator.jsx";
import Chatbot from "./Component/Chatbot/Chatbot.jsx";
const AIChartsPage = React.lazy(() => import("./pages/AICharts/AIChartsPage.jsx"));
import ProtectedRoute from "./Component/ProtectedRoute/ProtectedRoute.jsx";
import ExcelUploadPage from "./components/ExcelEditor/ExcelUploadPage.jsx";
import ExcelEditorPage from "./components/ExcelEditor/ExcelEditorPage.jsx";
import LandingPage from "./pages/Landing/LandingPage.jsx";
import PricingPage from "./pages/Pricing/PricingPage.jsx";
import CheckoutPage from "./pages/Checkout/CheckoutPage.jsx";
import SubscriptionPage from "./pages/Subscription/SubscriptionPage.jsx";
const AdminApp = React.lazy(() => import("./pages/Admin/AdminApp.jsx"));
const DeveloperSettingsPage = React.lazy(() => import("./pages/Developer/DeveloperSettingsPage.jsx"));

/* ── Error Boundary ─────────────────────────────────────────────── */
class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { console.error("Route render failed", error, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-surface p-6 text-center shadow-xl">
            <h2 className="text-xl font-bold text-red-700">This page failed to render</h2>
            <p className="mt-2 text-sm text-muted-2">{this.state.error.message || "A runtime error interrupted the page."}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-4 ui-btn">Reload page</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

/* ── Subscription Plan Badge ────────────────────────────────────── */
function SubscriptionBadge() {
  const { plan } = useSubscription();
  const { userId } = useContext(AuthContext);
  const planLabels = { free: "Free", pro: "Pro", business: "Business" };
  const planColors = { free: "rgba(255,255,255,0.1)", pro: "rgba(62,146,204,0.35)", business: "rgba(10,36,99,0.5)" };
  return (
    <Link to={`/app/${userId}/subscription`} className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl transition-colors hover:bg-white/10">
      <div className="flex items-center gap-2">
        <svg className="w-4 h-4 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <span className="text-sm text-white/70 font-medium">Plan</span>
      </div>
      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full text-white" style={{ background: planColors[plan] || planColors.free }}>
        {planLabels[plan] || "Free"}
      </span>
    </Link>
  );
}

/* ── App Shell (sidebar layout for /app/:userId/*) ──────────────── */
function AppShell() {
  const { token, isAdmin, Logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const { userId: routeUserId } = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [showChatList, setShowChatList] = useState(false);

  if (!token) return <Navigate to="/login" replace />;

  const base = `/app/${routeUserId}`;
  const isActive = (seg) =>
    seg === ""
      ? location.pathname === base || location.pathname === `${base}/`
      : location.pathname.startsWith(`${base}/${seg}`);

  const handleLogout = () => { Logout(); navigate("/login"); };

  useEffect(() => { loadChatSessions(); }, [token]);
  useEffect(() => {
    if (location.pathname.includes("/chatbot") && showChatList) loadChatSessions();
  }, [location.pathname, showChatList]);

  const loadChatSessions = async () => {
    try { setChatSessions((await api.chat.getSessions()).data); } catch (e) { console.error(e); }
  };
  const handleChatClick = (chatId) => { navigate(`${base}/chatbot?chat=${chatId}`); setSidebarOpen(false); };
  const handleNewChat = () => { navigate(`${base}/chatbot`); setSidebarOpen(false); };
  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    try { await api.chat.deleteSession(chatId); setChatSessions((p) => p.filter((s) => s._id !== chatId)); } catch (e) { console.error(e); }
  };

  const pageTitle = () => {
    const p = location.pathname;
    if (p === base || p === `${base}/`) return "Dashboard";
    if (p.includes("/transactions")) return "Transactions";
    if (p.includes("/ai-excel")) return "AI Excel Generator";
    if (p.includes("/excel-editor") || p.includes("/excel/")) return "Excel Editor";
    if (p.includes("/chatbot")) return "AI Chatbot";
    if (p.includes("/subscription")) return "Subscription & Billing";
    if (p.includes("/checkout")) return "Checkout";
    if (p.includes("/charts")) return "AI Charts";
    if (p.includes("/box-calculator")) return "Calculator";
    if (p.includes("/developer")) return "Developer API";
    return "AI Accountant";
  };

  const navItems = [
    { seg: "", label: "Dashboard", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
    { seg: "transactions", label: "Transactions", icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" },
    { seg: "box-calculator", label: "Calculator", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { seg: "ai-excel", label: "AI Excel Generator", icon: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" },
    { seg: "excel-editor", label: "Excel Editor", icon: "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" },
    { seg: "charts", label: "AI Charts", icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" },
    { seg: "developer", label: "Developer API", icon: "M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" },
  ];

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className={`${sidebarOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-72 ui-nav transition-transform duration-300 flex flex-col`}>
        <div className="flex items-center gap-3 p-6 border-b border-white/10">
          <div className="ui-nav-brand p-2.5 rounded-2xl">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-extrabold text-lg tracking-tight text-white">AI Accountant</span>
            <span className="text-xs text-white/60">Finance • Analytics • AI</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {navItems.map(({ seg, label, icon }) => (
            <Link key={seg} to={seg === "" ? base : `${base}/${seg}`} onClick={() => setSidebarOpen(false)} className={`ui-navlink flex items-center gap-3 ${isActive(seg) ? "ui-navlink-active" : ""}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={icon} /></svg>
              <span className="font-medium">{label}</span>
            </Link>
          ))}

          <div>
            <button onClick={() => setShowChatList(!showChatList)} className={`ui-navlink flex items-center justify-between w-full ${isActive("chatbot") ? "ui-navlink-active" : ""}`}>
              <div className="flex items-center space-x-3">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>
                <span className="font-medium">AI Chatbot</span>
              </div>
              <svg className={`w-4 h-4 transition-transform ${showChatList ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
            </button>
            {showChatList && (
              <div className="ml-4 mt-2 space-y-1 border-l-2 border-white/10 pl-3">
                <button onClick={handleNewChat} className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                  <span className="font-medium">New Chat</span>
                </button>
                {chatSessions.length === 0 ? (
                  <p className="text-xs text-white/60 px-3 py-2">No chat history</p>
                ) : (
                  <div className="max-h-64 overflow-y-auto space-y-1">
                    {chatSessions.map((session) => (
                      <div key={session._id} onClick={() => handleChatClick(session._id)} className="group flex items-center justify-between px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
                        <span className="truncate flex-1" title={session.title}>{session.title || "New Chat"}</span>
                        <button onClick={(e) => deleteChat(session._id, e)} className="ml-2 p-1 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {isAdmin && (
            <Link to="/admin" onClick={() => setSidebarOpen(false)} className="ui-navlink flex items-center gap-3 mt-2 border-t border-white/10 pt-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="font-medium">Admin Panel</span>
            </Link>
          )}
        </nav>

        <div className="p-4 border-t border-white/10 space-y-1">
          <SubscriptionBadge />
          <ThemeToggle />
          <button onClick={handleLogout} className="flex items-center space-x-3 w-full px-4 py-3 text-red-300 hover:bg-white/10 rounded-xl transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="ui-topbar z-40">
          <div className="flex items-center justify-between px-6 py-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 rounded-xl text-[color:var(--ui-ink)] hover:bg-black/5">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
            </button>
            <h1 className="text-xl font-extrabold tracking-tight text-[color:var(--ui-ink)]">{pageTitle()}</h1>
            <span className="ui-pill text-sm">
              <span className="inline-block w-2 h-2 rounded-full bg-[color:var(--ui-accent)] mr-2" />Connected
            </span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto" style={{ background: "var(--ui-bg)" }}>
          <Routes>
            <Route index element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>} />
            <Route path="transactions" element={<ProtectedRoute><React.Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><div className="rounded-3xl border border-theme bg-surface px-6 py-4 text-sm text-ink shadow-lg">Loading...</div></div>}><RouteErrorBoundary><TransactionsLayout><Transactions /></TransactionsLayout></RouteErrorBoundary></React.Suspense></ProtectedRoute>} />
            <Route path="box-calculator" element={<ProtectedRoute><ExcelGenerator /></ProtectedRoute>} />
            <Route path="ai-excel" element={<ProtectedRoute><AIExcelGenerator /></ProtectedRoute>} />
            <Route path="excel-editor" element={<ProtectedRoute><ExcelUploadPage /></ProtectedRoute>} />
            <Route path="excel/:fileId" element={<ProtectedRoute><ExcelEditorPage /></ProtectedRoute>} />
            <Route path="chatbot" element={<ProtectedRoute><Chatbot /></ProtectedRoute>} />
            <Route path="charts" element={<ProtectedRoute><React.Suspense fallback={<div className="p-6">Loading AI Charts...</div>}><RouteErrorBoundary><AIChartsPage /></RouteErrorBoundary></React.Suspense></ProtectedRoute>} />
            <Route path="checkout/:planId" element={<ProtectedRoute><CheckoutPage /></ProtectedRoute>} />
            <Route path="subscription" element={<ProtectedRoute><SubscriptionPage /></ProtectedRoute>} />
            <Route path="developer" element={<ProtectedRoute><React.Suspense fallback={<div className="p-6">Loading…</div>}><RouteErrorBoundary><DeveloperSettingsPage /></RouteErrorBoundary></React.Suspense></ProtectedRoute>} />
            <Route path="pricing" element={<PricingPage />} />
            <Route path="*" element={<div className="min-h-full flex items-center justify-center"><div className="text-center"><div className="text-9xl font-extrabold text-[color:var(--ui-ink)]/30 mb-6">404</div><h1 className="text-3xl font-extrabold text-[color:var(--ui-ink)] mb-3">Page Not Found</h1><Link to={base} className="inline-flex items-center ui-btn px-8 py-3">Back to Dashboard</Link></div></div>} />
          </Routes>
        </main>
      </div>

      {sidebarOpen && <div onClick={() => setSidebarOpen(false)} className="lg:hidden fixed inset-0 bg-black/50 z-40" />}
    </div>
  );
}

/* ── Root App ────────────────────────────────────────────────────── */
export default function App() {
  const { token, userId, authReady } = useContext(AuthContext);

  return (
    <ThemeProvider>
      <SubscriptionProvider>
        <div className="ui-shell">
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: { background: "var(--ui-surface)", color: "var(--ui-ink)", padding: "14px 16px", borderRadius: "14px", border: "1px solid var(--ui-border)", boxShadow: "var(--ui-shadow)" },
              success: { iconTheme: { primary: "#3E92CC", secondary: "#ffffff" }, style: { border: "1px solid rgba(62,146,204,0.50)", color: "#1E1B18" } },
              error: { iconTheme: { primary: "#D8315B", secondary: "#ffffff" }, style: { border: "1px solid rgba(216,49,91,0.50)", color: "#1E1B18" } },
            }}
          />

          {!authReady ? (
            <div className="grid min-h-screen place-items-center ui-shell">
              <div className="rounded-2xl border border-theme bg-surface px-6 py-4 text-sm font-semibold text-[color:var(--ui-ink)] shadow-lg backdrop-blur">Restoring session...</div>
            </div>
          ) : (
            <Routes>
              {/* Public routes */}
              <Route path="/" element={token && userId ? <Navigate to={`/app/${userId}/`} replace /> : <LandingPage />} />
              <Route path="/pricing" element={<PricingPage />} />
              <Route path="/login" element={token && userId ? <Navigate to={`/app/${userId}/`} replace /> : <Login />} />
              <Route path="/register" element={token && userId ? <Navigate to={`/app/${userId}/`} replace /> : <Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Authenticated app (user-scoped) */}
              <Route path="/app/:userId/*" element={<AppShell />} />

              {/* Admin dashboard */}
              <Route
                path="/admin/*"
                element={
                  <React.Suspense fallback={<div className="grid min-h-screen place-items-center"><div className="text-sm font-semibold">Loading admin panel...</div></div>}>
                    <AdminApp />
                  </React.Suspense>
                }
              />

              {/* Catch-all */}
              <Route path="*" element={<Navigate to={token && userId ? `/app/${userId}/` : "/"} replace />} />
            </Routes>
          )}
        </div>
      </SubscriptionProvider>
    </ThemeProvider>
  );
}
