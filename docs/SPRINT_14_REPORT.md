# SPRINT 14 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 14 — Knowledge Graph & AI Memory Engine
Status: Completed
Date: 08 August 2026

---

# GOAL

Enable NEMI AI Studio to remember, connect, search, and reason over every project artifact across time: Persistent AI Memory, a Knowledge Graph linking Projects/Files/Functions/Classes/Agents/Workflows/Commits/Users/Requirements, Semantic Search, Architecture Intelligence (why was this written / where is it used / what will break / who changed it), Code Impact Analysis, Long-term Memory, AI Learning from previous sprints, and Automatic Documentation (architecture diagrams, dependency maps) — preserving every feature from Sprints 1–13, verified with full regression testing.

---

# SCOPING PRINCIPLE

This sprint's brief asks for capabilities with no existing infrastructure to build on — no relationship modeling, no embeddings/vector store, no diagram-generation tooling existed anywhere in the codebase before this sprint. Rather than fabricate any of the more ambitious asks ("AI reasoning" that isn't grounded in real data, a code-impact "prediction" with no underlying model), each was mapped to a real, bounded, transparent mechanism, documented at its point of use: the Knowledge Graph is a relational SQLite schema, not a graph database; code parsing is heuristic regex extraction, not a full AST parser; the risk score in Code Impact Analysis is a stated simple formula, never presented as machine learning; Architecture Intelligence retrieves real context and hands it to the existing AI Chat Panel rather than asking a model to reason unaided; Anthropic is simply absent from the embedding-provider list, since it publishes no embeddings API, rather than mapped to a workaround. This is the same practice established in every prior sprint's verification sections, applied here to feature scoping itself.

---

# COMPLETED TASKS

