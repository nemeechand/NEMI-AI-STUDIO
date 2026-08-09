import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { useIntelligence } from '../../intelligence/useIntelligence';
import { useProject } from '../../project/useProject';
import { basename } from '../../project/pathUtils';

const FULL_HEALTH_POLL_MS = 10000;

type CheckState = 'ok' | 'warning' | 'critical' | 'unknown';

interface Check {
  label: string;
  state: CheckState;
  detail: string;
}

function StateDot({ state }: { state: CheckState }) {
  const cls =
    state === 'ok'
      ? 'bg-success'
      : state === 'warning'
        ? 'bg-warning'
        : state === 'critical'
          ? 'bg-danger'
          : 'bg-fg-muted';
  return <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cls}`} />;
}

function CheckRow({ check }: { check: Check }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-1.5 last:border-b-0">
      <span className="flex items-center gap-2 text-xs text-fg">
        <StateDot state={check.state} />
        {check.label}
      </span>
      <span className="truncate text-right text-[11px] text-fg-muted">{check.detail}</span>
    </div>
  );
}

function percentState(percent: number | null | undefined): CheckState {
  if (percent == null) return 'unknown';
  if (percent >= 90) return 'critical';
  if (percent >= 75) return 'warning';
  return 'ok';
}

/**
 * Sprint 15.6's single unified Health Center — a production-stabilization
 * audit found backend health, resource usage, and log polling each
 * independently re-implemented in up to three different places
 * (StatusBar, ResourceMonitorSection, SprintProgressCenter). Rather than
 * add a fourth, this section reuses `useIntelligence()`'s already-polled
 * `systemMetrics`/`gitStatus`/`availableRunners`/`runners` for the
 * Electron/renderer-owned signals (CPU/memory/disk/git/build) and adds
 * exactly one new poll — `GET /health/full` — for the backend-owned
 * signals (backend/database/Python/AI providers/Ollama/internet) that
 * genuinely didn't exist anywhere yet. Workspace status reuses
 * `useProject()`, the same hook every project-scoped panel already uses.
 */
export function HealthCenterSection() {
  const { systemMetrics, gitStatus, availableRunners, runners } = useIntelligence();
  const { projectPath } = useProject();
  const [fullHealth, setFullHealth] = useState<FullHealthResponse | null>(null);
  const [fullHealthError, setFullHealthError] = useState(false);
  const [restarting, setRestarting] = useState(false);

  const poll = useCallback(async () => {
    try {
      const health = await window.nemi.backend.getFullHealth();
      setFullHealth(health);
      setFullHealthError(false);
    } catch {
      setFullHealthError(true);
    }
  }, []);

  useEffect(() => {
    void poll();
    const interval = setInterval(() => void poll(), FULL_HEALTH_POLL_MS);
    return () => clearInterval(interval);
  }, [poll]);

  const handleRestart = () => {
    setRestarting(true);
    void window.nemi.backend
      .restart()
      .catch(() => undefined)
      .finally(() => {
        // The backend takes several seconds to cold-start again — this
        // just re-enables the button rather than trying to track the
        // restart's own completion, which StatusBar's existing health
        // polling already surfaces.
        setTimeout(() => setRestarting(false), 3000);
      });
  };

  const backendReachable = fullHealth !== null && !fullHealthError;

  const checks: Check[] = [
    {
      label: 'Backend',
      state: backendReachable ? 'ok' : 'critical',
      detail: backendReachable
        ? `v${fullHealth.version} · up ${Math.round(fullHealth.uptime_seconds)}s`
        : 'Unreachable',
    },
    {
      label: 'Database',
      state: !backendReachable ? 'unknown' : fullHealth.database.ok ? 'ok' : 'critical',
      detail: !backendReachable
        ? '—'
        : fullHealth.database.ok
          ? `${((fullHealth.database.size_bytes ?? 0) / (1024 * 1024)).toFixed(1)} MB`
          : (fullHealth.database.message ?? 'Unavailable'),
    },
    {
      label: 'Electron',
      state: 'ok',
      detail: `renderer alive`,
    },
    {
      label: 'Python',
      state: backendReachable ? 'ok' : 'unknown',
      detail: backendReachable
        ? `${fullHealth.python.implementation} ${fullHealth.python.version}`
        : '—',
    },
    {
      label: 'AI Providers',
      state: !backendReachable
        ? 'unknown'
        : fullHealth.providers.errors_total > 0
          ? 'warning'
          : 'ok',
      detail: backendReachable
        ? `${fullHealth.providers.connected}/${fullHealth.providers.total} connected · ${fullHealth.providers.errors_total} error(s)`
        : '—',
    },
    {
      label: 'Ollama',
      state: !backendReachable
        ? 'unknown'
        : !fullHealth.ollama.installed
          ? 'warning'
          : fullHealth.ollama.server_running
            ? 'ok'
            : 'warning',
      detail: !backendReachable
        ? '—'
        : !fullHealth.ollama.installed
          ? 'Not installed'
          : fullHealth.ollama.server_running
            ? `Running at ${fullHealth.ollama.host}`
            : 'Installed, not running',
    },
    {
      label: 'Internet',
      state: !backendReachable ? 'unknown' : fullHealth.internet.ok ? 'ok' : 'warning',
      detail: !backendReachable ? '—' : fullHealth.internet.ok ? 'Connected' : 'Unreachable',
    },
    {
      label: 'Git',
      state: !projectPath ? 'unknown' : gitStatus?.isRepo ? 'ok' : 'warning',
      detail: !projectPath
        ? 'No project open'
        : gitStatus?.isRepo
          ? `${gitStatus.branch ?? 'detached'}${gitStatus.isDirty ? ' · dirty' : ''}`
          : 'Not a git repository',
    },
    {
      label: 'Workspace',
      state: projectPath ? 'ok' : 'warning',
      detail: projectPath ? basename(projectPath) : 'No project open',
    },
    {
      label: 'Build',
      state: !availableRunners.build && !availableRunners.test ? 'unknown' : 'ok',
      detail:
        runners.build.state === 'running' || runners.test.state === 'running'
          ? 'Running'
          : availableRunners.build || availableRunners.test
            ? 'Ready'
            : 'No build/test script detected',
    },
    {
      label: 'Memory',
      state: percentState(systemMetrics?.memory.usedPercent ?? null),
      detail: systemMetrics ? `${systemMetrics.memory.usedPercent.toFixed(0)}% used` : 'Unknown',
    },
    {
      label: 'CPU',
      state: percentState(systemMetrics?.cpu.usedPercent ?? null),
      detail:
        systemMetrics?.cpu.usedPercent != null
          ? `${systemMetrics.cpu.usedPercent.toFixed(0)}% · ${systemMetrics.cpu.cores} cores`
          : 'Unknown',
    },
    {
      label: 'Disk',
      state: percentState(systemMetrics?.disk.usedPercent ?? null),
      detail:
        systemMetrics?.disk.usedPercent != null
          ? `${systemMetrics.disk.usedPercent.toFixed(0)}% used`
          : 'Unavailable on this platform',
    },
  ];

  const critical = checks.filter((c) => c.state === 'critical').length;
  const warning = checks.filter((c) => c.state === 'warning').length;
  const known = checks.filter((c) => c.state !== 'unknown').length;
  const ok = checks.filter((c) => c.state === 'ok').length;
  const scorePercent = known > 0 ? Math.round((ok / known) * 100) : 0;
  const overall: CheckState = critical > 0 ? 'critical' : warning > 0 ? 'warning' : 'ok';
  const overallLabel = critical > 0 ? 'Critical' : warning > 0 ? 'Degraded' : 'Healthy';

  return (
    <div className="max-w-2xl space-y-4">
      <div className="flex items-center justify-between rounded-md border border-border p-3">
        <div className="flex items-center gap-2">
          {overall === 'ok' && <CheckCircle2 size={18} className="text-success" />}
          {overall === 'warning' && <AlertTriangle size={18} className="text-warning" />}
          {overall === 'critical' && <XCircle size={18} className="text-danger" />}
          <div>
            <p className="text-sm font-semibold text-fg">Overall Health: {overallLabel}</p>
            <p className="text-[11px] text-fg-muted">
              {scorePercent}% ({ok}/{known} checks OK)
              {critical > 0 ? ` · ${critical} critical` : ''}
              {warning > 0 ? ` · ${warning} warning` : ''}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRestart}
          disabled={restarting}
          className="flex items-center gap-1 rounded border border-border px-2 py-1 text-[11px] text-fg-muted hover:border-accent hover:text-accent disabled:opacity-40"
          title="Restart the backend process"
        >
          {restarting ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Restart Backend
        </button>
      </div>

      <div className="rounded-md border border-border p-3">
        {checks.map((check) => (
          <CheckRow key={check.label} check={check} />
        ))}
      </div>

      <p className="text-[11px] text-fg-muted">
        CPU/Memory/Disk/Git/Build detail lives in Resources and Build Center; AI Providers/Ollama
        configuration lives in Settings — this view is a real-data summary across all of them, not a
        second copy.
      </p>
    </div>
  );
}
