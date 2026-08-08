# SPRINT 11 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 11 — Agent Orchestration Framework
Status: Completed
Date: 08 August 2026

---

# GOAL

Build the first production-ready version of the multi-agent orchestration framework on top of Sprint 10's provider/context foundation: a Planner Agent, Developer Agent, Reviewer Agent, Tester Agent, an Agent Manager, Agent Memory, an Agent Task Queue, an Agent Status Dashboard, agent-to-agent communication, parallel execution where safe, automatic retries, failure recovery, conversation and execution history, and a provider-independent architecture (OpenAI, Claude, Gemini, Ollama) — integrated with the existing AI Chat Panel, Workspace, Monaco Editor, Project Manager, and Backend — while preserving all Sprint 1–10 functionality, verified with full regression testing.

---

# COMPLETED TASKS

1. Built `backend/app/ai/agent_roles.py` — parses `agents/*.md` into system prompts. Only four roles (`ORCHESTRATED_ROLES = planner, developer, reviewer, tester`) participate in the automated task queue; the rest stay reference documents. NEMI-self-referential text in the role files ("NEMI AI STUDIO", "this project's own codebase") is rewritten to refer to the user's project instead, since an orchestrated agent works on the user's code, not NEMI's own.
2. Extended `backend/app/db/schema.py` with a new `agent_tasks` table (dependency-gated pipeline scheduling — see docs/DATABASE_SCHEMA.md) and two new nullable columns on `ai_conversations` (`agent_id`, `task_id`, via the existing idempotent `_add_column_if_missing()` migration helper).
3. Built `AgentsRepository` (seeds the `agents` table from role files at startup), `AgentTasksRepository` (full CRUD plus the scheduling queries — `list_runnable()`, `mark_failed_or_retry()`, `cascade_cancel_dependents()`, `retry()`), and `MemoryRepository` — the schema-ready-since-Sprint-4 `memory` table's first real implementation, used for durable agent-to-agent handoff (`type='task'`, `key=<completed task id>`, surviving a backend restart mid-pipeline).
4. Built `backend/app/ai/orchestration/manager.py` — the Agent Manager. `run_cycle(settings, api_keys)` is a single stateless async function, not a loop: one scheduling pass per call, no server-side API keys held between calls, preserving Sprint 10's locked "keys never persisted server-side" decision. Executes up to `MAX_CONCURRENT_TASKS = 3` runnable tasks in parallel via `asyncio.gather`. Calls Sprint 10's existing `AIProvider` abstraction directly (`get_provider(task["provider"]).stream_chat(...)`) — provider-independent by construction, not a second abstraction layer.
5. Implemented the Developer Agent's human-gated file-proposal flow: `_extract_proposed_files()` parses fenced ` ```file:relative/path\n<content>\n``` ` blocks from the Developer stage's output into `proposed_files` — parsed only, never written to disk server-side. Applying a file is a distinct, explicit user action, a direct reading of `agents/developer.md`'s own "never delete files without approval" rule extended to creation/modification.
6. Built `backend/app/api/agents.py` — `GET /agents`, `GET/POST /agents/tasks`, `GET /agents/tasks/{id}`, `POST /agents/tasks/{id}/cancel`, `POST /agents/tasks/{id}/retry`, `POST /agents/run-cycle`.
7. Fixed a packaging gap that predates this sprint: `agents/*.md` was never bundled for a packaged (PyInstaller) build. Added a `datas` entry to `nemi-backend.spec` and resolved the directory at runtime via the same `sys.frozen` self-detection `config.py` already uses for the database/log paths (Sprint 8's precedent).
8. Built Electron's `agent-client.ts` (mirrors `ai-client.ts`'s style) and wired the full `window.nemi.agents.*` IPC surface (`main.ts`, `preload.ts`, `electron-api.d.ts`). `main.ts` runs a 4-second `setInterval` (`AGENT_RUN_CYCLE_INTERVAL_MS`) that decrypts whatever provider keys `safeStorage` currently holds and calls `POST /agents/run-cycle` — the actual scheduling cadence, mirroring StatusBar's own 5-second health-poll precedent.
9. Built `frontend/src/agents/` (Context+Provider+Hook) — `AgentsProvider.tsx` fetches the agent roster and task list, refreshes on a push event (`agents:tasks-changed`) plus a 5-second backup poll, and exposes `createPipeline`/`cancelTask`/`retryTask`/`applyProposedFile`.
10. Extracted `fetchWithStartupRetry` out of `AiProvider.tsx` into a shared `frontend/src/lib/` utility so `AgentsProvider` doesn't duplicate the same mount-time backend-startup-race retry logic Sprint 10 already solved once.
11. Built `frontend/src/components/agents/` — an Agents Dashboard sidebar panel (new `Sidebar.tsx` entry, task cards showing role icon/title/status badge, expandable detail with description/result/error, per-file Apply buttons for proposed files, Cancel/Retry actions gated by task status) and a New Task modal (title, description, provider/model selection, priority, stage checkboxes defaulting to all four stages in order).
12. Added `openConversation()` to `AiContextValue`/`AiProvider.tsx` so the Agents Dashboard can jump from a task straight into the exact conversation that did its work; added a Bot-icon badge to agent-scoped conversations in the Chat Panel's history list (`ConversationHistoryList.tsx`), driven by the new `agent_id` column.
13. Found and fixed one real bug during live verification (see below).
14. Ran the full offline suite and live Playwright verification (full pipeline, retry/cascade/parallel execution, real UI interaction, plus a full Sprint 1–10 regression pass), each reproduced clean.
15. Updated documentation continuously as each piece landed.

