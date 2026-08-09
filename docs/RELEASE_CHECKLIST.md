# RELEASE CHECKLIST

Version: 1.0 (Sprint 15.6)
Purpose: the concrete, repeatable steps to cut a NEMI AI STUDIO release — a
procedural companion to `PRODUCTION_CHECKLIST.md` (which tracks *readiness*)
and `VERSION_READINESS_REPORT.md` (which is the go/no-go snapshot for a
specific version).

---

## Pre-flight (before touching version numbers)

- [ ] `git status` is clean — no uncommitted changes, no untracked files that
      belong in the release.
- [ ] `main` is up to date with `origin/main`.
- [ ] Every sprint intended for this release has its own `docs/SPRINT_N_REPORT.md`
      and a corresponding entry in `docs/PROJECT_MEMORY.md`'s CHANGE HISTORY.

## Offline verification suite (must all pass, zero exceptions)

- [ ] `cd frontend && npx tsc -b` — 0 errors.
- [ ] `cd frontend && npx eslint .` — 0 warnings.
- [ ] `cd frontend && npx prettier --check .` — clean except the one
      documented pre-existing `tsconfig.json` warning (not introduced by
      this project's own code, never touched).
- [ ] `cd frontend && npm run build` — succeeds, no new chunk-size
      regressions beyond the already-documented Monaco bundle warning.
- [ ] `cd backend && python -m pytest -q` — all tests pass, 0 skipped.
- [ ] `cd backend && python -m ruff check app tests` — all checks passed.
- [ ] `cd backend && python -m mypy app` — 0 issues, strict mode.

## Live verification (Playwright-driven `_electron` launch against the built app)

- [ ] App launches, backend reaches `state: 'ready'` within
      `STARTUP_TIMEOUT_MS` (15s) under normal conditions.
- [ ] Health Center (Live Dashboard → Health Center) shows all real checks;
      Overall Health is "Healthy" on a clean machine with Ollama running.
- [ ] Restart Backend (Health Center) successfully returns the backend to
      `state: 'ready'`.
- [ ] Graceful shutdown: closing the app produces a `NEMI backend shutting
      down` log line (confirms the FastAPI lifespan's shutdown code ran,
      not a forced kill).
- [ ] Single-instance lock: launching a second instance while the first is
      open does not spawn a second backend or open a second window.
- [ ] Full regression pass across every sidebar panel (Explorer, Workspace,
      Search, Agents, Knowledge), Settings' 7 tabs, and the Live Dashboard's
      13 sections.

## Version consistency

- [ ] `frontend/package.json`'s `version` field is the single source of
      truth. Bump it first.
- [ ] `backend/app/__init__.py`'s `__version__` matches it exactly (kept in
      sync manually — see the Sprint 15.6 fix; there is no automated check
      enforcing this yet, see `KNOWN_ISSUES.md`).
- [ ] `docs/PROJECT_MEMORY.md`'s "Project Version" field matches.
- [ ] The About tab and StatusBar both read the real version via
      `window.nemi.backend.getAppInfo()` / `.health()` — no hardcoded
      strings to update (fixed in Sprint 15.6; verify no new hardcoded
      version string was introduced since).

## Documentation

- [ ] `docs/ARCHITECTURE.md` reflects every locked decision made this
      release; version number at the top bumped.
- [ ] `docs/DATABASE_SCHEMA.md` reflects every schema change; version
      number at the top bumped.
- [ ] `docs/PROJECT_MEMORY.md`'s CURRENT SPRINT / COMPLETED TASKS / PENDING
      TASKS / CHANGE HISTORY / NEXT MILESTONE sections are current.
- [ ] `docs/SPRINT_N_REPORT.md` exists for this release's sprint(s).
- [ ] `docs/KNOWN_ISSUES.md` and `docs/PRODUCTION_CHECKLIST.md` reviewed
      and updated if anything changed.

## Packaging (Windows — the only currently supported target)

- [ ] `cd backend && python -m PyInstaller nemi-backend.spec --distpath dist-pyinstaller --workpath build-pyinstaller --noconfirm`
      succeeds and produces `backend/dist-pyinstaller/nemi-backend/nemi-backend.exe`.
- [ ] `cd frontend && npm run dist:win` succeeds and produces both an NSIS
      installer and a portable exe under `frontend/release/`.
- [ ] Install the NSIS build on a clean (or clean-enough) Windows machine/VM,
      confirm first-run experience (no crash, backend starts, Dashboard
      renders, no Python pre-install required).
- [ ] Confirm the portable exe launches standalone without the installer.
- [ ] Uninstall cleanly removes the app (NSIS `allowToChangeInstallationDirectory`
      is enabled — confirm both default and custom install paths).

## Commit and tag

- [ ] Commit with a message following the existing `feat(sprint-N): ...`
      convention (or `release: vX.Y.Z` for a pure version bump with no
      other changes).
- [ ] Push to `origin/main`.
- [ ] Tag the release (`git tag vX.Y.Z` / `git push --tags`) — **not yet
      part of this project's workflow as of Sprint 15.6**; adopt when the
      first real external release happens (see `KNOWN_ISSUES.md`).

## Post-release

- [ ] Confirm the pushed commit is what CI/the build machine actually
      built (no local-only uncommitted changes snuck into the artifact).
- [ ] File any issues found during packaging/install verification as new
      `PENDING TASKS` in `docs/PROJECT_MEMORY.md`, not silently dropped.
