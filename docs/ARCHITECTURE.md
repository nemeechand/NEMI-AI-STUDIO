# ARCHITECTURE.md

Version: 1.4
Status: Finalized (Sprint 3); Backend Integration Locked (Sprint 4); Filesystem Ownership Locked (Sprint 5); AI Chat/Editor Reserved (Sprint 6); Workspace & Project Management Locked (Sprint 7)
Governs: Sprint 8 onward

---

# PURPOSE

This document finalizes the software architecture introduced in
MASTER_SPECIFICATION.md by mapping its Application Layers to the
concrete structure already implemented, and by locking in the
architectural decisions needed before backend and AI work begins.

MASTER_SPECIFICATION.md remains the top-level authority. This document
does not override it — it makes it concrete and actionable.

---

# LAYER MAPPING

## Presentation Layer

Location: `frontend/src`

- `components/layout/` — shell chrome (title bar, sidebar, status bar,
  window controls). Owns no business logic.
- `components/explorer/` — Project Explorer view.
- `components/logger/` — Logger Panel view.
- `components/dashboard/` — Dashboard view.
- `components/settings/` — Settings modal.
- `components/workspace/` (Sprint 7) — Workspace Manager panel and New
  Project Wizard modal; see WORKSPACE & PROJECT MANAGEMENT below.
- `components/common/` — shared, reusable, presentation-only primitives
  (e.g. `IconButton`). A component belongs here only if it has no
  feature-specific knowledge.
- `theme/`, `project/`, `workspace/` — cross-cutting frontend state
  (Theme Manager, active-project state, and workspace/session
  persistence respectively), each following the Context+Provider+Hook
  pattern (see STATE MANAGEMENT PATTERN below).

Rule: components read data through props or hooks only. No component
may import Node/Python/filesystem APIs directly — that always goes
through `window.nemi` (see IPC Boundary below).

## Application Layer

Not yet implemented. Reserved for:

- Controllers that translate UI intent (e.g. "open project") into
  calls against services.
- Services that orchestrate filesystem, database, and AI operations.
- Workflow coordination between AI agents (Planner → Developer →
  Reviewer → Tester, per `agents/*.md`).

This layer must live outside `components/` (e.g. a future
`frontend/src/app` or, once the Python process is wired in,
partially in `backend/app`). It must never be implemented as logic
embedded inside a React component.

## AI Layer

Not yet implemented. Reserved for provider adapters (Claude, OpenAI,
Gemini, DeepSeek, Qwen, Ollama per TECH_STACK.md), the memory system
(see MASTER_SPECIFICATION.md → MEMORY SYSTEM), and the agent
implementations that operationalize `agents/*.md`.

