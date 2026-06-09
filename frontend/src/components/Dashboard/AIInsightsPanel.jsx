import React from "react";

const InsightCard = ({ title, body }) => (
  <div className="rounded-lg bg-surface-alt border border-theme p-3">
    <p className="text-sm font-medium text-ink-2">{title}</p>
    <p className="mt-2 text-xs text-muted">{body}</p>
  </div>
);

const AIInsightsPanel = ({ insights }) => {
  const loading = insights === undefined;

  return (
    <section className="rounded-2xl border border-theme bg-surface p-4 shadow-sm">
      <h3 className="text-lg font-semibold text-ink-2">AI Insights</h3>
      <p className="text-xs text-muted">Auto-generated observations &amp; recommendations</p>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {loading ? (
          <>
            <div className="h-16 rounded-lg bg-skeleton animate-pulse" />
            <div className="h-16 rounded-lg bg-skeleton animate-pulse" />
          </>
        ) : insights && insights.length > 0 ? (
          insights.map((s) => (
            <InsightCard key={s.id} title={s.title} body={s.body} />
          ))
        ) : (
          <p className="text-sm text-muted py-2">No insights available yet. Add transactions to generate insights.</p>
        )}
      </div>
    </section>
  );
};

export default AIInsightsPanel;
