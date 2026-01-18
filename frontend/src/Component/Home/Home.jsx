import React, { useContext, useState, useEffect } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { AuthContext } from "../../Context/AuthContext";
import { api } from "../../config/api";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ComposedChart,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import toast from "react-hot-toast";

const Home = () => {
  const { token } = useContext(AuthContext);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [chartQuery, setChartQuery] = useState("");
  const [chartLoading, setChartLoading] = useState(false);
  const [chartData, setChartData] = useState(null);
  const [chartExplanation, setChartExplanation] = useState("");
  const [showChartSection, setShowChartSection] = useState(true);

  // Load dashboard data
  useEffect(() => {
    if (token) {
      loadDashboardData();
    } else {
      setLoading(false);
    }
  }, [token]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // Fetch stats
      const statsResponse = await api.transactions.getStats();
      setStats(statsResponse.data.summary);

      // Fetch recent transactions (last 5)
      const transactionsResponse = await api.transactions.getAll({ limit: 5 });
      setRecentTransactions(transactionsResponse.data.transactions);
    } catch (error) {
      console.error("Error loading dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount || 0);
  };

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString();
  };

  const COLORS = [
    "#0088FE",
    "#00C49F",
    "#FFBB28",
    "#FF8042",
    "#8884D8",
    "#82CA9D",
    "#FFC658",
    "#FF6B9D",
    "#A28FD0",
    "#E91E63",
  ];

  const handleGenerateChart = async () => {
    if (!chartQuery.trim()) {
      toast.error("Please enter a query");
      return;
    }

    setChartLoading(true);
    try {
      const response = await api.charts.generate({ query: chartQuery });

      setChartData(response.data.chartConfig);
      setChartExplanation(response.data.explanation);
      toast.success("Chart generated successfully!");
    } catch (error) {
      // API interceptor handles user-facing error toast.
      console.error("Error generating chart:", error);
    } finally {
      setChartLoading(false);
    }
  };

  const renderChart = () => {
    if (!chartData) return null;

    const commonProps = {
      data: chartData.data,
      margin: { top: 20, right: 30, left: 20, bottom: 5 },
    };

    switch (chartData.type) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <BarChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey={chartData.xKey}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.yKeys.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </BarChart>
          </ResponsiveContainer>
        );

      case "line":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartData.xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.yKeys.map((key, index) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={COLORS[index % COLORS.length]}
                  strokeWidth={2}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        );

      case "area":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <AreaChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartData.xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              {chartData.yKeys.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  fill={COLORS[index % COLORS.length]}
                  stroke={COLORS[index % COLORS.length]}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        );

      case "pie":
      case "donut":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <PieChart>
              <Pie
                data={chartData.data}
                dataKey={chartData.valueKey}
                nameKey={chartData.nameKey}
                cx="50%"
                cy="50%"
                innerRadius={chartData.type === "donut" ? 60 : 0}
                outerRadius={100}
                fill="#8884d8"
                label
              >
                {chartData.data.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={COLORS[index % COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        );

      case "composed":
        return (
          <ResponsiveContainer width="100%" height={350}>
            <ComposedChart {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={chartData.xKey} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey={chartData.yKeys[0]} fill={COLORS[0]} />
              <Line
                type="monotone"
                dataKey={chartData.yKeys[1]}
                stroke={COLORS[1]}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
        );

      default:
        return <p className="text-gray-500">Unsupported chart type</p>;
    }
  };

  const features = [
    {
      icon: (
        <svg
          className="w-8 h-8"
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
      ),
      title: "Smart Transactions",
      description:
        "Upload and manage your transactions with AI-powered categorization",
      link: "/transactions",
      color: "from-blue-500 to-blue-600",
    },
    {
      icon: (
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"
          />
        </svg>
      ),
      title: "Analytics Dashboard",
      description:
        "Get insights into your financial data with powerful analytics",
      link: "/transactions",
      color: "from-purple-500 to-purple-600",
    },
    {
      icon: (
        <svg
          className="w-8 h-8"
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
      ),
      title: "AI Excel Generator",
      description: "Create custom Excel sheets with natural language prompts",
      link: "/ai-excel",
      color: "from-green-500 to-green-600",
    },
  ];

  const dashboardStats =
    token && stats
      ? [
          {
            label: "Total Transactions",
            value: stats.totalTransactions || 0,
            icon: (
              <svg
                className="w-8 h-8 text-blue-600"
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
            ),
            color: "bg-blue-50 border-blue-200",
          },
          {
            label: "Total Income",
            value: formatCurrency(stats.totalIncome || 0),
            icon: (
              <svg
                className="w-8 h-8 text-green-600"
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
            ),
            color: "bg-green-50 border-green-200",
          },
          {
            label: "Total Expenses",
            value: formatCurrency(stats.totalExpenses || 0),
            icon: (
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            ),
            color: "bg-red-50 border-red-200",
          },
          {
            label: "Net Balance",
            value: formatCurrency(
              (stats.totalIncome || 0) - (stats.totalExpenses || 0)
            ),
            icon: (
              <svg
                className="w-8 h-8 text-purple-600"
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
            ),
            color: "bg-purple-50 border-purple-200",
          },
        ]
      : [
          {
            label: "Transactions",
            value: "1,234",
            icon: (
              <svg
                className="w-8 h-8 text-blue-600"
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
            ),
            color: "bg-blue-50 border-blue-200",
          },
          {
            label: "Categories",
            value: "12",
            icon: (
              <svg
                className="w-8 h-8 text-purple-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                />
              </svg>
            ),
            color: "bg-purple-50 border-purple-200",
          },
          {
            label: "Reports",
            value: "45",
            icon: (
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            ),
            color: "bg-green-50 border-green-200",
          },
          {
            label: "Accuracy",
            value: "98%",
            icon: (
              <svg
                className="w-8 h-8 text-yellow-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            ),
            color: "bg-yellow-50 border-yellow-200",
          },
        ];

  return (
    <div className="min-h-screen ui-shell">
      <Helmet>
        <title>Home - AI Accountant</title>
      </Helmet>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold text-gray-900 mb-6">
            Welcome to{" "}
            <span className="block mt-3 text-[color:var(--ui-accent)] drop-shadow-sm">
              AI Accountant
            </span>
          </h1>
          <p className="text-xl text-[color:var(--ui-ink-2)] max-w-2xl mx-auto">
            Manage your finances smarter with AI-powered accounting tools
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
          {loading && token ? (
            <div className="col-span-2 md:col-span-4 text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[color:var(--ui-accent)] mx-auto"></div>
              <p className="mt-4 text-[color:var(--ui-ink-2)]">
                Loading your dashboard...
              </p>
            </div>
          ) : (
            dashboardStats.map((stat, index) => (
              <div
                key={index}
                className="ui-card p-6 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="text-center">
                  <div className="flex justify-center mb-3">{stat.icon}</div>
                  <div className="text-3xl font-bold text-gray-900 mb-1">
                    {stat.value}
                  </div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* AI Chart Generator */}
        {token && !loading && (
          <div className="mb-16 ui-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <svg
                  className="w-6 h-6 text-[color:var(--ui-accent)] mr-3"
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
                <h2 className="text-2xl font-bold text-gray-900">
                  AI Chart Generator
                </h2>
              </div>
              <button
                onClick={() => setShowChartSection(!showChartSection)}
                className="text-[color:var(--ui-ink-2)] hover:text-[color:var(--ui-ink)]"
              >
                <svg
                  className={`w-5 h-5 transition-transform ${
                    showChartSection ? "rotate-180" : ""
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
            </div>

            {showChartSection && (
              <>
                <p className="text-[color:var(--ui-ink-2)] mb-4">
                  Ask any question and get an interactive chart with AI insights
                </p>

                {/* Input */}
                <div className="mb-4">
                  <div className="flex gap-3">
                    <input
                      type="text"
                      value={chartQuery}
                      onChange={(e) => setChartQuery(e.target.value)}
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleGenerateChart()
                      }
                      placeholder="e.g., Show monthly expenses as a bar chart, Top 10 categories as donut chart"
                      className="flex-1 ui-input"
                      disabled={chartLoading}
                    />
                    <button
                      onClick={handleGenerateChart}
                      disabled={chartLoading}
                      className="ui-btn px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 text-white cursor-pointer"
                    >
                      {chartLoading ? (
                        <>
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                          Generating...
                        </>
                      ) : (
                        <>
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
                          Generate
                        </>
                      )}
                    </button>
                  </div>

                  {/* Example Queries */}
                  <div className="mt-3">
                    <p className="text-xs text-gray-500 mb-2">Try these:</p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        "Monthly income vs expenses",
                        "Top 10 categories as donut chart",
                        "Income trend last 6 months",
                        "Q1 vs Q2 vs Q3 vs Q4 comparison",
                      ].map((example, index) => (
                        <button
                          key={index}
                          onClick={() => setChartQuery(example)}
                          className="text-xs px-3 py-1 rounded-full transition-colors border border-[color:rgba(0,173,181,0.25)] bg-[color:rgba(0,173,181,0.10)] text-[color:var(--ui-ink)] hover:bg-[color:rgba(0,173,181,0.14)]"
                        >
                          {example}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Chart Display */}
                {chartData && (
                  <div className="mt-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-3">
                      {chartData.title}
                    </h3>
                    <div className="bg-[color:var(--ui-surface-2)] border border-[color:var(--ui-border)] rounded-xl p-4">
                      {renderChart()}
                    </div>
                  </div>
                )}

                {/* Explanation */}
                {chartExplanation && (
                  <div className="mt-4 bg-[color:rgba(0,173,181,0.08)] border border-[color:rgba(0,173,181,0.22)] rounded-xl p-4">
                    <h4 className="text-sm font-semibold text-gray-800 mb-2 flex items-center">
                      <svg
                        className="w-4 h-4 mr-2 text-[color:var(--ui-accent)]"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      AI Insights
                    </h4>
                    <p className="text-sm text-gray-700">{chartExplanation}</p>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Recent Transactions (only show if logged in) */}
        {token && !loading && recentTransactions.length > 0 && (
          <div className="mb-16 ui-card p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                Recent Transactions
              </h2>
              <Link
                to="/transactions"
                className="text-[color:var(--ui-accent)] hover:opacity-90 font-semibold flex items-center"
              >
                View all
                <svg
                  className="w-5 h-5 ml-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-[color:var(--ui-border)]">
                <thead>
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--ui-ink-2)] uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--ui-ink-2)] uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-[color:var(--ui-ink-2)] uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-[color:var(--ui-ink-2)] uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[color:var(--ui-border)]">
                  {recentTransactions.map((transaction) => (
                    <tr
                      key={transaction._id}
                      className="hover:bg-[color:rgba(0,173,181,0.06)] transition-colors"
                    >
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[color:var(--ui-ink)]">
                        {formatDate(transaction.date)}
                      </td>
                      <td className="px-4 py-4 text-sm text-[color:var(--ui-ink)] max-w-xs truncate">
                        {transaction.desc}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-[color:var(--ui-ink-2)]">
                        {transaction.category}
                      </td>
                      <td
                        className={`px-4 py-4 whitespace-nowrap text-sm font-medium text-right ${
                          transaction.type === "income"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {transaction.type === "income" ? "+" : "-"}
                        {formatCurrency(transaction.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Features Grid */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-[color:var(--ui-ink)] text-center mb-12">
            What You Can Do
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Link
                key={index}
                to={feature.link}
                className="group ui-card p-8 hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2"
              >
                <div className="inline-flex p-4 rounded-xl bg-[color:rgba(0,173,181,0.14)] border border-[color:rgba(0,173,181,0.22)] text-[color:var(--ui-accent)] mb-6 group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold text-[color:var(--ui-ink)] mb-3">
                  {feature.title}
                </h3>
                <p className="text-[color:var(--ui-ink-2)] mb-4">
                  {feature.description}
                </p>
                <div className="flex items-center text-[color:var(--ui-accent)] font-semibold transition-opacity group-hover:opacity-90">
                  Get started
                  <svg
                    className="w-5 h-5 ml-2 group-hover:translate-x-2 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 7l5 5m0 0l-5 5m5-5H6"
                    />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="rounded-3xl shadow-2xl p-8 md:p-12 text-[color:var(--ui-bg)] bg-[linear-gradient(135deg,#222831_0%,#393E46_70%)] border border-[color:rgba(0,173,181,0.25)]">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Ready to Get Started?
            </h2>
            <p className="text-lg mb-8 text-[color:rgba(238,238,238,0.85)]">
              Upload your financial documents and let AI do the heavy lifting
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/transactions"
                className="bg-[color:var(--ui-accent)] text-[color:var(--ui-ink)] px-8 py-4 rounded-xl font-semibold hover:opacity-90 transition-opacity duration-200 shadow-lg"
              >
                View Transactions
              </Link>
              <Link
                to="/box-calculator"
                className="bg-transparent border-2 border-[color:var(--ui-accent)] text-[color:var(--ui-bg)] px-8 py-4 rounded-xl font-semibold hover:bg-[color:rgba(0,173,181,0.12)] transition-all duration-200"
              >
                Calculate Boxes
              </Link>
            </div>
          </div>
        </div>

        {token && (
          <div className="mt-8 text-center">
            <p className="text-sm text-[color:var(--ui-ink-2)] flex items-center justify-center">
              <svg
                className="w-4 h-4 mr-2 text-[color:var(--ui-accent)]"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Your session is active and secure
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Home;
