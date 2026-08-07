# SPRINT 6 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 6 — Stabilize Alpha Build
Status: Completed
Date: 07 August 2026

---

# COMPLETED TASKS

1. Fixed a genuine Alpha-breaking bug: `frontend/electron/main.ts` pointed the preload script at `preload.js`, but `vite-plugin-electron` (given this package's `"type": "module"`) only ever emits `dist-electron/preload.mjs` — confirmed via a clean rebuild. The mismatch meant Electron silently failed to load the preload script, `contextBridge` never ran, and `window.nemi` was `undefined` on every launch, breaking the StatusBar, Project Explorer, Logger Panel, and Dashboard's Open/New Project buttons.
2. Removed leftover debugging artifacts from a prior session: `frontend/_cdp_check.mjs`, `frontend/_cdp_check2.mjs`, and a stray `hello.py` at the repo root.
3. Extended backend status monitoring: `BackendHealth` now carries `version`/`uptimeSeconds` from the `/health` response (previously discarded once the backend was confirmed ready); StatusBar shows this as a title/tooltip.
4. Surfaced backend `stdout`/`stderr` in the Logger Panel (previously console-only, a known pending item) by reusing the existing `postLog()` pipeline; added a level filter dropdown to the Logger Panel.
5. Fixed a real performance issue in the Project Explorer: every raw chokidar filesystem event triggered an immediate renderer refetch of every expanded folder — a bulk operation (e.g. `npm install`, a git checkout) could fire hundreds of redundant IPC round-trips in a burst. Debounced watcher notifications (300ms trailing) to coalesce these into one. Added a loading indicator for folder expansion.
6. Reserved (documentation only, per `agents/architect.md`) the architecture for a future AI Chat Panel and Code Editor in `docs/ARCHITECTURE.md` — no code written.
7. Fixed a real dev-workflow bug: `npm run dev` crashes on launch whenever run from a process descended from VS Code's extension host (as this project is, via Claude Code), because that host runs Electron in `ELECTRON_RUN_AS_NODE=1` mode and the setting is inherited by the Electron child process `vite-plugin-electron` spawns. Fixed in `frontend/vite.config.ts` by clearing the variable before the dev server spawns Electron. See the dedicated section below for the full investigation.
8. Ran the full verification suite and both a live Playwright-driven launch of the built app and a live `npm run dev` launch (with the problematic environment variable deliberately still present) to confirm both the preload fix and the `ELECTRON_RUN_AS_NODE` fix end-to-end.
9. Updated `docs/PROJECT_MEMORY.md` and generated this report.

---

# A ROOT-CAUSE INVESTIGATION, A MISDIAGNOSIS, AND THE ACTUAL FIX

While root-causing the preload bug, a minimal reproduction (`import { app } from 'electron'` in a 2-line ESM file) crashed with a Node.js internal ESM-loader error, and crashed identically against the last committed code — appearing to be a second, deeper, pre-existing bug independent of the preload path mismatch. A CJS-build-output fix was designed, implemented, and verified working end-to-end.

That fix was then reverted after re-running the same reproduction with `ELECTRON_RUN_AS_NODE` manually cleared from the shell, which succeeded — at that point the crash was (incorrectly) written off as pure test-environment noise with no real-world impact, and Sprint 6 was reported complete and pushed on that basis.

That conclusion was wrong in its scope, and was corrected after further investigation prompted by re-testing: `ELECTRON_RUN_AS_NODE=1` is not a random leftover — it is set at the **Process** environment scope (confirmed via `[System.Environment]::GetEnvironmentVariable(..., "Process")`; both `"User"` and `"Machine"` scopes are empty) and is inherited from the VS Code **extension host** process this Claude Code session runs under (`VSCODE_ESM_ENTRYPOINT=vs/workbench/api/node/extensionHostProcess` in the environment) — VS Code's extension host is itself an Electron process running in "run as Node" mode, and that setting propagates to every child process spawned from it, including `npm run dev`. This is a real, structural characteristic of developing this app via Claude Code inside VS Code (and plausibly other Electron-hosted dev tools), not a one-off fluke — every `npm run dev` launched this way would silently fail with `ipcMain`/`app`/`BrowserWindow` all undefined, because `require('electron')` resolves to a path-string shim instead of the real API whenever `ELECTRON_RUN_AS_NODE` is set.

**The actual fix**: `frontend/vite.config.ts` now deletes `ELECTRON_RUN_AS_NODE` from `process.env` before `vite-plugin-electron` spawns the Electron dev process (`child_process.spawn(electronPath, argv, { stdio: 'inherit', ...options })` inherits `process.env` by reference, so clearing the key at config-load time is visible at spawn time). Verified by running `npm run dev` with the ambient variable still set (unmodified, exactly as inherited) — Electron launched successfully (4 process tree, window created) and the Python backend started and logged "NEMI backend ready" through the pipeline this same sprint added to the Logger Panel. A direct `electron.exe .` invocation from a shell still carrying the inherited variable (bypassing `npm run dev`/vite entirely) still fails as expected — that path is outside this fix's scope, but it's also not how any real launch happens: a packaged app double-clicked by an end user is not a descendant of the VS Code extension host process tree, so it never inherits this variable in the first place (confirmed via the Process/User/Machine scope check above).

Recorded in full because the earlier, published finding ("not a real defect, no code change needed") was itself an overcorrection — see `agents/debugger.md`'s "never guess... always reproduce" and "fix root cause... never patch symptoms": the reproduction was real both times, but the conclusion from clearing the variable manually — that it therefore didn't matter — was not re-examined against how `npm run dev` is actually invoked in this environment until asked to look again.

---

# GENERATED FILES

- `docs/SPRINT_6_REPORT.md` (this file).

No new application source files were created this sprint — every change modified existing modules (see below).

---

# MODIFIED FILES

**Electron main process**
- `frontend/electron/main.ts` — preload path corrected from `preload.js` to `preload.mjs` (the file that actually exists in the build output).
- `frontend/electron/backend-process.ts` — `BackendHealth` extended with `version`/`uptimeSeconds`, captured from `/health` at startup and refreshed in the background on each `getBackendHealth()` call while ready; `startBackend()`'s stdout/stderr handlers now also forward each line to `postLog()` (`backend.stdout` at DEBUG, `backend.stderr` at WARNING).
- `frontend/electron/backend-client.ts` — added the `HealthResponse` interface (`version`, `env`, `uptime_seconds`) matching the backend's `/health` response shape.
- `frontend/electron/filesystem.ts` — watcher change notifications debounced (300ms trailing) instead of firing one notification per raw chokidar event.
- `frontend/vite.config.ts` — deletes `ELECTRON_RUN_AS_NODE` from `process.env` before `vite-plugin-electron` spawns the Electron dev process, so `npm run dev` works regardless of whether the parent process (e.g. VS Code's extension host) has that variable set.

**Renderer**
- `frontend/src/types/electron-api.d.ts` — `BackendHealth` ambient type extended with `version?`/`uptimeSeconds?`.
- `frontend/src/components/layout/StatusBar.tsx` — shows a title/tooltip with version + formatted uptime once the backend is ready; label updated to "Sprint 6 — Stabilization".
- `frontend/src/components/logger/LoggerPanel.tsx` — added a client-side level filter dropdown (ALL/INFO/WARNING/ERROR/DEBUG).
- `frontend/src/components/explorer/ExplorerTreeItem.tsx` — added a "Loading…" indicator while a folder's children are being fetched for the first time.

**Docs**
- `docs/ARCHITECTURE.md` — new "AI CHAT PANEL & CODE EDITOR (reserved — Sprint 6, not implemented)" section; a new locked-decisions entry (#12) referencing it; version bumped to 1.3.
- `docs/PROJECT_MEMORY.md` — Sprint 6 marked completed with full delivery detail.

**Removed**
- `frontend/_cdp_check.mjs`, `frontend/_cdp_check2.mjs` — throwaway CDP debugging scripts from a prior session.
- `hello.py` (repo root) — stray scratch file, unrelated to `backend/app`.

---

# VERIFICATION

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass |
| `vite build` (renderer + main + preload) | Pass — `dist-electron/main.js` + `dist-electron/preload.mjs` produced as expected |
| `pytest` | 14 passed |
| `ruff check` | All checks passed |
| `mypy --strict` | No issues, 23 source files |
| Live launch (Playwright-driven, built app) | `window.nemi` confirmed present; `window.nemi.backend.health()` reached `ready` with real `version`/`uptimeSeconds`; StatusBar tooltip rendered `NEMI Backend v0.1.0 — up 0s`; Logger Panel's level filter (`ALL/INFO/WARNING/ERROR/DEBUG`) present and functional; a real `backend.stdout` log entry (from the backend's own startup output) was visible and correctly filtered under the DEBUG level; Project Explorer and Dashboard rendered correctly; app closed cleanly with no orphaned processes |
| Live `npm run dev` launch, `ELECTRON_RUN_AS_NODE=1` deliberately left set | Electron launched successfully (4-process tree observed via `tasklist`), Python backend spawned and logged "NEMI backend ready on 127.0.0.1:8756" through the same-sprint stdout-forwarding pipeline — this is the exact failure this fix targets, reproduced and confirmed resolved |

---

# KNOWN ISSUES

- Still requires Python 3.11+ pre-installed on the target machine — no standalone Python runtime is bundled (unchanged from the Alpha build, tracked as the top Beta priority).
- Installer remains unsigned (unchanged from the Alpha build).
- `FileEditor` remains a plain textarea (unchanged; Monaco/CodeMirror upgrade path is now documented in `docs/ARCHITECTURE.md` but not implemented).
- AI Chat Panel does not exist yet — only its architecture location and pattern are reserved.
- The `projects` SQLite table still has no repository — recently-opened projects are tracked only in `localStorage` (unchanged from Sprint 5).

---

# NEXT SPRINT

**Sprint 7** — recommended: implement the `projects` table repository (natural next step now that projects are opened for real), and/or begin the AI Chat Panel or Code Editor against the architecture reserved this sprint.

---

# GIT COMMIT MESSAGES

This sprint shipped as two commits: an initial commit (pushed, then
found to be incomplete — the dev-launch crash reported afterward was
real) and a follow-up fix committed once the actual cause was found
and verified. Recorded as history, not amended, per this project's
git policy of never rewriting already-pushed commits.

**Commit 1** (`4ef946c`):

```
fix(sprint-6): fix black-screen preload bug, stabilize Alpha build

Fix a real, Alpha-breaking bug: main.ts pointed the preload script at
preload.js, but vite-plugin-electron only ever emits preload.mjs given
this package's "type": "module" — confirmed via a clean rebuild. The
mismatch meant Electron silently failed to load the preload script,
window.nemi was undefined on every launch, and every IPC-backed
feature (StatusBar, Project Explorer, Logger Panel, Dashboard's
Open/New Project) was broken. Verified the fix via a Playwright-driven
launch of the actual built app.

Extend BackendHealth with version/uptime (previously discarded once
ready) and show it in a StatusBar tooltip. Surface backend
stdout/stderr in the Logger Panel via the existing postLog() pipeline,
and add a level filter dropdown. Debounce the filesystem watcher's
change notifications (300ms) to fix a redundant-refetch storm during
bulk filesystem operations; add a loading indicator to the Explorer.

Reserve (docs only) the architecture for a future AI Chat Panel and
Code Editor in docs/ARCHITECTURE.md. Remove leftover debugging
artifacts (_cdp_check*.mjs, stray hello.py) from a prior session.

Update docs/PROJECT_MEMORY.md and add docs/SPRINT_6_REPORT.md.
```

**Commit 2** (follow-up):

```
fix(sprint-6): fix npm run dev crash under ELECTRON_RUN_AS_NODE

The first Sprint 6 commit was pushed after concluding a second
Electron crash found during verification was test-environment noise,
not a real defect. That conclusion was wrong: ELECTRON_RUN_AS_NODE=1
is inherited from VS Code's extension host (this project is developed
via Claude Code inside VS Code) and is set at the Process environment
scope, not User/Machine — meaning it silently breaks every `npm run
dev` launched this way, since vite-plugin-electron's spawn() inherits
process.env by default and Electron then runs as plain Node instead
of the real app (require('electron') returns a path string, so app/
ipcMain/BrowserWindow are all undefined).

Fix: frontend/vite.config.ts now deletes ELECTRON_RUN_AS_NODE from
process.env before vite-plugin-electron spawns Electron. Verified by
running npm run dev with the variable deliberately left set: Electron
launched successfully and the Python backend started and logged
through the Logger Panel pipeline. A packaged app double-clicked by a
real user is unaffected regardless (it's never a descendant of the
VS Code extension host process tree), so this only had to be fixed at
the dev-server spawn point.

Update docs/SPRINT_6_REPORT.md and docs/PROJECT_MEMORY.md with the
corrected investigation record.
```

---

END OF REPORT
