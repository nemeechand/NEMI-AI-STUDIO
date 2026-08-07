import { useEffect, useState } from 'react';
import { FolderClock } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useProject } from '../../project/useProject';
import { basename } from '../../project/pathUtils';
import { formatRelativeTime } from '../workspace/formatRelativeTime';

const RECENT_LIMIT = 5;

export function RecentProjectsCard() {
  const { openProject } = useProject();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    window.nemi.projects
      .listRecent(RECENT_LIMIT)
      .then((recent) => {
        if (!cancelled) {
          setProjects(recent);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <DashboardCard title="Recent Projects" icon={<FolderClock size={14} />}>
      {status === 'error' && <p className="text-xs text-danger">Unable to reach the backend.</p>}
      {status === 'ready' && projects.length === 0 && (
        <p className="text-xs text-fg-muted">No projects opened yet.</p>
      )}
      <ul className="flex flex-col gap-1.5">
        {projects.map((project) => (
          <li key={project.id}>
            <button
              type="button"
              onClick={() => void openProject(project.path)}
              className="flex w-full flex-col items-start gap-0.5 rounded-md px-2 py-1.5 text-left hover:bg-surface"
            >
              <span className="truncate text-sm text-fg">
                {project.name || basename(project.path)}
              </span>
              <span className="flex w-full items-center justify-between gap-2 text-xs text-fg-muted">
                <span className="truncate">{project.path}</span>
                {project.last_opened_at && (
                  <span className="shrink-0">{formatRelativeTime(project.last_opened_at)}</span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </DashboardCard>
  );
}
