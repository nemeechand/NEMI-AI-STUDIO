# SPRINT 7 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 7 — Workspace & Project Management System
Status: Completed
Date: 07 August 2026

---

# COMPLETED TASKS

1. Implemented the `projects` table repository (schema-ready since Sprint 3/4, never used until now): `ProjectsRepository.record_opened()` (upsert by `path`), `list_recent()`, `delete()`, backing `GET /projects/recent`, `POST /projects/opened`, `DELETE /projects/{id}`.
2. Added `projects.last_opened_at` via an idempotent `ALTER TABLE ADD COLUMN` migration in `init_db()` — kept distinct from `updated_at` so editing metadata without opening a project never changes its recency ordering.
3. Built the New Project Wizard (`NewProjectWizard.tsx`, in-app modal) replacing Sprint 5's native-save-dialog creation flow — Name, Location (native directory picker), optional Description.
4. Built the Workspace Manager panel (`WorkspaceManager.tsx`) — a second Sidebar-toggled view listing recent projects, switching the active one on click, removing entries from the recent list (never touching disk).
5. Added a Recent Projects card to the Dashboard (`RecentProjectsCard.tsx`).
6. Implemented workspace auto-save + restore-previous-session via a new `frontend/src/workspace/` Context+Provider+Hook module — persists the active project's open file to `localStorage` under a per-project-scoped key, so switching projects restores each one's own last-open file.
7. Confirmed the multi-project scope decision with the founder before implementation: one active project with a fast switcher, not simultaneous multi-project editing — matches the existing single-watcher `filesystem.ts` architecture.
8. Updated documentation continuously as each piece landed (`docs/DATABASE_SCHEMA.md`, `docs/ARCHITECTURE.md`), not only at the end.
9. Ran the full verification suite after every major piece and a comprehensive live regression + new-feature suite before commit.

---

# GENERATED FILES

**Backend**
- `backend/app/db/repositories/projects_repository.py` — `ProjectsRepository`.
- `backend/app/api/projects.py` — `GET /projects/recent`, `POST /projects/opened`, `DELETE /projects/{id}`.
- `backend/tests/test_projects_api.py` — API-level tests (upsert, ordering/limit, delete, 404, validation).

**Electron**
- `frontend/src/project/pathUtils.ts` — shared `basename()` helper (previously duplicated inline in `ProjectExplorer.tsx`).

**Renderer**
- `frontend/src/workspace/workspace-context.ts`, `WorkspaceProvider.tsx`, `useWorkspace.ts` — new Context+Provider+Hook module.
- `frontend/src/components/workspace/NewProjectWizard.tsx`, `WorkspaceManager.tsx`, `formatRelativeTime.ts`.
- `frontend/src/components/dashboard/RecentProjectsCard.tsx`.

**Docs**
- `docs/SPRINT_7_REPORT.md` (this file).

---

# MODIFIED FILES

**Backend**
- `backend/app/db/schema.py` — `projects.last_opened_at` column; `_add_column_if_missing()` idempotent migration helper.
- `backend/app/api/schemas.py` — `ProjectOpenedCreate`, `ProjectOut`.
- `backend/app/server.py` — registered the projects router.
- `backend/tests/test_db.py` — repository-level tests for `ProjectsRepository` and the migration path (simulates a pre-Sprint-7 database).

**Electron**
- `frontend/electron/backend-client.ts` — `ProjectRecord`, `fetchRecentProjects()`, `recordProjectOpened()`, `removeRecentProject()`.
- `frontend/electron/filesystem.ts` — `createDirectory()`.
- `frontend/electron/project-dialogs.ts` — `selectProjectFolder()` simplified (the `'new'` mode removed, superseded by the Wizard); `selectDirectory()` added.
- `frontend/electron/main.ts` — new IPC handlers for `projects:*` and `fs:select-directory`/`fs:create-directory`; simplified `fs:select-project-folder` handler.
- `frontend/electron/preload.ts` — exposes the new `projects` namespace and `fs.selectDirectory`/`fs.createDirectory`.

**Renderer**
- `frontend/src/types/electron-api.d.ts` — `ProjectRecord` ambient type; `projects` namespace; updated `fs` signatures.
- `frontend/src/project/project-context.ts`, `ProjectProvider.tsx` — `openProject()` now accepts an optional `description`; internal `openAndRecord()` unifies restore/open/record into one path.
- `frontend/src/project/useOpenProjectDialog.ts` — `createNew()` removed (superseded by the Wizard); `openExisting()` simplified.
- `frontend/src/App.tsx` — nests `WorkspaceProvider` inside `ProjectProvider`.
- `frontend/src/components/layout/AppShell.tsx` — open-file state now lives in `useWorkspace()`; content is always re-read fresh via `readFile()` on `openFilePath` change; wires the New Project Wizard and Sidebar panel switching.
- `frontend/src/components/layout/Sidebar.tsx` — second icon (Workspace Manager) added, extending the existing icon-bar/`active` pattern; exports `SidebarPanel`.
- `frontend/src/components/explorer/ProjectExplorer.tsx` — uses the shared `basename()` util; "New Project" now opens the Wizard.
- `frontend/src/components/dashboard/QuickActionsCard.tsx`, `Dashboard.tsx` — "New Project" wired to the Wizard; `RecentProjectsCard` added to the grid.

