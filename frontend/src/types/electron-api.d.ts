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
    };
  }
}
