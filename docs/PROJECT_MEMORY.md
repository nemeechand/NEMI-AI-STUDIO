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

Sprint 5 — Pending Approval

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

---

# PENDING TASKS

Workflow Design

Dashboard: real filesystem-backed New Project / Open Project actions (currently honest disabled stubs)

Memory Engine

Plugin System

Git Integration

Testing Engine

Build System

Python runtime bundling for packaged/distributed builds (currently assumes `python` on PATH — dev-mode only)

Repositories/business logic for the remaining 7 tables (projects, tasks, files, agents, memory, settings, history) — schema exists, repositories deferred to the sprints that need them

Real Project Explorer (filesystem-backed, replacing static placeholder tree)

Real Logger Panel (wired to the backend's logs table, replacing static placeholder entries — backend now has real logs to show)

Resizable/drag panel splitters (sidebar and logger panel are currently show/hide toggles only)

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

---

# NEXT MILESTONE

Sprint 5

Real Project Explorer (filesystem-backed, replacing static placeholder tree) — natural next step now that a backend exists to read the filesystem through

Real Logger Panel (wired to the backend's logs table via a new IPC endpoint, replacing static mock entries)

Projects repository + "New Project" / "Open Project" Dashboard actions (currently honest disabled stubs)

---

# IMPORTANT

Every AI must read this file before doing any work.

This file is the permanent memory of the project.

Never ignore this document.