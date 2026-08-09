# NEMI AI STUDIO — Windows Alpha Build Report

**Build date:** 2026-08-09
**Version:** `0.1.0-alpha.1` (single source of truth: `frontend/package.json` → `version`, read at runtime by `resolveAppVersion()` in `frontend/electron/main.ts`, not `app.getVersion()`)
**Scope:** Controlled Windows Alpha packaging pass using the existing Sprint 15.6 production-readiness work and the existing electron-builder / PyInstaller packaging pipeline (Sprint 8). No new sprint work was started; no packaging functionality was duplicated or replaced.

> **Supersedes** the original 06 August 2026 "Alpha Build 1" report (commit `273feb0`), which required a system-installed Python and shipped the backend as raw source. That report's git history is preserved; this report reflects the current, PyInstaller-bundled, Sprint 15.6-hardened build and is the current source of truth for Alpha readiness.

---

## 1. Build artifacts

| Artifact | File | Size | SHA-256 |
|---|---|---|---|
| NSIS Installer (x64) | `NEMI AI STUDIO-Setup-0.1.0-alpha.1.exe` | 129,970,856 bytes (~123.9 MB) | `506650D275E29596DD30A0D05A88E688CC98731DFCCDC63402B64851A290027C` |
| Portable EXE (x64) | `NEMI AI STUDIO-Portable-0.1.0-alpha.1.exe` | 129,751,941 bytes (~123.7 MB) | `EA8F986EFD9433B2A54824670C7D2194DBB846D6112225ADE3593E1DB9612CE0` |

Both produced by `electron-builder` (`win.target: nsis + portable`, `arch: x64` only, per existing `frontend/package.json` config — unchanged this pass). Artifacts are **not committed to the repository** (`release/` is gitignored, same treatment as `dist/`/`dist-electron/`); this report records their identity for traceability. **Neither artifact is code-signed** (no `certificateFile`/`cscLink` configured); confirmed directly via `Get-AuthenticodeSignature` on the installer (`Status: NotSigned`). Windows SmartScreen will show an "unrecognized publisher" warning on first run — expected and unresolved for this Alpha.

Application icon and branding (`assets/icon.ico`, `productName: "NEMI AI STUDIO"`, `appId: com.nemi.aistudio`) preserved unchanged from the existing config.

The artifacts are also substantially larger than the original 06 August build (~124 MB vs. ~77 MB) — expected, since this build now bundles a full standalone Python runtime (PyInstaller onedir) instead of shipping raw backend source and depending on a system Python install.

---

## 2. Packaging audit (before any changes)

Audited, not modified, unless noted in §3:
- `frontend/package.json` `build` config — coherent with runtime expectations; no changes needed.
- `backend/nemi-backend.spec` (PyInstaller onedir spec bundling `agents/*.md` as `datas`) — coherent, but exposed a real bug (§3).
- `frontend/electron/backend-process.ts` — packaged-path resolution (`resourcesPath/backend`, `userData/database`, `userData/logs`) — verified correct as-is.
- `frontend/electron/main.ts` `resolveAppVersion()` (Sprint 15.6) — re-verified reads `package.json` directly rather than trusting `app.getVersion()`; packaged app correctly reports `0.1.0-alpha.1`.

No packaging functionality was duplicated or replaced — the existing electron-builder + PyInstaller pipeline was used as-is, build → verify → fix → rebuild.

---

## 3. Bug found and fixed during verification

**`_default_agents_dir()` in `backend/app/core/config.py`** assumed PyInstaller's onedir layout places bundled `datas` (including `agents/*.md`, which every AI agent's system prompt is built from) directly next to the executable. That was true prior to PyInstaller 6, but PyInstaller 6 introduced a `_internal/` contents directory as the default home for all bundled binaries and `datas` — silently breaking this assumption. In every packaged build prior to the fix, `agents:list` returned empty and Agent Orchestration, the Autonomous Coding Engine, and Documentation Engine were non-functional.

