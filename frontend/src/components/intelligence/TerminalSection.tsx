import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import { useIntelligence } from '../../intelligence/useIntelligence';

const LOG_POLL_INTERVAL_MS = 4000;
const LOG_LIMIT = 300;

type Category = 'all' | 'backend' | 'build' | 'test' | 'git';

interface Line {
  timestamp: string;
  category: Exclude<Category, 'all'>;
  text: string;
}

export function TerminalSection() {
  const { runners, gitStatus } = useIntelligence();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [category, setCategory] = useState<Category>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    async function fetchLogs() {
      const result = await window.nemi.backend.logs(LOG_LIMIT).catch(() => []);
      setLogs(result);
    }
    void fetchLogs();
    const interval = setInterval(() => void fetchLogs(), LOG_POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const lines = useMemo<Line[]>(() => {
    // "AI logs" from the spec isn't a separately-tagged stream in this
    // app — Sprint 4 locked centralized AI/orchestration logging into
    // the same backend.stdout/stderr the rest of the Python process
    // writes to (see docs/ARCHITECTURE.md) — so it's folded into
    // "Backend" here rather than a fabricated fifth category.
    const backendLines: Line[] = logs.map((entry) => ({
      timestamp: entry.created_at,
      category: 'backend',
      text: `[${entry.level}] ${entry.source}: ${entry.message}`,
    }));
    const buildLines: Line[] = runners.build.output.map((chunk, i) => ({
      timestamp: `build-${i}`,
      category: 'build',
      text: chunk,
    }));
    const testLines: Line[] = runners.test.output.map((chunk, i) => ({
      timestamp: `test-${i}`,
      category: 'test',
      text: chunk,
    }));
    const gitLines: Line[] = (gitStatus?.recentCommits ?? []).map((commit) => ({
      timestamp: commit.date,
      category: 'git',
      text: `${commit.hash} ${commit.message} (${commit.author})`,
    }));
    return [...backendLines, ...buildLines, ...testLines, ...gitLines];
  }, [logs, runners, gitStatus]);

  const filtered = lines.filter((line) => {
    if (category !== 'all' && line.category !== category) return false;
    if (query && !line.text.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  function handleExport() {
    const content = filtered.map((line) => line.text).join('\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `nemi-terminal-export-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {(['all', 'backend', 'build', 'test', 'git'] as Category[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat)}
            className={`rounded px-2 py-1 text-[11px] capitalize ${
              category === cat ? 'bg-accent text-accent-fg' : 'text-fg-muted hover:text-fg'
            }`}
          >
            {cat}
          </button>
        ))}
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search…"
          className="ml-2 min-w-0 flex-1 rounded border border-border bg-surface px-2 py-1 text-[11px] text-fg outline-none focus:border-accent"
        />
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg hover:border-accent hover:text-accent"
        >
          <Download size={11} /> Export
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto rounded border border-border bg-surface-elevated p-2 font-mono text-[11px] text-fg-muted">
        {filtered.length === 0 && <p>No matching log entries.</p>}
        {filtered.map((line, index) => (
          <div key={`${line.timestamp}-${index}`} className="truncate">
            {line.text}
          </div>
        ))}
      </div>
    </div>
  );
}