**Docs**
- `docs/DATABASE_SCHEMA.md` — `projects.last_opened_at`; implementation status; migration approach documented.
- `docs/ARCHITECTURE.md` — new "WORKSPACE & PROJECT MANAGEMENT" section; IPC namespace list updated; 3 new locked-decision entries.
- `docs/PROJECT_MEMORY.md` — Sprint 7 marked completed with full delivery detail.

---

# VERIFICATION

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass |
| `npm run build` (renderer + main + preload) | Pass |
| `pytest` | 24 passed (10 new: 4 in `test_db.py`, 6 in `test_projects_api.py`) |
| `ruff check` | All checks passed |
| `mypy --strict` | No issues, 26 source files |

**Live verification** (Playwright-driven, packaged-style build, fresh Electron profile per run — no cross-run `localStorage` contamination): a 25-point suite combining full Sprint 1–6 regression with every Sprint 7 feature, run twice from a fully reset state (processes killed, `dist`/`dist-electron`/database/logs cleared):

- Regression (10 checks): window opens/no black screen, `window.nemi` present (incl. new `projects` namespace), backend auto-starts, StatusBar Ready, Logger receives backend messages, backend health 200, Dashboard renders (incl. new Recent Projects card), zero console/page errors, clean shutdown.
- New features (15 checks): Wizard opens from Dashboard and accepts real typed input; the Wizard's own create pipeline (`createDirectory` → `openProject` → `recordOpened`) creates a real folder on disk and records it; the new project appears in Recent Projects; a second project can be opened and recorded; the Workspace Manager panel opens via the new Sidebar icon and lists both; clicking a row switches the active project; removing an entry drops it from Recent Projects without touching disk; Create/Open/Save/Rename/Delete file all work under the restructured `AppShell`; and — the sprint's core deliverable — reloading mid-session (simulating a relaunch) restores both the same active project **and** the same open file.

Both runs passed 25/25 identically.

**Methodology note**: clicking "New Project" → "Browse" opens a native Win32 folder-picker dialog. This cannot be driven by Playwright (outside the Chromium DOM), and — confirmed during this sprint's verification — Electron's `contextBridge`-exposed `window.nemi` cannot be monkey-patched from the page context either (a security property, not a bug: reassigning `selectDirectory` silently has no effect). The Wizard's Name/Description fields were tested with genuine typed input and a real Cancel click; its actual creation pipeline (`createDirectory` → `openProject` → `recordOpened`, exactly what `handleCreate()` calls after a location is chosen) was verified directly. Same documented boundary as Open Folder since Sprint 5 — not a new limitation.

---

# KNOWN ISSUES

- Still requires Python 3.11+ pre-installed on the target machine; installer remains unsigned (unchanged since the Alpha build).
- AI Chat Panel and Code Editor remain architecture-only (Sprint 6 reservation) — not built this sprint.
- True concurrent multi-project support (multiple projects open simultaneously) is deliberately not implemented — confirmed out of scope with the founder before starting; would require reworking `filesystem.ts`'s single watcher into a per-project map.
- Project metadata (name/description) is stored and displayed but not independently editable after creation — no "rename project" UI this sprint.
- The native folder-picker dialog itself remains outside what automated DOM tooling can drive (documented since Sprint 5, reconfirmed here for the Wizard's Browse button).

---

# NEXT SPRINT

**Sprint 8** — recommended: standalone Python runtime bundling for a Beta build (top packaging priority, unchanged since the Alpha build), and/or begin the AI Chat Panel or Code Editor against the architecture reserved in Sprint 6.

---

# GIT COMMIT MESSAGE

```
feat(sprint-7): workspace & project management system

Implement the projects table repository (schema-ready since Sprint
3/4, never used): ProjectsRepository.record_opened()/list_recent()/
delete() backing GET/POST /projects/opened|recent and DELETE
/projects/{id}. Add projects.last_opened_at via an idempotent
ALTER TABLE migration in init_db(), kept distinct from updated_at so
editing metadata without opening a project never changes its recency.

Add a New Project Wizard (in-app modal: name/location/description)
replacing the old native-save-dialog creation flow, and a Workspace
Manager panel (second Sidebar view: list/switch/remove recent
projects) plus a matching Recent Projects card on the Dashboard.

Add a new workspace/ Context+Provider+Hook module that auto-saves the
active project's open file to localStorage under a per-project-scoped
key and restores it on relaunch - verified end-to-end by reloading
mid-session and confirming both the same project and the same open
file reopen. ProjectProvider now funnels every way a project becomes
active through one openAndRecord() helper so recent-project tracking
never duplicates across call sites.

Confirmed multi-project scope with the founder before implementation:
one active project with a fast switcher, not simultaneous editing -
matches the existing single-watcher filesystem.ts architecture; true
concurrent multi-project is deliberately deferred.

Update docs/DATABASE_SCHEMA.md and docs/ARCHITECTURE.md continuously
throughout the sprint (new WORKSPACE & PROJECT MANAGEMENT section, 3
new locked decisions). Verified via pytest (24, 10 new), ruff, mypy,
tsc/eslint/prettier/build, and a 25-point live Playwright suite
(Sprint 1-6 regression + every new feature) reproduced clean on two
consecutive fully-reset runs.

Update docs/PROJECT_MEMORY.md and add docs/SPRINT_7_REPORT.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
