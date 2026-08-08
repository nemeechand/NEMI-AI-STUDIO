import type { NotificationKind } from '../../intelligence/intelligence-context';

export const NOTIFICATION_LABELS: Record<NotificationKind, string> = {
  'sprint-completed': 'Sprint Completed',
  'sprint-failed': 'Sprint Failed',
  'build-failed': 'Build Failed',
  'test-failed': 'Tests Failed',
  'agent-waiting': 'Agent Waiting',
  'task-failed': 'API / Task Error',
  'network-error': 'Network Error',
};
