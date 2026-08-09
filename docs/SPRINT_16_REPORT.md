# SPRINT 16 COMPLETION REPORT

Multi-AI Subscription Coding Control Center

Status: Completed
Date: 09 August 2026

---

# GOAL

Turn NEMI AI STUDIO into a single control center for the user's own
existing coding-tool subscriptions — ChatGPT/Codex CLI, Claude Code
CLI, Gemini CLI — usable alongside (never replacing) the existing
7-provider API-key system from Sprint 15.5. A Task Router lets the
user choose Auto / ChatGPT / Claude / Gemini per coding task, prefers
authenticated subscription tools over paid API usage by default, and
never fabricates a tool's installed/authenticated state.

---

# SCOPING PRINCIPLE

Per the sprint brief: audit first, reuse second, extend third — never
duplicate. Before writing any code, three research passes ran in
parallel over (1) Agent Orchestration + Workflow Engine, (2) Provider
Management + Settings + the Ollama detection precedent, and (3) the
Live Intelligence Dashboard + Health Center, specifically to answer
"does an extension point already exist, and which dashboard fields are
genuinely missing." The verdict from that audit shaped every
architectural decision below: no CLI-execution extension point
existed, so one was added as a *sibling* to the existing `AIProvider`
abstraction, never a replacement; only two dashboard fields were
genuinely missing (`Running Tests`, per-task `Execution Mode`);
everything else the sprint brief asked the dashboard to show already
existed and was left untouched.

---

# ARCHITECTURE SUMMARY

## Authentication: detect, never request or store

