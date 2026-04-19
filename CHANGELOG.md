# Changelog

All notable changes to this project will be documented in this file.

## [v1.2.0] - 2026-04-19

### Added
- Accuracy test mode in chat UI — toggle "精度テスト" tab to run 10 ground-truth questions through the real agent pipeline with per-question ✓/✗ scoring and an end-of-run summary bubble
- 10-case fixture (`backend/app/data/evaluation/test_queries.json`) split into `general` and `exception` categories
- Evaluator module (`app.data.evaluation.evaluator`) with dual scoring: result-equivalence against reference SQL plus rag-demo-style term presence — a case passes if either check succeeds
- `GET /api/evaluate/stream` SSE endpoint that forwards every agent event verbatim and emits `eval_query_start` / `eval_query_scored` / `eval_complete` markers
- `GET /api/evaluate/queries` for previewing the test question list
- 19 new pytest cases covering result equivalence, term presence, and combined scoring

## [v1.1.1] - 2026-04-19

### Changed
- All wizard, chat header, and ETL pipeline UI strings translated to Japanese
- Step labels: データ確認 / 検証と変換 / スキーマ / クエリ開始
- ETL button states (ETL実行 / ETL実行中… / ETL再実行) and status messages
- Data reference panel section headings (列, カテゴリ値, サンプルデータ)
- Technical/product names (Excel, Parquet, DuckDB, SQL) intentionally kept in English

## [v1.1.0] - 2026-04-18

### Added
- Wizard onboarding flow — 4-step guided experience (Excel preview, Validate & Transform, Schema overview, Start Querying) replaces the sidebar layout
- Excel preview endpoint (`GET /api/etl/excel-preview/{table}`) to show raw source data before ETL
- Data Reference drawer — slide-out panel accessible from chat header, merging schema and sample data into one view
- `wizardStore` (Zustand, no persistence) for wizard state management
- `DataReferencePanel` shared component used by both wizard Step 3 and the drawer

### Changed
- `page.tsx` rewritten to conditionally render wizard or full-screen chat
- `QueryInterface` header now includes a "Data Reference" button
- README test count updated from 19 to 36

### Removed
- Sidebar layout (ETL pipeline, Parquet preview, and Schema browser panels previously shown in a 288px left sidebar)

## [v1.0.0] - 2025-07-12

### Added
- Initial release: Text-to-SQL agent over Japanese financial data
- Full-stack UI with live SSE pipeline visualization
- ETL pipeline (Excel → Parquet → DuckDB) with column/type validation
- Gemini and Ollama LLM backend support
- SQL self-correction with retry logic and few-shot examples
- Maya animated avatar for agent responses
- Frontend test suite (34 tests) and backend test suite (36 tests)
- CI/CD deployment to HuggingFace Spaces (backend) and Vercel (frontend)
