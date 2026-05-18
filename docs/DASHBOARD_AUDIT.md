# Dashboard Design Audit — Executive Cleanup

Date: 2026-05-15

Summary
-------
This audit inspects the current Dashboard UI and implements a targeted cleanup to restore a premium, executive-focused layout: stronger hierarchy, consistent spacing, less visual noise, and clearer information prioritization.

Key findings
------------
- Inconsistent spacing: padding and margins vary across KPI cards and sections.
- Overcrowding: several widgets are placed without adequate breathing room.
- Weak visual hierarchy: all cards use similar weight, so nothing reads as primary.
- Oversized vs compressed components: some cards have excessive padding while table areas look cramped.
- Repeated styling: same generic card used across modules causing visual monotony.
- Layout rhythm broken: the grid lacks consistent column/row sizing and alignment.
- Visual noise: strong borders and multiple gradients compete for attention.
- Typography scale: headings and KPI numbers lack consistent scale and weight.

Recommendations
---------------
1. Adopt a 12-column grid with clear breakpoints for spacing and widget sizes.
2. Rebalance KPI area into a primary focus tile + secondary tiles to create a clear focal point.
3. Normalize spacing scale (S/M/L/XL): 8px, 16px, 24px, 40px; use these in `moduleThemes`.
4. Reduce visual noise: remove heavy borders, simplify gradients, increase contrast on primary elements only.
5. Introduce module-specific components (executive KPI, alerts, quick insights) with distinct visual language.
6. Enforce typography scale for headers, subheaders, KPI numbers, meta text.
7. Add spacing utilities to `moduleThemes` to ensure consistent paddings/margins.

Planned implementation in code
----------------------------
- Update `frontend/src/styles/moduleThemes.js` with refined tokens for Dashboard.
- Replace existing KPI row with a primary KPI tile and three secondary KPI tiles.
- Create `KPITile` visual refinements to reduce heavy chrome and use tasteful accent lines.
- Add `AlertsWidget` to surface top-priority alerts (overdue approvals, large transactions, sync issues).
- Rework `DashboardLayout` to use a two-tier composition: KPI band, then main content grid (analytics + side widgets).

Follow-ups
----------
- Convert tokens into Tailwind variables for global enforcement.
- Audit other pages (Transactions, AI Charts) to ensure module differentiation follows the same spacing scale.
- Add visual regression snapshots and QA checklist for future feature additions.

