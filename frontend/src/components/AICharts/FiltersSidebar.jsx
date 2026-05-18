import React from "react";

const FiltersSidebar = () => {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
      <h3 className="text-sm font-semibold text-cyan-200">Filters</h3>
      <div className="mt-3 space-y-3">
        <select className="w-full rounded-xl bg-slate-900/40 p-2 text-sm">
          <option value="12m">Last 12 months</option>
          <option value="6m">Last 6 months</option>
          <option value="90d">Last 90 days</option>
        </select>
        <select className="w-full rounded-xl bg-slate-900/40 p-2 text-sm">
          <option value="all">All categories</option>
        </select>
        <input className="w-full rounded-xl bg-slate-900/40 p-2 text-sm" placeholder="Search" />
      </div>
    </div>
  );
};

export default FiltersSidebar;
