import { useEffect, useState } from 'react';
import { useIntelligence } from '../../intelligence/useIntelligence';

const BACKEND_USAGE_POLL_MS = 5000;

export function ResourceMonitorSection() {
  const { systemMetrics } = useIntelligence();
  const [backendUsage, setBackendUsage] = useState<ResourceUsage | null>(null);
  const [backendHealth, setBackendHealth] = useState<BackendHealth | null>(null);

  useEffect(() => {
    async function poll() {
      const [usage, health] = await Promise.all([
        window.nemi.system.getResourceUsage().catch(() => null),
        window.nemi.backend.health().catch(() => null),
      ]);
      setBackendUsage(usage);
      setBackendHealth(health);
    }
    void poll();
    const interval = setInterval(() => void poll(), BACKEND_USAGE_POLL_MS);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="max-w-2xl space-y-4">
      <Bar
        label="System CPU"
        percent={systemMetrics?.cpu.usedPercent ?? null}
        detail={systemMetrics ? `${systemMetrics.cpu.cores} cores` : undefined}
      />
      <Bar
        label="System RAM"
        percent={systemMetrics?.memory.usedPercent ?? null}
        detail={
          systemMetrics
            ? `${(systemMetrics.memory.totalMb - systemMetrics.memory.freeMb).toFixed(0)} / ${systemMetrics.memory.totalMb.toFixed(0)} MB`
            : undefined
        }
      />
      <Bar
        label="Disk (project drive)"
        percent={systemMetrics?.disk.usedPercent ?? null}
        detail={
          systemMetrics?.disk.totalMb != null
            ? `${(systemMetrics.disk.totalMb - (systemMetrics.disk.freeMb ?? 0)).toFixed(0)} / ${systemMetrics.disk.totalMb.toFixed(0)} MB`
            : 'Unavailable on this platform'
        }
      />

      <div className="rounded border border-border p-2.5 text-xs">
        <p className="mb-1 font-medium text-fg">Network</p>
        <p className="text-fg-muted">
          Backend connectivity:{' '}
          <span className={backendHealth?.state === 'ready' ? 'text-success' : 'text-danger'}>
            {backendHealth?.state ?? 'unknown'}
          </span>
          . Bandwidth/throughput isn't exposed by a cross-platform API this app relies on, so it's
          reported as connectivity status rather than an invented number.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3 text-xs">
        <Field
          label="Backend (Python) Memory"
          value={backendUsage ? `${backendUsage.memoryMb.toFixed(0)} MB` : '—'}
        />
        <Field
          label="Backend CPU"
          value={backendUsage?.cpuPercent != null ? `${backendUsage.cpuPercent.toFixed(0)}%` : '—'}
        />
        <Field
          label="Electron Memory"
          value={systemMetrics ? `${systemMetrics.electronMemoryMb.toFixed(0)} MB` : '—'}
        />
      </div>
    </div>
  );
}

function Bar({
  label,
  percent,
  detail,
}: {
  label: string;
  percent: number | null;
  detail?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-fg">{label}</span>
        <span className="text-fg-muted">{percent !== null ? `${percent.toFixed(0)}%` : '—'}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
        <div className="h-full bg-accent transition-all" style={{ width: `${percent ?? 0}%` }} />
      </div>
      {detail && <p className="mt-0.5 text-[10px] text-fg-muted">{detail}</p>}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-border px-2.5 py-1.5">
      <div className="text-[10px] uppercase tracking-wide text-fg-muted">{label}</div>
      <div className="truncate text-xs text-fg">{value}</div>
    </div>
  );
}