Locked in Sprint 4: AI provider calls will be made from the Python
backend, never proxied through or exposed to the renderer. This
follows directly from the Security Rules ("never expose secrets", "no
secrets inside source code") and from the transport decision below —
the backend is already the sole owner of anything that talks to the
outside world.

## Data Layer

- `backend/app` — Python backend package. As of Sprint 4 this is a
  running FastAPI service, not just a scaffold (see BACKEND SERVICE
  below).
- SQLite — see `docs/DATABASE_SCHEMA.md` for the finalized table
  design. As of Sprint 4 the schema is created automatically at
  backend startup (`app/db/schema.py::init_db`) into
  `database/nemi.db`. `logs` (`GET/POST /logs`, Sprint 5) and, as of
  Sprint 7, `projects` (`GET /projects/recent`, `POST /projects/opened`,
  `DELETE /projects/{id}`) have repositories — the other six tables
  are schema-ready but have no repository/business logic yet,
  intentionally deferred to the sprints that need them.
- Filesystem — as of Sprint 5, real project files on disk. Ownership
  is Electron main, not the Python backend; see FILESYSTEM OWNERSHIP
  below. The `files` SQLite table remains unused (no repository) —
  file content always comes from disk directly, never from SQLite.
- `logs/` — now actively used: the backend's rotating file log lives
  at `logs/backend.log` (see LOGGING below). `memory/`, `config/`,
  `projects/` remain reserved per MASTER_SPECIFICATION's FOLDER
  STRUCTURE, not yet wired to any process.
- `database/*.db` and `logs/*.log` are gitignored — both are runtime
  artifacts regenerated on backend startup, never committed.

---

# ELECTRON PROCESS MODEL

Three processes, already implemented and hardened in Sprint 2:

- **Main process** (`frontend/electron/main.ts`) — owns the
  `BrowserWindow`, window controls, and (in the future) spawning the
  Python backend as a child process. `sandbox: true`,
  `contextIsolation: true`, `nodeIntegration: false`.
- **Preload script** (`frontend/electron/preload.ts`) — the only
  bridge between main and renderer. Exposes a typed `window.nemi`
  surface via `contextBridge`. Nothing beyond what the renderer
  actually needs may be exposed here.
- **Renderer process** (`frontend/src`) — the React app. Never talks
  to Node.js, the filesystem, or Python directly.

## IPC Boundary (locked decision)

All renderer → native calls go through `window.nemi`
(declared in `frontend/src/types/electron-api.d.ts`). As of Sprint 7
this surface has four namespaces: `windowControls` (Sprint 2),
`backend` (Sprint 4: `health()`; Sprint 5: `logs()`), `fs`
(Sprint 5: project/file CRUD + change notifications; Sprint 7:
`selectDirectory()`, `createDirectory()`), and `projects` (Sprint 7:
`listRecent()`, `recordOpened()`, `remove()`). Future database or
AI-agent triggers must be added here first, as a typed method, before
any component may call them. A component must never assume Node.js
globals exist. All ambient types shared across `window.nemi` methods
(`ExplorerEntry`, `LogEntry`, `BackendHealth`, `ProjectRecord`, etc.)
live inside the `declare global` block of `electron-api.d.ts` so
they're usable anywhere in the renderer without imports.

The renderer never talks to the backend HTTP API directly — it has no
network access to it, and the CSP's `connect-src 'self'` intentionally
does not allow it. Every backend call is relayed through Electron
main via `ipcMain.handle(...)` / `ipcRenderer.invoke(...)`, which then
performs the HTTP request to `127.0.0.1` from the Node context. This
keeps the renderer's attack surface unchanged from Sprint 2's
hardening baseline even though a live local service now exists.

---

# STATE MANAGEMENT PATTERN (locked decision)

No external state library. The established pattern (from
`theme/ThemeProvider.tsx`) is:

1. A `createContext` module exporting the context + its value type.
2. A `Provider` component owning `useState`/`useEffect` and
   persistence (e.g. `localStorage`).
3. A `useX()` hook that reads the context and throws if used outside
   its provider.

Any new cross-cutting frontend state (e.g. a future Project context,
Agent Session context) must follow this exact three-file pattern for
consistency. Local, component-only state stays as plain `useState` —
do not lift state into Context unless it is genuinely shared across
unrelated components.

---

# BACKEND SERVICE (locked decision — Sprint 4)

**Framework**: FastAPI + Uvicorn. Chosen over a minimal stdlib
approach because it gives structured request/response handling,
built-in validation, a natural home for a `/health` endpoint, and a
straightforward path to streaming (SSE) responses once AI provider
calls are added — all without hand-rolling an HTTP layer. This is the
first runtime dependency the backend has ever had (Sprint 1B was
intentionally dependency-free); `fastapi`/`uvicorn` are now in
`backend/requirements.txt`.

**Transport**: plain HTTP over `127.0.0.1`, fixed port `8756`
(overridable via `NEMI_BACKEND_HOST` / `NEMI_BACKEND_PORT`). A fixed
port was chosen over OS-assigned ephemeral-port negotiation for
simplicity and debuggability (`curl http://127.0.0.1:8756/health`
always works in dev) — this project runs one backend instance per
running app instance, so port collision risk is low. Ephemeral-port
negotiation (child prints its bound port on stdout, main parses it)
is a documented future option if multi-instance support is ever
needed.

**Process lifecycle**: Electron main owns the backend's entire
lifecycle (`frontend/electron/backend-process.ts`):

- Spawned via `python -m app.main` with `cwd` set to `backend/`,
  started right after `app.whenReady()` — in parallel with window
  creation, not blocking it.
- Readiness is polled via `GET /health` (300ms interval, 15s
  timeout) from Electron main; state is one of `starting` / `ready`
  / `error` / `stopped`, exposed to the renderer via
  `window.nemi.backend.health()`.
- Stopped via `child.kill()` on `app.on('before-quit')`. Verified
  manually in Sprint 4 that a graceful window close terminates the
  Python child — no orphaned process.
- stdout/stderr are piped to Electron's console today (prefixed
  `[backend]`). Relaying them into the in-app Logger Panel is future
  work — the Logger Panel is still mock data (Sprint 2 pending item).

