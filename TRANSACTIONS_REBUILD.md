# Transactions Rebuild

## What Changed

- Rebuilt the Transactions page as an enterprise ledger cockpit with a sticky command header, saved views, density controls, column visibility, bulk action toolbar, AI inspector, and responsive dark/light UI.
- Reworked the responsive model so the desktop ledger uses a bounded virtual table while laptop/tablet/mobile layouts collapse into cards and stacked panels without body-level horizontal overflow.
- Added accountant-focused controls for date filtering, source-field inspection, quick status/category edits, reconciliation actions, bulk delete, and source workbook metadata.
- Replaced the basic table experience with a virtualized transaction grid, sticky headers, frozen lead columns, infinite loading, sort controls, contextual row actions, selection, bulk updates, and CSV export for the current or selected view.
- Reworked imports into an import studio with drag and drop, Web Worker parsing, chunked upload to background import jobs, SSE progress updates, cancellation, retry-ready failed chunk tracking, and a live timeline.
- Added frontend AI accounting cues for duplicate detection, suspicious high-value transactions, uncategorized rows, suggested categories, cashflow trend cards, and transaction preview.
- Hardened backend transaction metadata with import job identifiers, duplicate hashes, tags, broader workflow statuses, and query indexes for large filtered ledgers.

## Architecture

The page is intentionally split into product-level modules inside `TransactionsPage.jsx`:

- `UploadStudio` owns import UX and live progress display.
- `TransactionGrid` owns virtualization, frozen columns, sorting, selection, row actions, and infinite scroll.
- `InsightsRail` owns AI accounting signals and transaction inspection.
- `CommandPalette` owns keyboard-driven operations.
- `DetailsPanel` exposes normalized accounting fields plus raw imported fields so uploaded CSV/XLSX columns are not hidden during review.

The import path is non-blocking:

1. Browser creates an import job with `POST /api/transactions/import-jobs`.
2. A Web Worker parses CSV/XLSX data away from the main thread.
3. Parsed rows are sent as chunks to `POST /api/transactions/import-jobs/:jobId/chunks`.
4. The backend processes chunks asynchronously in batches.
5. The browser listens to `GET /api/transactions/import-jobs/:jobId/stream` for live progress.
6. The job is finalized after all chunks are acknowledged.

## Performance Decisions

- Virtual rows keep the DOM small even when many pages are loaded.
- Server pagination keeps initial payloads bounded.
- XLSX parsing is isolated in a worker chunk so large workbooks do not freeze React rendering.
- Transaction queries now support indexed sort/filter combinations by user, date, status, type, category, duplicate hash, and import job.
- The Transactions page remains lazy-loaded from the router.

## Next Scale Step

For true multi-million-row SaaS usage, replace the in-memory import job map with Redis/BullMQ or a managed queue, persist import job records in MongoDB, add cursor pagination, and move duplicate/anomaly detection into an offline worker pipeline.
