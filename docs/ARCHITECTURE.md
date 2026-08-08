# ARCHITECTURE.md

Version: 1.7
Status: Finalized (Sprint 3); Backend Integration Locked (Sprint 4); Filesystem Ownership Locked (Sprint 5); AI Chat/Editor Reserved (Sprint 6); Workspace & Project Management Locked (Sprint 7); Standalone Runtime Bundling Locked (Sprint 8); Monaco Code Editor Locked (Sprint 9); AI Chat & Agent Framework Locked (Sprint 10)
Governs: Sprint 10 onward

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
(declared in `frontend/src/types/electron-api.d.ts`). As of Sprint 10
this surface has five namespaces: `windowControls` (Sprint 2),
`backend` (Sprint 4: `health()`; Sprint 5: `logs()`), `fs`
(Sprint 5: project/file CRUD + change notifications; Sprint 7:
`selectDirectory()`, `createDirectory()`; Sprint 9: `listAllFiles()`
for Quick Open, `searchInFiles()` for Global Search — same ownership
as the rest of `fs`, see FILESYSTEM OWNERSHIP below), `projects`
(Sprint 7: `listRecent()`, `recordOpened()`, `remove()`), and `ai`
(Sprint 10: `listProviders()`, `listOllamaModels()`, `hasApiKey()`/
`setApiKey()`/`clearApiKey()`, `listConversations()`/
`createConversation()`/`renameConversation()`/`deleteConversation()`/
`listMessages()`, `sendMessage()`/`cancelMessage()`/`onStreamEvent()`
— see AI CHAT & AGENT FRAMEWORK below). A component must never assume
Node.js globals exist. All ambient types shared across `window.nemi`
methods (`ExplorerEntry`, `LogEntry`, `BackendHealth`, `ProjectRecord`,
`SearchMatch`, `SearchOptions`, `AiProviderInfo`, `AiConversation`,
`AiMessage`, `AiContextRef`, `AiStreamEventPayload`, etc.) live inside
the `declare global` block of `electron-api.d.ts` so they're usable
anywhere in the renderer without imports.

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

---

END OF DOCUMENT
