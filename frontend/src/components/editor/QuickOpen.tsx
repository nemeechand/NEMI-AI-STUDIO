import { useEffect, useState } from 'react';
import { useProject } from '../../project/useProject';
import { useWorkspace } from '../../workspace/useWorkspace';
import { fuzzyFilter } from '../../commands/fuzzyMatch';
import { basename } from '../../project/pathUtils';

interface QuickOpenProps {
  onClose: () => void;
}

export function QuickOpen({ onClose }: QuickOpenProps) {
  const { projectPath } = useProject();
  const { openFile } = useWorkspace();
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<string[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!projectPath) return;
    void window.nemi.fs.listAllFiles(projectPath).then(setFiles);
  }, [projectPath]);

  const results = fuzzyFilter(files, query, (filePath) => filePath);

  useEffect(() => setActiveIndex(0), [query]);

  function openActive() {
    const filePath = results[activeIndex];
    if (filePath) {
      openFile(filePath);
      onClose();
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        openActive();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, activeIndex, onClose]);

  if (!projectPath) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface-elevated shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Go to file…"
          className="w-full border-b border-border bg-transparent px-3 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-3 py-3 text-xs text-fg-muted">No matching files.</p>
          )}
          {results.map((filePath, index) => (
            <button
              key={filePath}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                openFile(filePath);
                onClose();
              }}
              className={`flex w-full flex-col items-start px-3 py-1.5 text-left text-sm ${
                index === activeIndex ? 'bg-accent/10 text-fg' : 'text-fg-muted'
              }`}
            >
              <span className="text-fg">{basename(filePath)}</span>
              <span className="truncate text-xs text-fg-muted">{filePath}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
