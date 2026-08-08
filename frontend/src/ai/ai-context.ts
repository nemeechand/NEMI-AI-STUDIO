import { createContext } from 'react';

export interface PendingAttachment {
  path: string;
  content: string;
  startLine?: number;
  endLine?: number;
}

export interface TokenUsageTotals {
  promptTokens: number;
  completionTokens: number;
}

export interface AiContextValue {
  providers: AiProviderInfo[];
  ollamaModels: string[];
  configuredProviders: Set<string>;
  refreshConfiguredProviders: () => Promise<void>;

  selectedProvider: string;
  selectedModel: string;
  setSelectedProvider: (provider: string) => void;
  setSelectedModel: (model: string) => void;

  conversations: AiConversation[];
  activeConversationId: string | null;
  activeMessages: AiMessage[];
  selectConversation: (id: string | null) => void;
  newConversation: () => void;
  renameConversation: (id: string, title: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;

  pendingAttachments: PendingAttachment[];
  addAttachment: (attachment: PendingAttachment) => void;
  removeAttachment: (index: number) => void;
  clearAttachments: () => void;

  /** ChatInput's textarea is a controlled component bound to this, so
   * editor actions (Explain/Fix/.../"Ask AI") can seed it programmatically
   * from anywhere in the app, not just from within the chat panel itself. */
  draftContent: string;
  setDraftContent: (content: string) => void;

  sendMessage: (content: string) => Promise<void>;
  cancelActiveMessage: () => void;
  isStreaming: boolean;
  streamingText: string;
  lastError: string | null;
  conversationTokenTotals: TokenUsageTotals;

  /** Opens the chat panel (if collapsed), optionally seeding the input and
   * attaching a code selection — the single entry point every editor
   * context-menu AI action and Command Palette entry funnels through. */
  askAboutSelection: (params: {
    prompt: string;
    path: string;
    content: string;
    startLine?: number;
    endLine?: number;
    autoSend?: boolean;
  }) => void;
  onRequestOpenPanel: (listener: () => void) => () => void;

  /** Opens the chat panel and switches straight to an existing
   * conversation by id — used by the Agents Dashboard to jump from a
   * task into the exact exchange that did its work. */
  openConversation: (conversationId: string) => void;
}

export const AiContext = createContext<AiContextValue | null>(null);