**Known limitation**: spawning `python` from `PATH` assumes a
compatible Python + the backend's dependencies are installed on the
machine running the app. This is acceptable for development; a
packaged/distributed build will need to bundle a Python runtime
(e.g. PyInstaller) — tracked as a pending task, not solved this
sprint (packaging is explicitly a later MASTER_SPECIFICATION phase).

---

# FILESYSTEM OWNERSHIP (locked decision — Sprint 5)

**Owner**: Electron main process (`frontend/electron/filesystem.ts`),
not the Python backend. File read/write/create/rename/delete and
real-time watching all happen in Node, relayed to the renderer via
the same IPC-relay pattern as the backend HTTP calls.

**Why not route file I/O through Python**: no cross-machine scenario
exists, no business logic is applied to file bytes yet, and Electron
main already has direct, sandboxed-safe filesystem access. Routing
every file read/write through an HTTP round-trip to the backend would
add latency and complexity for zero benefit at this stage — this
matches how desktop IDEs are conventionally built (main/extension-host
process owns disk I/O). The `files` SQLite table (see
`docs/DATABASE_SCHEMA.md`) remains a future indexing/search feature,
not a content store — this was already anticipated when that table
was designed in Sprint 3.

**Modules**:

- `filesystem.ts` — pure Node (`fs`, `path`, `chokidar`), no Electron
  imports. `listDirectory`, `readFile` (2 MB cap — see below),
  `writeFile`, `createFile` (atomic via the `wx` flag, rejects if the
  name already exists), `renameEntry`, `deleteEntry`,
  `openProject`/`closeProject` (start/stop the watcher),
  `setChangeListener`. Being Electron-free, this module can be
  exercised directly under plain Node (`npx tsx`) against a real
  temp directory — used in Sprint 5 to verify the CRUD operations and
  the watcher without needing the full Electron+IPC+UI stack.
- `project-dialogs.ts` — the only module that imports Electron's
  `dialog`/`BrowserWindow`. `selectProjectFolder(window)` shows a
  native folder picker for opening an existing project.
  `selectDirectory(window)` (Sprint 7) shows the same kind of picker
  but for choosing a *parent* directory for the New Project Wizard —
  kept as a separate function despite the identical dialog call so
  "pick a folder to open as a project" and "pick a folder to create a
  new project inside" don't share overloaded meaning. (Sprint 5's
  `'new'` mode, which repurposed `showSaveDialog` to create a project
  folder via a native dialog, was removed in Sprint 7 once the New
  Project Wizard — an in-app form, see WORKSPACE & PROJECT MANAGEMENT
  below — replaced it.) Kept separate from `filesystem.ts` specifically
  so the CRUD/watch logic has no Electron dependency.
- `backend-client.ts` — `fetchRecentLogs()`, `postLog()`
  (fire-and-forget, contained errors), `checkHealth()`. File
  operations call `postLog()` after succeeding, writing an audit
  entry (`fs.create` / `fs.rename` / `fs.delete` / `fs.save` /
  `fs.project`) into the backend's `logs` table — the same table the
  Logger Panel reads via `GET /logs`. A backend outage never breaks a
  file operation; `postLog` swallows its own errors.