1. Added three new tables — `graph_nodes`, `graph_edges` (a relational knowledge graph), and `embeddings` (real vectors, JSON-encoded) — via additive `CREATE TABLE IF NOT EXISTS` statements, no changes to any existing table's CHECK constraints.
2. Built `KnowledgeRepository` — idempotent find-or-create `upsert_node()`, idempotent `add_edge()`, reverse-traversal helpers (`edges_to`/`edges_from`), `find_node_by_ref()`, `stats()`, `delete_nodes_not_in()`.
3. Built `FilesRepository` — the schema-ready-since-Sprint-3 `files` table's first real implementation (`upsert()`, `list_for_project()`, `delete_missing()`).
4. Built `backend/app/knowledge/code_parser.py` — heuristic regex extraction of Python/JavaScript/TypeScript function/class declarations and imports; explicitly not a full AST parser, documented as such.
5. Built `backend/app/knowledge/indexer.py::index_project()` — walks the open project's files directly from disk in the backend (a deliberate, scoped exception to Sprint 5's Filesystem Ownership rule — see ARCHITECTURE.md), builds file/function/class nodes and resolved same-project `imports` edges, and records commit/author/`modifies` nodes from git history Electron gathers. Bounded (`MAX_FILES = 3000`, `MAX_PARSE_BYTES = 500 KB`), idempotent, and prunes stale file rows/nodes on re-index.
6. Extended `frontend/electron/git-status.ts` with `getCommitLog()` — one `git log --name-only` call (not N) gathering real commit hash/message/author/date/changed-files.
7. Built `backend/app/ai/embeddings.py` — an `EmbeddingProvider` abstraction (OpenAI, Gemini, Ollama; Anthropic excluded, no embeddings API) parallel to the existing chat-provider abstraction.
8. Built `EmbeddingsRepository` and `backend/app/knowledge/semantic.py` — `gather_candidates()` (real file/memory/workflow content, capped at 150 file candidates), `run_embedding_pass()`, `semantic_search()` (real cosine similarity), and an honest `keyword_search()` fallback.
9. Extended `manager.py` with Persistent AI Memory hooks: `_record_sprint_summary_memory()` (workflow completion → `long_term` entry), a `bug:` entry on permanent task failure, a `fix:` entry when a task succeeds after prior failure(s), and (in `app/api/agents.py`) a `change:` entry plus a `workflow --modifies--> file` graph edge when a Developer task's proposed files are applied.
10. Built `manager.py::_related_past_experience()` — real, cross-project, token-overlap retrieval over recorded memory, injected into the Planner's prompt before goal decomposition (AI Learning).
11. Built `manager.py::_record_knowledge_for_workflow()` — creates `workflow`/`requirement`/`agent` graph nodes and `contains`/`implements`/`executed_by` edges when a workflow's milestones are created.
12. Built `backend/app/knowledge/analysis.py` — `analyze_impact()` (real reverse-graph traversal + a stated, simple risk heuristic), `generate_dependency_diagram()`/`generate_architecture_diagram()` (real Mermaid text), `gather_file_context()` (Architecture Intelligence's real data bundle).
13. Built `backend/app/api/knowledge.py` — the `/knowledge/*` router: `index`, `graph`, `stats`, `embedding-providers`, `embed`, `search`, `impact`, `context`, `diagram`, `memory`.
14. Built `frontend/electron/knowledge-client.ts` — the `window.nemi.knowledge` IPC surface (the twelfth namespace), with a longer, dedicated timeout for the genuinely slow bulk-embedding call.
15. Built `frontend/src/knowledge/` (Context+Provider+Hook) and `frontend/src/components/knowledge/KnowledgePanel.tsx` — a new Sidebar panel: Index Project, real graph stats, Semantic Search (with honest mode labeling), Generate Embeddings, dependency/architecture diagram export as downloadable `.mmd` files.
16. Added a new Monaco editor action, "AI: Explain File History & Impact" (`Ctrl+Shift+Alt+H`), gathering real graph/memory/git context and feeding it into the existing `askAboutSelection()` plumbing.
17. Found and fixed two real issues during implementation/live verification (see below).
18. Ran the full offline suite and live Playwright verification (including a genuine, non-mocked local-Ollama embedding round trip), plus a Sprint 1–13 regression pass.
19. Updated documentation continuously as each piece landed.

---

# BUGS FOUND AND FIXED DURING VERIFICATION

**1. The Python heuristic parser's function/class regexes were capped to 0–3 leading spaces, silently excluding every class method.** `_PY_DEF_RE`/`_PY_CLASS_RE` were originally written as `^\s{0,3}...`, intended to mean "top-level only" — but a standard 4-space method indent inside a class exceeded that cap, so `test_parse_python_extracts_functions_classes_and_imports` (asserting a class method named `get` would be found) failed: only `run_cycle` was extracted, not `get`. This contradicted the parser's own documented behavior ("does not understand scope... still reported as top-level"), which implies any indentation should be scanned. Fixed by changing both regexes to `^[ \t]*...` (any leading whitespace), aligning the implementation with its own stated contract.

**2. Bulk-embedding a real, large project through a local CPU-bound Ollama model took far longer than a single blocking IPC call should reasonably wait for.** Live-tested against this repo's own ~684 indexed files (of which several hundred are eligible languages), the first `POST /knowledge/embed` attempt timed out at 30 seconds, then again after raising the Electron-side timeout to 5 minutes, then again at 10 minutes. This was not a defect in the embedding call itself — a single-text round trip was already fast and unit-tested (`test_ollama_embed_real_round_trip`) — but a genuine, previously-unbounded scale problem: embedding several hundred real files' worth of text sequentially through a local model has a real, large wall-clock cost. Fixed with three changes: (a) capped file-embedding candidates at `MAX_FILE_EMBED_CANDIDATES = 150` in `gather_candidates()` (memory/workflow candidates stay uncapped — they're few and high-value), deterministic and stable across re-runs so the content-hash skip-unchanged optimization keeps repeat runs cheap; (b) reduced `EMBED_BATCH_SIZE` from 64 to 16 texts per provider call, and raised the Ollama embedding provider's own httpx timeout from 60s to 120s (matching `ollama_provider.py`'s existing chat timeout) so each individual batch has a realistic budget on modest hardware; (c) raised the Electron-side timeout for this specific call to 10 minutes (`EMBED_TIMEOUT_MS`), the same "explicit bulk operation" tier as Sprint 13's build/test runners. Re-verified live: a real 5-file subset embedded successfully end-to-end via local Ollama, and the full 684-file repo's *structural* indexing (files/functions/classes/imports/commits — no embedding calls) completed in under 2 seconds, confirming the slowness was specifically the sequential real embedding calls, not indexing itself.

---

# GENERATED FILES

**Backend**
- `backend/app/ai/embeddings.py`
- `backend/app/api/knowledge.py`
- `backend/app/db/repositories/embeddings_repository.py`, `files_repository.py`, `knowledge_repository.py`
- `backend/app/knowledge/__init__.py`, `analysis.py`, `code_parser.py`, `indexer.py`, `semantic.py`
- `backend/tests/test_code_parser.py`, `test_embeddings.py`, `test_indexer.py`, `test_knowledge_api.py`, `test_knowledge_repository.py`, `test_manager_knowledge_hooks.py`, `test_semantic.py`

**Electron**
- `frontend/electron/knowledge-client.ts`

**Frontend**
- `frontend/src/knowledge/knowledge-context.ts`, `KnowledgeProvider.tsx`, `useKnowledge.ts`
- `frontend/src/components/knowledge/KnowledgePanel.tsx`

**Docs**
- `docs/SPRINT_14_REPORT.md` (this file)

---

# MODIFIED FILES

**Backend**
- `backend/app/ai/orchestration/manager.py` — `_related_past_experience()` (AI Learning), `_record_knowledge_for_workflow()` (graph nodes on milestone creation), `_record_sprint_summary_memory()` (long-term memory on completion), `bug:`/`fix:` memory entries on failure/retry-success.
- `backend/app/api/agents.py` — `_record_architecture_change()` on `mark-files-applied` (knowledge memory + `modifies` graph edge).
- `backend/app/api/schemas.py` — Sprint 14 request/response models (`GraphNodeOut`, `GraphEdgeOut`, `KnowledgeGraphOut`, `KnowledgeStatsOut`, `KnowledgeIndexRequest`/`Result`, `EmbeddingProviderOut`, `KnowledgeEmbedRequest`/`Result`, `KnowledgeSearchRequest`/`Result`, `ImpactOut`, `DiagramOut`, `FileContextOut`, `MemoryEntryOut`).
- `backend/app/db/schema.py` — `graph_nodes`, `graph_edges`, `embeddings` tables.
- `backend/app/server.py` — registers the `knowledge` router.

**Electron**
- `frontend/electron/git-status.ts` — `getCommitLog()`.
- `frontend/electron/main.ts` — `knowledge:*` IPC handlers (server-side API-key resolution for embed/search, matching `ai:send-message`'s pattern).
- `frontend/electron/preload.ts` — `window.nemi.knowledge` surface.

**Frontend**
- `frontend/src/App.tsx` — `KnowledgeProvider` added to the provider tree.
- `frontend/src/components/editor/MonacoEditorPane.tsx` — "AI: Explain File History & Impact" editor action.
- `frontend/src/components/layout/AppShell.tsx` — Knowledge sidebar panel wiring, Command Palette entry.
- `frontend/src/components/layout/Sidebar.tsx` — new `'knowledge'` panel + icon.
- `frontend/src/project/pathUtils.ts` — `relativePath()` (inverse of `joinPath()`).
- `frontend/src/types/electron-api.d.ts` — Sprint 14 ambient types; extended `Window.nemi`.

**Docs**
- `docs/ARCHITECTURE.md` — new "KNOWLEDGE GRAPH & AI MEMORY ENGINE (locked — Sprint 14)" section; IPC namespace list updated to twelve namespaces; ten new locked-decision entries; version bumped to 2.1.
- `docs/DATABASE_SCHEMA.md` — three new tables documented; `files` and `memory`'s remaining types documented as newly implemented; version bumped to 1.7.
- `docs/PROJECT_MEMORY.md` — Sprint 14 marked completed with full delivery detail; NEXT MILESTONE rewritten for Sprint 15.

---

# VERIFICATION

## Offline suite

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass (one pre-existing, unrelated `tsconfig.json` formatting warning not touched this sprint) |
| `npm run build` | Pass |
| `pytest` (backend) | 122 passed (36 new), 0 skipped |
| `ruff check` (backend) | All checks passed |
| `mypy` (backend) | No issues, 56 source files |

## Live verification (Playwright-driven `_electron` launches against the built app, real local Ollama, real local git repo, no mocks)

| # | Check | Result |
|---|---|---|
| 1 | App launches, backend ready, this repository opened as the active project | PASS |
| 2 | `POST /knowledge/index` against this repo's real ~684 files: 684 indexed, 696 functions, 85 classes, 20 real commits, 0 errors, completed in ~1.7s | PASS |
| 3 | Real graph stats (`GET /knowledge/stats`) and graph listing (`GET /knowledge/graph`) returned 1,477 real nodes / 2,334 real edges, matching the index result | PASS |
| 4 | `GET /knowledge/impact` for a real file (`manager.py`) correctly found its real dependents (`api/agents.py`, three real test files) via reverse-graph traversal | PASS |
| 5 | `GET /knowledge/diagram?type=dependency` and `type=architecture` returned real Mermaid text derived from real `imports` edges and real directory/workflow structure | PASS |
| 6 | `POST /knowledge/search` with no provider correctly fell back to keyword mode and returned a real, honestly-labeled reason | PASS |
| 7 | A real 5-file subset of this repo was indexed, embedded via local Ollama (`nomic-embed-text`, 5/5 embedded, 0 failed), and semantically searched: an on-topic query ("cosine similarity between vectors") scored its two most relevant real files at ~0.42/0.42 cosine similarity; an intentionally unrelated sanity-check query ("baking chocolate chip cookies") scored the same files lower and in a different order — genuine semantic differentiation | PASS |
| 8 | `GET /knowledge/context` for a real file bundled real graph relationships; `getFileHistorySummary()` returned that file's three real recent commits via `git log --follow` | PASS |
| 9 | Knowledge sidebar panel rendered correctly with live graph stats for the open project | PASS |
| 10 | Full Sprint 1–13 regression: all twelve `window.nemi` IPC namespaces present; Explorer/Workspace/Search/Agents/Knowledge sidebar panels all render; Monaco opens and renders a real file; every backend surface reachable only through the real IPC boundary (a direct renderer `fetch()` was confirmed blocked, proving Sprint 2's CSP is still enforced); the Sprint 13 Intelligence Center still opens cleanly | PASS |

**Verification limitation, stated honestly**: the new "AI: Explain File History & Impact" Monaco editor action was verified at the level of the real IPC calls it depends on (`getFileContext`/`getFileHistorySummary`, both exercised directly above) and via code review of the action's registration, which reuses the exact `askAboutSelection()` plumbing five other editor AI actions already established and verified in Sprint 10 — the action itself was not additionally driven end-to-end through a real right-click/keybinding in this sprint's live pass. Embedding a project at the shipped 150-file cap (rather than the 5-file subset used for the timed live proof) was not itself re-timed to completion in this session — the cap and per-batch timeout tuning are sized from the failure/success data points actually observed (10 minutes insufficient for ~684 candidates at batch-size 64; a 5-file batch at the new batch-size-16/120s-per-batch settings completing well within budget), not from a full 150-file run.

---

# KNOWN ISSUES

- Code parsing is heuristic/regex-based (Python/JS/TS only), not a full AST parser — can miss dynamically-generated declarations or unusual formatting, and does not understand lexical scope.
- Unresolved (external package) imports are not modeled as graph nodes — only same-project files the resolver can locate get an `imports` edge.
- Embedding generation is a single synchronous request with a generous timeout, not yet a cancellable background job — a very large project's full embedding pass can still take several minutes even with the 150-file candidate cap.
- "Requirement" graph nodes are derived 1:1 from a workflow's goal text, since no separate requirements-intake feature exists.
- No in-app Mermaid rendering — dependency/architecture diagrams export as `.mmd` files for use in any standard Mermaid-capable tool.
- Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.

---

# NEXT SPRINT

**Sprint 15** — recommended: code-signing certificate for the installer (still the top Beta blocker), and/or turning embedding generation into a cancellable background job with progress reporting (would remove the remaining wall-clock cap on very large projects).

---

# GIT COMMIT MESSAGE

```
feat(sprint-14): implement knowledge graph & AI memory engine

Enable NEMI AI Studio to remember, connect, search, and reason over
every project artifact across time: a relational Knowledge Graph
(graph_nodes/graph_edges, not a dedicated graph database), Persistent
AI Memory, Semantic Search, Architecture Intelligence, Code Impact
Analysis, AI Learning from previous sprints, and Automatic
Documentation - preserving every feature from Sprints 1-13.

No capability here is simulated: the graph is real SQLite rows built
by a real (heuristic, not AST) code parser; embeddings are real
provider calls with real cosine similarity and an honest keyword
fallback when none are configured; impact analysis is a real
graph traversal plus a stated, simple risk heuristic, never
presented as ML; Architecture Intelligence retrieves real graph/
memory/git context and hands it to the existing AI Chat Panel rather
than asking a model to reason unaided.

Backend: new graph_nodes/graph_edges/embeddings tables. New indexer
(app/knowledge/indexer.py) walks the open project's files directly
from disk in the backend - a scoped, documented exception to Sprint
5's Filesystem Ownership rule for bulk read-only analysis - extracting
functions/classes/imports via a new heuristic parser and linking real
git commit/author history Electron already gathers. memory's four
previously-unused types (long_term/knowledge/project/conversation)
gained real writers: sprint summaries, bugs, fixes, and architecture
changes. New app/ai/embeddings.py (OpenAI/Gemini/Ollama; Anthropic
excluded, no embeddings API) and app/knowledge/semantic.py (real
cosine similarity search with an honest keyword fallback). New
app/knowledge/analysis.py (impact analysis, Mermaid diagram
generation). New /knowledge/* API router.

Electron: new knowledge-client.ts (window.nemi.knowledge, the
twelfth IPC namespace) and git-status.ts::getCommitLog().

Frontend: new knowledge/ Context+Provider+Hook module and a new
Knowledge sidebar panel (index, search, embeddings, diagram export).
A new Monaco editor action, "AI: Explain File History & Impact",
feeds real gathered context into the existing askAboutSelection()
plumbing.

Found and fixed two real issues: (1) a parser regex capped to 0-3
leading spaces silently excluded every class method - caught by a
unit test, fixed to match any indentation per the parser's own
documented scope limitation. (2) Bulk-embedding this repo's own
~684 real files through local Ollama was found live to need far
longer than a blocking call should wait - not a defect in the
embedding call itself, but a genuine unbounded-scale problem - fixed
with a 150-file candidate cap, smaller provider batches, and longer,
explicit-bulk-operation timeouts; re-verified live against both the
full real repo (structural indexing, seconds) and a real file subset
(embeddings + semantic search, genuinely differentiated relevance).

Verified: full offline suite (tsc/eslint/prettier/build, backend
pytest - 122 passed incl. 36 new, no skips/ruff/mypy - 56 source
files) plus live Playwright verification against this repo itself at
full scale, a real embeddings/semantic-search round trip, and a full
Sprint 1-13 regression pass confirming all twelve IPC namespaces and
every panel still work, each reproduced clean.

Update docs/ARCHITECTURE.md (new KNOWLEDGE GRAPH & AI MEMORY ENGINE
section, ten new locked decisions, version 2.1), docs/DATABASE_SCHEMA.md
(three new tables, files/memory's remaining implementation, version
1.7), and docs/PROJECT_MEMORY.md; add docs/SPRINT_14_REPORT.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
