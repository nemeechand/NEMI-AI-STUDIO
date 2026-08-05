# ARCHITECTURE.md

Version: 1.0
Status: Finalized (Sprint 3)
Governs: Sprint 4 onward

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
- `components/common/` — shared, reusable, presentation-only primitives
  (e.g. `IconButton`). A component belongs here only if it has no
  feature-specific knowledge.
- `theme/` — Theme Manager (React Context + provider + hook), the only
  cross-cutting frontend state so far.

Rule: components read data through props or hooks only. No component
may import Node/Python/filesystem APIs directly — that always goes
through `window.electronAPI` (see IPC Boundary below).

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

Decision deferred to a future sprint: whether AI provider calls are
made from the Python backend (preferred, keeps secrets out of the
renderer) or proxied through Electron main. Given the Security Rules
("never expose secrets", "no secrets inside source code"), the
Python backend is the default assumption — API keys must never reach
the renderer process.

## Data Layer

- `backend/app` — Python backend package (scaffold only, Sprint 1B).
- SQLite — see `docs/DATABASE_SCHEMA.md` for finalized table design.
  No database file or ORM exists yet; this is a design-only sprint
  for the schema.
- `logs/`, `memory/`, `config/`, `projects/` — top-level folders
  reserved per MASTER_SPECIFICATION's FOLDER STRUCTURE. Currently
  empty; not yet wired to any process.

---

# ELECTRON PROCESS MODEL

Three processes, already implemented and hardened in Sprint 2:

- **Main process** (`frontend/electron/main.ts`) — owns the
  `BrowserWindow`, window controls, and (in the future) spawning the
  Python backend as a child process. `sandbox: true`,
  `contextIsolation: true`, `nodeIntegration: false`.
- **Preload script** (`frontend/electron/preload.ts`) — the only
  bridge between main and renderer. Exposes a typed `window.electronAPI`
  surface via `contextBridge`. Nothing beyond what the renderer
  actually needs may be exposed here.
- **Renderer process** (`frontend/src`) — the React app. Never talks
  to Node.js, the filesystem, or Python directly.

## IPC Boundary (locked decision)

All renderer → native calls go through `window.electronAPI`
(declared in `frontend/src/types/electron-api.d.ts`). Today this
surface is empty (no bridged methods yet). Future filesystem,
database, or AI-agent triggers must be added here first, as a typed
method, before any component may call them. A component must never
assume Node.js globals exist.

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

# BACKEND INTEGRATION (open decision — not started)

Deferred to a future sprint, tracked in PROJECT_MEMORY.md pending
tasks:

- API framework selection (e.g. FastAPI vs. a minimal stdlib
  approach) for `backend/app`.
- Electron ↔ Python process wiring (child process + local HTTP, or
  stdio-based RPC).

Until this decision is made, no frontend code may assume a running
backend, and no backend code may assume it is reachable from Electron.

---

# PLUGIN / EXTENSION ARCHITECTURE (future — not started)

MASTER_SPECIFICATION.md lists "Plugin Marketplace" under FUTURE
MODULES. No plugin loader, manifest format, or sandboxing model
exists yet. Any future plugin system must not weaken the current
Electron hardening (sandbox, contextIsolation, CSP) — plugin code
must never run with Node.js integration in the renderer.

---

# SUMMARY OF LOCKED DECISIONS THIS SPRINT

1. Application/AI layers are reserved namespaces, not yet implemented.
2. All native access from the renderer goes through
   `window.electronAPI` — no exceptions.
3. AI provider secrets belong in the Python backend, never the
   renderer, once that layer exists.
4. Cross-cutting frontend state follows the Context+Provider+Hook
   three-file pattern established by the Theme Manager.
5. Backend framework and Electron↔Python transport remain open,
   explicitly deferred, decisions.

---

END OF DOCUMENT
