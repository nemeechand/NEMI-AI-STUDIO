import { useContext } from 'react';
import { AgentsContext, type AgentsContextValue } from './agents-context';

export function useAgents(): AgentsContextValue {
  const context = useContext(AgentsContext);
  if (!context) {
    throw new Error('useAgents must be used within an AgentsProvider');
  }
  return context;
}