**Real-time watching**: `chokidar`, ignoring
`node_modules`/`.git`/`dist`/`dist-electron`/`__pycache__`/`.venv`/
`.pytest_cache`/`.ruff_cache`/`.mypy_cache`. `openProject()` awaits
the watcher's `ready` event before resolving — otherwise a file
created immediately after "opening" a project could race the
watcher's setup and go unnoticed. Renderer subscribes via
`window.nemi.fs.onChange(...)`; `ProjectExplorer` bumps a
`watchVersion` counter on every event, which every expanded
`ExplorerTreeItem` depends on to refetch its children. Locally
triggered CRUD actions also refresh optimistically (immediate
`listDirectory` re-fetch, or local hide/rename on delete/rename) so
the UI doesn't wait on the watcher round-trip for actions the user
just took themselves.

**Known Windows gotcha (found and fixed in Sprint 5)**: if the
watched root path resolves through a short (8.3-style) path alias —
e.g. `C:\Users\HAREKR~1\...` instead of `C:\Users\Hare Krishna\...`,
which is what `os.tmpdir()` returned in the Sprint 5 dev/test
environment — chokidar's native Windows watcher hits a libuv
assertion (`fs-event.c`) and **crashes the whole process**. This is
not a catchable JS exception. Fix: `openProject()` calls
`fs.realpath()` on the target before watching, which reliably
resolves short-path aliases to their long form. Verified: the exact
crash reproduced on a short-path root and was gone after the fix,
while a normal long-path root (e.g. a folder under the repo itself)
never exhibited the bug. Real project folders selected via the native
folder picker return long paths already, so this mainly guards an
edge case — but a native crash is severe enough to defend against
regardless of how rarely it's hit.

**File size guard**: `readFile()` rejects files over 2 MB with a
clear error rather than reading an arbitrarily large file into a
renderer `<textarea>` — a deliberate, honest limitation (no chunked
loading or virtualized editor exists yet), not a silent failure.

**Editor scope (deliberately minimal)**: `FileEditor.tsx` is a plain
`<textarea>` with dirty-tracking and Ctrl+S — no syntax highlighting,
no language server, no diffing. A real code-editor experience
(Monaco/CodeMirror) is out of scope for this sprint; this component
exists only to make "Open" and "Save" genuinely work end-to-end
without fabricating capability the app doesn't have.

---

# WORKSPACE & PROJECT MANAGEMENT (locked decision — Sprint 7)

**Single active project, not simultaneous multi-project**: one project
is open/watched at a time, with a fast switcher between tracked
projects — not multiple projects open in tabs/panes simultaneously.
This matches the architecture already locked in Sprint 5: `ProjectContext`
holds one `projectPath`, and `filesystem.ts` has a single module-level
`watcher` (`startWatching()` calls `stopWatching()` first). True
concurrent multi-project support would require reworking that into a
per-project watcher map plus a multi-root Explorer UI — a much larger
change, deliberately out of scope this sprint, and a candidate for a
future sprint if ever needed.

**`projects` table now has a repository** (`backend/app/db/repositories/projects_repository.py`):
`record_opened()` upserts by `path` (unique), `list_recent()` orders by
the new `last_opened_at` column (see `docs/DATABASE_SCHEMA.md` — kept
distinct from `updated_at` so editing metadata without opening a
project never changes its recency), `delete()` removes a tracking row
only, never the actual folder. `ProjectProvider.tsx` funnels every way
a project can become active — Open Folder, the New Project Wizard, a
Workspace Manager switch, and launch-time session restore — through
one internal `openAndRecord()` helper, so recording happens exactly
once per open rather than being duplicated at each call site.

