# SPRINT 5 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 5 — Real Filesystem, File CRUD, Live Watching, Backend-Connected Logger Panel
Status: Completed
Date: 06 August 2026

---

# COMPLETED TASKS

1. Built the real filesystem-backed Project Explorer, replacing the Sprint 2 static mock tree.
2. Connected the Logger Panel to backend logs (`GET /logs`), replacing mock entries.
3. Added File Create, Rename, Delete, Open and Save — all genuinely working, not stubbed.
4. Added real-time filesystem watching via `chokidar`, including a fix for a race and a Windows-specific native crash found during verification.
5. Improved Electron ↔ Python IPC: a dedicated `backend-client.ts`, a real `/logs` write path (not just health polling), consistent typed error propagation.
6. Added robust logging and error handling: file-operation audit logging to the backend, a `RequestValidationError` handler for consistent error shape, a 2 MB file-size guard with a clear error instead of a silent hang.
7. Kept the architecture modular: filesystem CRUD/watch logic (`filesystem.ts`) is deliberately Electron-free, separated from dialog code (`project-dialogs.ts`) — a genuine single-responsibility split, not just a testing convenience.
8. Updated `docs/ARCHITECTURE.md` (new FILESYSTEM OWNERSHIP section) and `PROJECT_MEMORY.md`.
9. Generated this report.
10. Ran the full verification suite (backend + frontend + a standalone filesystem smoke test + live end-to-end).
11. Committing and pushing next (see below).

---

# ARCHITECTURE DECISION LOCKED THIS SPRINT

**Filesystem ownership: Electron main, not the Python backend.**

File I/O and real-time watching happen entirely in Node (`frontend/electron/filesystem.ts` + `chokidar`), relayed to the renderer through the same IPC-relay pattern used for backend calls. This mirrors how conventional desktop IDEs are built (main/extension-host process owns disk I/O) and avoids adding HTTP round-trip latency for local file operations that have no cross-machine or business-logic reason to go through Python. The `files` SQLite table (designed in Sprint 3) remains an unused future indexing/search feature — file content always comes from disk directly. Full reasoning is in `docs/ARCHITECTURE.md`.

---

# A BUG FOUND AND FIXED DURING VERIFICATION

