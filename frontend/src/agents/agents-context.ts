import { createContext } from 'react';

export interface AgentsContextValue {
  agents: AgentInfo[];
  tasks: AgentTask[];
  createPipeline: (input: {
    title: string;
    description: string;
    provider: string;
    model: string;
    priority?: number;
    stages?: AgentRoleKey[];
  }) => Promise<AgentTask[]>;
  cancelTask: (taskId: string) => Promise<void>;
  retryTask: (taskId: string) => Promise<void>;
  applyProposedFile: (projectPath: string, file: ProposedFile) => Promise<void>;
  refresh: () => Promise<void>;
}

export const AgentsContext = createContext<AgentsContextValue | null>(null);
