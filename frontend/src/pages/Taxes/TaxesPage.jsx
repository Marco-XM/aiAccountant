import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import { api } from "../../config/api";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const fmt = (n) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(n) || 0);

// Client-side mirror of backend taxService for the live calculator.
const computeTaxes = (base, taxes) => {
  const safeBase = Number(base) || 0;
  const active = (taxes || [])
    .filter((t) => t.active !== false)
    .sort((a, b) => (a.order || 0) - (b.order || 0));
  let running = safeBase;
  let totalTax = 0;
  const lines = active.map((tax) => {
    const taxableBase = tax.compound ? running : safeBase;
    const amount =
      tax.type === "flat" ? round2(tax.amount) : round2(taxableBase * ((Number(tax.rate) || 0) / 100));
    running = round2(running + amount);
    totalTax = round2(totalTax + amount);
    return { ...tax, taxableBase: round2(taxableBase), amount };
  });
  return { base: round2(safeBase), lines, totalTax: round2(totalTax), total: round2(safeBase + totalTax) };
};

const emptyForm = {
  name: "",
  type: "percentage",
  rate: "",
  amount: "",
  order: 0,
  compound: false,
  appliesTo: "all",
  active: true,
};

const field = "w-full rounded-lg border border-theme bg-surface px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-[color:var(--ui-accent)]";
const label = "block text-xs font-semibold text-muted-2 mb-1";