---

# BUG FOUND AND FIXED DURING VERIFICATION

**Backend health state latched permanently into `'error'` after a startup timeout, even when the backend later became healthy.** `backend-process.ts`'s `state` variable is set to `'error'` when `waitForHealthy(STARTUP_TIMEOUT_MS)` (15 seconds) rejects — but nothing ever polled again afterward, so if the backend process was simply *slow*, not dead, the StatusBar would show "Backend Offline" for the rest of the session even though every actual request kept working once the backend genuinely came up. Confirmed live and reproducible: a cold dev-mode start doing heavy first-import work (AI provider SDKs, and — directly caused by this sprint — the new `AgentsRepository.seed_from_role_files()` call added to backend startup, which reads and parses eight markdown files) legitimately took longer than 15 seconds on a loaded machine. `agents.list()` and other direct-fetch IPC calls still succeeded during this window (they don't gate on `state`, they just fetch), which is what first surfaced the discrepancy — `getBackendHealth()` claimed `'error'` while real requests were working. Fixed with `watchForLateRecovery()`: a background watcher started from the timeout's `catch` handler that keeps polling (only while the child process is still alive — a real crash already nulls `child` via the `'exit'` handler, which this loop's own `child` check correctly stops watching for) and flips `state` back to `'ready'` the moment the backend actually responds. Verified live across multiple runs: the state correctly transitions `starting → error → ready` when a cold start outruns the timeout, and stays on the fast `starting → ready` path when it doesn't.

---

# GENERATED FILES

**Backend**
- `backend/app/ai/agent_roles.py`
- `backend/app/ai/orchestration/__init__.py`, `manager.py`
- `backend/app/api/agents.py`
- `backend/app/db/repositories/agents_repository.py`, `agent_tasks_repository.py`, `memory_repository.py`
- `backend/tests/test_agents_api.py`, `test_memory_repository.py`

**Electron**
- `frontend/electron/agent-client.ts`
- `frontend/src/lib/fetchWithStartupRetry.ts`

**Frontend**
- `frontend/src/agents/agents-context.ts`, `AgentsProvider.tsx`, `useAgents.ts`
- `frontend/src/components/agents/AgentsDashboard.tsx`, `NewAgentTaskModal.tsx`, `roleMeta.ts`

**Docs**
- `docs/SPRINT_11_REPORT.md` (this file)

---

# MODIFIED FILES

**Backend**
- `backend/app/db/schema.py` — new `agent_tasks` table + indexes; `ai_conversations` gained `agent_id`/`task_id`.
- `backend/app/core/config.py` — `agents_dir` setting, frozen-executable path resolution.
- `backend/app/db/repositories/ai_conversations_repository.py` — `create()` accepts `agent_id`/`task_id`.
- `backend/app/db/repositories/ai_messages_repository.py` — `add_system_message()`.
- `backend/app/api/schemas.py` — `Agent*` schemas; `AiConversationOut` gained `agent_id`/`task_id`.
- `backend/app/server.py` — seeds `agents` from role files at startup; registers the `agents` router.
- `backend/nemi-backend.spec` — bundles `agents/*.md` for packaged builds.

