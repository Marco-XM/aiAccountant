import React from "react";

const AlertsWidget = ({ alerts }) => {
  const loading = alerts === undefined;

  return (
    <div className="rounded-2xl border border-theme bg-surface p-4 shadow-sm">
      <h4 className="text-sm font-semibold text-danger">Alerts</h4>
      <div className="mt-3 space-y-3">
        {loading ? (
          <>
            <div className="h-10 rounded bg-skeleton animate-pulse" />
            <div className="h-10 rounded bg-skeleton animate-pulse" />
          </>
        ) : alerts && alerts.length > 0 ? (
          alerts.map((a) => (
            <div key={a.id} className="flex items-start gap-3">
              <div className={`w-3 h-3 mt-1 rounded-full shrink-0 ${a.tone === 'rose' ? 'bg-[#D8315B]' : 'bg-violet-400'}`} />
              <div className="min-w-0">
                <div className="text-sm font-medium text-ink">{a.title}</div>
                <div className="text-xs text-muted">{a.detail}</div>
              </div>
            </div>
          ))
        ) : (
          <p className="text-xs text-muted py-1">No active alerts.</p>
        )}
      </div>
    </div>
  );
};

export default AlertsWidget;
