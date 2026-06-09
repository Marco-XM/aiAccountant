import React from "react";

const DataGrid = ({ rows = [] }) => {
  const safeRows = Array.isArray(rows)
    ? rows
    : Array.isArray(rows?.transactions)
      ? rows.transactions
      : Array.isArray(rows?.rows)
        ? rows.rows
        : [];

  return (
    <div className="rounded-md border border-theme bg-surface-alt p-2">
      <div className="w-full overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-muted">
            <tr>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-left">Category</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {safeRows.length === 0 ? (
              <tr>
                <td className="p-4 text-muted" colSpan={5}>No transactions to display</td>
              </tr>
            ) : (
              safeRows.map((r) => (
                <tr key={r._id} className="border-t border-theme hover:bg-surface transition-colors">
                  <td className="px-2 py-2 text-muted">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-2 py-2 truncate max-w-[140px]">{r.desc || r.description || ""}</td>
                  <td className={`px-2 py-2 text-right font-medium ${Number(r.amount) >= 0 ? "text-emerald-500" : "text-[color:var(--ui-accent-2)]"}`}>{Number(r.amount).toFixed(2)}</td>
                  <td className="px-2 py-2 text-muted">{r.category}</td>
                  <td className="px-2 py-2 text-muted">{r.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default DataGrid;
