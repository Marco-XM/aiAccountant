const crypto = require("crypto");
const mongoose = require("mongoose");
const Groq = require("groq-sdk");
const Transaction = require("../models/Transaction");
const localTransactionStore = require("../services/localTransactionStore");
const { isMongoObjectId } = require("../services/userIdentity");

const groq = process.env.GROQ_API_KEY
  ? new Groq({ apiKey: process.env.GROQ_API_KEY })
  : null;
let groqEnhancementEnabled = Boolean(groq);

const reportStore = new Map();

const isDatabaseReady = () => mongoose.connection.readyState === 1;
const useLocalTransactionStore = (userId) => !isDatabaseReady() || !isMongoObjectId(userId);

const nowIso = () => new Date().toISOString();

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeTransaction = (item) => {
  const date = item?.date ? new Date(item.date) : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;

  return {
    _id: String(item?._id || item?.id || crypto.randomUUID()),
    userId: String(item?.userId || ""),
    date: safeDate,
    amount: Math.abs(toNumber(item?.amount, 0)),
    signedAmount:
      String(item?.type || "").toLowerCase() === "income"
        ? Math.abs(toNumber(item?.amount, 0))
        : -Math.abs(toNumber(item?.amount, 0)),
    type: String(item?.type || "expense").toLowerCase(),
    status: String(item?.status || "pending").toLowerCase(),
    category: String(item?.category || "Uncategorized"),
    desc: String(item?.desc || item?.description || ""),
    vendor: String(item?.vendor || ""),
    currency: String(item?.currency || "USD"),
    account: String(item?.account || ""),
    importJobId: String(item?.importJobId || ""),
    raw: item,
  };
};

const fetchUserTransactions = async (userId) => {
  if (isDatabaseReady() && isMongoObjectId(userId)) {
    const docs = await Transaction.find({ userId })
      .sort({ date: -1 })
      .limit(50000)
      .lean();
    return docs.map(normalizeTransaction);
  }

  const local = await localTransactionStore.listTransactions({
    userId,
    page: 1,
    limit: 50000,
    sort: "date",
    direction: "desc",
  });
  return (local.transactions || []).map(normalizeTransaction);
};

const getDateFromRange = (range) => {
  const now = new Date();
  const from = new Date(now);

  if (range === "30d") {
    from.setDate(now.getDate() - 30);
  } else if (range === "90d") {
    from.setDate(now.getDate() - 90);
  } else if (range === "6m") {
    from.setMonth(now.getMonth() - 6);
  } else if (range === "12m") {
    from.setMonth(now.getMonth() - 12);
  } else {
    return null;
  }

  return from;
};

