# KNOWN ISSUES

Version: 1.0 (Sprint 15.6)
Purpose: one honest, consolidated list of every known limitation in NEMI AI
STUDIO as of this sprint — pulled from `docs/PROJECT_MEMORY.md`'s PENDING
TASKS (accumulated since Sprint 1) plus the findings from Sprint 15.6's own
stability audit that were deliberately deferred rather than fixed. Nothing
here is fabricated or guessed; every item was either directly observed in
code/testing or is a stated, deliberate scoping decision from a prior
sprint's own report.

---

## Top blocker

- **Code-signing certificate for the Windows installer.** The NSIS
  installer/portable build is currently unsigned. Windows SmartScreen will
  warn on install. This has been the top Beta blocker since Sprint 8 and
  remains unaffected by Sprint 15.6.

## Platform support

- **Windows-only.** Resource/disk usage reporting (`system-metrics.ts`,
  `getBackendResourceUsage()`), the PyInstaller packaging pipeline, and
  electron-builder's `build.win` config are all Windows-specific — this
  matches the project's only currently packaged target, not an oversight.
- **No `requestSingleInstanceLock()` equivalent testing on macOS/Linux** —
  the fix shipped in Sprint 15.6 uses Electron's cross-platform API, but
  has only been live-verified on Windows.

## Backend reliability (Sprint 15.6 fixed the major ones; these remain)

- **Version consistency is manually maintained, not enforced.** Sprint 15.6
  fixed the drift between `frontend/package.json`, `backend/app/__init__.py`,
  the About tab, and `PROJECT_MEMORY.md`, and made the About tab/StatusBar
  read the real running version via IPC instead of a hardcoded string — but
  nothing *prevents* `backend/app/__init__.py`'s `__version__` from drifting
  from `package.json` again on a future release if a future release forgets
  to update both. A build-time check (e.g. a script that fails CI if they
  disagree) would close this gap; not built yet.
- **`asyncio.create_task()` for `/shutdown`'s delayed SIGINT is not the only
  fire-and-forget background task pattern in the codebase** — this specific
  one is guarded against garbage collection (Sprint 15.6), but a systematic
  audit of every `asyncio.create_task()`/`void someAsyncCall()` call site
  for the same class of bug has not been done project-wide.
- **The internet-connectivity check in `GET /health/full` makes a real
  outbound HTTPS request to a third-party host** (`https://www.google.com/generate_204`)
  on every poll. This is the same category of tradeoff as any connectivity
  check; an operator running fully air-gapped will always see this as
  "unreachable" (correctly — this is not a bug, just worth knowing).
- **Ollama's model pull (`POST /providers/ollama/pull`) is synchronous, not
  progress-streamed** — the caller waits for the entire download with no
  incremental UI feedback beyond a spinner (Sprint 15.5's own documented
  limitation, unchanged).
- **DeepSeek/Grok are absent from the cost-estimate pricing table** — no
  confidently-sourced current published rates at implementation time
  (Sprint 15.5's own documented limitation, unchanged); reports cost as
  `null`, never a guessed number.

## Frontend / UX

- **No guided first-run onboarding** beyond the static Welcome header and
  Quick Actions card — not a bug (every zero-project state degrades
  gracefully, confirmed during Sprint 15.6's audit), but a real gap for a
  product whose pitch is "describe what you want to build."
- **Minor duplicate ETA-calculation logic**: `SprintCenterSection.tsx` and
  `SprintProgressCenter.tsx` each independently compute an estimated
  time-to-completion from task durations, with slightly different
  signatures (one returns raw seconds, the other a pre-formatted string).
  Found during Sprint 15.6's audit; deliberately left alone this sprint —
  low real-world impact, and unifying it risked destabilizing two already-
  correct, already-tested panels under this sprint's time budget.
- **`QuickOpen.tsx`/`ChatInput.tsx`'s fuzzy-filter is recomputed on every
  render with no `useMemo`** (found during Sprint 15.6's audit) — not
  currently causing visible lag at this project's typical file-count scale,
  but would degrade on a very large project's file list.
- **Resizable/drag panel splitters** are not implemented — sidebar and
  logger panel are show/hide toggles only (documented since early sprints).

## Autonomous Coding Engine

- **Rollback is per-task, not a whole-workflow atomic transaction**
  (Sprint 15's own documented scoping decision, unchanged).
- **The Developer agent cannot propose file deletions** — the Feature
  Approval summary's `files_removed` is always empty, stated honestly
  rather than omitted (Sprint 11's original scoping, unchanged).
- **No in-app git commit/push action** — the Live Workflow View's
  `Commit`/`Push` nodes remain marked not-yet-automated (unchanged since
  Sprint 13; `Documentation` became genuinely automated in Sprint 15).
- **Milestone/pipeline dependency chains are linear**, not a true
  multi-parent dependency graph (deliberately out of scope since Sprint 11).

## Knowledge Graph

- **Code parsing is heuristic/regex-based, not a full AST parser**, Python/
  JS/TS only (Sprint 14's own documented scoping decision, unchanged).
- **Embedding generation is a single bounded synchronous request**, not yet
  a cancellable background job — a very large project's full embedding
  pass can still take several minutes even with the existing 150-file
  candidate cap (Sprint 14's own documented limitation, unchanged).

## Testing / verification honesty boundaries

- **Small local Ollama test models (e.g. `qwen2.5:0.5b`) unreliably follow
  structured multi-step output** (milestone format, `​```file:path``` `
  blocks) — a documented, accepted model-capability limitation since
  Sprint 11, not a defect in this app. Live tests treat either real success
  or the documented graceful-skip path as valid proof.
- **This sprint's own live verification is Windows-only and single-machine**
  — no multi-machine, multi-user, or long-duration (multi-day) soak test
  has been performed. Automatic backend crash recovery was verified via a
  manual "Restart Backend" button click, not by inducing a real crash.

## Process / release maturity

- **No git tagging convention adopted yet** — releases are tracked via
  commit messages and `docs/SPRINT_N_REPORT.md` files, not `git tag`. See
  `RELEASE_CHECKLIST.md`.
- **No automated CI pipeline** runs the offline verification suite on push
  — every check in `RELEASE_CHECKLIST.md` is currently run manually.
