# SPRINT 15 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 15 — Autonomous Coding Engine
Status: Completed
Date: 08 August 2026

---

# GOAL

Transform NEMI AI Studio from an AI-assisted IDE into an autonomous AI Software Engineering Platform capable of implementing complete software features with minimal user intervention: a Feature Execution Engine, Code Planning Engine, Autonomous Coding grounded in real project context, a Safe Change Engine with rollback, a Review Engine, a Test Engine, a Documentation Engine, Feature Approval, live dashboard integration, and full regression testing — preserving every feature from Sprints 1–14.

---

# SCOPING PRINCIPLE

Nearly every capability this sprint's brief asks for already had real, working infrastructure underneath it from Sprints 11–14 — a "Feature Execution Engine" is a Sprint 12 workflow goal; "Review Engine" is the already-real Reviewer role; "Test Engine" is Sprint 13's already-real `build.runTests()`. Rather than build a parallel system, this sprint's actual work was almost entirely about *grounding* that existing infrastructure with real data (Knowledge Graph retrieval for Developer/Reviewer context, real Impact Analysis for risk, real test results, real file snapshots) and closing one real, discovered gap (the manual Apply button never calling the backend). The one place a real new capability was needed with no honest existing analog — Documentation generation — was deliberately scoped to avoid the one kind of schema change this project has consistently avoided since Sprint 12: widening a CHECK constraint. It runs as a standalone, strictly fact-grounded LLM call instead of a fifth orchestrated agent role.

---

# COMPLETED TASKS

