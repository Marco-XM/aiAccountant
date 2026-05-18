import React from "react";

const InsightCard = ({ title, body }) => (
  <div className="rounded-lg bg-slate-900/40 p-3">
    <p className="text-sm font-medium text-white">{title}</p>
    <p className="mt-2 text-xs text-slate-300">{body}</p>
  </div>
);

const AIInsightsPanel = ({ insights = [] }) => {
  const sample = insights.length
    ? insights
    : [
        { id: 1, title: "Anomaly detected", body: "Spike in software spend on 2026-05-10" },
        { id: 2, title: "Forecast", body: "Projected net increase of 3.5% next quarter" },
      ];

  return (
    <section className="rounded-2xl bg-slate-950/50 p-4">
      <h3 className="text-lg font-semibold text-white">AI Insights</h3>
      <p className="text-xs text-slate-400">Auto-generated observations & recommendations</p>

      <div className="mt-4 grid grid-cols-1 gap-3">
        {sample.map((s) => (
          <InsightCard key={s.id} title={s.title} body={s.body} />
        ))}
      </div>
    </section>
  );
};

export default AIInsightsPanel;
