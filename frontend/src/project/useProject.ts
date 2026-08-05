import { useContext } from 'react';
import { ProjectContext, type ProjectContextValue } from './project-context';

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
}
