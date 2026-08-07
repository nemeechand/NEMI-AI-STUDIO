# SPRINT 6 FINAL RELEASE VERIFICATION REPORT

Project: NEMI AI STUDIO
Sprint: 6 — Stabilize Alpha Build (Final Verification)
Status: Verified — Fresh, From-Scratch Pass
Date: 07 August 2026

---

# PURPOSE

This report documents a completely fresh verification of the two Sprint 6
commits already on `origin/main` (`4ef946c`, `03733cb`), performed without
assuming any prior session state, per an explicit request to re-verify from
zero after a report of a persisting Electron runtime crash. No code changes
were made during this pass — every check below ran against the already-
pushed code and passed. This report exists to make that evidence
inspectable, not to claim a new fix.

---

# METHOD: STARTING FROM ZERO

Before any verification began:

1. Checked for and killed every running `electron.exe`, `python.exe`, and
   `node.exe` process — none were found running (clean start).
2. Deleted `frontend/dist`, `frontend/dist-electron`, and
   `frontend/node_modules/.vite` (build output and Vite's dependency
   pre-bundle cache) — forces a genuine rebuild, not stale output.
3. Deleted `database/nemi.db` and `logs/backend.log` — these are
   gitignored runtime artifacts regenerated on first backend startup; a
   real new developer would not have them either.
4. Re-verified `ELECTRON_RUN_AS_NODE` in a brand-new shell invocation
   (each Bash tool call starts a fresh shell with no carried-over state)
   — confirmed still present (`=1`), and confirmed via
   `[System.Environment]::GetEnvironmentVariable(name, scope)` that it is
   set at the **Process** scope only (inherited from the parent process
   tree — this Claude Code session runs as a child of VS Code's
   extension host, itself an Electron process running in "run as Node"
   mode), with **User** and **Machine** scopes empty. This is unchanged
   from the prior session's finding — expected, not a regression.

---

# REQUIREMENT-BY-REQUIREMENT RESULTS

## 1–2. Fresh environment, all processes closed

Confirmed via `tasklist` before and after every phase of this
verification. Zero `electron.exe`/`python.exe`/`node.exe` processes were
left running at the end of any phase.

## 3. `ELECTRON_RUN_AS_NODE` is not inherited *into the running app*

This variable **is** inherited into every shell in this environment (see
METHOD above) — that is a property of the host process tree, not
something the app can or needs to change. What matters is whether it
reaches the *spawned Electron process*, and it does not, because of the
Sprint 6 fix in `frontend/vite.config.ts`.

Proved directly with a negative/positive control bracket, not just by
observing an outcome:

| Control | Config | Result |
|---|---|---|
| Negative | `ELECTRON_RUN_AS_NODE=1` present, unmitigated | `Error: Process failed to launch!` — deterministic failure |
| Positive | Identical env, with `delete process.env.ELECTRON_RUN_AS_NODE` applied (the exact operation `vite.config.ts` performs) | Launched successfully, `window.nemi` present |

This isolates the fix to the precise line of code responsible, rather
than inferring correctness from a single successful run.

## 4–5. Launch via the normal development workflow; full functional verification

The literal `npm run dev` command was run, unmodified, from a fresh
shell with the ambient `ELECTRON_RUN_AS_NODE=1` left in place (not
manually unset):

- Vite dev server started and answered `GET http://localhost:5173/` with
  `200`.
- A 4-process Electron tree appeared (`tasklist` — main + gpu-process +
  utility + renderer, the normal Electron process model) and stayed up.
- The Python backend was spawned automatically and answered
  `GET http://127.0.0.1:8756/health` with
  `{"status":"ok","version":"0.1.0","env":"development","uptime_seconds":...}`.
- No error or crash text appeared in the dev server's output at any
  point.
- A **graceful** shutdown was tested deliberately (not a force-kill):
  `[System.Diagnostics.Process]::CloseMainWindow()` sent a real window
  close request to the main Electron process. All 4 Electron processes
  and the Python backend child terminated cleanly, with zero orphaned
  processes — confirming the Sprint 4 graceful-shutdown behavior still
  holds under this exact launch path.

