import { createContext } from 'react';

export type NotificationKind =
  | 'sprint-completed'
  | 'sprint-failed'
  | 'build-failed'
  | 'test-failed'
  | 'agent-waiting'
  | 'task-failed'
  | 'network-error';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  message: string;
  createdAt: string;
}

export interface RunnerViewState {
  state: RunnerState;
  output: string[];
  exitCode: number | null;
}

export interface IntelligenceContextValue {
  performanceStats: PerformanceStats | null;
  tokenStats: TokenStats | null;
  history: HistoryEntry[];
  gitStatus: GitStatus | null;
  systemMetrics: SystemMetrics | null;
  availableRunners: AvailableRunners;
  runners: Record<RunnerId, RunnerViewState>;
  runBuild: () => Promise<void>;
  runTests: () => Promise<void>;
  runVerification: () => Promise<void>;
  cancelRunner: (runnerId: RunnerId) => Promise<void>;
  notifications: AppNotification[];
  dismissNotification: (id: string) => void;
  clearNotifications: () => void;
  refresh: () => Promise<void>;
}

export const IntelligenceContext = createContext<IntelligenceContextValue | null>(null);
