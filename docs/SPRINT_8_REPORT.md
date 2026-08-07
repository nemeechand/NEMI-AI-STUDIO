# SPRINT 8 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 8 — Standalone Python Runtime Bundling (Beta Readiness)
Status: Completed
Date: 07 August 2026

---

# COMPLETED TASKS

1. Bundled the backend into a standalone executable via PyInstaller (`backend/nemi-backend.spec`, onedir output) — a packaged app no longer requires a system Python interpreter.
2. Found and fixed a real architectural issue during implementation: `config.py`'s path resolution (`Path(__file__).resolve().parents[3]`) is unreliable under a frozen executable — reproduced directly (the bundled exe wrote its database inside its own bundle folder), then fixed via `backend-process.ts` always setting `NEMI_DB_PATH`/`NEMI_LOG_FILE` from `app.getPath('userData')` when packaged.
3. Updated `backend-process.ts` to spawn the bundled executable directly (no args, no `PATH` dependency) in packaged builds, while leaving dev mode (`python -m app.main` from `PATH`) completely unchanged.
4. Updated `dist:win`'s build pipeline (`build:backend` npm script) and `extraResources` to ship the PyInstaller output instead of raw Python source.
5. Fixed a pre-existing `.gitignore` bug found while adding build-artifact ignores: the generic Python template's `*.spec` rule was silently swallowing the deliberately-checked-in `nemi-backend.spec`.
6. Verified rigorously: bundled exe serves `/health`/`/logs`/`/projects` correctly with `PATH` stripped of every Python installation on the dev machine; live process inspection confirms the actual running backend process in a full packaged-app launch is `nemi-backend.exe`, not `python.exe`.
7. Ran a full `npm run dist:win` packaged build and a 15-point live verification (Sprint 8-specific checks plus a Sprint 7 regression pass), reproduced clean on two consecutive runs.
8. Updated documentation continuously (`docs/ARCHITECTURE.md`) as each piece landed, including correcting an unrelated stale line found in passing (Sprint 6's stdout/stderr Logger Panel relay was already built; the doc still said "future work").

---

# GENERATED FILES

- `backend/nemi-backend.spec` — PyInstaller spec (onedir, `hiddenimports` for uvicorn's dynamic loop/protocol/lifespan selection).
- `docs/SPRINT_8_REPORT.md` (this file).

No new application source files were needed beyond the spec — every other change modified existing modules (see below).

---

# MODIFIED FILES

**Backend**
- `backend/requirements-dev.txt` — added `pyinstaller` (build-time only, never a runtime dependency).

**Electron**
- `frontend/electron/backend-process.ts` — `resolveBackendCommand()` (new, mirrors the existing `resolveBackendDir()`/`app.isPackaged` branch pattern) selects the bundled executable in packaged builds, `python -m app.main` in dev; `resolveDataPaths()` (new) computes `NEMI_DB_PATH`/`NEMI_LOG_FILE` from `app.getPath('userData')` when packaged; `startBackend()` wires both in; the `ENOENT` error message now branches on `app.isPackaged` (a missing bundled exe reports a corrupted-install message, not the old "install Python" message).

**Build config**
- `frontend/package.json` — new `build:backend` script; `dist:win` now runs it before `electron-builder`; `extraResources` repointed from raw `../backend` source to `../backend/dist-pyinstaller/nemi-backend`.
- `.gitignore` — added `backend/dist-pyinstaller/` and `backend/build-pyinstaller/` (generated build output); added a negation exception (`!backend/nemi-backend.spec`) for the pre-existing generic `*.spec` ignore rule that was silently swallowing the checked-in spec file.

**Docs**
- `docs/ARCHITECTURE.md` — new "STANDALONE RUNTIME BUNDLING (locked decision — Sprint 8)" section; Process Lifecycle bullets updated (spawn logic, plus a stale Sprint 6 line corrected in passing); 2 new locked-decision entries; version bumped to 1.5.
- `docs/PROJECT_MEMORY.md` — Sprint 8 marked completed with full delivery detail.

---

# VERIFICATION

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass |
| `npm run build` | Pass |
| `pytest` | 24 passed (unchanged — backend source untouched by this sprint) |
| `ruff check` | All checks passed |
| `mypy --strict` | No issues, 26 source files |
| `npm run dist:win` (full packaged build) | Pass — NSIS installer + portable exe produced, ~96MB (up from ~80MB, expected growth) |

**Standalone-exe verification** (bypassing Electron entirely):
- Launched `nemi-backend.exe` directly — `/health`, `POST`/`GET /logs`, `POST /projects/opened` all worked correctly.
- Relaunched with `PATH` explicitly stripped of every Python installation on the dev machine (`python`, `python3`, and the `py` launcher all confirmed unresolvable via `which`) — `/health` still returned `200 {"status":"ok",...}`, proving no silent fallback to a system interpreter.

**Live packaged-app verification** (Playwright-driven, fresh Electron profile per run, reproduced twice):

| # | Check | Result |
|---|---|---|
| 1–6 | Window opens, `window.nemi` present, backend auto-starts, StatusBar Ready, Logger receives messages, `/health` returns 200 | PASS |
| 7 | Running backend process is `nemi-backend.exe`, confirmed via `Get-CimInstance Win32_Process`'s `ExecutablePath` — not `python.exe` | PASS |
| 8 | Database written to `app.getPath('userData')/database/nemi.db`, not inside `resources/` | PASS |
| 9 | Dashboard renders | PASS |
| 10–11 | Explorer create/open file, Save (Ctrl+S) | PASS |
| 12 | Workspace Manager panel opens and lists the project | PASS |
| — | Zero renderer console errors, zero uncaught page errors | PASS |
| 13 | App closed cleanly, zero orphaned processes | PASS |

15/15 both runs.

**Verification limitation, stated honestly**: no true clean-machine/VM test was performed in this environment — this development machine already has multiple Python installations (`C:\Python314\`, a user-local Python 3.9, etc.), so a genuine "fresh Windows install with no Python at all" test wasn't possible here. The `PATH`-stripping test above is the closest practical proxy available and directly targets the actual failure mode (the bundled exe would fail identically to the old code if it depended on `PATH`-resolved `python`), but it is not a substitute for real clean-machine verification. Recorded here rather than overclaimed.

---

# KNOWN ISSUES

- No genuine clean-VM test performed (see verification limitation above).
- Package size grew from ~80MB to ~96MB — expected (Python interpreter + stdlib + fastapi/pydantic/starlette/uvicorn bundled in), not a defect.
- Installer remains unsigned — separate, already-tracked Beta blocker, unaffected by this sprint. Unsigned PyInstaller executables are somewhat more prone to antivirus/SmartScreen false positives than a signed binary, compounding that existing limitation.
- AI Chat Panel and Code Editor remain architecture-only (Sprint 6 reservation) — not built this sprint.
- True concurrent multi-project support remains deliberately deferred (Sprint 7 decision, unaffected by this sprint).

---

# NEXT SPRINT

**Sprint 9** — recommended: code-signing certificate for the installer (now the top remaining Beta blocker), and/or begin the AI Chat Panel or Code Editor against the architecture reserved in Sprint 6.

---

# GIT COMMIT MESSAGE

```
feat(sprint-8): bundle standalone Python runtime (Beta readiness)

Bundle the backend into a standalone executable via PyInstaller
(backend/nemi-backend.spec, onedir - not onefile, since Electron
spawns the backend fresh on every app launch and onefile's
self-extraction would add latency to every startup). pyinstaller
added to requirements-dev.txt as a build-time-only tool, never a
runtime dependency.

Found and fixed a real issue during implementation: config.py's
_REPO_ROOT path derivation breaks under a frozen executable -
reproduced directly (bundled exe wrote its database inside its own
bundle folder instead of the real repo root). Fixed without any
backend source change: backend-process.ts now always sets
NEMI_DB_PATH/NEMI_LOG_FILE from app.getPath('userData') when packaged
(both already-supported config.py overrides since Sprint 4) - also
corrects an incidental Alpha-build behavior of writing app data
inside resourcesPath instead of a proper per-user location.

backend-process.ts::resolveBackendCommand() branches on
app.isPackaged (mirroring the existing resolveBackendDir() pattern):
packaged builds spawn the bundled nemi-backend.exe directly with zero
PATH/system-Python dependency; dev mode is unchanged. dist:win's
build pipeline gains a build:backend step; extraResources now ships
the PyInstaller output instead of raw source.

Verified rigorously: bundled exe serves /health, /logs, and /projects
correctly with PATH stripped of every Python installation on the dev
machine (python/python3/py all confirmed unresolvable). Live process
inspection during a full packaged-app launch confirms the actual
running backend is nemi-backend.exe, not python.exe. A 15-point live
verification (Sprint 8 checks + Sprint 7 regression) passed 15/15,
reproduced clean twice. Full offline suite (tsc/eslint/prettier/
build, pytest/ruff/mypy) unaffected since backend source is untouched.

Fix a pre-existing .gitignore bug found in passing: the generic
Python template's *.spec rule was silently swallowing the
deliberately checked-in nemi-backend.spec.

Update docs/ARCHITECTURE.md (new STANDALONE RUNTIME BUNDLING section,
2 new locked decisions, a stale Sprint 6 line corrected) and
docs/PROJECT_MEMORY.md; add docs/SPRINT_8_REPORT.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