While writing a standalone smoke test to exercise `filesystem.ts` against a real temp directory (since native OS dialogs can't be scripted in this environment), the process **crashed** — not a JS exception, an unrecoverable native crash:

```
Assertion failed: !_wcsnicmp(filename, dir, dirlen), file src\win\fs-event.c, line 72
```

Root cause: `os.tmpdir()` in this environment resolves to a Windows short-path alias (`C:\Users\HAREKR~1\...`) rather than the long form (`C:\Users\Hare Krishna\...`). Chokidar's native Windows file-watcher hits a libuv assertion when the watched root is a short-path alias — and a native assertion failure is not catchable by JS `try/catch`; it takes the whole process down.

**Fix**: `openProject()` now calls `fs.realpath()` on the target folder before starting the watcher, which reliably resolves short-path aliases to their long form. Verified the exact crash reproduced on the short-path root and was gone after the fix, while a normal long-path root never exhibited it. Folders selected via the native folder-picker dialog already return long paths, so this mainly guards an edge case — but a process-killing native crash is worth defending against regardless of how rarely it's hit.

A second, smaller timing issue was also found and fixed: `openProject()` previously resolved before chokidar's watcher had finished its initial scan, so a file created immediately afterward could race the watcher's setup and go unnoticed. `openProject()` now awaits the watcher's `ready` event before resolving.

---

# GENERATED FILES

**Backend**
- `backend/app/api/schemas.py` — `LogEntryCreate`/`LogEntryOut` pydantic models.
- `backend/app/api/logs.py` — `GET /logs`, `POST /logs`.
- `backend/tests/test_logs_api.py` — create/list, limit + ordering, validation error shape.

**Electron**
- `frontend/electron/backend-client.ts` — centralized HTTP calls to the backend (`fetchRecentLogs`, `postLog`, `checkHealth`), host/port constants.
- `frontend/electron/filesystem.ts` — `listDirectory`, `readFile`, `writeFile`, `createFile`, `renameEntry`, `deleteEntry`, `openProject`/`closeProject`, chokidar watcher. No Electron import — pure Node.
- `frontend/electron/project-dialogs.ts` — `selectProjectFolder(window, mode)`, the only module using `dialog`/`BrowserWindow`.

**Renderer**
- `frontend/src/project/` — `project-context.ts`, `ProjectProvider.tsx`, `useProject.ts`, `useOpenProjectDialog.ts` (Context+Provider+Hook pattern, matching the Theme Manager).
- `frontend/src/components/explorer/ExplorerTree.tsx`, `InlineNameInput.tsx` — new.
- `frontend/src/components/editor/FileEditor.tsx` — minimal plain-textarea file editor.

**Docs**
- `docs/SPRINT_5_REPORT.md` (this file).

---

# MODIFIED FILES

- `backend/app/db/repositories/logs_repository.py` — `insert()` now returns the created row (dict) instead of just an id.
- `backend/app/core/errors.py` — added a `RequestValidationError` handler for consistent error shape on pydantic validation failures.
- `backend/app/server.py` — registered the `/logs` router.
- `backend/tests/test_db.py`, `backend/tests/test_health.py` — updated for the `insert()` return-type change and to use `TestClient` as a context manager (required for the FastAPI lifespan/DB-init to actually run — a latent gap from Sprint 4 that only surfaced once a DB-touching endpoint besides startup existed).
- `frontend/electron/backend-process.ts` — refactored to reuse `BACKEND_HOST`/`BACKEND_PORT`/`checkHealth` from `backend-client.ts` instead of duplicating them.
- `frontend/electron/main.ts` — registers `fs:*` and `backend:logs` IPC channels; starts the change-listener bridge; stops the project watcher on `before-quit`.
- `frontend/electron/preload.ts` — exposes `window.nemi.fs.*` and `window.nemi.backend.logs()`.
- `frontend/src/types/electron-api.d.ts` — `ExplorerEntry`, `LogEntry`, `LogLevel` added as true global ambient types (moved inside `declare global`, alongside `BackendHealth`/`BackendState`, which were previously module-local).
- `frontend/src/App.tsx` — wrapped in `ProjectProvider`.
- `frontend/src/components/layout/AppShell.tsx` — wires `onOpenFile`, switches main content between `FileEditor` and `Dashboard`.
- `frontend/src/components/layout/StatusBar.tsx` — label updated to "Sprint 5 — File System".
- `frontend/src/components/explorer/ProjectExplorer.tsx`, `ExplorerTreeItem.tsx` — rewritten for real IPC-backed listing/CRUD/watching.
- `frontend/src/components/logger/LoggerPanel.tsx` — rewritten to poll `window.nemi.backend.logs()`.
- `frontend/src/components/dashboard/QuickActionsCard.tsx` — "New Project"/"Open Project" are now real, not disabled stubs.
- `frontend/src/components/common/IconButton.tsx` — added `disabled` styling.
- `frontend/package.json` / `package-lock.json` — added `chokidar`.
- `docs/ARCHITECTURE.md` — new FILESYSTEM OWNERSHIP section; updated IPC boundary and Data Layer sections; 3 new locked decisions appended to the summary.
- `docs/PROJECT_MEMORY.md` — Sprint 5 marked completed with full delivery detail.

**Deleted** (dead code once real data replaced them): `frontend/src/components/explorer/mockProjectTree.ts`, `frontend/src/components/logger/mockLogEntries.ts`.

---

# VERIFICATION

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `vite build` (renderer + main + preload) | Pass — chokidar bundles into `main.js` correctly (41.8 KB, no native-module issues) |
| `eslint .` | Pass, 0 warnings |
| `prettier --check src electron` | Pass |
| `pytest` | 14 passed |
| `ruff check` | All checks passed |
| `mypy --strict` | No issues, 23 source files |
| Standalone filesystem smoke test (`npx tsx`, no Electron) | listDirectory/createFile/renameEntry/deleteEntry/readFile/writeFile + watcher, all against a real temp directory — including the short-path crash reproduction and confirmed fix |
| Live end-to-end test | `npm run dev` → Electron spawned the real Python backend → `GET /logs` returned real rows → a `createFile()` call produced a real `fs.create` audit entry retrievable via `GET /logs` (full Electron→backend pipeline) → graceful window close cleanly terminated both processes, nothing orphaned |

---

# KNOWN ISSUES

- Native-dialog-driven flows (the folder-picker dialogs themselves) could not be scripted end-to-end in this environment — no OS dialog automation tool is available here. Verified instead by exercising the underlying `filesystem.ts`/`project-dialogs.ts` logic directly, which is exactly what the dialog handlers call once a path is chosen.
- `FileEditor` is intentionally a plain textarea — no syntax highlighting, no language server. A real code-editor experience (Monaco/CodeMirror) is future work, not attempted this sprint.
- Backend stdout/stderr are piped to Electron's console (`[backend] ...`) but not yet surfaced in the Logger Panel, which shows the SQLite `logs` table (structured entries), not raw process output.
- The `files` SQLite table remains unused — no repository, by design (see architecture decision above).
- Rename/delete UI updates rely partly on the chokidar watcher for full consistency (with a small optimistic local override for immediate feedback) — there can be a brief (sub-second) eventual-consistency window for changes made outside direct user action in the same session.

---

# NEXT SPRINT

**Sprint 6** — recommended: a `projects` table repository (now that projects are opened for real, track them server-side instead of only in localStorage), and/or surfacing backend process output in the Logger Panel.

---

# GIT COMMIT MESSAGE

```
feat(sprint-5): real filesystem Project Explorer, file CRUD, live watching

Lock filesystem ownership as Electron main (not Python): filesystem.ts
(pure Node + chokidar, no Electron import) owns list/read/write/create/
rename/delete and real-time watching; project-dialogs.ts isolates the
native folder-picker dialogs. Add File Create/Rename/Delete/Open/Save
end-to-end, with a minimal textarea-based FileEditor for Open/Save.

Add backend GET/POST /logs (pydantic-validated), wire the Logger Panel
to poll it, and audit-log every file operation through a new
backend-client.ts::postLog() — fire-and-forget, errors contained so a
backend outage never breaks a file operation. Make Dashboard's New/Open
Project buttons real via a new project/ Context+Provider+Hook module.

Find and fix a Windows-specific bug: a short-path (8.3) watch root
crashes chokidar's native watcher with an uncatchable libuv assertion;
fixed via fs.realpath() before watching. Also fix a watcher-ready race.
Update docs/ARCHITECTURE.md and docs/PROJECT_MEMORY.md.
```

---

END OF REPORT
