import { createContext } from 'react';

export interface ProjectContextValue {
  projectPath: string | null;
  openProject: (path: string) => Promise<void>;
  closeProject: () => void;
}

export const ProjectContext = createContext<ProjectContextValue | null>(null);
