import { useEffect, useState } from 'react';
import { FolderOpen, FolderPlus, RefreshCw, X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useProject } from '../../project/useProject';
import { useOpenProjectDialog } from '../../project/useOpenProjectDialog';
import { basename } from '../../project/pathUtils';
import { formatRelativeTime } from './formatRelativeTime';

interface WorkspaceManagerProps {
  onNewProject: () => void;
}

export function WorkspaceManager({ onNewProject }: WorkspaceManagerProps) {
  const { projectPath, openProject } = useProject();
  const { openExisting } = useOpenProjectDialog();
  const [projects, setProjects] = useState<ProjectRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  async function refresh() {
    try {
      const recent = await window.nemi.projects.listRecent(50);
      setProjects(recent);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }

  useEffect(() => {
    // Recent-list membership changes whenever the active project changes
    // (Open Folder, Wizard, restore-on-launch all record to it).
    void refresh();
  }, [projectPath]);

  async function handleRemove(event: React.MouseEvent, id: string) {
    event.stopPropagation();
    try {
      await window.nemi.projects.remove(id);
      void refresh();
    } catch {
      // Removing from the recent list is a convenience action — a failure
      // here isn't worth surfacing as a blocking error.
    }
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-elevated">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Workspace Manager
        </span>
        <div className="flex shrink-0 items-center gap-0.5">
          <IconButton label="New Project" onClick={onNewProject}>
            <FolderPlus size={13} />
          </IconButton>
          <IconButton label="Refresh" onClick={() => void refresh()}>
            <RefreshCw size={13} />
          </IconButton>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {status === 'error' && (
          <p className="px-2 py-2 text-xs text-danger">Unable to reach the backend.</p>
        )}
        {status === 'ready' && projects.length === 0 && (
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <p className="text-xs text-fg-muted">No projects yet.</p>
            <button
              type="button"
              onClick={() => void openExisting()}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-fg hover:border-accent hover:text-accent"
            >
              <FolderOpen size={13} /> Open Folder
            </button>
            <button
              type="button"
              onClick={onNewProject}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-fg hover:border-accent hover:text-accent"
            >
              <FolderPlus size={13} /> New Project
            </button>
          </div>
        )}
        {projects.map((project) => {
          const isActive = project.path === projectPath;
          return (
            <div
              key={project.id}
              role="button"
              tabIndex={0}
              onClick={() => void openProject(project.path)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void openProject(project.path);
              }}
              className={`group flex w-full cursor-pointer flex-col gap-0.5 rounded px-2 py-1.5 text-left ${
                isActive ? 'bg-accent/10 text-fg' : 'text-fg-muted hover:bg-surface hover:text-fg'
              }`}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-sm">{project.name || basename(project.path)}</span>
                <div className="hidden shrink-0 items-center group-hover:flex">
                  <IconButton
                    label="Remove from Recent"
                    onClick={(event) => void handleRemove(event, project.id)}
                  >
                    <X size={12} />
                  </IconButton>
                </div>
              </div>
              <span className="truncate text-xs text-fg-muted">{project.path}</span>
              {project.last_opened_at && (
                <span className="text-xs text-fg-muted">
                  {formatRelativeTime(project.last_opened_at)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </aside>
  );
}
