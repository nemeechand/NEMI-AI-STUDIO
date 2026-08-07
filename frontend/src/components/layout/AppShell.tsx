import { useEffect, useState } from 'react';
import { HeaderToolbar } from './HeaderToolbar';
import { Sidebar, type SidebarPanel } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ProjectExplorer } from '../explorer/ProjectExplorer';
import { LoggerPanel } from '../logger/LoggerPanel';
import { SettingsModal } from '../settings/SettingsModal';
import { Dashboard } from '../dashboard/Dashboard';
import { FileEditor } from '../editor/FileEditor';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { NewProjectWizard } from '../workspace/NewProjectWizard';
import { useWorkspace } from '../../workspace/useWorkspace';

export function AppShell() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('explorer');
  const [loggerVisible, setLoggerVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const { openFilePath, openFile, closeFile } = useWorkspace();
  const [content, setContent] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);

  useEffect(() => {
    if (!openFilePath) {
      setContent(null);
      return;
    }
    let cancelled = false;
    window.nemi.fs.readFile(openFilePath).then(
      (text) => {
        if (cancelled) return;
        setContent(text);
        setFileError(null);
      },
      (error: unknown) => {
        if (cancelled) return;
        setFileError(error instanceof Error ? error.message : 'Failed to open file');
        closeFile();
      },
    );
    return () => {
      cancelled = true;
    };
  }, [openFilePath, closeFile]);

  const isLoadingFile = openFilePath !== null && content === null;

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface text-fg">
      <HeaderToolbar
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((prev) => !prev)}
        loggerVisible={loggerVisible}
        onToggleLogger={() => setLoggerVisible((prev) => !prev)}
      />
      <div className="flex min-h-0 flex-1">
        <Sidebar
          activePanel={sidebarPanel}
          onSelectPanel={setSidebarPanel}
          onOpenSettings={() => setSettingsOpen(true)}
        />
        {sidebarVisible &&
          (sidebarPanel === 'explorer' ? (
            <ProjectExplorer onOpenFile={openFile} onNewProject={() => setNewProjectOpen(true)} />
          ) : (
            <WorkspaceManager onNewProject={() => setNewProjectOpen(true)} />
          ))}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 flex-1 overflow-auto">
            {isLoadingFile ? null : openFilePath && content !== null ? (
              <FileEditor path={openFilePath} content={content} onClose={closeFile} />
            ) : (
              <Dashboard
                onOpenSettings={() => setSettingsOpen(true)}
                onNewProject={() => setNewProjectOpen(true)}
              />
            )}
          </main>
          {loggerVisible && <LoggerPanel onClose={() => setLoggerVisible(false)} />}
        </div>
      </div>
      <StatusBar />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {newProjectOpen && <NewProjectWizard onClose={() => setNewProjectOpen(false)} />}
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
