import { X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { mockLogEntries, type LogLevel } from './mockLogEntries';

const LEVEL_STYLES: Record<LogLevel, string> = {
  info: 'text-accent',
  warn: 'text-warning',
  error: 'text-danger',
};

interface LoggerPanelProps {
  onClose: () => void;
}

export function LoggerPanel({ onClose }: LoggerPanelProps) {
  return (
    <section className="flex h-48 shrink-0 flex-col border-t border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">Logger</span>
        <IconButton label="Close Logger Panel" onClick={onClose}>
          <X size={14} />
        </IconButton>
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2 font-mono text-xs">
        {mockLogEntries.map((entry) => (
          <div key={entry.id} className="flex gap-2 py-0.5">
            <span className="text-fg-muted">{entry.timestamp}</span>
            <span className={`w-12 shrink-0 uppercase ${LEVEL_STYLES[entry.level]}`}>
              {entry.level}
            </span>
            <span className="text-fg">{entry.message}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
