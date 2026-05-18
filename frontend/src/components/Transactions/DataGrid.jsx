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
    <div className="rounded-md border border-white/6 bg-slate-900/60 p-2">
      <div className="w-full overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="text-xs text-slate-400">
            <tr>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Description</th>
              <th className="px-2 py-2 text-right">Amount</th>
              <th className="px-2 py-2 text-left">Category</th>
              <th className="px-2 py-2 text-left">Status</th>
            </tr>
          </thead>
          <tbody className="text-slate-200">
            {safeRows.length === 0 ? (
              <tr>
                <td className="p-4 text-slate-400">No transactions to display</td>
              </tr>
            ) : (
              safeRows.map((r) => (
                <tr key={r._id} className="hover:bg-white/2">
                  <td className="px-2 py-2">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-2 py-2">{r.desc || r.description || ""}</td>
                  <td className="px-2 py-2 text-right">{Number(r.amount).toFixed(2)}</td>
                  <td className="px-2 py-2">{r.category}</td>
                  <td className="px-2 py-2">{r.status}</td>
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
