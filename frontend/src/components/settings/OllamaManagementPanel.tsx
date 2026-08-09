import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, RefreshCw, Trash2, XCircle } from 'lucide-react';

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${units[exponent]}`;
}

export function OllamaManagementPanel({ baseUrl }: { baseUrl: string | null }) {
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [pullModelName, setPullModelName] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullMessage, setPullMessage] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setLoading(true);
    void window.nemi.providers
      .getOllamaStatus(baseUrl)
      .then(setStatus)
      .finally(() => setLoading(false));
  }, [baseUrl]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handlePull = () => {
    const model = pullModelName.trim();
    if (!model) return;
    setPulling(true);
    setPullMessage(`Pulling ${model}… this can take a while for large models.`);
    void window.nemi.providers
      .pullOllamaModel(model, baseUrl)
      .then((result) => {
        setPullMessage(String(result.status ?? 'Pull finished.'));
        setPullModelName('');
        refresh();
      })
      .catch((error: unknown) => {
        setPullMessage(error instanceof Error ? error.message : 'Pull failed.');
      })
      .finally(() => setPulling(false));
  };

  const handleDelete = (model: string) => {
    setDeleting(model);
    void window.nemi.providers
      .deleteOllamaModel(model, baseUrl)
      .then(() => refresh())
      .finally(() => setDeleting(null));
  };

  return (
    <div className="mt-2 rounded-md border border-border/60 bg-surface/50 p-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            {status?.installed ? (
              <CheckCircle2 size={12} className="text-success" />
            ) : (
              <XCircle size={12} className="text-fg-muted" />
            )}
            CLI {status?.installed ? 'installed' : 'not found'}
          </span>
          <span className="flex items-center gap-1">
            {status?.server_running ? (
              <CheckCircle2 size={12} className="text-success" />
            ) : (
              <XCircle size={12} className="text-danger" />
            )}
            Server {status?.server_running ? `running at ${status.host}` : 'not reachable'}
          </span>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[11px] text-fg-muted hover:border-accent hover:text-accent disabled:opacity-40"
        >
          <RefreshCw size={11} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {status && status.models.length > 0 && (
        <ul className="mb-2 divide-y divide-border/60">
          {status.models.map((model) => (
            <li key={model.name} className="flex items-center justify-between py-1 text-xs">
              <span className="text-fg">{model.name}</span>
              <span className="flex items-center gap-2">
                <span className="text-fg-muted">{formatBytes(model.size_bytes)}</span>
                <button
                  type="button"
                  title="Delete model"
                  disabled={deleting === model.name}
                  onClick={() => handleDelete(model.name)}
                  className="rounded border border-border p-0.5 text-fg-muted hover:border-danger hover:text-danger disabled:opacity-40"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {status && status.server_running && status.models.length === 0 && (
        <p className="mb-2 text-[11px] text-fg-muted">No models installed yet.</p>
      )}

      <div className="flex items-center gap-1.5">
        <input
          value={pullModelName}
          onChange={(event) => setPullModelName(event.target.value)}
          placeholder="model to pull, e.g. llama3.2"
          className="min-w-0 flex-1 rounded border border-border bg-surface px-1.5 py-1 text-xs text-fg outline-none focus:border-accent"
        />
        <button
          type="button"
          disabled={!pullModelName.trim() || pulling}
          onClick={handlePull}
          className="rounded border border-border px-2 py-1 text-xs text-fg hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
        >
          {pulling ? 'Pulling…' : 'Pull'}
        </button>
      </div>
      {pullMessage && <p className="mt-1 text-[11px] text-fg-muted">{pullMessage}</p>}
    </div>
  );
}