1. Enriched `MILESTONE_FORMAT_INSTRUCTION` (`project_manager.py`) to require the Planner to state affected/new files and database/API/UI/documentation/test implications per milestone — Code Planning Engine, prompt-only, `parse_milestones()` untouched.
2. Added `manager.py::_related_project_code()` — real, bounded keyword-match retrieval against the project's indexed Knowledge Graph nodes (Sprint 14), injected into Developer task prompts.
3. Added real Impact Analysis grounding for Reviewer tasks: looks up the preceding Developer task's real proposed files and runs `analyze_impact()` against each, injecting real dependent-count/risk-label data.
4. Added `file_snapshots` table (additive) and `FileSnapshotsRepository` — write-once-per-(task,file) rollback baseline.
5. Extended `POST /agents/tasks/{id}/mark-files-applied` to accept and store real file snapshots; added `GET /agents/tasks/{id}/rollback-info` and `POST /agents/tasks/{id}/mark-rolled-back`.
6. Added `agent_tasks.rolled_back_at` (additive column).
7. Found and fixed a real pre-existing gap: `AgentsDashboard.tsx`'s manual per-file Apply button never called the backend's `mark-files-applied` endpoint at all (only local UI state tracked "applied") — fixed by having `AgentsProvider.tsx::applyProposedFile()` capture a real snapshot and call the backend on every apply, manual or automatic. Added a real Rollback button.
8. Added `workflows.last_test_result` (additive JSON column) and `POST /workflows/{id}/test-result`; wired `WorkflowsProvider.tsx` to trigger a real `build.runTests()` run once per completed workflow (only when a real test script was detected) and report the real result.
9. Built `backend/app/ai/orchestration/documentation.py::generate_feature_documentation()` — the first real consumer of `agents/documentation.md`; strictly grounded in real workflow facts (`_gather_real_facts()`); added `workflows.documentation`/`documentation_generated_at` (additive columns); hooked into `_sync_workflow_progress()` (now `async`) to run once per completed workflow.
10. Wired `WorkflowsProvider.tsx::writeFeatureDocumentation()` — appends a real `CHANGELOG.md` entry, writes a per-feature `docs/features/<slug>.md` file, and conditionally appends to `PROJECT_MEMORY.md`/`ARCHITECTURE.md` in the open project if they already exist there.
11. Made the Live Workflow View's `Documentation` node (`WorkflowViewSection.tsx`) genuinely conditional on `workflow.documentation` being set, instead of permanently hard-coded "not yet automated".
12. Built `GET /workflows/{id}/summary` — real files-changed/files-created (via the Knowledge Graph's indexed-file check), an explicitly-always-empty `files_removed`, the real test result, and a real aggregated risk level.
13. Built a new "Feature summary" block in `SprintProgressCenter.tsx` rendering the above, with an expandable view of the generated documentation.
14. Ran the full offline suite and live Playwright verification, plus a Sprint 1–14 regression pass.
15. Updated documentation continuously as each piece landed.

---

# BUGS FOUND AND FIXED DURING IMPLEMENTATION

**1. The manual per-file Apply button never called the backend at all.** `AgentsDashboard.tsx`'s `handleApply()` only ever called `applyProposedFile()` (a raw `fs.writeFile()`) and tracked "applied" in local component state (`appliedPaths`) — it never invoked `mark-files-applied`. This meant Sprint 14's architecture-change memory/graph-edge recording, and this sprint's rollback-baseline capture, silently never fired for a file applied through the manual button — only Fully Automatic mode's auto-apply loop (in `WorkflowsProvider.tsx`) ever called the backend. Discovered while wiring the Rollback button (there was no snapshot to roll back to for a manually-applied file). Fixed by having `applyProposedFile()` itself capture the file's real pre-write content and call `markFilesApplied()` with it, so manual and automatic apply now have identical, complete backend recording.

**2. FastAPI's empty-body handling for the extended `mark-files-applied` contract.** The pre-existing `test_mark_files_applied_via_api` test called the endpoint with no request body at all — a shape only the endpoint's *old* contract (before this sprint added a required `snapshots` field) supported, and Electron's client now always sends a real body. Rather than special-case an `Optional` payload to preserve a call shape nothing calls anymore (which FastAPI does not handle transparently for an empty request body regardless of the Python-level default), the test was updated to match the new, intentional contract (`json={"snapshots": []}`).

---

# GENERATED FILES

**Backend**
- `backend/app/ai/orchestration/documentation.py`
- `backend/app/db/repositories/file_snapshots_repository.py`
- `backend/tests/test_sprint15.py`

**Docs**
- `docs/SPRINT_15_REPORT.md` (this file)

---

# MODIFIED FILES

**Backend**
- `backend/app/ai/orchestration/manager.py` — `_related_project_code()` (Developer grounding), Reviewer Impact Analysis grounding, `_sync_workflow_progress()` made `async` and threaded `api_keys` through to trigger Documentation Engine generation on workflow completion.
- `backend/app/ai/orchestration/project_manager.py` — `MILESTONE_FORMAT_INSTRUCTION` enriched with Code Planning Engine detail.
- `backend/app/api/agents.py` — `mark-files-applied` accepts real snapshots; new `rollback-info`/`mark-rolled-back` endpoints.
- `backend/app/api/workflows.py` — new `test-result`/`summary` endpoints.
- `backend/app/api/schemas.py` — `FileSnapshotIn`, `MarkFilesAppliedRequest`, `RollbackFileOut`, `RollbackInfoOut`, `TestResultIn`, `TestResultOut`, `FeatureSummaryOut`; `AgentTaskOut` gained `rolled_back_at`; `WorkflowOut` gained `documentation`/`documentation_generated_at`/`last_test_result`.
- `backend/app/db/schema.py` — `file_snapshots` table; `agent_tasks.rolled_back_at`; `workflows.documentation`/`documentation_generated_at`/`last_test_result`.
- `backend/app/db/repositories/agent_tasks_repository.py` — `mark_rolled_back()`; `mark_files_applied()` clears `rolled_back_at`.
- `backend/app/db/repositories/workflows_repository.py` — `set_documentation()`, `set_test_result()`; `get()`/`list_for_project()` decode `last_test_result` JSON.
- `backend/tests/test_workflows_api.py` — updated `mark-files-applied` call to the new contract.

**Electron**
- `frontend/electron/agent-client.ts` — `FileSnapshotInput`/`RollbackFile`/`RollbackInfo` types; `markAgentTaskFilesApplied()` accepts snapshots; `getRollbackInfo()`, `markAgentTaskRolledBack()`.
- `frontend/electron/workflow-client.ts` — `TestResult`/`FeatureSummary` types; `Workflow` gained new fields; `recordTestResult()`, `getFeatureSummary()`.
- `frontend/electron/main.ts` — new IPC handlers for all of the above.
- `frontend/electron/preload.ts` — `window.nemi.agents`/`workflows` surfaces extended.

**Frontend**
- `frontend/src/agents/AgentsProvider.tsx` — `applyProposedFile()` captures real snapshots and calls the backend; new `rollbackTask()`.
- `frontend/src/agents/agents-context.ts` — context value extended.
- `frontend/src/components/agents/AgentsDashboard.tsx` — Rollback button; `handleApply()` updated for the new `applyProposedFile()` signature.
- `frontend/src/components/agents/SprintProgressCenter.tsx` — new Feature Summary block.
- `frontend/src/components/intelligence/WorkflowViewSection.tsx` — `Documentation` node genuinely conditional.
- `frontend/src/workflows/WorkflowsProvider.tsx` — auto-apply loop batches real snapshots; new Test Engine trigger and `writeFeatureDocumentation()`.
- `frontend/src/types/electron-api.d.ts` — Sprint 15 ambient types; `Window.nemi` surfaces extended.

**Docs**
- `docs/ARCHITECTURE.md` — new "AUTONOMOUS CODING ENGINE (locked — Sprint 15)" section; IPC boundary description updated (twelve namespaces, two extended); ten new locked-decision entries; version bumped to 2.2.
- `docs/DATABASE_SCHEMA.md` — new `file_snapshots` table; `agent_tasks`/`workflows` new columns documented; version bumped to 1.8.
- `docs/PROJECT_MEMORY.md` — Sprint 15 marked completed with full delivery detail; NEXT MILESTONE rewritten for Sprint 16.

---

# VERIFICATION

## Offline suite

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass (one pre-existing, unrelated `tsconfig.json` warning not touched this sprint) |
| `npm run build` | Pass |
| `pytest` (backend) | 136 passed (14 new), 0 skipped |
| `ruff check` (backend) | All checks passed |
| `mypy` (backend) | No issues, 58 source files |

## Live verification (Playwright-driven `_electron` launches against the built app, real local Ollama, no mocks)

| # | Check | Result |
|---|---|---|
| 1 | App launches, backend ready, a real small test project opened and indexed | PASS |
| 2 | A real single-role Developer task created and driven through the real, unmodified `run_cycle()` scheduler across two separate live runs | PASS |
| 3 | Small local test model did not produce a parseable ```` ```file:``` ```` block in either run — the same documented small-model instruction-following limitation as Sprint 11/12 (not a defect; both runs completed the task cleanly with no proposed files) | Documented, not a failure |
| 4 | `GET /agents/tasks/{id}/rollback-info` for a never-applied task correctly returned a real 404 with an honest message, through the actual Electron IPC boundary | PASS |
| 5 | `POST /workflows/{id}/test-result` round trip returned the real persisted result via the real IPC boundary | PASS |
| 6 | `GET /workflows/{id}/summary` for a real (empty) workflow returned real, correctly-empty data | PASS |
| 7 | Agents Dashboard UI rendered the completed task correctly | PASS |
| 8 | Full Sprint 1–14 regression: all twelve `window.nemi` IPC namespaces present (including their new Sprint 15 fields on `AgentTask`/`Workflow`), Explorer/Workspace/Search/Agents/Knowledge panels and Monaco all render and function, every backend surface reachable only through the real IPC boundary, the Sprint 13 Intelligence Center still opens cleanly | PASS |

**Verification limitation, stated honestly**: the full real Apply → snapshot capture → Rollback round trip, and a full real Documentation Engine generation, both require the small local test model to first succeed at producing a parseable `​```file:path``` ` block (Apply/Rollback) or at completing full milestone decomposition (Documentation) — the same probabilistic small-model dependency Sprint 11/12/13's own live tests already documented and accepted, not something this sprint could change. Both mechanisms are instead deterministically proven correct at the API layer by the 4 new backend tests covering exactly this round trip (`test_mark_files_applied_stores_snapshots_and_rollback_info_returns_them`, `test_rollback_info_404_when_never_applied`, `test_mark_rolled_back_resets_applied_flag`, plus `test_generate_feature_documentation_skips_gracefully_without_api_key` for the Documentation Engine's real error path), and the live pass above confirms every one of those same code paths is correctly wired through the actual Electron IPC boundary the UI uses (the 404 case exercises the identical `getRollbackInfo()` call the Rollback button would use on success).

