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

docs/ARCHITECTURE.md — locks the layer mapping, Electron process/IPC boundary (`window.electronAPI` only), the Context+Provider+Hook state pattern, and defers backend framework/Electron↔Python transport as open decisions

docs/DATABASE_SCHEMA.md — finalized SQLite table design (projects, tasks, files, agents, memory, logs, settings, history) with columns, keys, indexes and relationships — design only, no implementation yet

docs/AGENTS_OVERVIEW.md — consolidates the 8 agent roles from agents/*.md into one pipeline diagram and approval-gate reference

docs/PRODUCT_VISION.md reviewed for consistency against all other docs — confirmed complete, no changes required

Dashboard module (frontend/src/components/dashboard/): Dashboard, DashboardCard, WelcomeHeader, QuickActionsCard, SprintStatusCard, AITeamCard, TechStackCard, dashboardData.ts — replaces the "No project opened yet" placeholder with real content (sprint progress, AI team roster, tech stack, quick actions). New Project/Open Project are honest disabled stubs ("Coming Soon") since filesystem project loading isn't implemented yet

Status Bar label updated to "Sprint 3 — Dashboard"

Verified: tsc build, eslint (0 warnings), prettier (clean on all touched files), vite build (renderer + main + preload), pytest (1 passed), ruff check (all checks passed), mypy (no issues), and a live `npm run dev` Electron launch (process stable, no runtime errors)

Sprint 4 — Pending Approval

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

---

# PENDING TASKS

Workflow Design

Dashboard: real filesystem-backed New Project / Open Project actions (currently honest disabled stubs)

Memory Engine

Plugin System

Git Integration

Testing Engine

Build System

Backend API Framework Selection

Electron ↔ Python Process Integration

Real Project Explorer (filesystem-backed, replacing static placeholder tree)

Real Logger Panel (wired to actual log events, replacing static placeholder entries)

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

---

# NEXT MILESTONE

Sprint 4

Select Backend API Framework (per open decision in docs/ARCHITECTURE.md)

Wire Electron ↔ Python Process Integration

Begin real Project Explorer (filesystem-backed, replacing static placeholder tree)

Begin real Logger Panel (wired to actual log events)

---

# IMPORTANT

Every AI must read this file before doing any work.

This file is the permanent memory of the project.

Never ignore this document.