**Workspace state = active project + the one open file** (matches
`FileEditor.tsx`'s existing single-file scope — no editor tabs).
Window chrome (sidebar/logger visibility) is deliberately not part of
persisted workspace state. A new `frontend/src/workspace/` module
(`workspace-context.ts` / `WorkspaceProvider.tsx` / `useWorkspace.ts`,
the same three-file pattern as `theme/` and `project/`) owns
`openFilePath` and auto-saves it to `localStorage` under a
**per-project-scoped key** (`nemi.workspace.openFile.<projectPath>`) —
scoping by project, rather than one global slot, is what makes
switching projects in the Workspace Manager restore each project's own
last-open file instead of clobbering it. `WorkspaceProvider` consumes
`useProject()` and re-derives `openFilePath` whenever the active
project changes, which also naturally handles launch-time restore
(`ProjectProvider`'s async restore effect changes `projectPath`, and
`WorkspaceProvider` reacts to that the same way it would to a manual
switch — one code path, not two). `AppShell.tsx` reads/writes the open
file exclusively through `useWorkspace()` and separately owns only the
transient, never-persisted file *content* (always re-read fresh via
`window.nemi.fs.readFile()` whenever `openFilePath` changes — content
is never cached in `localStorage`).

**New Project Wizard replaces the old native-save-dialog creation
flow**: Sprint 5's `selectProjectFolder(window, 'new')` repurposed
`showSaveDialog` to pick a name and location in one native dialog.
Sprint 7 replaces this with an in-app modal
(`frontend/src/components/workspace/NewProjectWizard.tsx`, matching
`SettingsModal.tsx`'s overlay/card/Escape-to-close pattern) with Name,
Location (native directory picker via the new `window.nemi.fs.selectDirectory()`,
distinct from `selectProjectFolder()` — see FILESYSTEM OWNERSHIP above),
and an optional Description — the first UI path that ever populates
`projects.description`. The old `'new'` mode was removed from
`project-dialogs.ts` (dead code once superseded), not kept alongside.

**Workspace Manager panel**
(`frontend/src/components/workspace/WorkspaceManager.tsx`) is a second
main-panel view, toggled via a new icon in `Sidebar.tsx` (extending,
not replacing, the existing icon-bar/`active`-prop pattern) that shows
in the same slot `ProjectExplorer` occupies. Lists recent projects
(`window.nemi.projects.listRecent()`), highlights the active one,
switches on click (`openProject(path)`), and removes entries from the
recent list only (never touches disk). `RecentProjectsCard.tsx` on the
Dashboard shows the same data in miniature (top 5, click-to-open) —
both read from the same `GET /projects/recent` endpoint, no separate
state.

---

# AI CHAT PANEL & CODE EDITOR (reserved — Sprint 6, not implemented)

This is a documentation-only reservation prepared during Sprint 6's
stabilization work, so a future sprint has a locked starting point
instead of an open decision. No code, folders, or IPC channels from
this section exist yet — writing them without a use case would violate
`agents/architect.md`'s "never create temporary solutions."

**AI Chat Panel**

- UI: `frontend/src/components/chat/` — a new sibling to
  `components/explorer/`, `components/logger/`, `components/dashboard/`.
- State: `frontend/src/ai/` following the exact Context+Provider+Hook
  three-file pattern locked under STATE MANAGEMENT PATTERN above
  (`ai-context.ts` / `AiProvider.tsx` / `useAi.ts`), matching how
  `theme/` and `project/` are already structured.
- IPC: a future `window.nemi.ai.*` namespace, added to
  `electron-api.d.ts` the same way `backend` and `fs` were — the
  renderer will still never call the backend HTTP API directly (see IPC
  Boundary above). Chat responses will need streaming; the backend
  framework decision in Sprint 4 already anticipated this ("a
  straightforward path to streaming (SSE) responses once AI provider
  calls are added"), so the transport question is already answered —
  only the endpoint and IPC plumbing remain to be built.
- Provider secrets: per the AI Layer section above, AI provider calls
  and their credentials live in `backend/app`, never the renderer —
  already locked in Sprint 4, unaffected by this reservation.

**Code Editor**

- `FileEditor.tsx`'s plain-`<textarea>` scope was already documented
  as a deliberate simplification in Sprint 5 (see FILESYSTEM
  OWNERSHIP above). The upgrade path is to replace its internals with
  Monaco or CodeMirror while keeping the same external contract it
  already has — the `onOpenFile(path)` prop from `AppShell.tsx` and
  `window.nemi.fs.readFile`/`writeFile` — so adopting a real editor
  is an internal swap, not a renderer-wide API change.

---

# PLUGIN / EXTENSION ARCHITECTURE (future — not started)

MASTER_SPECIFICATION.md lists "Plugin Marketplace" under FUTURE
MODULES. No plugin loader, manifest format, or sandboxing model
exists yet. Any future plugin system must not weaken the current
Electron hardening (sandbox, contextIsolation, CSP) — plugin code
must never run with Node.js integration in the renderer.

---

# SUMMARY OF LOCKED DECISIONS

1. The Application layer (controllers/services/workflow orchestration)
   is a reserved namespace, not yet implemented.
2. All native access from the renderer goes through
   `window.nemi` — no exceptions. The renderer has no direct network
   access to the backend; Electron main relays every call.
3. AI provider secrets belong in the Python backend, never the
   renderer, once the AI layer exists (Sprint 4: locked, not yet built).
4. Cross-cutting frontend state follows the Context+Provider+Hook
   three-file pattern established by the Theme Manager.
5. **(Sprint 4)** Backend framework is FastAPI + Uvicorn, transport is
   HTTP over `127.0.0.1:8756` (fixed port), Electron main owns the
   Python child process's full lifecycle (spawn, health-poll, kill).
6. **(Sprint 4)** SQLite schema is created automatically at backend
   startup into `database/nemi.db`; `logs` and, as of Sprint 7,
   `projects` have repositories — remaining tables are schema-ready,
   awaiting the business logic that needs them.
7. **(Sprint 4)** Centralized logging is console + rotating file
   (`logs/backend.log`) via the stdlib `logging` module, separate
   from the structured `logs` SQLite table (which holds discrete
   lifecycle/audit entries for the future Logger Panel, not a mirror
   of every log line).
8. **(Sprint 4)** Backend errors return a consistent
   `{"error": {"code", "message"}}` JSON shape via global FastAPI
   exception handlers; unhandled exceptions are logged with full
   traceback server-side and never leak internals to the client.
9. **(Sprint 5)** Filesystem I/O and real-time watching are owned by
   Electron main (`filesystem.ts`, pure Node + chokidar), not the
   Python backend — no cross-machine scenario exists yet to justify
   the round-trip. Dialog-specific code is isolated in
   `project-dialogs.ts` so the CRUD/watch logic stays Electron-free
   and directly testable under plain Node.
10. **(Sprint 5)** File operations audit-log themselves to the
    backend's `logs` table via `postLog()` (fire-and-forget, errors
    contained) — the same data source the Logger Panel reads, so
    "robust logging" means one real pipeline, not two.
11. **(Sprint 5)** `openProject()` always resolves the real
    (long-form) path via `fs.realpath()` before watching, to avoid a
    Windows-specific libuv crash on short-path aliases.
12. **(Sprint 6)** AI Chat Panel and Code Editor locations/patterns are
    reserved (see AI CHAT PANEL & CODE EDITOR above) but not yet
    implemented — a documentation-only decision so a future sprint
    doesn't have to re-derive where this work belongs.
13. **(Sprint 7)** Multi-project support means one active project with
    a fast switcher, not simultaneous multi-project editing — matches
    the existing single-watcher `filesystem.ts` constraint; true
    concurrent multi-project is deliberately deferred (see WORKSPACE &
    PROJECT MANAGEMENT above).
14. **(Sprint 7)** Workspace state (active project + open file) is
    auto-saved/restored via a new `workspace/` Context+Provider+Hook
    module, persisted to `localStorage` under a per-project-scoped key
    — not a single global slot, and not window chrome (sidebar/logger
    visibility), which stays out of scope.
15. **(Sprint 7)** The New Project Wizard (in-app form) replaces the
    old native-save-dialog project-creation flow; `project-dialogs.ts`'s
    `'new'` mode was removed once superseded, not kept as dead code
    alongside it.

---

END OF DOCUMENT