**Electron**
- `frontend/electron/main.ts` — `agents:*` IPC handlers, the 4-second run-cycle timer.
- `frontend/electron/preload.ts` — `window.nemi.agents` surface.
- `frontend/electron/ai-client.ts` — `AiConversation` gained `agent_id`/`task_id`.
- `frontend/electron/backend-process.ts` — late-recovery fix (see bug above).
- `frontend/src/types/electron-api.d.ts` — `Agent*` ambient types; `AiConversation` updated.

**Frontend**
- `frontend/src/App.tsx` — `AgentsProvider` added to the provider tree.
- `frontend/src/ai/ai-context.ts`, `AiProvider.tsx` — `openConversation()`; `fetchWithStartupRetry` now imported from `lib/`.
- `frontend/src/components/chat/ConversationHistoryList.tsx` — agent badge on agent-scoped conversations.
- `frontend/src/components/layout/Sidebar.tsx`, `AppShell.tsx` — Agents Dashboard sidebar entry, New Task modal, Command Palette entries.
- `frontend/src/project/pathUtils.ts` — `joinPath()`.

**Docs**
- `docs/ARCHITECTURE.md` — new "AGENT ORCHESTRATION FRAMEWORK (locked — Sprint 11)" section; IPC namespace list updated to six namespaces; six new locked-decision entries; version bumped to 1.8.
- `docs/DATABASE_SCHEMA.md` — new `agent_tasks` table, `ai_conversations`'s two new columns, `memory`'s first real implementation documented; version bumped to 1.4.
- `docs/PROJECT_MEMORY.md` — Sprint 11 marked completed with full delivery detail.

---

# VERIFICATION

