# Plan: Add wizard onboarding flow with data reference drawer

**Status:** Completed
**Date:** 2026-04-18

## Context

The application previously used a fixed 288px sidebar to display three distinct panels: the ETL pipeline status cards, a Parquet data preview, and a schema browser. This layout had several UX problems. The pipeline visualization was purely status-based (colored circles with checkmarks) — users never saw their actual data or understood what each step did. The "Parquet Preview" and "Tables" panels showed nearly identical information under confusing names, and both were too narrow to display tabular data effectively. New users were dropped straight into a chat interface with no understanding of what data was available or how it got there.

## Approach

Replace the sidebar-centric layout with a two-phase experience: a 4-step wizard that guides users through the data pipeline, followed by a full-screen chat interface with an on-demand data reference drawer. The wizard runs on every visit (no persistence) since the ETL pipeline needs to execute each time. Rather than building entirely new components, the existing `ETLPipelineView` is reused inside the wizard, and the schema/preview rendering logic is extracted into a shared `DataReferencePanel` that serves both the wizard step and the post-wizard drawer.

The "Parquet Preview" and "Schema" panels are merged into a single "Data Reference" concept — one panel with tabs per table, showing column types, enum values, and sample data rows together.

## Changes

### Backend: Excel Preview Endpoint
- Added `GET /api/etl/excel-preview/{table}` to `backend/app/routers/etl.py`. This reads the raw Excel source file and returns the first 20 rows as JSON, enabling Step 1 of the wizard to show users what the input data looks like before any transformation.

### Frontend: Wizard Store
- Created `frontend/stores/wizardStore.ts` — a Zustand store with no persistence. Tracks `currentStep` (1-4, 5=done), `etlCompleted` (gates step 2→3 navigation), and `drawerOpen` for the post-wizard data reference drawer.

### Frontend: API Layer
- Added `excelPreview` endpoint to `frontend/lib/constants.ts` and `fetchExcelPreview()` to `frontend/lib/api.ts`.

### Frontend: Wizard Components
- `WizardStepper` — horizontal step indicator bar showing 4 steps with active/completed states.
- `WizardNavigation` — bottom bar with Back/Next buttons. Next is disabled on step 2 until ETL completes; step 4's button says "Start Querying" and transitions to chat.
- `StepExcelPreview` — Step 1: fetches and displays raw Excel data with tab switching between tables.
- `StepValidateTransform` — Step 2: wraps the existing `ETLPipelineView` in a centered layout with explanatory text.
- `StepSchemaOverview` — Step 3: renders the shared `DataReferencePanel` full-screen.
- `StepStartQuerying` — Step 4: transitional "You're ready!" screen with example questions.

### Frontend: Shared Data Reference
- `DataReferencePanel` — merges what was previously `ParquetPreviewTable` and `SchemaSidebar` into one component. Shows per-table tabs with columns/types, enum values, and sample data rows.
- `DataReferenceDrawer` — right-side slide-out drawer wrapping `DataReferencePanel`, accessible from the chat header.

### Frontend: Page Layout
- `page.tsx` rewritten to conditionally render wizard (steps 1-4) or chat (step 5+). The sidebar is removed entirely.
- `QueryInterface` gets a "Data Reference" button in its header bar.

## Files Modified

| File | Change |
|------|--------|
| [backend/app/routers/etl.py](backend/app/routers/etl.py) | Added `GET /api/etl/excel-preview/{table}` endpoint |
| [frontend/lib/constants.ts](frontend/lib/constants.ts) | Added `excelPreview` endpoint config |
| [frontend/lib/api.ts](frontend/lib/api.ts) | Added `fetchExcelPreview()` function |
| [frontend/stores/wizardStore.ts](frontend/stores/wizardStore.ts) | New Zustand store for wizard state |
| [frontend/app/components/data/DataReferencePanel.tsx](frontend/app/components/data/DataReferencePanel.tsx) | New merged schema + preview component |
| [frontend/app/components/wizard/WizardStepper.tsx](frontend/app/components/wizard/WizardStepper.tsx) | New step indicator bar |
| [frontend/app/components/wizard/WizardNavigation.tsx](frontend/app/components/wizard/WizardNavigation.tsx) | New Back/Next navigation |
| [frontend/app/components/wizard/StepExcelPreview.tsx](frontend/app/components/wizard/StepExcelPreview.tsx) | New Step 1: Excel data preview |
| [frontend/app/components/wizard/StepValidateTransform.tsx](frontend/app/components/wizard/StepValidateTransform.tsx) | New Step 2: wraps ETLPipelineView |
| [frontend/app/components/wizard/StepSchemaOverview.tsx](frontend/app/components/wizard/StepSchemaOverview.tsx) | New Step 3: schema overview |
| [frontend/app/components/wizard/StepStartQuerying.tsx](frontend/app/components/wizard/StepStartQuerying.tsx) | New Step 4: transition screen |
| [frontend/app/components/DataReferenceDrawer.tsx](frontend/app/components/DataReferenceDrawer.tsx) | New slide-out drawer |
| [frontend/app/components/QueryInterface.tsx](frontend/app/components/QueryInterface.tsx) | Added "Data Reference" button to header |
| [frontend/app/page.tsx](frontend/app/page.tsx) | Rewritten: wizard/chat conditional layout |

## Guard Rails

| Scenario | Behavior |
|----------|----------|
| User navigates to step 3 before running ETL | Next button on step 2 is disabled until `etlCompleted` is true — cannot skip ETL |
| User refreshes mid-wizard | Wizard store has no persistence, so it resets to step 1 — matches "always show wizard" requirement |
| Backend is down when wizard loads | Step 1 shows error message from failed fetch; health check runs on mount to wake cold-start backends |
| Parquet files don't exist yet (step 3) | `fetchParquetPreview` failures are caught silently; schema still loads; sample data section is omitted |
| Drawer opened during active query | Drawer overlays at z-50 with backdrop; chat continues streaming underneath |

## Verification

1. Start backend: `cd backend && uv run uvicorn app.main:app --port 7860`
2. Start frontend: `cd frontend && pnpm dev`
3. Open http://localhost:3000 — should see wizard step 1 with Excel data preview
4. Switch between table tabs — both tables should load
5. Click Next → step 2 shows pipeline. Click "Run ETL", verify Next enables after completion
6. Click Next → step 3 shows merged schema with columns, types, enums, and sample data
7. Click Next → step 4 shows "You're ready!" screen. Click "Start Querying"
8. Verify full-screen chat interface appears
9. Click "Data Reference" button in header → drawer slides in from right
10. Click backdrop or X to close drawer
11. Submit a query → verify chat still works as before
12. Refresh page → wizard should restart from step 1

## Breaking Changes

- The sidebar layout is removed. The left sidebar with ETL pipeline, Parquet preview, and Schema browser no longer exists. These are replaced by the wizard flow and the data reference drawer.
- `ParquetPreviewTable` and `SchemaSidebar` components are no longer imported by `page.tsx` (they still exist as files but are unused by the main layout).