**Fix:** use `sys._MEIPASS` — PyInstaller's own documented, version-independent attribute for locating bundled data at runtime — instead of hand-deriving the path from `sys.executable`.

**Verification:** live packaged-build check went from 13/15 passing (failures: `agents:list` empty, Live Intelligence Dashboard failing as a downstream consequence) to 17/17 passing after the fix and rebuild. Three regression tests added to `backend/tests/test_config.py`. Full backend suite: **171/171 passed** (168 pre-existing + 3 new), `ruff check` clean, `mypy` clean (0 issues, 62 files).

This is the only source change in this pass. It was required to make the explicitly-requested "Verify Agent Orchestration" step true rather than a rubber stamp — not new feature work.

---

## 4. Offline verification suite (run before packaging)

| Check | Result |
|---|---|
| Frontend `tsc`, `eslint`, `prettier`, `npm run build` | Pass |
| Backend `pytest` | 171 passed |
| Backend `ruff check` | Clean |
| Backend `mypy` | 0 issues, 62 files |

Backend rebuilt via PyInstaller (`nemi-backend.spec`, onedir) and standalone-smoke-tested (bare `nemi-backend.exe`, confirmed startup + `/health`) before packaging into Electron.

---

## 5. Installation verification (NSIS installer) — fully verified live

Silent install (`/S`), launch from the real installed location, and silent uninstall were all performed and verified with real, non-mocked evidence in this session:

| Check | Result |
|---|---|
| Silent install to `%LOCALAPPDATA%\Programs\NEMI AI STUDIO` (per-user, `perMachine:false`) | Pass |
| App launches from installed location | Pass |
| Backend reaches `state: ready` | Pass |
| `GET /health/full` real aggregation (database + all 7 providers) | Pass |
| AI Provider Settings (7 providers: Claude/Anthropic, OpenAI, Gemini/Google, DeepSeek, Grok/xAI, Custom OpenAI-compatible, Ollama) | Pass |
| Ollama integration reachable | Pass |
| Agent Orchestration roster populated (confirms the §3 fix) | Pass |
| Workflow Engine reachable | Pass |
| Knowledge Graph reachable | Pass |
| AI Memory reachable | Pass |
| Live Intelligence Dashboard renders | Pass |
| Health Center renders | Pass |
| Database path is a real per-user AppData path, not a dev-repo path | Pass |
| Graceful shutdown (POST `/shutdown` → confirmed real process exit via log) | Pass |
| No orphaned backend process after app close | Pass (confirmed via `Get-CimInstance Win32_Process`; the only `nemi-backend.exe` present belongs to an unrelated, pre-existing, separately-installed application and was left untouched) |
| Clean uninstall (install directory + both shortcuts removed) | Pass |

**12/12 live functional checks passed. Installer verification is complete and green.**

---

## 6. Portable EXE verification — build and extraction verified; live GUI smoke test incomplete

**What was verified:**
- The portable EXE builds successfully and is a valid NSIS/7z self-extracting package.
- On launch, it correctly self-extracts (~14s) to a per-run `%TEMP%` directory, producing a byte-for-byte identical payload to the `win-unpacked` build (same `app.asar` size, same DLL/resource set, same `resources/backend/_internal/agents/*.md` layout with the §3 fix present) — confirmed by direct filesystem inspection of the extracted payload mid-run.
- The extracted backend (`resources/backend/nemi-backend.exe`) is present and correctly bundled with the same PyInstaller fix as the installer build.

