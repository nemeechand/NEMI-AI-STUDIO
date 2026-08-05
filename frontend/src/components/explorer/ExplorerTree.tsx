import { useEffect, useState } from 'react';
import { FilePlus } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { ExplorerTreeItem } from './ExplorerTreeItem';
import { InlineNameInput } from './InlineNameInput';

interface ExplorerTreeProps {
  rootPath: string;
  watchVersion: number;
  onOpenFile: (path: string) => void;
}

export function ExplorerTree({ rootPath, watchVersion, onOpenFile }: ExplorerTreeProps) {
  const [entries, setEntries] = useState<ExplorerEntry[]>([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const result = await window.nemi.fs.listDirectory(rootPath);
      setEntries(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
    }
  }

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, watchVersion]);

  async function handleCreate(name: string) {
    await window.nemi.fs.createFile(rootPath, name);
    setCreating(false);
    void refresh();
  }

  return (
    <div>
      <div className="flex items-center justify-end px-2 py-1">
        <IconButton label="New File" onClick={() => setCreating(true)}>
          <FilePlus size={13} />
        </IconButton>
      </div>
      {error && <p className="px-3 py-1 text-xs text-danger">{error}</p>}
      {creating && (
        <InlineNameInput
          depth={0}
          placeholder="File name"
          onConfirm={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {entries.map((entry) => (
        <ExplorerTreeItem
          key={entry.path}
          entry={entry}
          depth={0}
          watchVersion={watchVersion}
          onOpenFile={onOpenFile}
        />
      ))}
    </div>
  );
}
