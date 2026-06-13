import React from "react";

const smartPromptsFallback = [
  "Show my monthly expenses",
  "Compare income vs expenses",
  "Visualize cash flow for last 6 months",
  "Top expense categories as a donut",
];

const FiltersSidebar = ({
  filters = {},
  categories = ["all"],
  prompt = "",
  generating = false,
  loadingWorkspace = false,
  suggestedPrompts,
  onFiltersChange,
  onPromptChange,
  onGenerate,
}) => {
  const set = (key, val) => onFiltersChange?.({ ...filters, [key]: val });

  return (
    <div className="rounded-3xl border border-theme bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-[0.24em] text-accent">Ask AI</h2>
        <span className="rounded-full border border-theme px-3 py-1 text-xs text-muted">Real transaction-aware</span>
      </div>

      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <textarea
          value={prompt}
          onChange={(e) => onPromptChange?.(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) onGenerate?.(prompt); }}
          placeholder="Show software spending trend and flag unusual spikes"
          className="min-h-[100px] flex-1 rounded-2xl border border-theme bg-surface-alt px-4 py-3 text-sm text-ink outline-none placeholder:text-[color:var(--ui-muted)] focus:border-[color:var(--ui-accent)]"
        />
        <div className="grid w-full gap-2 md:w-[220px]">
          <select value={filters.dateRange ?? "all"} onChange={(e) => set("dateRange", e.target.value)}
            className="rounded-xl border border-theme bg-surface-alt px-3 py-2 text-sm text-ink outline-none">
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="6m">Last 6 months</option>
            <option value="12m">Last 12 months</option>
            <option value="all">All time</option>
          </select>
          <select value={filters.type ?? "all"} onChange={(e) => set("type", e.target.value)}
            className="rounded-xl border border-theme bg-surface-alt px-3 py-2 text-sm text-ink outline-none">
            <option value="all">All types</option>
            <option value="income">Income only</option>
            <option value="expense">Expense only</option>
            <option value="transfer">Transfer only</option>
          </select>
          <select value={filters.category ?? "all"} onChange={(e) => set("category", e.target.value)}
            className="rounded-xl border border-theme bg-surface-alt px-3 py-2 text-sm text-ink outline-none">
            {categories.map((cat) => (
              <option key={cat} value={cat}>{cat === "all" ? "All categories" : cat}</option>
            ))}
          </select>
          <button type="button" disabled={generating || loadingWorkspace}
            onClick={() => onGenerate?.(prompt)}
            className="rounded-xl border border-[color:var(--ui-accent)] bg-[color:var(--ui-accent)] px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 disabled:opacity-50">
            {generating ? "Analyzing…" : "Generate"}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {(suggestedPrompts || smartPromptsFallback).map((item) => (
          <button key={item} type="button"
            onClick={() => { onPromptChange?.(item); onGenerate?.(item); }}
            className="rounded-full border border-theme bg-surface-alt px-3 py-1.5 text-xs text-ink hover:border-[color:var(--ui-accent)]">
            {item}
          </button>
        ))}
      </div>
    </div>
  );
};

export default FiltersSidebar;
