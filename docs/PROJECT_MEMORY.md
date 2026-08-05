# PROJECT MEMORY

---

# PROJECT INFORMATION

Project Name:
NEMI AI STUDIO

Founder:
Nemee Chand Khichar

Project Version:
v0.1

Project Type:
Enterprise AI Software Development Platform

Status:
Planning Phase

Started:
August 2026

---

# PROJECT VISION

NEMI AI STUDIO is an enterprise-grade AI software development platform.

The platform should work like an AI software company.

The user should only describe what they want to build.

The platform should perform planning, architecture, coding, reviewing, testing, debugging and building automatically using multiple AI models.

---

# LONG TERM GOAL

Create India's best AI Software Development Platform.

Future products to be built using this platform:

• Brain Wala DMIT
• NIVESH PRO CRM
• Financial Advisor CRM
• School ERP
• Hospital ERP
• Stock Market Platform
• AI Automation Systems

---

# CURRENT PHASE

Planning

---

# CURRENT SPRINT

Sprint 1 — Completed

Goal:

Create complete software foundation.

No business logic.

No production features.

Architecture first.

Delivered:

Electron main process and preload script

React + TypeScript renderer entry

Vite build pipeline (renderer, main, preload)

ESLint + Prettier configuration

Base frontend folder structure

No UI implemented. No Python. No SQLite. No AI. No business logic.

Sprint 1B — Completed

Goal:

Extend the software foundation with a Python backend.

No business logic.

No API framework selected yet.

No Electron ↔ Python process wiring yet.

Delivered:

Python backend package (backend/app) with a runnable entry point

Pytest test scaffold (backend/tests)

Ruff (lint) and Mypy (strict type-check) tool configuration

Dependency files (requirements.txt, requirements-dev.txt) — zero runtime dependencies by design

.env.example placeholder (no secrets)

Verified: pytest, ruff check, mypy, and `python -m app.main` all pass

Sprint 2 — Completed (Desktop Shell)

Goal:

Build the desktop application shell only.

No AI. No Database. No business logic.

Delivered:

VS Code style layout (custom frameless title bar, activity-bar sidebar, main content area, bottom logger panel, status bar)

Professional Dark Theme (default) with a Light theme alternative, via a CSS-variable Theme Manager

Header Toolbar with custom window controls (minimize / maximize / close) over a frameless BrowserWindow

Project Explorer (static placeholder tree, recursive component, no real filesystem access yet)

Logger Panel (static placeholder entries, no real log ingestion yet)

Settings Window (in-app modal with Appearance/theme control — not a separate OS window; documented as a deliberate simplification)

Theme Manager (React context + provider + hook, persisted to localStorage, `dark` class strategy)

TailwindCSS v4 integrated via `@tailwindcss/vite` (no separate config file — CSS-first `@theme` tokens)

Electron hardening: `sandbox: true`, `contextIsolation: true`, `nodeIntegration: false`, denied `window.open`, blocked cross-origin `will-navigate`, restrictive Content-Security-Policy meta tag

Verified: tsc build, eslint (0 warnings), prettier, vite build (renderer + main + preload), and a live `npm run dev` Electron launch (process stable, no runtime errors)

Sprint 3 — Completed (Architecture/Database/Agent Finalization + Dashboard)

Goal:

Finalize software architecture, database design, and AI agent workflow documentation. Start real Dashboard content behind the Sprint 2 shell.

Delivered:

docs/ARCHITECTURE.md — locks the layer mapping, Electron process/IPC boundary (`window.nemi` only), the Context+Provider+Hook state pattern, and defers backend framework/Electron↔Python transport as open decisions

docs/DATABASE_SCHEMA.md — finalized SQLite table design (projects, tasks, files, agents, memory, logs, settings, history) with columns, keys, indexes and relationships — design only, no implementation yet

