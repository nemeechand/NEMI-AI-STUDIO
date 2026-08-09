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

Sprint 8 — Completed (Standalone Python Runtime Bundling)

Goal:

Bundle a standalone Python runtime into the packaged app (PyInstaller or equivalent) so it runs with zero prerequisites — the top Beta blocker flagged since the Alpha build. Chosen by the founder from three candidates (the others: AI Chat Panel, Code Editor upgrade). Code-signing explicitly out of scope (separate, already-tracked Beta blocker).

Delivered:

Backend bundled via PyInstaller (`backend/nemi-backend.spec`, checked in and version-controlled — not ad-hoc CLI flags), onedir output (not onefile — Electron spawns the backend fresh on every app launch, and onefile's self-extraction would add latency to every single startup; onedir has none). `pyinstaller` added to `backend/requirements-dev.txt` as a build-time-only tool, same treatment Pillow got for the Alpha build's icon generation — never a runtime dependency

Found and fixed a real architectural issue during implementation: `backend/app/core/config.py`'s `_REPO_ROOT` path derivation (`Path(__file__).resolve().parents[3]`) breaks under a frozen executable — verified directly by launching the bundled exe standalone and watching it write `database/nemi.db` inside its own bundle folder instead of the real repo root. Fixed without any backend source change: `frontend/electron/backend-process.ts::startBackend()` now always sets `NEMI_DB_PATH`/`NEMI_LOG_FILE` (both already-supported overrides in `config.py` since Sprint 4) from `app.getPath('userData')` when packaged — the correct, conventional per-user app-data location, also fixing an incidental Alpha-build behavior of writing inside `resourcesPath`. Dev mode untouched

`backend-process.ts::resolveBackendCommand()` branches on `app.isPackaged` (mirroring the existing `resolveBackendDir()` pattern) — packaged builds spawn `nemi-backend.exe` directly with no args and no `PATH` dependency; dev mode remains `python -m app.main` from `PATH`, completely unchanged. The ENOENT error message now also branches: a missing bundled exe in a packaged build reports a corrupted-install message, not the old "install Python" message that would no longer be accurate

`frontend/package.json`: new `build:backend` script wired into `dist:win` before `electron-builder` runs; `extraResources` repointed from raw Python source to the PyInstaller onedir output — a packaged app no longer ships source requiring a system interpreter

Rigorously verified zero dependency on system Python: launched the bundled exe with `PATH` stripped of every Python installation on the dev machine (`python`/`python3`/`py` all confirmed unresolvable) — `/health`, `/logs`, and `/projects` all still worked correctly. Launched the full packaged app and confirmed via live process inspection (`Get-CimInstance Win32_Process`) that the actual running backend process is `nemi-backend.exe`, not `python.exe`. A 15-point Playwright-driven live verification (fresh Electron profile) covering backend/StatusBar/Logger/health plus the two Sprint-8-specific proofs (bundled-exe process identity, correct userData DB location) plus a Sprint 7 regression pass (Explorer, file CRUD, Workspace Manager) passed 15/15, reproduced clean on two consecutive runs

Also fixed a pre-existing `.gitignore` bug found while adding build-artifact ignores: the generic Python template's `*.spec` rule was silently swallowing the deliberately-checked-in `nemi-backend.spec` — added a negation exception

docs/ARCHITECTURE.md updated continuously: new STANDALONE RUNTIME BUNDLING section, Process Lifecycle bullet corrected (also fixed an unrelated stale line from Sprint 6 found in passing — stdout/stderr Logger Panel relay was already built, the doc still said "future work"), 2 new locked decisions

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build; pytest (24 passed, unchanged — backend source untouched), ruff check (all checks passed), mypy strict (0 issues, 26 source files); full `npm run dist:win` packaged build succeeded (installer + portable, ~96MB, up from ~80MB — expected growth, not a defect); 15-point live verification passed 15/15 twice

Known limitation: no true clean-machine/VM test was performed — this development machine has multiple Python installations already present, so PATH-stripping is the closest practical proxy available here, not a substitute for genuine clean-Windows verification, documented honestly rather than overclaimed. Installer remains unsigned (separate Beta blocker, unchanged, out of scope this sprint) — unsigned PyInstaller executables are somewhat more prone to AV/SmartScreen false positives, compounding that existing limitation

Sprint 9 — Completed (Professional Monaco Code Editor)

Goal:

Replace the plain-`<textarea>` editor with a real, VS Code-class Monaco-based editing experience: multi-tab editing, dirty indicators, auto save, manual save (Ctrl+S), Save All, Close/Close Others/Reopen Closed Tab, bounded Split Editor (horizontal + vertical, two groups), minimap, line numbers, code folding, word wrap, syntax highlighting, bracket matching, auto indentation, undo/redo, multi-cursor, find/replace, Quick Open (Ctrl+P), Global Search (Ctrl+Shift+F), and Command Palette (Ctrl+Shift+P) — for JavaScript, TypeScript, HTML, CSS, JSON, Markdown, Python, YAML, and XML — without breaking Sprints 1–8 or changing the Sprint 8 packaging architecture.

Scope decision (confirmed with founder before implementation): Split Editor is bounded to two groups (one active horizontal-or-vertical split), not VS Code's full recursive nested-pane system.

Delivered:

`monaco-editor` (pinned `0.50.0`, not `@monaco-editor/react` — the wrapper defaults to a CDN, which would violate Offline First) bundled locally via `vite-plugin-monaco-editor-esm`; scoped imports (`editor.all.js` + per-language contributions, not `import * as monaco`) reached only through a dynamic `import()` from `MonacoEditorPane.tsx` so Monaco's multi-MB bundle stays code-split out of the initial app load. `workspace-context.ts`/`WorkspaceProvider.tsx` extended from a single `openFilePath` into `EditorGroup`/`EditorTab`/`splitDirection` state (tabs, active tab, close/close-others, an in-memory reopen-closed-tab stack, split/unsplit, Save All via a per-group save-handler registry). New `frontend/src/components/editor/` (`MonacoEditorPane.tsx`, `TabStrip.tsx`, `monacoSetup.ts`, `languageForPath.ts`, `modelRegistry.ts` — a shared, ref-counted model registry so the same file open in both split groups never silently diverges, refined during implementation from the originally-planned per-group model map), `frontend/src/commands/` (Command Palette registry + `useCommand()` + fuzzy matching), and `components/search/GlobalSearch.tsx` (new third Sidebar panel). `filesystem.ts` gained `listAllFiles()`/`searchInFiles()` (new `fs:list-all-files`/`fs:search-in-files` IPC) for Quick Open/Global Search, same Electron-main ownership as the rest of `fs`. Auto Save added as an opt-in Settings toggle (off by default, ~1s debounce).

Found and fixed three real bugs during live verification (not scope creep — direct blockers of this sprint's own acceptance criteria): (1) `monacoSetup.ts` initially imported only the rich `language/typescript`/`css`/`html` contributions, omitting their `basic-languages` counterpart — those rich contributions only wire up worker/diagnostics via `onLanguage()`, which never fires until the `basic-languages` half actually registers the language id, so JS/TS/CSS/HTML silently rendered with zero syntax highlighting and the TypeScript worker never even loaded; fixed by importing both halves for every full-language-service pair. (2) `editor.addCommand()`'s Ctrl+S/Ctrl+W handlers read the active file path via `editor.getModel()?.uri.fsPath`, but Monaco's `Uri.file()`/`.fsPath` round-trip lowercases the Windows drive letter, silently missing the model registry's original-case map key and making save/close no-ops on Windows; fixed by tracking the active path in a ref instead. (3) `AppShell.tsx`'s Ctrl+Shift+P/Ctrl+Shift+F handlers compared `event.key` case-sensitively against a lowercase/uppercase literal, but a real Shift+letter keypress reports an uppercase `event.key` — the lowercase Command Palette check therefore never matched on a real keyboard (it only appeared to work under Playwright's non-standard key-echo behavior); fixed by comparing `event.code` (layout/case-independent) for every modified-letter shortcut.

docs/ARCHITECTURE.md gained a new "MONACO CODE EDITOR (locked — Sprint 9)" section (resolving the Code Editor half of Sprint 6's reservation — the AI Chat Panel half remains reserved), the IPC namespace list and Presentation Layer component list updated, four new locked-decision entries; docs/SPRINT_9_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean, `release/` added to `.prettierignore`), vite build; pytest (24 passed, unchanged — no backend changes), ruff check (all checks passed), mypy strict (0 issues, 26 source files). Live Playwright verification across four suites, each reproduced clean on two consecutive fully-reset runs: a 16-point core suite (tabs, split, save, undo/redo, dialogs, per-language tokenization spot checks); a 17-point extended suite (all 9 required languages' syntax highlighting, Auto Save writing to disk without Ctrl+S, Global Search find+open, a ~1.3MB large file staying responsive, session restore surviving reload with an active split and multiple tabs intact); a 10-point full Sprint 1–8 regression with the real dev backend running (StatusBar tooltip, Logger backend-sourced rows, Explorer expand, Workspace Manager, zero IPC failures); and a 5-point spot-check of a freshly built `npm run dist:win` packaged app (bundled PyInstaller backend healthy, Monaco opens files, TypeScript highlighting, Ctrl+S save) confirming Sprint 8's packaging architecture is genuinely unaffected, not just unmodified in source.

Known limitation: Monaco renders through its own internal canvas-backed event handling, so a few interaction classes (precise multi-cursor via Alt+Click, drag-based UI) were verified through Monaco's own API/model state rather than synthetic pixel-level DOM events — consistent with this project's practice of stating verification boundaries honestly. AI Chat Panel remains architecture-only (Sprint 6 reservation, not built). Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

Sprint 10 — Completed (AI Chat & Agent Framework)

Goal:

Implement the AI layer reserved since Sprint 6: an AI Chat Panel (right sidebar) with streaming responses, conversation history, a real four-provider abstraction (OpenAI, Claude/Anthropic, Gemini, Ollama — no mock providers), context-aware chat using the active workspace, project indexing, file references, code-selection-to-Ask-AI, Explain/Fix/Generate/Refactor Code, AI actions from the editor context menu, a token usage indicator, cancellation support, error handling, and conversation persistence — without breaking Sprints 1–9, with full regression testing.

Delivered:

Backend: `backend/app/ai/` — `AIProvider` abstraction with one real SDK-backed implementation per provider (`openai`, `anthropic`, `google-genai` official SDKs; Ollama via `httpx` against its local `/api/chat`, no SDK needed since it's a local server) normalizing each provider's own streaming shape into `StreamChunk`/`StreamDone` events and SDK exceptions into shared `ProviderError` subclasses. New `ai_conversations`/`ai_messages` tables (normalized, not shoehorned into the generic `memory` table — see docs/DATABASE_SCHEMA.md) with `ConversationsRepository`/`MessagesRepository`. New `backend/app/api/ai.py`: provider list, Ollama live model list, conversation CRUD, and a Server-Sent-Events streaming endpoint that persists both the user message and the assistant's response (or partial response, on cancellation) every time, never just on success.

Electron: API keys are encrypted with `safeStorage` and persisted only in `app.getPath('userData')` — never in SQLite (upholds the pre-existing "no column stores secrets" convention in docs/DATABASE_SCHEMA.md) and never sent anywhere except attached to the one backend request that needs it, which never persists it. New `window.nemi.ai.*` IPC namespace (provider/key management, conversation CRUD, streaming send/cancel) with streaming relayed as `ai:stream-event` push events, the same pattern `fs:changed` already established.

Frontend: new `ai/` Context+Provider+Hook module and `components/chat/` (Chat Panel, message list with a dependency-free Markdown-lite renderer for code blocks, provider/model selector, token usage indicator, conversation history, chat input with `@file` fuzzy-reference picker built on Sprint 9's `listAllFiles`). AI Chat Panel added as a new right-sidebar region in `AppShell.tsx`. Five AI actions registered on the Monaco editor via `editor.addAction()` (Ask About Selection, Explain, Fix, Refactor, Generate), each also bound to an explicit keybinding. Settings modal gained an AI Providers section for key entry/removal. `ProjectContext` extended with `projectId` (the database UUID, previously only `projectPath` was exposed) so conversations can be scoped by the real foreign key.

Found and fixed four real bugs during live verification, each caught by testing against a real locally-installed Ollama model (deliberately installed this sprint specifically to have at least one provider testable end-to-end without needing a paid API key) rather than any mock: (1) the initial provider/conversation list fetch on app launch had no retry, so it permanently lost the race against the backend's own startup time on a fresh launch, leaving the provider dropdown empty for the whole session — fixed with a bounded retry matching the backend's own startup timeout. (2) Cancelling a request before its first chunk arrived left the persisted message as `status: complete` with empty content instead of `cancelled`, because a disconnect at that exact point delivers `GeneratorExit` past the streaming loop's own disconnect check — fixed by re-checking disconnection state in a `finally` block that always runs. (3) Ollama has no hardcoded default model (unlike the cloud providers), so a fresh session's `selectedModel` started empty and any send silently failed a 422 validation error with no visible feedback — fixed by auto-selecting the first locally-available model once the real list loads, plus wrapping the whole send flow in proper error handling so any remaining failure surfaces visibly instead of becoming an unhandled rejection. (4) Monaco's right-click context menu could not be reliably automated by Playwright in this Electron build (confirmed, not assumed — neither a real right-click at exact rendered coordinates nor Monaco's own F1 Quick Command opened anything), the same category of limitation already documented for Monaco in Sprint 9 — worked around by giving the five AI editor actions real keybindings, which are both genuine keyboard-accessible UX and a reliably automatable verification path.

docs/ARCHITECTURE.md gained a new "AI CHAT & AGENT FRAMEWORK (locked — Sprint 10)" section resolving the AI Chat Panel half of Sprint 6's reservation, the IPC namespace and Presentation Layer component lists updated, six new locked-decision entries; docs/DATABASE_SCHEMA.md updated with the two new tables and their justification; docs/SPRINT_10_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build; pytest (37 passed, 13 new — including a live end-to-end test against the real local Ollama model, skipped gracefully if Ollama isn't present rather than mocked), ruff check (all checks passed), mypy strict (0 issues, 40 source files). Live Playwright verification across three suites plus a full Sprint 1–9 regression pass, every suite reproduced clean on at least two consecutive fully-reset runs: a 14-point core AI suite (real streaming against a live local model, cancellation, token usage, conversation history, persistence across reload, graceful missing-key error); a 14-point secondary suite (Settings key save/clear round-tripping through real `safeStorage` encryption, editor AI action keybinding triggering a real auto-sent request with file context attached, `@file` reference picker and attachment); an 18-point full Sprint 1–9 regression (StatusBar, Logger, Explorer, Workspace Manager, Monaco open/multi-tab/save/split/highlighting, Quick Open, Command Palette, Global Search, all coexisting correctly with the new AI Chat Panel).

Known limitation: only Ollama could be exercised with genuine live network calls in this environment (no OpenAI/Anthropic/Gemini API keys available) — those three providers' request/response mapping and error-normalization logic is implemented against each SDK's actual installed API surface (verified by inspection, not memory) and covered by non-network unit tests (e.g. the real `MissingApiKeyError` path), but a live call to each cloud provider has not been performed, stated honestly rather than overclaimed. Multi-agent orchestration (Planner/Developer/Reviewer/etc.) and semantic/embedding-based project indexing remain explicitly out of scope, not fabricated. Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

Sprint 11 — Completed (Agent Orchestration Framework)

Goal:

Build the first production-ready version of the multi-agent orchestration framework on top of Sprint 10's provider/context foundation: Planner/Developer/Reviewer/Tester agents, an Agent Manager, Agent Memory, an Agent Task Queue, an Agent Status Dashboard, agent-to-agent communication, parallel execution where safe, automatic retries, failure recovery, conversation and execution history, and a provider-independent architecture — integrated with the existing AI Chat Panel, Workspace, Monaco Editor, Project Manager, and Backend, without breaking Sprints 1–10.

Delivered:

Backend: `backend/app/ai/agent_roles.py` parses `agents/*.md` into system prompts (only `planner`/`developer`/`reviewer`/`tester` participate in the automated queue — `ORCHESTRATED_ROLES`), rewriting NEMI-self-referential text to refer to the user's project. New `agent_tasks` table (dependency-gated pipeline scheduling — see docs/DATABASE_SCHEMA.md) with `AgentTasksRepository` (`list_runnable()`, `mark_failed_or_retry()`, `cascade_cancel_dependents()`, `retry()`); `AgentsRepository` seeds the `agents` table from the role files at startup; `MemoryRepository` gives the schema-ready-since-Sprint-4 `memory` table its first real implementation, used for durable agent-to-agent handoff (`type='task'`). New `backend/app/ai/orchestration/manager.py`: a stateless `run_cycle()` that runs exactly one scheduling pass (no internal loop, no server-side API keys — preserving Sprint 10's "keys never persisted server-side" decision), executing up to `MAX_CONCURRENT_TASKS = 3` runnable tasks in parallel via `asyncio.gather`, calling Sprint 10's existing `AIProvider` abstraction directly (provider-independent by construction, not a second abstraction layer). Developer-stage file changes are parsed from fenced ` ```file:path``` ` blocks into `proposed_files` — parsed only, never auto-written to disk. New `backend/app/api/agents.py` (`GET /agents`, task CRUD, `POST /agents/run-cycle`).

