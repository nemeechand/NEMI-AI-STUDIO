import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../theme/useTheme';
import { IconButton } from '../common/IconButton';
import { AiProviderSettings } from './AiProviderSettings';
import {
  getAutoSaveEnabled,
  getWordWrapEnabled,
  setAutoSaveEnabled,
  setWordWrapEnabled,
} from '../../settings/editorSettings';

interface SettingsModalProps {
  onClose: () => void;
}

export function SettingsModal({ onClose }: SettingsModalProps) {
  const { theme, setTheme } = useTheme();
  const [autoSave, setAutoSave] = useState(getAutoSaveEnabled);
  const [wordWrap, setWordWrap] = useState(getWordWrapEnabled);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col rounded-lg border border-border bg-surface-elevated shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Settings</h2>
          <IconButton label="Close Settings" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="space-y-4 overflow-y-auto px-4 py-4">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Appearance
            </h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setTheme('dark')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  theme === 'dark'
                    ? 'border-accent bg-accent/10 text-fg'
                    : 'border-border text-fg-muted hover:text-fg'
                }`}
              >
                Dark
              </button>
              <button
                type="button"
                onClick={() => setTheme('light')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  theme === 'light'
                    ? 'border-accent bg-accent/10 text-fg'
                    : 'border-border text-fg-muted hover:text-fg'
                }`}
              >
                Light
              </button>
            </div>
          </div>
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              Editor
            </h3>
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
          <div>
            <AiProviderSettings />
          </div>
          <div>
            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">
              About
            </h3>
            <p className="text-sm text-fg-muted">NEMI AI STUDIO — v0.1.0</p>
          </div>
        </div>
      </div>
    </div>
  );
}
