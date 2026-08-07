export function formatRelativeTime(isoTimestamp: string): string {
  const then = new Date(isoTimestamp).getTime();
  if (Number.isNaN(then)) return isoTimestamp;

  const diffSeconds = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (diffSeconds < 60) return 'just now';

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;

  const diffMonths = Math.round(diffDays / 30);
  return `${diffMonths}mo ago`;
}
