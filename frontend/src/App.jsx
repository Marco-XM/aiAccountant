import React, { useContext, useState, useEffect } from "react";
import {
  Routes,
  Route,
  Link,
  useNavigate,
  useLocation,
} from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { AuthContext } from "./Context/AuthContext";
import { api } from "./config/api";
import Login from "./Component/Login/Login.jsx";
import Register from "./Component/Register/Register.jsx";
import ForgotPassword from "./Component/ForgotPassword/ForgotPassword.jsx";
import ResetPassword from "./Component/ResetPassword/ResetPassword.jsx";
import Home from "./Component/Home/Home.jsx";
import DashboardLayout from "./layouts/DashboardLayout";
import ExcelGenerator from "./Component/BoxCalculator/BoxCalculator.jsx";
const Transactions = React.lazy(() => import("./components/Transactions/TransactionsPage.jsx"));
import TransactionsLayout from "./layouts/TransactionsLayout";
import AIExcelGenerator from "./Component/AIExcelGenerator/AIExcelGenerator.jsx";
import Chatbot from "./Component/Chatbot/Chatbot.jsx";
const AIChartsPage = React.lazy(() => import("./pages/AICharts/AIChartsPage.jsx"));
import ChartGenerator from "./Component/ChartGenerator/ChartGenerator.jsx";
import ProtectedRoute from "./Component/ProtectedRoute/ProtectedRoute.jsx";
import ExcelUploadPage from "./components/ExcelEditor/ExcelUploadPage.jsx";
import ExcelEditorPage from "./components/ExcelEditor/ExcelEditorPage.jsx";

class RouteErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Route render failed", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-[60vh] place-items-center p-6">
          <div className="max-w-lg rounded-2xl border border-red-200 bg-white p-6 text-center shadow-xl">
            <h2 className="text-xl font-bold text-red-700">
              This page failed to render
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              {this.state.error.message || "A runtime error interrupted the page."}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 ui-btn"
            >
              Reload page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  const { token, authReady, Logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [showChatList, setShowChatList] = useState(false);

  const handleLogout = () => {
    Logout();
    navigate("/login");
  };

  const isActive = (path) => location.pathname === path;

  const isAuthPage =
    location.pathname === "/login" ||
    location.pathname === "/register" ||
    location.pathname === "/forgot-password" ||
    location.pathname === "/reset-password";

  // Load chat sessions
  useEffect(() => {
    if (token && !isAuthPage) {
      loadChatSessions();
    }
  }, [token, isAuthPage]);

  // Reload chat sessions when on chatbot page
  useEffect(() => {
    if (location.pathname.startsWith("/chatbot") && showChatList) {
      loadChatSessions();
    }
  }, [location.pathname, showChatList]);

  const loadChatSessions = async () => {
    try {
      const response = await api.chat.getSessions();
      setChatSessions(response.data);
    } catch (error) {
      console.error("Error loading chat sessions:", error);
    }
  };

  const handleChatClick = (chatId) => {
    navigate(`/chatbot?chat=${chatId}`);
    setSidebarOpen(false);
  };

  const handleNewChat = () => {
    navigate("/chatbot");
    setSidebarOpen(false);
  };

  const deleteChat = async (chatId, e) => {
    e.stopPropagation();
    try {
      await api.chat.deleteSession(chatId);
      setChatSessions((prev) => prev.filter((s) => s._id !== chatId));
    } catch (error) {
      console.error("Error deleting chat:", error);
    }
  };

  return (
    <div className="ui-shell">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#ffffff",
            color: "#222831",
            padding: "14px 16px",
            borderRadius: "14px",
            border: "1px solid rgba(34,40,49,0.12)",
            boxShadow: "0 14px 40px rgba(34,40,49,0.14)",
          },
          success: {
            iconTheme: { primary: "#00ADB5", secondary: "#ffffff" },
            style: {
              border: "1px solid rgba(0,173,181,0.55)",
              color: "#222831",
            },
          },
          error: {
            iconTheme: { primary: "#ef4444", secondary: "#ffffff" },
            style: {
              border: "1px solid rgba(239,68,68,0.55)",
              color: "#222831",
            },
          },
        }}
      />

      {!authReady ? (
        <div className="grid min-h-screen place-items-center ui-shell">
          <div className="rounded-2xl border border-white/10 bg-white/80 px-6 py-4 text-sm font-semibold text-[color:var(--ui-ink)] shadow-lg backdrop-blur">
            Restoring session...
          </div>
        </div>
      ) : token && !isAuthPage ? (
        // Sidebar Layout for Authenticated Users
        <div className="flex h-screen overflow-hidden">
          {/* Sidebar */}
          <aside
            className={`${
              sidebarOpen ? "translate-x-0" : "-translate-x-full"
            } lg:translate-x-0 fixed lg:static inset-y-0 left-0 z-50 w-72 ui-nav transition-transform duration-300 flex flex-col`}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 p-6 border-b border-white/10">
              <div className="ui-nav-brand p-2.5 rounded-2xl">
                <svg
                  className="w-6 h-6 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="flex flex-col leading-tight">
                <span className="font-extrabold text-lg tracking-tight text-white">
                  AI Accountant
                </span>
                <span className="text-xs text-white/60">
                  Finance • Analytics • AI
                </span>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
              <Link
                to="/"
                onClick={() => setSidebarOpen(false)}
                className={`ui-navlink flex items-center gap-3 ${
                  isActive("/") ? "ui-navlink-active" : ""
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                  />
                </svg>
                <span className="font-medium">Dashboard</span>
              </Link>

              <Link
                to="/transactions"
                onClick={() => setSidebarOpen(false)}
                className={`ui-navlink flex items-center gap-3 ${
                  isActive("/transactions") ? "ui-navlink-active" : ""
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="font-medium">Transactions</span>
              </Link>

              <Link
                to="/box-calculator"
                onClick={() => setSidebarOpen(false)}
                className={`ui-navlink flex items-center gap-3 ${
                  isActive("/box-calculator") ? "ui-navlink-active" : ""
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-medium">Calculator</span>
              </Link>

              <Link
                to="/ai-excel"
                onClick={() => setSidebarOpen(false)}
                className={`ui-navlink flex items-center gap-3 ${
                  isActive("/ai-excel") ? "ui-navlink-active" : ""
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  />
                </svg>
                <span className="font-medium">AI Excel Generator</span>
              </Link>

              <Link
                to="/excel-editor"
                onClick={() => setSidebarOpen(false)}
                className={`ui-navlink flex items-center gap-3 ${
                  isActive("/excel-editor") ||
                  location.pathname.startsWith("/excel/")
                    ? "ui-navlink-active"
                    : ""
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
                <span className="font-medium">Excel Editor</span>
              </Link>

              <Link
                to="/charts"
                onClick={() => setSidebarOpen(false)}
                className={`ui-navlink flex items-center gap-3 ${
                  isActive("/charts") ? "ui-navlink-active" : ""
                }`}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span className="font-medium">AI Charts</span>
              </Link>
              <div>
                <button
                  onClick={() => setShowChatList(!showChatList)}
                  className={`ui-navlink flex items-center justify-between w-full ${
                    location.pathname.startsWith("/chatbot")
                      ? "ui-navlink-active"
                      : ""
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                      />
                    </svg>
                    <span className="font-medium">AI Chatbot</span>
                  </div>
                  <svg
                    className={`w-4 h-4 transition-transform ${
                      showChatList ? "rotate-180" : ""
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>

                {/* Chat Sessions List */}
                {showChatList && (
                  <div className="ml-4 mt-2 space-y-1 border-l-2 border-white/10 pl-3">
                    <button
                      onClick={handleNewChat}
                      className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-white hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span className="font-medium">New Chat</span>
                    </button>

                    {chatSessions.length === 0 ? (
                      <p className="text-xs text-white/60 px-3 py-2">
                        No chat history
                      </p>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-1">
                        {chatSessions.map((session) => (
                          <div
                            key={session._id}
                            onClick={() => handleChatClick(session._id)}
                            className="group flex items-center justify-between px-3 py-2 text-sm text-white/80 hover:bg-white/10 rounded-lg cursor-pointer transition-colors"
                          >
                            <span
                              className="truncate flex-1"
                              title={session.title}
                            >
                              {session.title || "New Chat"}
                            </span>
                            <button
                              onClick={(e) => deleteChat(session._id, e)}
                              className="ml-2 p-1 text-white/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M6 18L18 6M6 6l12 12"
                                />
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </nav>

            {/* Logout Button */}
            <div className="p-4 border-t border-white/10">
              <button
                onClick={handleLogout}
                className="flex items-center space-x-3 w-full px-4 py-3 text-red-300 hover:bg-white/10 rounded-xl transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
                <span className="font-medium">Logout</span>
              </button>
            </div>
          </aside>

          {/* Main Content Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top Bar */}
            <header className="ui-topbar z-40">
              <div className="flex items-center justify-between px-6 py-4">
                <button
                  onClick={() => setSidebarOpen(!sidebarOpen)}
                  className="lg:hidden p-2 rounded-xl text-[color:var(--ui-ink)] hover:bg-black/5"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
                <h1 className="text-xl font-extrabold tracking-tight text-[color:var(--ui-ink)]">
                  {isActive("/")
                    ? "Dashboard"
                    : isActive("/transactions")
                    ? "Transactions"
                    : isActive("/ai-excel")
                    ? "AI Excel Generator"
                    : isActive("/excel-editor") ||
                      location.pathname.startsWith("/excel/")
                    ? "Excel Editor"
                    : isActive("/chatbot")
                    ? "AI Chatbot"
                    : "Calculator"}
                </h1>
                <div className="flex items-center gap-2">
                  <span className="ui-pill text-sm">
                    <span className="inline-block w-2 h-2 rounded-full bg-[color:var(--ui-accent)] mr-2" />
                    Connected
                  </span>
                </div>
              </div>
            </header>

            {/* Page Content */}
            <main className="flex-1 overflow-y-auto">
              <Routes>
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <DashboardLayout>
                        <Home />
                      </DashboardLayout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/transactions"
                  element={
                    <ProtectedRoute>
                      <React.Suspense
                        fallback={
                          <div className="flex min-h-[60vh] items-center justify-center">
                            <div className="rounded-3xl border border-white/10 bg-white/80 px-6 py-4 text-sm text-slate-600 shadow-lg backdrop-blur dark:bg-slate-950/70 dark:text-slate-300">
                              Loading transactions workspace...
                            </div>
                          </div>
                        }
                      >
                        <RouteErrorBoundary>
                          <TransactionsLayout>
                            <Transactions />
                          </TransactionsLayout>
                        </RouteErrorBoundary>
                      </React.Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/box-calculator"
                  element={
                    <ProtectedRoute>
                      <ExcelGenerator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/ai-excel"
                  element={
                    <ProtectedRoute>
                      <AIExcelGenerator />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/excel-editor"
                  element={
                    <ProtectedRoute>
                      <ExcelUploadPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/excel/:fileId"
                  element={
                    <ProtectedRoute>
                      <ExcelEditorPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/chatbot"
                  element={
                    <ProtectedRoute>
                      <Chatbot />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/charts"
                  element={
                    <ProtectedRoute>
                      <React.Suspense fallback={<div className="p-6">Loading AI Charts...</div>}>
                        <RouteErrorBoundary>
                          <AIChartsPage />
                        </RouteErrorBoundary>
                      </React.Suspense>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="*"
                  element={
                    <div className="min-h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-9xl font-extrabold text-[color:var(--ui-ink)]/30 mb-6">
                          404
                        </div>
                        <h1 className="text-3xl font-extrabold text-[color:var(--ui-ink)] mb-3">
                          Page Not Found
                        </h1>
                        <p className="text-[color:var(--ui-ink-2)] mb-8">
                          The page you're looking for doesn't exist.
                        </p>
                        <Link
                          to="/"
                          className="inline-flex items-center ui-btn ui-card-strong px-8 py-3"
                        >
                          <svg
                            className="w-5 h-5 mr-2"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                            />
                          </svg>
                          Back to Dashboard
                        </Link>
                      </div>
                    </div>
                  }
                />
              </Routes>
            </main>
          </div>

          {/* Mobile Overlay */}
          {sidebarOpen && (
            <div
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            ></div>
          )}
        </div>
      ) : (
        // Public Pages (Login/Register)
        <div>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="*" element={<Login />} />
          </Routes>
        </div>
      )}
    </div>
  );
}