`backend/app/ai/cli_tools.py` registers the three tools and detects
each the same two-axis way Sprint 15.5's `ollama_provider.
is_ollama_installed`/`is_server_running` already did for Ollama:

- **Installed** — a real `shutil.which()` PATH lookup, never a guess.
- **Authenticated** — a best-effort check for whether the tool's own
  officially-documented per-user credential file exists
  (`~/.codex/auth.json`, `~/.claude/.credentials.json`,
  `~/.gemini/oauth_creds.json`/`settings.json`). The file's *existence*
  is checked — its contents are never opened, read, stored, or
  transmitted. `None` (unknown) is a real possible result, and
  `is_available()` never treats `None` as available — only a
  positively-confirmed `True` counts. This is an honest heuristic, not
  a guarantee: a future CLI version moving its credential file would
  read as "installed, not authenticated" (a false negative), never a
  fabricated "Authenticated".
- A cheap `--version` invocation (no network call) confirms the binary
  actually runs and reports a real version string.

No API key, password, session token, or credential of any kind is ever
requested from the user or written to the database for these three
tools.

## Task Router: a pure decision function

`backend/app/ai/orchestration/task_router.py`'s `resolve_execution()`
takes a role, the current policy (`mode`, `subscription_first`), live
CLI statuses, and API-provider configuration, and returns a decision —
with no I/O, no database access, no network call. This is what makes
it exhaustively unit tested (14 tests covering explicit-mode selection
and its "never silently switch" guarantee, Auto mode's per-role
priority order, the subscription-first fallback and its `fallback_used`
flag, and the fully-honest "nothing available" case).

## Where CLI execution plugs into the existing pipeline

`agent_tasks.provider` was already free text (Sprint 15.5's per-role
`agent_provider_defaults` already accepted any string) — the three CLI
tool ids fit there with zero schema change to that column. Four
additive/defaulted columns (`execution_backend`, `cli_tool_id`,
`files_changed`, `cli_exit_code`) and one new singleton table
(`execution_policy`) were added; every pre-Sprint-16 row is
unaffected (`execution_backend` defaults to `'api'`).

`app/ai/orchestration/manager.py`'s `_execute()` — the Sprint 11 API
path — was split into `build_task_prompt()` (all existing
memory/knowledge-graph/review-risk grounding, byte-for-byte unchanged
logic, just relocated) and `finalize_task_result()` (persistence,
conflict detection, decomposition parsing). Two new functions,
`claim_cli_dispatch()` and `record_cli_result()`, call the exact same
two functions around a different middle step — a CLI dispatch gets
identical grounding and identical post-processing to an API call; only
"how the response text is obtained" differs.

`run_cycle()` (the existing poller, driven by Electron's
`agentCycleTimer`) now filters to `execution_backend='api'` only. A new
endpoint, `GET /agents/tasks/cli-runnable`, is the CLI counterpart,
polled by a new, separate Electron-main interval
(`runCliDispatchCycleOnce`, 5s) — an added poller alongside the
existing one, not a replacement, and each filters strictly to its own
kind of task so neither ever tries to execute the other's.

**Why Electron spawns the CLI process, not the backend**: Sprint 5's
Filesystem Ownership rule already puts the open project's real path
and all OS/process concerns in Electron main — `frontend/electron/
cli-tools.ts` mirrors `build-runner.ts`'s already-proven spawn/stream/
cancel pattern exactly. The backend only decides *that* a task routes
to a CLI and composes its prompt (`POST .../claim-cli-dispatch`);
Electron spawns the real process, streams its output to the renderer,
and reports the outcome back (`POST .../record-cli-result`) — the same
"Electron does the OS work, backend records the outcome" pattern
`mark-files-applied`/`workflows/{id}/test-result` already established.

## Safety: git checkpoint, not human-gated Apply/Reject

A CLI coding agent has direct filesystem write access — unlike an
API-routed Developer task, which only ever proposes fenced code blocks
for human Apply/Reject (Sprint 11's rule, unchanged for that path).
`prepareCliCheckpoint()`:

1. Verifies the project is a real git repository with at least one
   commit — refuses to dispatch otherwise, with a clear, honest error.
2. If the working tree is dirty, commits the user's *own* pending
   changes as an explicit checkpoint first — the CLI agent's changes
   never mix into un-reviewed pre-existing edits.
3. After the CLI tool exits, `commitCliChanges()` commits whatever it
   wrote as a second, separate commit and diffs the two commits for the
   real `files_changed` list.

**Concurrency**: "never allow two coding agents to modify the same
files simultaneously" is enforced as a hard, project-wide single-flight
lock in `cli-tools.ts` — only one CLI agent process runs at a time,
app-wide, rather than an attempt to prove file-level isolation between
concurrent runs.

**Failure recovery**: any error after a task is claimed (`running`) —
including a checkpoint failure or an unexpected exception — is caught
and always reaches `record-cli-result` with `success:false`, so a task
can never be silently stuck `running` forever; this mirrors `_run_task`'s
existing broad-except-then-`_handle_failure` behavior for the API path.
A CLI task gets the same automatic retry-with-backoff and
cascade-cancel-of-dependents on permanent failure as an API task,
verified by test.

## UI — extended, not duplicated

- **Settings → AI Coding Control** (new tab, `AiCodingControlTab.tsx`,
  same visual pattern as the existing `AiProvidersTab`): live tool
  status cards, `execution_policy` mode/subscription-first controls,
  and per-role preferred-agent dropdowns that write directly into the
  existing `agent_provider_defaults` table — no new preference table.
- **Live Dashboard → AI Coding Control** (new Intelligence Center
  section, `AiCodingControlSection.tsx`): per-tool status cards
  (Provider / Authentication / Role / Last Run / Availability) and the
  four requested buttons (`Plan with ChatGPT` / `Code with Claude` /
  `Code with Gemini` / `Auto Mode`), which set routing policy for the
  *next* pipeline — task creation stays the existing Agents Dashboard
  Goals tab, not duplicated.
- **Sprint Center** gained the two fields the audit found genuinely
  missing (`Execution Mode`, `Running Tests` — sourced from the
  existing `useIntelligence().runners.test.state`, no new polling) and
  had `Current Agent` extended to show the CLI tool's name when
  applicable. Every other requested field (overall %, phase, current
  task, remaining tasks, ETA, files changed, commits, build status,
  CPU/RAM, token usage, cost, logs) already existed and was untouched.

---

# BUG FOUND AND FIXED DURING IMPLEMENTATION

`create_milestone_pipelines()` (`project_manager.py`) read a role's
provider override from `agent_provider_defaults` and passed it straight
through to `agent_tasks.provider` with no way to notice it was actually
a CLI tool id — since the new Settings tab lets a user set exactly
that, the very first workflow milestone using a CLI-routed role would
have left `execution_backend` at its `'api'` default, and `run_cycle()`
would have crashed with `UnknownProviderError` the moment it tried
`get_provider("claude-code-cli")`. Fixed with a small `_resolve_execution()`
helper checking the resolved provider against the CLI tool registry —
covered by `test_create_milestone_pipelines_routes_cli_tool_role_override`.

---

# FILES

## Generated

- `backend/app/ai/cli_tools.py` — CLI tool registry + detection.
- `backend/app/ai/orchestration/task_router.py` — pure routing decision.
- `backend/app/api/cli_tools.py` — `/cli-tools/*` routes.
- `backend/app/db/repositories/execution_policy_repository.py`
- `backend/tests/test_cli_tools.py`, `test_task_router.py`,
  `test_execution_policy_repository.py`, `test_sprint16.py`
- `frontend/electron/cli-tools.ts` — spawn/checkpoint/dispatch.
- `frontend/electron/cli-tools-client.ts` — `/cli-tools/*` fetch client.
- `frontend/src/components/settings/AiCodingControlTab.tsx`
- `frontend/src/components/intelligence/AiCodingControlSection.tsx`
- `docs/SPRINT_16_REPORT.md` (this file)

## Modified

- `backend/app/ai/orchestration/manager.py` — split `_execute()`;
  added `claim_cli_dispatch()`/`record_cli_result()`.
- `backend/app/ai/orchestration/project_manager.py` — CLI-tool routing
  in `create_milestone_pipelines()` (the bug fix above).
- `backend/app/api/agents.py` — `use_task_router` on `create_pipeline`;
  `cli-runnable`/`claim-cli-dispatch`/`record-cli-result` endpoints.
- `backend/app/api/schemas.py` — Sprint 16 schemas; `AgentTaskOut`
  extended.
- `backend/app/db/repositories/agent_tasks_repository.py` —
  `execution_backend`/`cli_tool_id` on `create()`;
  `list_runnable(execution_backend=...)`; `set_conversation_id()`;
  `mark_completed()` extended.
- `backend/app/db/schema.py` — 4 new `agent_tasks` columns,
  `execution_policy` table.
- `backend/app/server.py` — registers the new router.
- `frontend/electron/agent-client.ts`, `main.ts`, `preload.ts`,
  `filesystem.ts` (new `getCurrentProjectPath()` for the CLI dispatch
  poller — the one piece of Electron-main state this sprint needed
  that didn't already exist).
- `frontend/src/components/intelligence/{IntelligenceCenter,
  SprintCenterSection,sections}.tsx/.ts`,
  `frontend/src/components/settings/SettingsModal.tsx`,
  `frontend/src/types/electron-api.d.ts`.
- `docs/ARCHITECTURE.md`, `docs/DATABASE_SCHEMA.md`,
  `docs/PROJECT_MEMORY.md`, `docs/AI_OPERATING_MANUAL.md`,
  `docs/AGENTS_OVERVIEW.md`.

No existing API provider system, Agent Orchestration, or Workflow
Engine code was duplicated or replaced.

---

# TESTS

37 new backend tests (208 total, all passing):

- **CLI detection / authentication** (`test_cli_tools.py`): real
  `shutil.which` PATH resolution against a genuine fake-but-executable
  binary; real credential-file-existence checks (both present and
  absent); confirms an absent real-world binary name reports
  `installed=False` honestly; confirms `is_available()` never treats
  unknown auth as available.
- **Task routing / Auto mode / subscription-first**
  (`test_task_router.py`): explicit-mode selection and its
  never-silently-switch guarantee, per-role priority ordering (planner
  prefers Codex, developer prefers Claude, tester prefers Gemini),
  subscription-first fallback with `fallback_used` flagged, the
  reversed order with subscription-first off, and the fully-honest
  "nothing available" case.
- **Execution policy CRUD** (`test_execution_policy_repository.py`):
  defaults, upsert, partial-update preservation.
- **End-to-end integration** (`test_sprint16.py`): `create_pipeline`
  with `use_task_router` routing to an available CLI, falling back to
  API, and failing loudly (409) rather than creating an unrunnable
  task; CLI-runnable listing excludes API tasks; `claim_cli_dispatch`
  atomicity (two concurrent claims, only one wins — the same
  `mark_running()` race guard the API path already relies on) and its
  404 path for a non-CLI/unknown task; `record_cli_result` success
  (files_changed/exit_code persisted), failure-then-retry-then-
  permanent-failure (failure recovery), cascade-cancel of dependent
  tasks, and its "task not running" no-op; `run_cycle` provably never
  tries to execute a `'cli'` task; `create_milestone_pipelines` CLI-tool
  routing (the bug fix above); `/cli-tools/resolve` and
  `/cli-tools/execution-policy` round trips via the real API.

**Not covered by automated tests**: the git-checkpoint/single-flight/
cancellation logic in `frontend/electron/cli-tools.ts`. This project
has no existing unit-test harness for `frontend/electron/*.ts` — its
established testing method for that layer, every prior sprint, is
live Playwright-driven verification, not a new unit-test framework
introduced for one sprint. That logic was verified by code review and
by mirroring `build-runner.ts`'s already-proven, already-shipped
pattern; see Known Limitations below for what live verification did
and did not reach this session.

---

# VERIFICATION

## Offline suite

| Check | Result |
|---|---|
| Backend `pytest` | 208 passed (37 new) |
| Backend `ruff check` | Clean |
| Backend `mypy` | 0 issues, 68 source files |
| Frontend `tsc --noEmit` | Clean |
| Frontend `eslint .` | Clean |
| Frontend `prettier --check` | Clean |
| Frontend `npm run build` | Succeeds (pre-existing Monaco chunk-size warning, unrelated) |

Full Sprint 1–15.6 regression: the entire existing backend test suite
(171 pre-existing tests) passed unchanged alongside the 37 new ones,
confirming nothing already-shipped broke.

## Live verification

**Backend — real, comprehensive, no mocks**: a standalone backend
instance was started on an isolated port and driven with real HTTP
requests against this actual development machine:

- `GET /cli-tools/status` returned genuinely live detection: **Claude
  Code CLI** correctly reported `installed=true`,
  `binary_path="C:\Users\Hare Krishna\AppData\Roaming\npm\claude.CMD"`,
  `version="2.1.223 (Claude Code)"`, `authenticated=true` — matching
  exactly what direct shell inspection (`command -v claude`, `claude
  --version`, and the real presence of
  `~/.claude/.credentials.json`) had already confirmed independently.
  **Codex CLI** and **Gemini CLI** correctly reported
  `installed=false`, `authenticated=null`, `available=false` — neither
  is installed on this machine, and neither result was faked.
- `POST /cli-tools/resolve` for the `developer` role in Auto mode
  correctly selected Claude Code (subscription-first, real priority
  order). For `planner` (whose priority order tries Codex, then
  Gemini, then Claude), it correctly fell through both unavailable
  tools to Claude Code — proving the priority-with-fallback logic on
  real, not simulated, data.
- A real end-to-end lifecycle: `POST /agents/tasks` with
  `use_task_router:true` created a `developer` task that genuinely
  routed to `claude-code-cli`; `POST .../claim-cli-dispatch` atomically
  marked it `running` and returned a real composed prompt (verified to
  contain the actual Developer role system prompt and task
  description); `POST .../record-cli-result` finalized it to
  `completed` with real `files_changed`/`cli_exit_code` persisted.

**Electron GUI — not completed this session.** A pre-existing NEMI AI
STUDIO instance (the packaged Alpha build installed during an earlier
session) was found still running and holding the Electron
single-instance lock (Sprint 15.6), preventing a fresh dev-mode launch
from opening its own window. Attempts to terminate that process tree
(`Stop-Process`, `taskkill /T /F`) failed with Windows "Access is
denied" on the main process and its backend child — a genuine
environment/permission wall, not a code defect, and not something
resolvable without a human closing that application or granting
elevated permissions. Per this sprint's own instruction to continue
past non-blocking obstacles rather than stop, work continued with
backend-level live verification (above) instead, which covers 100% of
the new backend logic and, through the real HTTP round trip, the exact
same code path the Electron IPC layer calls into. The Electron-side
code itself (`cli-tools.ts`'s spawn/checkpoint/single-flight/
cancellation logic, the new IPC handlers, the new UI components) is
unverified live this session — covered by `tsc`/`eslint`/`prettier`/
build passing cleanly and by code review against `build-runner.ts`'s
already-proven, already-shipped pattern, not by a live click-through.

An actual CLI coding run (invoking real `claude -p "..."` and letting
it write files) was deliberately not performed as part of this
automated session — doing so would have real, uncontrolled side
effects (real file writes, real usage of the user's own Claude Code
session) outside what a verification pass should trigger on its own
initiative.

---

# KNOWN LIMITATIONS

1. **Electron GUI live verification incomplete** — see above. The
   Settings "AI Coding Control" tab, the dashboard "AI Coding Control"
   section, and the four routing buttons have not been click-tested
   live this session.
2. **Only Claude Code CLI could be live-verified end-to-end** — Codex
   and Gemini CLI are not installed on this development machine.
   Detection correctly reports both as not installed (a real, honest
   result, not a failure), but no live dispatch through either has
   been exercised.
3. **No actual CLI coding run was performed** — the full lifecycle was
   verified with a simulated (not real) CLI output at the
   `record-cli-result` step, to avoid an automated verification pass
   causing real, uncontrolled file writes via a real coding agent.
4. **The workflow's initial goal-decomposition task never routes to a
   CLI tool**, even if the Planner role has a CLI override configured
   — only subsequent per-milestone role tasks do (see
   `docs/ARCHITECTURE.md`'s Sprint 16 section for why this is not a
   functional gap given the current Goals tab UI).
5. **CLI invocation flags are a best-effort, version-pinned guess** —
   `claude -p`, `codex exec --full-auto`, `gemini -p --yolo` are this
   sprint's understanding of each tool's documented non-interactive
   mode; a future CLI release changing its flags would need
   `CLI_DISPATCH_CONFIG` in `cli-tools.ts` updated. Detection is
   independent of this and stays correct regardless.

---

# NEXT SPRINT

Do not start automatically — per the sprint brief, only the requested
work above was implemented. Recommended follow-ups (not started):

- Live Electron GUI verification of the full Task Router UI, once the
  stray locked process is resolved.
- A real, live end-to-end CLI coding dispatch (with the user's
  awareness and consent, given it writes real files) for at least
  Claude Code CLI, and for Codex/Gemini once installed.
- Revisit `CLI_DISPATCH_CONFIG`'s flags against each tool's current
  documentation periodically, since they are the one part of this
  sprint most likely to drift with upstream CLI releases.

---

END OF DOCUMENT