Electron: `agent-client.ts` mirrors `ai-client.ts`'s pattern for the new `window.nemi.agents.*` IPC surface. `main.ts` runs a 4-second `setInterval` that decrypts whatever provider keys `safeStorage` currently holds and calls `POST /agents/run-cycle` — the actual scheduling cadence, since the backend itself holds no loop and no keys.

Frontend: new `agents/` Context+Provider+Hook module (`AgentsProvider.tsx` — task list with a 5-second backup poll alongside push-driven refresh, `createPipeline`/`cancelTask`/`retryTask`/`applyProposedFile`); shared `fetchWithStartupRetry` extracted from `AiProvider.tsx` into `lib/` so `AgentsProvider` doesn't duplicate the same mount-time backend-startup-race retry logic. New `components/agents/` — an Agents Dashboard sidebar panel (new `Sidebar.tsx` entry, task cards with role icon/status badge, expandable detail showing description/result/error, per-file Apply buttons for proposed files, Cancel/Retry actions gated by status) and a New Task modal (title/description/provider/model/priority/stage-checkboxes, defaulting to all four stages in order). `AiContextValue` gained `openConversation()` so the Dashboard can jump from a task straight into the exact conversation that did its work; `ai_conversations` gained nullable `agent_id`/`task_id` columns so agent-scoped conversations get a visible badge (Bot icon) in the Chat Panel's history list, distinct from user-initiated chats.

Found and fixed one real bug during live verification: `backend-process.ts`'s `state` tracking latched permanently into `'error'` once the 15-second `STARTUP_TIMEOUT_MS` elapsed, even when the backend process was still alive and became healthy moments later (confirmed live — a cold dev-mode start doing heavy first-import work, worsened by this sprint's own added agent-role-file seeding at startup, legitimately took longer than 15s on a loaded machine) — the StatusBar would then show "Backend Offline" for the rest of the session even though every actual request kept working. Fixed with a background watcher that keeps polling after a startup timeout (while the child process is still alive, not after a genuine crash) and recovers `state` to `'ready'` once the backend actually responds.

