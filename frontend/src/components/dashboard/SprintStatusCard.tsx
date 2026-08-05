import { CheckCircle2, Circle, ListTodo } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { SPRINT_HISTORY, type SprintStatus } from './dashboardData';

const STATUS_ICON: Record<SprintStatus, typeof CheckCircle2> = {
  completed: CheckCircle2,
  current: Circle,
  pending: Circle,
};

const STATUS_STYLES: Record<SprintStatus, string> = {
  completed: 'text-success',
  current: 'text-accent',
  pending: 'text-fg-muted',
};

export function SprintStatusCard() {
  return (
    <DashboardCard title="Sprint Progress" icon={<ListTodo size={14} />}>
      <ul className="flex flex-col gap-2.5">
        {SPRINT_HISTORY.map((sprint) => {
          const Icon = STATUS_ICON[sprint.status];
          return (
            <li key={sprint.id} className="flex items-start gap-2">
              <Icon size={16} className={`mt-0.5 shrink-0 ${STATUS_STYLES[sprint.status]}`} />
              <div className="min-w-0">
                <p className="text-sm text-fg">
                  {sprint.name}
                  {sprint.status === 'current' && (
                    <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-accent">
                      In Progress
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-fg-muted">{sprint.summary}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </DashboardCard>
  );
}
