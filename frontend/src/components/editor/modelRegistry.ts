import type { editor as MonacoEditorNS, Uri } from 'monaco-editor';
import { languageForPath } from './languageForPath';

/**
 * A single shared, ref-counted registry of Monaco text models, keyed by
 * file path — not owned per editor group. If the same file is open in both
 * the primary and secondary (split) group, they share one model, so an
 * edit in either pane is immediately visible in the other (matches real
 * Monaco/VS Code behavior; a per-group model map would silently desync the
 * two views of the same file). A model is created on first open and only
 * disposed once every group that opened it has released it — the concrete
 * mechanism behind "no unnecessary memory leaks."
 *
 * This module only ever receives a live `monaco` namespace/model as a
 * parameter from its caller (MonacoEditorPane, which lazy-loads Monaco) —
 * it never imports `monaco-editor` itself at the value level, only as
 * erased-at-compile-time types, so importing this module never pulls
 * Monaco into the main bundle.
 */
interface ModelEntry {
  model: MonacoEditorNS.ITextModel;
  savedContent: string;
  refCount: number;
}

const models = new Map<string, ModelEntry>();

type MonacoNS = typeof import('monaco-editor');

export function getModel(path: string): MonacoEditorNS.ITextModel | null {
  return models.get(path)?.model ?? null;
}

export function acquireModel(
  monaco: MonacoNS,
  path: string,
  content: string,
): MonacoEditorNS.ITextModel {
  const existing = models.get(path);
  if (existing) {
    existing.refCount += 1;
    return existing.model;
  }
  const model = monaco.editor.createModel(content, languageForPath(path), toUri(monaco, path));
  models.set(path, { model, savedContent: content, refCount: 1 });
  return model;
}

export function releaseModel(path: string): void {
  const entry = models.get(path);
  if (!entry) return;
  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    entry.model.dispose();
    models.delete(path);
  }
}

export function markSaved(path: string, content: string): void {
  const entry = models.get(path);
  if (entry) entry.savedContent = content;
}

export function isDirty(path: string): boolean {
  const entry = models.get(path);
  return entry ? entry.model.getValue() !== entry.savedContent : false;
}

function toUri(monaco: MonacoNS, path: string): Uri {
  // A stable, unique URI per path — required so the same path always
  // resolves to the same underlying model identity.
  return monaco.Uri.file(path);
}