For DOM/IPC-level depth beyond what `curl`/`tasklist` can observe, a
Playwright-driven launch of the built app (same `dist-electron/main.js`
+ `preload.mjs`, same renderer, same IPC surface — only the load source
differs: `VITE_DEV_SERVER_URL` vs `loadFile(dist/index.html)`, which is
irrelevant to any feature under test) was used, run twice from a fully
reset state for reproducibility:

| Check | Run 1 | Run 2 |
|---|---|---|
| Electron window opens | PASS | PASS |
| `window.nemi` (preload/IPC bridge) present | PASS | PASS |
| React UI rendered | PASS | PASS |
| Backend starts automatically, reaches `ready` | PASS | PASS |
| StatusBar shows Ready | see below | PASS (2.0s after backend-ready) |
| Logger receives `backend.startup` message | PASS | PASS |
| Logger receives `backend.stdout` messages | PASS | PASS |
| Logger Panel renders in DOM | PASS | PASS |
| Project Explorer renders | PASS | PASS |
| Open Folder button present | PASS | PASS |
| New Project button present | PASS | PASS |
| `openProject()` succeeds (Open Folder pipeline) | PASS | PASS |
| `createFile()` succeeds (New Project/File pipeline) | PASS | PASS |
| `listDirectory()` reflects the new file | PASS | PASS |
| Zero renderer console errors | PASS | PASS |
| Zero uncaught page errors | PASS | PASS |
| App closed cleanly | PASS | PASS |

**Run 1's StatusBar check failed on the first pass** (showed "Backend
Starting" instead of "Ready"), investigated per the stop-and-fix
requirement below, and is documented in full in the next section.

## 6. Open Folder / New Project

The buttons are present and wired to `openExisting()`/`createNew()` in
`useOpenProjectDialog.ts`, which call `window.nemi.fs.selectProjectFolder(mode)`
— this opens a **native Win32 folder-picker dialog**, which is not part
of the Chromium DOM and cannot be driven by Playwright (or any DOM-level
automation). This is not a new limitation — it was already documented
in `docs/SPRINT_5_REPORT.md`'s Known Issues when this exact flow was
first built.

What *was* verified end-to-end, directly, against a real filesystem
path (bypassing only the native picker itself — exactly what happens
immediately after a user selects a folder): `openProject(realPath)`
succeeded, `createFile(dir, name)` succeeded, and `listDirectory(dir)`
correctly reflected the created file. The temp directory Node's
`os.tmpdir()` produced for this test happened to resolve through a
Windows short-path alias (`C:\Users\HAREKR~1\...`) — the exact class of
path that crashed chokidar's native watcher in Sprint 5 before the
`fs.realpath()` fix — so this test incidentally re-confirmed that fix
still holds.

## 7. Full verification suite

| Check | Result |
|---|---|
| `tsc -b` | Pass (exit 0) |
| `eslint .` | Pass (exit 0), 0 warnings |
| `prettier --check` | Pass (exit 0) |
| `npm run build` (renderer + main + preload) | Pass (exit 0) |
| `pytest` | 14 passed |
| `ruff check` | All checks passed |
| `mypy` | No issues, 23 source files |
| Playwright (deep functional suite) | 17/17 on final confirming run |

## 8. Stop-fix-rerun discipline

The first deep-verification run's StatusBar check failed (see above).
Per the requirement to stop and investigate rather than dismiss:

- Read `StatusBar.tsx`'s polling logic: it polls
  `window.nemi.backend.health()` on mount immediately, then every
  `POLL_INTERVAL_MS = 5000`. The direct-IPC check in the test confirmed
  the backend was `ready` at T+0, but the test only waited 1.5s before
  reading the DOM — less than one poll interval, so a stale "Starting"
  label was expected, not a bug.
- Rewrote the check to poll the DOM for up to 8 seconds (comfortably
  covering one 5s interval plus margin) instead of asserting after a
  fixed short delay.
