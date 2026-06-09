import React from "react";

const SavedReportsPanel = ({ reports = [], onLoad, onDelete }) => (
  <div className="rounded-3xl border border-theme bg-surface p-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Saved reports</h3>
      <span className="rounded-full border border-theme px-2 py-1 text-[11px] text-muted">{reports.length}</span>
    </div>
    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {reports.length === 0 ? (
        <p className="text-sm text-muted">No saved reports yet. Generate a chart and click Save Report.</p>
      ) : (
        reports.map((report) => (
          <div key={report.id} className="rounded-2xl border border-theme bg-surface-alt p-4">
            <p className="text-sm font-medium text-ink">{report.title}</p>
            <p className="mt-1 text-xs text-muted">{new Date(report.createdAt).toLocaleDateString()}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => onLoad?.(report)}
                className="rounded-lg border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs text-cyan-600 dark:text-cyan-200">Open</button>
              <button type="button" onClick={() => onDelete?.(report.id)}
                className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-600 dark:text-rose-200">Delete</button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);

export default SavedReportsPanel;
