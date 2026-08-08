import { ClipboardList, Code2, Eye, FlaskConical, type LucideIcon } from 'lucide-react';

export const ROLE_LABELS: Record<AgentRoleKey, string> = {
  planner: 'Planner',
  developer: 'Developer',
  reviewer: 'Reviewer',
  tester: 'Tester',
};

export const ROLE_ICONS: Record<AgentRoleKey, LucideIcon> = {
  planner: ClipboardList,
  developer: Code2,
  reviewer: Eye,
  tester: FlaskConical,
};

export const STATUS_LABELS: Record<AgentTaskStatus, string> = {
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const STATUS_DOT_CLASS: Record<AgentTaskStatus, string> = {
  queued: 'bg-fg-muted',
  running: 'bg-accent',
  completed: 'bg-success',
  failed: 'bg-danger',
  cancelled: 'bg-fg-muted',
};
