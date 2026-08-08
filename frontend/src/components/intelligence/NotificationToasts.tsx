import { useEffect, useRef, useState } from 'react';
import { useIntelligence } from '../../intelligence/useIntelligence';
import { NOTIFICATION_LABELS } from './notificationLabels';

const TOAST_VISIBLE_MS = 6000;

/**
 * Always-mounted toast overlay (rendered inside IntelligenceCenter, so
 * it's visible whenever the Live Dashboard is open) — a lightweight,
 * auto-fading surface for the same notifications the Notification
 * Center section lists persistently. Toasts never remove anything from
 * the underlying list; they're purely a transient "you might want to
 * look at this now" surface.
 */
export function NotificationToasts() {
  const { notifications } = useIntelligence();
  const [visibleIds, setVisibleIds] = useState<string[]>([]);
  const knownIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const fresh = notifications.filter((n) => !knownIds.current.has(n.id));
    if (fresh.length === 0) return;
    for (const notification of fresh) {
      knownIds.current.add(notification.id);
    }
    setVisibleIds((prev) => [...prev, ...fresh.map((n) => n.id)]);
    for (const notification of fresh) {
      setTimeout(() => {
        setVisibleIds((prev) => prev.filter((id) => id !== notification.id));
      }, TOAST_VISIBLE_MS);
    }
  }, [notifications]);

  const visible = notifications.filter((n) => visibleIds.includes(n.id)).slice(0, 3);
  if (visible.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {visible.map((notification) => (
        <div
          key={notification.id}
          className="w-72 rounded-md border border-border bg-surface-elevated px-3 py-2 shadow-lg"
        >
          <span className="text-[10px] font-medium uppercase tracking-wide text-accent">
            {NOTIFICATION_LABELS[notification.kind]}
          </span>
          <p className="text-xs text-fg">{notification.message}</p>
        </div>
      ))}
    </div>
  );
}
