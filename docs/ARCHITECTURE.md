# ARCHITECTURE.md

Version: 2.0
Status: Finalized (Sprint 3); Backend Integration Locked (Sprint 4); Filesystem Ownership Locked (Sprint 5); AI Chat/Editor Reserved (Sprint 6); Workspace & Project Management Locked (Sprint 7); Standalone Runtime Bundling Locked (Sprint 8); Monaco Code Editor Locked (Sprint 9); AI Chat & Agent Framework Locked (Sprint 10); Agent Orchestration Framework Locked (Sprint 11); Workflow Engine & AI Project Manager Locked (Sprint 12); Live Development Dashboard & Intelligence Center Locked (Sprint 13)
Governs: Sprint 13 onward

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
- `components/editor/` (Sprint 9) — `MonacoEditorPane.tsx`, `TabStrip.tsx`,
  `QuickOpen.tsx`, `monacoSetup.ts`, `languageForPath.ts`,
  `modelRegistry.ts`; see MONACO CODE EDITOR below.
- `components/search/` (Sprint 9) — Global Search Sidebar panel.
- `commands/` (Sprint 9) — Command Palette registry and `useCommand()`
  hook; see MONACO CODE EDITOR below.
- `components/chat/` (Sprint 10) — `ChatPanel.tsx`, `MessageList.tsx`,
  `MessageBubble.tsx`, `MarkdownLite.tsx`, `ChatInput.tsx`,
  `ProviderSelector.tsx`, `TokenUsageIndicator.tsx`,
  `ConversationHistoryList.tsx`; see AI CHAT & AGENT FRAMEWORK below.
- `components/common/` — shared, reusable, presentation-only primitives
  (e.g. `IconButton`). A component belongs here only if it has no
  feature-specific knowledge.
- `theme/`, `project/`, `workspace/`, `settings/`, `ai/` (Sprint 10) —
  cross-cutting frontend state (Theme Manager, active-project state,
  workspace/session persistence, editor settings, and AI chat/
  conversation state respectively), each following the
  Context+Provider+Hook pattern (see STATE MANAGEMENT PATTERN below)
  — except `settings/editorSettings.ts`, which is a plain
  `localStorage`-backed module with a pub-sub listener rather than a
  Context, since it has no component-tree
  scoping need (see MONACO CODE EDITOR below).

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

As of Sprint 10, provider adapters for OpenAI, Claude (Anthropic), and
Gemini are implemented (`backend/app/ai/providers/`), plus Ollama for
local/offline models — see AI CHAT & AGENT FRAMEWORK below. DeepSeek
and Qwen (also listed as candidates in TECH_STACK.md) are not
implemented — outside this sprint's explicit scope, and the same
`AIProvider` abstraction accommodates adding either later without
touching the four already built. The MEMORY SYSTEM
(MASTER_SPECIFICATION.md) beyond conversation history, and the agent
implementations that operationalize `agents/*.md` (Planner → Developer
→ Reviewer → Tester orchestration), remain not yet implemented —
Sprint 10 delivers the chat/provider/context foundation those would
run on top of, not the agents themselves.

