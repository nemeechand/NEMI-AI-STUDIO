# PROJECT MEMORY

---

# PROJECT INFORMATION

Project Name:
NEMI AI STUDIO

Founder:
Nemee Chand Khichar

Project Version:
v0.1

Project Type:
Enterprise AI Software Development Platform

Status:
Planning Phase

Started:
August 2026

---

# PROJECT VISION

NEMI AI STUDIO is an enterprise-grade AI software development platform.

The platform should work like an AI software company.

The user should only describe what they want to build.

The platform should perform planning, architecture, coding, reviewing, testing, debugging and building automatically using multiple AI models.

---

# LONG TERM GOAL

Create India's best AI Software Development Platform.

Future products to be built using this platform:

• Brain Wala DMIT
• NIVESH PRO CRM
• Financial Advisor CRM
• School ERP
• Hospital ERP
• Stock Market Platform
• AI Automation Systems

---

# CURRENT PHASE

Planning

---

# CURRENT SPRINT

Sprint 1 — Completed

Goal:

Create complete software foundation.

No business logic.

No production features.

Architecture first.

Delivered:

Electron main process and preload script

React + TypeScript renderer entry

Vite build pipeline (renderer, main, preload)

ESLint + Prettier configuration

Base frontend folder structure

No UI implemented. No Python. No SQLite. No AI. No business logic.

Sprint 1B — Completed

Goal:

Extend the software foundation with a Python backend.

No business logic.

No API framework selected yet.

No Electron ↔ Python process wiring yet.

Delivered:

Python backend package (backend/app) with a runnable entry point

Pytest test scaffold (backend/tests)

Ruff (lint) and Mypy (strict type-check) tool configuration

Dependency files (requirements.txt, requirements-dev.txt) — zero runtime dependencies by design

.env.example placeholder (no secrets)

Verified: pytest, ruff check, mypy, and `python -m app.main` all pass

Sprint 2 — Completed (Desktop Shell)

Goal:

Build the desktop application shell only.

No AI. No Database. No business logic.

Delivered:

VS Code style layout (custom frameless title bar, activity-bar sidebar, main content area, bottom logger panel, status bar)

Professional Dark Theme (default) with a Light theme alternative, via a CSS-variable Theme Manager

Header Toolbar with custom window controls (minimize / maximize / close) over a frameless BrowserWindow

Project Explorer (static placeholder tree, recursive component, no real filesystem access yet)

Logger Panel (static placeholder entries, no real log ingestion yet)

Settings Window (in-app modal with Appearance/theme control — not a separate OS window; documented as a deliberate simplification)

Theme Manager (React context + provider + hook, persisted to localStorage, `dark` class strategy)

TailwindCSS v4 integrated via `@tailwindcss/vite` (no separate config file — CSS-first `@theme` tokens)

Electron hardening: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, denied `window.open`, blocked cross-origin `will-navigate`, restrictive Content-Security-Policy meta tag

Verified: tsc build, eslint (0 warnings), prettier, vite build (renderer + main + preload), and a live `npm run dev` Electron launch (process stable, no runtime errors)

Sprint 3 — Completed (Architecture/Database/Agent Finalization + Dashboard)

Goal:

Finalize software architecture, database design, and AI agent workflow documentation. Start real Dashboard content behind the Sprint 2 shell.

Delivered:

docs/ARCHITECTURE.md — locks the layer mapping, Electron process/IPC boundary (`window.nemi` only), the Context+Provider+Hook state pattern, and defers backend framework/Electron↔Python transport as open decisions

docs/DATABASE_SCHEMA.md — finalized SQLite table design (projects, tasks, files, agents, memory, logs, settings, history) with columns, keys, indexes and relationships — design only, no implementation yet

