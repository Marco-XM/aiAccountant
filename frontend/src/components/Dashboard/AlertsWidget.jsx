import React from "react";

const AlertsWidget = ({ alerts = [] }) => {
  const sample = alerts.length
    ? alerts
    : [
        { id: 1, title: "DB sync delayed", detail: "Reconciliation pending — 12,432 rows", tone: "rose" },
        { id: 2, title: "Large expense detected", detail: "$24,900 at Vendor X", tone: "violet" },
      ];

  return (
    <div className="rounded-2xl border border-white/6 bg-slate-950/60 p-4">
      <h4 className="text-sm font-semibold text-rose-300">Alerts</h4>
      <div className="mt-3 space-y-3">
        {sample.map((a) => (
          <div key={a.id} className="flex items-start gap-3">
            <div className={`w-3 h-3 mt-1 rounded-full ${a.tone === 'rose' ? 'bg-rose-400' : 'bg-violet-400'}`} />
            <div>
              <div className="text-sm font-medium text-white">{a.title}</div>
              <div className="text-xs text-slate-400">{a.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AlertsWidget;
