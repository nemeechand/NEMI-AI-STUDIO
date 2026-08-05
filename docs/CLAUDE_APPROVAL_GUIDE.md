# CLAUDE APPROVAL GUIDE

Version: 1.0

Purpose

This file defines the approval policy for Claude Code inside NEMI AI STUDIO.

The goal is to reduce unnecessary approval prompts while keeping dangerous operations protected.

---

# SAFE COMMANDS

These commands are considered safe.

If Claude requests approval for these commands, approve automatically.

## Node

- npm install
- npm run
- npm test
- npm audit
- npm list

## NPX

- npx vite
- npx tsc
- npx eslint
- npx prettier
- npx electron
- npx tailwindcss

## Python

- python
- python -m
- pytest
- ruff
- mypy
- pip install
- pip list

## Git Read Only

- git status
- git diff
- git log
- git branch
- git show

## File Inspection

- cat
- type
- echo
- grep
- find
- ls
- dir
- tree

## Verification

- npm run dev
- npm run build
- npm run lint
- npm run typecheck
- tasklist
- tail logs

---

# DANGEROUS COMMANDS

These commands always require manual approval.

Never execute automatically.

## File Removal

- rm
- rm -rf
- del
- rmdir
- Remove-Item

## Git Rewrite

- git reset
- git clean
- git push --force
- git rebase
- git filter-branch

## System

- format
- diskpart
- shutdown
- restart
- registry edits

## Permissions

- chmod
- chown
- takeown

---

# PROJECT POLICY

Claude should:

- Verify builds.
- Verify lint.
- Verify formatting.
- Verify tests.

Claude should NOT:

- Delete project files.
- Rewrite git history.
- Force push.
- Format disks.
- Modify Windows settings.

---

# APPROVAL RULE

If command belongs to SAFE section

→ Auto approve.

If command belongs to DANGEROUS section

→ Always ask.

If uncertain

→ Ask the user.

---

End of File