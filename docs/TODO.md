# TODO

Placeholder for `LOC_SaaS_Build_Todo_v1.1.md`.

Populate this file when the source todo list is provided or copied in.

## Year 1 Backlog
- [ ] Build dedicated club tracking API routes if needed — club data (badr_club, century_club, fath_club) is written via merit logging thresholds but has no dedicated read API yet
- [ ] Port behaviour ingestion feature — requires new migrations for behaviour_uploads, behaviour_events, student_behaviour_insights, student_behaviour_patterns tables (LOC migration 026_behaviour_event_storage.sql) plus behaviourAnalyzer.ts, behaviourInsights.ts services, and behaviour/upload API route

- [ ] Build Level C cases UI and API (portal pages + API routes) — table exists in schema, feature was never implemented in LOC reference
- [ ] Build reentry protocols UI and API — table exists in schema, feature was never implemented in LOC reference

## Phase 4

- [ ] Port intervention threshold configuration (Step10_Thresholds, provisionThresholds.ts) from LOC wizard to apps/admin — this configures Level B→C triggers and auto-alert-dean settings per school
