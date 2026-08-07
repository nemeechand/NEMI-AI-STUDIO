import { useEffect, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { IconButton } from '../common/IconButton';

const POLL_INTERVAL_MS = 5000;
const ENTRY_LIMIT = 100;

const LEVEL_STYLES: Record<LogLevel, string> = {
  INFO: 'text-accent',
  WARNING: 'text-warning',
  ERROR: 'text-danger',
  DEBUG: 'text-fg-muted',
};

type LoggerStatus = 'loading' | 'ready' | 'error';
type LevelFilter = LogLevel | 'ALL';

const LEVEL_OPTIONS: LevelFilter[] = ['ALL', 'INFO', 'WARNING', 'ERROR', 'DEBUG'];

interface LoggerPanelProps {
  onClose: () => void;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleTimeString();
}

export function LoggerPanel({ onClose }: LoggerPanelProps) {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [status, setStatus] = useState<LoggerStatus>('loading');
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('ALL');

  async function fetchLogs() {
    try {
      const result = await window.nemi.backend.logs(ENTRY_LIMIT);
      setEntries(result);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    void fetchLogs();
    const interval = setInterval(() => void fetchLogs(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const visibleEntries =
    levelFilter === 'ALL' ? entries : entries.filter((entry) => entry.level === levelFilter);

  return (
    <section className="flex h-48 shrink-0 flex-col border-t border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Logger</span>
        <div className="flex items-center gap-1.5">
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value as LevelFilter)}
            className="rounded border border-border bg-surface px-1 py-0.5 text-xs text-fg-muted"
            aria-label="Filter log level"
          >
            {LEVEL_OPTIONS.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <IconButton label="Refresh" onClick={() => void fetchLogs()}>
            <RefreshCw size={13} />
          </IconButton>
          <IconButton label="Close Logger Panel" onClick={onClose}>
            <X size={14} />
          </IconButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
        {status === 'error' && <p className="text-danger">Unable to reach the backend.</p>}
        {status === 'ready' && visibleEntries.length === 0 && (
          <p className="text-fg-muted">
            {entries.length === 0 ? 'No log entries yet.' : 'No entries match this filter.'}
          </p>
        )}
        {visibleEntries.map((entry) => (
          <div key={entry.id} className="flex gap-2 py-0.5">
            <span className="shrink-0 text-fg-muted">{formatTimestamp(entry.created_at)}</span>
            <span className={`w-16 shrink-0 uppercase ${LEVEL_STYLES[entry.level]}`}>
              {entry.level}
            </span>
            <span className="w-28 shrink-0 truncate text-fg-muted">{entry.source}</span>
            <span className="min-w-0 flex-1 text-fg">{entry.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
