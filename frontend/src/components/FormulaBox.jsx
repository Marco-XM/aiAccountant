import React, { useState } from "react";

/**
 * Reusable, collapsible panel that shows the formulas / methodology behind
 * AI-calculated numbers so users can audit the math themselves.
 *
 * Each formula item supports:
 *   - label:   short name of the quantity (e.g. "Net Cash Flow")
 *   - formula: the expression, ideally with the real values substituted in
 *              (e.g. "Total Income − Total Expense = $12,000 − $8,000")
 *   - result:  the final value (e.g. "$4,000") — rendered as "= result"
 *   - note:    optional clarifying caption
 */
const FormulaBox = ({
  formulas = [],
  title = "How these numbers were calculated",
  subtitle = "Check the math behind the results above.",
  defaultOpen = false,
  className = "",
}) => {
  const [open, setOpen] = useState(defaultOpen);

  const items = (formulas || []).filter(Boolean);
  if (items.length === 0) return null;

  return (
    <div className={`overflow-hidden rounded-2xl border border-theme bg-surface-alt ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2">
          <svg className="h-4 w-4 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 7h6m-6 4h6m-6 4h3M5 3h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2z" />
          </svg>
          <span className="text-sm font-semibold text-ink">{title}</span>
          <span className="rounded-full border border-theme px-2 py-0.5 text-[11px] text-muted">{items.length}</span>
        </span>
        <span className="text-xs font-medium text-accent">{open ? "Hide" : "Show"}</span>
      </button>

      {open && (
        <div className="space-y-2 border-t border-theme px-4 py-3">
          {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
          {items.map((f, i) => {
            const item = typeof f === "string" ? { formula: f } : f;
            return (
              <div key={i} className="rounded-xl border border-theme bg-surface px-3 py-2">
                {item.label && (
                  <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-accent">{item.label}</p>
                )}
                <p className="mt-1 break-words font-mono text-sm text-ink">
                  {item.formula ?? item.expression}
                  {item.result != null && item.result !== "" && (
                    <span className="font-semibold"> = {item.result}</span>
                  )}
                </p>
                {item.note && <p className="mt-1 text-xs text-muted">{item.note}</p>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default FormulaBox;
