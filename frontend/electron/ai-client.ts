import { BACKEND_HOST, BACKEND_PORT } from './backend-client';

const REQUEST_TIMEOUT_MS = 10_000;

function baseUrl(): string {
  return `http://${BACKEND_HOST}:${BACKEND_PORT}`;
}

export interface AiProviderInfo {
  id: string;
  display_name: string;
  requires_api_key: boolean;
  supports_base_url: boolean;
}

export interface AiConversation {
  id: string;
  project_id: string | null;
  title: string;
  provider: string;
  model: string;
  agent_id: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AiContextRef {
  path: string;
  start_line: number | null;
  end_line: number | null;
}

export interface AiMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  provider: string | null;
  model: string | null;
  status: 'complete' | 'cancelled' | 'error';
  error_message: string | null;
  prompt_tokens: number | null;
  completion_tokens: number | null;
  context_refs: AiContextRef[] | null;
  created_at: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Backend returned ${response.status} for ${path}: ${body}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export function listAiProviders(): Promise<AiProviderInfo[]> {
  return requestJson('/ai/providers');
}

export function listOllamaModels(): Promise<string[]> {
  return requestJson('/ai/ollama/models');
}

export function listConversations(projectId: string | null): Promise<AiConversation[]> {
  const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : '';
  return requestJson(`/ai/conversations${query}`);
}

export function createConversation(input: {
  projectId: string | null;
  title: string;
  provider: string;
  model: string;
}): Promise<AiConversation> {
  return requestJson('/ai/conversations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project_id: input.projectId,
      title: input.title,
      provider: input.provider,
      model: input.model,
    }),
  });
}

export function renameConversation(id: string, title: string): Promise<AiConversation> {
  return requestJson(`/ai/conversations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
}

export function deleteConversation(id: string): Promise<void> {
  return requestJson(`/ai/conversations/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function listMessages(conversationId: string): Promise<AiMessage[]> {
  return requestJson(`/ai/conversations/${encodeURIComponent(conversationId)}/messages`);
}

export interface AiContextRefInput {
  path: string;
  content: string;
  startLine?: number;
  endLine?: number;
}

export interface SendMessageInput {
  conversationId: string;
  content: string;
  provider: string;
  model: string;
  apiKey: string | null;
  baseUrl?: string | null;
  contextRefs?: AiContextRefInput[];
}

export type StreamEventName = 'chunk' | 'usage' | 'done' | 'error';

export interface StreamEventPayload {
  requestId: string;
  event: StreamEventName;
  data: Record<string, unknown>;
}

const activeStreams = new Map<string, AbortController>();

/**
 * Streams a message and invokes `onEvent` for every SSE frame relayed from
 * the backend. Resolves once the stream ends (normally, cancelled, or
 * errored) — callers await this to know the whole exchange is over, while
 * `onEvent` delivers incremental progress as it happens (same "push events
 * as they occur, resolve when done" shape as everything else that's
 * genuinely asynchronous in this codebase).
 */
export async function streamMessage(
  requestId: string,
  input: SendMessageInput,
  onEvent: (payload: StreamEventPayload) => void,
): Promise<void> {
  const controller = new AbortController();
  activeStreams.set(requestId, controller);

  try {
    const response = await fetch(
      `${baseUrl()}/ai/conversations/${encodeURIComponent(input.conversationId)}/messages/stream`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: input.content,
          provider: input.provider,
          model: input.model,
          api_key: input.apiKey,
          base_url: input.baseUrl ?? null,
          context_refs: input.contextRefs?.map((ref) => ({
            path: ref.path,
            content: ref.content,
            start_line: ref.startLine ?? null,
            end_line: ref.endLine ?? null,
          })),
        }),
        signal: controller.signal,
      },
    );

    if (!response.ok || !response.body) {
      onEvent({
        requestId,
        event: 'error',
        data: { code: 'network_error', message: `Backend returned ${response.status}` },
      });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.indexOf('\n\n');
      while (separatorIndex !== -1) {
        const rawEvent = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);
        parseSseEvent(rawEvent, requestId, onEvent);
        separatorIndex = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      onEvent({ requestId, event: 'done', data: { messageId: null, status: 'cancelled' } });
    } else {
      onEvent({
        requestId,
        event: 'error',
        data: {
          code: 'network_error',
          message: error instanceof Error ? error.message : String(error),
        },
      });
    }
  } finally {
    activeStreams.delete(requestId);
  }
}

function parseSseEvent(
  rawEvent: string,
  requestId: string,
  onEvent: (payload: StreamEventPayload) => void,
): void {
  const lines = rawEvent.split('\n');
  const eventLine = lines.find((line) => line.startsWith('event:'));
  const dataLine = lines.find((line) => line.startsWith('data:'));
  if (!eventLine || !dataLine) return;

  const eventName = eventLine.slice('event:'.length).trim() as StreamEventName;
  try {
    const data = JSON.parse(dataLine.slice('data:'.length).trim()) as Record<string, unknown>;
    onEvent({ requestId, event: eventName, data });
  } catch {
    // A malformed frame is a backend bug, not a reason to crash the
    // renderer — surface it as a normal stream error instead.
    onEvent({
      requestId,
      event: 'error',
      data: { code: 'internal_error', message: 'Received a malformed response from the server.' },
    });
  }
}

export function cancelMessageStream(requestId: string): boolean {
  const controller = activeStreams.get(requestId);
  if (!controller) return false;
  controller.abort();
  return true;
}
