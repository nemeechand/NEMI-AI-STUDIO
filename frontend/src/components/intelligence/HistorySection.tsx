import { useIntelligence } from '../../intelligence/useIntelligence';

function describeEvent(entry: HistoryEntry): string {
  const snapshot = entry.snapshot as Record<string, unknown>;
  if (entry.entity_type === 'workflow') {
    const title = typeof snapshot.title === 'string' ? snapshot.title : entry.entity_id;
    const status = typeof snapshot.status === 'string' ? snapshot.status : entry.action;
    return `Workflow "${title}" → ${status}`;
  }
  if (entry.entity_type === 'agent_task') {
    const title = typeof snapshot.title === 'string' ? snapshot.title : entry.entity_id;
    return `Task "${title}" failed${
      typeof snapshot.error_message === 'string' ? `: ${snapshot.error_message}` : ''
    }`;
  }
  return `${entry.entity_type} ${entry.action}`;
}

export function HistorySection() {
  const { history, gitStatus } = useIntelligence();

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <p className="mb-1.5 text-xs font-medium text-fg">Timeline</p>
        <div className="space-y-1">
          {history.length === 0 && <p className="text-xs text-fg-muted">No events recorded yet.</p>}
          {history.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between rounded border border-border px-2.5 py-1.5 text-[11px]"
            >
              <span className="text-fg-muted">{describeEvent(entry)}</span>
              <span className="shrink-0 text-fg-muted">
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>

      {gitStatus?.isRepo && gitStatus.recentCommits.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium text-fg">Commits</p>
          <div className="space-y-1">
            {gitStatus.recentCommits.map((commit) => (
              <div key={commit.hash} className="text-[11px] text-fg-muted">
                <span className="font-mono">{commit.hash}</span> {commit.message} — {commit.author}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-fg-muted">
        "Releases" isn't tracked — this app doesn't have an in-app release/publish action yet, so
        there's no real event to show here rather than a fabricated one.
      </p>
    </div>
  );
}
