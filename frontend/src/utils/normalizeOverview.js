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
      if (raw[k] != null) return String(raw[k]);
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

  const revenue = pickNumber('revenue', 'totalRevenue', 'revenue_t12', 'ttm_revenue');
  const netProfit = pickNumber('netProfit', 'net', 'profit', 'net_income');
  const cashFlow = pickNumber('cashFlow', 'cash', 'cash_flow', 'liquidity');
  const growthPct = pickNumber('growthPct', 'growthPercent', 'growth', 'growth');

  const aiSummary = pickString('aiSummary', 'ai', 'insights') || (raw.ai && raw.ai.summary) || undefined;

  const alerts = raw.alerts || raw.risks || raw.warnings || undefined;

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

  return {
    revenue: formatCurrency(revenue) || raw.revenueFormatted || undefined,
    revenueRaw: revenue,
    netProfit: formatCurrency(netProfit) || raw.netProfitFormatted || undefined,
    netProfitRaw: netProfit,
    cashFlow: formatCurrency(cashFlow) || raw.cashFormatted || undefined,
    cashFlowRaw: cashFlow,
    growthPct: growthPct != null ? `${growthPct}%` : undefined,
    growthRaw: growthPct,
    aiSummary,
    alerts,
    trends,
    forecast,
    raw,
  };
}

export default normalizeOverview;