Locked in Sprint 4, upheld by Sprint 10's design: AI provider calls
are made from the Python backend, never proxied through or exposed to
the renderer. This follows directly from the Security Rules ("never
expose secrets", "no secrets inside source code") and from the
transport decision below — the backend is already the sole owner of
anything that talks to the outside world.

## Data Layer

- `backend/app` — Python backend package. As of Sprint 4 this is a
  running FastAPI service, not just a scaffold (see BACKEND SERVICE
  below).
- SQLite — see `docs/DATABASE_SCHEMA.md` for the finalized table
  design. As of Sprint 4 the schema is created automatically at
  backend startup (`app/db/schema.py::init_db`) into
  `database/nemi.db`. `logs` (`GET/POST /logs`, Sprint 5), `projects`
  (Sprint 7: `GET /projects/recent`, `POST /projects/opened`,
  `DELETE /projects/{id}`), and, as of Sprint 10, `ai_conversations`/
  `ai_messages` (`/ai/conversations*` — see AI CHAT & AGENT FRAMEWORK
  below) have repositories — the remaining four tables (`tasks`,
  `files`, `agents`, `settings`) are schema-ready but have no
  repository/business logic yet, intentionally deferred to the
  sprints that need them.
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
(declared in `frontend/src/types/electron-api.d.ts`). As of Sprint 13
this surface has eleven namespaces: `windowControls` (Sprint 2),
`backend` (Sprint 4: `health()`; Sprint 5: `logs()`), `fs`
(Sprint 5: project/file CRUD + change notifications; Sprint 7:
`selectDirectory()`, `createDirectory()`; Sprint 9: `listAllFiles()`
for Quick Open, `searchInFiles()` for Global Search — same ownership
as the rest of `fs`, see FILESYSTEM OWNERSHIP below), `projects`
(Sprint 7: `listRecent()`, `recordOpened()`, `remove()`), `ai`
(Sprint 10: `listProviders()`, `listOllamaModels()`, `hasApiKey()`/
`setApiKey()`/`clearApiKey()`, `listConversations()`/
`createConversation()`/`renameConversation()`/`deleteConversation()`/
`listMessages()`, `sendMessage()`/`cancelMessage()`/`onStreamEvent()`
— see AI CHAT & AGENT FRAMEWORK below), `agents` (Sprint 11:
`list()`, `listTasks()`/`getTask()`, `createPipeline()`,
`cancelTask()`/`retryTask()`, `onTasksChanged()`; Sprint 12:
`approveTask()`, `markFilesApplied()` — see AGENT ORCHESTRATION
FRAMEWORK below), `workflows` (Sprint 12: `list()`, `get()`,
`create()`, `pause()`/`resume()`/`cancel()`; Sprint 13: `restart()`),
`system` (Sprint 12: `getResourceUsage()`; Sprint 13: `getMetrics()`
— see LIVE DEVELOPMENT DASHBOARD & INTELLIGENCE CENTER below), `git`
(Sprint 13: `getStatus()`), `build` (Sprint 13: `detectRunners()`,
`runBuild()`/`runTests()`/`runVerification()`, `cancelRunner()`,
`onOutput()`), and `stats` (Sprint 13: `getPerformance()`,
`getTokens()`, `getHistory()`). A component must never assume Node.js
globals exist. All ambient types shared across `window.nemi` methods
(`ExplorerEntry`, `LogEntry`, `BackendHealth`, `ProjectRecord`,
`SearchMatch`, `SearchOptions`, `AiProviderInfo`, `AiConversation`,
`AiMessage`, `AiContextRef`, `AiStreamEventPayload`, `AgentInfo`,
`AgentRoleKey`, `AgentTask`, `ProposedFile`, `Workflow`,
`WorkflowDetail`, `Milestone`, `ResourceUsage`, `SystemMetrics`,
`GitStatus`, `GitCommit`, `RunnerId`, `RunnerOutputEvent`,
`RunnerStatusEvent`, `AvailableRunners`, `PerformanceStats`,
`TokenStats`, `HistoryEntry`, etc.) live inside the `declare global`
block of `electron-api.d.ts` so they're usable anywhere in the
renderer without imports.

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

- Spawned right after `app.whenReady()` — in parallel with window
  creation, not blocking it. What gets spawned depends on
  `app.isPackaged` (`resolveBackendCommand()`, Sprint 8): in dev mode,
  `python -m app.main` with `cwd` set to `backend/`, from the system
  `PATH`, unchanged since Sprint 4; in a packaged build, the bundled
  `nemi-backend(.exe)` executable directly, no arguments, no `PATH`
  dependency — see STANDALONE RUNTIME BUNDLING below.
- Readiness is polled via `GET /health` (300ms interval, 15s
  timeout) from Electron main; state is one of `starting` / `ready`
  / `error` / `stopped`, exposed to the renderer via
  `window.nemi.backend.health()`.
- Stopped via `child.kill()` on `app.on('before-quit')`. Verified
  manually in Sprint 4 that a graceful window close terminates the
  Python child — no orphaned process; reverified in Sprint 8 against
  the bundled executable with the same result.
- stdout/stderr are piped to Electron's console (prefixed `[backend]`)
  and, since Sprint 6, also relayed into the Logger Panel's `logs`
  table via `postLog()` (`backend.stdout` at DEBUG, `backend.stderr`
  at WARNING) — this line was stale until Sprint 8's docs pass caught
  it; the "future work" it described was already done.

---

# STANDALONE RUNTIME BUNDLING (locked decision — Sprint 8)

**Tool: PyInstaller, onedir (not onefile).** `backend/nemi-backend.spec`
targets `backend/app/main.py`, building `backend/dist-pyinstaller/nemi-backend/`
(`nemi-backend.exe` + an `_internal/` folder of bundled dependencies).
Onedir was chosen over onefile specifically because Electron spawns the
backend fresh on every app launch (see Process lifecycle above) —
onefile self-extracts to a temp directory on *every* run, which would
add extraction latency to every single startup; onedir has no
extraction step, matching how Electron itself already ships (an
unpacked `resources` tree). `pyinstaller` lives in
`backend/requirements-dev.txt` as a build-time-only tool — never
imported by application code, never a runtime dependency, the same
treatment Pillow got for the Alpha build's one-time icon generation.

**Build pipeline**: `frontend/package.json`'s `dist:win` script now runs
`npm run build:backend` (which builds the PyInstaller bundle) before
`electron-builder` packages the app. `extraResources` was repointed
from raw Python source (`../backend`) to the PyInstaller output
(`../backend/dist-pyinstaller/nemi-backend`) — a packaged app no longer
ships source that a system interpreter must execute; it ships a
self-contained executable. Dev mode (`npm run dev`) is completely
unaffected — it never reads `extraResources` or runs `build:backend`.

**Finding during implementation — `config.py`'s path resolution breaks
under a frozen executable.** `Settings.db_path`/`log_file_path` default
via `Path(__file__).resolve().parents[3]`, which assumes a fixed
directory depth below the repo root. Under a frozen PyInstaller
executable this resolves to the bundle's own directory instead — the
Alpha build already had a related (undocumented, low-stakes since
Python was on `PATH` on the only machine that had run it) version of
this problem: a packaged app's database/logs landed inside
`resourcesPath` rather than a proper per-user data directory. Verified
directly during this sprint: launching the bundled exe standalone (no
Electron, no env vars set) wrote `database/nemi.db` inside its own
bundle folder. **Fix**: `backend-process.ts::startBackend()` now
always sets `NEMI_DB_PATH`/`NEMI_LOG_FILE` when packaged, computed
from `app.getPath('userData')` — Electron's conventional, correct
location for mutable per-user app data, separate from the installed
binaries. Both env vars were already supported as overrides by
`config.py` since Sprint 4; no backend source change was needed, only
always-populating what was previously optional. Dev mode leaves them
unset, so `config.py`'s existing repo-relative defaults are unchanged.
Reverified end-to-end: the packaged app's database now lands under
`app.getPath('userData')/database/nemi.db`, confirmed via a live
launch with a dedicated test profile.

**Verified with `PATH` stripped of every Python installation** on the
development machine (`python`/`python3`/`py` all confirmed
unresolvable) — the bundled exe still serves `/health` and the full
`/logs`/`/projects` API correctly, proving no silent dependency on a
system interpreter. Also confirmed via live process inspection
(`Get-CimInstance Win32_Process`) that the actual running backend
process during a full packaged-app launch is `nemi-backend.exe`, not
`python.exe`.

**Known limitations (unchanged or newly observed this sprint)**:
- No true clean-machine/VM test was performed — this development
  machine has multiple Python installations already present, so the
  `PATH`-stripping test above is the closest practical proxy available
  in this environment, not a substitute for a genuine clean-Windows
  verification. Documented honestly rather than overclaiming.
- Package size grew from ~80MB to ~96MB (Python interpreter + stdlib +
  fastapi/pydantic/starlette/uvicorn) — expected, not a defect.
- The installer remains unsigned (separate, already-tracked Beta
  blocker, out of scope this sprint); unsigned PyInstaller executables
  are somewhat more prone to antivirus/SmartScreen false positives
  than a signed binary, compounding that existing limitation.

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
clear error rather than reading an arbitrarily large file into the
editor — a deliberate, honest limitation, not a silent failure. This
remains the defined boundary of "large file" support as of Sprint 9:
Monaco's own virtualized rendering handles files up to that size
responsively (verified with a ~1.3MB file), but true unbounded
large-file support is not attempted or promised.

**Editor scope**: as of Sprint 9, `MonacoEditorPane.tsx` (see MONACO
CODE EDITOR below) replaces the Sprint 5 plain-`<textarea>`
`FileEditor.tsx` with full Monaco-based multi-tab editing, syntax
highlighting, and the rest of the feature set documented there.

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

**Workspace state = active project + open editor state** (as of
Sprint 7 this was a single `openFilePath`, matching `FileEditor.tsx`'s
then-single-file scope; Sprint 9's Monaco editor grew this into the
full tab/group/split model described in MONACO CODE EDITOR below —
same module, same persistence principle, more structure).
Window chrome (sidebar/logger visibility) is deliberately not part of
persisted workspace state. A new `frontend/src/workspace/` module
(`workspace-context.ts` / `WorkspaceProvider.tsx` / `useWorkspace.ts`,
the same three-file pattern as `theme/` and `project/`) owns this
editor state and auto-saves it to `localStorage` under a
**per-project-scoped key** (`nemi.workspace.tabs.<projectPath>`) —
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

# AI CHAT & AGENT FRAMEWORK (locked decision — Sprint 10)

Resolves the AI Chat Panel half of Sprint 6's AI CHAT PANEL & CODE
EDITOR reservation (the Code Editor half was resolved in Sprint 9 —
see MONACO CODE EDITOR below). Implements the AI Layer from
MASTER_SPECIFICATION's APPLICATION LAYERS: `frontend/src/ai/` (state),
`frontend/src/components/chat/` (UI), `backend/app/ai/` (providers).

**Provider abstraction — `backend/app/ai/providers/`.** One
`AIProvider` per backend (`OpenAIProvider`, `AnthropicProvider`,
`GeminiProvider`, `OllamaProvider`), each implementing a single
`stream_chat()` that normalizes its own SDK's streaming shape into two
event types (`StreamChunk`, then exactly one `StreamDone` carrying
whatever usage the provider reported) so `api/ai.py` never needs to
know which provider it's talking to. SDK exceptions are caught and
re-raised as `app.ai.errors.ProviderError` subclasses
(`AuthenticationError`, `RateLimitError`, `InvalidRequestError`,
`ProviderNetworkError`, `MissingApiKeyError`) — normalized error codes
regardless of which SDK actually failed. `OpenAIProvider`/
`AnthropicProvider`/`GeminiProvider` use each vendor's official async
SDK (`openai`, `anthropic`, `google-genai`); `OllamaProvider` talks
directly to the user's local Ollama server's `/api/chat` (newline-
delimited JSON) via `httpx` — no SDK exists or is needed for a local
HTTP server, and it's the one provider that needs no API key at all.

**API keys are never stored server-side, matching DATABASE_SCHEMA.md's
existing "no column stores secrets" convention.** They're encrypted
with Electron's `safeStorage` (Windows DPAPI / macOS Keychain / Linux
Secret Service — OS-level, not app-rolled crypto) and persisted only
as an encrypted blob in `app.getPath('userData')/ai-credentials.json`
(`frontend/electron/ai-credentials.ts`) — never in the repo, never in
SQLite. The renderer never sees a raw key: it can only ask "is this
provider configured" (`window.nemi.ai.hasApiKey`) or ask Electron main
to save/clear one. When a message is sent, Electron main decrypts the
relevant key in-memory and attaches it to that one HTTP request to the
backend (`api_key` in the JSON body, over the same trusted
localhost-only connection every other backend call already uses) — the
backend uses it to call the provider and never persists it anywhere.
This keeps "AI provider calls and their credentials live in
backend/app" (the Sprint 4 locked decision) true in the sense that
matters — the credential only ever becomes live/usable inside
`backend/app`'s process boundary when making a call — without
requiring the backend to be a secrets store, which the schema
convention explicitly forbids.

