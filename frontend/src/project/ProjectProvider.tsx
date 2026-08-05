import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ProjectContext, type ProjectContextValue } from './project-context';

const STORAGE_KEY = 'nemi.project.path';

function readStoredProjectPath(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectPath, setProjectPath] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredProjectPath();
    if (!stored) return;

    let cancelled = false;
    void window.nemi.fs.openProject(stored).then((ok) => {
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
      openProject: async (path: string) => {
        const ok = await window.nemi.fs.openProject(path);
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
