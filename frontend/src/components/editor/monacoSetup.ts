// Statically imports monaco-editor — this module must always be reached via
// a dynamic import() (see MonacoEditorPane.tsx), never a top-level import,
// so Monaco's bundle is code-split out of the initial app load and only
// fetched once a file is actually opened (Sprint 9 performance goal).
//
// Scoped import (not `import * as monaco from 'monaco-editor'`, which pulls
// in every language Monaco ships — abap, sql, ruby, solidity, dozens more —
// ballooning the chunk to 3MB+): the editor core plus exactly the languages
// docs/SPRINT_9_REPORT.md's requirements list. json/css/html/typescript are
// full language services (their own tokenizer + worker). Their `language/*`
// contribution modules only wire up the *rich* side (worker, diagnostics,
// completions) via `monaco.languages.onLanguage(id, ...)` — that callback
// only ever fires once the language id has actually been registered, which
// is the basic-languages module's job (it supplies the Monarch tokenizer
// and calls `monaco.languages.register`). Skipping the basic-languages half
// for javascript/typescript left those ids unregistered: models silently
// fell back to plaintext (single token class, no colors) and the rich half
// never activated either, since its onLanguage hook never fired. So every
// full-language-service pair below needs both imports, not just the rich
// one. markdown/python/yaml/xml have no full language service in Monaco, so
// they use the syntax-highlighting-only basic-languages package alone.
import 'monaco-editor/esm/vs/editor/editor.all.js';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

// JSON's rich contribution self-registers the language id (calls
// `languages.register` directly) — unlike css/html/typescript below, it has
// no separate basic-languages package to pair with.
import 'monaco-editor/esm/vs/language/json/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/css/css.contribution';
import 'monaco-editor/esm/vs/language/css/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/html/html.contribution';
import 'monaco-editor/esm/vs/language/html/monaco.contribution';
import 'monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution';
import 'monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution';
import 'monaco-editor/esm/vs/language/typescript/monaco.contribution';

import 'monaco-editor/esm/vs/basic-languages/markdown/markdown.contribution';
import 'monaco-editor/esm/vs/basic-languages/python/python.contribution';
import 'monaco-editor/esm/vs/basic-languages/yaml/yaml.contribution';
import 'monaco-editor/esm/vs/basic-languages/xml/xml.contribution';

let themesDefined = false;

// Matches frontend/src/index.css's --color-* custom properties so the
// editor doesn't look visually disconnected from the rest of the shell.
export function ensureMonacoThemes(): void {
  if (themesDefined) return;
  themesDefined = true;

  monaco.editor.defineTheme('nemi-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#1e1e1e',
      'editor.foreground': '#cccccc',
      'editorLineNumber.foreground': '#6e6e6e',
      'editorGutter.background': '#1e1e1e',
      'editor.lineHighlightBackground': '#252526',
      'editorCursor.foreground': '#3399ff',
    },
  });

  monaco.editor.defineTheme('nemi-light', {
    base: 'vs',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#ffffff',
      'editor.foreground': '#1e1e1e',
      'editorLineNumber.foreground': '#6e6e6e',
      'editorGutter.background': '#ffffff',
      'editor.lineHighlightBackground': '#f3f3f3',
      'editorCursor.foreground': '#007acc',
    },
  });
}

export { monaco };