**Conversation persistence — `ai_conversations`/`ai_messages` tables**
(new, added to the schema this sprint — see DATABASE_SCHEMA.md for the
full column list and the rationale for why these are normalized
tables rather than overloading the generic `memory` table).
`ConversationsRepository`/`MessagesRepository`
(`backend/app/db/repositories/ai_*.py`) back `backend/app/api/ai.py`'s
CRUD endpoints. Conversations are scoped by `project_id` — nullable,
matching every other project-scoped table — giving "context-aware
chat using the active workspace": `frontend/src/ai/AiProvider.tsx`
refetches the conversation list whenever the active project changes,
the same per-project-scoping principle Sprint 7's workspace state and
Sprint 9's tab/session state already established.

**Streaming transport: Server-Sent Events, exactly as anticipated in
Sprint 4's framework decision.** `POST /ai/conversations/{id}/messages/
stream` returns a `StreamingResponse` (`text/event-stream`) with
`chunk`/`usage`/`error`/`done` events. The renderer cannot reach this
directly (no network access, per the locked IPC Boundary below) — the
relay pattern is: renderer calls `window.nemi.ai.sendMessage(requestId,
...)` → Electron main (`frontend/electron/ai-client.ts`) performs the
actual `fetch()` to the backend and re-emits each parsed SSE frame as
an `ai:stream-event` push event via `webContents.send()` — the same
event-push shape the app already uses for `fs:changed` and
`window:maximized-change`, not a new pattern. The renderer's
`sendMessage()` IPC call itself resolves only once the whole stream
ends; live progress arrives entirely through the push channel.

**Cancellation.** `window.nemi.ai.cancelMessage(requestId)` aborts an
`AbortController` Electron main keeps per in-flight request, which
tears down the `fetch()` to the backend. Server-side, the streaming
generator's persistence step lives in a `finally` block, not after its
`try`, specifically because a client disconnect that lands *before*
the first provider chunk arrives (confirmed live against a fast local
Ollama model) delivers `GeneratorExit` at that suspension point —
skipping straight past the loop's own `is_disconnected()` check, which
only ever runs between two already-yielded chunks. The `finally` block
re-checks disconnection state unconditionally before persisting, so a
cancelled response is always saved with `status='cancelled'` and
whatever partial content had streamed in, never silently recorded as
if it had completed normally.

**Context-aware chat / file references / "Code selection → Ask AI" —
all funnel through one function, `AiContextValue.askAboutSelection()`.**
A user-attached file (`@file` in the chat input, fuzzy-filtered via
the same `fuzzyFilter` Quick Open already uses against
`window.nemi.fs.listAllFiles()`) and a Monaco selection both become
the same `PendingAttachment` shape (`path`, `content`, optional
`startLine`/`endLine`), persisted alongside the user's message as
`context_refs` (JSON) so history re-renders the same attachment chips
later. "Project indexing" is this file-tree/manifest lookup — real and
live (backed by Sprint 9's already-built `listAllFiles`), not a fake
placeholder — deliberately not a semantic/embedding-based vector index,
which would need its own embedding-model + vector-store infrastructure
disproportionate to this sprint; a natural candidate for a future
sprint, not fabricated now.

**Editor AI actions — `frontend/src/components/editor/
MonacoEditorPane.tsx`.** Five actions (Ask About Selection, Explain,
Fix, Refactor, Generate) registered via `editor.addAction()`, each
falling back to the whole file when nothing is selected. Each also
gets an explicit keybinding (`Ctrl+Shift+Alt+<letter>` — an unusual
enough chord to avoid colliding with any of `editor.all.js`'s own
default bindings, e.g. `Shift+Alt+F` is already "Format Document"),
not only a context-menu entry: real keyboard-accessible UX value, and
also the reliable, automatable trigger path used for live verification
— Monaco's right-click context menu is a canvas/DOM-overlay hybrid
that, confirmed during this sprint's testing, Playwright cannot
reliably trigger (neither a real right-click at exact rendered-line
coordinates nor Monaco's own F1 Quick Command opened anything in this
Electron build) — the same category of interaction-automation
limitation already documented for Monaco in Sprint 9, not a new gap
introduced here.

**Token usage** is tracked per assistant message
(`prompt_tokens`/`completion_tokens`, from whatever the provider's
final stream event reports) and summed per conversation for the
indicator in the Chat Panel header — real provider-reported numbers,
never estimated/fabricated.

**Error handling.** `ProviderError` extends the existing `NemiError`
base (Sprint 4's locked global-exception-handler pattern) for
consistency if it ever escapes the streaming generator's own
try/except, though in normal operation it's always caught there and
translated into an SSE `error` event instead. A missing API key,
an unreachable Ollama server, an invalid model, and a provider's own
4xx/5xx responses are all normalized into the same
`{code, message}` shape and rendered as a visible, dismissable error
in the Chat Panel — never a silent failure or a raw stack trace.

**Explicitly out of scope**, stated up front rather than discovered
late: semantic/embedding-based project indexing (see above); tool use
/ function calling (the provider abstraction's `stream_chat()`
signature doesn't take a tools parameter yet); multi-agent
orchestration (Planner/Developer/Reviewer/etc. from
MASTER_SPECIFICATION's AI AGENTS section) — this sprint delivers the
chat/provider/context foundation those agents would eventually run on
top of, not the agents themselves.

---

# MONACO CODE EDITOR (locked decision — Sprint 9)

Resolves the Code Editor half of Sprint 6's AI CHAT PANEL & CODE
EDITOR reservation. `FileEditor.tsx`'s plain `<textarea>` (a
deliberate Sprint 5 simplification) is replaced by a full
Monaco-based multi-tab editor: `frontend/src/components/editor/`.

**Packaging: `monaco-editor` directly, not `@monaco-editor/react`.**
The React wrapper defaults to loading Monaco from a CDN, which would
violate MASTER_SPECIFICATION's Offline First requirement. Instead,
`vite-plugin-monaco-editor-esm` (`frontend/vite.config.ts`) bundles
Monaco's web workers locally, output to `dist/monacoeditorwork/` —
never fetched from a CDN. `monaco-editor` is pinned at `0.50.0`: newer
versions' `package.json` exports map double-prefixes paths when
combined with this plugin's hardcoded worker entry points (see Sprint
9 report for the exact failure).

**Scoped imports, not `import * as monaco`.** `monacoSetup.ts` imports
the editor core (`editor.all.js` + `editor.api`) plus exactly the
required languages — importing the whole package pulls in every
language Monaco ships (abap, sql, ruby, dozens more), tripling the
bundle size. `monacoSetup.ts` is only ever reached via a dynamic
`import()` from `MonacoEditorPane.tsx`, never a static top-level
import, so Monaco's multi-MB bundle is code-split out of the initial
app load and only fetched once a file is actually opened.

**Every full-language-service pair needs both its `basic-languages`
and `language/*` import — a real bug found and fixed during Sprint 9
verification.** JSON's `language/json/monaco.contribution` calls
`monaco.languages.register()` itself, but CSS/HTML/TypeScript's
`language/*` contributions do not — they only wire up the *rich* side
(worker, diagnostics, completions) via
`monaco.languages.onLanguage(id, ...)`, which only fires once the
language id has actually been registered. That registration is the
`basic-languages/*` module's job (it supplies the Monarch tokenizer
and calls `register`). Importing only the `language/typescript`
half — as an initial implementation did — left `javascript`/
`typescript` unregistered: models silently fell back to plaintext
(a single token color, no syntax highlighting at all) and the
TypeScript worker never even loaded, since its `onLanguage` hook
never fired. `monacoSetup.ts` now imports both halves for every
full-language-service pair (json/css/html/typescript); markdown/
python/yaml/xml have no full language service in Monaco, so they use
the `basic-languages` package alone.

**Tab/split state lives in `workspace/`, not a new parallel module.**
`workspace/` already owns "what's open" (Sprint 7). `workspace-
context.ts` now models `EditorGroup` (`'primary' | 'secondary'`,
each with its own tab list and active tab) and a `splitDirection`
(`'horizontal' | 'vertical' | null`) instead of a single
`openFilePath`. Split Editor is bounded to two groups — one active
horizontal-or-vertical split, not VS Code's recursive nested-pane
system (confirmed with the founder before implementation).

**A shared, ref-counted model registry — not a per-group model
map.** `frontend/src/components/editor/modelRegistry.ts` holds one
`monaco.editor.ITextModel` per open file path, shared across both
split groups when the same file is open in each (refined during
implementation from the originally-planned per-group map, which would
let the same file silently diverge into two different in-memory
copies across a split). Reference-counted: a model is created on
first `acquireModel()` and `.dispose()`d only once every acquiring
pane has `releaseModel()`d it — the concrete mechanism behind "no
unnecessary memory leaks" across repeated open/close/split cycles.

**Ctrl+S/Ctrl+W read the active path from a ref, never from
`editor.getModel()?.uri.fsPath` — a second real bug found and fixed
during Sprint 9 verification.** Monaco's `Uri.file()`/`.fsPath` round-
trip lowercases the Windows drive letter (a known `vscode-uri`
behavior). The model registry's map key is the original,
un-normalized path string, so looking a model back up via the URI's
`fsPath` silently misses the registry on Windows and the save/close
command returns early having done nothing — dirty state cleared
visually inconsistent with disk. `MonacoEditorPane.tsx` now tracks
`activePathRef` directly from `group.activeTabPath` and reads that in
both `editor.addCommand()` handlers instead.

**App-level keyboard shortcuts compare `event.code`, never
`event.key`, for Shift-modified letter combos — a third real bug
found and fixed during Sprint 9 verification.** A real Shift+P
keypress reports `event.key === 'P'` (uppercase); an early version of
`AppShell.tsx`'s handler checked `event.key === 'p'` (lowercase) for
Ctrl+Shift+P, which therefore never matched on a real keyboard —
only appeared to work under Playwright's `keyboard.press()`, which
(unlike a real browser) reflects back whatever literal case you pass
it rather than computing the true shifted character. `event.code`
(the physical key, e.g. `'KeyP'`) is layout/shift/case-independent
and is now used for every modified-letter shortcut in that handler.

**Command Palette (Ctrl+Shift+P) is a small custom registry, not a
Monaco feature.** `frontend/src/commands/` — a flat
`Map<id, {label, run, keybinding?}>` plus a `useCommand()` hook for
registration-on-mount, and `fuzzyMatch.ts` (subsequence matching,
shared with Quick Open). Deliberately not VS Code's extension-
contribution system.

**Quick Open (Ctrl+P) and Global Search (Ctrl+Shift+F) are new
Electron-main filesystem capabilities**, added to `filesystem.ts`
alongside the existing CRUD functions — same ownership as FILESYSTEM
OWNERSHIP below. `listAllFiles()`/`searchInFiles()` share a
`walkFiles()` recursive walker with the existing `IGNORED_NAMES` set,
capped (`MAX_LIST_ALL_FILES` = 5000, `MAX_SEARCH_RESULTS` = 500) so an
unusually large repository can't hang either feature; `searchInFiles`
skips files over the same size guard `readFile()` already uses.

**Auto Save is an opt-in Settings toggle, off by default** — matches
VS Code's own default and keeps Ctrl+S meaningful either way.
Persisted via `frontend/src/settings/editorSettings.ts` (the same
`localStorage` pattern `ThemeProvider` established), debounced ~1s
after the last keystroke.

**Session restore extends the existing per-project-scoped
`localStorage` key** (Sprint 7) to store the tab/group/split
*structure* — paths, active tab, split direction — never file
content, same unchanged principle.

**Scope explicitly excluded**, stated up front rather than discovered
late: VS Code's "preview tab" behavior (single-click-to-preview,
double-click-to-pin — every opened file becomes a permanent tab
here); a native right-click context menu for tabs (Close/Close Others
are plain buttons/Command Palette entries instead); closed-tab history
does not survive an app relaunch (in-memory stack only, capped at 20).

---

# AGENT ORCHESTRATION FRAMEWORK (locked decision — Sprint 11)

Implements MASTER_SPECIFICATION's AI AGENTS section on top of the
provider/context foundation Sprint 10 built, explicitly deferred at
the end of that sprint. Only four of the eight `agents/*.md` roles are
wired into the automated pipeline — `ORCHESTRATED_ROLES = (planner,
developer, reviewer, tester)` in `backend/app/ai/agent_roles.py` — the
remaining roles (architect, debugger, etc.) stay reference documents
for now, not scheduled tasks.

**Stateless, externally-triggered orchestration — no backend-internal
loop, no server-side API keys.** Sprint 10 locked "API keys are never
stored server-side" (see AI CHAT & AGENT FRAMEWORK above); an
orchestrator that ran its own internal scheduling loop inside
`backend/app` would need to hold keys to make calls between ticks,
breaking that decision. Instead `backend/app/ai/orchestration/
manager.py`'s `run_cycle(settings, api_keys)` is a single async
function with no loop of its own — it runs exactly one scheduling pass
(pick runnable tasks, execute up to `MAX_CONCURRENT_TASKS` in
parallel, persist results) and returns. Electron main
(`frontend/electron/main.ts`) owns the actual cadence: a 4-second
`setInterval` (`AGENT_RUN_CYCLE_INTERVAL_MS`, mirroring the precedent
StatusBar's own 5-second health poll already established) decrypts
whatever provider keys `safeStorage` currently holds and calls
`POST /agents/run-cycle` fresh each tick. The backend never persists a
key between calls — the same "credential only becomes live inside
`backend/app`'s process boundary for the one call that needs it"
property Sprint 10 established for chat now also holds for agents.

**Agent roles are derived from `agents/*.md`, not hand-duplicated as
Python strings.** `agent_roles.py`'s `load_agent_roles()` parses each
role file's `# Heading` sections into a system prompt
(`_compose_system_prompt()`), rewriting NEMI-self-referential text
("NEMI AI STUDIO", "this project's own codebase") to refer to *the
user's* project instead — an orchestrated agent is working on the
user's code, not NEMI's own — and replacing any "BEFORE you start,
read NEMI's internal docs" instructions (meaningless outside this
repo) with a generic equivalent. `AgentsRepository.seed_from_role_files()`
runs once at backend startup (`server.py`'s `_lifespan()`, after
`init_db()`) so the `agents` table always reflects whatever's on disk
— no separate migration step when a role file changes. Packaged
builds bundle `agents/*.md` via PyInstaller's `datas` entry
(`nemi-backend.spec`) and resolve the directory at runtime through the
same `sys.frozen` self-detection `config.py` already used for the
database/log paths (Sprint 8) — a packaging gap that predates this
sprint (the role files were never bundled for a packaged build) fixed
as part of making agents work end to end.

**Agent Task Queue — `agent_tasks` table, dependency-gated
scheduling.** A pipeline is a chain of rows sharing a `title`, each
with a distinct `agent_role` and an optional `depends_on_task_id`
pointing at the previous stage. `AgentTasksRepository.list_runnable()`
returns queued tasks with no dependency, or whose dependency's
`status = 'completed'` — the entire scheduling rule. `POST
/agents/tasks` (`AgentPipelineCreate`) creates the whole chain
up front in `queued` status, `stages` defaulting to all four
orchestrated roles in order, so a caller sees the full plan
immediately rather than discovering later stages as earlier ones
finish.

**Parallel execution — bounded, not unlimited.** `run_cycle()` gathers
up to `MAX_CONCURRENT_TASKS = 3` runnable tasks per pass via
`asyncio.gather`, independent pipelines (or independent root-stage
tasks) genuinely executing concurrently rather than one-at-a-time —
confirmed live (two independent single-stage tasks both observed in
`running` status simultaneously), not just structurally plausible.

**Automatic retries and failure recovery.**
`AgentTasksRepository.mark_failed_or_retry()` increments `retry_count`
and re-queues automatically while `retry_count <= max_retries`
(default 2, so a task gets up to three total attempts before landing
permanently on `failed`) — no manual intervention needed for a
transient failure. Once a task is permanently `failed`,
`cascade_cancel_dependents()` recursively cancels every downstream
queued task in that pipeline rather than leaving them stuck in
`queued` forever with a dependency that will never complete — a real
failure state, not silent hanging. Confirmed live: a deliberately
unresolvable model name failed the planner stage after exactly three
attempts (`retry_count = max_retries + 1`), and the dependent
developer stage was cascade-cancelled within the same scheduling pass.
A user can also explicitly `retryTask()`/`cancelTask()` a task through
the Agents Dashboard, using the same repository methods.

**Agent-to-agent communication — the `memory` table's first real
implementation.** `memory` has existed schema-ready since Sprint 4
(`type IN ('project','conversation','long_term','task','knowledge')`)
without a repository. `MemoryRepository.remember()`/`recall()` gives
it one, using `type='task'` and `key=<completed task id>` to hand a
completed stage's output to the next stage as durable state — durable
specifically because it survives a backend restart mid-pipeline
(unlike an in-memory handoff, which wouldn't), matching "conversation
and execution history" being a real persistence requirement, not just
a UI nicety.

**Developer Agent file changes are proposed, never auto-applied.**
The Developer role's system prompt instructs it to emit file changes
as fenced ` ```file:relative/path\n<content>\n``` ` blocks;
`manager.py`'s `_extract_proposed_files()` parses them via regex into
`AgentTaskOut.proposed_files` and stores them on the task row —
parsing only, no filesystem write happens server-side. Applying a
proposed file is a distinct, explicit user action
(`AgentsContextValue.applyProposedFile()`, wired to a per-file "Apply"
button in the Agents Dashboard) that calls the existing
`window.nemi.fs.writeFile()` IPC (Sprint 5), the same human-gated
write path every other file mutation in the app already goes through.
This is a direct reading of `agents/developer.md`'s own "never delete
files without approval" rule, extended to creation/modification as
well — an agent proposes, a human applies.

**Provider-independent by construction, not by a second abstraction.**
The orchestrator calls `get_provider(task["provider"]).stream_chat(...)`
— Sprint 10's existing `AIProvider` abstraction, used directly, not
wrapped in a new agent-specific provider layer. Any provider Sprint 10
supports (OpenAI, Anthropic, Gemini, Ollama), an agent task can use,
selected per-task at creation time.

**Explicitly out of scope**, stated up front: the four
non-orchestrated `agents/*.md` roles (architect, debugger, and
others) are not scheduled — only planner/developer/reviewer/tester
participate in the automated queue; a true dependency graph beyond a
single linear chain (e.g. fan-out/fan-in, one task depending on
multiple predecessors) — `depends_on_task_id` is a single foreign key,
not a list; and streaming agent output token-by-token to the Agents
Dashboard in real time — a task's progress is visible via its
`status`/`conversation_id` (open the full conversation to see the
exchange), not a live-streaming view of the task card itself.

---

# WORKFLOW ENGINE & AI PROJECT MANAGER (locked decision — Sprint 12)

Builds MASTER_SPECIFICATION's AI Project Manager on top of the Agent
Orchestration Framework (above): a user gives one high-level goal, and
the system turns it into an ordered set of milestones, each executed
as its own planner/developer/reviewer/tester pipeline — with pause/
resume/cancel, human approval gating, and a live Sprint Progress
Center, without inventing a second execution engine alongside
Sprint 11's.

**A workflow's very first task IS the AI Project Manager, reusing the
Planner role rather than adding a ninth agent persona.** `POST
/workflows` creates a `workflows` row (`status='planning'`) plus a
single `agent_tasks` row: `agent_role='planner'`, `workflow_id` set,
`milestone_id` NULL. That combination — a Planner task with a workflow
but no milestone — is what `manager.py`'s `_execute()` recognizes as
"decompose the goal, don't plan a single already-scoped task": it
appends `project_manager.MILESTONE_FORMAT_INSTRUCTION` to the
Planner's normal system prompt, asking for `### MILESTONE: <title>`
sections, mirroring `agent_roles.py`'s own `# Heading` splitting
convention. Crucially, this decomposition call is **not** a synchronous
API request — it's scheduled and executed through the exact same
`run_cycle()` every other agent task goes through, so it gets
retries/no-server-side-keys/parallelism for free instead of a second,
inconsistent execution path. `project_manager.parse_milestones()`
parses the response (mirroring `_extract_proposed_files()`'s
regex-parsing convention); an empty result fails the workflow outright
with a visible, honest error rather than leaving it silently stuck at
`'planning'` forever — the same small-model instruction-following risk
already documented for Sprint 11's `proposed_files` format.

**Each milestone becomes a full 4-stage pipeline, chained into one
linear sequence across the whole workflow — not a multi-parent
dependency graph.** `project_manager.create_milestone_pipelines()`
creates a `milestones` row plus
planner→developer→reviewer→tester `agent_tasks` per milestone
(reusing `AgentTasksRepository.create()` exactly as Sprint 11's
`POST /agents/tasks` does), with each milestone's first stage
depending on the *previous* milestone's last stage (or, for the first
milestone, on the goal-decomposition task itself). `depends_on_task_id`
remains the single-link column Sprint 11 defined — extending it to a
true DAG (fan-out/fan-in) was considered and deliberately deferred, since
nothing in this sprint's requirements calls for one and Sprint 11
already scoped it this way.

**Pause/Resume are implemented by filtering, not by touching task
status.** `AgentTasksRepository.list_runnable()` gained a join against
`workflows`: a task is only runnable if its workflow (when it has one)
is in `'planning'`, `'queued'`, or `'running'` — `'paused'` and every
terminal status silently stop new tasks from starting, with zero
changes to the tasks' own `status` column. This is why Resume is exact:
whatever was `'queued'` when paused is still `'queued'` after
resuming, picked up on the next scheduling pass exactly where it left
off. A task already `'running'` when a workflow is paused is left to
finish its in-flight call — the same "no force-abort mid-call"
behavior Sprint 11's per-task cancel already has.

**Human Approval Mode is a per-task gate, not a new task-status
value.** Adding `'pending_approval'` to `agent_tasks.status`'s CHECK
constraint would have required rebuilding the table (SQLite can't
alter a CHECK constraint in place, and Sprint 11 already shipped
`agent_tasks` without anticipating this value) — avoided entirely by
adding two additive columns instead: `requires_approval` (set at
creation time when a workflow's `approval_mode='manual'`) and
`approved_at` (nullable, set by `POST /agents/tasks/{id}/approve`).
`list_runnable()`'s WHERE clause excludes any task with
`requires_approval=1 AND approved_at IS NULL` — the task stays
genuinely `'queued'` the whole time, just invisible to the scheduler
until a human approves it. The three modes: **Fully Automatic**
(`approval_mode='auto'`) — every stage runs unattended *and*
Developer-proposed files are written to disk without a click (see
below); **Review Before Apply** (`'review'`, the default, and exactly
Sprint 11's original behavior unchanged) — stages run unattended,
proposed files wait for a human Apply; **Manual Approval**
(`'manual'`) — every single stage, including the goal-decomposition
task itself, waits for an explicit approval before it starts.

**Fully Automatic's auto-apply lives in the renderer
(`WorkflowsProvider.tsx`), not Electron main or the backend.** The
backend cannot write files itself (Sprint 5's locked Filesystem
Ownership decision is unchanged), and Electron main has no reliable
way to know which project is "current" — that's renderer-side
`ProjectContext` state. So `WorkflowsProvider`'s own poll (mirroring
`AgentsProvider`'s cadence) scans active `'auto'`-mode workflows'
completed Developer tasks for unapplied `proposed_files`, writes them
via the existing `window.nemi.fs.writeFile()` path (the same one the
manual Apply button already uses), then calls the new
`POST /agents/tasks/{id}/mark-files-applied` so a later poll never
repeats the write — `proposed_files_applied` persists the "did this
already happen" flag server-side rather than relying on component
state that resets on reload (a small durability improvement over
Sprint 11's original in-memory-only Apply tracking).

**Agent Collaboration's conflict detection is real, not fabricated.**
When a Developer stage completes with proposed files, `manager.py`'s
`_detect_conflicts()` cross-references every other task in the same
workflow for an overlapping proposed path (parallel milestones, or a
retry racing an earlier attempt, can genuinely collide) and records a
human-visible `conflict_warning` on the task — flagged, never silently
auto-merged or resolved. Verified directly (not by trying to coerce
two live model calls into colliding, which isn't reliably reproducible)
via a test that seeds two tasks with an overlapping path and asserts
the warning appears with the correct sibling task named.

**Auto Resume after restart** is `AgentTasksRepository.
requeue_orphaned_running_tasks()`, called once in `server.py`'s
`_lifespan()` after `init_db()`: any `agent_tasks` row still
`status='running'` at startup can only be a leftover from a process
that died mid-execution — a clean run always transitions a task onward
via `mark_completed`/`mark_failed_or_retry`, so there is no live call
left to finish. Requeuing it (`status='queued'`, `started_at=NULL`)
lets `run_cycle()` naturally pick it back up on the very next
scheduling pass, satisfying "Background Worker: resume unfinished
work" without a separate resume-tracking mechanism.

**Sprint Progress Center is read-derived, not a separately-maintained
summary.** `_sync_workflow_progress()` (called from `_run_task()`'s
`finally` block whenever a workflow-scoped task finishes) re-derives
each milestone's status from its own tasks' real statuses, then the
workflow's status from all its tasks — a workflow already in a
terminal state is left alone so a straggling in-flight task finishing
after a cancel can't resurrect it. The frontend's
`SprintProgressCenter.tsx` renders percentage/counters/current-agent
directly from this derived state (`GET /workflows/{id}` returns the
full `milestones`+`tasks` detail in one call) rather than a
duplicated, driftable summary table. ETA is a stated estimate
(`average completed-task duration × remaining task count`), never
implied as exact. "Resource usage" reports the actual backend child
process's real memory (`Get-Process -Id <pid>`, exact) and CPU
(computed by diffing `TotalProcessorTime` between two samples —
approximate, labeled as such) — this app's only packaged target is
Windows (`package.json`'s `build.win`), so a Windows-specific
`Get-Process` call is the pragmatic honest choice over a native addon,
returning `null` on any other platform or if the process can't be
inspected, never a fabricated number.

**Explicitly out of scope**, stated up front: a true multi-parent
dependency graph (fan-out/fan-in) — pipelines and milestone chains are
linear; live token-by-token streaming into the Progress Center itself
(a task's progress is visible via its status and a link into the full
conversation); and resource usage for platforms other than Windows.

---

# LIVE DEVELOPMENT DASHBOARD & INTELLIGENCE CENTER (locked decision — Sprint 13)

A real-time operational view over everything the Agent Orchestration
Framework (Sprint 11) and Workflow Engine (Sprint 12) already track,
plus new real system/git/build integration — not a second data model,
a read/aggregation layer over the existing one. Opened via a new
HeaderToolbar button (or `Ctrl+Shift+I`), it replaces the main content
area (editor or Dashboard) the same way Sprint 9's editor already
takes over that region, with its own internal 12-section left nav
(`frontend/src/components/intelligence/sections.ts`).

**Every widget is backed by a real, honestly-labeled data source — the
project's standing "no fabrication" practice extended to a sprint
whose brief asks for more display surfaces than this app has real
telemetry for.** Three deliberate substitutions, each documented at
its own point of use rather than silently shipped: "AI logs" (a
requested Live Terminal category) is folded into "Backend" logs
because Sprint 4 already locked AI/orchestration logging into the same
`backend.stdout`/`stderr` stream, not a separate one; "Network" in the
Resource Monitor reports backend connectivity (ready/error), not
bandwidth, since Node has no built-in cross-platform throughput API;
and the Live Workflow View's `Documentation → Commit → Push` nodes
render as explicitly `not yet automated — performed manually` rather
than fake progress, since this app has no in-app commit/push action.

**`GET /stats/performance`, `/stats/tokens`, `/history` are
aggregation endpoints, not new stored state.** `StatsRepository`
(`backend/app/db/repositories/stats_repository.py`) computes success/
failure/retry rate and average task/agent duration fresh from
`agent_tasks` on every call, and token sums (session/day/month
windows) fresh from `ai_messages` (Sprint 10) — this app's data volume
is single-user desktop scale, so there's no performance case for
maintaining a running total. Estimated cost applies a small published
list-pricing table (`backend/app/ai/pricing.py`) to real token counts;
a model outside the table reports `estimated_cost_usd: null`, never a
guessed number, and Ollama is always exactly `$0` (local, no billing).

**Execution History is the `history` table's first real
implementation** — schema-ready, unused, since Sprint 3.
`HistoryRepository` records workflow/task lifecycle events
(`action='updated'`, `snapshot` carries the specifics) at the API/
orchestration layer, not inside the entity repositories themselves —
consistent with `postLog()`'s own pattern of being called at the
point of a real state change, not baked into a setter.

**AI Thinking Panel's "current reasoning" is genuine partial model
output, not fabricated.** `agent_tasks` gained one additive column,
`live_output`, flushed by `manager.py`'s streaming loop every
`LIVE_OUTPUT_FLUSH_INTERVAL_SECONDS` (1.5s) — frequent enough to feel
live, infrequent enough to not turn every streamed token into its own
SQLite write. Cleared back to `NULL` on completion, failure, or
cancellation (`result_summary`/`error_message` take over). This was
the one new column this sprint touched on `agent_tasks` — additive,
same pattern as Sprint 12's six columns, no CHECK-constraint change.

**Live Agent Monitor's per-role status is computed entirely
client-side from data the app already polls** (`AgentsProvider`'s
`tasks`) — no new backend endpoint. For each of
Planner/Developer/Reviewer/Tester, the most recently updated task with
that role determines Idle/Running/Waiting/Completed/Failed/Retrying;
"Project Manager" is the same derivation scoped to goal-decomposition
tasks (`milestone_id === null && workflow_id !== null`, see Sprint
12's AI Project Manager); "Workflow Engine" reflects whether any task,
system-wide, is currently `running`.

**Build Center operates on the currently *open project*, never on
NEMI AI STUDIO's own source — a packaged install has no `.git` or
`package.json` for its own code at the install location, and the
entire point of this platform is helping the user build *their*
project.** `git-status.ts` and `build-runner.ts`
(`frontend/electron/`) both take a `projectPath` argument rather than
using `__dirname`. Git integration is read-only (branch, ahead/behind,
dirty, recent commits via `git log`/`git rev-list` — never throws,
reports `isRepo: false` on any failure rather than surfacing an
error, since this is informational, not a required capability). Build/
Test/Verify are real, detected capabilities, not assumed ones:
`detectAvailableRunners()` only offers "Run Build"/"Run Tests" if the
open project's `package.json` actually defines those npm scripts (or,
for Test, if it looks like a Python project); "Run Verification" is a
fast subset (`npx tsc --noEmit` or `python -m compileall`) — genuinely
faster than a full build in the common case, though on a large
project it can still take real wall-clock time, confirmed live
(pegged system CPU during a real run, correctly reflected by the
Resource Monitor's own live CPU reading at the same moment).

**Notifications are derived from genuine state transitions, keyed
per-entity, never from "this is the first time I've observed this
item."** `IntelligenceProvider.tsx` tracks each workflow's and task's
previous status in a `Map`; a status change only notifies when a prior
status was already on record — an item's very first observation after
mount only establishes the baseline. This distinction was added after
a live-testing regression: without it, a workflow or task that had
already reached `failed`/`completed` in an earlier session re-fired
its notification the instant the dashboard mounted in a fresh session,
because the tracking `Map`s start empty every launch — accurate in the
sense that the failure was real, but misleading in implying it had
just happened.

**Explicitly out of scope**, stated up front: bandwidth/network
throughput (see above); a real Commit/Push *action* (git integration
is read-only this sprint); a true multi-parent workflow dependency
graph (unchanged from Sprint 11/12's scoping); and file-level
granularity in the AI Thinking Panel's "Current File" field (agent
tasks aren't tracked at that resolution).

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
16. **(Sprint 8)** Packaged builds bundle the backend via PyInstaller
    (onedir, not onefile — see STANDALONE RUNTIME BUNDLING above) and
    spawn it directly with no `PATH`/system-Python dependency; dev mode
    is unchanged (`python -m app.main` from `PATH`).
17. **(Sprint 8)** Packaged builds always pass `NEMI_DB_PATH`/
    `NEMI_LOG_FILE` (from `app.getPath('userData')`) to the backend
    process — the correct, conventional location for mutable per-user
    app data, replacing the Alpha build's incidental behavior of
    writing inside `resourcesPath`. Dev mode is unaffected; both env
    vars were already-supported overrides in `config.py` since Sprint 4.
18. **(Sprint 9)** `FileEditor.tsx`'s plain `<textarea>` is replaced by
    Monaco (see MONACO CODE EDITOR above), resolving the Code Editor
    half of Sprint 6's reservation — the AI Chat Panel half remains
    reserved, not built.
19. **(Sprint 9)** Split Editor is bounded to two groups (one active
    horizontal-or-vertical split), not VS Code's recursive nested-pane
    system — confirmed with the founder before implementation.
20. **(Sprint 9)** Quick Open and Global Search's file-listing/search
    capabilities live in Electron main (`filesystem.ts`), matching the
    Sprint 5 FILESYSTEM OWNERSHIP decision — not the Python backend.
21. **(Sprint 9)** App-level keyboard shortcuts compare `event.code`,
    never `event.key`, for Shift-modified letter combos — `event.key`
    case depends on whether Shift was actually applied by the browser,
    which real keypresses and synthetic test input do not always agree
    on; `event.code` is layout/shift/case-independent.
22. **(Sprint 10)** AI provider API keys are encrypted with Electron's
    `safeStorage` and persisted only in `app.getPath('userData')`,
    never in SQLite (upholds DATABASE_SCHEMA.md's existing "no column
    stores secrets" convention) and never in the repo. The backend
    receives a key only as part of the one request that needs it and
    never persists it.
23. **(Sprint 10)** `ai_conversations`/`ai_messages` are normalized
    tables, not entries in the generic `memory` table — see
    DATABASE_SCHEMA.md for the full rationale (an ordered,
    per-message-metadata transcript needs real columns to be queryable
    and indexable, the same reasoning that already justified `files`
    existing as its own table).
24. **(Sprint 10)** AI chat streaming uses Server-Sent Events end to
    end: FastAPI `StreamingResponse` on the backend, relayed by
    Electron main into `webContents.send()` push events on the
    existing `fs:changed`/`window:maximized-change` pattern — not a
    new IPC shape.
25. **(Sprint 10)** Cancellation persistence happens in a `finally`
    block, not after the streaming loop's `try` — a disconnect that
    lands before the first provider chunk arrives delivers
    `GeneratorExit` at that suspension point, skipping past the loop's
    own `is_disconnected()` check entirely; only a `finally`-level
    check reliably catches that case.
26. **(Sprint 10)** "Project indexing" is the existing Sprint 9
    file-tree/manifest lookup (`listAllFiles`), reused for `@file`
    references and editor-selection context — not a semantic/
    embedding-based vector index, which would need its own
    infrastructure disproportionate to this sprint.
27. **(Sprint 10)** Monaco's right-click context menu cannot be
    reliably automated by Playwright in this Electron build (confirmed
    live — neither a real right-click at exact coordinates nor F1's
    Quick Command opened anything), the same category of limitation
    already documented for Monaco in Sprint 9. The five AI editor
    actions therefore also get explicit keybindings
    (`Ctrl+Shift+Alt+<letter>`), which are both genuine keyboard-
    accessible UX and the actual path live verification exercises.
28. **(Sprint 11)** The agent orchestrator (`run_cycle()`) is
    stateless and holds no API keys of its own — Electron main
    triggers one scheduling pass every 4 seconds, decrypting keys via
    `safeStorage` fresh each call, preserving Sprint 10's "keys never
    persisted server-side" decision rather than creating a second,
    inconsistent credential path for agents.
29. **(Sprint 11)** Only `planner`/`developer`/`reviewer`/`tester`
    from `agents/*.md` participate in the automated task queue
    (`ORCHESTRATED_ROLES`); the other role files remain reference
    documents, not scheduled tasks.
30. **(Sprint 11)** Agent-to-agent handoff uses the `memory` table
    (`type='task'`), the table's first real implementation since it
    was made schema-ready in Sprint 4 — durable across a backend
    restart mid-pipeline, not an in-memory handoff.
31. **(Sprint 11)** Developer Agent file changes are parsed into
    `proposed_files` but never written to disk automatically — a
    human must explicitly Apply each one, going through the same
    `window.nemi.fs.writeFile()` path (Sprint 5) every other file
    mutation in the app uses. A direct extension of
    `agents/developer.md`'s own "never delete files without approval"
    rule to creation/modification.
32. **(Sprint 11)** A task's dependency is a single
    `depends_on_task_id`, not a graph — pipelines are linear chains,
    not fan-out/fan-in DAGs; parallelism comes from running
    *independent* chains concurrently (bounded by
    `MAX_CONCURRENT_TASKS = 3`), not from branching within one chain.
33. **(Sprint 11)** A task gets up to `max_retries + 1` total attempts
    (default 3) before landing permanently on `failed`; permanent
    failure cascade-cancels every downstream queued task in that
    pipeline rather than leaving them stuck waiting on a dependency
    that will never complete.
34. **(Sprint 12)** The AI Project Manager reuses the existing Planner
    role (a Planner task with a workflow but no milestone yet), run
    through the same stateless `run_cycle()` every other agent task
    uses — not a synchronous API call and not a ninth agent persona.
35. **(Sprint 12)** Workflow Pause/Resume is implemented by filtering
    `list_runnable()` against the parent workflow's status, with zero
    changes to the task's own `status` column — Resume is exact
    because nothing about a paused task's state ever changed.
36. **(Sprint 12)** Human Approval Mode's "Manual" tier is two additive
    columns (`requires_approval`, `approved_at`), not a new
    `agent_tasks.status` value — adding a CHECK-constrained value to an
    existing SQLite table requires a full table rebuild, which this
    avoids entirely.
37. **(Sprint 12)** Milestone chains are one linear sequence across the
    whole workflow (each milestone's first stage depends on the
    previous milestone's last stage) — `depends_on_task_id` remains
    Sprint 11's single-link column, not extended into a multi-parent
    dependency graph.
38. **(Sprint 12)** Fully Automatic approval mode's auto-apply of
    Developer-proposed files happens in the renderer
    (`WorkflowsProvider.tsx`), not Electron main or the backend — the
    backend still never writes files (Sprint 5), and only the renderer
    reliably knows which project is current.
39. **(Sprint 12)** "Auto Resume after restart" requeues any
    `agent_tasks` row still `status='running'` at backend startup —
    such a row can only be a leftover from a process that died
    mid-execution, since a clean run always transitions it onward.
40. **(Sprint 12)** Resource usage reporting is Windows-specific
    (`Get-Process`), matching this app's only packaged target
    (`package.json`'s `build.win`) — returns `null` elsewhere rather
    than a fabricated number.
41. **(Sprint 13)** Stats/History endpoints (`/stats/performance`,
    `/stats/tokens`, `/history`) are computed fresh from
    `agent_tasks`/`ai_messages` on every call, not a maintained running
    total — appropriate at this app's single-user desktop data volume.
42. **(Sprint 13)** Token cost is a labeled *estimate* from a small
    published-pricing table (`app/ai/pricing.py`); a model outside the
    table reports `null`, never a guessed figure. Ollama is always
    exactly `$0`.
43. **(Sprint 13)** The Build Center operates on the currently open
    *user* project (via a `projectPath` argument), never on NEMI AI
    STUDIO's own source — a packaged install has no `.git`/
    `package.json` for its own code, and helping the user build their
    project is the entire point of this platform.
44. **(Sprint 13)** "Run Build"/"Run Tests" are only offered when
    `detectAvailableRunners()` finds a real corresponding script/project
    marker in the open project — never a button that would just fail.
45. **(Sprint 13)** Requested-but-not-real telemetry is substituted with
    an honestly labeled real alternative rather than fabricated: "AI
    logs" folds into "Backend" logs (Sprint 4 already locked AI/
    orchestration logging into that same stream); "Network" reports
    backend connectivity, not bandwidth (no cross-platform throughput
    API); undelivered pipeline stages (Documentation/Commit/Push) render
    as explicitly not-yet-automated, not as fake progress.
46. **(Sprint 13)** Dashboard notifications key their "already seen"
    tracking per entity (workflow/task id → last known status), not a
    single "have I loaded yet" flag — an item already in a terminal
    state when a fresh session's first poll observes it establishes the
    baseline silently; only a transition witnessed *during* the session
    notifies. Found and fixed via live testing after an earlier version
    re-notified for already-failed leftover state on every fresh launch.

---

END OF DOCUMENT
