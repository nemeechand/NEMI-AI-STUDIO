# VERSION READINESS REPORT

Version assessed: 0.1.0-alpha.1
Date: 09 August 2026
Assessed after: Sprint 15.6 — Production Stabilization & Release Readiness

---

## Verdict

**Ready for a controlled Alpha release (internal / trusted-tester
distribution). Not ready for a public, unsigned-installer-averse audience.**

The application is functionally complete through Sprint 15.6, passes its
full offline verification suite (TypeScript, ESLint, Prettier, production
build, backend pytest, ruff, mypy strict) with zero failures, and passes a
27-point live Playwright verification covering startup, the new Health
Center, graceful shutdown, automatic and manual backend recovery, single-
instance enforcement, and a full Sprint 1–15.5 regression pass. The one
disqualifying gap for a *public* release is the unsigned Windows installer
(see below) — everything else is either genuinely solid or a documented,
honestly-scoped limitation rather than a defect.

## What changed this assessment (Sprint 15.6)

A full architectural audit (backend, Electron, frontend, monitoring
surfaces) found and fixed:

- A real resource leak (Gemini's HTTP client never closed).
- A real race condition (the agent-cycle scheduler could double-claim a
  task under an overlapping poll).
- A real shutdown-reliability gap (every quit forcibly killed the Python
  backend mid-operation; now a real graceful shutdown is attempted first).
- A real availability gap (a mid-session backend crash previously required
  a full app relaunch to recover from; now auto-restarts with backoff).
- A real multi-instance gap (launching the app twice silently produced a
  second, backend-less, non-functional window).
- Real version drift across four different places the app's version
  string appeared, three of them already wrong.
- Real stale/fabricated-looking UI (a hardcoded "Sprint 6" label in the
  StatusBar, and a Dashboard card frozen at "Sprint 3" while the project
  was 15+ sprints further along) — both replaced with real, live data.
- A consolidated, non-duplicative Health Center, reusing every existing
  monitoring data source rather than adding a competing dashboard.
- Confirmed-dead code removed (5 unused repository methods/functions, 2
  unused API response schemas).

None of these were cosmetic-only; each was verified against real behavior
(a live process crash-and-recover cycle, a real graceful-shutdown log line
that had never appeared before, a real second-instance launch attempt that
correctly failed to open a second window).

## Go / no-go by audience

| Audience | Verdict | Why |
|---|---|---|
| Internal development / dogfooding | ✅ Go | Already in active use this session (the Financial Advisor CRM validation exercise, Sprints 1–15.6 built and verified with this exact toolchain). |
| Trusted alpha testers (technical, tolerant of an unsigned installer) | ✅ Go | Full verification suite green; known issues are documented and none are silent/undiscovered. |
| Public release via the unsigned installer | ⬜ No-go | Windows SmartScreen will warn every installer. Acceptable for a labeled alpha with informed testers, not for a general audience. |
| Enterprise / regulated environments | ⬜ No-go | No dependency vulnerability scanning, no code-signing, no long-duration soak testing, no multi-user concurrent-access testing performed. |

## Confidence by subsystem

- **Backend core (FastAPI, SQLite, providers)**: High. 168 backend tests
  passing, strict mypy, ruff clean, and this sprint's audit found only
  low-severity dead code beyond the fixed items above.
- **Electron process lifecycle**: High, as of this sprint. Was previously
  the weakest area (no crash recovery, abrupt shutdown, no single-instance
  guard) — now directly addressed and live-verified.
- **AI Provider Management (7 providers)**: High. Sprint 15.5's own
  26-point live verification plus this sprint's regression pass both green.
- **Autonomous Coding Engine**: Medium-high. Deterministically correct at
  the API layer (extensive backend test coverage); live end-to-end success
  depends on the AI model's own output quality, which is inherently
  probabilistic and outside this app's control — documented honestly in
  `KNOWN_ISSUES.md`, not treated as a defect.
- **Knowledge Graph / performance at scale**: Medium. Correct and verified
  at this repo's own real scale (~2,000 files, 1,477+ graph nodes); not
  stress-tested against a purpose-built 10,000+ file synthetic project this
  sprint (see `PRODUCTION_CHECKLIST.md`'s Performance section).
- **Packaging**: Medium-high. Config verified correct and complete except
  for code-signing, which is a known, explicit, unresolved gap — not an
  oversight.

## Recommendation

Ship Sprint 15.6 as `0.1.0-alpha.1` (unchanged version number — this sprint
is stabilization of existing functionality, not a new user-facing feature
set) to the existing alpha-testing audience. Treat code-signing acquisition
as the single highest-priority item before considering any wider
distribution. Everything else in `KNOWN_ISSUES.md` is a reasonable backlog
for Sprint 16 and beyond, not a release blocker for the intended alpha
audience.
