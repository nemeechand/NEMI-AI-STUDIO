import { useContext } from 'react';
import { AiContext, type AiContextValue } from './ai-context';

export function useAi(): AiContextValue {
  const context = useContext(AiContext);
  if (!context) {
    throw new Error('useAi must be used within an AiProvider');
  }
  return context;
}
