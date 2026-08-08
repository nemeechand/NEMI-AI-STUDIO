import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import {
  AiContext,
  type AiContextValue,
  type PendingAttachment,
  type TokenUsageTotals,
} from './ai-context';
import { defaultModelFor } from './providerDefaults';

const PROVIDER_STORAGE_KEY = 'nemi.ai.selectedProvider';
const MODEL_STORAGE_KEY = 'nemi.ai.selectedModel';

// Matches backend-process.ts's own STARTUP_TIMEOUT_MS (15s) as the ceiling
// for "the backend is still starting, not actually broken" — the dev
// backend (a cold `python -m app.main`, not the packaged PyInstaller exe)
// can take several seconds to become reachable. Without retrying, a fetch
// that loses this race on first app launch fails permanently: nothing else
// ever re-triggers it, so the provider dropdown would stay empty for the
// whole session even though the backend comes up moments later.
const STARTUP_RETRY_ATTEMPTS = 10;
const STARTUP_RETRY_DELAY_MS = 1500;

async function fetchWithStartupRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < STARTUP_RETRY_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, STARTUP_RETRY_DELAY_MS));
    }
  }
  throw lastError;
}

function readStoredProvider(): string {
  return window.localStorage.getItem(PROVIDER_STORAGE_KEY) ?? 'ollama';
}

function readStoredModel(provider: string): string {
  const stored = window.localStorage.getItem(MODEL_STORAGE_KEY);
  return stored || defaultModelFor(provider);
}

