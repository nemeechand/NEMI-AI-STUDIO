# SPRINT 10 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 10 — AI Chat & Agent Framework
Status: Completed
Date: 08 August 2026

---

# GOAL

Implement the AI layer reserved since Sprint 6: an AI Chat Panel (right sidebar) with streaming responses, conversation history, a real provider abstraction over four backends (OpenAI, Claude/Anthropic, Gemini, Ollama — no mock providers, no placeholder implementations), context-aware chat using the active workspace, project indexing, file references, code-selection-to-Ask-AI, Explain/Fix/Generate/Refactor Code, AI actions from the editor context menu, a token usage indicator, cancellation support, error handling, and conversation persistence — while preserving all Sprint 1–9 functionality, verified with full regression testing.

---

# COMPLETED TASKS

1. Extended `backend/app/db/schema.py` with `ai_conversations`/`ai_messages` — normalized tables, not entries shoehorned into the generic `memory` table (see docs/DATABASE_SCHEMA.md for the full rationale), plus `ConversationsRepository`/`MessagesRepository`.
2. Built `backend/app/ai/` — a real `AIProvider` implementation per backend, each verified against the actually-installed SDK version's API surface (inspected directly, not recalled from memory) before writing the integration: `openai`, `anthropic`, `google-genai` official async SDKs, and a plain `httpx`-based client for Ollama's local `/api/chat` (no SDK exists or is needed for a local server). SDK exceptions normalized into shared `ProviderError` subclasses.
3. Built `backend/app/api/ai.py` — provider list, live Ollama model list, conversation CRUD, and a Server-Sent-Events streaming endpoint (`POST /ai/conversations/{id}/messages/stream`) that always persists both the user message and the assistant's response, including partial content on cancellation or error, never only on success.
4. Installed and verified all three cloud SDKs plus `httpx` against the actually-running Python 3.14 environment — clean install, no version conflicts.
5. Installed Ollama and pulled a small local model (`qwen2.5:0.5b`) specifically so at least one provider could be exercised with genuine, non-mocked, live network calls throughout development and verification — not just unit-tested against SDK contracts.
6. Built Electron's credential layer: `ai-credentials.ts` (encrypts API keys with `safeStorage`, persists only in `app.getPath('userData')`, never in SQLite — upholding docs/DATABASE_SCHEMA.md's pre-existing "no column stores secrets" convention) and `ai-client.ts` (conversation CRUD relay + the streaming fetch/SSE-parse/AbortController-cancellation relay, re-emitted to the renderer as `ai:stream-event` push events on the same pattern `fs:changed` already established).
7. Wired the full `window.nemi.ai.*` IPC surface (`main.ts`, `preload.ts`, `electron-api.d.ts`).
8. Built `frontend/src/ai/` (Context+Provider+Hook) and `frontend/src/components/chat/` (Chat Panel, message list with a dependency-free Markdown-lite renderer, provider/model selector, token usage indicator, conversation history list, chat input with an `@file` fuzzy-reference picker built on Sprint 9's `listAllFiles`).
9. Added the AI Chat Panel as a new right-sidebar region in `AppShell.tsx`, toggleable via a header button, `Ctrl+Shift+A`, and a Command Palette entry.
10. Registered five AI actions on the Monaco editor (`editor.addAction()`): Ask About Selection, Explain Code, Fix Code, Refactor Code, Generate Code — each with a context-menu entry and an explicit keybinding.
11. Added a Settings modal "AI Providers" section for entering/removing API keys, live-reflecting configured state via `safeStorage`.
12. Extended `ProjectContext` with `projectId` (the database UUID — previously only the filesystem `projectPath` was exposed) so AI conversations can be scoped by the real `ai_conversations.project_id` foreign key.
13. Found and fixed four real bugs during live verification (see below) — each caught by testing against a real local model, not a mock.
14. Ran the full offline suite and four live Playwright suites (two AI-focused, one full Sprint 1–9 regression, one packaged-app spot-check), each reproduced clean on at least two consecutive fully-reset runs.
15. Updated documentation continuously as each piece landed.

---

# BUGS FOUND AND FIXED DURING VERIFICATION

Each of these was caught by this sprint's own live-verification suite — specifically because a real local Ollama model was available to test against, not a mock — and each is a direct blocker of a stated Sprint 10 acceptance criterion.

**1. Provider/conversation lists permanently empty on a fresh launch.** `AiProvider.tsx`'s initial `listProviders()`/`listConversations()` fetches fired once on mount with no retry. On a genuinely fresh app launch, this races the backend's own startup time (up to ~15–20s for the dev `python -m app.main` cold start) — reproduced live: the very first mount's fetch failed with `TypeError: fetch failed` because the backend wasn't listening yet, and nothing ever re-triggered it, leaving the provider dropdown empty for the entire session even though the backend came up moments later. Fixed with a bounded retry (`fetchWithStartupRetry`, 10 attempts × 1.5s, matching `backend-process.ts`'s own `STARTUP_TIMEOUT_MS`).

**2. Cancelling before the first chunk arrives persisted an empty "complete" message instead of "cancelled".** The streaming endpoint's disconnect check (`await request.is_disconnected()`) only ever runs between two already-yielded provider chunks. Cancelling while still awaiting the *first* token — confirmed live and reproducible against the fast local Ollama model — delivers `GeneratorExit` at that suspension point, skipping the check entirely; `status` stayed at its initial `"complete"` default, and an empty response was persisted as if it had succeeded. Fixed by re-checking disconnection state unconditionally inside a `finally` block, which runs regardless of how the generator was torn down.

**3. Sending with Ollama selected but no model chosen failed silently.** Unlike the cloud providers, Ollama has no stable model catalog to hardcode a default from — `selectedModel` starts as an empty string whenever Ollama is the (default) provider and the user hasn't yet picked one from the asynchronously-loaded local model list. Reproduced live: triggering the "Explain Code" editor action auto-sent a message with `model: ""`, which the backend correctly rejected with a 422 validation error — but nothing in the UI surfaced this, because `doSend()`'s `createConversation()` call had no `try/catch`, so the rejection became an unhandled promise rejection and the chat panel just did nothing visible. Fixed two ways: (a) auto-select the first locally-available Ollama model once the real list loads, and (b) wrap the entire send flow in proper error handling so any remaining failure surfaces via the visible `lastError` state instead of failing silently.

**4. Monaco's right-click context menu cannot be reliably automated by Playwright in this Electron build.** Confirmed directly, not assumed: neither a real right-click at exact rendered-line coordinates (verified against the actual bounding box) nor Monaco's own F1 Quick Command opened anything. This is the same category of canvas/DOM-overlay automation limitation already documented for Monaco in Sprint 9. Rather than leave the AI editor actions verifiable only by code inspection, each of the five actions was given an explicit keybinding (`Ctrl+Shift+Alt+<letter>` — deliberately unusual to avoid colliding with any of `editor.all.js`'s own defaults, e.g. plain `Shift+Alt+F` is "Format Document") — genuine keyboard-accessible UX, and the actual path live verification now exercises end-to-end.

---

# GENERATED FILES

**Backend**
- `backend/app/ai/__init__.py`, `types.py`, `errors.py`, `registry.py`
- `backend/app/ai/providers/__init__.py`, `base.py`, `openai_provider.py`, `anthropic_provider.py`, `gemini_provider.py`, `ollama_provider.py`
- `backend/app/db/repositories/ai_conversations_repository.py`, `ai_messages_repository.py`
- `backend/app/api/ai.py`
- `backend/tests/test_ai_api.py`

**Electron**
- `frontend/electron/ai-credentials.ts`, `ai-client.ts`

**Frontend**
- `frontend/src/ai/ai-context.ts`, `AiProvider.tsx`, `useAi.ts`, `providerDefaults.ts`
- `frontend/src/components/chat/ChatPanel.tsx`, `MessageList.tsx`, `MessageBubble.tsx`, `MarkdownLite.tsx`, `ChatInput.tsx`, `ProviderSelector.tsx`, `TokenUsageIndicator.tsx`, `ConversationHistoryList.tsx`
- `frontend/src/components/settings/AiProviderSettings.tsx`

**Docs**
- `docs/SPRINT_10_REPORT.md` (this file)

---

# MODIFIED FILES

**Backend**
- `backend/app/db/schema.py` — `ai_conversations`/`ai_messages` tables.
- `backend/app/server.py` — registered the `ai` router.
- `backend/app/api/schemas.py` — `Ai*` Pydantic schemas.
- `backend/requirements.txt` — `openai`, `anthropic`, `google-genai`, `httpx` (moved from dev-only to runtime).

**Electron**
- `frontend/electron/main.ts` — `ai:*` IPC handlers.
- `frontend/electron/preload.ts` — `window.nemi.ai` surface.
- `frontend/src/types/electron-api.d.ts` — `Ai*` ambient types.

**Frontend**
- `frontend/src/App.tsx` — `AiProvider` added to the provider tree.
- `frontend/src/project/project-context.ts`, `ProjectProvider.tsx` — added `projectId`.
- `frontend/src/components/layout/AppShell.tsx`, `HeaderToolbar.tsx` — AI Chat Panel right-sidebar region, toggle, keyboard shortcut, Command Palette entries.
- `frontend/src/components/editor/MonacoEditorPane.tsx` — five AI editor actions with keybindings.
- `frontend/src/components/settings/SettingsModal.tsx` — AI Providers section, scrollable modal body.

**Docs**
- `docs/ARCHITECTURE.md` — new "AI CHAT & AGENT FRAMEWORK (locked — Sprint 10)" section resolving the AI Chat Panel half of Sprint 6's reservation; IPC namespace, Presentation Layer, AI Layer, and Data Layer sections updated; six new locked-decision entries; version bumped to 1.7.
- `docs/DATABASE_SCHEMA.md` — `ai_conversations`/`ai_messages` table definitions, relationships, implementation status; version bumped to 1.3.
- `docs/PROJECT_MEMORY.md` — Sprint 10 marked completed with full delivery detail.

---

# VERIFICATION

## Offline suite

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass (excluding one pre-existing, untouched-this-sprint `tsconfig.json` formatting issue) |
| `npm run build` | Pass |
| `pytest` (backend) | 37 passed (13 new, including a live end-to-end test against the real local Ollama model — skipped gracefully via `pytest.mark.skipif` if Ollama isn't present, never mocked) |
| `ruff check` (backend) | All checks passed |
| `mypy` (backend) | No issues, 40 source files |
| `npm run dist:win` (full packaged build, new heavy SDK dependencies) | Pass — PyInstaller bundled `openai`/`anthropic`/`google-genai`/`httpx` cleanly, NSIS installer + portable exe produced |

## Live verification (Playwright-driven, fresh Electron profile per run)

Four suites, each reproduced clean on at least two consecutive fully-reset runs.

**Core AI suite — 14/14** (real streaming against the live local Ollama model, no mocks):

| # | Check | Result |
|---|---|---|
| 1–2 | Backend healthy, AI Chat Panel visible | PASS |
| 3–4 | Provider dropdown lists all 4 real providers, Ollama + model selectable | PASS |
| 5–8 | Real streaming starts and completes, reply contains the real model output, token usage indicator shows a real count | PASS |
| 9 | New conversation appears in history list | PASS |
| 10–11 | Cancel mid-stream, cancellation reflected correctly in the transcript | PASS |
| 12 | Conversation history survives an app reload | PASS |
| 13 | Missing API key (OpenAI, no key configured) surfaces as a visible, graceful error | PASS |

**Secondary suite — 14/14** (Settings, editor AI actions, file references):

| # | Check | Result |
|---|---|---|
| 2–6 | Settings AI Providers section renders; Ollama shows "no key required"; a fake OpenAI key round-trips through real `safeStorage` encryption (save shows "Configured", clear removes it) | PASS |
| 7–11 | Editor opens a file; AI Chat Panel explicitly hidden, then the "Explain Code" keybinding re-opens it and auto-sends a real request that completes with a real reply mentioning the attached file | PASS |
| 12–13 | `@file` reference picker shows a real fuzzy-matched result; selecting it adds a visible attachment chip | PASS |

**Full Sprint 1–9 regression — 18/18**:

| # | Check | Result |
|---|---|---|
| 1–6 | Backend health, StatusBar tooltip, Logger backend-sourced rows, Explorer list/expand, Workspace Manager | PASS |
| 7–11 | Monaco opens a file, TypeScript syntax highlighting active, multi-tab, dirty indicator + Ctrl+S save, Split Editor | PASS |
| 12–14 | Quick Open, Command Palette (and it lists the new AI commands alongside existing ones), Global Search finds a real match | PASS |
| 17 | AI Chat Panel remains present and functional throughout, coexisting with every other panel | PASS |

**Packaged-app spot-check (freshly built `npm run dist:win`, bundled PyInstaller backend) — 6/6**:

| # | Check | Result |
|---|---|---|
| 1–3 | Packaged backend healthy, AI Chat Panel renders, all 4 providers listed (proves the new SDKs bundled correctly by PyInstaller) | PASS |
| 4–5 | A real streaming request against the local Ollama model starts and completes from the *packaged* backend | PASS |

**Verification limitation, stated honestly**: only Ollama could be exercised with genuine live network calls in this environment — no OpenAI, Anthropic, or Gemini API keys were available. Those three providers' request/response mapping and error-normalization logic were verified by directly inspecting each SDK's actually-installed API surface (method signatures, exception classes, response field names — confirmed via runtime introspection, not recalled from memory) before writing the integration, and by a non-network unit test exercising the real `MissingApiKeyError` code path. A live call to each cloud provider has not been performed. Recorded here rather than overclaimed, matching this project's established practice.

---

# KNOWN ISSUES

- Only Ollama has been live-tested end-to-end; OpenAI/Anthropic/Gemini are implemented and unit-verified but not live-called (see verification limitation above).
- Multi-agent orchestration (Planner/Developer/Reviewer/Tester per `agents/*.md`) is not implemented — this sprint delivers the chat/provider/context foundation those would run on top of, not the agents themselves, per MASTER_SPECIFICATION's AI AGENTS section.
- "Project indexing" is a real, live file-tree/manifest lookup (reusing Sprint 9's `listAllFiles`), not a semantic/embedding-based vector index — that would need its own embedding-model and vector-store infrastructure, a reasonable candidate for a future sprint, not fabricated now.
- Monaco's right-click context menu cannot be reliably automated by Playwright in this environment (worked around via keybindings, see bug #4 above) — a pre-existing category of limitation, not new to this sprint.
- Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

---

# NEXT SPRINT

**Sprint 11** — recommended: code-signing certificate for the installer (still the top Beta blocker), and/or begin agent orchestration (Planner/Developer/Reviewer/Tester) against the provider/context foundation this sprint built.

---

# GIT COMMIT MESSAGE

```
feat(sprint-10): implement AI chat & agent framework foundation

Implement the AI layer reserved since Sprint 6: an AI Chat Panel
(right sidebar) with streaming responses, conversation history, a
real four-provider abstraction (OpenAI, Claude/Anthropic, Gemini,
Ollama - no mock providers), context-aware chat using the active
workspace, project indexing via Sprint 9's file listing, file
references (@file), code-selection-to-Ask-AI, Explain/Fix/Generate/
Refactor Code, AI actions from the editor context menu (plus explicit
keybindings), a token usage indicator, cancellation support, error
handling, and conversation persistence.

Backend: backend/app/ai/ - one AIProvider per backend, each verified
against its actually-installed SDK version before writing the
integration (openai/anthropic/google-genai official async SDKs;
Ollama via httpx against its local /api/chat, no SDK needed). New
ai_conversations/ai_messages tables (normalized, not shoehorned into
the generic memory table - see docs/DATABASE_SCHEMA.md) with
repositories. New SSE streaming endpoint that always persists both
sides of the exchange, including partial content on cancellation.

Electron: API keys encrypted with safeStorage, persisted only in
userData, never in SQLite (upholds the existing "no column stores
secrets" convention) and never sent anywhere except attached to the
one backend request that needs it, which never persists it. New
window.nemi.ai.* IPC surface, streaming relayed as ai:stream-event
push events on the same pattern fs:changed already established.

Frontend: new ai/ Context+Provider+Hook and components/chat/ (Chat
Panel, dependency-free Markdown-lite renderer, provider/model
selector, token usage indicator, conversation history, @file
fuzzy-reference picker). Five AI actions registered on the Monaco
editor. Settings gained an AI Providers section. ProjectContext
extended with projectId (previously only projectPath was exposed) so
conversations scope correctly by the real foreign key.

Found and fixed four real bugs during live verification against a
locally-installed Ollama model (installed specifically this sprint so
at least one provider could be tested end-to-end without a paid API
key, not mocked):
1. Provider/conversation list fetches had no retry, permanently
   losing the race against backend startup on a fresh launch. Fixed
   with a bounded retry matching the backend's own startup timeout.
2. Cancelling before the first stream chunk arrived persisted an
   empty "complete" message instead of "cancelled" - GeneratorExit at
   that suspension point skips the loop's own disconnect check. Fixed
   via an unconditional check in a finally block.
3. Sending with Ollama selected but no model chosen (no hardcoded
   default exists for Ollama) failed a 422 validation error silently,
   an unhandled promise rejection. Fixed by auto-selecting the first
   local model once available, plus proper error surfacing throughout
   the send flow.
4. Monaco's right-click context menu cannot be reliably automated by
   Playwright in this Electron build (confirmed, not assumed) - the
   same category of limitation already documented for Monaco in
   Sprint 9. Worked around with real keybindings on all five actions.

Verified: full offline suite (tsc/eslint/prettier/build, backend
pytest - 37 passed incl. 13 new/ruff/mypy) plus four live Playwright
suites (14-point core AI suite with real Ollama streaming, 14-point
secondary suite covering Settings/editor actions/file references,
18-point full Sprint 1-9 regression, 6-point packaged-app spot-check
proving the new SDK dependencies bundle correctly via PyInstaller),
each reproduced clean on at least two consecutive fully-reset runs.

Update docs/ARCHITECTURE.md (new AI CHAT & AGENT FRAMEWORK section,
six new locked decisions), docs/DATABASE_SCHEMA.md (new tables), and
docs/PROJECT_MEMORY.md; add docs/SPRINT_10_REPORT.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
