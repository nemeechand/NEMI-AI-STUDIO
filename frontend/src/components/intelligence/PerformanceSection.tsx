import { useIntelligence } from '../../intelligence/useIntelligence';
import { formatDuration, formatPercent } from './sections';

const ROLE_LABELS: Record<string, string> = {
  planner: 'Planner',
  developer: 'Developer',
  reviewer: 'Reviewer',
  tester: 'Tester',
};

export function PerformanceSection() {
  const { performanceStats } = useIntelligence();

  if (!performanceStats) {
    return <p className="text-xs text-fg-muted">Loading performance stats…</p>;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
        <Stat label="Success Rate" value={formatPercent(performanceStats.success_rate)} />
        <Stat label="Failure Rate" value={formatPercent(performanceStats.failure_rate)} />
        <Stat label="Retry Rate" value={formatPercent(performanceStats.retry_rate)} />
        <Stat
          label="Avg Task Time"
          value={
            performanceStats.avg_task_seconds !== null
              ? formatDuration(performanceStats.avg_task_seconds)
              : '—'
          }
        />
        <Stat label="Execution Speed" value={`${performanceStats.tasks_completed_last_hour}/hr`} />
        <Stat label="Total Tasks" value={String(performanceStats.total_tasks)} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-fg">Average Agent Time</p>
        <div className="space-y-1">
          {Object.entries(performanceStats.avg_agent_seconds).map(([role, seconds]) => (
            <div key={role} className="flex items-center justify-between text-xs">
              <span className="text-fg-muted">{ROLE_LABELS[role] ?? role}</span>
              <span className="text-fg-muted">
                {seconds !== null ? formatDuration(seconds) : 'no completed tasks yet'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="truncate text-xs text-fg">{value}</div>
    </div>
  );
}