docs/ARCHITECTURE.md gained a new "AGENT ORCHESTRATION FRAMEWORK (locked — Sprint 11)" section, the IPC namespace list updated to six namespaces, six new locked-decision entries; docs/DATABASE_SCHEMA.md updated with the new `agent_tasks` table, `ai_conversations`'s two new columns, and `memory`'s first real implementation; docs/SPRINT_11_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build; pytest (53 passed, 16 new — including a live end-to-end two-stage pipeline test against the real local Ollama model, skipped gracefully if Ollama isn't present rather than mocked), ruff check (all checks passed), mypy strict (0 issues, 47 source files). Live Playwright verification (real Ollama, no mocks), each suite reproduced clean: a full-pipeline suite (sequential planner→developer handoff via the real `memory` table, a deliberately-unresolvable-model pipeline exhausting automatic retries and cascade-cancelling its dependent stage, two independent single-stage pipelines observed `running` simultaneously, real UI form interaction creating a task and clicking Cancel through the actual Agents Dashboard, screenshots confirming correct rendering); a full Sprint 1–10 regression (Explorer file open via a real click, Recent Projects card opening a project through the real `ProjectContext.openProject()` flow, Monaco editor open/edit/Ctrl+S persisting to disk, a real AI Chat message sent and answered via Ollama) — all four confirmed intact after this sprint's shared-file changes.

Known limitation: the tiny `qwen2.5:0.5b` Ollama model used for live testing does not reliably follow the exact ` ```file:path``` ` instruction format for Developer-stage proposed files (it produces plain code blocks instead) — this is a small-model instruction-following limitation, not a parser defect (`_extract_proposed_files()` was separately verified correct against a compliant string via a direct unit test), so the Apply-button flow is verified by parser unit test and UI wiring, not by an end-to-end proposed-file live capture in this environment. Only the four orchestrated roles (planner/developer/reviewer/tester) are scheduled — the remaining `agents/*.md` roles stay reference documents. A task's dependency is a single link, not a graph (linear chains only, no fan-out/fan-in). Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

Sprint 12 — Completed (Workflow Engine & AI Project Manager)

Goal:

Build an Autonomous AI Project Manager and Workflow Engine on top of Sprint 11's Agent Orchestration Framework: accept a high-level goal, break it into milestones, create sprint tasks automatically, and run them through the existing Planner/Developer/Reviewer/Tester pipeline — with a task dependency chain, automatic scheduling, pause/resume/cancel, auto-resume after restart, a Sprint Progress Center (percentage, live task list, current agent, ETA, logs, counters, resource usage), shared-memory agent collaboration with conflict detection, and a configurable Human Approval Mode (Fully Automatic / Review Before Apply / Manual Approval) — integrated with the existing AI Chat Panel, Monaco Editor, Workspace Manager, Explorer, Project Manager, Backend, and AI Providers, without breaking Sprints 1–11.

Delivered:

Backend: the AI Project Manager reuses the existing Planner role rather than adding a new agent persona — `POST /workflows` creates a `workflows` row (`status='planning'`) plus a single goal-decomposition `agent_tasks` row (Planner role, no milestone yet), which `run_cycle()` executes exactly like any other task (no synchronous API call, no second execution path). New `backend/app/ai/orchestration/project_manager.py`: `parse_milestones()` parses the AI's `### MILESTONE: <title>` output (mirroring `_extract_proposed_files()`'s regex convention); `create_milestone_pipelines()` turns each parsed milestone into its own `milestones` row plus a full planner/developer/reviewer/tester pipeline, chained into one linear sequence across the whole workflow (each milestone's first stage depends on the previous milestone's last stage) — a deliberate single-link chain, not a multi-parent dependency graph. New `workflows`/`milestones` tables (see docs/DATABASE_SCHEMA.md); `agent_tasks` gained six additive columns (`workflow_id`, `milestone_id`, `requires_approval`, `approved_at`, `proposed_files_applied`, `conflict_warning`) without touching its existing `status` CHECK constraint. Workflow Pause/Resume is implemented entirely by filtering `list_runnable()` against the parent workflow's status — zero changes to a task's own status, so Resume picks back up exactly where it left off. Human Approval Mode's "Manual" tier gates on `requires_approval`/`approved_at` rather than a new status value (avoiding a CHECK-constraint table rebuild). `_sync_workflow_progress()` re-derives milestone/workflow status from real task states after every transition, leaving an already-terminal workflow alone. `_detect_conflicts()` flags overlapping Developer-proposed file paths across tasks in the same workflow. `AgentTasksRepository.requeue_orphaned_running_tasks()`, called once at backend startup, implements "Auto Resume after restart" — any task still `'running'` can only be a crash leftover.

Electron: new `workflow-client.ts` mirrors `agent-client.ts`'s pattern for the `window.nemi.workflows.*` IPC surface; `agents:*` gained `approveTask`/`markFilesApplied`. New `getBackendResourceUsage()` in `backend-process.ts` reports the real backend child process's memory (`Get-Process`, exact) and CPU (diffed `TotalProcessorTime` between two samples, labeled approximate) — Windows-specific, matching this app's only packaged target, returns `null` elsewhere.

Frontend: new `workflows/` Context+Provider+Hook module (`WorkflowsProvider.tsx`) — also where Fully Automatic mode's auto-apply lives (the backend can't write files per Sprint 5, and Electron main doesn't reliably know the current project, but the renderer does): it scans active `'auto'`-mode workflows' completed Developer tasks for unapplied proposed files, writes them via the existing `fs.writeFile()` path, then calls the new mark-files-applied endpoint. New `components/agents/` additions: a Goals tab alongside the existing Tasks tab in the Agents Dashboard, `NewWorkflowModal.tsx` (goal/title/provider/model/approval-mode), `WorkflowsList.tsx`, and `SprintProgressCenter.tsx` (percentage bar, completed/running/queued/failed counters, current executing agent, ETA estimate, milestone breakdown with per-task Approve buttons, recent backend activity tail, resource usage, Pause/Resume/Cancel).

Found and fixed one real bug during live UI verification: the Pause button was conditioned on `status === 'queued' || 'running'`, so it never appeared while a workflow was still `'planning'` (its goal-decomposition task not yet finished) even though the backend already allowed pausing from that state — fixed by including `'planning'` in the button's visibility condition, confirmed via a follow-up live run showing Pause/Resume correctly toggling and the Running counter staying accurate for an in-flight task after pausing.

docs/ARCHITECTURE.md gained a new "WORKFLOW ENGINE & AI PROJECT MANAGER (locked — Sprint 12)" section, the IPC namespace list updated to eight namespaces, seven new locked-decision entries; docs/DATABASE_SCHEMA.md updated with the new `workflows`/`milestones` tables and `agent_tasks`'s six new columns; docs/SPRINT_12_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build; pytest (72 passed, 19 new — including a live end-to-end goal-decomposition test against the real local Ollama model, skipped gracefully if Ollama isn't present rather than mocked), ruff check (all checks passed), mypy strict (0 issues, 42 source files). Live Playwright verification (real Ollama, no mocks) across multiple runs: manual-approval gating confirmed (task stays queued until explicitly approved, then a real decomposition call ran and — on one run — produced real, correctly-parsed milestones with a pipeline that started executing); pausing immediately after creation (while still `'planning'`) correctly blocks the decomposition task from ever being picked up, resume correctly releases it; cancel correctly cascades to a queued decomposition task; a workflow created through the real New Goal UI form rendered correctly in the Sprint Progress Center (percentage, counters, ETA, approval mode, Recent backend activity) and responded correctly to a real Pause button click (Paused status, Resume button appears, Running counter still reflects the in-flight task). A concurrent run's decomposition task was observed genuinely picked up and executing for an extended period without completing — diagnosed as Ollama itself serializing multiple simultaneous real model calls from several workflows created in quick succession during testing, not an orchestration defect (the scheduling/execution mechanism was independently confirmed correct in the same and other runs).

Known limitation: as in Sprint 11, the tiny local test model's instruction-following for structured output formats (here, `### MILESTONE:` sections) is not fully reliable — an empty parse fails the workflow with a visible error rather than hanging silently, and this exact path is unit-tested; a full live happy-path run (real milestones parsed, pipeline created and started) was also observed directly in this sprint's testing, not only the graceful-failure path. Conflict detection is verified directly (two tasks seeded with an overlapping proposed path) rather than by forcing two live models to collide, which isn't reliably reproducible on demand. Milestone/pipeline chains are linear (one dependency link per task), not a true multi-parent DAG — deliberately out of scope, consistent with Sprint 11's original scoping of `depends_on_task_id`. Resource usage reporting is Windows-only. Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

Sprint 13 — Completed (Live Development Dashboard & Intelligence Center)

Goal:

Create a real-time operational dashboard for monitoring every AI agent, workflow, sprint, build, test, and project activity from one place: a Live Sprint Center, Live Agent Monitor, Live Workflow View, Live Terminal, AI Thinking Panel, Resource Monitor, Token & Cost Center, Build Center, Pause/Resume Center, Execution History, Notification Center, and Performance Dashboard — integrated with the existing platform, preserving Sprints 1–12.

Delivered:

