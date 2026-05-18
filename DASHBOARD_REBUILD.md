# Dashboard Rebuild

## What Changed

- Replaced the old landing-style Home page with an executive AI finance workspace.
- Added a dedicated `GET /api/dashboard/overview` endpoint for one-call dashboard hydration.
- Added KPI cards for revenue, expenses, net profit, cash flow, growth, margins, burn rate, tax reserve, budget usage, payroll, subscriptions, bank balance, and review queues.
- Added analytics widgets for monthly trends, category breakdowns, transaction density, top vendors, recent ledger activity, risk queues, and close workflow tasks.
- Added AI finance insight cards, suspicious transaction alerts, duplicate detection signals, tax reserve guidance, and natural-language chart generation.
- Added power-user UX: command palette, dark/light mode, reorderable dashboard sections, responsive sticky header, empty states, and loading skeletons.

## Backend Architecture

- `backend/controllers/dashboardController.js` builds the dashboard payload from MongoDB or the local degraded transaction store.
- `backend/routes/dashboardRoutes.js` exposes authenticated dashboard APIs.
- `backend/server.js` mounts the new route at `/api/dashboard`.
- The endpoint returns pre-aggregated analytics so the frontend avoids multiple expensive calls during initial render.

## Performance Notes

- The page hydrates from a single dashboard API call.
- KPI sparklines use lightweight CSS bars instead of chart components.
- Larger chart panels use Recharts only where visual analytics are useful.
- Layout uses bounded responsive grids and no body-level horizontal overflow.

## Next Scale Step

For very large ledgers, move dashboard aggregation into materialized monthly summary collections, refresh them in background jobs after imports, and stream dashboard changes with SSE.
