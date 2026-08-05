# AGENTS_OVERVIEW.md

Version: 1.0
Status: Finalized (Sprint 3)

---

# PURPOSE

This document consolidates the eight AI agent roles defined
individually in `agents/*.md` into a single reference: what each
agent does, when it runs, and how they hand work to one another. It
does not replace the individual agent files — those remain the
authoritative, detailed definition of each role. This document is the
map of how they connect.

---

# THE ROSTER

| Agent | File | Never Does | Primary Output |
|---|---|---|---|
| Architect | `agents/architect.md` | Write code | Architecture Analysis + Approval Status |
| Planner | `agents/planner.md` | Write code | Sprint Breakdown + Priority Tasks |
| Developer | `agents/developer.md` | Change architecture without approval | Working implementation |
| Reviewer | `agents/reviewer.md` | Implement features | Approval / Rejection verdict |
| Tester | `agents/tester.md` | Modify production code | Pass/Fail test report |
| Debugger | `agents/debugger.md` | Create new features | Root cause + fix |
| Documentation | `agents/documentation.md` | Invent features | Updated docs |
| Release Manager | `agents/release_manager.md` | Release unstable software | Go/No-Go decision |

---

# STANDARD PIPELINE

This is the same workflow codified in `docs/SYSTEM_PROMPT.md` and
`docs/AI_OPERATING_MANUAL.md`, expressed as agent handoffs:

```
Founder / User request
        │
        ▼
   Architect ──── understands project, flags risks, never writes code
        │  (approved)
        ▼
   Planner ──── breaks work into sprints/tasks, never writes code
        │  (approved sprint)
        ▼
   Developer ──── implements only the approved sprint tasks
        │
        ▼
   Reviewer ──── approves / rejects; never implements features itself
        │  (approved)
        ▼
   Tester ──── validates behavior; never modifies production code
        │  (passed)
        ▼
   Documentation ──── updates PROJECT_MEMORY.md and related docs
        │
        ▼
   Release Manager ──── go/no-go, only at actual release points
```

`Debugger` enters the pipeline out of band, whenever a bug is
reported against already-implemented work — it reproduces, finds
root cause, and fixes, then hands back to Reviewer/Tester the same
as a normal change.

In this project, one AI (Claude Code) plays all roles in sequence
within a single sprint, switching mode explicitly per
`docs/AI_OPERATING_MANUAL.md`'s five Operating Modes (Architect,
Planning, Development, Review, Test). The pipeline above describes
the *order and responsibility boundaries* of that mode-switching, not
separate literal processes.

---

# APPROVAL GATES

Per every agent file's "Approval Policy" section, and per
`docs/SPRINT_RULES.md`:

- Architecture cannot proceed to Planning until Architect approves.
- Development cannot start until the Planner's sprint is approved by
  the Founder.
- A sprint is not complete until Reviewer + Tester both pass it.
- Release never happens without Release Manager's explicit checklist
  pass.

These gates are why `docs/SPRINT_RULES.md` requires stopping for
explicit approval after each sprint report, even though within a
sprint the agent roles move through their pipeline without re-asking
at every internal step.

---

# FUTURE: RUNTIME AGENT SYSTEM

MASTER_SPECIFICATION.md lists `agents/` as a top-level runtime folder
and `Agents` as a UI module — meaning these role definitions are
intended to eventually run as live, orchestrated AI processes (see
`docs/ARCHITECTURE.md` → AI Layer), not only as prompting guides for
Claude Code during development. That runtime implementation is not
started; it depends on AI provider integration and the `agents`
database table (see `docs/DATABASE_SCHEMA.md`), both future sprints.

---

END OF DOCUMENT
