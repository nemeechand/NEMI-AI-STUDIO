import { useEffect, useState } from 'react';
import { FolderOpen, FolderPlus, RefreshCw, X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useProject } from '../../project/useProject';
import { useOpenProjectDialog } from '../../project/useOpenProjectDialog';
import { ExplorerTree } from './ExplorerTree';

interface ProjectExplorerProps {
  onOpenFile: (path: string) => void;
}

function projectDisplayName(projectPath: string): string {
  return projectPath.split(/[\\/]/).filter(Boolean).pop() ?? projectPath;
}

export function ProjectExplorer({ onOpenFile }: ProjectExplorerProps) {
  const { projectPath, closeProject } = useProject();
  const { openExisting, createNew } = useOpenProjectDialog();
  const [watchVersion, setWatchVersion] = useState(0);

  useEffect(() => {
    if (!projectPath) return undefined;
    return window.nemi.fs.onChange(() => setWatchVersion((v) => v + 1));
  }, [projectPath]);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-elevated">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
          {projectPath ? projectDisplayName(projectPath) : 'Project Explorer'}
        </span>
        {projectPath && (
          <div className="flex shrink-0 items-center gap-0.5">
            <IconButton label="Refresh" onClick={() => setWatchVersion((v) => v + 1)}>
              <RefreshCw size={13} />
            </IconButton>
            <IconButton label="Close Folder" onClick={closeProject}>
              <X size={13} />
            </IconButton>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {projectPath ? (
          <ExplorerTree
            rootPath={projectPath}
            watchVersion={watchVersion}
            onOpenFile={onOpenFile}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-3 py-6 text-center">
            <p className="text-xs text-fg-muted">No folder opened yet.</p>
            <button
              type="button"
              onClick={() => void openExisting()}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-fg hover:border-accent hover:text-accent"
            >
              <FolderOpen size={13} /> Open Folder
            </button>
            <button
              type="button"
              onClick={() => void createNew()}
              className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-xs text-fg hover:border-accent hover:text-accent"
            >
              <FolderPlus size={13} /> New Project
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