docs/AGENTS_OVERVIEW.md — consolidates the 8 agent roles from agents/*.md into one pipeline diagram and approval-gate reference

docs/PRODUCT_VISION.md reviewed for consistency against all other docs — confirmed complete, no changes required

Dashboard module (frontend/src/components/dashboard/): Dashboard, DashboardCard, WelcomeHeader, QuickActionsCard, SprintStatusCard, AITeamCard, TechStackCard, dashboardData.ts — replaces the "No project opened yet" placeholder with real content (sprint progress, AI team roster, tech stack, quick actions). New Project/Open Project are honest disabled stubs ("Coming Soon") since filesystem project loading isn't implemented yet

Status Bar label updated to "Sprint 3 — Dashboard"

Verified: tsc build, eslint (0 warnings), prettier (clean on all touched files), vite build (renderer + main + preload), pytest (1 passed), ruff check (all checks passed), mypy (no issues), and a live `npm run dev` Electron launch (process stable, no runtime errors)

Sprint 4 — Completed (Backend Integration)

Goal:

Finalize backend architecture, integrate Electron with the Python backend, build a robust IPC layer, build the SQLite data access layer, implement startup + health checks, add centralized logging and error handling.

Delivered:

Backend framework locked: FastAPI + Uvicorn over HTTP on 127.0.0.1:8756 (fixed, env-overridable port) — the backend's first-ever runtime dependency (Sprint 1B was intentionally dependency-free)

backend/app/core/: config.py (Settings, env-overridable, repo-root-relative paths independent of cwd), logging.py (console + rotating file at logs/backend.log), errors.py (NemiError + global FastAPI exception handlers returning a consistent {"error": {"code","message"}} shape, unhandled exceptions logged server-side with full traceback, never leaked to the client)

backend/app/db/: connection.py (context-managed sqlite3 connection, foreign_keys pragma, Row access), schema.py (all 8 DATABASE_SCHEMA.md tables + indexes, idempotent init_db()), repositories/logs_repository.py (insert/list_recent — the first concrete repository, backing the logs table)

backend/app/api/health.py + backend/app/server.py: GET /health (status, version, env, uptime), FastAPI lifespan hook that configures logging, initializes the database, and logs a startup entry to both the file log and the logs table

backend/app/main.py rewritten as the real process entry point (blocking run_server(), returns 0 on clean shutdown/KeyboardInterrupt)

frontend/electron/backend-process.ts: Electron main spawns `python -m app.main` as a child process on app ready (parallel with window creation, not blocking it), polls /health (300ms interval, 15s timeout) to determine starting/ready/error state, and stops the child cleanly on app before-quit — manually verified: graceful window close terminates the Python child with no orphaned process

IPC: window.nemi.backend.health() (preload.ts + electron-api.d.ts) — the renderer never talks to the backend directly; every call is relayed through Electron main, keeping the Sprint 2 CSP/sandbox hardening intact

StatusBar now shows real backend health (starting/ready/error/stopped) instead of a static "Ready" label, polling every 5s

.gitignore updated: database/*.db and database/*.db-journal ignored (runtime artifacts, regenerated on startup; *.log was already ignored)

docs/ARCHITECTURE.md updated: closes the Sprint 3 "open decisions" (backend framework, transport, process lifecycle) with the choices above and the reasoning behind them

docs/DATABASE_SCHEMA.md updated: implementation status section added — schema is live, only logs has a repository, remaining 7 tables intentionally deferred to the sprints that need them

docs/SPRINT_4_REPORT.md created

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build (renderer + main + preload); pytest (10 passed), ruff check (all checks passed), mypy strict (0 issues, 20 source files); live end-to-end test — `npm run dev` spawned Electron, which spawned the Python backend, which answered curl http://127.0.0.1:8756/health with a real response, and a graceful window close cleanly terminated both processes with nothing orphaned

Known limitation: spawning `python` from PATH assumes the machine running the app has a compatible Python with backend dependencies installed — acceptable for development, but a packaged/distributed build will need to bundle a Python runtime (future work, not solved this sprint)

Sprint 5 — Completed (Real Filesystem, File CRUD, Live Watching)

Goal:

Build the real filesystem-backed Project Explorer, connect the Logger Panel to backend logs, add File Create/Rename/Delete/Open/Save, watch filesystem changes in real time, improve Electron ↔ Python IPC, add robust logging and error handling.

Delivered:

Filesystem ownership locked as Electron main (not Python) — `frontend/electron/filesystem.ts` (pure Node + chokidar, no Electron import — directly testable under plain Node), `frontend/electron/project-dialogs.ts` (native folder-picker dialogs, isolated from the CRUD/watch logic)

Real Project Explorer: `ProjectExplorer.tsx` (empty state with Open Folder / New Project), `ExplorerTree.tsx` (root listing + create-at-root), `ExplorerTreeItem.tsx` (lazy IPC-backed children, hover actions, optimistic rename/delete), `InlineNameInput.tsx` (Electron has no native `window.prompt`, so this is the real create/rename UI) — replaces the Sprint 2 static mock tree entirely (mockProjectTree.ts deleted)

File Create/Rename/Delete/Open/Save all real: create uses the `wx` flag for atomic duplicate detection; delete requires `window.confirm`; a minimal `FileEditor.tsx` (plain textarea, dirty-tracking, Ctrl+S) makes Open/Save genuinely work — deliberately no syntax highlighting, scope stated explicitly in docs/ARCHITECTURE.md

Real-time filesystem watching via `chokidar`, ignoring node_modules/.git/dist/__pycache__/.venv/etc. — `openProject()` now awaits the watcher's `ready` event before resolving (fixes a race where a file created immediately after opening a project could be missed)

Found and fixed a genuine Windows bug during verification: a short-path (8.3-style, e.g. `HAREKR~1`) watch root crashes chokidar's native watcher with an uncatchable libuv assertion — fixed by resolving to the real long-form path via `fs.realpath()` before watching, verified via a direct reproduction

Backend `/logs` API: `GET /logs` (paginated, newest-first) + `POST /logs` (validated via pydantic, level restricted to INFO/WARNING/ERROR/DEBUG) — `LogsRepository.insert()` now returns the created row instead of just an id; added a `RequestValidationError` handler so pydantic validation errors also return the consistent `{"error": {"code","message"}}` shape

Real Logger Panel: polls `window.nemi.backend.logs()` every 5s, replacing Sprint 2's mock entries entirely (mockLogEntries.ts deleted)

File operations audit-log themselves to the backend's `logs` table via a new `frontend/electron/backend-client.ts::postLog()` (fire-and-forget, contained errors — a backend outage never breaks a file operation) — verified end-to-end: creating a file produced a real `fs.create` row visible via `GET /logs`

Dashboard's "New Project" / "Open Project" buttons are no longer disabled stubs — both now trigger the real folder-picker flow via a new `frontend/src/project/` module (ProjectProvider/useProject/useOpenProjectDialog, following the Context+Provider+Hook pattern locked in Sprint 3/4), with the last-opened project persisted to localStorage and revalidated on launch

`chokidar` added as a frontend dependency; `IconButton` gained `disabled` styling (used by the FileEditor's Save button)

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build (renderer + main + preload, chokidar bundles correctly); pytest (14 passed), ruff check (all checks passed), mypy strict (0 issues, 23 source files); a standalone Node smoke test (`npx tsx`, no Electron needed) exercised listDirectory/createFile/renameEntry/deleteEntry/readFile/writeFile plus the watcher against a real temp directory — including the short-path crash reproduction and fix; live end-to-end test — `npm run dev` spawned Electron + the real Python backend, `GET /logs` returned real rows, a file-create audit entry was confirmed to reach the database through the full Electron→backend pipeline, and a graceful window close cleanly terminated both the Electron and Python processes with nothing orphaned

Known limitation: native-dialog-driven flows (the folder-picker itself) could not be scripted end-to-end in this environment (no OS dialog automation available here) — verified instead by exercising the underlying `filesystem.ts` functions directly, which is what the dialog handlers call after the user picks a path

Windows Alpha Build 1 — Completed (0.1.0-alpha.1)

Goal:

Package everything delivered through Sprint 5 into a distributable Windows build using Electron Builder.

Delivered:

`electron-builder` configured in `frontend/package.json` (`"build"` field) — appId `com.nemi.aistudio`, productName "NEMI AI STUDIO", NSIS installer + portable targets (x64), extraResources bundling the full `backend/` source into the packaged app

Generated `frontend/build/icon.ico` (7 resolutions) + `icon.png` — a placeholder "N" monogram in the app's existing accent blue, noted as needing a real brand identity before Beta/GA

`backend-process.ts::resolveBackendDir()` now branches on `app.isPackaged` to resolve the backend via `process.resourcesPath` in packaged builds (dev-mode path resolution doesn't apply once bundled); Python-not-found errors now produce a specific, actionable StatusBar message instead of a raw Node error

Version bumped to `0.1.0-alpha.1`

Verified on this machine: NSIS installer silently installed, correct files/shortcuts, installed app launched and its bundled backend passed a real `GET /health` check, graceful close left nothing orphaned, silent uninstall left the machine clean; portable exe launched standalone with the same working pipeline. No packaging defects found. Full detail in `docs/ALPHA_BUILD_REPORT.md`

Known limitation (deliberate, documented): this Alpha still requires Python 3.11+ pre-installed on the target machine — no standalone Python runtime is bundled yet (e.g. via PyInstaller); the installer is also unsigned (no code-signing certificate). Both are recommended as the top priorities for a Beta build

Sprint 6 — Completed (Stabilize Alpha Build)

Goal:

Stabilize the Windows Alpha build, fix remaining bugs, improve the Project Explorer, Logger Panel, and backend status monitoring, optimize performance, prepare the architecture for a future AI Chat Panel and Code Editor, and verify.

Delivered:

Fixed a genuine Alpha-breaking bug found uncommitted from a prior debugging session: `frontend/electron/main.ts` (last commit) pointed the preload script at `preload.js`, but `vite-plugin-electron` (with this package's `"type": "module"`) only ever emits `dist-electron/preload.mjs` — confirmed via a clean rebuild. The mismatch meant Electron silently failed to load the preload script, `contextBridge` never ran, and `window.nemi` was `undefined` for every packaged/dev launch — breaking StatusBar, Project Explorer, Logger Panel, and the Dashboard's Open/New Project buttons. Fixed by keeping `main.ts` pointed at `preload.mjs` (the file that actually exists) and verified end-to-end via a Playwright-driven Electron launch: `window.nemi` present, backend health reachable, Explorer/Logger functional

During root-causing this, briefly misdiagnosed a second, deeper-looking crash (`import { app } from 'electron'` failing in Node's ESM loader) as a real Electron/Node ESM-interop bug; a CJS-build-output fix was drafted, verified working, then reverted once re-testing with `ELECTRON_RUN_AS_NODE` unset showed the ESM approach itself was fine. Sprint 6 was then reported complete and pushed on the conclusion that the crash was pure test-environment noise — that conclusion was itself wrong and was corrected after being asked to re-investigate: `ELECTRON_RUN_AS_NODE=1` is inherited from VS Code's extension host (confirmed at the Process environment scope, not User/Machine, and correlated with `VSCODE_ESM_ENTRYPOINT` in the environment) — a real, structural property of developing this app via Claude Code inside VS Code, not a fluke. It silently broke every `npm run dev` launch this way, since `vite-plugin-electron`'s spawn inherits `process.env` by default. Fixed for real in `frontend/vite.config.ts`, which now deletes the variable before spawning Electron for dev — verified by running `npm run dev` with the variable deliberately left set and confirming a full launch (window created, backend spawned, logs flowing)

Removed leftover debugging artifacts from the same prior session: `frontend/_cdp_check.mjs`, `frontend/_cdp_check2.mjs` (throwaway CDP scripts), and a stray `hello.py` at the repo root (unrelated to `backend/app`)

Backend status monitoring improved: `BackendHealth` (`backend-process.ts`) now carries `version`/`uptimeSeconds` from the `/health` response instead of discarding it once ready (refreshed in the background on each `getBackendHealth()` call); `StatusBar.tsx` shows a title/tooltip with version + formatted uptime; label bumped to "Sprint 6 — Stabilization"

Logger Panel improved: backend `stdout`/`stderr` (previously console-only, a known pending item) now also flow into the same `logs` table via the existing `postLog()` pipeline (`backend.stdout` at DEBUG, `backend.stderr` at WARNING, split per line) — verified a real launch produced visible `backend.stdout` rows; added a client-side level filter dropdown (ALL/INFO/WARNING/ERROR/DEBUG) to `LoggerPanel.tsx`

Project Explorer improved: the filesystem watcher's change notifications (`filesystem.ts`) are now debounced (300ms trailing) instead of firing one renderer refetch per raw chokidar event — a bulk operation (e.g. `npm install`, a git checkout) previously fired hundreds of redundant `listDirectory` IPC round-trips in a burst; added a "Loading…" indicator to `ExplorerTreeItem` while a folder's first expansion is in flight

Performance: the watcher debounce above was the one real inefficiency found; no other hot paths needed changes (polling intervals and per-request SQLite connections are already appropriate for a single-user desktop app, as documented)

Architecture prepared (documentation only, per `agents/architect.md` — "never write code") for a future AI Chat Panel and Code Editor: `docs/ARCHITECTURE.md` gained a new section reserving `frontend/src/components/chat/` + `frontend/src/ai/` (Context+Provider+Hook, matching the Theme Manager pattern) and a future `window.nemi.ai.*` IPC namespace for the Chat Panel, and documents that `FileEditor.tsx`'s plain-textarea scope is the intended Monaco/CodeMirror upgrade target behind the same `onOpenFile`/`window.nemi.fs` contract — no new code, folders, or IPC channels were created

docs/SPRINT_6_REPORT.md created

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build (renderer + main + preload); pytest (14 passed), ruff check (all checks passed), mypy strict (0 issues, 23 source files); a Playwright-driven Electron launch of the built app confirmed `window.nemi` exists, backend health reaches `ready` with real version/uptime, the Logger Panel's level filter and `backend.stdout` entries render correctly, and the app closes cleanly; separately, a live `npm run dev` launch with `ELECTRON_RUN_AS_NODE=1` deliberately left set confirmed the actual dev-workflow fix (Electron launched, backend spawned) — this is the reproduction that matters, since that's the real launch path affected

Known limitation (unchanged from Alpha, not addressed this sprint): still requires Python 3.11+ pre-installed on the target machine; installer remains unsigned — both tracked as the top Beta priorities

Sprint 6 Final Release Verification — Completed

A completely fresh, from-scratch verification pass (no assumed prior session state): every Electron/Python/Node process killed, `dist`/`dist-electron`/`node_modules/.vite`/`database/nemi.db`/`logs/backend.log` deleted, then rebuilt and relaunched from zero. Confirmed `ELECTRON_RUN_AS_NODE` is still inherited at the Process environment scope only (User/Machine confirmed empty via `[System.Environment]::GetEnvironmentVariable`) — unchanged, expected, and directly bracketed with a negative/positive control: launching with the variable present and unmitigated fails deterministically ("Process failed to launch!"); launching with exactly the operation `vite.config.ts` performs (`delete process.env.ELECTRON_RUN_AS_NODE`) applied succeeds with `window.nemi` present — proving the fix mechanism itself, not just its outcome

The real `npm run dev` command was run fresh with the ambient variable left untouched: Electron launched (4-process tree), the Python backend spawned and answered `GET /health` with `200 {"status":"ok",...}`, and a graceful window close (`CloseMainWindow()`, not a force-kill) cleanly terminated every Electron process and the Python child with zero orphaned processes — verifying both the fix and the documented Sprint 4 graceful-shutdown behavior still hold

A 17-point deep verification (Playwright-driven, built app, zero console/page errors captured) confirmed: window opens, React UI renders, backend starts automatically and reaches `ready`, StatusBar shows Ready (within its documented 5s poll interval — an initial single-run check at 1.5s post-ready showed a stale "Backend Starting" label, investigated and confirmed to be a test-timing artifact against `POLL_INTERVAL_MS = 5000` in `StatusBar.tsx`, not an application defect, then reproduced clean on two subsequent full reruns with a correct wait margin), Logger Panel receives real `backend.startup`/`backend.stdout` entries, Project Explorer renders with Open Folder/New Project buttons present, and the underlying Open-Folder/New-Project pipeline (`openProject()`, `createFile()`, `listDirectory()`) was exercised end-to-end against a real temp directory — including one that happened to land on a Windows short-path alias, incidentally reconfirming the Sprint 5 `fs.realpath()` fix still holds. Native OS folder-picker dialogs themselves remain outside what Playwright can drive (a native Win32 dialog, not part of the Chromium DOM) — same documented boundary as Sprint 5, not a new limitation

No code changes were required this pass — every check passed against the code already pushed in the two prior Sprint 6 commits. `docs/SPRINT_6_FINAL_REPORT.md` created with the full evidence log

Final Release Verification (Packaged App) — Completed

A stricter follow-up pass, launching the actual distributable rather than a dev-mode build: killed all processes, deleted all build/runtime artifacts, then ran `npm run dist:win` (the real `electron-builder` packaging pipeline — NSIS installer + portable exe, same as `docs/ALPHA_BUILD_REPORT.md`) and launched `release\win-unpacked\NEMI AI STUDIO.exe` directly (`app.isPackaged: true`, the exact binary + `app.asar` + bundled `resources/backend` both the installer and portable exe ship)

All 15 requested checks passed: window opens, no black screen, Dashboard renders, `window.nemi` present, backend auto-starts and reaches ready, StatusBar shows Ready, Logger receives `backend.startup`/`backend.stdout`, Explorer opens a folder (via the app's own real "reopen remembered project" `localStorage` mechanism in `ProjectProvider.tsx`, since the native folder-picker dialog itself is outside what DOM automation can drive — same documented boundary as Sprint 5), and real UI-level open/save/create/rename/delete file operations against a real temp project all succeeded, the backend health endpoint answered `200` over a direct external HTTP request, and shutdown left zero orphaned `electron.exe`/`NEMI AI STUDIO.exe`/`python.exe`/`node.exe` processes. Zero console errors, zero page errors, zero backend/IPC failures across the whole run

No code changes were required — this was the actual shipped artifact working correctly. `docs/FINAL_RELEASE_VERIFICATION.md` created with full evidence (build checksums, per-item results, methodology)

Sprint 7 — Completed (Workspace & Project Management System)

Goal:

Build the Workspace & Project Management System: Recent Projects, New Project Wizard, Open Folder, Workspace Manager, multi-project support, project metadata, auto-save workspace, restore previous session — following existing architecture, without breaking Sprints 1–6, with continuous documentation and per-feature verification.

Scope decision (confirmed with founder before implementation): "multi-project support" means one active project at a time with a fast switcher between tracked projects, not simultaneous multi-window/multi-tab editing — matches the architecture already locked in Sprint 5 (`ProjectContext` holds one `projectPath`; `filesystem.ts` has a single module-level watcher). True concurrent multi-project is explicitly deferred, not attempted.

Delivered:

Backend: the `projects` table (schema-ready since Sprint 3/4, never used) finally has a repository — `ProjectsRepository` (`record_opened()` upserts by `path`, `list_recent()`, `delete()`) backing `GET /projects/recent`, `POST /projects/opened`, `DELETE /projects/{id}`. Added `projects.last_opened_at` (distinct from `updated_at`, so editing metadata without opening never changes recency) via an idempotent `ALTER TABLE ADD COLUMN` migration in `init_db()` — the first real use of the "revisit if a column needs to change" note `docs/DATABASE_SCHEMA.md` had carried since Sprint 4

Electron: new `window.nemi.projects.{listRecent,recordOpened,remove}` IPC namespace; `fs.selectDirectory()` (parent-directory picker for the Wizard, distinct from `selectProjectFolder()`) and `fs.createDirectory()` added to `filesystem.ts`/`project-dialogs.ts`/`main.ts`/`preload.ts`. Sprint 5's `selectProjectFolder(window, 'new')` native-save-dialog project-creation mode was removed (superseded by the Wizard, not kept as dead code alongside it) — `selectProjectFolder(window)` (Open Folder) is otherwise unchanged

Renderer: new `frontend/src/workspace/` Context+Provider+Hook module (matching the locked three-file pattern) owns `openFilePath`, auto-saved to `localStorage` under a **per-project-scoped** key (`nemi.workspace.openFile.<projectPath>`) — switching projects restores each project's own last-open file instead of one global slot. `ProjectProvider.tsx` now funnels every way a project becomes active (Open Folder, Wizard, Workspace Manager switch, launch-time restore) through one internal `openAndRecord()` helper so recent-project tracking happens exactly once per open, not duplicated per call site

New UI: `NewProjectWizard.tsx` (in-app modal — Name/Location/optional Description — replacing the old native-dialog creation flow), `WorkspaceManager.tsx` (second sidebar panel, toggled via a new `Sidebar.tsx` icon, listing/switching/removing recent projects), `RecentProjectsCard.tsx` (Dashboard card, same data in miniature). `AppShell.tsx` restructured so the open file's content is always read fresh via `window.nemi.fs.readFile()` whenever `useWorkspace()`'s `openFilePath` changes — never cached in `localStorage`, only the path is persisted

docs/ARCHITECTURE.md gained a new "WORKSPACE & PROJECT MANAGEMENT (locked — Sprint 7)" section and three new locked-decision entries; docs/DATABASE_SCHEMA.md updated (new column, repository status, migration approach); docs/SPRINT_7_REPORT.md created

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build (renderer + main + preload); pytest (24 passed, 10 new), ruff check (all checks passed), mypy strict (0 issues, 26 source files); a 25-point Playwright-driven live verification (fresh Electron profile per run, zero cross-run contamination) covering both Sprint 1–6 regression (window/Dashboard/preload/backend/StatusBar/Logger/health/clean-shutdown) and every Sprint 7 feature (Wizard creation, Recent Projects, Workspace Manager list/switch/remove, file open/save/rename/delete under the new AppShell wiring, and — critically — auto-save + restore-previous-session verified by reloading mid-test and confirming the same project *and* the same open file both reopened) passed 25/25, reproduced clean on two consecutive fully-reset runs

Known limitation (unchanged from Sprint 6, not addressed this sprint): still requires Python 3.11+ pre-installed; installer unsigned; AI Chat Panel/Code Editor remain architecture-only (Sprint 6 reservation, not built)

Sprint 8 — Pending Approval

---

# CURRENT STATUS

Repository Created

GitHub Connected

VS Code Ready

Claude Code Installed

Claude Pro Connected

Node.js Installed

Python Installed

Folder Structure Created

Documentation Started

Sprint 1 Completed

---

# COMPLETED TASKS

✔ GitHub Repository Created

✔ GitHub Desktop Connected

✔ VS Code Installed

✔ Claude Code Installed

✔ Claude Authentication Completed

✔ Folder Structure Created

✔ Initial Documentation Started

✔ Sprint 1 Completed — Electron + React + TypeScript + Vite Bootstrap

✔ ESLint + Prettier Configured

✔ Base Frontend Folder Structure Created (frontend/electron, frontend/src)

✔ Build Verified (npm install, tsc build, eslint, vite build all passing)

✔ Sprint 1B Completed — Python Backend Foundation Bootstrap

✔ Ruff + Mypy Configured (backend/pyproject.toml)

✔ Base Backend Folder Structure Created (backend/app, backend/tests)

✔ Backend Verified (pytest, ruff check, mypy, python -m app.main all passing)

✔ Sprint 2 Completed — Desktop Application Shell (VS Code style layout)

✔ TailwindCSS v4 Integrated (@tailwindcss/vite)

✔ Theme Manager Implemented (Dark default, Light alternative, persisted)

✔ Electron Hardened (sandbox, CSP, navigation/window-open guards, custom frameless title bar)

✔ Shell Verified (tsc, eslint, prettier, vite build, live Electron dev launch all passing)

✔ Sprint 3 Completed — Architecture, Database, and Agent Workflow Finalized; Dashboard Started

✔ docs/ARCHITECTURE.md Created (layer mapping, IPC boundary, state pattern locked)

✔ docs/DATABASE_SCHEMA.md Created (8 tables designed: projects, tasks, files, agents, memory, logs, settings, history)

✔ docs/AGENTS_OVERVIEW.md Created (8-agent pipeline + approval gates consolidated)

✔ docs/PRODUCT_VISION.md Reviewed — confirmed consistent and complete

✔ Dashboard Module Implemented (Sprint Progress, AI Team, Tech Stack, Quick Actions cards) — real content replacing the Sprint 2 placeholder

✔ Sprint 3 Verified (tsc, eslint, prettier, vite build, pytest, ruff, mypy, live Electron dev launch all passing)

✔ Sprint 4 Completed — Backend Architecture Finalized; Electron ↔ Python Integration Live

✔ FastAPI + Uvicorn Backend Service (backend/app/server.py, backend/app/api/health.py)

✔ Backend Core Modules (config.py, logging.py, errors.py) — env-configurable settings, centralized console+file logging, consistent JSON error responses

✔ SQLite Data Access Layer (backend/app/db/) — all 8 tables created automatically on startup, LogsRepository implemented

✔ Electron ↔ Python Process Integration (frontend/electron/backend-process.ts) — spawn, health-poll, graceful shutdown, verified no orphaned processes

✔ IPC Backend Bridge (window.nemi.backend.health()) — renderer never talks to the backend directly

✔ StatusBar Wired to Real Backend Health (replacing the static "Ready" label)

✔ Sprint 4 Verified (tsc, eslint, prettier, vite build, pytest ×10, ruff, mypy strict, live end-to-end Electron+backend launch with graceful shutdown all passing)

✔ Sprint 5 Completed — Real Filesystem, File CRUD, Live Watching, Backend-Connected Logger Panel

✔ Filesystem Ownership Locked as Electron Main (frontend/electron/filesystem.ts + project-dialogs.ts) — not routed through Python

✔ Real Project Explorer (ExplorerTree, ExplorerTreeItem, InlineNameInput) — replaces the Sprint 2 static mock tree

✔ File Create/Rename/Delete/Open/Save Implemented (atomic create via `wx` flag, delete confirmation, minimal FileEditor with Ctrl+S)

✔ Real-Time Filesystem Watching via chokidar — watcher-ready race and a Windows short-path libuv crash found and fixed during verification

✔ Backend /logs API (GET + POST, pydantic-validated) — LogsRepository.insert() now returns the created row; RequestValidationError handler added for consistent error shape

✔ Real Logger Panel (polls window.nemi.backend.logs()) — replaces Sprint 2 mock entries

✔ File-Operation Audit Logging (frontend/electron/backend-client.ts::postLog()) — verified end-to-end against the real backend

✔ Dashboard New Project / Open Project Buttons Now Real (frontend/src/project/ — ProjectProvider/useProject/useOpenProjectDialog)

✔ Sprint 5 Verified (tsc, eslint, prettier, vite build; pytest ×14, ruff, mypy strict; standalone Node smoke test of filesystem.ts against a real temp directory; live end-to-end Electron+backend launch with graceful shutdown all passing)

✔ Windows Alpha Build 1 Completed — electron-builder configured (NSIS + portable), application icon generated, version bumped to 0.1.0-alpha.1

✔ Alpha Build Verified (installer install/uninstall, portable exe, both launched with working bundled backend, no orphaned processes)

✔ Sprint 6 Completed — Alpha Stabilization; Explorer/Logger/Backend-Monitoring Improvements; AI Chat/Editor Architecture Reserved

✔ Fixed the Alpha-breaking preload path bug (`main.ts` now correctly points at `preload.mjs`, the file `vite-plugin-electron` actually emits) — verified via a Playwright-driven Electron launch of the built app

✔ Backend `stdout`/`stderr` Now Surfaced in the Logger Panel (`backend.stdout`/`backend.stderr` sources) — previously console-only

✔ Logger Panel Level Filter Added (ALL/INFO/WARNING/ERROR/DEBUG)

✔ BackendHealth Extended with `version`/`uptimeSeconds`; StatusBar Shows a Version/Uptime Tooltip

✔ Filesystem Watcher Notifications Debounced (300ms) — fixes a redundant-refetch-storm on bulk filesystem operations; Explorer Shows a Loading Indicator on First Folder Expansion

✔ docs/ARCHITECTURE.md Reserves AI Chat Panel (`components/chat/`, `ai/`, future `window.nemi.ai.*`) and Code Editor (Monaco/CodeMirror upgrade path) Locations — documentation only, no code

✔ Sprint 6 Verified (tsc, eslint, prettier, vite build; pytest ×14, ruff, mypy strict; Playwright-driven Electron launch of the built app confirming the preload fix and all new features end-to-end)

✔ Sprint 7 Completed — Workspace & Project Management System

✔ `projects` Table Repository Implemented (`ProjectsRepository`) — `GET /projects/recent`, `POST /projects/opened`, `DELETE /projects/{id}`; `last_opened_at` column added via idempotent migration

✔ New Project Wizard (`NewProjectWizard.tsx`, in-app modal) Replaces the Old Native-Save-Dialog Creation Flow

✔ Workspace Manager Panel (`WorkspaceManager.tsx`) — second Sidebar panel, lists/switches/removes recent projects

✔ Recent Projects Card on Dashboard (`RecentProjectsCard.tsx`)

✔ Workspace Auto-Save + Restore Previous Session (`frontend/src/workspace/` — active project + open file, persisted per-project-scoped in `localStorage`)

✔ `window.nemi.projects.*` IPC Namespace; `fs.selectDirectory()`/`fs.createDirectory()` Added

✔ Sprint 7 Verified (tsc, eslint, prettier, vite build; pytest ×24 [10 new], ruff, mypy strict; 25-point Playwright-driven live verification — Sprint 1–6 regression + every Sprint 7 feature incl. session restore — passed 25/25, reproduced on two consecutive clean runs)

---

# PENDING TASKS

Standalone Python runtime bundling for the installer (PyInstaller or equivalent) — top priority before a Beta build

Code-signing certificate for the installer (currently unsigned)

Workflow Design

Memory Engine

Plugin System

Git Integration

Testing Engine

Build System

Python runtime bundling for packaged/distributed builds (currently assumes `python` on PATH — dev-mode only)

Repositories/business logic for the remaining 6 tables (tasks, files, agents, memory, settings, history) — schema exists, repositories deferred to the sprints that need them; `projects` now has a repository (Sprint 7); `files` table remains intentionally unused (file content always comes from disk)

Resizable/drag panel splitters (sidebar and logger panel are currently show/hide toggles only)

FileEditor is a plain textarea by design (no syntax highlighting/language server) — a real code-editor experience (Monaco/CodeMirror) is future work

AI Chat Panel and Code Editor: locations/patterns reserved in `docs/ARCHITECTURE.md` (Sprint 6) but not yet implemented — no `components/chat/`, `ai/`, `window.nemi.ai.*`, or Monaco/CodeMirror integration exists yet

---

# AI TEAM

Founder

Nemee Chand Khichar

Chief Technology Officer

ChatGPT

Lead Software Engineer

Claude Code

Future AI Members

Gemini

DeepSeek

Qwen

Llama

OpenAI API

---

# TECH STACK

Frontend

React

TypeScript

Tailwind CSS

Backend

Python

Desktop

Electron

Database

SQLite

Version Control

Git

GitHub

Testing

Playwright

---

# DEVELOPMENT PRINCIPLES

Architecture First

Security First

Performance First

Modular Design

Production Ready

No Breaking Changes

Documentation First

Code Review Required

---

# CODING RULES

Never modify unrelated files.

Never delete files without permission.

Always read PROJECT_MEMORY.md first.

Always read AI_RULES.md before coding.

Always understand the entire project before implementation.

Always explain important changes.

Always update PROJECT_MEMORY.md after every completed sprint.

---

# DECISIONS LOCKED

Desktop Application

Electron

Python Backend

SQLite Database

GitHub Version Control

Claude Code as Main Coding AI

ChatGPT as Chief Architect

Plugin Based Architecture

Enterprise Grade Structure

---

# CHANGE HISTORY

Version 0.1

Repository Created

Folder Structure Created

Documentation Started

Claude Code Installed

Authentication Completed

Sprint 1 Completed — Electron + React + TypeScript + Vite Bootstrap

Sprint 1B Completed — Python Backend Foundation Bootstrap (backend/app, backend/tests, Ruff, Mypy)

Sprint 2 Completed — Desktop Application Shell (Tailwind v4, Theme Manager, VS Code style layout, hardened Electron main/preload)

Sprint 3 Completed — Architecture (docs/ARCHITECTURE.md), Database Design (docs/DATABASE_SCHEMA.md), AI Agent Workflow (docs/AGENTS_OVERVIEW.md) finalized; Dashboard module implemented with real content

Sprint 4 Completed — Backend finalized as FastAPI + Uvicorn; Electron ↔ Python process integration live (spawn, health-poll, graceful shutdown); SQLite DAL implemented (schema + LogsRepository); centralized logging and consistent error handling added; StatusBar wired to real backend health

Sprint 5 Completed — Filesystem ownership locked as Electron main (not Python); real Project Explorer with File Create/Rename/Delete/Open/Save; real-time filesystem watching via chokidar (Windows short-path libuv crash found and fixed); backend /logs API (GET+POST); real Logger Panel; file-operation audit logging; Dashboard New/Open Project buttons made real

Windows Alpha Build 1 Completed (0.1.0-alpha.1) — electron-builder producing an NSIS installer and portable exe, application icon generated, verified install/launch/uninstall on Windows; still requires Python pre-installed on the target machine (documented, not solved this build)

Sprint 6 Completed — Fixed the Alpha-breaking preload path bug (`window.nemi` was undefined on every launch); surfaced backend stdout/stderr in the Logger Panel with a level filter; extended BackendHealth with version/uptime and a StatusBar tooltip; debounced the filesystem watcher to fix a redundant-refetch storm on bulk file operations; reserved (docs only) the AI Chat Panel and Code Editor architecture for a future sprint

Sprint 7 Completed — Workspace & Project Management System: `projects` table repository implemented (`GET/POST /projects/recent|opened`, `DELETE /projects/{id}`, new `last_opened_at` column via idempotent migration); New Project Wizard (in-app modal) replaces the old native-save-dialog creation flow; Workspace Manager panel (list/switch/remove recent projects) added as a second Sidebar view; Recent Projects card added to Dashboard; workspace auto-save + restore-previous-session implemented via a new per-project-scoped `workspace/` Context+Provider+Hook module — verified via a 25-point live Playwright suite covering both full Sprint 1–6 regression and every new feature, reproduced clean twice

---

# NEXT MILESTONE

Sprint 8

Standalone Python runtime bundling (PyInstaller or equivalent) for a Beta build — the packaging pipeline itself is now proven (Alpha Build 1), this is the remaining gap before the app runs with zero prerequisites

AI Chat Panel and Code Editor implementation — architecture reserved in Sprint 6 (`docs/ARCHITECTURE.md`), ready to build against

True concurrent multi-project support (simultaneous open projects, not just switching) — deliberately deferred in Sprint 7; would require a per-project filesystem watcher map and a multi-root Explorer UI

AI Chat Panel and Code Editor implementation — architecture reserved in Sprint 6 (`docs/ARCHITECTURE.md`), ready to build against

---

# IMPORTANT

Every AI must read this file before doing any work.

This file is the permanent memory of the project.

Never ignore this document.