# Plan: Translate wizard UI to Japanese

**Status:** Completed
**Date:** 2026-04-19

## Context

The v1.1.0 release introduced a 4-step onboarding wizard, but most of the new UI strings landed in English (step labels, buttons, headings, status messages). Since the underlying data and example queries are Japanese, mixing English chrome with Japanese content created a jarring experience. This release translates all user-facing strings in the wizard, chat header, and ETL pipeline view to Japanese, while keeping technical/product names (Excel, Parquet, DuckDB, SQL) untranslated.

## Approach

Translate text in place where it's defined — no new i18n framework, no JSON message catalogs. The app is single-language (Japanese), so introducing infrastructure for locale switching would be premature. Strings already centralized in `lib/constants.ts` were updated there; component-local strings were translated directly in their JSX. Error messages emitted from `dispatch({ type: "error", message: "..." })` were translated at the dispatch site so they stay in sync with display.

## Changes

### Constants
- `appSubtitle`, `inputPlaceholder`, `networkError`, `sendButton`, `clearButton`, `welcomeMessage`, `welcomeDescription` translated. `appTitle` ("Agentic SQL Demo") kept in English as a product name.

### Wizard
- `WizardStepper` step labels: データ確認 / 検証と変換 / スキーマ / クエリ開始
- `WizardNavigation` buttons and counter: 戻る / ステップ X / 4 / 次へ / クエリ開始
- `StepExcelPreview` heading and description: ソースデータ + Japanese explanation
- `StepValidateTransform` heading, description, and completion message
- `StepSchemaOverview` heading and description
- `StepStartQuerying` heading, description, "質問例" label, and CTA button

### ETL pipeline view
- Stage label `Validate` → `検証`
- Run button states: ETL実行 / ETL再実行 / ETL実行中…
- Status messages: ETL完了 / ETL失敗 messages
- Excel, Parquet, DuckDB stage names kept (product/format names)

### Data reference
- `DataReferencePanel` section headings: 列 / カテゴリ値 / サンプルデータ（N行）
- `DataReferenceDrawer` title: データリファレンス
- Error message string translated at dispatch site

### Chat
- `QueryInterface` header: 処理中… / N 件のクエリ / データリファレンス button label

## Files Modified

| File | Change |
|------|--------|
| `frontend/lib/constants.ts` | Translated UI_TEXT entries |
| `frontend/app/components/wizard/WizardStepper.tsx` | Step labels |
| `frontend/app/components/wizard/WizardNavigation.tsx` | Back/Next/counter |
| `frontend/app/components/wizard/StepExcelPreview.tsx` | Heading, description, error message |
| `frontend/app/components/wizard/StepValidateTransform.tsx` | Heading, description, completion message |
| `frontend/app/components/wizard/StepSchemaOverview.tsx` | Heading, description |
| `frontend/app/components/wizard/StepStartQuerying.tsx` | Heading, description, label, button |
| `frontend/app/components/etl/ETLPipelineView.tsx` | Stage label, button states, status messages |
| `frontend/app/components/data/DataReferencePanel.tsx` | Section headings, error message |
| `frontend/app/components/DataReferenceDrawer.tsx` | Drawer title |
| `frontend/app/components/QueryInterface.tsx` | Loading / count / drawer button labels |

## Guard Rails

| Scenario | Behavior |
|----------|----------|
| Backend returns an error during Excel preview fetch | Component dispatches a Japanese error message, not the raw exception |
| Long Japanese strings in narrow buttons | Button containers already use `whitespace-nowrap` where width is constrained; long-form prose lives in unconstrained `<p>` tags |
| Future locale switching | Strings are scattered across components rather than centralized in a catalog. If multi-language support is later needed, this becomes a refactor task — but it's intentionally deferred |

## Verification

1. Start backend: `cd backend && uv run uvicorn app.main:app --port 7860`
2. Start frontend: `cd frontend && pnpm dev`
3. Open http://localhost:3000 — wizard step indicators should read データ確認 / 検証と変換 / スキーマ / クエリ開始
4. Confirm "戻る" / "次へ" / "ステップ 1 / 4" on the bottom nav
5. Step 2: ETL button reads "ETL実行" → "ETL実行中…" → "ETL再実行"; completion banner reads "ETL完了 — DuckDBにデータを読み込みました"
6. Step 3: Section headings show 列, カテゴリ値, サンプルデータ（N行）
7. Step 4: "準備完了！" with 質問例 list and "クエリ開始" button
8. Chat header: drawer button reads "データリファレンス"; query count reads "N 件のクエリ"

## Breaking Changes

None. UI text only.
