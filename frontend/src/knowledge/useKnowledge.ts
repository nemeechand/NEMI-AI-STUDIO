import { useContext } from 'react';
import { KnowledgeContext, type KnowledgeContextValue } from './knowledge-context';

export function useKnowledge(): KnowledgeContextValue {
  const context = useContext(KnowledgeContext);
  if (!context) {
    throw new Error('useKnowledge must be used within a KnowledgeProvider');
  }
  return context;
}
