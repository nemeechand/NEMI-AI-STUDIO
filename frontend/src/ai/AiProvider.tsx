import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import { fetchWithStartupRetry } from '../lib/fetchWithStartupRetry';
import {
  AiContext,
  type AiContextValue,
  type PendingAttachment,
  type TokenUsageTotals,
} from './ai-context';
import { defaultModelFor } from './providerDefaults';
import { estimateCostUsd } from './pricing';

const PROVIDER_STORAGE_KEY = 'nemi.ai.selectedProvider';
const MODEL_STORAGE_KEY = 'nemi.ai.selectedModel';

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
  const [providerSettingsMap, setProviderSettingsMap] = useState<Record<string, ProviderSettings>>(
    {},
  );
  // Alpha 2: each cloud provider's REAL, live model catalog (once fetched —
  // see the effect below), keyed by provider id. `SUGGESTED_MODELS` is only
  // ever a curated starting point/datalist (its own doc comment says so);
  // this is the actual source of truth used to catch a stale selected
  // model, the same real discovery ModelsTab's "Refresh Models" button
  // already offered manually — now also applied automatically to Chat.
  const [realModelsMap, setRealModelsMap] = useState<Record<string, string[]>>({});

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

  // Sprint 15.5: each provider's configured base URL lives in
  // `provider_settings` (Settings → AI Providers), not per-message state —
  // loaded once here so `doSend` can attach it automatically.
  const refreshProviderSettings = useCallback(async () => {
    const list = await window.nemi.providers.listSettings();
    setProviderSettingsMap(Object.fromEntries(list.map((row) => [row.provider_id, row])));
  }, []);

  useEffect(() => {
    void refreshProviderSettings();
  }, [refreshProviderSettings]);

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
  // default. Alpha 2: also corrects a *non-empty* but stale selection —
  // e.g. a model that was pulled, selected, then later deleted — the same
  // "stale/invalid model must not silently remain selected" rule applied
  // to the cloud-provider effect below.
  useEffect(() => {
    if (selectedProvider !== 'ollama' || ollamaModels.length === 0) return;
    if (selectedModel && ollamaModels.includes(selectedModel)) return;
    setSelectedModel(ollamaModels[0]);
  }, [selectedProvider, selectedModel, ollamaModels, setSelectedModel]);

  // Alpha 2: fetches the current cloud provider's REAL, live model catalog
  // (the exact same `list_models()` call ModelsTab's "Refresh Models"
  // button already triggers manually) once it's configured — cached per
  // provider for the session, not re-fetched on every render/switch back.
  useEffect(() => {
    if (selectedProvider === 'ollama') return;
    if (!configuredProviders.has(selectedProvider)) return;
    if (realModelsMap[selectedProvider]) return;
    let cancelled = false;
    const baseUrl = providerSettingsMap[selectedProvider]?.base_url ?? null;
    void window.nemi.providers
      .refreshModels(selectedProvider, baseUrl)
      .then((models) => {
        if (cancelled || models.length === 0) return;
        setRealModelsMap((prev) => ({ ...prev, [selectedProvider]: models }));
      })
      .catch(() => {
        // Offline, rate-limited, or the key was revoked mid-session — the
        // real catalog simply stays unknown; the static curated default
        // below remains the honest fallback, not an error state.
      });
    return () => {
      cancelled = true;
    };
  }, [selectedProvider, configuredProviders, providerSettingsMap, realModelsMap]);

  // Alpha 2 bug fix: `selectedModel` was seeded once from `localStorage`
  // and never revisited, so a model that was valid when first picked but
  // has since been retired by the provider (found live: Gemini's
  // `gemini-2.5-flash` returning a real 404 "no longer available to new
  // users") stayed silently selected forever — editing `providerDefaults
  // .ts`'s curated suggestions had no effect on it. Once the provider's
  // REAL catalog is known (the effect above), a selection that isn't
  // actually in it is corrected — preferring the Settings-configured
  // `default_model` if that itself is still real, else the catalog's
  // first entry — never based on the static curated list alone, which is
  // deliberately just a starting-point suggestion, not an authority.
  useEffect(() => {
    const realModels = realModelsMap[selectedProvider];
    if (!realModels || realModels.length === 0) return;
    if (selectedModel && realModels.includes(selectedModel)) return;
    const configuredDefault = providerSettingsMap[selectedProvider]?.default_model;
    const corrected =
      configuredDefault && realModels.includes(configuredDefault)
        ? configuredDefault
        : realModels[0];
    setSelectedModel(corrected);
  }, [realModelsMap, selectedProvider, selectedModel, providerSettingsMap, setSelectedModel]);

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
        latency_ms: null,
        created_at: new Date().toISOString(),
      };
      setActiveMessages((prev) => [...prev, optimisticMessage]);

      try {
        await window.nemi.ai.sendMessage(requestId, {
          conversationId,
          content: trimmed,
          provider: selectedProvider,
          model: selectedModel,
          baseUrl: providerSettingsMap[selectedProvider]?.base_url ?? null,
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
    [
      activeConversationId,
      isStreaming,
      projectId,
      selectedModel,
      selectedProvider,
      providerSettingsMap,
    ],
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

  const openConversation = useCallback(
    (conversationId: string) => {
      setActiveConversationId(conversationId);
      notifyOpenPanel();
    },
    [notifyOpenPanel],
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

  const conversationEstimatedCostUsd = useMemo<number | null>(() => {
    let total = 0;
    for (const message of activeMessages) {
      if (message.role !== 'assistant' || !message.provider || !message.model) continue;
      const cost = estimateCostUsd(
        message.provider,
        message.model,
        message.prompt_tokens ?? 0,
        message.completion_tokens ?? 0,
      );
      if (cost === null) return null;
      total += cost;
    }
    return total;
  }, [activeMessages]);

  const lastResponseMs = useMemo<number | null>(() => {
    for (let i = activeMessages.length - 1; i >= 0; i -= 1) {
      const message = activeMessages[i];
      if (message.role === 'assistant' && message.latency_ms != null) return message.latency_ms;
    }
    return null;
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
      conversationEstimatedCostUsd,
      lastResponseMs,
      askAboutSelection,
      onRequestOpenPanel,
      openConversation,
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
      conversationEstimatedCostUsd,
      lastResponseMs,
      askAboutSelection,
      onRequestOpenPanel,
      openConversation,
    ],
  );

  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}
