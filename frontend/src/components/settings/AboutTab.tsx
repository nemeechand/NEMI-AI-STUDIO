import { useEffect, useState } from 'react';

/**
 * Sprint 15.6: reads the real running version via IPC
 * (`window.nemi.backend.getAppInfo()` → Electron's own `app.getVersion()`,
 * the same string electron-builder stamps into installer/portable
 * filenames) instead of a hand-maintained literal — a production-
 * stabilization audit found the previous hardcoded string had already
 * drifted from package.json's real version.
 */
export function AboutTab() {
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [backendVersion, setBackendVersion] = useState<string | null>(null);

  useEffect(() => {
    void window.nemi.backend.getAppInfo().then(setAppInfo);
    void window.nemi.backend.health().then((health) => setBackendVersion(health.version ?? null));
  }, []);

  return (
    <div>
      <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-fg-muted">About</h3>
      <p className="mb-3 text-sm text-fg">NEMI AI STUDIO — v{appInfo?.appVersion ?? '…'}</p>
      <dl className="space-y-1 text-xs text-fg-muted">
        <div className="flex justify-between">
          <dt>Backend</dt>
          <dd>{backendVersion ? `v${backendVersion}` : '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Electron</dt>
          <dd>{appInfo?.electronVersion ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Chromium</dt>
          <dd>{appInfo?.chromeVersion ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Node.js</dt>
          <dd>{appInfo?.nodeVersion ?? '—'}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Platform</dt>
          <dd>{appInfo?.platform ?? '—'}</dd>
        </div>
      </dl>
    </div>
  );
}
