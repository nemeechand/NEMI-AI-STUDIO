# PRODUCTION CHECKLIST

Version: 1.0 (Sprint 15.6)
Purpose: a standard production-readiness assessment (reliability,
observability, security, performance, packaging, documentation) — each item
marked against NEMI AI STUDIO's real, current state, not aspirational. This
is a snapshot; see `docs/KNOWN_ISSUES.md` for the detailed gaps behind any
"Partial"/"Not Done" mark, and `docs/VERSION_READINESS_REPORT.md` for the
go/no-go call this feeds into.

Legend: ✅ Done · 🟡 Partial · ⬜ Not Done

---

## Reliability

| Item | Status | Notes |
|---|---|---|
| Graceful backend shutdown | ✅ | Sprint 15.6: `POST /shutdown` delivers a real SIGINT; the FastAPI lifespan's shutdown code now actually runs (previously dead code — `TerminateProcess` never let it). |
| Automatic backend crash recovery | ✅ | Sprint 15.6: up to 3 automatic restart attempts with backoff on an unexpected exit; a manual "Restart Backend" action exists in the Health Center as a fallback. |
| Startup resilience to a locked/transient-unavailable database | ✅ | Sprint 15.6: 5 retry attempts with 1s backoff before failing loudly. |
| Task-scheduler race condition (double-claiming a task) | ✅ | Sprint 15.6: `mark_running()` is now an atomic `UPDATE ... WHERE status='queued'`; found and fixed during this sprint's own audit. |
| Single-instance enforcement | ✅ | Sprint 15.6: `requestSingleInstanceLock()`; verified live — a second launch attempt does not spawn a second backend or window. |
| Resource leak: unclosed AI provider HTTP clients | ✅ | Sprint 15.6: Gemini's `httpx.AsyncClient` (owned internally by `google-genai`'s `Client`) is now closed on every path (`stream_chat`/`test_connection`/`list_models`/embeddings) — found and fixed during this sprint's audit; every other provider was already correct. |
| SQLite lock contention under concurrent access | 🟡 | Sprint 15.6 added `PRAGMA journal_mode=WAL` and `busy_timeout=5000` — real mitigation, not a guarantee under heavy concurrent write load (this app's single-user desktop scale makes that an unlikely scenario, not an eliminated one). |
| Long-running workflow stability | 🟡 | No multi-day soak test performed. The scheduler, retry, and cascade-cancel logic are unit-tested and live-verified for short sessions only. |
| Orphaned task recovery after a crash | ✅ | Sprint 12: `requeue_orphaned_running_tasks()` on every startup — unaffected, still correct. |

## Observability

| Item | Status | Notes |
|---|---|---|
| Unified health view | ✅ | Sprint 15.6: the new Health Center (Live Dashboard) — backend, database, Electron, Python, AI providers, Ollama, internet, git, workspace, build, memory, CPU, disk, and an overall score, reusing every existing monitoring data source rather than duplicating it. |
| Backend health polling | ✅ | `GET /health` (lightweight) and `GET /health/full` (Sprint 15.6, full aggregation) — both real, no fabricated fields. |
| Structured logging | ✅ | `logs` table + Logger Panel + Terminal section, backend stdout/stderr forwarded since Sprint 6. |
| Real resource metrics (CPU/memory/disk) | 🟡 | Real on Windows (this app's only packaged target); disk usage reports `null` on other platforms rather than a fabricated number — an honest limitation, not a bug. |
| Duplicate monitoring surfaces | ✅ | Sprint 15.6's audit found and trimmed the worst offender (`SprintProgressCenter.tsx`'s own independent resource-usage and log polling, now pointing at the Health Center/Resources/Terminal instead). One minor duplication (ETA calculation) remains, documented in `KNOWN_ISSUES.md`. |

## Security

| Item | Status | Notes |
|---|---|---|
| Renderer isolation | ✅ | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` — verified verbatim during this sprint's audit, unchanged since Sprint 2. |
| CSP | ✅ | `default-src 'self'` with no `connect-src` exception for the backend — the renderer cannot reach the backend directly; every call goes through the IPC boundary, confirmed still enforced. |
| Credential storage | ✅ | All API keys via Electron `safeStorage` (OS-level: DPAPI/Keychain/Secret Service), never in SQLite, never sent to the renderer as plaintext — unchanged since Sprint 10, extended to 7 providers in Sprint 15.5. |
| IPC handler error handling | ✅ | Every `ipcMain.handle` either delegates to a client module that throws a clean, purpose-built error, or (streaming) reports failure via a callback rather than an unhandled rejection — audited this sprint, no gaps found. |
| Filesystem access boundary | ✅ | The backend never writes to the open project (Sprint 5's Filesystem Ownership rule) — all file I/O is Electron main only, unchanged. |
| Code-signing | ⬜ | Installer is unsigned. Top remaining release blocker — see `KNOWN_ISSUES.md`. |
| Dependency vulnerability scanning | ⬜ | No `npm audit`/`pip-audit`-equivalent step exists in this project's workflow yet. |

## Performance

| Item | Status | Notes |
|---|---|---|
| Startup time | 🟡 | Cold backend start (first-import of `openai`/`anthropic`/`google-genai`/`fastapi`/`uvicorn`) measured at ~13-15s during this sprint's own debugging — the window shows and StatusBar correctly reflects "Backend Starting" during this gap; not treated as a defect, but a real, measured number worth knowing. |
| Large project support (10,000+ files) | 🟡 | Not load-tested this sprint against a synthetic 10,000-file fixture. Existing bounds: `listAllFiles`/`searchInFiles` (Electron) have no hard cap and could be slow on very large trees; the Knowledge Graph indexer caps embedding candidates at 150 files (Sprint 14). Real-world testing has been against this repo itself (~684-2000+ files across sprints), not a purpose-built 10k-file case. |
| Large Knowledge Graph performance | 🟡 | Verified live against this repo's own real graph (1,477+ nodes as of Sprint 14) with acceptable performance; no stress test beyond that scale. |
| Large chat/conversation performance | 🟡 | No pagination on `ai_messages` retrieval for a very long conversation; not measured as a bottleneck in practice, not stress-tested either. |
| Duplicate polling overhead | ✅ | Sprint 15.6 removed the most significant duplicate polling (`SprintProgressCenter.tsx`'s own resource/log polls, on top of `ResourceMonitorSection`/`LoggerPanel`/`TerminalSection` already polling the same data). |
| React re-render efficiency | 🟡 | Two unmemoized fuzzy-filter call sites found (`QuickOpen.tsx`, `ChatInput.tsx`) — not currently a measured bottleneck, documented as a known issue rather than fixed this sprint. |

## Packaging

| Item | Status | Notes |
|---|---|---|
| Windows installer (NSIS) | ✅ | Configured, `directories.output: "release"`, real `appId`/`productName`/`copyright` — verified present and non-placeholder this sprint. |
| Portable build | ✅ | Configured alongside NSIS. |
| App icon | ✅ | `assets/icon.ico` confirmed to exist on disk this sprint, correctly referenced in `build.win.icon`. |
| Installer metadata (publisher/author) | ✅ | Sprint 15.6: added the missing `author` field to `package.json` — previously blank, would have shown an empty "Company Name" in the installer. |
| Backend bundling (PyInstaller) | ✅ | `extraResources` config confirmed to match exactly what `resolveBackendDir()` expects at runtime; `backend/dist-pyinstaller/nemi-backend/` confirmed to exist. |
| Code-signing | ⬜ | See Security section above — same item. |
| First-run experience | ✅ | Zero-project state degrades gracefully everywhere checked (Dashboard, Explorer, Search, Global Search) — verified this sprint; no guided onboarding tour exists (see `KNOWN_ISSUES.md`), which is a UX gap, not a crash risk. |

## Documentation

| Item | Status | Notes |
|---|---|---|
| Architecture documented | ✅ | `docs/ARCHITECTURE.md`, versioned, updated every sprint including this one. |
| Database schema documented | ✅ | `docs/DATABASE_SCHEMA.md`, versioned, updated every sprint including this one. |
| Project memory / history | ✅ | `docs/PROJECT_MEMORY.md`, the project's own required "read before any work" record. |
| Per-sprint completion reports | ✅ | `docs/SPRINT_N_REPORT.md` for every sprint since Sprint 15. |
| Release process documented | ✅ | Sprint 15.6: `docs/RELEASE_CHECKLIST.md` (new). |
| Known issues consolidated | ✅ | Sprint 15.6: `docs/KNOWN_ISSUES.md` (new). |
