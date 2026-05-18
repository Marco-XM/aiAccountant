# AI Charts Architecture — Overview

This document describes a production-grade backend architecture for the AI Charts workspace.

## Components

- API Gateway (Express) — auth, rate limiting, routing.
- Job Queue / Worker pool — async job processing for chart generation (Redis/ BullMQ recommended).
- Analytics Engine — aggregation utilities (monthly series, categories, vendors, heatmaps, kpis).
- AI Orchestrator — handles prompt parsing, chart specification generation, and insight polishing (Groq / OpenAI / Vertex AI integration points).
- Cache Layer — Redis for intermediate aggregation results and chart templates.
- Persistence — MongoDB for transactions and saved reports; local store for degraded-mode.
- Reconciler — migrates local-store items into MongoDB when DB recovers.
- SSE / WebSockets — real-time job progress streaming to clients.

## API surface (initial)

- POST /api/ai-charts/jobs — create async chart job (payload: query, filters, datasetId/fileMeta)
- GET /api/ai-charts/jobs/:jobId — job status & result
- GET /api/ai-charts/jobs/:jobId/stream — SSE for job progress
- POST /api/ai-charts/generate — synchronous quick-generation (fallback) [deprecated for heavy jobs]
- GET /api/ai-charts/workspace — initial workspace payload (profile, kpis, suggested charts)
- GET /api/ai-charts/reports — list saved reports
- POST /api/ai-charts/reports — save report
- DELETE /api/ai-charts/reports/:id — delete report
- POST /api/ai-charts/admin/reconcile — admin trigger for reconciler

## Job lifecycle

1. Client creates job (persist job to Redis or Mongo collection).
2. Job queue worker picks up job and streams progress events.
3. Worker analyzes dataset (schema profile), runs aggregations, and calls AI for suggestions.
4. Worker composes chart payloads and saves a snapshot in cache and DB.
5. Worker emits final event with `chartPayload`, `kpis`, `profile`, `insights`.
6. Client requests job result or receives SSE final message.

## Scaling notes

- Use Redis + BullMQ for horizontal worker scaling and retries.
- Use Redis for caching heavy aggregation results keyed by `userId:profileHash`.
- Offload long AI calls to dedicated AI worker processes.
- Ensure idempotency via `jobId` and `upsert` semantics when writing to MongoDB.

## Security

- Authenticate all endpoints with JWT (existing `auth.mw`).
- Admin endpoints require RBAC check (not implemented here; mark TODO).
- Rate-limit AI endpoints and use request quota for expensive AI calls.

## Next steps

- Implement Redis-backed queue and worker processes (BullMQ).
- Add a lightweight in-memory jobQueue for local dev and scaffold SSE.
- Wire frontend to enqueue jobs and stream SSE progress.