- Reran the **entire** verification suite from a fully reset state (all
  processes killed, database/logs deleted again) twice more. Both runs
  passed 17/17, with the StatusBar reliably reaching "Ready" ~2 seconds
  after the backend itself became ready — consistent, reproducible,
  well inside the documented 5-second polling design.

This was a test-script timing bug, not an application defect — no
application code was changed as a result. It is recorded here in full
because the instruction was to investigate every discrepancy before
dismissing it, not to only record confirmed application bugs.

---

# ZERO-DEFECT CONFIRMATION

- **Zero runtime crashes**: confirmed across the real `npm run dev`
  launch, both full Playwright deep-verification runs, and the
  negative/positive control bracket (the negative control's failure is
  the *expected*, deliberately-induced case, not an app defect).
- **Zero console errors**: captured via Playwright's `console`/`pageerror`
  listeners across both runs — empty both times.
- **Zero backend failures**: `/health` and `/logs` answered correctly on
  every launch; pytest/ruff/mypy all clean.
- **Zero IPC failures**: every `window.nemi.*` call exercised
  (`backend.health`, `backend.logs`, `fs.openProject`, `fs.createFile`,
  `fs.listDirectory`) returned successfully with correct data.
- **Zero orphaned processes**: confirmed via `tasklist` after every
  launch/shutdown cycle in this report.

---

# FILES CHANGED THIS PASS

None. This was a verification-only pass against the code already in
commits `4ef946c` and `03733cb`. Only documentation was added:

- `docs/PROJECT_MEMORY.md` — Final Release Verification entry appended
  to the Sprint 6 record.
- `docs/SPRINT_6_FINAL_REPORT.md` (this file).

---

# KNOWN ISSUES (UNCHANGED)

- Still requires Python 3.11+ pre-installed on the target machine — no
  standalone Python runtime is bundled (top Beta priority, unchanged
  since the Alpha build).
- Installer remains unsigned (unchanged since the Alpha build).
- Native OS dialog flows (Open Folder / New Project's folder picker)
  cannot be driven by automated DOM tooling — documented since Sprint 5,
  reconfirmed here, not a defect.
- `FileEditor` remains a plain textarea; AI Chat Panel does not exist
  yet — both unchanged from Sprint 6's main report, architecture already
  reserved for Sprint 7+.

---

# RELEASE DECISION

**Sprint 6 is APPROVED for Sprint 7.**

Every requirement in this verification request was executed and passed
from a genuinely fresh, from-scratch state — not assumed from prior
session memory. The `ELECTRON_RUN_AS_NODE` dev-launch bug is fixed and
its fix mechanism directly proven (not just its outcome). The one
discrepancy found (StatusBar timing) was investigated to a confirmed
root cause (test methodology, not application code) and did not require
a fix, and the full suite was rerun twice more after that investigation
per the stop-and-rerun requirement. Zero crashes, zero console errors,
zero backend failures, zero IPC failures, zero orphaned processes.

---

# GIT COMMIT MESSAGE

```
docs(sprint-6): record fresh from-scratch final release verification

No code changes — this documents a complete, from-zero re-verification
of the two already-pushed Sprint 6 commits (4ef946c, 03733cb),
performed without assuming prior session state per an explicit request
to re-verify after a reported persisting crash.

Killed all processes, deleted dist/dist-electron/vite-cache/database/
logs, rebuilt from scratch. Directly proved the ELECTRON_RUN_AS_NODE
fix mechanism (not just its outcome) via a negative/positive control
bracket. Ran the real npm run dev command with the variable left
inherited: launched cleanly, backend spawned, graceful shutdown left
zero orphaned processes. Ran a 17-point Playwright deep-verification
suite twice from a reset state (17/17 both times) plus the full tsc/
eslint/prettier/build/pytest/ruff/mypy suite (all pass).

One discrepancy (StatusBar showing a stale "Backend Starting" label on
a single early check) was investigated per the stop-and-fix
requirement and confirmed to be a test-timing artifact against
StatusBar.tsx's documented 5s poll interval, not an application defect
- no code change was needed, and the full suite was rerun twice more
to confirm reproducibility.

Add docs/SPRINT_6_FINAL_REPORT.md; update docs/PROJECT_MEMORY.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
