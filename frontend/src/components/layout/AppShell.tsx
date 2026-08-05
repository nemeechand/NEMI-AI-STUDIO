import { useState } from 'react';
import { HeaderToolbar } from './HeaderToolbar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ProjectExplorer } from '../explorer/ProjectExplorer';
import { LoggerPanel } from '../logger/LoggerPanel';
import { SettingsModal } from '../settings/SettingsModal';

export function AppShell() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [loggerVisible, setLoggerVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface text-fg">
      <HeaderToolbar
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((prev) => !prev)}
        loggerVisible={loggerVisible}
        onToggleLogger={() => setLoggerVisible((prev) => !prev)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar onOpenSettings={() => setSettingsOpen(true)} />
        {sidebarVisible && <ProjectExplorer />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex flex-1 items-center justify-center overflow-auto text-fg-muted">
            <p className="text-sm">No project opened yet.</p>
          </main>
          {loggerVisible && <LoggerPanel onClose={() => setLoggerVisible(false)} />}
        </div>
      </div>
      <StatusBar />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}
