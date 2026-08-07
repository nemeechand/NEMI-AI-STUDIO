import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ProjectContext, type ProjectContextValue } from './project-context';
import { basename } from './pathUtils';

const STORAGE_KEY = 'nemi.project.path';

function readStoredProjectPath(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

/**
 * Single choke point for "a project was opened" — used by launch-time
 * session restore, Open Folder, the New Project Wizard, and the Workspace
 * Manager switcher alike, so every path records exactly once instead of
 * duplicating the recording call at each call site.
 */
async function openAndRecord(path: string, description?: string): Promise<boolean> {
  const ok = await window.nemi.fs.openProject(path);
  if (!ok) return false;
  try {
    await window.nemi.projects.recordOpened(path, basename(path), description);
  } catch (error) {
    // Recent-projects tracking is a convenience, not a correctness
    // requirement — a backend hiccup must not block opening the project.
    console.error('[project] Failed to record project as opened', error);
  }
  return true;
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectPath, setProjectPath] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredProjectPath();
    if (!stored) return;

    let cancelled = false;
    void openAndRecord(stored).then((ok) => {
      if (cancelled) return;
      if (ok) {
        setProjectPath(stored);
      } else {
        console.error(`[project] Remembered project folder no longer exists: ${stored}`);
        window.localStorage.removeItem(STORAGE_KEY);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<ProjectContextValue>(
    () => ({
      projectPath,
      openProject: async (path: string, description?: string) => {
        const ok = await openAndRecord(path, description);
        if (!ok) {
          console.error(`[project] Failed to open project folder: ${path}`);
          return;
        }
        window.localStorage.setItem(STORAGE_KEY, path);
        setProjectPath(path);
      },
      closeProject: () => {
        void window.nemi.fs.closeProject();
        window.localStorage.removeItem(STORAGE_KEY);
        setProjectPath(null);
      },
    }),
    [projectPath],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
