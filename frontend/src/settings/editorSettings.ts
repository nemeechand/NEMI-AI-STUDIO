const AUTO_SAVE_KEY = 'nemi.editor.autoSave';
const WORD_WRAP_KEY = 'nemi.editor.wordWrap';

type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

/** Off by default — matches VS Code's own default and keeps Ctrl+S
 * meaningful regardless of whether it's enabled. */
export function getAutoSaveEnabled(): boolean {
  return window.localStorage.getItem(AUTO_SAVE_KEY) === 'true';
}

export function setAutoSaveEnabled(enabled: boolean): void {
  window.localStorage.setItem(AUTO_SAVE_KEY, String(enabled));
  notify();
}

/** On by default, matching this app's prior single-file editor's implicit
 * behavior (a plain textarea always wraps). */
export function getWordWrapEnabled(): boolean {
  const stored = window.localStorage.getItem(WORD_WRAP_KEY);
  return stored === null ? true : stored === 'true';
}

export function setWordWrapEnabled(enabled: boolean): void {
  window.localStorage.setItem(WORD_WRAP_KEY, String(enabled));
  notify();
}

export function onEditorSettingsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
