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

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  planning: 'Planning',
  queued: 'Queued',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const WORKFLOW_STATUS_DOT_CLASS: Record<WorkflowStatus, string> = {
  planning: 'bg-fg-muted',
  queued: 'bg-fg-muted',
  running: 'bg-accent',
  paused: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-danger',
  cancelled: 'bg-fg-muted',
};

export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
  pending: 'Pending',
  queued: 'Queued',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled',
};

export const APPROVAL_MODE_LABELS: Record<ApprovalMode, string> = {
  auto: 'Fully Automatic',
  review: 'Review Before Apply',
  manual: 'Manual Approval',
};
