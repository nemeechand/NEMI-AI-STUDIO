export type LogLevel = 'info' | 'warn' | 'error';

export interface LogEntry {
  id: string;
  level: LogLevel;
  timestamp: string;
  message: string;
}

export const mockLogEntries: LogEntry[] = [
  {
    id: 'log-1',
    level: 'info',
    timestamp: '09:00:00',
    message: 'NEMI AI STUDIO shell initialized.',
  },
  { id: 'log-2', level: 'info', timestamp: '09:00:01', message: 'Frontend renderer mounted.' },
  { id: 'log-3', level: 'warn', timestamp: '09:00:02', message: 'No project loaded yet.' },
];
