import React from "react";

const InsightsPanel = ({ result, workspace }) => {
  const insights = result?.insights || workspace?.quickInsights || [];
  const anomalies = result?.anomalies || [];
  const toCurrency = (v) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v ?? 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-3xl border border-theme bg-surface p-5">
        <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">AI Insights</h3>
        <div className="mt-3 space-y-2">
          {insights.length === 0 ? (
            <p className="text-sm text-muted">No insights yet. Generate a chart to see AI analysis.</p>
          ) : (
            insights.map((line, i) => (
              <div key={i} className="rounded-xl border border-theme bg-surface-alt p-3 text-sm text-ink">{line}</div>
            ))
          )}
        </div>
        {result?.recommendations?.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Recommendations</p>
            <div className="mt-2 space-y-1">
              {result.recommendations.map((r, i) => <p key={i} className="text-sm text-muted">{r}</p>)}
            </div>
          </div>
        )}
      </div>

      {anomalies.length > 0 && (
        <div className="rounded-3xl border border-theme bg-surface p-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--ui-danger,#f43f5e)]">Anomaly detections</p>
          <div className="mt-2 space-y-2">
            {anomalies.slice(0, 4).map((item) => (
              <div key={item.id} className="rounded-xl border border-rose-400/25 bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-100">
                <div className="flex items-center justify-between gap-3">
                  <span>{item.category || "Uncategorized"}</span>
                  <span>{toCurrency(item.amount)}</span>
                </div>
                <p className="mt-1 text-rose-600 dark:text-rose-200/90">{item.desc || item.vendor || "Potential outlier"}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default InsightsPanel;
