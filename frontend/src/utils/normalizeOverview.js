export function normalizeOverview(raw = {}) {
  if (!raw || typeof raw !== 'object') return {};

  // Helpers
  const pickNumber = (...keys) => {
    for (const k of keys) {
      if (raw[k] != null && !isNaN(Number(raw[k]))) return Number(raw[k]);
    }
    return undefined;
  };

  const pickString = (...keys) => {
    for (const k of keys) {
      const v = raw[k];
      if (v != null && typeof v !== 'object') return String(v);
    }
    return undefined;
  };

  const formatCurrency = (v) => {
    if (v == null || isNaN(Number(v))) return undefined;
    const n = Number(v);
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
    if (Math.abs(n) >= 1_000) return `$${Math.round(n / 1000)}k`;
    return `$${n.toLocaleString()}`;
  };

  const _summary = (raw.summary && typeof raw.summary === 'object') ? raw.summary : {};
  const revenue = pickNumber('revenue', 'totalRevenue', 'revenue_t12', 'ttm_revenue') ?? _summary.revenue;
  const netProfit = pickNumber('netProfit', 'net', 'profit', 'net_income') ?? _summary.netProfit;
  const cashFlow = pickNumber('cashFlow', 'cash', 'cash_flow', 'liquidity') ?? _summary.cashFlow ?? _summary.bankBalance;
  const expenses = pickNumber('expenses', 'totalExpenses', 'costs') ?? _summary.expenses;
  const growthPct = pickNumber('growthPct', 'growthPercent', 'growth') ?? _summary.monthlyGrowth;

  const aiSummary = pickString('aiSummary')
    || (raw.ai && typeof raw.ai === 'object' && typeof raw.ai.summary === 'string' ? raw.ai.summary : null)
    || (Array.isArray(raw.insights) && raw.insights.length > 0
        ? (raw.insights[0].text || raw.insights[0].title || null)
        : null)
    || undefined;

  const _normalizeAlerts = (arr) => Array.isArray(arr) && arr.length
    ? arr.map((a, i) => ({
        id: a.id ?? i + 1,
        title: a.title || a.message || 'Alert',
        detail: a.detail || a.text || a.message || '',
        tone: a.tone || (a.priority === 'High' ? 'rose' : 'violet'),
      }))
    : null;
  const alerts = _normalizeAlerts(raw.alerts || raw.risks || raw.warnings)
    || (Array.isArray(raw.workflow?.reminders) && raw.workflow.reminders.length
        ? raw.workflow.reminders.map((r, i) => ({
            id: i + 1,
            title: r.title,
            detail: `Due: ${r.due} — ${r.priority}`,
            tone: r.priority === 'High' ? 'rose' : 'violet',
          }))
        : undefined);

  const insights = Array.isArray(raw.insights)
    ? raw.insights.map((item, i) => ({
        id: item.id ?? i + 1,
        title: item.title || 'Insight',
        body: item.text || item.body || item.message || '',
      }))
    : undefined;

  // Trends/forecast passthrough - normalize individual points to { date, income, expense, profit }
  const rawTrends = raw.trends || raw.timeseries || raw.series || [];
  const trends = (Array.isArray(rawTrends) ? rawTrends : [])
    .map((pt) => {
      if (!pt || typeof pt !== 'object') return null;

      // extract date-like values
      let dateVal = pt.date || pt.month || pt.timestamp || pt.time || pt.t;
      if (typeof dateVal === 'number') {
        // unix timestamp (seconds or ms)
        dateVal = dateVal > 1e12 ? new Date(dateVal).toISOString().slice(0, 10) : new Date(dateVal * 1000).toISOString().slice(0, 10);
      }
      if (typeof dateVal === 'string' && /^\d{4}-\d{2}$/.test(dateVal)) {
        // YYYY-MM -> convert to ISO first-of-month
        dateVal = `${dateVal}-01`;
      }

      const income = Number(pt.income ?? pt.revenue ?? pt.value ?? pt.y ?? 0) || 0;
      const expense = Number(pt.expense ?? pt.expenses ?? pt.cost ?? pt.x ?? 0) || 0;
      const profit = Number(pt.profit ?? (income - expense)) || 0;

      return {
        date: dateVal || pt.month || undefined,
        income,
        expense,
        profit,
        raw: pt,
      };
    })
    .filter(Boolean);
  const forecast = raw.forecast || raw.prediction || {};

  const _growth = growthPct != null ? Number(growthPct) : null;
  const growthFormatted = _growth != null ? `${_growth >= 0 ? '+' : ''}${_growth.toFixed(1)}%` : undefined;

  return {
    revenue: formatCurrency(revenue) || raw.revenueFormatted || undefined,
    revenueRaw: revenue,
    netProfit: formatCurrency(netProfit) || raw.netProfitFormatted || undefined,
    netProfitRaw: netProfit,
    cashFlow: formatCurrency(cashFlow) || raw.cashFormatted || undefined,
    cashFlowRaw: cashFlow,
    expenses: formatCurrency(expenses) || undefined,
    expensesRaw: expenses,
    growthPct: growthFormatted,
    growthRaw: _growth,
    kpiComparison: growthFormatted ?? '--',
    aiSummary,
    insights,
    alerts,
    trends,
    forecast,
    raw,
  };
}

export default normalizeOverview;
