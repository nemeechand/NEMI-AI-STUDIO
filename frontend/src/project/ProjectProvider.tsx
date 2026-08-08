import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ProjectContext, type ProjectContextValue } from './project-context';
import { basename } from './pathUtils';

const STORAGE_KEY = 'nemi.project.path';

function readStoredProjectPath(): string | null {
  return window.localStorage.getItem(STORAGE_KEY);
}

interface OpenAndRecordResult {
  /** Whether the folder itself opened successfully — false means it no
   * longer exists and any remembered path for it should be forgotten. */
  opened: boolean;
  /** The recorded project's database id — null if `opened` is false, or
   * if the folder opened fine but recording with the backend failed
   * (a transient hiccup, not a reason to treat the project as unopened). */
  projectId: string | null;
}

/**
 * Single choke point for "a project was opened" — used by launch-time
 * session restore, Open Folder, the New Project Wizard, and the Workspace
 * Manager switcher alike, so every path opens/records exactly once instead
 * of duplicating those calls at each call site.
 */
async function openAndRecord(path: string, description?: string): Promise<OpenAndRecordResult> {
  const opened = await window.nemi.fs.openProject(path);
  if (!opened) return { opened: false, projectId: null };
  try {
    const record = await window.nemi.projects.recordOpened(path, basename(path), description);
    return { opened: true, projectId: record.id };
  } catch (error) {
    // Recent-projects tracking is a convenience, not a correctness
    // requirement — a backend hiccup must not block opening the project.
    console.error('[project] Failed to record project as opened', error);
    return { opened: true, projectId: null };
  }
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  useEffect(() => {
    const stored = readStoredProjectPath();
    if (!stored) return;

    let cancelled = false;
    void openAndRecord(stored).then((result) => {
      if (cancelled) return;
      if (result.opened) {
        setProjectPath(stored);
        setProjectId(result.projectId);
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
      projectId,
      openProject: async (path: string, description?: string) => {
        const result = await openAndRecord(path, description);
        if (!result.opened) {
          console.error(`[project] Failed to open project folder: ${path}`);
          return;
        }
        window.localStorage.setItem(STORAGE_KEY, path);
        setProjectPath(path);
        setProjectId(result.projectId);
      },
      closeProject: () => {
        void window.nemi.fs.closeProject();
        window.localStorage.removeItem(STORAGE_KEY);
        setProjectPath(null);
        setProjectId(null);
      },
    }),
    [projectPath, projectId],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}
