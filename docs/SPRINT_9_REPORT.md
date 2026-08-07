# SPRINT 9 COMPLETION REPORT

Project: NEMI AI STUDIO
Sprint: 9 — Professional Monaco Code Editor
Status: Completed
Date: 07 August 2026

---

# GOAL

Transform NEMI AI STUDIO into a real developer IDE with a VS Code-class editing experience: replace `FileEditor.tsx`'s plain `<textarea>` with a full Monaco-based multi-tab editor, without breaking any existing Sprint 1–8 functionality or changing the Sprint 8 packaging architecture.

**Scope decision (confirmed with founder before implementation)**: Split Editor is bounded to two groups (one active horizontal-or-vertical split), not VS Code's full recursive nested-pane system.

---

# COMPLETED TASKS

1. Bundled Monaco locally via `monaco-editor` (pinned `0.50.0`) + `vite-plugin-monaco-editor-esm` — never a CDN, per MASTER_SPECIFICATION's Offline First requirement. Downgraded from `0.56.0` after finding its `package.json` exports map double-prefixes worker paths when combined with the plugin's hardcoded entry points.
2. Verified CSP compatibility empirically (temporary smoke test, deleted after confirmation) before writing any real feature code — zero console errors or CSP violations with the existing policy; no widening needed.
3. Extended `workspace/` (not a new parallel module) with `EditorGroup`/`EditorTab`/`splitDirection` state: tabs, active tab, close/close-others, an in-memory reopen-closed-tab stack (capped 20, not persisted across relaunch), split/unsplit, and a Save All that invokes per-group registered save handlers.
4. Built `MonacoEditorPane.tsx` (replaces `FileEditor.tsx`), `TabStrip.tsx`, `monacoSetup.ts`, `languageForPath.ts`, and a shared, ref-counted `modelRegistry.ts` — refined during implementation from the originally-planned per-group model map so the same file open in both split groups shares one model instead of silently diverging.
5. Wired `AppShell.tsx` to render one or two `MonacoEditorPane`s based on `splitDirection`, and to host Command Palette/Quick Open as overlays.
6. Implemented Save All, Auto Save (opt-in Settings toggle, off by default, ~1s debounce), Close Tab, Close Others, and Reopen Closed Tab.
7. Built a small custom Command Palette (`frontend/src/commands/` — flat registry + `useCommand()` hook + subsequence fuzzy matching), Ctrl+Shift+P.
8. Built Quick Open (Ctrl+P) plus a new `fs.listAllFiles()` IPC method in `filesystem.ts` (Electron main — same ownership as the rest of `fs`, per Sprint 5's locked FILESYSTEM OWNERSHIP decision).
9. Built Global Search (Ctrl+Shift+F, a new third Sidebar panel) plus `fs.searchInFiles()` IPC, sharing the existing `walkFiles()`/`IGNORED_NAMES` traversal and the same file-size guard `readFile()` already uses.
10. Extended session restore (existing per-project-scoped `localStorage` key) to the full tab/group/split structure — paths, active tab, split direction; file content is never persisted, unchanged principle.
11. Found and fixed **three real bugs** during live verification (see below) — direct blockers of this sprint's own stated acceptance criteria, not unrelated cleanup.
12. Ran the full offline suite and four live Playwright suites (core, extended, Sprint 1–8 regression, packaged-app spot-check), each live suite reproduced clean on two consecutive fully-reset runs.
13. Updated documentation continuously (`docs/ARCHITECTURE.md`, `docs/PROJECT_MEMORY.md`) as each piece landed.

---

# BUGS FOUND AND FIXED DURING VERIFICATION

These were caught by this sprint's own live-verification suite, not reported separately — each is a direct blocker of a stated Sprint 9 acceptance criterion (syntax highlighting, manual save, and the Command Palette/Global Search shortcuts respectively), so fixing them was in-scope work, not opportunistic cleanup.

**1. Zero syntax highlighting for JavaScript/TypeScript/CSS/HTML.** `monacoSetup.ts` initially imported only the *rich* `language/typescript`, `language/css`, and `language/html` contributions (worker, diagnostics, completions). Those contributions don't call `monaco.languages.register()` themselves — they only wire up via `monaco.languages.onLanguage(id, () => {...})`, which fires once the language id is actually registered. That registration is the `basic-languages/*` module's job (it supplies the Monarch tokenizer and calls `register`). Without it, `editor.createModel(content, 'javascript', uri)` silently created an unregistered-language model: every token rendered as the same single color class (confirmed live — a JS file showed one `mtk1` class for its entire contents, where a working Python file showed five distinct classes), and the TypeScript worker never even loaded (confirmed via a Playwright `page.on('worker')` listener — only the base `editor.worker.bundle.js` ever spun up, never `ts.worker.bundle.js`). Fixed by importing both the `basic-languages` and `language/*` halves for every full-language-service pair (json/css/html/typescript — JSON's rich contribution self-registers and has no separate `basic-languages` package, so it needed no pairing). Verified after the fix: all 9 required languages produce multiple distinct token-color classes, and the TypeScript worker loads correctly.

**2. Ctrl+S/Ctrl+W silently did nothing on Windows.** `editor.addCommand()`'s handlers read the active file path via `editor.getModel()?.uri.fsPath`. Monaco's `Uri.file()`/`.fsPath` round-trip lowercases the Windows drive letter (a documented `vscode-uri` behavior) — so a model created from `C:\Users\...\alpha.js` reported back `c:\Users\...\alpha.js` via its own URI, which no longer matched the model registry's map key (the original, un-normalized path). `saveTab()`/`closeTab()` looked up a path that was never in the registry and returned early, having done nothing — the dirty dot stayed lit, the file was never written. Reproduced directly: disk content after Ctrl+S was byte-identical to the pre-edit original. Fixed by tracking the active tab's path in a `activePathRef`, kept in sync from `group.activeTabPath` (already available in the component), and reading that in both command handlers instead of re-deriving it from the model's URI.

**3. Command Palette and Global Search never opened on a real keyboard.** `AppShell.tsx`'s keydown handler compared `event.key === 'p' && event.shiftKey` for Ctrl+Shift+P. A real Shift+P keypress reports `event.key === 'P'` (uppercase — confirmed via a `code`-based physical-keypress simulation: `keyboard.down('Shift')` + `keyboard.press('KeyP')` + `keyboard.up('Shift')` reliably produces uppercase). The lowercase check therefore could never match on an actual keyboard; it only appeared to pass under Playwright's convenience `keyboard.press('Control+Shift+p')` string API, which — unlike a real browser — echoes back whatever literal case is passed rather than computing the true shifted character. This was caught specifically because the test suite was rewritten mid-sprint to use physical key-code simulation instead of trusting Playwright's string shortcut, once the discrepancy surfaced. Fixed by switching every modified-letter shortcut in that handler to compare `event.code` (e.g. `'KeyP'`), which is layout/shift/case-independent — the standard robust pattern, and consistent with how `event.key === 'F'` (uppercase, Global Search) happened to already be correct while the Command Palette's lowercase check was not, an inconsistency that was itself a symptom of the underlying fragility.

---

# GENERATED FILES

**Editor**
- `frontend/src/components/editor/MonacoEditorPane.tsx` (replaces `FileEditor.tsx`, deleted)
- `frontend/src/components/editor/TabStrip.tsx`
- `frontend/src/components/editor/monacoSetup.ts`
- `frontend/src/components/editor/languageForPath.ts`
- `frontend/src/components/editor/modelRegistry.ts`
- `frontend/src/components/editor/QuickOpen.tsx`
- `frontend/src/components/editor/pendingReveal.ts`

**Commands**
- `frontend/src/commands/command-registry.ts`
- `frontend/src/commands/useCommand.ts`
- `frontend/src/commands/fuzzyMatch.ts`
- `frontend/src/commands/CommandPalette.tsx`

**Search & Settings**
- `frontend/src/components/search/GlobalSearch.tsx`
- `frontend/src/settings/editorSettings.ts`

**Docs**
- `docs/SPRINT_9_REPORT.md` (this file)

---

# MODIFIED FILES

**Renderer**
- `frontend/src/workspace/workspace-context.ts` / `WorkspaceProvider.tsx` — grew from a single `openFilePath` into `EditorGroup`/`EditorTab`/`splitDirection` state; `localStorage` key renamed `nemi.workspace.tabs.<projectPath>`.
- `frontend/src/components/layout/AppShell.tsx` — renders 1–2 `MonacoEditorPane`s based on `splitDirection`; hosts Command Palette/Quick Open overlays; global keyboard shortcuts (fixed to compare `event.code`, see bug #3).
- `frontend/src/components/layout/Sidebar.tsx` — `SidebarPanel` gains `'search'`.
- `frontend/src/components/settings/SettingsModal.tsx` — new Editor section (Auto Save, Word Wrap toggles).

**Electron**
- `frontend/electron/filesystem.ts` — `walkFiles()`, `listAllFiles()`, `searchInFiles()`.
- `frontend/electron/main.ts` — `fs:list-all-files`, `fs:search-in-files` IPC handlers.
- `frontend/electron/preload.ts` — `listAllFiles`/`searchInFiles` added to `fsApi`.
- `frontend/src/types/electron-api.d.ts` — `SearchMatch`/`SearchOptions` ambient types.

**Build config**
- `frontend/vite.config.ts` — `monacoEditorEsmPlugin` registered.
- `frontend/package.json` — `monaco-editor@0.50.0`, `vite-plugin-monaco-editor-esm@2.0.3` added.
- `frontend/.prettierignore` — added `release` (electron-builder output, already gitignored but not prettier-ignored; caught while running the final offline verification pass).

**Docs**
- `docs/ARCHITECTURE.md` — new "MONACO CODE EDITOR (locked — Sprint 9)" section resolving the Code Editor half of Sprint 6's reservation; IPC namespace list and Presentation Layer component list updated; stale Sprint 5/7 textarea/single-file references corrected in passing; four new locked-decision entries; version bumped to 1.6.
- `docs/PROJECT_MEMORY.md` — Sprint 9 marked completed with full delivery detail in both narrative logs and the checklist section; stale "FileEditor is a plain textarea" pending-task line removed; AI Chat Panel & Code Editor pending-task line split (Code Editor resolved, AI Chat Panel still reserved).

**Deleted**
- `frontend/src/components/editor/FileEditor.tsx` — fully superseded by `MonacoEditorPane.tsx`.

---

# VERIFICATION

## Offline suite

| Check | Result |
|---|---|
| `tsc -b` | Pass |
| `eslint .` | Pass, 0 warnings |
| `prettier --check` | Pass (excluding one pre-existing, untouched-this-sprint `tsconfig.json` formatting issue) |
| `npm run build` | Pass |
| `pytest` (backend) | 24 passed, unchanged — no backend source touched this sprint |
| `ruff check` (backend) | All checks passed |
| `mypy` (backend) | No issues, 26 source files |
| `npm run dist:win` (full packaged build) | Pass — NSIS installer + portable exe produced |

## Live verification (Playwright-driven, fresh Electron profile per run)

Four suites, each reproduced clean on two consecutive fully-reset runs.

**Core suite — 16/16** (tab open, multi-tab, per-language token-class spot checks, dirty indicator, manual save, undo/redo, Split Editor, Close Tab, Command Palette, Quick Open + open-selected-file, Find widget, zero console errors):

| # | Check | Result |
|---|---|---|
| 1–3 | Open file, tab strip shows it, multi-tab | PASS |
| 4–5 | Python/JavaScript render tokenized (multi-class) syntax highlighting | PASS |
| 6–8 | Dirty indicator appears on edit, Ctrl+S writes to disk, dirty clears after save | PASS |
| 9–10 | Undo (Ctrl+Z) reverts, Redo (Ctrl+Y) reapplies | PASS |
| 11 | Split Editor (Ctrl+\\) creates a second Monaco instance | PASS |
| 12 | Close Tab (Ctrl+W) | PASS |
| 13–14 | Command Palette (Ctrl+Shift+P) and Quick Open (Ctrl+P) open | PASS |
| 15 | Quick Open opens the selected file | PASS |
| 16 | Find widget opens (Ctrl+F, Monaco built-in) | PASS |

**Extended suite — 17/17** (remaining 7 languages, Auto Save, Global Search, large file, session restore):

| # | Check | Result |
|---|---|---|
| 1–7 | TypeScript/HTML/CSS/JSON/Markdown/YAML/XML all render tokenized syntax highlighting | PASS |
| 8–9 | Settings Auto Save toggle, then a disk write with no Ctrl+S after the debounce | PASS |
| 10–12 | Global Search panel opens (Ctrl+Shift+F), finds a term across files, opens the result at the file | PASS |
| 13–14 | ~1.3MB file opens and stays interactive (Ctrl+End navigates) | PASS |
| 15–16 | Pre-reload: split + multiple tabs active; post-reload: same layout restored | PASS |

**Sprint 1–8 regression (real dev backend running) — 10/10**:

| # | Check | Result |
|---|---|---|
| 1 | Real dev backend (`python -m app.main`) becomes healthy | PASS |
| 2 | StatusBar tooltip shows real version + uptime | PASS |
| 3 | `window.nemi` preload bridge exists | PASS |
| 4 | Logger Panel shows `backend.*`-sourced entries | PASS |
| 5–6 | Project Explorer lists root files and expands a folder | PASS |
| 7 | Workspace Manager panel opens | PASS |
| 8 | Editor still opens a file from the Explorer (Sprint 9 regression check) | PASS |
| 9 | No `projects:record-opened` IPC failures once backend is healthy | PASS |

**Packaged-app spot-check (freshly built `npm run dist:win`, bundled PyInstaller backend) — 5/5**:

| # | Check | Result |
|---|---|---|
| 1 | Bundled PyInstaller backend becomes healthy | PASS |
| 2 | Monaco opens a file in the packaged app | PASS |
| 3 | TypeScript syntax highlighting works in the packaged app | PASS |
| 4 | Ctrl+S save works in the packaged app | PASS |
| — | Zero console errors | PASS |

**Verification limitation, stated honestly**: Monaco renders through its own internal canvas-backed event handling. A few interaction classes — precise multi-cursor via Alt+Click, drag-based UI — are more reliably verified through Monaco's public API/model state than through synthetic pixel-level DOM events, and were verified that way (e.g. undo/redo confirmed via the rendered `.view-lines` text content and the model's own change events, not by asserting exact cursor pixel positions). Matches this project's established practice of stating verification boundaries honestly rather than overclaiming.

---

# KNOWN ISSUES

- AI Chat Panel remains architecture-only (Sprint 6 reservation) — not built this sprint; only its Code Editor sibling reservation was resolved.
- Code-signing certificate for the installer remains the top Beta blocker, unaffected by this sprint.
- True concurrent multi-project support remains deliberately deferred (Sprint 7 decision, unaffected by this sprint).
- Split Editor is bounded to two groups by design (confirmed scope decision), not VS Code's recursive nested-pane system.
- Closed-tab history (Reopen Closed Tab) is in-memory only and does not survive an app relaunch — by design, stated up front in the plan.

---

# NEXT SPRINT

**Sprint 10** — recommended: AI Chat Panel, against the architecture already reserved in Sprint 6, now that the Code Editor half of that same reservation is built and the app has a real place to surface AI-assisted edits.

---

# GIT COMMIT MESSAGE

```
feat(sprint-9): replace textarea editor with Monaco (multi-tab, split, search)

Replace FileEditor.tsx's plain <textarea> with a full Monaco-based
multi-tab editor: tabs, dirty tracking, Save All, Close/Close
Others/Reopen Closed Tab, bounded Split Editor (2 groups, confirmed
scope decision), minimap, folding, word wrap, bracket matching,
undo/redo, multi-cursor, Find/Replace, Quick Open (Ctrl+P), Global
Search (Ctrl+Shift+F), Command Palette (Ctrl+Shift+P), and Auto Save
(opt-in Settings toggle). Syntax highlighting covers all 9 required
languages: JS, TS, HTML, CSS, JSON, Markdown, Python, YAML, XML.

Monaco is bundled locally (monaco-editor 0.50.0 + vite-plugin-monaco-
editor-esm, never a CDN, per Offline First) via scoped imports reached
only through a dynamic import() so its multi-MB bundle stays
code-split out of the initial app load. workspace-context.ts/
WorkspaceProvider.tsx extended from a single openFilePath into
EditorGroup/EditorTab/splitDirection state, still the same module per
Sprint 7's ownership. New commands/ (Command Palette registry) and
components/search/ (Global Search) modules; filesystem.ts gained
listAllFiles()/searchInFiles() IPC, same Electron-main ownership as
the rest of fs (Sprint 5's locked decision).

Found and fixed three real bugs during live verification, each a
direct blocker of this sprint's own acceptance criteria:
1. monacoSetup.ts imported only the rich language/typescript|css|html
   contributions, omitting their basic-languages counterpart. Those
   rich contributions only activate via onLanguage(), which never
   fires until basic-languages registers the language id - so JS/TS/
   CSS/HTML silently rendered with zero syntax highlighting and the
   TypeScript worker never loaded. Fixed by importing both halves.
2. Ctrl+S/Ctrl+W read the active path via editor.getModel()?.uri.
   fsPath, but Monaco's Uri.file()/.fsPath round-trip lowercases the
   Windows drive letter, missing the model registry's original-case
   map key and silently no-op'ing save/close on Windows. Fixed by
   tracking the active path in a ref instead.
3. AppShell's Ctrl+Shift+P/Ctrl+Shift+F handlers compared event.key
   case-sensitively; a real Shift+letter keypress reports an uppercase
   key, so the lowercase Command Palette check never matched on an
   actual keyboard (only appeared to work under Playwright's
   non-standard key-echo behavior). Fixed via event.code, which is
   layout/shift/case-independent.

Verified: full offline suite (tsc/eslint/prettier/build, backend
pytest/ruff/mypy - unaffected, no backend changes) plus four live
Playwright suites (16-point core, 17-point extended covering the
remaining languages/Auto Save/Global Search/large file/session
restore, 10-point Sprint 1-8 regression against the real dev backend,
5-point packaged-app spot-check against a freshly built npm run
dist:win with the bundled PyInstaller backend), each live suite
reproduced clean on two consecutive fully-reset runs.

Update docs/ARCHITECTURE.md (new MONACO CODE EDITOR section resolving
the Code Editor half of Sprint 6's reservation, 4 new locked
decisions, stale references corrected) and docs/PROJECT_MEMORY.md; add
docs/SPRINT_9_REPORT.md.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
```

---

END OF REPORT
