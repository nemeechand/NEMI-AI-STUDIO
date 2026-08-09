import { useEffect, useState } from 'react';
import { CheckCircle2, HeartPulse, XCircle } from 'lucide-react';
import { DashboardCard } from './DashboardCard';

const POLL_INTERVAL_MS = 15000;

/**
 * Sprint 15.6: replaces the old static/stale "Sprint Progress" card
 * (see dashboardData.ts's note) with a real, live glance at system
 * health — reusing the exact same `GET /health/full` endpoint the Live
 * Dashboard's Health Center section polls, not a second implementation.
 * This card is deliberately compact (backend/database/providers/ollama
 * only, no CPU/memory/disk detail); the full breakdown with every
 * signal and an overall score lives in the Health Center itself
 * (Ctrl+Shift+I).
 */
export function SystemHealthCard() {
  const [health, setHealth] = useState<FullHealthResponse | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const result = await window.nemi.backend.getFullHealth();
        if (!cancelled) {
          setHealth(result);
          setError(false);
        }
      } catch {
        if (!cancelled) setError(true);
      }
    }
    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const reachable = health !== null && !error;

  return (
    <DashboardCard title="System Health" icon={<HeartPulse size={14} />}>
      {!reachable ? (
        <p className="flex items-center gap-2 text-sm text-danger">
          <XCircle size={16} /> Backend unreachable
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          <Row label="Backend" ok detail={`v${health.version}`} />
          <Row
            label="Database"
            ok={health.database.ok}
            detail={health.database.ok ? undefined : (health.database.message ?? 'unavailable')}
          />
          <Row
            label="AI Providers"
            ok={health.providers.errors_total === 0}
            detail={`${health.providers.connected}/${health.providers.total} connected`}
          />
          <Row
            label="Ollama"
            ok={!health.ollama.installed || health.ollama.server_running}
            detail={health.ollama.installed ? undefined : 'not installed'}
          />
        </ul>
      )}
      <p className="mt-2 text-xs text-fg-muted">
        Full breakdown in the Live Dashboard's Health Center (Ctrl+Shift+I).
      </p>
    </DashboardCard>
  );
}

function Row({ label, ok, detail }: { label: string; ok: boolean; detail?: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 text-fg">
        {ok ? (
          <CheckCircle2 size={14} className="shrink-0 text-success" />
        ) : (
          <XCircle size={14} className="shrink-0 text-danger" />
        )}
        {label}
      </span>
      {detail && <span className="truncate text-xs text-fg-muted">{detail}</span>}
    </li>
  );
}
