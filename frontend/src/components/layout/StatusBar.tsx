import { useEffect, useState } from 'react';
import { useTheme } from '../../theme/useTheme';

const POLL_INTERVAL_MS = 5000;

type BackendStatus = 'starting' | 'ready' | 'error' | 'stopped' | 'checking';

const STATUS_LABEL: Record<BackendStatus, string> = {
  starting: 'Backend Starting',
  ready: 'Ready',
  error: 'Backend Offline',
  stopped: 'Backend Stopped',
  checking: 'Checking…',
};

const STATUS_DOT: Record<BackendStatus, string> = {
  starting: 'bg-warning',
  ready: 'bg-success',
  error: 'bg-danger',
  stopped: 'bg-danger',
  checking: 'bg-fg-muted',
};

function formatUptime(seconds: number): string {
  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

export function StatusBar() {
  const { theme } = useTheme();
  const [backendStatus, setBackendStatus] = useState<BackendStatus>('checking');
  const [backendDetail, setBackendDetail] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    async function pollHealth() {
      try {
        const health = await window.nemi.backend.health();
        if (cancelled) return;
        setBackendStatus(health.state);
        setBackendDetail(
          health.version && health.uptimeSeconds !== undefined
            ? `NEMI Backend v${health.version} — up ${formatUptime(health.uptimeSeconds)}`
            : health.message,
        );
      } catch {
        if (!cancelled) setBackendStatus('error');
      }
    }

    void pollHealth();
    const interval = setInterval(() => void pollHealth(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-accent px-3 text-xs text-accent-fg">
      <div className="flex items-center gap-3">
        <span>NEMI AI STUDIO</span>
        <span>Sprint 6 — Stabilization</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="capitalize">{theme} theme</span>
        <span className="flex items-center gap-1" title={backendDetail}>
          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[backendStatus]}`} />
          {STATUS_LABEL[backendStatus]}
        </span>
      </div>
    </footer>
  );
}
