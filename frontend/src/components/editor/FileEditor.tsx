import { useEffect, useState } from 'react';
import { Save, X } from 'lucide-react';
import { IconButton } from '../common/IconButton';

interface FileEditorProps {
  path: string;
  content: string;
  onClose: () => void;
}

function fileName(filePath: string): string {
  return filePath.split(/[\\/]/).pop() ?? filePath;
}

export function FileEditor({ path, content, onClose }: FileEditorProps) {
  const [value, setValue] = useState(content);
  const [savedValue, setSavedValue] = useState(content);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = value !== savedValue;

  useEffect(() => {
    setValue(content);
    setSavedValue(content);
    setError(null);
  }, [path, content]);

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await window.nemi.fs.writeFile(path, value);
      setSavedValue(value);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (dirty && !saving) void save();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty, saving, value, path]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm text-fg">{fileName(path)}</span>
          {dirty && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" title="Unsaved changes" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <IconButton label="Save (Ctrl+S)" onClick={() => void save()} disabled={!dirty || saving}>
            <Save size={15} />
          </IconButton>
          <IconButton label="Close" onClick={onClose}>
            <X size={15} />
          </IconButton>
        </div>
      </div>
      <p className="truncate border-b border-border px-3 py-1 text-xs text-fg-muted">{path}</p>
      {error && <p className="border-b border-border px-3 py-1 text-xs text-danger">{error}</p>}
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
        className="flex-1 resize-none bg-surface p-3 font-mono text-sm text-fg outline-none"
      />
    </div>
  );
}