const applyFilters = (rows, filters = {}) => {
  const {
    search,
    type,
    category,
    status,
    dateFrom,
    dateTo,
    dateRange,
    minAmount,
    maxAmount,
  } = filters;

  const rangeFrom = getDateFromRange(dateRange);
  const explicitFrom = dateFrom ? new Date(dateFrom) : null;
  const explicitTo = dateTo ? new Date(dateTo) : null;
  if (explicitTo && !Number.isNaN(explicitTo.getTime())) {
    explicitTo.setHours(23, 59, 59, 999);
  }

  const from = explicitFrom && !Number.isNaN(explicitFrom.getTime())
    ? explicitFrom
    : rangeFrom;
  const to = explicitTo && !Number.isNaN(explicitTo.getTime()) ? explicitTo : null;

  const min = Number.isFinite(Number(minAmount)) ? Number(minAmount) : null;
  const max = Number.isFinite(Number(maxAmount)) ? Number(maxAmount) : null;
  const q = String(search || "").trim().toLowerCase();

  return rows.filter((row) => {
    if (type && type !== "all" && row.type !== String(type).toLowerCase()) {
      return false;
    }
    if (status && status !== "all" && row.status !== String(status).toLowerCase()) {
      return false;
    }
    if (category && category !== "all" && row.category !== category) {
      return false;
    }
    if (from && row.date < from) {
      return false;
    }
    if (to && row.date > to) {
      return false;
    }
    if (min !== null && row.amount < min) {
      return false;
    }
    if (max !== null && row.amount > max) {
      return false;
    }
    if (q) {
      const haystack = [row.desc, row.category, row.vendor, row.account, row.type, row.status]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
};

const monthKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

const buildMonthlySeries = (rows) => {
  const buckets = new Map();

  for (const row of rows) {
    const key = monthKey(row.date);
    const current = buckets.get(key) || {
      key,
      label: key,
      income: 0,
      expense: 0,
      transfer: 0,
      net: 0,
      transactions: 0,
    };

    if (row.type === "income") {
      current.income += row.amount;
      current.net += row.amount;
    } else if (row.type === "transfer") {
      current.transfer += row.amount;
    } else {
      current.expense += row.amount;
      current.net -= row.amount;
    }

    current.transactions += 1;
    buckets.set(key, current);
  }

  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
};

const buildCategorySeries = (rows, limit = 12) => {
  const buckets = new Map();

  for (const row of rows) {
    const key = row.category || "Uncategorized";
    const current = buckets.get(key) || {
      name: key,
      income: 0,
      expense: 0,
      total: 0,
      count: 0,
    };

    if (row.type === "income") current.income += row.amount;
    if (row.type === "expense") current.expense += row.amount;

    current.total += row.amount;
    current.count += 1;
    buckets.set(key, current);
  }

  return Array.from(buckets.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, limit);
};

const buildVendorSeries = (rows, limit = 10) => {
  const buckets = new Map();

  for (const row of rows) {
    const name = row.vendor || "Unknown vendor";
    const current = buckets.get(name) || { name, revenue: 0, spend: 0, count: 0 };
    if (row.type === "income") current.revenue += row.amount;
    else current.spend += row.amount;
    current.count += 1;
    buckets.set(name, current);
  }

  return Array.from(buckets.values())
    .sort((a, b) => (b.revenue + b.spend) - (a.revenue + a.spend))
    .slice(0, limit);
};

const buildHeatmap = (rows) => {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const matrix = weekdays.map((day, index) => ({
    day,
    dayIndex: index,
    weeks: Array.from({ length: 12 }, (_, weekIndex) => ({
      weekIndex,
      value: 0,
      count: 0,
    })),
  }));

  const latest = rows.reduce((max, row) => (row.date > max ? row.date : max), new Date(0));
  if (latest.getTime() === 0) return matrix;

  const start = new Date(latest);
  start.setDate(start.getDate() - 12 * 7);

  for (const row of rows) {
    if (row.date < start) continue;
    const week = Math.floor((row.date.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
    if (week < 0 || week >= 12) continue;

    const day = row.date.getDay();
    const cell = matrix[day].weeks[week];
    cell.value += row.type === "income" ? row.amount : -row.amount;
    cell.count += 1;
  }

  return matrix;
};

const detectAnomalies = (rows) => {
  if (!rows.length) return [];

  const expenses = rows
    .filter((row) => row.type === "expense")
    .map((row) => ({ ...row, value: row.amount }));

  if (expenses.length < 8) return [];

  const mean = expenses.reduce((sum, row) => sum + row.value, 0) / expenses.length;
  const variance = expenses.reduce((sum, row) => sum + ((row.value - mean) ** 2), 0) / expenses.length;
  const std = Math.sqrt(variance);
  if (std === 0) return [];

  return expenses
    .map((row) => ({
      ...row,
      zScore: (row.value - mean) / std,
    }))
    .filter((row) => row.zScore >= 2)
    .sort((a, b) => b.zScore - a.zScore)
    .slice(0, 8)
    .map((row) => ({
      id: row._id,
      date: row.date.toISOString(),
      amount: row.amount,
      category: row.category,
      vendor: row.vendor,
      desc: row.desc,
      zScore: Number(row.zScore.toFixed(2)),
    }));
};

const buildKpis = (rows) => {
  const income = rows.filter((row) => row.type === "income").reduce((sum, row) => sum + row.amount, 0);
  const expense = rows.filter((row) => row.type === "expense").reduce((sum, row) => sum + row.amount, 0);
  const transfer = rows.filter((row) => row.type === "transfer").reduce((sum, row) => sum + row.amount, 0);
  const net = income - expense;

  const pending = rows.filter((row) => ["pending", "needs_review", "flagged"].includes(row.status)).length;
  const avgTicket = rows.length ? (income + expense + transfer) / rows.length : 0;

  return {
    totalTransactions: rows.length,
    totalIncome: Number(income.toFixed(2)),
    totalExpense: Number(expense.toFixed(2)),
    totalTransfer: Number(transfer.toFixed(2)),
    netCashFlow: Number(net.toFixed(2)),
    averageTicket: Number(avgTicket.toFixed(2)),
    pendingReview: pending,
  };
};

const buildDatasetProfile = (rows) => {
  const columns = new Map();
  let minDate = null;
  let maxDate = null;
  const currencies = new Set();

  for (const row of rows) {
    const raw = row.raw || {};
    for (const key of Object.keys(raw)) {
      const value = raw[key];
      const current = columns.get(key) || { name: key, numeric: 0, text: 0, date: 0, nulls: 0 };
      if (value === null || value === undefined || value === "") {
        current.nulls += 1;
      } else if (typeof value === "number") {
        current.numeric += 1;
      } else {
        const asDate = new Date(value);
        if (!Number.isNaN(asDate.getTime()) && String(value).length > 4) {
          current.date += 1;
        } else if (!Number.isNaN(Number(value))) {
          current.numeric += 1;
        } else {
          current.text += 1;
        }
      }
      columns.set(key, current);
    }

    if (!minDate || row.date < minDate) minDate = row.date;
    if (!maxDate || row.date > maxDate) maxDate = row.date;
    if (row.currency) currencies.add(row.currency);
  }

  const typedColumns = Array.from(columns.values()).map((column) => {
    const dominant = Math.max(column.numeric, column.text, column.date, 0);
    let type = "unknown";
    if (dominant === column.numeric) type = "number";
    if (dominant === column.text) type = "string";
    if (dominant === column.date) type = "date";
    return {
      ...column,
      detectedType: type,
    };
  });

  return {
    rowCount: rows.length,
    dateRange: {
      from: minDate ? minDate.toISOString() : null,
      to: maxDate ? maxDate.toISOString() : null,
    },
    currencies: Array.from(currencies),
    columns: typedColumns,
  };
};

const buildForecast = (monthlySeries) => {
  if (monthlySeries.length < 4) return [];

  const points = monthlySeries.map((entry, index) => ({ x: index, y: entry.net }));
  const n = points.length;
  const sumX = points.reduce((sum, point) => sum + point.x, 0);
  const sumY = points.reduce((sum, point) => sum + point.y, 0);
  const sumXY = points.reduce((sum, point) => sum + point.x * point.y, 0);
  const sumX2 = points.reduce((sum, point) => sum + point.x * point.x, 0);

  const denominator = n * sumX2 - sumX * sumX;
  if (denominator === 0) return [];

  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;

  const lastDate = monthlySeries[monthlySeries.length - 1].key;
  const [year, month] = lastDate.split("-").map(Number);
  const base = new Date(year, month - 1, 1);

  return Array.from({ length: 3 }, (_, idx) => {
    const futureDate = new Date(base);
    futureDate.setMonth(base.getMonth() + idx + 1);
    const key = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, "0")}`;
    const x = n + idx;
    const y = slope * x + intercept;
    return {
      key,
      label: key,
      projectedNet: Number(y.toFixed(2)),
    };
  });
};

const parseIntent = (query = "") => {
  const text = String(query || "").toLowerCase();

  const askHeatmap = /heatmap|calendar|weekday/.test(text);
  const askScatter = /scatter|correlation|outlier|anomaly|spike/.test(text);
  const askDonut = /donut/.test(text);
  const askPie = /pie|breakdown|share/.test(text) || askDonut;
  const askCompare = /compare|vs|versus/.test(text);
  const askForecast = /forecast|predict|projection|next/.test(text);
  const askCashFlow = /cash\s*flow|net/.test(text);
  const askVendors = /vendor|client|customer|merchant/.test(text);
  const askCategory = /category|categories/.test(text);
  const askIncome = /income|revenue|sales/.test(text);
  const askExpense = /expense|spend|cost/.test(text);

  let chartType = "line";
  if (askHeatmap) chartType = "heatmap";
  else if (askScatter) chartType = "scatter";
  else if (askCompare) chartType = "stackedBar";
  else if (askPie) chartType = askDonut ? "donut" : "pie";
  else if (askForecast) chartType = "forecast";
  else if (askCashFlow) chartType = "area";

  const focus = askVendors
    ? "vendors"
    : askCategory
      ? "category"
      : askCashFlow
        ? "cashflow"
        : "monthly";

  const metric = askIncome && !askExpense
    ? "income"
    : askExpense && !askIncome
      ? "expense"
      : "both";

  return {
    chartType,
    focus,
    metric,
    forecast: askForecast,
    anomaly: askScatter || /anomaly|spike|suspicious/.test(text),
  };
};

const buildChartPayload = (rows, intent) => {
  const monthly = buildMonthlySeries(rows);
  const categories = buildCategorySeries(rows, 12);
  const vendors = buildVendorSeries(rows, 10);
  const anomalies = detectAnomalies(rows);
  const heatmap = buildHeatmap(rows);
  const forecast = buildForecast(monthly);

  if (intent.chartType === "heatmap") {
    return {
      type: "heatmap",
      title: "Weekly Spending Heatmap",
      description: "Net money movement by day and week.",
      data: heatmap,
      xKey: "weekIndex",
      yKey: "dayIndex",
      options: { metric: "net" },
    };
  }

  if (intent.chartType === "scatter") {
    const scatterData = rows.slice(0, 3000).map((row) => ({
      x: row.date.getTime(),
      y: row.signedAmount,
      absAmount: row.amount,
      type: row.type,
      category: row.category,
      dateLabel: row.date.toISOString().slice(0, 10),
    }));

    return {
      type: "scatter",
      title: "Transaction Outlier Explorer",
      description: "Each point is one transaction. Use hover to inspect unusual values.",
      data: scatterData,
      anomalies,
      xKey: "x",
      yKey: "y",
      options: { xAsDate: true },
    };
  }

  if (intent.focus === "vendors") {
    return {
      type: intent.chartType === "donut" || intent.chartType === "pie" ? intent.chartType : "bar",
      title: "Client and Vendor Contribution",
      description: "Compare where money comes from and where it is spent.",
      data: vendors,
      xKey: "name",
      yKeys: ["revenue", "spend"],
      valueKey: "revenue",
      nameKey: "name",
      options: { stacked: true },
    };
  }

  if (intent.focus === "category" || intent.chartType === "pie" || intent.chartType === "donut") {
    return {
      type: intent.chartType === "donut" || intent.chartType === "pie" ? intent.chartType : "bar",
      title: "Top Expense Categories",
      description: "Category concentration by amount and volume.",
      data: categories,
      xKey: "name",
      yKeys: ["expense", "income", "count"],
      valueKey: "expense",
      nameKey: "name",
      options: { stacked: false },
    };
  }

  if (intent.chartType === "forecast") {
    return {
      type: "forecast",
      title: "Net Cash Flow Forecast",
      description: "Historical net trend with a forward projection.",
      data: monthly,
      forecast,
      xKey: "label",
      yKeys: ["net", "income", "expense"],
    };
  }

  if (intent.chartType === "stackedBar") {
    return {
      type: "stackedBar",
      title: "Income vs Expense Comparison",
      description: "Month-over-month comparison of income and expenses.",
      data: monthly,
      xKey: "label",
      yKeys: ["income", "expense", "transfer"],
      options: { stacked: true },
    };
  }

  if (intent.chartType === "area") {
    return {
      type: "area",
      title: "Cash Flow Trend",
      description: "Monthly movement across income, expenses, and net position.",
      data: monthly,
      xKey: "label",
      yKeys: ["income", "expense", "net"],
      options: { smooth: true },
    };
  }

  return {
    type: "line",
    title: "Financial Trend Overview",
    description: "Monthly trend for core financial signals.",
    data: monthly,
    xKey: "label",
    yKeys: ["income", "expense", "net"],
    anomalies,
  };
};

const buildInsights = (rows, kpis, chartPayload, anomalies) => {
  const insights = [];

  insights.push(
    `Processed ${kpis.totalTransactions} transactions with ${kpis.pendingReview} pending review.`
  );

  if (kpis.totalExpense > 0 && kpis.totalIncome > 0) {
    const ratio = (kpis.totalExpense / kpis.totalIncome) * 100;
    insights.push(`Expense-to-income ratio is ${ratio.toFixed(1)}%.`);
  }

  const categorySeries = buildCategorySeries(rows, 1);
  if (categorySeries.length > 0) {
    insights.push(
      `${categorySeries[0].name} is the highest concentration category by volume.`
    );
  }

  if (anomalies.length > 0) {
    insights.push(
      `${anomalies.length} spending anomalies were detected. Highest z-score is ${anomalies[0].zScore}.`
    );
  }

  if (chartPayload.type === "forecast" && Array.isArray(chartPayload.forecast) && chartPayload.forecast.length) {
    const next = chartPayload.forecast[0].projectedNet;
    insights.push(`Projected net cash flow next period is ${next >= 0 ? "positive" : "negative"}.`);
  }

  return insights;
};

const maybeEnhanceInsightsWithAI = async ({ query, profile, kpis, insights }) => {
  if (!groq || !groqEnhancementEnabled) return insights;

  try {
    const prompt = `You are an expert fintech analyst. Improve these draft insights for an accounting dashboard.\n\nUser query: ${query}\n\nDataset profile: ${JSON.stringify(profile)}\n\nKPIs: ${JSON.stringify(kpis)}\n\nDraft insights: ${JSON.stringify(insights)}\n\nReturn a JSON array of 3 to 6 concise insights.`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 350,
    });

    const text = completion.choices?.[0]?.message?.content || "[]";
    const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((item) => String(item));
    }
  } catch (error) {
    console.warn("AI insight enhancement failed:", error.message);
    if (String(error?.message || "").toLowerCase().includes("invalid api key")) {
      groqEnhancementEnabled = false;
      console.warn("AI insight enhancement disabled for this runtime due to invalid API key.");
    }
  }

  return insights;
};

const makeWorkspacePayload = async (rows) => {
  const profile = buildDatasetProfile(rows);
  const kpis = buildKpis(rows);
  const monthly = buildMonthlySeries(rows);
  const categories = buildCategorySeries(rows, 8);
  const anomalies = detectAnomalies(rows);

  return {
    profile,
    kpis,
    quickInsights: [
      `${kpis.totalTransactions} transactions indexed across ${profile.columns.length} detected columns.`,
      `${categories[0]?.name || "Uncategorized"} is currently the dominant category.`,
      `${anomalies.length} anomaly signals flagged for investigation.`,
    ],
    suggestedPrompts: [
      "Show monthly expenses with anomaly flags",
      "Compare income vs expense by month",
      "Visualize top expense categories as a donut",
      "Forecast net cash flow for next quarter",
      "Compare vendors by revenue contribution",
      "Show suspicious spending spikes",
    ],
    suggestedCharts: [
      {
        id: "monthly-overview",
        title: "Monthly Overview",
        subtitle: "Income, expense and net trend",
        type: "line",
        payload: {
          type: "line",
          title: "Monthly Financial Signals",
          data: monthly,
          xKey: "label",
          yKeys: ["income", "expense", "net"],
        },
      },
      {
        id: "category-donut",
        title: "Expense Concentration",
        subtitle: "Top categories by spend",
        type: "donut",
        payload: {
          type: "donut",
          title: "Top Categories",
          data: categories,
          valueKey: "expense",
          nameKey: "name",
          xKey: "name",
        },
      },
      {
        id: "anomaly-scatter",
        title: "Anomaly Radar",
        subtitle: "Outliers and suspicious spikes",
        type: "scatter",
        payload: {
          type: "scatter",
          title: "Spending Outlier Radar",
          data: rows.slice(0, 1500).map((row) => ({
            x: row.date.getTime(),
            y: row.signedAmount,
            absAmount: row.amount,
            type: row.type,
            category: row.category,
            dateLabel: row.date.toISOString().slice(0, 10),
          })),
          xKey: "x",
          yKey: "y",
          anomalies,
          options: { xAsDate: true },
        },
      },
    ],
  };
};

const listReports = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "User not authenticated" });
    const key = String(req.user._id);
    const reports = reportStore.get(key) || [];
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: "Failed to list reports", details: error.message });
  }
};

const saveReport = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "User not authenticated" });

    const { title, payload } = req.body || {};
    if (!title || !payload) {
      return res.status(400).json({ error: "title and payload are required" });
    }

    const key = String(req.user._id);
    const current = reportStore.get(key) || [];

    const report = {
      id: crypto.randomUUID(),
      title: String(title),
      payload,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };

    current.unshift(report);
    reportStore.set(key, current.slice(0, 30));

    res.json({ report });
  } catch (error) {
    res.status(500).json({ error: "Failed to save report", details: error.message });
  }
};

const deleteReport = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "User not authenticated" });

    const key = String(req.user._id);
    const reports = reportStore.get(key) || [];
    const next = reports.filter((report) => report.id !== req.params.reportId);
    reportStore.set(key, next);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete report", details: error.message });
  }
};

const getWorkspace = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "User not authenticated" });

    const rows = await fetchUserTransactions(req.user._id);
    const filtered = applyFilters(rows, req.query || {});
    const payload = await makeWorkspacePayload(filtered);

    res.json(payload);
  } catch (error) {
    console.error("Error loading chart workspace:", error);
    res.status(500).json({ error: "Failed to load analytics workspace", details: error.message });
  }
};

const generateChart = async (req, res) => {
  try {
    if (!req.user?._id) return res.status(401).json({ error: "User not authenticated" });

    const query = String(req.body?.query || "").trim();
    if (!query) return res.status(400).json({ error: "Query is required" });

    const rows = await fetchUserTransactions(req.user._id);
    const filteredRows = applyFilters(rows, req.body?.filters || {});
    if (!filteredRows.length) {
      return res.json({
        chart: null,
        kpis: buildKpis([]),
        profile: buildDatasetProfile([]),
        insights: ["No transactions match the current filters."],
        anomalies: [],
        recommendations: ["Try removing filters or uploading transaction data."],
      });
    }

    const intent = parseIntent(query);
    const chart = buildChartPayload(filteredRows, intent);
    const profile = buildDatasetProfile(filteredRows);
    const kpis = buildKpis(filteredRows);
    const anomalies = detectAnomalies(filteredRows);

    let insights = buildInsights(filteredRows, kpis, chart, anomalies);
    insights = await maybeEnhanceInsightsWithAI({ query, profile, kpis, insights });

    const recommendations = [
      "Use date filters to compare quarter-over-quarter performance.",
      "Save this chart as a report to track it alongside KPI cards.",
      "Switch to anomaly view to inspect suspicious spikes by vendor and category.",
    ];

    res.json({
      query,
      intent,
      chart,
      kpis,
      profile,
      insights,
      anomalies,
      recommendations,
      generatedAt: nowIso(),
    });
  } catch (error) {
    console.error("Error generating chart:", error);
    res.status(500).json({ error: "Failed to generate chart", details: error.message });
  }
};

module.exports = {
  generateChart,
  getWorkspace,
  listReports,
  saveReport,
  deleteReport,
};
