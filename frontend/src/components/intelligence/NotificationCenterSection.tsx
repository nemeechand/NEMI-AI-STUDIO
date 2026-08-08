import { X } from 'lucide-react';
import { useIntelligence } from '../../intelligence/useIntelligence';
import { NOTIFICATION_LABELS } from './notificationLabels';

export function NotificationCenterSection() {
  const { notifications, dismissNotification, clearNotifications } = useIntelligence();

  return (
    <div className="max-w-2xl space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-fg">
          {notifications.length} notification{notifications.length === 1 ? '' : 's'}
        </p>
        {notifications.length > 0 && (
          <button
            type="button"
            onClick={clearNotifications}
            className="text-[11px] text-fg-muted hover:text-fg"
          >
            Clear all
          </button>
        )}
      </div>
      {notifications.length === 0 && (
        <p className="text-xs text-fg-muted">
          Nothing yet — you'll see Sprint Completed/Failed, Build/Test Failed, Agent Waiting, and
          Network Error notifications here as they happen.
        </p>
      )}
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className="flex items-start justify-between gap-2 rounded border border-border px-2.5 py-1.5 text-xs"
        >
          <div>
            <span className="mr-1.5 rounded bg-surface-elevated px-1.5 py-0.5 text-[10px] text-fg-muted">
              {NOTIFICATION_LABELS[notification.kind]}
            </span>
            <span className="text-fg">{notification.message}</span>
            <div className="text-[10px] text-fg-muted">
              {new Date(notification.createdAt).toLocaleString()}
            </div>
          </div>
          <button
            type="button"
            onClick={() => dismissNotification(notification.id)}
            className="shrink-0 text-fg-muted hover:text-fg"
            aria-label="Dismiss"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