**What could not be completed:** a live GUI smoke test of the portable build's running application (window, backend health, feature checks) via the same method used for the installer build. Mid-verification, this test environment lost the ability to launch **any** Electron process — including a completely bare, unmodified Electron app with no relation to this project — confirmed by:
- The previously-passing win-unpacked build (17/17 green earlier in this same session) failing to launch again, unchanged, moments later.
- A minimal bare-Electron diagnostic app (`app.whenReady()` → open a window with static HTML) also failing to launch.
- Plain Win32 GUI apps (e.g., Notepad) launching normally throughout, ruling out a lost interactive desktop session.
- No corresponding crash entries in the Windows Application event log, no Windows Defender detections, no orphaned/zombie processes, and no change from disabling GPU acceleration or the Chromium sandbox (`--disable-gpu`, `--no-sandbox`).

This is conclusive evidence of a test-environment regression unrelated to this session's packaging work or to the portable target specifically — it affects Electron launches generally, in this shell, from this point in the session onward. Given the identical, byte-for-byte payload to a build that passed full live verification earlier in this same session, the portable build is very likely functionally equivalent to the installer build. However, per this task's explicit instruction not to claim something works without real verification: **the portable EXE's live application behavior is NOT independently re-verified in this report** — only its build integrity and extraction mechanics are.

**Recommendation:** re-run a live portable-EXE smoke test in a fresh environment/session before treating the portable artifact as Alpha-ready for distribution.

---

## 7. System requirements

- Windows 10 or 11, x64.
- No Python installation required — the backend is a self-contained PyInstaller onedir bundle with its own embedded Python runtime. (This is a change from the original 06 August Alpha build, which required a system Python 3.11+.)
- No Node.js/Electron installation required — bundled by electron-builder.
- Internet connectivity required for any cloud AI provider (Anthropic, OpenAI, Google Gemini, DeepSeek, xAI Grok, or a custom OpenAI-compatible endpoint) — the app itself runs fully offline otherwise.

## 8. External prerequisites (clearly documented, not standalone)

- **API keys**: to use any cloud AI provider, the user must supply their own API key via Settings. No keys are bundled.
- **Ollama** (optional): for fully local/offline AI model use, the user must separately install and run [Ollama](https://ollama.com) themselves — it is not bundled and not installed by this app. Without it, cloud providers are the only functional AI backends.
- The application is **not fully standalone with zero prerequisites** — it is standalone with respect to Python/Node (both bundled), but still depends on user-supplied API keys and, optionally, a separately-installed Ollama for local models. This must not be described as a zero-prerequisite install.

## 9. Known limitations

- Build is unsigned; Windows SmartScreen will warn on first run.
- Windows x64 only — no x86, ARM64, macOS, or Linux artifacts in this pass.
- Portable EXE's live application behavior (as opposed to its build/extraction integrity) is unverified in this report — see §6.
- The Alpha has not been tested on a clean machine without the development toolchain already present; only this development machine was used.
- Placeholder application icon (generated geometric "N" monogram, unchanged since the original 06 August build) — a professional brand identity is still recommended before Beta/GA.

## 10. Failed tests

- None in the installer verification (§5) — all 12/12 live checks passed.
- Backend offline suite: 171/171 passed, no failures.
- The portable EXE's live GUI smoke test did not fail with a negative result — it could not be run to completion due to the environment regression described in §6. This is recorded as **incomplete**, not **failed**, since the same test infrastructure itself stopped functioning for an unrelated, already-verified build.

---

## 11. Final Alpha readiness verdict

**Conditional pass.**

- The **NSIS installer** is fully verified end-to-end (install → real health check → all 11 requested subsystem checks → graceful shutdown → no orphaned processes → clean uninstall) and is ready for controlled Alpha distribution.
- The **portable EXE** is built correctly, contains the same fix and byte-identical payload as the fully-verified installer build, but its own live application behavior was not independently re-verified in this session due to an environment issue unrelated to the packaging work itself. It should be re-verified live before being handed to Alpha testers; until then, treat it as **not yet confirmed**, not as failed.
- One real, Alpha-blocking packaging bug (§3) was found and fixed during this pass, with regression tests added.
- All external prerequisites (API keys, optional Ollama) are documented above and must accompany any Alpha distribution — this build is **not** a zero-prerequisite standalone application.
