# SPRINT_RULES.md

Version: 1.0

---

# PURPOSE

This document defines the mandatory workflow for every sprint in NEMI AI STUDIO.

Every AI agent must follow these rules.

No exceptions.

---

# GENERAL PRINCIPLES

Every sprint must be:

- Production Ready
- Modular
- Clean Architecture
- Fully Documented
- Tested
- Verified
- Reversible

Never rush.

Quality is more important than speed.

---

# BEFORE STARTING A SPRINT

Claude must:

1. Read all documentation inside docs/
2. Read all agent files inside agents/
3. Read PROJECT_MEMORY.md
4. Understand current sprint status
5. Never assume requirements
6. Ask questions only if documentation is unclear

---

# DURING DEVELOPMENT

Always:

- Write clean code
- Keep files modular
- Follow Electron best practices
- Follow React best practices
- Follow TypeScript best practices
- Follow Python best practices
- Use TailwindCSS correctly
- Avoid duplicated code
- Keep functions small
- Use descriptive naming

Never:

- Write business logic outside its module
- Hardcode configuration
- Ignore lint errors
- Ignore type errors
- Leave TODOs without explanation

---

# BEFORE FINISHING A SPRINT

Claude must always run:

TypeScript

- tsc

Lint

- eslint

Formatting

- prettier

Frontend Build

- vite build

Python

- pytest
- ruff
- mypy

Verify Electron launches successfully.

---

# DOCUMENTATION

If project status changed:

Update only:

PROJECT_MEMORY.md

Never modify:

MASTER_SPECIFICATION.md

unless explicitly requested.

---

# REQUIRED REPORT

At the end of every sprint provide:

## Completed Tasks

Detailed list.

## Generated Files

Explain every generated file.

## Modified Files

Explain every modified file.

## Verification

Show:

- Build status
- Lint status
- Tests
- Type check

## Known Issues

List remaining issues.

## Next Sprint

Recommend next sprint.

## Git Commit Message

Suggest one professional commit message.

---

# APPROVAL GATE

After completing a sprint:

STOP.

Wait for explicit approval.

Never continue automatically.

Never start the next sprint without approval.

---

# QUALITY CHECKLIST

Every sprint must satisfy:

✓ Builds successfully

✓ Lint clean

✓ Type safe

✓ No duplicated code

✓ Modular architecture

✓ Secure defaults

✓ Documentation updated

✓ Memory updated

✓ Professional coding standards

---

# NEVER DO

Never:

- Delete user files
- Rewrite Git history
- Force push
- Modify documentation without permission
- Skip verification
- Ignore failed tests
- Ignore lint errors
- Ignore type errors

---

# SUCCESS CRITERIA

A sprint is complete only if:

- Code builds
- Tests pass
- Verification passes
- Documentation updated
- PROJECT_MEMORY updated
- Commit message suggested
- User approval requested

Otherwise,

Sprint is NOT complete.

---

End of File