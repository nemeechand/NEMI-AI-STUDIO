# ALPHA BUILD REPORT

Project: NEMI AI STUDIO
Build: Windows Alpha 1
Version: 0.1.0-alpha.1
Status: Completed
Date: 06 August 2026

---

# SUMMARY

The first Windows Alpha build was produced using Electron Builder,
packaging everything delivered across Sprints 1–5 (desktop shell,
Dashboard, FastAPI backend, SQLite data layer, real filesystem-backed
Project Explorer with live watching, file CRUD, backend-connected
Logger Panel) into a signed-application-name, iconed, distributable
Windows build — both an NSIS installer and a portable executable.
Both were installed/run and verified on this Windows machine; no
packaging defects were found that blocked either target.

---

# BUILD CONFIGURATION

- **Tool**: `electron-builder` 26.15.3 (added as a devDependency).
- **App ID**: `com.nemi.aistudio`
- **Product Name**: `NEMI AI STUDIO`
- **Version**: `0.1.0-alpha.1` (bumped from `0.1.0` to mark this as an
  Alpha release per the version progression in `agents/release_manager.md`).
- **Config location**: `frontend/package.json` → `"build"` field (no
  separate electron-builder config file, consistent with this
  project's preference for minimal config sprawl).
- **Icon**: `frontend/assets/icon.ico` — a 7-resolution (16/24/32/48/64/128/256)
  ICO generated for this build (see ICON section below). `icon.png`
  (512×512) also included for future non-Windows targets.
- **Targets**: `nsis` (installer) and `portable`, both `x64`.
- **extraResources**: the entire `backend/` package (`app/`,
  `requirements.txt`, `pyproject.toml`, excluding `__pycache__`/`.pyc`)
  is copied into the packaged app's `resources/backend` folder, so
  the backend source ships inside the installer.

---

# ICON

No existing brand asset was available, so a simple geometric "N"
monogram was generated for this Alpha: a rounded-square deep-navy
background (`#0f172a`) with a two-tone accent-blue "N" mark
(`#3399ff` / `#185ca3`), matching the app's existing dark-theme accent
color (`--color-accent`). Generated via Pillow (Python) at 1024×1024
and downsampled into the ICO's 7 resolutions — not a persisted
project dependency, used only as a one-time build-time tool.

This is a placeholder-quality mark suitable for an Alpha build. A
professional brand identity is recommended before a Beta/GA release.

---

# WHAT'S INCLUDED

Every feature delivered through Sprint 5 is present in this build,
unchanged:

- Sprint 1–2: Electron + React + TypeScript shell, hardened
  (sandbox, contextIsolation, CSP), Theme Manager (dark/light).
- Sprint 3: Dashboard (sprint progress, AI team, tech stack, quick
  actions).
- Sprint 4: FastAPI + Uvicorn backend, SQLite schema, centralized
  logging, `/health`.
- Sprint 5: real filesystem-backed Project Explorer, File
  Create/Rename/Delete/Open/Save, live filesystem watching, `/logs`
  API, backend-connected Logger Panel, file-operation audit logging.

No new application features were added in this build — packaging
only.

---

# PACKAGED-APP CHANGES

One code change was required to make the app function correctly once
packaged (dev-mode paths don't apply inside a packaged app):

- `frontend/electron/backend-process.ts::resolveBackendDir()` now
  branches on `app.isPackaged`: packaged builds resolve the backend
  via `process.resourcesPath/backend` (the extraResource path);
  dev mode keeps the existing `__dirname`-relative path unchanged.
- The Python-not-found error path (`ENOENT` from `spawn`) now
  produces a specific, actionable message — "Python was not found on
  this system. Install Python 3.11+ and the backend dependencies..."
  — surfaced through the same `BackendHealth.message` the StatusBar
  already displays, rather than a raw Node error string.

---

# BUILD OUTPUT

| Artifact | Size | SHA-256 |
|---|---|---|
| `NEMI AI STUDIO-Setup-0.1.0-alpha.1.exe` | 80,612,747 bytes (~76.9 MB) | `5B023D617FF4857750EC4253FD5BCACA09A8DB02DD0D1746B3628F354A941493` |
| `NEMI AI STUDIO-Portable-0.1.0-alpha.1.exe` | 80,393,898 bytes (~76.7 MB) | `8DF6976B25777BA4D4561029DBA07A1E5A33365C4407C0B38C0507ECD0C6305C` |

Build log: `electron-builder` reported no errors or warnings besides
the expected "author is missed in package.json" notice (cosmetic,
does not affect functionality — worth fixing before a public release).

Artifacts are **not committed to the repository** — `release/` is
gitignored, same treatment as `dist/`/`dist-electron/`. This report
records their identity (size + checksum) for traceability.

---

# INSTALLATION VERIFICATION (performed on this machine)

## NSIS Installer

1. Silently installed (`/S`) — completed without error.
2. Verified install directory: `%LOCALAPPDATA%\Programs\NEMI AI STUDIO\`
   — contains `NEMI AI STUDIO.exe`, `Uninstall NEMI AI STUDIO.exe`,
   `resources\app.asar`, and `resources\backend\` with the full
   Python package (`app/`, `requirements.txt`, `pyproject.toml`).
3. Verified shortcuts created: Desktop (`NEMI AI STUDIO.lnk`) and
   Start Menu (`NEMI AI STUDIO.lnk`), both pointing at the correct exe.
4. Launched the installed app: it started, spawned the bundled Python
   backend as a child process, and `GET http://127.0.0.1:8756/health`
   returned `200 {"status":"ok",...}` — full pipeline confirmed
   working from a real installed location, not just dev mode.
5. Closed the app gracefully — confirmed both the Electron and Python
   processes terminated, nothing orphaned.
6. Uninstalled (`/S`) — confirmed the install directory and both
   shortcuts were fully removed afterward.

## Portable Executable

1. Launched directly from `release/` with no installation step.
2. Confirmed it self-extracts and runs (portable builds extract to a
   temp working directory — observed to be a Windows short-path
   alias, e.g. `C:\Users\HAREKR~1\...`, on this machine).
3. Spawned its own bundled backend; `GET /health` returned `200` —
   same successful pipeline as the installer build.
4. Closed cleanly — verified no orphaned processes.

No packaging defects were found in either target. The only issue
encountered during the whole Alpha effort — a Windows short-path
watcher crash — was found and fixed during **Sprint 5** (before this
build), not during packaging; it's mentioned here because the
portable build's own extraction path happens to land on a short-path
alias too, which incidentally re-confirms that fix matters for this
distribution method specifically.

---

# KNOWN LIMITATIONS (Alpha, by design)

1. **Requires Python 3.11+ pre-installed on the target machine.**
   This build does **not** bundle a standalone Python runtime. The
   backend source ships inside the installer, but Electron still
   spawns `python` from the system `PATH` at runtime, exactly as in
   dev mode. On a machine without a compatible Python (and the
   backend's `requirements.txt` installed), the app will start and
   show a UI, but the StatusBar will report "Backend Offline" with
   the new specific error message rather than the AI-powered features
   working. This is a deliberate scope decision for this Alpha —
   bundling Python (e.g. via PyInstaller) is real, non-trivial
   additional work, tracked as the top recommendation for a Beta
   build below.
2. **Unsigned installer.** No code-signing certificate is configured;
   `Get-AuthenticodeSignature` confirms both `.exe` files are
   unsigned. Windows SmartScreen will show an "unrecognized
   publisher" warning on first run on other machines. Expected and
   acceptable for an Alpha; a Beta/GA release should use a proper
   code-signing certificate.
3. **`author` field missing from `package.json`** — electron-builder
   noted this during the build. Cosmetic (affects installer metadata
   only), not a functional defect. Should be filled in before a
   public release.
4. **Placeholder icon** — see ICON section above.
5. All limitations already recorded in `docs/PROJECT_MEMORY.md` from
   Sprints 1–5 (e.g. `files` table unused, FileEditor has no syntax
   highlighting, resizable panel splitters not implemented) are
   unchanged by this build — packaging doesn't touch application
   features.

---

# RECOMMENDATION FOR NEXT BUILD (Beta)

1. Bundle a standalone Python runtime (PyInstaller or equivalent) so
   the app runs on a machine with zero prerequisites — this is the
   single highest-value packaging improvement available.
2. Obtain and configure a code-signing certificate.
3. Fill in `author`/`homepage`/`repository` metadata in `package.json`.
4. Commission or design a proper brand icon to replace the Alpha
   placeholder monogram.

---

# GIT COMMIT MESSAGE

```
build(alpha-1): first Windows Alpha build via electron-builder

Add electron-builder (NSIS installer + portable, x64), a generated
application icon, and package.json "build" config (appId, productName
"NEMI AI STUDIO", extraResources bundling the backend/ source).
Bump version to 0.1.0-alpha.1.

Fix backend-process.ts to resolve the backend directory via
process.resourcesPath when packaged (dev-mode path resolution doesn't
apply once bundled), and give a specific, actionable error message
when Python isn't found on the target machine.

Verified: both the NSIS installer and portable exe install/run, spawn
the bundled backend, and pass a real health check; the installer was
uninstalled afterward with a clean removal. No packaging defects
found. Known Alpha limitation: still requires Python 3.11+ on PATH —
bundling a standalone runtime is deferred to a Beta build.
```

---

END OF REPORT