export default function TaxesPage() {
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [base, setBase] = useState(1000);
  const [report, setReport] = useState(null);

  const loadTaxes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.taxes.list();
      setTaxes(data.taxes || []);
    } catch {
      toast.error("Failed to load taxes.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadReport = useCallback(async () => {
    try {
      const { data } = await api.taxes.report();
      setReport(data);
    } catch {
      /* report is best-effort */
    }
  }, []);

  useEffect(() => {
    loadTaxes();
    loadReport();
  }, [loadTaxes, loadReport]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const setF = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Tax name is required.");
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      rate: form.type === "percentage" ? Number(form.rate) || 0 : 0,
      amount: form.type === "flat" ? Number(form.amount) || 0 : 0,
      order: Number(form.order) || 0,
      compound: Boolean(form.compound),
      appliesTo: form.appliesTo,
      active: Boolean(form.active),
    };
    try {
      if (editingId) {
        await api.taxes.update(editingId, payload);
        toast.success("Tax updated.");
      } else {
        await api.taxes.create(payload);
        toast.success("Tax created.");
      }
      resetForm();
      await Promise.all([loadTaxes(), loadReport()]);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save tax.");
    } finally {
      setSaving(false);
    }
  };

  const editTax = (t) => {
    setEditingId(t.id);
    setForm({
      name: t.name || "",
      type: t.type || "percentage",
      rate: t.type === "flat" ? "" : t.rate ?? "",
      amount: t.type === "flat" ? t.amount ?? "" : "",
      order: t.order || 0,
      compound: Boolean(t.compound),
      appliesTo: t.appliesTo || "all",
      active: t.active !== false,
    });
  };

  const removeTax = async (t) => {
    if (!window.confirm(`Delete tax "${t.name}"?`)) return;
    try {
      await api.taxes.remove(t.id);
      toast.success("Tax deleted.");
      if (editingId === t.id) resetForm();
      await Promise.all([loadTaxes(), loadReport()]);
    } catch {
      toast.error("Failed to delete tax.");
    }
  };

  const sortedTaxes = [...taxes].sort((a, b) => (a.order || 0) - (b.order || 0));
  const calc = computeTaxes(base, taxes);

  const describeRate = (t) =>
    t.type === "flat" ? fmt(t.amount) : `${t.rate}%`;

  return (
    <div className="min-h-screen" style={{ background: "var(--ui-bg)" }}>
      <div className="mx-auto max-w-7xl px-6 py-8">
        <h1 className="text-2xl font-extrabold text-ink-2">Tax Management</h1>
        <p className="mt-1 text-sm text-muted">
          Define named taxes, set the order they're calculated in, and choose whether each one
          compounds on the running total. Applied to your income, expenses, and per transaction.
        </p>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ── Taxes list + form ───────────────────────────── */}
          <div className="lg:col-span-2 space-y-6">
            <section className="rounded-2xl border border-theme bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink-2 mb-4">Your taxes</h2>
              {loading ? (
                <div className="space-y-2">
                  <div className="h-12 rounded bg-skeleton animate-pulse" />
                  <div className="h-12 rounded bg-skeleton animate-pulse" />
                </div>
              ) : sortedTaxes.length === 0 ? (
                <p className="text-sm text-muted py-4">No taxes yet. Add your first one below.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs text-muted-2 border-b border-theme">
                        <th className="py-2 pr-3">Order</th>
                        <th className="py-2 pr-3">Name</th>
                        <th className="py-2 pr-3">Rate</th>
                        <th className="py-2 pr-3">Applies to</th>
                        <th className="py-2 pr-3">Compound</th>
                        <th className="py-2 pr-3">Status</th>
                        <th className="py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTaxes.map((t) => (
                        <tr key={t.id} className="border-b border-theme/60">
                          <td className="py-2.5 pr-3 font-mono text-muted-2">{t.order}</td>
                          <td className="py-2.5 pr-3 font-semibold text-ink">{t.name}</td>
                          <td className="py-2.5 pr-3 text-ink-2">{describeRate(t)}</td>
                          <td className="py-2.5 pr-3 capitalize text-muted-2">{t.appliesTo}</td>
                          <td className="py-2.5 pr-3">
                            {t.compound ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">on total</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">on base</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3">
                            {t.active ? (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">Active</span>
                            ) : (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Off</span>
                            )}
                          </td>
                          <td className="py-2.5 text-right whitespace-nowrap">
                            <button onClick={() => editTax(t)} className="text-xs font-semibold text-[color:var(--ui-accent)] hover:underline mr-3">Edit</button>
                            <button onClick={() => removeTax(t)} className="text-xs font-semibold text-rose-600 hover:underline">Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Add / edit form */}
            <section className="rounded-2xl border border-theme bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink-2 mb-4">
                {editingId ? "Edit tax" : "Add a tax"}
              </h2>
              <form onSubmit={submit} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className={label}>Name</label>
                  <input className={field} value={form.name} onChange={(e) => setF("name", e.target.value)} placeholder="e.g. VAT, Sales tax, GST" />
                </div>

                <div>
                  <label className={label}>Type</label>
                  <select className={field} value={form.type} onChange={(e) => setF("type", e.target.value)}>
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Flat amount ($)</option>
                  </select>
                </div>

                {form.type === "percentage" ? (
                  <div>
                    <label className={label}>Rate (%)</label>
                    <input type="number" step="0.01" className={field} value={form.rate} onChange={(e) => setF("rate", e.target.value)} placeholder="e.g. 14" />
                  </div>
                ) : (
                  <div>
                    <label className={label}>Amount ($)</label>
                    <input type="number" step="0.01" className={field} value={form.amount} onChange={(e) => setF("amount", e.target.value)} placeholder="e.g. 5" />
                  </div>
                )}

                <div>
                  <label className={label}>Calculation order</label>
                  <input type="number" className={field} value={form.order} onChange={(e) => setF("order", e.target.value)} />
                  <p className="text-[11px] text-muted mt-1">Lower numbers are calculated first.</p>
                </div>

                <div>
                  <label className={label}>Applies to</label>
                  <select className={field} value={form.appliesTo} onChange={(e) => setF("appliesTo", e.target.value)}>
                    <option value="all">All transactions</option>
                    <option value="income">Income only</option>
                    <option value="expense">Expenses only</option>
                  </select>
                </div>

                <div className="sm:col-span-2 flex flex-wrap items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
                    <input type="checkbox" checked={form.compound} onChange={(e) => setF("compound", e.target.checked)} className="accent-[color:var(--ui-accent)]" />
                    Compound (tax-on-tax) — apply to the running total incl. earlier taxes
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink cursor-pointer select-none">
                    <input type="checkbox" checked={form.active} onChange={(e) => setF("active", e.target.checked)} className="accent-[color:var(--ui-accent)]" />
                    Active
                  </label>
                </div>

                <div className="sm:col-span-2 flex gap-3 pt-1">
                  <button type="submit" disabled={saving} className="ui-btn text-white disabled:opacity-50">
                    {saving ? "Saving..." : editingId ? "Update tax" : "Add tax"}
                  </button>
                  {editingId && (
                    <button type="button" onClick={resetForm} className="rounded-lg border border-theme px-4 py-2 text-sm text-muted-2 hover:bg-surface-alt">
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </section>
          </div>

          {/* ── Calculator + report ─────────────────────────── */}
          <div className="space-y-6">
            <section className="rounded-2xl border border-theme bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink-2 mb-3">Calculator</h2>
              <label className={label}>Base amount</label>
              <input type="number" className={field} value={base} onChange={(e) => setBase(e.target.value)} />
              <div className="mt-4 space-y-2">
                {calc.lines.length === 0 ? (
                  <p className="text-sm text-muted">Add active taxes to see a breakdown.</p>
                ) : (
                  calc.lines.map((l) => (
                    <div key={l.id} className="flex justify-between text-sm">
                      <span className="text-muted-2">
                        {l.name} <span className="text-muted">({l.type === "flat" ? fmt(l.amount) : `${l.rate}%`}{l.compound ? ", on total" : ""})</span>
                      </span>
                      <span className="text-ink font-medium">{fmt(l.amount)}</span>
                    </div>
                  ))
                )}
                <div className="flex justify-between text-sm pt-2 border-t border-theme">
                  <span className="text-muted-2">Total tax</span>
                  <span className="text-ink font-semibold">{fmt(calc.totalTax)}</span>
                </div>
                <div className="flex justify-between text-base">
                  <span className="font-semibold text-ink-2">Grand total</span>
                  <span className="font-bold text-ink-2">{fmt(calc.total)}</span>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-theme bg-surface p-5 shadow-sm">
              <h2 className="text-lg font-semibold text-ink-2 mb-3">Applied to your data</h2>
              {!report ? (
                <p className="text-sm text-muted">Loading report…</p>
              ) : report.taxCount === 0 ? (
                <p className="text-sm text-muted">Add a tax to see it applied to your transactions.</p>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="rounded-lg bg-surface-alt border border-theme p-3">
                    <p className="text-xs text-muted">Tax on income ({fmt(report.income.base)})</p>
                    <p className="text-lg font-bold text-ink-2">{fmt(report.income.totalTax)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-alt border border-theme p-3">
                    <p className="text-xs text-muted">Tax on expenses ({fmt(report.expense.base)})</p>
                    <p className="text-lg font-bold text-ink-2">{fmt(report.expense.totalTax)}</p>
                  </div>
                  <div className="rounded-lg bg-surface-alt border border-theme p-3">
                    <p className="text-xs text-muted">Per-transaction tax ({report.perTransaction.count} txns)</p>
                    <p className="text-lg font-bold text-ink-2">{fmt(report.perTransaction.totalTax)}</p>
                  </div>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
