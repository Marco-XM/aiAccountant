import React from "react";

const InsightsPanel = ({ result }) => {
  const insights = result?.insights || [];
  return (
    <div className="col-span-2 lg:col-span-1">
      <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
        <h3 className="text-sm font-semibold text-fuchsia-200">AI Insights</h3>
        <div className="mt-3 space-y-2">
          {insights.length === 0 ? (
            <div className="text-sm text-slate-400">No insights yet. Ask the assistant to generate one.</div>
          ) : (
            insights.map((line, i) => (
              <div key={i} className="rounded-lg bg-slate-900/40 p-3 text-sm text-slate-200">
                {line}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default InsightsPanel;
