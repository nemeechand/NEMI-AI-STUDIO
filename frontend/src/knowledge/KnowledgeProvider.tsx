import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import { relativePath } from '../project/pathUtils';
import { KnowledgeContext, type KnowledgeContextValue } from './knowledge-context';

function formatFileContext(file: string, context: FileContext, gitHistory: string): string {
  const parts = [`File: ${file}`];
  parts.push(
    context.found_in_graph
      ? `Indexed in the knowledge graph. Risk: ${context.risk_label} (score ${context.risk_score}).`
      : 'Not yet indexed in the knowledge graph — run "Index Project" for full context.',
  );
  if (context.imported_by.length > 0) {
    parts.push(`Imported by (${context.imported_by.length}): ${context.imported_by.join(', ')}`);
  }
  if (context.defines.length > 0) {
    parts.push(`Defines: ${context.defines.map((d) => d.split('::').pop()).join(', ')}`);
  }
  if (context.related_memory.length > 0) {
    parts.push('Related recorded history (decisions/bugs/fixes/changes):');
    for (const entry of context.related_memory.slice(0, 10)) {
      parts.push(`- [${entry.type}] ${entry.value}`);
    }
  }
  if (gitHistory) {
    parts.push('Recent git history (hash author date subject):');
    parts.push(gitHistory);
  } else {
    parts.push('No git history available (not a git repository, or file has no commits yet).');
  }
  return parts.join('\n');
}

export function KnowledgeProvider({ children }: { children: ReactNode }) {
  const { projectId, projectPath } = useProject();
  const [stats, setStats] = useState<KnowledgeStats | null>(null);
  const [indexing, setIndexing] = useState(false);
  const [lastIndexResult, setLastIndexResult] = useState<IndexResult | null>(null);
  const [embeddingProviders, setEmbeddingProviders] = useState<EmbeddingProviderInfo[]>([]);
  const [embedding, setEmbedding] = useState(false);
  const [lastEmbedResult, setLastEmbedResult] = useState<EmbedResult | null>(null);

  useEffect(() => {
    window.nemi.knowledge
      .listEmbeddingProviders()
      .then(setEmbeddingProviders)
      .catch(() => {});
  }, []);

  const refreshStats = useCallback(async () => {
    if (!projectId) {
      setStats(null);
      return;
    }
    const result = await window.nemi.knowledge.getStats(projectId).catch(() => null);
    setStats(result);
  }, [projectId]);

  useEffect(() => {
    void refreshStats();
  }, [refreshStats]);

  const runIndex = useCallback(async () => {
    if (!projectId || !projectPath) return;
    setIndexing(true);
    try {
      const result = await window.nemi.knowledge.index(projectId, projectPath);
      setLastIndexResult(result);
      await refreshStats();
    } finally {
      setIndexing(false);
    }
  }, [projectId, projectPath, refreshStats]);

  const runEmbed = useCallback(
    async (provider: string, model: string) => {
      if (!projectId || !projectPath) return;
      setEmbedding(true);
      try {
        const result = await window.nemi.knowledge.generateEmbeddings({
          projectId,
          projectPath,
          provider,
          model,
        });
        setLastEmbedResult(result);
        await refreshStats();
      } finally {
        setEmbedding(false);
      }
    },
    [projectId, projectPath, refreshStats],
  );

  const search = useCallback(
    (query: string, provider?: string | null, model?: string | null) => {
      if (!projectId) {
        return Promise.resolve<SearchResult>({
          mode: 'keyword_fallback',
          fallback_reason: 'No project is open.',
          hits: [],
        });
      }
      return window.nemi.knowledge.search({ projectId, query, provider, model });
    },
    [projectId],
  );

  const getImpact = useCallback(
    (file: string) => {
      if (!projectId) throw new Error('No project is open.');
      return window.nemi.knowledge.getImpact(projectId, file);
    },
    [projectId],
  );

  const getDiagram = useCallback(
    (type: 'dependency' | 'architecture') => {
      if (!projectId) throw new Error('No project is open.');
      return window.nemi.knowledge.getDiagram(projectId, type);
    },
    [projectId],
  );

  const listMemory = useCallback(
    (type: MemoryEntryType) => window.nemi.knowledge.listMemory(projectId, type),
    [projectId],
  );

  const explainFile = useCallback(
    async (absolutePath: string) => {
      if (!projectId || !projectPath) return null;
      const relative = relativePath(projectPath, absolutePath);
      if (!relative) return null;
      const [context, gitHistory] = await Promise.all([
        window.nemi.knowledge.getFileContext(projectId, relative),
        window.nemi.knowledge.getFileHistory(projectPath, relative),
      ]);
      return { path: relative, context: formatFileContext(relative, context, gitHistory) };
    },
    [projectId, projectPath],
  );

  const value = useMemo<KnowledgeContextValue>(
    () => ({
      stats,
      refreshStats,
      indexing,
      lastIndexResult,
      runIndex,
      embeddingProviders,
      embedding,
      lastEmbedResult,
      runEmbed,
      search,
      getImpact,
      getDiagram,
      listMemory,
      explainFile,
    }),
    [
      stats,
      refreshStats,
      indexing,
      lastIndexResult,
      runIndex,
      embeddingProviders,
      embedding,
      lastEmbedResult,
      runEmbed,
      search,
      getImpact,
      getDiagram,
      listMemory,
      explainFile,
    ],
  );

  return <KnowledgeContext.Provider value={value}>{children}</KnowledgeContext.Provider>;
}
