import { useState } from 'react';
import { Search } from 'lucide-react';
import { useProject } from '../../project/useProject';
import { useWorkspace } from '../../workspace/useWorkspace';
import { basename } from '../../project/pathUtils';
import { requestReveal } from '../editor/pendingReveal';

export function GlobalSearch() {
  const { projectPath } = useProject();
  const { openFile } = useWorkspace();
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [useRegex, setUseRegex] = useState(false);
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [status, setStatus] = useState<'idle' | 'searching' | 'error'>('idle');

  async function runSearch() {
    if (!projectPath || !query.trim()) {
      setResults([]);
      setStatus('idle');
      return;
    }
    setStatus('searching');
    try {
      const matches = await window.nemi.fs.searchInFiles(projectPath, query, {
        caseSensitive,
        useRegex,
      });
      setResults(matches);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }

  function openResult(match: SearchMatch) {
    requestReveal(match.path, match.line, match.column);
    openFile(match.path);
  }

  if (!projectPath) {
    return (
      <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-elevated">
        <div className="px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
            Search
          </span>
        </div>
        <p className="px-3 text-xs text-fg-muted">Open a folder to search across files.</p>
      </aside>
    );
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-elevated">
      <div className="px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Search</span>
      </div>
      <div className="space-y-1.5 px-2 pb-2">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void runSearch();
          }}
          placeholder="Search across files…"
          className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
        />
        <div className="flex items-center gap-3 px-0.5 text-xs text-fg-muted">
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={(event) => setCaseSensitive(event.target.checked)}
            />
            Case sensitive
          </label>
          <label className="flex items-center gap-1">
            <input
              type="checkbox"
              checked={useRegex}
              onChange={(event) => setUseRegex(event.target.checked)}
            />
            Regex
          </label>
        </div>
        <button
          type="button"
          onClick={() => void runSearch()}
          className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent"
        >
          <Search size={12} /> Search
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {status === 'error' && <p className="px-2 text-xs text-danger">Search failed.</p>}
        {status === 'idle' && query && results.length === 0 && (
          <p className="px-2 text-xs text-fg-muted">No matches.</p>
        )}
        {results.map((match, index) => (
          <button
            key={`${match.path}:${match.line}:${index}`}
            type="button"
            onClick={() => openResult(match)}
            className="flex w-full flex-col items-start gap-0.5 rounded px-2 py-1 text-left hover:bg-surface"
          >
            <span className="truncate text-xs text-fg">
              {basename(match.path)}:{match.line}
            </span>
            <span className="truncate text-xs text-fg-muted">{match.lineText.trim()}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}
