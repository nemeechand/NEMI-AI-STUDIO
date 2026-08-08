import { useContext } from 'react';
import { WorkflowsContext, type WorkflowsContextValue } from './workflows-context';

export function useWorkflows(): WorkflowsContextValue {
  const context = useContext(WorkflowsContext);
  if (!context) {
    throw new Error('useWorkflows must be used within a WorkflowsProvider');
  }
  return context;
}
