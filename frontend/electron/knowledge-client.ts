import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BACKEND_HOST, BACKEND_PORT } from './backend-client';
import { getCommitLog } from './git-status';

const execFileAsync = promisify(execFile);

const REQUEST_TIMEOUT_MS = 30_000; // indexing is bounded (MAX_FILES) and typically fast
// Generating embeddings makes real, sequential provider calls (batches of up
// to 64 texts each) — genuinely slow for a real project's worth of files on
// a local CPU-bound model, so it gets the same generous, explicit-bulk-
// operation timeout as Sprint 13's build/test runners rather than the
// standard API-call budget above.
const EMBED_TIMEOUT_MS = 10 * 60_000;

function baseUrl(): string {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

async function requestJson<T>(
  path: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend returned ${response.status} for ${path}: ${body}`);
  }
  return (await response.json()) as T;
}

function postJson<T>(path: string, body: unknown, timeoutMs?: number): Promise<T> {
  return requestJson(
    path,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    timeoutMs,
  );
}

export type NodeType =
  | 'project'
  | 'file'
  | 'function'
  | 'class'
  | 'agent'
  | 'workflow'
  | 'commit'
  | 'user'
  | 'requirement';
export type Relationship =
  | 'contains'
  | 'defines'
  | 'imports'
  | 'modifies'
  | 'executed_by'
  | 'authored_by'
  | 'implements'
  | 'related_to';

export interface GraphNode {
  id: string;
  project_id: string | null;
  node_type: NodeType;
  label: string;
  ref_id: string | null;
  metadata: Record<string, unknown> | null;
}

export interface GraphEdge {
  id: string;
  project_id: string | null;
  from_node_id: string;
  to_node_id: string;
  relationship: Relationship;
}

export interface KnowledgeGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface KnowledgeStats {
  nodes_by_type: Record<string, number>;
  total_nodes: number;
  total_edges: number;
  files_indexed: number;
  embeddings_count: number;
}

export interface IndexResult {
  files_indexed: number;
  files_removed: number;
  functions_found: number;
  classes_found: number;
  edges_created: number;
  commits_indexed: number;
  truncated: boolean;
  duration_ms: number;
  errors: string[];
}

export interface EmbeddingProviderInfo {
  id: string;
  display_name: string;
  requires_api_key: boolean;
  default_model: string;
}

export interface EmbedResult {
  embedded: number;
  skipped_unchanged: number;
  failed: number;
  provider: string;
  model: string;
}

export type SearchMode = 'semantic' | 'keyword_fallback';

export interface SearchHit {
  entity_type: string;
  entity_id: string;
  score: number;
  preview: string;
}

export interface SearchResult {
  mode: SearchMode;
  fallback_reason: string | null;
  hits: SearchHit[];
}

export interface ImpactResult {
  file: string;
  found: boolean;
  dependents: string[];
  defines: string[];
  related_bugs: string[];
  risk_score: number;
  risk_label: string;
}

export interface DiagramResult {
  mermaid: string;
  node_count: number;
  edge_count: number;
  truncated: boolean;
}

export interface FileContext {
  file: string;
  found_in_graph: boolean;
  imported_by: string[];
  defines: string[];
  related_memory: Array<{ type: string; key: string; value: string; updated_at: string }>;
  risk_score: number;
  risk_label: string;
}

export interface MemoryEntry {
  id: string;
  project_id: string | null;
  type: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

/**
 * Gathers real git history here (Sprint 13's git-ownership rule — Electron
 * owns git access) and hands it to the backend's indexer, which reads the
 * project's files itself (see backend/app/knowledge/indexer.py's docstring
 * for why that's a deliberate, scoped exception to Sprint 5's filesystem
 * ownership rule: read-only batch analysis, not interactive CRUD).
 */
export async function indexProject(projectId: string, projectPath: string): Promise<IndexResult> {
  const commits = await getCommitLog(projectPath, 50);
  return postJson('/knowledge/index', {
    project_id: projectId,
    project_path: projectPath,
    commits: commits.map((c) => ({
      hash: c.hash,
      message: c.message,
      author: c.author,
      date: c.date,
      files: c.files,
    })),
  });
}

export function getGraph(projectId: string): Promise<KnowledgeGraph> {
  return requestJson(`/knowledge/graph?project_id=${encodeURIComponent(projectId)}`);
}

export function getStats(projectId: string): Promise<KnowledgeStats> {
  return requestJson(`/knowledge/stats?project_id=${encodeURIComponent(projectId)}`);
}

export function listEmbeddingProviders(): Promise<EmbeddingProviderInfo[]> {
  return requestJson('/knowledge/embedding-providers');
}

export function generateEmbeddings(input: {
  projectId: string;
  projectPath: string;
  provider: string;
  model: string;
  apiKey?: string | null;
}): Promise<EmbedResult> {
  return postJson(
    '/knowledge/embed',
    {
      project_id: input.projectId,
      project_path: input.projectPath,
      provider: input.provider,
      model: input.model,
      api_key: input.apiKey ?? null,
    },
    EMBED_TIMEOUT_MS,
  );
}

export function searchKnowledge(input: {
  projectId: string;
  query: string;
  provider?: string | null;
  model?: string | null;
  apiKey?: string | null;
}): Promise<SearchResult> {
  return postJson('/knowledge/search', {
    project_id: input.projectId,
    query: input.query,
    provider: input.provider ?? null,
    model: input.model ?? null,
    api_key: input.apiKey ?? null,
  });
}

export function getImpact(projectId: string, file: string): Promise<ImpactResult> {
  const params = new URLSearchParams({ project_id: projectId, file });
  return requestJson(`/knowledge/impact?${params.toString()}`);
}

export async function getFileContext(projectId: string, file: string): Promise<FileContext> {
  const params = new URLSearchParams({ project_id: projectId, file });
  return requestJson(`/knowledge/context?${params.toString()}`);
}

export function getDiagram(
  projectId: string,
  type: 'dependency' | 'architecture',
): Promise<DiagramResult> {
  const params = new URLSearchParams({ project_id: projectId, type });
  return requestJson(`/knowledge/diagram?${params.toString()}`);
}

export function listMemory(
  projectId: string | null,
  type: 'project' | 'conversation' | 'long_term' | 'task' | 'knowledge',
): Promise<MemoryEntry[]> {
  const params = new URLSearchParams({ type });
  if (projectId) params.set('project_id', projectId);
  return requestJson(`/knowledge/memory?${params.toString()}`);
}

/** Architecture Intelligence: real graph/memory context (backend) merged
 * with real git blame (here, Electron) for "who changed it" — never
 * fabricated, and the caller (the AI Chat Panel) attaches this verbatim as
 * retrieval context rather than asking the model to invent history. */
export async function getFileHistorySummary(
  projectPath: string,
  relativePath: string,
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['log', '--follow', '-5', '--pretty=format:%h %an %aI %s', '--', relativePath],
      { cwd: projectPath, timeout: 8_000 },
    );
    return stdout.trim();
  } catch {
    return '';
  }
}
