export {};

type BackendState = 'starting' | 'ready' | 'error' | 'stopped';

interface BackendHealth {
  state: BackendState;
  port: number;
  message?: string;
}

declare global {
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
      };
    };
  }
}