export function AiProvider({ children }: { children: ReactNode }) {
  const { projectId } = useProject();

  const [providers, setProviders] = useState<AiProviderInfo[]>([]);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [configuredProviders, setConfiguredProviders] = useState<Set<string>>(new Set());

  const [selectedProvider, setSelectedProviderState] = useState<string>(readStoredProvider);
  const [selectedModel, setSelectedModelState] = useState<string>(() =>
    readStoredModel(readStoredProvider()),
  );

  const [conversations, setConversations] = useState<AiConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [activeMessages, setActiveMessages] = useState<AiMessage[]>([]);

  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [draftContent, setDraftContent] = useState('');

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  const currentRequestIdRef = useRef<string | null>(null);
  const openPanelListenersRef = useRef<Set<() => void>>(new Set());

  // --- Load providers once, then which ones already have a key saved. ---
  useEffect(() => {
    let cancelled = false;
    void fetchWithStartupRetry(() => window.nemi.ai.listProviders()).then((list) => {
      if (!cancelled) setProviders(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshConfiguredProviders = useCallback(async () => {
    if (providers.length === 0) return;
    const results = await Promise.all(
      providers.map(async (p) => {
        const has = p.requires_api_key
          ? await window.nemi.ai.hasApiKey(p.id as AiProviderId)
          : true;
        return [p.id, has] as const;
      }),
    );
    setConfiguredProviders(new Set(results.filter(([, has]) => has).map(([id]) => id)));
  }, [providers]);

  useEffect(() => {
    void refreshConfiguredProviders();
  }, [refreshConfiguredProviders]);

  useEffect(() => {
    if (selectedProvider !== 'ollama') return;
    void window.nemi.ai
      .listOllamaModels()
      .then(setOllamaModels)
      .catch(() => setOllamaModels([]));
  }, [selectedProvider]);

  const setSelectedProvider = useCallback((provider: string) => {
    setSelectedProviderState(provider);
    window.localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
    const model = defaultModelFor(provider);
    setSelectedModelState(model);
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, []);

  const setSelectedModel = useCallback((model: string) => {
    setSelectedModelState(model);
    window.localStorage.setItem(MODEL_STORAGE_KEY, model);
  }, []);

  // Ollama has no hardcoded "default model" (unlike the cloud providers —
  // there's no stable catalog to pick a sane default from, it's whatever
  // the user happens to have pulled locally), so `selectedModel` starts
  // empty whenever Ollama is selected fresh. Found live: sending with an
  // empty model string reaches the backend and is correctly rejected
  // (422), but nothing in the UI prompted the user to pick one first — the
  // send just silently failed. Auto-selecting the first locally-available
  // model once the real list loads closes that gap without a fabricated
  // default.
  useEffect(() => {
    if (selectedProvider !== 'ollama' || selectedModel !== '' || ollamaModels.length === 0) return;
    setSelectedModel(ollamaModels[0]);
  }, [selectedProvider, selectedModel, ollamaModels, setSelectedModel]);

  // --- Conversations scoped to the active project (Sprint 10: context-aware
  // chat using the active workspace). Switching projects resets the view,
  // matching how the Explorer/Workspace panels already behave per project. ---
  useEffect(() => {
    let cancelled = false;
    void fetchWithStartupRetry(() => window.nemi.ai.listConversations(projectId)).then((list) => {
      if (cancelled) return;
      setConversations(list);
      setActiveConversationId(null);
      setActiveMessages([]);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!activeConversationId) {
      setActiveMessages([]);
      return;
    }
    let cancelled = false;
    void window.nemi.ai.listMessages(activeConversationId).then((messages) => {
      if (!cancelled) setActiveMessages(messages);
    });
    return () => {
      cancelled = true;
    };
  }, [activeConversationId]);

  // --- Streaming events, filtered to the in-flight request only: a stale
  // event from a just-cancelled or just-superseded request must never
  // touch state for whatever request is active now. ---
  useEffect(() => {
    return window.nemi.ai.onStreamEvent((payload) => {
      if (payload.requestId !== currentRequestIdRef.current) return;
      if (payload.event === 'chunk') {
        setStreamingText((prev) => prev + String(payload.data.delta ?? ''));
      } else if (payload.event === 'error') {
        setLastError(String(payload.data.message ?? 'The AI request failed.'));
      }
    });
  }, []);

  const notifyOpenPanel = useCallback(() => {
    openPanelListenersRef.current.forEach((listener) => listener());
  }, []);

  const onRequestOpenPanel = useCallback((listener: () => void) => {
    openPanelListenersRef.current.add(listener);
    return () => {
      openPanelListenersRef.current.delete(listener);
    };
  }, []);

  const doSend = useCallback(
    async (content: string, attachments: PendingAttachment[]) => {
      const trimmed = content.trim();
      if (!trimmed || isStreaming) return;

      setLastError(null);

      // Belt-and-suspenders alongside the auto-select effect above: that
      // effect covers the common case (Ollama models loading in), but a
      // provider with zero local models installed, or a cloud provider
      // whose model field the user cleared, can still reach here empty.
      // Found live: sending with an empty model reached the backend and
      // was correctly rejected (422) — but nothing surfaced to the user,
      // it just failed silently. Catching it here, before any network
      // call, gives a clear, immediate message instead.
      if (!selectedModel.trim()) {
        setLastError('Choose a model before sending — the model field is empty.');
        return;
      }

      let conversationId = activeConversationId;
      if (!conversationId) {
        const title = trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
        let created: AiConversation;
        try {
          created = await window.nemi.ai.createConversation({
            projectId,
            title,
            provider: selectedProvider,
            model: selectedModel,
          });
        } catch (error) {
          setLastError(error instanceof Error ? error.message : 'Failed to start a conversation.');
          return;
        }
        conversationId = created.id;
        setConversations((prev) => [created, ...prev]);
        setActiveConversationId(conversationId);
      }

      const requestId = crypto.randomUUID();
      currentRequestIdRef.current = requestId;
      setIsStreaming(true);
      setStreamingText('');

      const optimisticMessage: AiMessage = {
        id: `pending-${requestId}`,
        conversation_id: conversationId,
        role: 'user',
        content: trimmed,
        provider: null,
        model: null,
        status: 'complete',
        error_message: null,
        prompt_tokens: null,
        completion_tokens: null,
        context_refs: attachments.map((a) => ({
          path: a.path,
          start_line: a.startLine ?? null,
          end_line: a.endLine ?? null,
        })),
        created_at: new Date().toISOString(),
      };
      setActiveMessages((prev) => [...prev, optimisticMessage]);

      try {
        await window.nemi.ai.sendMessage(requestId, {
          conversationId,
          content: trimmed,
          provider: selectedProvider,
          model: selectedModel,
          contextRefs: attachments.map((a) => ({
            path: a.path,
            content: a.content,
            startLine: a.startLine,
            endLine: a.endLine,
          })),
        });
      } catch (error) {
        // Reachable if the initial POST itself fails (e.g. the backend is
        // unreachable) — distinct from an in-stream provider error, which
        // arrives as a normal SSE `error` event and is handled by the
        // onStreamEvent listener instead.
        setLastError(error instanceof Error ? error.message : 'Failed to send the message.');
      } finally {
        currentRequestIdRef.current = null;
        setIsStreaming(false);
        setStreamingText('');
        const [messages, updatedList] = await Promise.all([
          window.nemi.ai.listMessages(conversationId),
          window.nemi.ai.listConversations(projectId),
        ]);
        setActiveMessages(messages);
        setConversations(updatedList);
      }
    },
    [activeConversationId, isStreaming, projectId, selectedModel, selectedProvider],
  );

  const sendMessage = useCallback(
    async (content: string) => {
      const attachments = pendingAttachments;
      setPendingAttachments([]);
      setDraftContent('');
      await doSend(content, attachments);
    },
    [doSend, pendingAttachments],
  );

  const cancelActiveMessage = useCallback(() => {
    if (!currentRequestIdRef.current) return;
    void window.nemi.ai.cancelMessage(currentRequestIdRef.current);
  }, []);

  const askAboutSelection = useCallback<AiContextValue['askAboutSelection']>(
    ({ prompt, path, content, startLine, endLine, autoSend }) => {
      const attachment: PendingAttachment = { path, content, startLine, endLine };
      notifyOpenPanel();
      if (autoSend) {
        void doSend(prompt, [attachment]);
      } else {
        setDraftContent(prompt);
        setPendingAttachments((prev) => [...prev, attachment]);
      }
    },
    [doSend, notifyOpenPanel],
  );

  const conversationTokenTotals = useMemo<TokenUsageTotals>(() => {
    return activeMessages.reduce(
      (totals, message) => ({
        promptTokens: totals.promptTokens + (message.prompt_tokens ?? 0),
        completionTokens: totals.completionTokens + (message.completion_tokens ?? 0),
      }),
      { promptTokens: 0, completionTokens: 0 },
    );
  }, [activeMessages]);

  const value = useMemo<AiContextValue>(
    () => ({
      providers,
      ollamaModels,
      configuredProviders,
      refreshConfiguredProviders,
      selectedProvider,
      selectedModel,
      setSelectedProvider,
      setSelectedModel,
      conversations,
      activeConversationId,
      activeMessages,
      selectConversation: setActiveConversationId,
      newConversation: () => setActiveConversationId(null),
      renameConversation: async (id: string, title: string) => {
        const updated = await window.nemi.ai.renameConversation(id, title);
        setConversations((prev) => prev.map((c) => (c.id === id ? updated : c)));
      },
      deleteConversation: async (id: string) => {
        await window.nemi.ai.deleteConversation(id);
        setConversations((prev) => prev.filter((c) => c.id !== id));
        if (activeConversationId === id) setActiveConversationId(null);
      },
      pendingAttachments,
      addAttachment: (attachment: PendingAttachment) =>
        setPendingAttachments((prev) => [...prev, attachment]),
      removeAttachment: (index: number) =>
        setPendingAttachments((prev) => prev.filter((_, i) => i !== index)),
      clearAttachments: () => setPendingAttachments([]),
      draftContent,
      setDraftContent,
      sendMessage,
      cancelActiveMessage,
      isStreaming,
      streamingText,
      lastError,
      conversationTokenTotals,
      askAboutSelection,
      onRequestOpenPanel,
    }),
    [
      providers,
      ollamaModels,
      configuredProviders,
      refreshConfiguredProviders,
      selectedProvider,
      selectedModel,
      setSelectedProvider,
      setSelectedModel,
      conversations,
      activeConversationId,
      activeMessages,
      pendingAttachments,
      draftContent,
      sendMessage,
      cancelActiveMessage,
      isStreaming,
      streamingText,
      lastError,
      conversationTokenTotals,
      askAboutSelection,
      onRequestOpenPanel,
    ],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}
