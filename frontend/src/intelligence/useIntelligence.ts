import { useContext } from 'react';
import { IntelligenceContext, type IntelligenceContextValue } from './intelligence-context';

export function useIntelligence(): IntelligenceContextValue {
  const context = useContext(IntelligenceContext);
  if (!context) {
    throw new Error('useIntelligence must be used within an IntelligenceProvider');
  }
  return context;
}
