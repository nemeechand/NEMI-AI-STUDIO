import { createContext } from 'react';

export interface WorkflowsContextValue {
  workflows: Workflow[];
  selectedWorkflow: WorkflowDetail | null;
  selectWorkflow: (id: string | null) => void;
  createWorkflow: (input: {
    title: string;
    goal: string;
    provider: string;
    model: string;
    approvalMode: ApprovalMode;
  }) => Promise<Workflow>;
  pauseWorkflow: (id: string) => Promise<void>;
  resumeWorkflow: (id: string) => Promise<void>;
  cancelWorkflow: (id: string) => Promise<void>;
  approveTask: (taskId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

export const WorkflowsContext = createContext<WorkflowsContextValue | null>(null);
