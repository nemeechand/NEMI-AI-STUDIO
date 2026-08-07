import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import { WorkspaceContext, type WorkspaceContextValue } from './workspace-context';

const STORAGE_PREFIX = 'nemi.workspace.openFile.';

function storageKey(projectPath: string): string {
  return `${STORAGE_PREFIX}${projectPath}`;
}

/**
 * Auto-saves and restores the "workspace" — currently just the active
 * project's last-open file — scoped per project path, so switching
 * projects (Workspace Manager) restores each project's own remembered
 * file instead of a single global slot. Window chrome (sidebar/logger
 * visibility) is intentionally not part of this — out of scope, see
 * docs/ARCHITECTURE.md.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { projectPath } = useProject();
  const [openFilePath, setOpenFilePath] = useState<string | null>(null);

  // Re-derive the open file whenever the active project changes (including
  // the initial restore-on-launch, once ProjectProvider resolves it).
  useEffect(() => {
    if (!projectPath) {
      setOpenFilePath(null);
      return;
    }
    setOpenFilePath(window.localStorage.getItem(storageKey(projectPath)));
  }, [projectPath]);

  // Auto-save: persist the current project's open file on every change.
  useEffect(() => {
    if (!projectPath) return;
    if (openFilePath) {
      window.localStorage.setItem(storageKey(projectPath), openFilePath);
    } else {
      window.localStorage.removeItem(storageKey(projectPath));
    }
  }, [projectPath, openFilePath]);

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      openFilePath,
      openFile: (path: string) => setOpenFilePath(path),
      closeFile: () => setOpenFilePath(null),
    }),
    [openFilePath],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