## Offline suite

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass |
| `npm run build` | Pass |
| `pytest` (backend) | 53 passed (16 new, including a live end-to-end two-stage pipeline test against the real local Ollama model — skipped gracefully via `pytest.mark.skipif` if Ollama isn't present, never mocked) |
| `ruff check` (backend) | All checks passed |
| `mypy` (backend) | No issues, 47 source files |

## Live verification (Playwright-driven `_electron` launches against the built app, real local Ollama, no mocks)

**Full pipeline suite:**

| # | Check | Result |
|---|---|---|
| 1 | App launches, `window.nemi.agents` exists, backend becomes healthy | PASS |
| 2 | Two-stage pipeline (planner → developer) created and runs to completion sequentially, respecting `depends_on_task_id` | PASS |
| 3 | Planner's output is handed to the Developer stage via the real `memory` table (`type='task'`) | PASS |
| 4 | A deliberately-unresolvable Ollama model name causes the planner stage to automatically retry (`retry_count` incrementing across scheduling passes) and land on `failed` after exactly `max_retries + 1` attempts | PASS |
| 5 | The dependent developer stage is cascade-cancelled within the same pass the planner permanently fails | PASS |
| 6 | Two independent single-stage pipelines both observed in `running` status simultaneously (parallel execution) | PASS |
| 7 | Real UI interaction: clicking the Agents sidebar icon, opening the New Task modal, filling in title/description/provider/model/stages through actual form fields, submitting | PASS |
| 8 | The created task appears in the Agents Dashboard list; expanding it and clicking Cancel via a real button click updates its status to Cancelled with a Retry button appearing | PASS |
| 9 | Screenshots confirm correct rendering: task cards, status badges/dots, Logger Panel showing the real cascade-cancel log line | PASS |

**Full Sprint 1–10 regression** (isolated Electron profile per run to avoid cross-run `localStorage` bleed):

| # | Check | Result |
|---|---|---|
| 1 | Backend health (including the late-recovery path after a slow cold start) | PASS |
| 2 | A project opened via the real `ProjectContext.openProject()` flow (Recent Projects card click, not the raw IPC call) | PASS |
| 3 | Project Explorer lists and opens a real file | PASS |
| 4 | Monaco editor mounts, accepts real keyboard input, and Ctrl+S persists the edit to disk | PASS |
| 5 | AI Chat: a real message sent via the actual Chat Input UI is answered by the real local Ollama model, with token usage displayed | PASS |

**Verification limitation, stated honestly**: the tiny `qwen2.5:0.5b` Ollama model used throughout this sprint's live testing does not reliably follow the exact ` ```file:path``` ` instruction format for Developer-stage proposed files — it produces plain, unlabeled code blocks instead. This was diagnosed as a small-model instruction-following limitation, not a parser defect: `_extract_proposed_files()` was separately verified correct against a hand-constructed compliant string via a direct unit test. The proposed-file Apply flow is therefore verified by parser unit test plus UI wiring (the Apply button, `applyProposedFile()`, and the disabled/applied states all render and behave correctly against test data), not by an end-to-end live capture of a real model producing a compliant response in this environment. Recorded here rather than overclaimed, matching this project's established practice.

---

# KNOWN ISSUES

- Only the four orchestrated roles (planner/developer/reviewer/tester) are wired into the automated task queue — the remaining `agents/*.md` roles (architect, debugger, etc.) stay reference documents, per this sprint's explicit scope.
- A task's dependency is a single `depends_on_task_id`, not a graph — pipelines are linear chains; fan-out/fan-in scheduling is not implemented.
- Proposed-file end-to-end live verification is limited by the local test model's instruction-following (see verification limitation above) — the parsing and UI logic are independently verified.
- Agent task progress is visible via status and a link into the full conversation, not a live token-by-token stream into the task card itself.
- Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

---

# NEXT SPRINT

**Sprint 12** — recommended: code-signing certificate for the installer (still the top Beta blocker), and/or wiring the remaining `agents/*.md` roles and/or a richer dependency model beyond a single linear chain per pipeline.

---

# GIT COMMIT MESSAGE

```
feat(sprint-11): implement agent orchestration framework

Build the first production-ready version of the multi-agent
orchestration framework on Sprint 10's provider/context foundation:
Planner/Developer/Reviewer/Tester agents, an Agent Manager, Agent
Memory, an Agent Task Queue, an Agent Status Dashboard, agent-to-agent
communication, parallel execution where safe, automatic retries,
failure recovery, conversation and execution history, and a
provider-independent architecture (OpenAI, Claude, Gemini, Ollama).

Backend: backend/app/ai/agent_roles.py parses agents/*.md into system
prompts (only planner/developer/reviewer/tester are scheduled). New
agent_tasks table (dependency-gated pipeline scheduling) with
AgentTasksRepository (list_runnable/mark_failed_or_retry/
cascade_cancel_dependents/retry). AgentsRepository seeds the agents
table from role files at startup. MemoryRepository gives the
schema-ready-since-Sprint-4 memory table its first real
implementation, used for durable agent-to-agent handoff. New
backend/app/ai/orchestration/manager.py: a stateless run_cycle() -
one scheduling pass per call, no internal loop, no server-side API
keys (preserves Sprint 10's "keys never persisted server-side"
decision) - executing up to 3 runnable tasks in parallel via
asyncio.gather, calling Sprint 10's existing AIProvider abstraction
directly. Developer-stage file changes are parsed into proposed_files
but never auto-written to disk. Fixed a pre-existing packaging gap:
agents/*.md is now bundled for PyInstaller builds.

Electron: agent-client.ts mirrors ai-client.ts's pattern for the new
window.nemi.agents.* IPC surface. main.ts runs a 4-second timer that
decrypts safeStorage keys fresh each call and triggers one scheduling
pass - the actual cadence, since the backend itself holds no loop and
no keys.

Frontend: new agents/ Context+Provider+Hook module and components/
agents/ (Agents Dashboard sidebar panel with live task status and
proposed-file Apply actions, New Task modal). AiContext gained
openConversation() so the Dashboard can jump from a task into the
conversation that did its work; agent-scoped conversations get a
visible badge in the Chat Panel history.

Found and fixed one real bug during live verification:
backend-process.ts's health state latched permanently into 'error'
after a 15s startup timeout even when the backend later became
healthy - worsened by this sprint's own added startup-time role-file
seeding making a slow cold start more likely to trip it. Fixed with a
background watcher that recovers state to 'ready' once the
still-alive process actually responds.

Verified: full offline suite (tsc/eslint/prettier/build, backend
pytest - 53 passed incl. 16 new/ruff/mypy) plus live Playwright
verification (full pipeline with sequential handoff via the real
memory table, automatic retry + cascade-cancellation on a forced
failure, two independent pipelines observed running in parallel, real
UI form interaction creating and cancelling a task) and a full Sprint
1-10 regression pass (Explorer, real project-open flow, Monaco
editor edit+save, AI Chat send/receive), each reproduced clean.

Update docs/ARCHITECTURE.md (new AGENT ORCHESTRATION FRAMEWORK
section, six new locked decisions), docs/DATABASE_SCHEMA.md (new
agent_tasks table, ai_conversations columns, memory's first real
implementation), and docs/PROJECT_MEMORY.md; add
docs/SPRINT_11_REPORT.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
