import { createContext } from 'react';

export interface WorkspaceContextValue {
  openFilePath: string | null;
  openFile: (path: string) => void;
  closeFile: () => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