docs/AGENTS_OVERVIEW.md — consolidates the 8 agent roles from agents/*.md into one pipeline diagram and approval-gate reference

docs/PRODUCT_VISION.md reviewed for consistency against all other docs — confirmed complete, no changes required

Dashboard module (frontend/src/components/dashboard/): Dashboard, DashboardCard, WelcomeHeader, QuickActionsCard, SprintStatusCard, AITeamCard, TechStackCard, dashboardData.ts — replaces the "No project opened yet" placeholder with real content (sprint progress, AI team roster, tech stack, quick actions). New Project/Open Project are honest disabled stubs ("Coming Soon") since filesystem project loading isn't implemented yet

Status Bar label updated to "Sprint 3 — Dashboard"

Verified: tsc build, eslint (0 warnings), prettier (clean on all touched files), vite build (renderer + main + preload), pytest (1 passed), ruff check (all checks passed), mypy (no issues), and a live `npm run dev` Electron launch (process stable, no runtime errors)

Sprint 4 — Completed (Backend Integration)

Goal:

Finalize backend architecture, integrate Electron with the Python backend, build a robust IPC layer, build the SQLite data access layer, implement startup + health checks, add centralized logging and error handling.

Delivered:

Backend framework locked: FastAPI + Uvicorn over HTTP on 127.0.0.1:8756 (fixed, env-overridable port) — the backend's first-ever runtime dependency (Sprint 1B was intentionally dependency-free)

backend/app/core/: config.py (Settings, env-overridable, repo-root-relative paths independent of cwd), logging.py (console + rotating file at logs/backend.log), errors.py (NemiError + global FastAPI exception handlers returning a consistent {"error": {"code","message"}} shape, unhandled exceptions logged server-side with full traceback, never leaked to the client)

backend/app/db/: connection.py (context-managed sqlite3 connection, foreign_keys pragma, Row access), schema.py (all 8 DATABASE_SCHEMA.md tables + indexes, idempotent init_db()), repositories/logs_repository.py (insert/list_recent — the first concrete repository, backing the logs table)

backend/app/api/health.py + backend/app/server.py: GET /health (status, version, env, uptime), FastAPI lifespan hook that configures logging, initializes the database, and logs a startup entry to both the file log and the logs table

backend/app/main.py rewritten as the real process entry point (blocking run_server(), returns 0 on clean shutdown/KeyboardInterrupt)

frontend/electron/backend-process.ts: Electron main spawns `python -m app.main` as a child process on app ready (parallel with window creation, not blocking it), polls /health (300ms interval, 15s timeout) to determine starting/ready/error state, and stops the child cleanly on app before-quit — manually verified: graceful window close terminates the Python child with no orphaned process

IPC: window.nemi.backend.health() (preload.ts + electron-api.d.ts) — the renderer never talks to the backend directly; every call is relayed through Electron main, keeping the Sprint 2 CSP/sandbox hardening intact

StatusBar now shows real backend health (starting/ready/error/stopped) instead of a static "Ready" label, polling every 5s

.gitignore updated: database/*.db and database/*.db-journal ignored (runtime artifacts, regenerated on startup; *.log was already ignored)

docs/ARCHITECTURE.md updated: closes the Sprint 3 "open decisions" (backend framework, transport, process lifecycle) with the choices above and the reasoning behind them

docs/DATABASE_SCHEMA.md updated: implementation status section added — schema is live, only logs has a repository, remaining 7 tables intentionally deferred to the sprints that need them

docs/SPRINT_4_REPORT.md created

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build (renderer + main + preload); pytest (10 passed), ruff check (all checks passed), mypy strict (0 issues, 20 source files); live end-to-end test — `npm run dev` spawned Electron, which spawned the Python backend, which answered curl http://127.0.0.1:8756/health with a real response, and a graceful window close cleanly terminated both processes with nothing orphaned

Known limitation: spawning `python` from PATH assumes the machine running the app has a compatible Python with backend dependencies installed — acceptable for development, but a packaged/distributed build will need to bundle a Python runtime (future work, not solved this sprint)

Sprint 5 — Completed (Real Filesystem, File CRUD, Live Watching)

Goal:

Build the real filesystem-backed Project Explorer, connect the Logger Panel to backend logs, add File Create/Rename/Delete/Open/Save, watch filesystem changes in real time, improve Electron ↔ Python IPC, add robust logging and error handling.

Delivered:

Filesystem ownership locked as Electron main (not Python) — `frontend/electron/filesystem.ts` (pure Node + chokidar, no Electron import — directly testable under plain Node), `frontend/electron/project-dialogs.ts` (native folder-picker dialogs, isolated from the CRUD/watch logic)

Real Project Explorer: `ProjectExplorer.tsx` (empty state with Open Folder / New Project), `ExplorerTree.tsx` (root listing + create-at-root), `ExplorerTreeItem.tsx` (lazy IPC-backed children, hover actions, optimistic rename/delete), `InlineNameInput.tsx` (Electron has no native `window.prompt`, so this is the real create/rename UI) — replaces the Sprint 2 static mock tree entirely (mockProjectTree.ts deleted)

File Create/Rename/Delete/Open/Save all real: create uses the `wx` flag for atomic duplicate detection; delete requires `window.confirm`; a minimal `FileEditor.tsx` (plain textarea, dirty-tracking, Ctrl+S) makes Open/Save genuinely work — deliberately no syntax highlighting, scope stated explicitly in docs/ARCHITECTURE.md

Real-time filesystem watching via `chokidar`, ignoring node_modules/.git/dist/__pycache__/.venv/etc. — `openProject()` now awaits the watcher's `ready` event before resolving (fixes a race where a file created immediately after opening a project could be missed)

Found and fixed a genuine Windows bug during verification: a short-path (8.3-style, e.g. `HAREKR~1`) watch root crashes chokidar's native watcher with an uncatchable libuv assertion — fixed by resolving to the real long-form path via `fs.realpath()` before watching, verified via a direct reproduction

Backend `/logs` API: `GET /logs` (paginated, newest-first) + `POST /logs` (validated via pydantic, level restricted to INFO/WARNING/ERROR/DEBUG) — `LogsRepository.insert()` now returns the created row instead of just an id; added a `RequestValidationError` handler so pydantic validation errors also return the consistent `{"error": {"code","message"}}` shape

Real Logger Panel: polls `window.nemi.backend.logs()` every 5s, replacing Sprint 2's mock entries entirely (mockLogEntries.ts deleted)

File operations audit-log themselves to the backend's `logs` table via a new `frontend/electron/backend-client.ts::postLog()` (fire-and-forget, contained errors — a backend outage never breaks a file operation) — verified end-to-end: creating a file produced a real `fs.create` row visible via `GET /logs`

Dashboard's "New Project" / "Open Project" buttons are no longer disabled stubs — both now trigger the real folder-picker flow via a new `frontend/src/project/` module (ProjectProvider/useProject/useOpenProjectDialog, following the Context+Provider+Hook pattern locked in Sprint 3/4), with the last-opened project persisted to localStorage and revalidated on launch

`chokidar` added as a frontend dependency; `IconButton` gained `disabled` styling (used by the FileEditor's Save button)

Verified: tsc build, eslint (0 warnings), prettier (clean), vite build (renderer + main + preload, chokidar bundles correctly); pytest (14 passed), ruff check (all checks passed), mypy strict (0 issues, 23 source files); a standalone Node smoke test (`npx tsx`, no Electron needed) exercised listDirectory/createFile/renameEntry/deleteEntry/readFile/writeFile plus the watcher against a real temp directory — including the short-path crash reproduction and fix; live end-to-end test — `npm run dev` spawned Electron + the real Python backend, `GET /logs` returned real rows, a file-create audit entry was confirmed to reach the database through the full Electron→backend pipeline, and a graceful window close cleanly terminated both the Electron and Python processes with nothing orphaned

Known limitation: native-dialog-driven flows (the folder-picker itself) could not be scripted end-to-end in this environment (no OS dialog automation available here) — verified instead by exercising the underlying `filesystem.ts` functions directly, which is what the dialog handlers call after the user picks a path

Sprint 6 — Pending Approval

---

# CURRENT STATUS

Repository Created

GitHub Connected

VS Code Ready

Claude Code Installed

Claude Pro Connected

Node.js Installed

Python Installed

Folder Structure Created

Documentation Started

Sprint 1 Completed

---

# COMPLETED TASKS

✔ GitHub Repository Created

✔ GitHub Desktop Connected

✔ VS Code Installed

✔ Claude Code Installed

✔ Claude Authentication Completed

✔ Folder Structure Created

✔ Initial Documentation Started

✔ Sprint 1 Completed — Electron + React + TypeScript + Vite Bootstrap

✔ ESLint + Prettier Configured

✔ Base Frontend Folder Structure Created (frontend/electron, frontend/src)

✔ Build Verified (npm install, tsc build, eslint, vite build all passing)

✔ Sprint 1B Completed — Python Backend Foundation Bootstrap

✔ Ruff + Mypy Configured (backend/pyproject.toml)

✔ Base Backend Folder Structure Created (backend/app, backend/tests)

✔ Backend Verified (pytest, ruff check, mypy, python -m app.main all passing)

✔ Sprint 2 Completed — Desktop Application Shell (VS Code style layout)

✔ TailwindCSS v4 Integrated (@tailwindcss/vite)

✔ Theme Manager Implemented (Dark default, Light alternative, persisted)

✔ Electron Hardened (sandbox, CSP, navigation/window-open guards, custom frameless title bar)

✔ Shell Verified (tsc, eslint, prettier, vite build, live Electron dev launch all passing)

✔ Sprint 3 Completed — Architecture, Database, and Agent Workflow Finalized; Dashboard Started

✔ docs/ARCHITECTURE.md Created (layer mapping, IPC boundary, state pattern locked)

✔ docs/DATABASE_SCHEMA.md Created (8 tables designed: projects, tasks, files, agents, memory, logs, settings, history)

✔ docs/AGENTS_OVERVIEW.md Created (8-agent pipeline + approval gates consolidated)

✔ docs/PRODUCT_VISION.md Reviewed — confirmed consistent and complete

✔ Dashboard Module Implemented (Sprint Progress, AI Team, Tech Stack, Quick Actions cards) — real content replacing the Sprint 2 placeholder

✔ Sprint 3 Verified (tsc, eslint, prettier, vite build, pytest, ruff, mypy, live Electron dev launch all passing)

✔ Sprint 4 Completed — Backend Architecture Finalized; Electron ↔ Python Integration Live

✔ FastAPI + Uvicorn Backend Service (backend/app/server.py, backend/app/api/health.py)

✔ Backend Core Modules (config.py, logging.py, errors.py) — env-configurable settings, centralized console+file logging, consistent JSON error responses

✔ SQLite Data Access Layer (backend/app/db/) — all 8 tables created automatically on startup, LogsRepository implemented

✔ Electron ↔ Python Process Integration (frontend/electron/backend-process.ts) — spawn, health-poll, graceful shutdown, verified no orphaned processes

✔ IPC Backend Bridge (window.nemi.backend.health()) — renderer never talks to the backend directly

✔ StatusBar Wired to Real Backend Health (replacing the static "Ready" label)

✔ Sprint 4 Verified (tsc, eslint, prettier, vite build, pytest ×10, ruff, mypy strict, live end-to-end Electron+backend launch with graceful shutdown all passing)

✔ Sprint 5 Completed — Real Filesystem, File CRUD, Live Watching, Backend-Connected Logger Panel

✔ Filesystem Ownership Locked as Electron Main (frontend/electron/filesystem.ts + project-dialogs.ts) — not routed through Python

✔ Real Project Explorer (ExplorerTree, ExplorerTreeItem, InlineNameInput) — replaces the Sprint 2 static mock tree

✔ File Create/Rename/Delete/Open/Save Implemented (atomic create via `wx` flag, delete confirmation, minimal FileEditor with Ctrl+S)

✔ Real-Time Filesystem Watching via chokidar — watcher-ready race and a Windows short-path libuv crash found and fixed during verification

✔ Backend /logs API (GET + POST, pydantic-validated) — LogsRepository.insert() now returns the created row; RequestValidationError handler added for consistent error shape

✔ Real Logger Panel (polls window.nemi.backend.logs()) — replaces Sprint 2 mock entries

✔ File-Operation Audit Logging (frontend/electron/backend-client.ts::postLog()) — verified end-to-end against the real backend

✔ Dashboard New Project / Open Project Buttons Now Real (frontend/src/project/ — ProjectProvider/useProject/useOpenProjectDialog)

✔ Sprint 5 Verified (tsc, eslint, prettier, vite build; pytest ×14, ruff, mypy strict; standalone Node smoke test of filesystem.ts against a real temp directory; live end-to-end Electron+backend launch with graceful shutdown all passing)

---

# PENDING TASKS

Workflow Design

Memory Engine

Plugin System

Git Integration

Testing Engine

Build System

Python runtime bundling for packaged/distributed builds (currently assumes `python` on PATH — dev-mode only)

Repositories/business logic for the remaining 7 tables (projects, tasks, files, agents, memory, settings, history) — schema exists, repositories deferred to the sprints that need them; `files` table remains intentionally unused (file content always comes from disk)

Resizable/drag panel splitters (sidebar and logger panel are currently show/hide toggles only)

FileEditor is a plain textarea by design (no syntax highlighting/language server) — a real code-editor experience (Monaco/CodeMirror) is future work

Backend stdout/stderr are piped to Electron's console but not yet surfaced in the Logger Panel (which shows the SQLite `logs` table, not live process output)

---

# AI TEAM

Founder

Nemee Chand Khichar

Chief Technology Officer

ChatGPT

Lead Software Engineer

Claude Code

Future AI Members

Gemini

DeepSeek

Qwen

Llama

OpenAI API

---

# TECH STACK

Frontend

React

TypeScript

Tailwind CSS

Backend

Python

Desktop

Electron

Database

SQLite

Version Control

Git

GitHub

Testing

Playwright

---

# DEVELOPMENT PRINCIPLES

Architecture First

Security First

Performance First

Modular Design

Production Ready

No Breaking Changes

Documentation First

Code Review Required

---

# CODING RULES

Never modify unrelated files.

Never delete files without permission.

Always read PROJECT_MEMORY.md first.

Always read AI_RULES.md before coding.

Always understand the entire project before implementation.

Always explain important changes.

Always update PROJECT_MEMORY.md after every completed sprint.

---

# DECISIONS LOCKED

Desktop Application

Electron

Python Backend

SQLite Database

GitHub Version Control

Claude Code as Main Coding AI

ChatGPT as Chief Architect

Plugin Based Architecture

Enterprise Grade Structure

---

# CHANGE HISTORY

Version 0.1

Repository Created

Folder Structure Created

Documentation Started

Claude Code Installed

Authentication Completed

Sprint 1 Completed — Electron + React + TypeScript + Vite Bootstrap

Sprint 1B Completed — Python Backend Foundation Bootstrap (backend/app, backend/tests, Ruff, Mypy)

Sprint 2 Completed — Desktop Application Shell (Tailwind v4, Theme Manager, VS Code style layout, hardened Electron main/preload)

Sprint 3 Completed — Architecture (docs/ARCHITECTURE.md), Database Design (docs/DATABASE_SCHEMA.md), AI Agent Workflow (docs/AGENTS_OVERVIEW.md) finalized; Dashboard module implemented with real content

Sprint 4 Completed — Backend finalized as FastAPI + Uvicorn; Electron ↔ Python process integration live (spawn, health-poll, graceful shutdown); SQLite DAL implemented (schema + LogsRepository); centralized logging and consistent error handling added; StatusBar wired to real backend health

Sprint 5 Completed — Filesystem ownership locked as Electron main (not Python); real Project Explorer with File Create/Rename/Delete/Open/Save; real-time filesystem watching via chokidar (Windows short-path libuv crash found and fixed); backend /logs API (GET+POST); real Logger Panel; file-operation audit logging; Dashboard New/Open Project buttons made real

---

# NEXT MILESTONE

Sprint 6

Repositories/business logic for the `projects` table — the natural next step now that projects are opened for real; would let recently-opened projects be tracked server-side instead of only in localStorage

Backend stdout/stderr surfaced in the Logger Panel (currently console-only)

Python runtime bundling strategy for packaged/distributed builds (still assumes `python` on PATH)

---

# IMPORTANT

Every AI must read this file before doing any work.

This file is the permanent memory of the project.

Never ignore this document.