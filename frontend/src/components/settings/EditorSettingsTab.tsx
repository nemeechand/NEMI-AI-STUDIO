import { useState } from 'react';
import {
  getAutoSaveEnabled,
  getWordWrapEnabled,
  setAutoSaveEnabled,
  setWordWrapEnabled,
} from '../../settings/editorSettings';

export function EditorSettingsTab() {
  const [autoSave, setAutoSave] = useState(getAutoSaveEnabled);
  const [wordWrap, setWordWrap] = useState(getWordWrapEnabled);

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">Editor</h3>
      <div className="space-y-2">
        <label className="flex items-center justify-between text-sm text-fg">
          Auto Save
          <input
            type="checkbox"
            checked={autoSave}
            onChange={(event) => {
              setAutoSave(event.target.checked);
              setAutoSaveEnabled(event.target.checked);
            }}
          />
        </label>
        <label className="flex items-center justify-between text-sm text-fg">
          Word Wrap
          <input
            type="checkbox"
            checked={wordWrap}
            onChange={(event) => {
              setWordWrap(event.target.checked);
              setWordWrapEnabled(event.target.checked);
            }}
          />
        </label>
      </div>
    </div>
  );
}
