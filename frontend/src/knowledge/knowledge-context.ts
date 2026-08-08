import { createContext } from 'react';

export interface KnowledgeContextValue {
  stats: KnowledgeStats | null;
  refreshStats: () => Promise<void>;

  indexing: boolean;
  lastIndexResult: IndexResult | null;
  runIndex: () => Promise<void>;

  embeddingProviders: EmbeddingProviderInfo[];
  embedding: boolean;
  lastEmbedResult: EmbedResult | null;
  runEmbed: (provider: string, model: string) => Promise<void>;

  search: (query: string, provider?: string | null, model?: string | null) => Promise<SearchResult>;
  getImpact: (file: string) => Promise<ImpactResult>;
  getDiagram: (type: 'dependency' | 'architecture') => Promise<DiagramResult>;
  listMemory: (type: MemoryEntryType) => Promise<MemoryEntry[]>;

  /** Real gathered context (graph relationships + memory + git history)
   * for Architecture Intelligence — never fabricated. Returns null if no
   * project is open or the path can't be resolved. */
  explainFile: (absolutePath: string) => Promise<{ path: string; context: string } | null>;
}

export const KnowledgeContext = createContext<KnowledgeContextValue | null>(null);