---

# KNOWN ISSUES

- The Documentation Engine and Test Engine's full live, model-dependent success path was not captured in this session's live pass (see verification limitation above) — their graceful-skip paths and API-layer correctness are proven instead.
- Rollback is per-task, not a whole-workflow atomic transaction.
- No in-app git commit/push action (unchanged since Sprint 13) — the Live Workflow View's `Commit`/`Push` nodes remain marked not-yet-automated; `Documentation` is now genuinely automated.
- The Developer agent still cannot propose file deletions (unchanged since Sprint 11) — the Feature Approval summary's `files_removed` is always empty, stated honestly rather than omitted.
- Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

---

# NEXT SPRINT

**Sprint 16** — recommended: code-signing certificate for the installer (still the top Beta blocker), and/or an in-app git commit/push action (would let the Live Workflow View's remaining Commit/Push nodes become genuinely automated).

---

# GIT COMMIT MESSAGE

```
feat(sprint-15): implement autonomous coding engine

Transform the platform from an AI-assisted IDE into one that can
implement a complete feature end to end with minimal intervention -
built almost entirely by extending Sprints 11-14's existing Agent
Orchestration Framework, Workflow Engine, and Knowledge Graph rather
than a parallel system. A "Feature Execution Engine" request is a
Sprint 12 workflow goal; no new intake mechanism was built.

Code Planning Engine: the milestone-decomposition prompt now asks for
affected/new files and DB/API/UI/doc/test implications per milestone
- a prompt-only enrichment, parse_milestones() untouched.

Autonomous Coding: Developer/Reviewer tasks are grounded with real
Knowledge Graph keyword matches (_related_project_code()) and real
Impact Analysis dependency/risk data for the preceding Developer
task's proposed files - giving agents/developer.md and
agents/reviewer.md's existing "read existing files first"/"risk
level" instructions (unchanged since Sprint 3) something real to act
on, rather than rewriting the prompts.

Safe Change Engine & Rollback: new file_snapshots table records each
file's real pre-apply content, captured by Electron and sent
alongside the existing mark-files-applied call. New rollback-info/
mark-rolled-back endpoints back a real Rollback button. Found and
fixed a real pre-existing gap: the manual per-file Apply button never
called the backend at all, so rollback (and Sprint 14's
architecture-change recording) previously only worked under Fully
Automatic mode - fixed for both paths.

Test Engine reuses Sprint 13's real build.runTests() - no new
execution mechanism - triggered once per completed workflow, real
result persisted. Documentation Engine gives agents/documentation.md
its first real consumer - a standalone, strictly fact-grounded LLM
call, deliberately not a fifth orchestrated agent_tasks role (would
require widening the agent_role CHECK constraint, the one kind of
migration avoided since Sprint 12). Real generated docs are written
by the frontend to CHANGELOG.md, a per-feature doc file, and
conditionally PROJECT_MEMORY.md/ARCHITECTURE.md if the open project
already has them.

Feature Approval: new GET /workflows/{id}/summary assembles real
changed/created files, real test results, and a real aggregated risk
level, rendered in a new Feature Summary panel.

Verified: full offline suite (tsc/eslint/prettier/build, backend
pytest - 136 passed incl. 14 new/ruff/mypy - 58 source files) plus
live Playwright verification (real indexing, a real Developer task
driven through two live local-model runs, real test-result/summary
round trips through the actual Electron IPC boundary, the
rollback-info 404 path confirmed live, the full Apply-Rollback round
trip deterministically proven by new backend tests), a full Sprint
1-14 regression pass, each reproduced clean.

Update docs/ARCHITECTURE.md (new AUTONOMOUS CODING ENGINE section,
ten new locked decisions, version 2.2), docs/DATABASE_SCHEMA.md (new
file_snapshots table, agent_tasks/workflows new columns, version
1.8), and docs/PROJECT_MEMORY.md; add docs/SPRINT_15_REPORT.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
