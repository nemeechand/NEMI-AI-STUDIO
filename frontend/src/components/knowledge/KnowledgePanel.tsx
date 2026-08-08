import { useState } from 'react';
import { Database, FileCode2, GitBranch, RefreshCw, Search, Sparkles } from 'lucide-react';
import { useProject } from '../../project/useProject';
import { useKnowledge } from '../../knowledge/useKnowledge';
import { useAi } from '../../ai/useAi';

function downloadText(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function KnowledgePanel() {
  const { projectId, projectPath } = useProject();
  const { configuredProviders } = useAi();
  const {
    stats,
    indexing,
    lastIndexResult,
    runIndex,
    embeddingProviders,
    embedding,
    lastEmbedResult,
    runEmbed,
    search,
    getDiagram,
  } = useKnowledge();

  const [embedProvider, setEmbedProvider] = useState('ollama');
  const [embedModel, setEmbedModel] = useState('nomic-embed-text');
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<SearchResult | null>(null);
  const [diagramBusy, setDiagramBusy] = useState<'dependency' | 'architecture' | null>(null);

  if (!projectId || !projectPath) {
    return (
      <aside className="flex w-72 shrink-0 flex-col items-center justify-center border-r border-border bg-surface-elevated px-4 py-6 text-center">
        <p className="text-xs text-fg-muted">Open a project to build its knowledge graph.</p>
      </aside>
    );
  }

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const useSemantic = embeddingProviders.some((p) => p.id === embedProvider);
      const result = await search(
        query,
        useSemantic ? embedProvider : null,
        useSemantic ? embedModel : null,
      );
      setSearchResult(result);
    } finally {
      setSearching(false);
    }
  }

  async function handleDiagram(type: 'dependency' | 'architecture') {
    setDiagramBusy(type);
    try {
      const diagram = await getDiagram(type);
      downloadText(`nemi-${type}-diagram-${Date.now()}.mmd`, diagram.mermaid);
    } finally {
      setDiagramBusy(null);
    }
  }

  const selectedProviderNeedsKey =
    embeddingProviders.find((p) => p.id === embedProvider)?.requires_api_key ?? false;
  const missingKey = selectedProviderNeedsKey && !configuredProviders.has(embedProvider);

  return (
    <aside className="flex w-72 shrink-0 flex-col overflow-y-auto border-r border-border bg-surface-elevated">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Knowledge Graph
        </span>
        <button
          type="button"
          disabled={indexing}
          onClick={() => void runIndex()}
          className="flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent disabled:opacity-50"
        >
          <RefreshCw size={12} className={indexing ? 'animate-spin' : ''} />
          {indexing ? 'Indexing…' : 'Index Project'}
        </button>
      </div>

      {lastIndexResult && (
        <p className="px-3 pb-2 text-xs text-fg-muted">
          {lastIndexResult.errors.length > 0
            ? `Index failed: ${lastIndexResult.errors[0]}`
            : `Indexed ${lastIndexResult.files_indexed} files, ${lastIndexResult.functions_found} functions, ${lastIndexResult.classes_found} classes, ${lastIndexResult.commits_indexed} commits in ${lastIndexResult.duration_ms}ms.`}
          {lastIndexResult.truncated && ' (truncated — project is very large)'}
        </p>
      )}

      <div className="border-t border-border px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <Database size={12} /> Graph stats
        </div>
        {stats ? (
          <ul className="space-y-0.5 text-xs text-fg-muted">
            <li>Files indexed: {stats.files_indexed}</li>
            {Object.entries(stats.nodes_by_type).map(([type, count]) => (
              <li key={type}>
                {type}: {count}
              </li>
            ))}
            <li>Relationships: {stats.total_edges}</li>
            <li>Embeddings stored: {stats.embeddings_count}</li>
          </ul>
        ) : (
          <p className="text-xs text-fg-muted">Not indexed yet.</p>
        )}
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <Sparkles size={12} /> Semantic search
        </div>
        <div className="mb-1.5 flex gap-1">
          <select
            value={embedProvider}
            onChange={(event) => {
              setEmbedProvider(event.target.value);
              const provider = embeddingProviders.find((p) => p.id === event.target.value);
              setEmbedModel(provider?.default_model ?? '');
            }}
            className="flex-1 rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg"
          >
            {embeddingProviders.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </div>
        {missingKey && (
          <p className="mb-1.5 text-xs text-warning">
            No {embedProvider} API key configured — search will fall back to keyword matching.
          </p>
        )}
        <div className="mb-1.5 flex gap-1">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleSearch();
            }}
            placeholder="Search by meaning…"
            className="flex-1 rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg placeholder:text-fg-muted"
          />
          <button
            type="button"
            onClick={() => void handleSearch()}
            disabled={searching}
            className="rounded border border-border p-1 text-fg-muted hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <Search size={12} />
          </button>
        </div>
        {searchResult && (
          <div className="space-y-1.5">
            <p className="text-xs text-fg-muted">
              {searchResult.mode === 'semantic'
                ? `Semantic results (${embedProvider}/${embedModel})`
                : `Keyword fallback${searchResult.fallback_reason ? `: ${searchResult.fallback_reason}` : ''}`}
            </p>
            {searchResult.hits.length === 0 && <p className="text-xs text-fg-muted">No matches.</p>}
            {searchResult.hits.map((hit, index) => (
              <div
                key={`${hit.entity_type}-${hit.entity_id}-${index}`}
                className="rounded border border-border p-1.5"
              >
                <p className="text-xs font-medium text-fg">{hit.entity_type}</p>
                <p className="line-clamp-3 text-xs text-fg-muted">{hit.preview}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-border px-3 py-2">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <FileCode2 size={12} /> Generate embeddings
        </div>
        <div className="mb-1.5 flex gap-1">
          <input
            value={embedModel}
            onChange={(event) => setEmbedModel(event.target.value)}
            placeholder="Embedding model"
            className="flex-1 rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg"
          />
        </div>
        <button
          type="button"
          disabled={embedding}
          onClick={() => void runEmbed(embedProvider, embedModel)}
          className="w-full rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent disabled:opacity-50"
        >
          {embedding ? 'Generating…' : 'Generate Embeddings'}
        </button>
        {lastEmbedResult && (
          <p className="mt-1.5 text-xs text-fg-muted">
            Embedded {lastEmbedResult.embedded}, skipped {lastEmbedResult.skipped_unchanged}
            {lastEmbedResult.failed > 0 && `, failed ${lastEmbedResult.failed}`}.
          </p>
        )}
      </div>

      <div className="border-t border-border px-3 py-2 pb-4">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-fg-muted">
          <GitBranch size={12} /> Automatic documentation
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            disabled={diagramBusy !== null}
            onClick={() => void handleDiagram('dependency')}
            className="rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {diagramBusy === 'dependency' ? 'Generating…' : 'Export Dependency Diagram (.mmd)'}
          </button>
          <button
            type="button"
            disabled={diagramBusy !== null}
            onClick={() => void handleDiagram('architecture')}
            className="rounded-md border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent disabled:opacity-50"
          >
            {diagramBusy === 'architecture' ? 'Generating…' : 'Export Architecture Diagram (.mmd)'}
          </button>
        </div>
      </div>
    </aside>
  );
}