Backend: `agent_tasks` gained one additive column, `live_output` (flushed by `manager.py`'s streaming loop every 1.5s, cleared on completion/failure/cancellation) — genuine partial model output for the AI Thinking Panel, not fabricated reasoning. `HistoryRepository` gives the schema-ready-since-Sprint-3 `history` table its first real implementation, recording workflow/task lifecycle events from the API/orchestration layer. New `StatsRepository` computes performance stats (success/failure/retry rate, avg task/agent duration, tasks/hour) and token/cost summaries (session/day/month windows, from real `ai_messages` token counts) fresh on every call — no maintained running total, appropriate at this app's data scale. New `app/ai/pricing.py`: a small published-list-pricing table for cost *estimates* (a model outside it reports `null`, never a guess; Ollama is always $0). New `GET /stats/performance`, `/stats/tokens`, `/history`, and `POST /workflows/{id}/restart` (requeues a workflow's failed/cancelled tasks, leaves completed ones alone) endpoints.

Electron: new `git-status.ts` (real branch/ahead-behind/dirty/recent-commits via the `git` CLI, scoped to the *open project*, never NEMI's own source — never throws, reports `isRepo: false` gracefully) and `build-runner.ts` (real `npm run build`/`npm test`/`npx tsc --noEmit` child processes, detected via the open project's actual `package.json` scripts so a button never triggers a command that would just fail, with streamed output and cancellation). New `system-metrics.ts`: real system-wide CPU (sampled via `os.cpus()` tick-diffing, since `os.loadavg()` is always `[0,0,0]` on Windows), RAM, disk (`Get-PSDrive`, Windows-only), and total Electron process memory (`app.getAppMetrics()`).

Frontend: new `intelligence/` Context+Provider+Hook module (`IntelligenceProvider.tsx`) polling stats/git/system-metrics/build-runner-output and deriving real-time notifications from genuine state transitions. New `components/intelligence/` — `IntelligenceCenter.tsx` (a 12-section dashboard replacing the main content area, opened via a new HeaderToolbar button or `Ctrl+Shift+I`) and one component per section, each built on real data: Sprint Center (percentage, phase, ETA, elapsed time, timeline, remaining tasks — auto-following whichever workflow was updated most recently); Agent Monitor (per-role Idle/Running/Waiting/Completed/Failed/Retrying, derived client-side from already-polled task data); Workflow View (the requested Goal→...→Push visual chain, with Documentation/Commit/Push explicitly marked "not yet automated" rather than faked); Terminal (search/filter/export over real backend + build/test output); AI Thinking (live_output plus objective/milestone/dependency/action); Resources; Tokens & Cost; Build Center; Pause/Resume Center (adds Restart Workflow to Sprint 12's existing controls); History; Notifications (persistent list + auto-fading toasts); Performance.

Found and fixed two real bugs during live verification: (1) the Pause button in the new Sprint Center section, same class of bug as Sprint 12's original — fixed by including `'planning'` in scope from the start this time, informed by the Sprint 12 fix. (2) Notifications re-fired for tasks/workflows that had already reached a terminal status in a *previous* session, the instant a fresh dashboard mounted — confirmed live (old "Smoke test: forced failure" tasks from earlier testing surfaced as brand-new "API / Task Error" toasts on a clean launch) — fixed by keying the "already seen" tracking per entity id rather than a single loaded/not-loaded flag, so a status already on record when first observed establishes the baseline silently instead of counting as a transition.

docs/ARCHITECTURE.md gained a new "LIVE DEVELOPMENT DASHBOARD & INTELLIGENCE CENTER (locked — Sprint 13)" section, the IPC namespace list updated to eleven namespaces, six new locked-decision entries, version bumped to 2.0; docs/DATABASE_SCHEMA.md updated with `history`'s first implementation and `agent_tasks.live_output`; docs/SPRINT_13_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build; pytest (86 passed, 14 new), ruff check (all checks passed), mypy strict (0 issues, 46 source files). Live Playwright verification (real Ollama, real git repo, real npm scripts, no mocks): all 12 sections navigated without error; Git Status showed the real branch/last-commit/ahead-behind for this repo; Resource Monitor accurately reflected genuine system load (100% CPU, 96% RAM) while a real `Run Verification` (`npx tsc --noEmit`) executed on the open project, explaining transient IPC timeouts elsewhere as real resource contention, not a defect; Build Center correctly enabled/disabled Run Build/Run Tests based on real `package.json` script detection; a correctly project-scoped workflow populated Sprint Center with real live data; the notification-staleness bug above was found, fixed, and reconfirmed clean on a follow-up run.

Known limitation: "AI logs" (requested as a distinct Live Terminal category) is folded into "Backend" logs since Sprint 4 already locked AI/orchestration logging into that same stream, not a separate one — stated honestly rather than fabricating a fifth log source. "Network" reports backend connectivity, not bandwidth (no cross-platform throughput API). Documentation/Commit/Push pipeline stages have no automation behind them yet (git integration is read-only this sprint) and render as explicitly not-yet-automated. Resource/disk metrics are Windows-only. Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

Sprint 14 — Completed (Knowledge Graph & AI Memory Engine)

Goal:

Enable NEMI AI Studio to remember, connect, search, and reason over every project artifact across time: Persistent AI Memory, a Knowledge Graph linking Projects/Files/Functions/Classes/Agents/Workflows/Commits/Users/Requirements, Semantic Search, Architecture Intelligence (why was this written / where used / what breaks / who changed it), Code Impact Analysis, Long-term Memory, AI Learning from previous sprints, and Automatic Documentation (diagrams/dependency maps) — preserving Sprints 1–13.

Delivered:

Backend: three new tables — `graph_nodes`/`graph_edges` (a relational knowledge graph, not a dedicated graph database, matching this app's SQLite-only architecture) and `embeddings` (real vectors, JSON-encoded, brute-force cosine similarity at query time). `KnowledgeRepository` provides idempotent find-or-create node/edge writes. `backend/app/knowledge/indexer.py::index_project()` walks the open project's files directly from disk in the backend — a deliberate, scoped exception to Sprint 5's Filesystem Ownership rule, justified as bulk read-only analysis feeding straight into SQLite rather than interactive CRUD — and builds `file`/`function`/`class` nodes plus resolved same-project `imports` edges via a new heuristic (regex-based, explicitly not AST) code parser (`backend/app/knowledge/code_parser.py`) covering Python/JS/TS. `files` (schema-ready since Sprint 3) got its first real repository. Commit/author/`modifies` nodes come from git history Electron already gathers (`git-status.ts::getCommitLog()`, one `git log --name-only` call) — git access itself stayed Electron's, per Sprint 13's ownership rule. `memory`'s four remaining unused `type` values (`long_term`/`knowledge`/`project`/`conversation`) gained real writers: a sprint-summary entry on workflow completion, `bug:`/`fix:` entries on permanent task failure / retry-then-succeed, and a `change:` entry when a Developer task's files are applied. `manager.py::_related_past_experience()` — real, cross-project, token-overlap retrieval over recorded memory (no embedding call, so it works without any provider configured) — injects relevant past-sprint context into the Planner's prompt before goal decomposition (AI Learning). New `app/ai/embeddings.py`: an `EmbeddingProvider` abstraction for OpenAI/Gemini/Ollama (Anthropic excluded — no embeddings API exists) parallel to the existing chat-provider abstraction. New `app/knowledge/semantic.py`: `gather_candidates()` (capped at 150 files, uncapped memory/workflow candidates), `run_embedding_pass()`, `semantic_search()` (real cosine similarity) with an honest `keyword_search()` fallback — `POST /knowledge/search` reports which mode it actually used. New `app/knowledge/analysis.py`: real reverse-graph-traversal impact analysis with a stated, simple risk heuristic (never presented as ML), and real Mermaid dependency/architecture diagram generation. New `/knowledge/*` API router (index, graph, stats, embedding-providers, embed, search, impact, context, diagram, memory).

Electron: new `knowledge-client.ts` (the `window.nemi.knowledge` IPC surface, the twelfth namespace) and `git-status.ts::getCommitLog()`/a file-history helper for Architecture Intelligence's real git-log retrieval. `main.ts` resolves API keys server-side (Electron main via `safeStorage`) for embed/search calls, the same pattern `ai:send-message` already established — never the renderer holding a key.

Frontend: new `knowledge/` Context+Provider+Hook module (`KnowledgeProvider.tsx`) and a new Sidebar panel, `KnowledgePanel.tsx` (Index Project, real graph stats, Semantic Search with honest mode labeling, Generate Embeddings, dependency/architecture diagram export as downloadable `.mmd` files — no in-app Mermaid renderer is bundled). A new Monaco editor action, "AI: Explain File History & Impact" (`Ctrl+Shift+Alt+H`), gathers real graph relationships + recorded memory + real git history and feeds it into the existing `askAboutSelection()` plumbing — Architecture Intelligence answers via retrieval fed to the AI Chat Panel, not the model reasoning unaided.

Found and fixed two real issues during implementation/live verification: (1) the Python heuristic parser's function/class regexes were originally capped to 0–3 leading spaces, intended to mean "top-level," but that silently excluded every method inside a class (4-space indent) — caught by a unit test expecting a class method to be found; fixed by matching any leading whitespace, consistent with the parser's own documented "doesn't understand scope" limitation. (2) Bulk-embedding a real, large project (this repo's own ~684 indexed files) through a local CPU-bound Ollama model was found live to take far longer than a single blocking request should reasonably wait for — not a defect in the embedding call itself (a single-text round trip was already fast and unit-tested), but an honest scale problem with no bound in place; fixed by capping file-embedding candidates at 150 (memory/workflow candidates stay uncapped), reducing the provider batch size to 16 texts, raising both the Electron-side and Ollama-provider timeouts to match a genuine bulk operation (same tier as Sprint 13's build/test runners), and re-verifying live against both the full real repo (structural indexing: graph/impact/diagrams, all fast) and a small real five-file subset (embeddings/semantic search, which returned genuinely differentiated cosine-similarity relevance for an on-topic query versus an intentionally unrelated sanity-check query).

docs/ARCHITECTURE.md gained a new "KNOWLEDGE GRAPH & AI MEMORY ENGINE (locked — Sprint 14)" section, the IPC namespace list updated to twelve namespaces, ten new locked-decision entries, version bumped to 2.1; docs/DATABASE_SCHEMA.md updated with the three new tables, `files`'s first implementation, and `memory`'s remaining types, version bumped to 1.7; docs/SPRINT_14_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean, except one pre-existing unrelated `tsconfig.json` formatting warning not touched this sprint), vite build; pytest (122 passed including a genuine, non-mocked live Ollama embedding round trip — no skips), ruff check (all checks passed), mypy strict (0 issues, 56 source files). Live Playwright verification (real Ollama, real git history, no mocks) against this repo itself: indexed 684 real files in ~1.7s producing 1,477 real graph nodes and 2,334 real edges; impact analysis on a real file correctly found its real dependents; dependency and architecture Mermaid diagrams generated from real data; keyword-fallback search correctly triggered and labeled itself when no embedding provider was selected; a small real 5-file subset was fully embedded via local Ollama and semantically searched, returning sensible, differentiated relevance; real git history retrieved for a real file showed its three actual recent commits; the Knowledge sidebar panel rendered correctly with live stats. Full Sprint 1–13 regression pass (fresh isolated profile): all twelve `window.nemi` IPC namespaces present, Explorer/Monaco/Agents/Knowledge panels all render and function, all backend endpoints reachable through the real IPC boundary (never a direct renderer fetch, confirming Sprint 2's CSP is still enforced), and the Sprint 13 Intelligence Center still opens cleanly.

Known limitation: code parsing is heuristic/regex-based, not a full AST parser, for Python/JS/TS only. Unresolved (external package) imports are not modeled as graph nodes. Embedding generation is a single synchronous request with a generous timeout, not yet a cancellable background job — a very large project's full embedding pass can still take several minutes even with the 150-file cap. "Requirement" graph nodes are derived 1:1 from a workflow's goal text, since no separate requirements-intake feature exists. No in-app Mermaid rendering (diagrams export as `.mmd` files). Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

Sprint 15 — Completed (Autonomous Coding Engine)

Goal:

Transform the platform from an AI-assisted IDE into one that can implement a complete feature end to end with minimal intervention: a Feature Execution Engine, Code Planning Engine, Autonomous Coding grounded in real project context, a Safe Change Engine with rollback, a Review Engine, a Test Engine, a Documentation Engine, Feature Approval, and live dashboard integration — preserving Sprints 1–14.

Delivered:

Almost entirely built by extending Sprints 11–14's existing Agent Orchestration Framework, Workflow Engine, and Knowledge Graph rather than a parallel system — a "Feature Execution Engine" request is a Sprint 12 workflow goal; no new intake mechanism exists. `MILESTONE_FORMAT_INSTRUCTION` now asks the Planner to state affected/new files and DB/API/UI/doc/test implications per milestone (Code Planning Engine) — a prompt-only enrichment, `parse_milestones()`'s parser is untouched. `manager.py::_execute()` now grounds Developer tasks with real Knowledge Graph keyword matches against indexed files/functions/classes (`_related_project_code()`) and grounds Reviewer tasks with real `analyze_impact()` dependency/risk data for the preceding Developer task's proposed files — giving the `agents/developer.md`/`agents/reviewer.md` prompts' existing "read existing files first"/"risk level" instructions (unchanged since Sprint 3) something real to act on, rather than rewriting the prompts.

Safe Change Engine: new `file_snapshots` table (task_id FK, write-once per (task, file)) records each file's real pre-apply content, captured by Electron and sent alongside the existing `mark-files-applied` call. `GET /agents/tasks/{id}/rollback-info` (404 if nothing recorded) and `POST /agents/tasks/{id}/mark-rolled-back` (real restore/delete, confirmed by Electron) back a new Rollback button in the Agents Dashboard. This closed a real pre-existing gap: the manual per-file Apply button previously only tracked "applied" in local UI state and never called the backend at all, so Sprint 14's architecture-change recording — and now this sprint's rollback baseline — silently never fired outside Fully Automatic mode; fixed by having `applyProposedFile()` capture and report a real snapshot on every apply, manual or automatic.

Test Engine: reuses Sprint 13's real `build.runTests()` — no new execution mechanism — triggered once per completed workflow (tracked per-project in `localStorage`) only when a real test script was detected; the real result posts to `POST /workflows/{id}/test-result`, persisted as `workflows.last_test_result`. Documentation Engine: new `app/ai/orchestration/documentation.py`, the first real consumer of `agents/documentation.md` — deliberately run as a standalone real LLM call rather than a fifth orchestrated `agent_tasks` role, avoiding the one kind of migration (widening the `agent_role` CHECK constraint) every sprint since 11 has deliberately avoided. Strictly grounded in real facts (`_gather_real_facts()`: goal, milestones, files actually changed, real test result) — never free-form; a missing API key/role fails silently (`None`, logged), never fabricating a summary. Triggered automatically once per workflow completion (`documentation_generated_at` as the durable idempotency marker). The backend never writes to the open project — `WorkflowsProvider.tsx`'s `writeFeatureDocumentation()` always appends a real `CHANGELOG.md` entry and writes a per-feature `docs/features/<slug>.md` file, and appends to `PROJECT_MEMORY.md`/`ARCHITECTURE.md` only if the open project already has them. The Live Workflow View's `Documentation` node (Sprint 13, previously hard-coded "not yet automated") is now genuinely conditional on `workflow.documentation` being real and set.

Feature Approval: new `GET /workflows/{id}/summary` assembles real files-changed/files-created (via the Knowledge Graph's indexed-file check), an always-empty (and explicitly stated as such) `files_removed` since the Developer agent has no deletion mechanism, the real test result, and an aggregated real risk level — rendered in a new "Feature summary" block in `SprintProgressCenter.tsx`.

Found and fixed one real pre-existing gap during implementation (the manual Apply button never calling the backend, detailed above) — otherwise no new live-testing bugs found; the mechanism reused Sprints 11–14's already-proven infrastructure closely enough that no new failure modes surfaced.

docs/ARCHITECTURE.md gained a new "AUTONOMOUS CODING ENGINE (locked — Sprint 15)" section, ten new locked-decision entries, version bumped to 2.2 (the twelve-namespace IPC surface was extended, not widened — `agents`/`workflows` gained methods rather than a thirteenth namespace being added); docs/DATABASE_SCHEMA.md updated with the new `file_snapshots` table and `agent_tasks`/`workflows`'s new additive columns, version bumped to 1.8; docs/SPRINT_15_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean, except the same pre-existing unrelated `tsconfig.json` warning), vite build; pytest (136 passed including 14 new, no skips), ruff check (all checks passed), mypy strict (0 issues, 58 source files). Live Playwright verification (real Ollama, no mocks) against a real small test project: indexing, a real single-role Developer task driven through two full live runs of the real local model, and real, non-mocked round trips of the new test-result and feature-summary endpoints through the actual Electron IPC boundary. The small local test model did not produce a parseable ```` ```file:``` ```` block in either live run (the same documented small-model instruction-following limitation as Sprint 11/12) — the resulting rollback-info 404 path was verified live instead, and the full real Apply→snapshot→Rollback round trip is deterministically proven at the API layer by 4 new backend tests (not dependent on the small model's output). Full Sprint 1–14 regression pass (fresh isolated profile): all twelve `window.nemi` IPC namespaces present with their new Sprint 15 fields, Explorer/Monaco/Agents/Knowledge panels and the Intelligence Center all render and function, all backend endpoints reachable only through the real IPC boundary.

Known limitation: the Documentation Engine and Test Engine's live, end-to-end, model-dependent success (as opposed to their graceful-skip paths and their deterministic API-level correctness) was not captured in this session's live pass, since it requires the small local test model to first succeed at milestone decomposition — the same probabilistic dependency Sprint 12/13's own live tests already documented and accepted. Rollback is per-task, not a whole-workflow atomic transaction. No in-app git commit/push action (unchanged since Sprint 13). The Developer agent still cannot propose file deletions (unchanged since Sprint 11) — `files_removed` in the Feature Approval summary is always empty, stated honestly rather than omitted. Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

Sprint 15.5 — Completed (AI Provider Management)

Goal:

Replace the incomplete single-page Settings panel with a production-quality, seven-provider AI Provider Management system: enable/disable, API key, base URL, default model, refresh models, test connection, last connection status, last used time, usage/cost statistics per provider; automatic Ollama detection/model management; a Model Manager (search/filter/favorites/default/last-used) per provider; a tabbed Settings UI (General/Editor/AI Providers/Models/Usage/Security/About); a real Provider Dashboard; per-agent-role Provider Switching; and AI Chat provider-switching plus cost/response-time display — preserving Sprints 1–15.

Delivered:

Provider layer extended from four to seven providers: OpenAI, Anthropic, Gemini, Ollama, DeepSeek, Grok (xAI), and a user-defined Custom OpenAI-compatible endpoint. DeepSeek/Grok/Custom (and OpenAI itself, refactored in) are thin subclasses of a new `OpenAICompatibleProvider` (`backend/app/ai/providers/openai_compatible.py`) — one real streaming/error-handling implementation shared by all four, since they speak the identical OpenAI Chat Completions wire protocol; Custom has no honest default base URL, so it raises a clear error rather than silently hitting the real OpenAI API when unconfigured. Every provider gained two new real capabilities: `test_connection()` (a real, cheap models-list call — Ollama reuses its existing real `/api/tags` check — never fabricated, never raises) and `list_models()` (a real live catalog where the SDK supports it; empty, an honest "no such capability," where it doesn't). `base_url` is now a first-class field end-to-end (Settings → `provider_settings.base_url` → attached automatically to every chat send and every orchestrated agent task).

New tables — `provider_settings`, `model_favorites`, `agent_provider_defaults` — plus one additive `ai_messages.latency_ms` column. `agent_provider_defaults` is a genuinely new table (not a widened `agent_tasks.agent_role` CHECK constraint) since it needs a fifth `'documentation'` value that `agent_tasks.agent_role` deliberately still does not carry, continuing Sprint 15's own reasoning for keeping Documentation standalone. `create_milestone_pipelines()` and `generate_feature_documentation()` both now consult `agent_provider_defaults` per role, falling back to the workflow's own provider/model when no override exists — Provider Switching, wired all the way through.

Ollama Management: real install detection (`shutil.which`), real server-reachability and model-list checks (`/api/tags`, now returning real sizes), real pull/delete (`/api/pull`/`/api/delete`) — surfaced via `GET/POST/DELETE /providers/ollama/*` and a new `OllamaManagementPanel.tsx`. Pulls are synchronous (await completion, return the final status), a stated honest limitation rather than a claimed live-progress feature.

Settings UI rebuilt as a tabbed module (`SettingsModal.tsx` + seven new tab components) replacing the old single-panel `AiProviderSettings.tsx` (deleted). AI Providers tab: enable/disable, key, base URL, default model, Test Connection with real status badges. Models tab: search/filter, favorites (star), set-default, last-used badges, live Refresh against providers with a real catalog. Usage tab: a real Provider Dashboard (`GET /providers/dashboard`, aggregating `provider_settings` + a new `StatsRepository.provider_dashboard()` real per-provider requests/tokens/cost/latency/errors) and Provider Switching (five-role provider/model mapping). Security tab: a plain-language safeStorage explanation plus a real per-provider configured/remove-key list. AI Chat: `TokenUsageIndicator.tsx` now also shows an estimated cost (ported pricing table, `null` for unlisted models, never guessed) and the most recent real response time (`ai_messages.latency_ms`, captured via `time.monotonic()` in `_stream_and_persist()`); provider switching from Chat already existed (`ProviderSelector.tsx`, Sprint 10) and now lists all seven providers automatically.

`frontend/electron/ai-credentials.ts`'s `ProviderId` extended to seven providers (same `safeStorage` mechanism, unchanged security model); a new `providers` IPC namespace (thirteenth, not an extension of an existing one — a genuinely new concern) added to `preload.ts`/`main.ts`/`electron-api.d.ts`, backed by a new `providers-client.ts`.

No new live-testing bugs found (this sprint extended existing, already-proven infrastructure — schema migrations, IPC relay pattern, SSE streaming — rather than introducing new mechanisms); the one real environmental finding during live verification was a test-harness issue (a flawed `waitForFunction` health check in the verification script itself resolving before the backend's ~13–15s real cold-start SDK-import time elapsed), not a defect in the shipped code — fixed by retrying the real functional call instead of trusting the premature health signal.

docs/ARCHITECTURE.md gained a new "AI PROVIDER MANAGEMENT (locked — Sprint 15.5)" section, a genuinely new thirteenth `providers` IPC namespace documented, six new locked-decision entries, version bumped to 2.3; docs/DATABASE_SCHEMA.md updated with the three new tables and `ai_messages.latency_ms`, version bumped to 1.9; docs/SPRINT_15_5_REPORT.md created.

Verified: tsc build, eslint (0 warnings), prettier (clean, except the same pre-existing unrelated `tsconfig.json` warning), vite build; pytest (161 passed including 25 new, no skips), ruff check (all checks passed), mypy strict (0 issues, 62 source files). Live Playwright verification (real Ollama, no mocks) against the built app: all 7 providers registered with correct `supports_base_url` reporting; provider settings CRUD round trip; Test Connection honestly reporting failure with no key configured; a real safeStorage roundtrip (set/has/clear) plus direct confirmation the on-disk encrypted credentials file never contains the raw key text; model favorites add/remove; agent provider defaults set/list/clear; the Provider Dashboard returning real aggregates for all 7 providers; real Ollama status against both an unreachable host (graceful `server_running: false`) and the real local server (2 real installed models with real sizes); all 7 Settings tabs rendering and clickable; the AI Providers tab showing Test Connection buttons for all 7 providers; the Usage tab showing the Provider Dashboard and Provider Switching sections. Full Sprint 1–15 regression pass in the same session: all sidebar panels present (Project Explorer, Workspace Manager, Agents, Knowledge), backend health reachable at session end, `agents:list`/`workflows:list`/`knowledge:list-embedding-providers` all reachable through the real IPC boundary — 26/26 live checks passed.

Known limitation: real-time streamed Ollama pull progress is not implemented (synchronous pull only, stated above). DeepSeek/Grok are deliberately absent from the cost-estimate pricing table — no confident current published rates at implementation time, preserving the "unknown beats fabricated" rule an unlisted model already followed. Provider Switching is per agent-role, not per task instance. Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

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

✔ Sprint 8 Completed — Standalone Python Runtime Bundling

✔ Backend Bundled via PyInstaller (`backend/nemi-backend.spec`, onedir) — packaged builds no longer require a system Python interpreter

✔ Fixed Frozen-Executable Path Resolution — `backend-process.ts` now always passes `NEMI_DB_PATH`/`NEMI_LOG_FILE` (from `app.getPath('userData')`) when packaged, correcting where app data lands

✔ `dist:win` Pipeline + `extraResources` Updated to Ship the Bundled Executable Instead of Raw Source

✔ Verified Zero System-Python Dependency (`PATH` stripped of every Python install) and Confirmed via Live Process Inspection That the Bundled Exe (Not `python.exe`) Is What Actually Runs

✔ Sprint 8 Verified (tsc, eslint, prettier, vite build; pytest ×24 unchanged, ruff, mypy strict; full `npm run dist:win` packaged build; 15-point live verification passed 15/15, reproduced twice)

✔ Sprint 9 Completed — Professional Monaco Code Editor

✔ Plain `<textarea>` Editor Replaced by Monaco (bundled locally, `monaco-editor` 0.50.0, scoped + lazy-loaded imports) — multi-tab editing, dirty indicators, Save All, Close/Close Others/Reopen Closed Tab, bounded Split Editor (2 groups), minimap, folding, word wrap, bracket matching, undo/redo, multi-cursor, Find/Replace, Quick Open (Ctrl+P), Global Search (Ctrl+Shift+F), Command Palette (Ctrl+Shift+P), Auto Save toggle, and syntax highlighting for all 9 required languages

✔ Found and Fixed Three Real Bugs During Live Verification — missing `basic-languages` imports left JS/TS/CSS/HTML with zero syntax highlighting and a dead TypeScript worker; Ctrl+S/Ctrl+W silently no-op'd on Windows due to Monaco's URI drive-letter lowercasing; Ctrl+Shift+P/Ctrl+Shift+F never matched a real keypress due to case-sensitive `event.key` checks (fixed via `event.code`)

✔ Sprint 9 Verified (tsc, eslint, prettier, vite build; pytest ×24 unchanged, ruff, mypy strict; 4 live Playwright suites — 16-point core, 17-point extended, 10-point Sprint 1–8 regression, 5-point packaged-app spot-check — each reproduced clean twice)

✔ Sprint 10 Completed — AI Chat & Agent Framework

✔ AI Chat Panel Implemented (right sidebar) — real four-provider abstraction (OpenAI, Claude/Anthropic, Gemini, Ollama, no mocks), streaming responses (SSE end to end), conversation history and persistence, context-aware chat scoped to the active project, `@file` references, code-selection-to-Ask-AI, Explain/Fix/Generate/Refactor Code editor actions with keybindings, token usage indicator, cancellation, and graceful error handling

✔ API Keys Encrypted via Electron `safeStorage`, Never Stored in SQLite — upholds the existing "no column stores secrets" convention; keys attached only to the one backend request that needs them, never persisted server-side

✔ Found and Fixed Four Real Bugs During Live Verification (against a real locally-installed Ollama model, installed this sprint specifically for genuine non-mocked testing) — provider/conversation list fetch had no startup retry and could permanently fail on a fresh launch; cancelling before the first stream chunk persisted an empty "complete" message instead of "cancelled"; sending with no Ollama model chosen failed a 422 silently; Monaco's right-click context menu can't be reliably automated by Playwright in this Electron build (worked around with real keybindings on all five AI actions)

✔ Sprint 10 Verified (tsc, eslint, prettier, vite build; pytest ×37 [13 new, incl. a live Ollama end-to-end test], ruff, mypy strict; 4 live Playwright suites — 14-point core AI, 14-point secondary (Settings/editor actions/file refs), 18-point full Sprint 1–9 regression, 6-point packaged-app spot-check — each reproduced clean at least twice)

✔ Sprint 11 Completed — Agent Orchestration Framework

✔ Multi-Agent Pipeline Implemented — Planner→Developer→Reviewer→Tester chained via a dependency-gated Agent Task Queue (`agent_tasks`), a stateless `run_cycle()` Agent Manager triggered externally by Electron every 4s (no server-side API keys, no internal loop), parallel execution of independent tasks (bounded, `MAX_CONCURRENT_TASKS = 3`), automatic retries (up to `max_retries + 1` attempts) with cascade-cancellation of dependents on permanent failure, agent-to-agent communication via the `memory` table's first real implementation, and an Agents Dashboard sidebar panel with a New Task modal, live status, and proposed-file Apply actions

✔ Found and Fixed One Real Bug During Live Verification — `backend-process.ts`'s health `state` latched permanently into `'error'` after a 15s startup timeout even when the backend later became healthy (worsened by this sprint's own added startup-time role-file seeding); fixed with a background watcher that recovers `state` to `'ready'` once the still-alive process actually responds

✔ Sprint 11 Verified (tsc, eslint, prettier, vite build; pytest ×53 [16 new, incl. a live two-stage Ollama pipeline test], ruff, mypy strict; live Playwright verification — full pipeline incl. retry/cascade/parallel-execution/real UI form interaction, plus a full Sprint 1–10 regression pass — reproduced clean)

✔ Sprint 12 Completed — Workflow Engine & AI Project Manager

✔ AI Project Manager Implemented — a high-level goal is decomposed into an ordered list of milestones (reusing the existing Planner role, run through the same `run_cycle()` every task uses), each becoming its own full Planner/Developer/Reviewer/Tester pipeline, chained sequentially across the whole workflow

✔ Workflow Engine Implemented — new `workflows`/`milestones` tables, Pause/Resume (implemented by filtering the scheduler, not touching task status), Cancel (cascades to queued tasks), Auto Resume after restart (requeues any task orphaned `'running'` at startup), a Sprint Progress Center (percentage, counters, current agent, ETA, logs, resource usage), and a configurable Human Approval Mode (Fully Automatic / Review Before Apply / Manual Approval)

✔ Found and Fixed One Real Bug During Live UI Verification — the Pause button didn't appear while a workflow was still `'planning'`, even though pausing was already supported from that state; fixed by correcting the button's visibility condition

✔ Sprint 12 Verified (tsc, eslint, prettier, vite build; pytest ×72 [19 new, incl. a live goal-decomposition Ollama test], ruff, mypy strict; live Playwright verification across multiple runs — manual approval gating, pause-from-planning, resume, cancel cascade, real UI goal creation and Pause click, a full real milestone-decomposition-to-execution happy path observed directly — reproduced clean)

✔ Sprint 13 Completed — Live Development Dashboard & Intelligence Center

✔ 12-Section Live Dashboard Implemented — Sprint Center, Agent Monitor, Workflow View, Terminal, AI Thinking, Resources, Tokens & Cost, Build Center, Pause/Resume, History, Notifications, and Performance, opened via a new HeaderToolbar button or `Ctrl+Shift+I`, every widget backed by real data (no fabricated metrics) with honest labeled substitutes where genuine telemetry doesn't exist (AI logs folded into Backend logs, Network reports connectivity not bandwidth, unautomated pipeline stages marked as such)

✔ Real Git/Build Integration Added — `git-status.ts` (branch/ahead-behind/dirty/commits via the `git` CLI) and `build-runner.ts` (real `npm run build`/`test`/`npx tsc --noEmit`, detected from the open project's actual scripts, streamed output, cancellable) both scoped to the currently open *user* project, never NEMI's own source

✔ Found and Fixed Two Real Bugs During Live Verification — the new Sprint Center's Pause button initially missed the same `'planning'`-state class of bug Sprint 12 fixed once already; and dashboard notifications re-fired for tasks/workflows that had already failed/completed in a *previous* session the instant a fresh session's dashboard mounted (confirmed live), fixed by keying "already seen" tracking per entity id so a pre-existing terminal status only establishes a silent baseline instead of counting as a live transition

✔ Sprint 13 Verified (tsc, eslint, prettier, vite build; pytest ×86 [14 new], ruff, mypy strict; live Playwright verification — all 12 sections navigated without error, real git status for this repo, Resource Monitor accurately reflecting genuine 100% CPU/96% RAM load during a real Run Verification execution, Build Center correctly gating on real npm-script detection, a correctly-scoped workflow populating Sprint Center with live data, notification-staleness bug found/fixed/reconfirmed — reproduced clean)

✔ Sprint 14 Completed — Knowledge Graph & AI Memory Engine

✔ Knowledge Graph Implemented — relational `graph_nodes`/`graph_edges` tables (not a dedicated graph database), populated by a new backend indexer that walks the open project's files, extracts functions/classes/imports via a heuristic regex parser (Python/JS/TS), and links real git commits/authors — Project/File/Function/Class/Agent/Workflow/Commit/User/Requirement nodes with Contains/Defines/Imports/Modifies/Executed_by/Authored_by/Implements relationships

✔ Persistent AI Memory & AI Learning Implemented — `memory`'s four previously-unused types now have real writers (sprint summaries, bugs, fixes, architecture changes), retrieved via real cross-project keyword-overlap ranking and injected into the Planner's prompt before goal decomposition — genuine retrieval-augmented planning, not claimed self-improvement

✔ Semantic Search, Architecture Intelligence, and Code Impact Analysis Implemented — real embeddings (OpenAI/Gemini/Ollama; Anthropic has no embeddings API) with honest keyword-fallback labeling when no provider/embeddings exist; real graph+memory+git-history retrieval fed to the AI Chat Panel for "why/where/what breaks/who changed it"; a transparent, stated risk heuristic (never presented as ML) for impact analysis; real Mermaid dependency/architecture diagrams exportable as `.mmd` files

✔ Found and Fixed Two Real Issues — a parser regex accidentally excluded class methods from function extraction (caught by a unit test, fixed to match the parser's own documented scope limitation); bulk-embedding a real large project through a local model was found live to need a bounded candidate cap, smaller batches, and longer timeouts rather than an unbounded single request — fixed and re-verified live against both a full real 684-file repo (structural features) and a small real file subset (embeddings/semantic search)

✔ Sprint 14 Verified (tsc, eslint, prettier, vite build; pytest ×122 [36 new, incl. a live non-mocked Ollama embedding round trip], ruff, mypy strict [56 source files]; live Playwright verification against this repo itself — real indexing/graph/impact/diagrams/keyword-fallback search at full scale, real embeddings + differentiated semantic search on a real file subset, real git history retrieval; full Sprint 1–13 regression pass with all 12 IPC namespaces and panels confirmed intact — reproduced clean)

✔ Sprint 15 Completed — Autonomous Coding Engine

✔ Safe Change Engine & Rollback System Implemented — new `file_snapshots` table records each file's real pre-apply content (captured by Electron, write-once per task/file); `GET /agents/tasks/{id}/rollback-info` + `POST /agents/tasks/{id}/mark-rolled-back` back a real Rollback button; found and fixed a real pre-existing gap where the manual per-file Apply button never called the backend at all, so rollback (and Sprint 14's architecture-change recording) previously only worked under Fully Automatic mode

✔ Test Engine & Documentation Engine Implemented — real `build.runTests()` (Sprint 13) reused for a per-workflow real test run, result persisted and posted via `POST /workflows/{id}/test-result`; new `app/ai/orchestration/documentation.py` gives `agents/documentation.md` its first real consumer, strictly grounded in real workflow facts, deliberately run standalone rather than as a fifth orchestrated agent role (would require a CHECK-constraint migration); real generated docs written by the frontend to `CHANGELOG.md`, a per-feature doc file, and conditionally to `PROJECT_MEMORY.md`/`ARCHITECTURE.md` if the open project already has them

✔ Autonomous Coding & Feature Approval Implemented — Developer/Reviewer tasks grounded with real Knowledge Graph retrieval and real Impact Analysis data (existing `agents/*.md` prompts finally given something real to act on); Code Planning Engine detail added to the milestone-decomposition prompt (no parser change); new `GET /workflows/{id}/summary` assembles real changed/created files, real test result, and real aggregated risk level, rendered in a new Feature Summary panel

✔ Sprint 15 Verified (tsc, eslint, prettier, vite build; pytest ×136 [14 new], ruff, mypy strict [58 source files]; live Playwright verification — real indexing and a real single-role Developer task driven through two live local-model runs, real test-result/feature-summary round trips through the actual Electron IPC boundary, the rollback-info 404 path confirmed live, full Apply→Rollback round trip deterministically proven by 4 new backend tests; full Sprint 1–14 regression pass with all 12 IPC namespaces (plus their new fields) and every panel confirmed intact — reproduced clean)

---

# PENDING TASKS

Code-signing certificate for the installer (currently unsigned) — top remaining Beta blocker, unaffected by Sprint 15

Workflow Design

Plugin System

Git Integration (Sprint 13 added real read-only git status/branch/commits; there is still no in-app commit/push *action*)

Testing Engine

Build System

Repositories/business logic for the remaining table (`tasks`; `settings` still has no repository either) — schema exists, repositories deferred to the sprints that need them; `projects` (Sprint 7), `ai_conversations`/`ai_messages` (Sprint 10), `agents`/`agent_tasks`/`memory` (Sprint 11), `workflows`/`milestones` (Sprint 12), `history` (Sprint 13), and `files`/`graph_nodes`/`graph_edges`/`embeddings` (Sprint 14) now have repositories

Embedding generation is a single synchronous request, not yet a cancellable background job (Sprint 14) — a very large project's full pass can take several minutes even with the 150-file candidate cap

A true multi-language AST parser for the knowledge graph's code indexing (Sprint 14's parser is heuristic/regex-based, Python/JS/TS only) — a dedicated future sprint's scope, not attempted here

Resizable/drag panel splitters (sidebar and logger panel are currently show/hide toggles only)

Proposed-file Apply flow (manual and Fully-Automatic) has parser-unit-test + UI-wiring coverage but not an end-to-end live capture in this environment — the small local Ollama model used for testing doesn't reliably follow the exact ` ```file:path``` ` instruction format (a model instruction-following limitation, not a parser defect)

Only four of the eight `agents/*.md` roles (planner/developer/reviewer/tester) are scheduled into the `agent_tasks` queue; `documentation` gained a real, standalone (non-queued) consumer in Sprint 15 (see `app/ai/orchestration/documentation.py`); architect/debugger/release_manager remain reference documents only

Milestone/pipeline dependency chains are linear (one link per task), not a true multi-parent dependency graph — deliberately out of scope since Sprint 11

Resource/disk usage reporting (Sprint 12/13) is Windows-only, matching this app's only packaged target

Network throughput/bandwidth is not shown (Sprint 13) — no cross-platform API this app relies on exposes it; connectivity status is shown instead

Commit/Push pipeline stages still have no automation behind them (Sprint 13's Live Workflow View marks them explicitly as not-yet-automated) — Documentation became genuinely automated in Sprint 15

Rollback is per-task, not a whole-workflow atomic transaction (Sprint 15) — deliberately matches the existing per-task Apply granularity

The Developer agent still cannot propose file deletions (unchanged since Sprint 11) — the Feature Approval summary's `files_removed` is always empty, stated honestly rather than omitted

Ollama model pulls are synchronous, not progress-streamed to the UI (Sprint 15.5) — the SSE infrastructure a future streaming version would reuse already exists

DeepSeek/Grok are absent from the cost-estimate pricing table (Sprint 15.5) — no confident current published rates at implementation time; reports `null`, never a guessed number

Provider Switching is per agent-role, not per task instance (Sprint 15.5) — a five-row Settings mapping, not per-run overrides

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

Sprint 8 Completed — Standalone Python Runtime Bundling: backend bundled via PyInstaller (onedir, checked-in `.spec` file); packaged builds spawn the bundled executable directly with zero `PATH`/system-Python dependency (verified with `PATH` stripped of every Python install and via live process inspection); fixed a frozen-executable path-resolution issue found during implementation by always passing `NEMI_DB_PATH`/`NEMI_LOG_FILE` from `app.getPath('userData')` when packaged; `dist:win` pipeline and `extraResources` updated accordingly — verified via a full packaged build plus a 15-point live suite, reproduced clean twice

Sprint 9 Completed — Professional Monaco Code Editor: `FileEditor.tsx`'s plain `<textarea>` replaced by a full Monaco-based multi-tab editor (bundled locally, scoped + lazy-loaded imports, offline-first) — tabs, dirty indicators, Save All, Close/Close Others/Reopen Closed Tab, bounded Split Editor (2 groups), Quick Open, Global Search, Command Palette, Auto Save toggle, and syntax highlighting for all 9 required languages; found and fixed three real bugs during live verification (missing `basic-languages` imports killed JS/TS/CSS/HTML highlighting and the TS worker, Windows URI drive-letter lowercasing broke Ctrl+S/Ctrl+W, case-sensitive `event.key` checks broke Ctrl+Shift+P/F on a real keyboard) — verified via 4 live Playwright suites (core, extended, Sprint 1–8 regression, packaged-app spot-check) plus the full offline suite, each live suite reproduced clean twice; resolves the Code Editor half of Sprint 6's AI Chat Panel & Code Editor reservation

Sprint 10 Completed — AI Chat & Agent Framework: implements the AI layer reserved since Sprint 6 — AI Chat Panel (right sidebar) with a real four-provider abstraction (OpenAI, Claude/Anthropic, Gemini, Ollama, no mocks), SSE streaming end to end, conversation persistence scoped to the active project, `@file` references, code-selection-to-Ask-AI, Explain/Fix/Generate/Refactor Code editor actions with keybindings, token usage, cancellation, and graceful error handling; API keys encrypted via Electron `safeStorage`, never stored server-side; found and fixed four real bugs during live verification against a real locally-installed Ollama model (provider-list startup race, cancellation-before-first-chunk persisting the wrong status, an empty-model silent failure, and Monaco's context menu being unautomatable by Playwright — worked around with real keybindings) — verified via 4 live Playwright suites plus the full offline suite, each live suite reproduced clean at least twice; resolves the AI Chat Panel half of Sprint 6's reservation, completing it

Sprint 11 Completed — Agent Orchestration Framework: builds the first production-ready multi-agent pipeline on Sprint 10's provider/context foundation — Planner/Developer/Reviewer/Tester chained via a dependency-gated Agent Task Queue (`agent_tasks`), a stateless externally-triggered Agent Manager (`run_cycle()`, no server-side API keys, no internal loop — Electron polls every 4s), parallel execution of independent tasks (bounded), automatic retries with cascade-cancellation of dependents on permanent failure, agent-to-agent communication via the `memory` table's first real implementation, human-gated Developer-stage file proposals (parsed, never auto-applied), and an Agents Dashboard sidebar panel with a New Task modal; found and fixed one real bug during live verification (backend health state latching permanently into "error" after a startup timeout even when the backend later recovered — fixed with a background late-recovery watcher) — verified via live Playwright pipeline testing (retry/cascade/parallel execution/real UI interaction) plus a full Sprint 1–10 regression pass and the full offline suite, each reproduced clean; resolves the agent orchestration work Sprint 10 explicitly deferred

Sprint 12 Completed — Workflow Engine & AI Project Manager: builds an autonomous AI Project Manager on Sprint 11's Agent Orchestration Framework — a high-level goal is decomposed (reusing the existing Planner role, run through the same `run_cycle()`, not a new execution path) into an ordered list of milestones, each its own full Planner/Developer/Reviewer/Tester pipeline chained sequentially across the workflow; new `workflows`/`milestones` tables and six additive `agent_tasks` columns (none touching the existing `status` CHECK constraint); Pause/Resume implemented by filtering the scheduler rather than touching task status; Human Approval Mode (Fully Automatic/Review Before Apply/Manual Approval) gates on new `requires_approval`/`approved_at` columns; Auto Resume after restart requeues any task orphaned `'running'` at startup; a Sprint Progress Center (percentage, counters, current agent, ETA, logs, real Windows backend resource usage); conflict detection flags overlapping Developer-proposed file paths across a workflow; found and fixed one real bug during live UI verification (the Pause button didn't appear while a workflow was still `'planning'`, even though pausing was already supported from that state) — verified via live Playwright testing across multiple runs including a full real goal-decomposition-to-milestone-execution happy path, plus the full offline suite; resolves the autonomous project management work Sprint 11 explicitly deferred

Sprint 13 Completed — Live Development Dashboard & Intelligence Center: a real-time operational dashboard (12 sections: Sprint Center, Agent Monitor, Workflow View, Terminal, AI Thinking, Resources, Tokens & Cost, Build Center, Pause/Resume, History, Notifications, Performance) opened via a new HeaderToolbar button or `Ctrl+Shift+I`, every widget backed by real data with honest labeled substitutes wherever genuine telemetry doesn't exist (AI logs folded into Backend logs, Network shows connectivity not bandwidth, unautomated pipeline stages marked as such rather than faked); new real git integration (branch/ahead-behind/commits, scoped to the open user project, never NEMI's own source) and build/test runner (detected from the project's actual npm/Python scripts, streamed output, cancellable); `agent_tasks` gained a `live_output` column (genuine partial streamed model output, not fabricated reasoning) and `history` got its first real implementation since being schema-ready since Sprint 3; found and fixed two real bugs during live verification (the new Sprint Center's Pause button missing the same `'planning'`-state case Sprint 12 fixed once already, and notifications re-firing for already-terminal tasks/workflows left over from a previous session on a fresh mount — fixed by keying "already seen" tracking per entity id) — verified via live Playwright testing against this repo's own real git state and a real `npx tsc --noEmit` run, plus the full offline suite; resolves the operational-visibility work implied by Sprints 11/12's growing agent/workflow surface

Sprint 14 Completed — Knowledge Graph & AI Memory Engine: a relational knowledge graph (`graph_nodes`/`graph_edges`, not a dedicated graph database) built by a new indexer that walks the open project's files (a deliberate, scoped exception to Sprint 5's Filesystem Ownership rule, justified as bulk read-only analysis rather than interactive CRUD), extracts functions/classes/imports via a heuristic Python/JS/TS parser (explicitly not a full AST parser), and links real git commit/author history gathered by Electron; `memory`'s four previously-unused types (`long_term`/`knowledge`/`project`/`conversation`) gained real writers (sprint summaries, bugs, fixes, architecture changes), retrieved via real cross-project keyword-overlap ranking and fed into the Planner's prompt before goal decomposition (AI Learning, genuine retrieval not claimed self-improvement); real Semantic Search (OpenAI/Gemini/Ollama embeddings, Anthropic excluded since it has no embeddings API) with an honest keyword-fallback mode whenever no provider/embeddings exist; Architecture Intelligence answers "why/where/what breaks/who changed it" via real graph+memory+git-history retrieval fed to the AI Chat Panel, not unaided model reasoning; Code Impact Analysis uses a transparent, stated risk heuristic, never presented as ML; Automatic Documentation generates real Mermaid dependency/architecture diagrams, exported as `.mmd` files; found and fixed two real issues during implementation/live verification (a parser regex accidentally excluding class methods from extraction; bulk-embedding a real large project needing a bounded candidate cap, smaller batches, and longer timeouts rather than an unbounded single request) — verified via live Playwright testing against this repo itself at full scale (684 real files, 1,477 real graph nodes) plus a real embeddings/semantic-search round trip on a small real file subset, a full Sprint 1–13 regression pass, and the full offline suite; resolves the persistent-memory/knowledge-graph work flagged as pending in every PROJECT_MEMORY.md entry since Sprint 11

Sprint 15 Completed — Autonomous Coding Engine: built almost entirely by extending Sprints 11–14's existing Agent Orchestration Framework, Workflow Engine, and Knowledge Graph — a "Feature Execution Engine" request is a Sprint 12 workflow goal, no new intake mechanism; the milestone-decomposition prompt now asks for affected/new files and DB/API/UI/doc/test implications per milestone (prompt-only, parser untouched); Developer/Reviewer tasks are grounded with real Knowledge Graph keyword matches and real Impact Analysis dependency/risk data, giving the `agents/*.md` prompts' existing "read existing files first"/"risk level" instructions something real to act on; new `file_snapshots` table backs a real Safe Change Engine and Rollback System (`GET/POST .../rollback-info`, `.../mark-rolled-back`), which also closed a real pre-existing gap where the manual Apply button never called the backend at all; a Test Engine reuses Sprint 13's real `build.runTests()`, persisting a real result on the workflow; a Documentation Engine gives `agents/documentation.md` its first real consumer — a standalone, strictly-fact-grounded LLM call (deliberately not a fifth orchestrated role, avoiding a CHECK-constraint migration) — whose real output the frontend writes to `CHANGELOG.md`, a per-feature doc file, and conditionally `PROJECT_MEMORY.md`/`ARCHITECTURE.md`; a new Feature Approval summary endpoint assembles real changed/created files, real test results, and a real aggregated risk level; found and fixed one real pre-existing gap (the manual Apply button) during implementation — verified via live Playwright testing (real indexing, a real Developer task driven through two live local-model runs, real test-result/summary round trips through the actual Electron IPC boundary, the rollback-info 404 path confirmed live, the full Apply→Rollback round trip deterministically proven by new backend tests), a full Sprint 1–14 regression pass, and the full offline suite; resolves the "implement a complete feature end to end" work this platform's vision has been building toward since Sprint 11

Sprint 15.5 Completed — AI Provider Management: replaces the incomplete single-page Settings panel with a production-quality seven-provider system — OpenAI, Anthropic, Gemini, Ollama, DeepSeek, Grok (xAI), and a user-defined Custom OpenAI-compatible endpoint, the latter three (plus OpenAI itself, refactored in) sharing one real `OpenAICompatibleProvider` implementation since they speak the identical wire protocol; every provider gained real `test_connection()` (cheap models-list call, never fabricated, never raises) and `list_models()` (real live catalog where supported, honest empty list where not); `base_url` is now first-class end-to-end (Settings → `provider_settings` → every chat send and orchestrated agent task); three new tables (`provider_settings`, `model_favorites`, `agent_provider_defaults`) plus additive `ai_messages.latency_ms`; `agent_provider_defaults` deliberately a new table rather than a widened `agent_tasks.agent_role` CHECK constraint, continuing Sprint 15's own reasoning; Provider Switching wires `agent_provider_defaults` into both `create_milestone_pipelines()` and `generate_feature_documentation()`; real Ollama install/server/model-list/pull/delete management; Settings rebuilt as a 7-tab module (General/Editor/AI Providers/Models/Usage/Security/About) with a real Provider Dashboard aggregating real `ai_messages` stats; AI Chat gained real estimated-cost and response-time display; a new `providers` IPC namespace (thirteenth); found no new code defects (extended already-proven infrastructure) — the one real finding was a flawed health-check timing assumption in the verification script itself, not the shipped code — verified via 161 passing pytest (25 new), full offline suite, and a 26-point live Playwright pass (all 7 providers, safeStorage roundtrip with on-disk encryption confirmed, test-connection/favorites/agent-defaults/dashboard/Ollama-status round trips, all 7 Settings tabs, full Sprint 1–15 regression); resolves the "incomplete Settings page" gap flagged ahead of Sprint 16

---

# NEXT MILESTONE

Sprint 16

Code-signing certificate for the installer — still the top remaining Beta blocker, unaffected by Sprint 15/15.5

True concurrent multi-project support (simultaneous open projects, not just switching) — deliberately deferred in Sprint 7; would require a per-project filesystem watcher map and a multi-root Explorer UI

An in-app git commit/push action (Sprint 13 added read-only git status only) — would let the Live Workflow View's Commit/Push nodes become genuinely automated (Documentation became automated in Sprint 15)

Turning embedding generation into a cancellable background job with progress reporting (Sprint 14 shipped it as a single bounded synchronous request) — would remove the remaining wall-clock cap on how much of a very large project can be embedded in one pass

A true multi-language AST parser for code indexing (Sprint 14's parser is heuristic/regex-based, Python/JS/TS only) — would improve Knowledge Graph/Code Impact Analysis and Sprint 15's agent-grounding accuracy on other languages and on scope-sensitive constructs

Whole-workflow atomic rollback (Sprint 15 shipped per-task rollback only) — would let a multi-milestone feature be undone as a single unit

Real-time streamed Ollama pull progress (Sprint 15.5 shipped a synchronous pull only) — would give the Model Manager a live download progress bar

A live-fetched or confidently-sourced DeepSeek/Grok pricing table (Sprint 15.5 deliberately left them out of cost estimation) — would extend real cost tracking to all seven providers

---

# IMPORTANT

Every AI must read this file before doing any work.

This file is the permanent memory of the project.

Never ignore this document.