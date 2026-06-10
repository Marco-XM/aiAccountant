/**
 * Pure tax calculation engine.
 *
 * Given a base amount and a list of taxes, computes each tax line and the totals.
 * Each tax: { name, type: "percentage"|"flat", rate, amount, order, compound, active }
 *   - order:    ascending — lower numbers are calculated first.
 *   - compound: when true the tax applies to the running total (base + earlier
 *               taxes); when false it applies to the original base amount.
 *
 * The `compound` flag is per-tax, so a single set of taxes can mix tax-on-tax
 * and on-base behaviour.
 */
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

const calculateTaxes = (base, taxes = []) => {
  const safeBase = Number(base) || 0;
  const active = (Array.isArray(taxes) ? taxes : [])
    .filter((t) => t && t.active !== false)
    .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));

  let running = safeBase;
  let totalTax = 0;

  const lines = active.map((tax) => {
    const taxableBase = tax.compound ? running : safeBase;
    const amount =
      tax.type === "flat"
        ? round2(tax.amount)
        : round2(taxableBase * ((Number(tax.rate) || 0) / 100));
    running = round2(running + amount);
    totalTax = round2(totalTax + amount);
    return {
      id: tax.id || (tax._id ? String(tax._id) : null),
      name: tax.name,
      type: tax.type || "percentage",
      rate: Number(tax.rate) || 0,
      compound: Boolean(tax.compound),
      taxableBase: round2(taxableBase),
      amount,
    };
  });

  return {
    base: round2(safeBase),
    lines,
    totalTax: round2(totalTax),
    total: round2(safeBase + totalTax),
  };
};

module.exports = { calculateTaxes };
