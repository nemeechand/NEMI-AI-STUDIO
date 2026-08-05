import { useState } from 'react';
import { HeaderToolbar } from './HeaderToolbar';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ProjectExplorer } from '../explorer/ProjectExplorer';
import { LoggerPanel } from '../logger/LoggerPanel';
import { SettingsModal } from '../settings/SettingsModal';
import { Dashboard } from '../dashboard/Dashboard';
import { FileEditor } from '../editor/FileEditor';

interface OpenFile {
  path: string;
  content: string;
}

export function AppShell() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [loggerVisible, setLoggerVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openFile, setOpenFile] = useState<OpenFile | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  async function handleOpenFile(path: string) {
    try {
      const content = await window.nemi.fs.readFile(path);
      setOpenFile({ path, content });
      setFileError(null);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Failed to open file');
    }
  }

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
        {sidebarVisible && <ProjectExplorer onOpenFile={(path) => void handleOpenFile(path)} />}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 flex-1 overflow-auto">
            {openFile ? (
              <FileEditor
                path={openFile.path}
                content={openFile.content}
                onClose={() => setOpenFile(null)}
              />
            ) : (
              <Dashboard onOpenSettings={() => setSettingsOpen(true)} />
            )}
          </main>
          {loggerVisible && <LoggerPanel onClose={() => setLoggerVisible(false)} />}
        </div>
      </div>
      <StatusBar />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {fileError && (
        <button
          type="button"
          onClick={() => setFileError(null)}
          className="fixed bottom-8 right-3 max-w-sm rounded-md border border-danger bg-surface-elevated px-3 py-2 text-left text-xs text-danger shadow-lg"
        >
          {fileError}
        </button>
      )}
    </div>
  );
}
