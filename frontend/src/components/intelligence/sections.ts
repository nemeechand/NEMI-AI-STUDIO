import {
  Activity,
  Bell,
  Boxes,
  Brain,
  Cpu,
  GitBranch,
  History,
  PlayCircle,
  Terminal,
  TrendingUp,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';

export type SectionId =
  | 'sprint'
  | 'agents'
  | 'workflow'
  | 'terminal'
  | 'thinking'
  | 'resources'
  | 'tokens'
  | 'build'
  | 'control'
  | 'history'
  | 'notifications'
  | 'performance';

export const SECTIONS: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: 'sprint', label: 'Sprint Center', icon: Activity },
  { id: 'agents', label: 'Agent Monitor', icon: Users },
  { id: 'workflow', label: 'Workflow View', icon: Workflow },
  { id: 'terminal', label: 'Terminal', icon: Terminal },
  { id: 'thinking', label: 'AI Thinking', icon: Brain },
  { id: 'resources', label: 'Resources', icon: Cpu },
  { id: 'tokens', label: 'Tokens & Cost', icon: Boxes },
  { id: 'build', label: 'Build Center', icon: GitBranch },
  { id: 'control', label: 'Pause / Resume', icon: PlayCircle },
  { id: 'history', label: 'History', icon: History },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'performance', label: 'Performance', icon: TrendingUp },
];

export const STATUS_DOT: Record<string, string> = {
  idle: 'bg-fg-muted',
  running: 'bg-accent',
  waiting: 'bg-warning',
  completed: 'bg-success',
  failed: 'bg-danger',
  retrying: 'bg-warning',
};

export function formatDuration(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

export function formatCost(value: number | null): string {
  return value === null ? 'unknown' : `$${value.toFixed(4)}`;
}
