export {};

declare global {
  type BackendState = 'starting' | 'ready' | 'error' | 'stopped';

  interface BackendHealth {
    state: BackendState;
    port: number;
    message?: string;
    version?: string;
    uptimeSeconds?: number;
  }

  type LogLevel = 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';

  interface LogEntry {
    id: string;
    project_id: string | null;
    level: LogLevel;
    source: string;
    message: string;
    created_at: string;
  }

  type ExplorerEntryType = 'file' | 'folder';

  interface ExplorerEntry {
    name: string;
    path: string;
    type: ExplorerEntryType;
  }

  interface SearchMatch {
    path: string;
    line: number;
    column: number;
    lineText: string;
  }

  interface SearchOptions {
    caseSensitive?: boolean;
    useRegex?: boolean;
  }

  interface ProjectRecord {
    id: string;
    name: string;
    path: string;
    description: string | null;
    created_at: string;
    updated_at: string;
    last_opened_at: string | null;
  }

  type AiProviderId = 'openai' | 'anthropic' | 'gemini' | 'ollama';

  interface AiProviderInfo {
    id: string;
    display_name: string;
    requires_api_key: boolean;
  }

  interface AiConversation {
    id: string;
    project_id: string | null;
    title: string;
    provider: string;
    model: string;
    created_at: string;
    updated_at: string;
  }

  interface AiContextRef {
    path: string;
    start_line: number | null;
    end_line: number | null;
  }

  type AiMessageRole = 'user' | 'assistant' | 'system';
  type AiMessageStatus = 'complete' | 'cancelled' | 'error';

  interface AiMessage {
    id: string;
    conversation_id: string;
    role: AiMessageRole;
    content: string;
    provider: string | null;
    model: string | null;
    status: AiMessageStatus;
    error_message: string | null;
    prompt_tokens: number | null;
    completion_tokens: number | null;
    context_refs: AiContextRef[] | null;
    created_at: string;
  }

  interface AiContextRefInput {
    path: string;
    content: string;
    startLine?: number;
    endLine?: number;
  }

  type AiStreamEventName = 'chunk' | 'usage' | 'done' | 'error';

  interface AiStreamEventPayload {
    requestId: string;
    event: AiStreamEventName;
    data: Record<string, unknown>;
  }

  interface Window {
    nemi: {
      windowControls: {
        minimize: () => Promise<void>;
        maximizeToggle: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizedChange: (callback: (isMaximized: boolean) => void) => () => void;
      };
      backend: {
        health: () => Promise<BackendHealth>;
        logs: (limit?: number) => Promise<LogEntry[]>;
      };
      fs: {
        selectProjectFolder: () => Promise<string | null>;
        selectDirectory: () => Promise<string | null>;
        openProject: (projectPath: string) => Promise<boolean>;
        closeProject: () => Promise<void>;
        listDirectory: (dirPath: string) => Promise<ExplorerEntry[]>;
        readFile: (filePath: string) => Promise<string>;
        writeFile: (filePath: string, content: string) => Promise<void>;
        createFile: (dirPath: string, name: string) => Promise<string>;
        createDirectory: (parentPath: string, name: string) => Promise<string>;
        renameEntry: (entryPath: string, newName: string) => Promise<string>;
        deleteEntry: (entryPath: string) => Promise<void>;
        listAllFiles: (rootPath: string) => Promise<string[]>;
        searchInFiles: (
          rootPath: string,
          query: string,
          options?: SearchOptions,
        ) => Promise<SearchMatch[]>;
        onChange: (callback: (event: { path: string }) => void) => () => void;
      };
      projects: {
        listRecent: (limit?: number) => Promise<ProjectRecord[]>;
        recordOpened: (path: string, name: string, description?: string) => Promise<ProjectRecord>;
        remove: (id: string) => Promise<void>;
      };
      ai: {
        listProviders: () => Promise<AiProviderInfo[]>;
        listOllamaModels: () => Promise<string[]>;
        hasApiKey: (provider: AiProviderId) => Promise<boolean>;
        setApiKey: (provider: AiProviderId, apiKey: string) => Promise<void>;
        clearApiKey: (provider: AiProviderId) => Promise<void>;
        listConversations: (projectId: string | null) => Promise<AiConversation[]>;
        createConversation: (input: {
          projectId: string | null;
          title: string;
          provider: string;
          model: string;
        }) => Promise<AiConversation>;
        renameConversation: (id: string, title: string) => Promise<AiConversation>;
        deleteConversation: (id: string) => Promise<void>;
        listMessages: (conversationId: string) => Promise<AiMessage[]>;
        sendMessage: (
          requestId: string,
          input: {
            conversationId: string;
            content: string;
            provider: string;
            model: string;
            contextRefs?: AiContextRefInput[];
          },
        ) => Promise<void>;
        cancelMessage: (requestId: string) => Promise<boolean>;
        onStreamEvent: (callback: (payload: AiStreamEventPayload) => void) => () => void;
      };
    };
  }
}
