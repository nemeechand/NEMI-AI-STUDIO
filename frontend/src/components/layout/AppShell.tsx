import { useEffect, useState } from 'react';
import { HeaderToolbar } from './HeaderToolbar';
import { Sidebar, type SidebarPanel } from './Sidebar';
import { StatusBar } from './StatusBar';
import { ProjectExplorer } from '../explorer/ProjectExplorer';
import { LoggerPanel } from '../logger/LoggerPanel';
import { SettingsModal } from '../settings/SettingsModal';
import { Dashboard } from '../dashboard/Dashboard';
import { MonacoEditorPane } from '../editor/MonacoEditorPane';
import { QuickOpen } from '../editor/QuickOpen';
import { GlobalSearch } from '../search/GlobalSearch';
import { WorkspaceManager } from '../workspace/WorkspaceManager';
import { NewProjectWizard } from '../workspace/NewProjectWizard';
import { ChatPanel } from '../chat/ChatPanel';
import { AgentsDashboard } from '../agents/AgentsDashboard';
import { NewAgentTaskModal } from '../agents/NewAgentTaskModal';
import { CommandPalette } from '../../commands/CommandPalette';
import { useCommand } from '../../commands/useCommand';
import { useWorkspace } from '../../workspace/useWorkspace';
import { useProject } from '../../project/useProject';
import { useOpenProjectDialog } from '../../project/useOpenProjectDialog';
import { useAi } from '../../ai/useAi';

export function AppShell() {
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarPanel, setSidebarPanel] = useState<SidebarPanel>('explorer');
  const [loggerVisible, setLoggerVisible] = useState(true);
  const [aiChatVisible, setAiChatVisible] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newAgentTaskOpen, setNewAgentTaskOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const { groups, splitDirection, split, unsplit, saveAll, reopenClosedTab, openFile } =
    useWorkspace();
  const { projectPath } = useProject();
  const { openExisting } = useOpenProjectDialog();
  const { onRequestOpenPanel, newConversation } = useAi();

  // Editor context-menu AI actions (Explain/Fix/.../"Ask AI about
  // Selection") call askAboutSelection() regardless of whether the chat
  // panel happens to be open — this makes sure it actually becomes visible
  // when they do, rather than silently updating a hidden panel's state.
  useEffect(() => onRequestOpenPanel(() => setAiChatVisible(true)), [onRequestOpenPanel]);

  const hasOpenTabs = groups.some((g) => g.tabs.length > 0);

  // Global (app-level) keyboard shortcuts — distinct from Monaco's own
  // editor-scoped commands (Ctrl+S/Ctrl+W, registered per-pane so they only
  // fire while that pane has focus; see MonacoEditorPane.tsx).
  useEffect(() => {
    // Compared on event.code (the physical key), not event.key: a real
    // Shift+<letter> keypress reports an uppercase event.key (e.g. "P"),
    // so a lowercase literal check like `event.key === 'p'` silently never
    // matches when Shift is actually held — code is layout/case-independent
    // and is the standard robust pattern for modifier-based shortcuts.
    function handleKeyDown(event: KeyboardEvent) {
      const mod = event.ctrlKey || event.metaKey;
      if (!mod) return;
      if (event.code === 'KeyP' && event.shiftKey) {
        event.preventDefault();
        setCommandPaletteOpen(true);
      } else if (event.code === 'KeyP') {
        event.preventDefault();
        setQuickOpenOpen(true);
      } else if (event.code === 'KeyT' && event.shiftKey) {
        event.preventDefault();
        reopenClosedTab();
      } else if (event.code === 'Backslash') {
        event.preventDefault();
        if (splitDirection) unsplit();
        else split('vertical');
      } else if (event.code === 'KeyF' && event.shiftKey) {
        event.preventDefault();
        setSidebarVisible(true);
        setSidebarPanel('search');
      } else if (event.code === 'KeyA' && event.shiftKey) {
        event.preventDefault();
        setAiChatVisible((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [splitDirection, split, unsplit, reopenClosedTab]);

  // Command Palette entries — registered here (not per-feature component)
  // since they're app-level actions, not tied to one component's lifecycle.
  useCommand('workspace.saveAll', 'File: Save All', () => void saveAll(), {
    keybinding: 'Ctrl+K S',
  });
  useCommand('view.toggleSidebar', 'View: Toggle Sidebar', () => setSidebarVisible((v) => !v), {
    keybinding: 'Ctrl+B',
  });
  useCommand('view.toggleLogger', 'View: Toggle Logger Panel', () => setLoggerVisible((v) => !v));
  useCommand(
    'editor.splitVertical',
    'View: Split Editor Right (Vertical)',
    () => split('vertical'),
    { keybinding: 'Ctrl+\\' },
  );
  useCommand('editor.splitHorizontal', 'View: Split Editor Down (Horizontal)', () =>
    split('horizontal'),
  );
  useCommand('editor.unsplit', 'View: Join Editor Groups', () => unsplit(), {
    enabled: splitDirection !== null,
  });
  useCommand('editor.reopenClosedTab', 'File: Reopen Closed Tab', () => reopenClosedTab(), {
    keybinding: 'Ctrl+Shift+T',
  });
  useCommand('file.quickOpen', 'Go to File…', () => setQuickOpenOpen(true), {
    keybinding: 'Ctrl+P',
  });
  useCommand('workspace.openFolder', 'File: Open Folder…', () => void openExisting());
  useCommand('workspace.newProject', 'File: New Project…', () => setNewProjectOpen(true));
  useCommand('ai.toggleChat', 'View: Toggle AI Chat Panel', () => setAiChatVisible((v) => !v), {
    keybinding: 'Ctrl+Shift+A',
  });
  useCommand('ai.newConversation', 'AI: New Conversation', () => {
    setAiChatVisible(true);
    newConversation();
  });
  useCommand('agents.showDashboard', 'Agents: Show Dashboard', () => {
    setSidebarVisible(true);
    setSidebarPanel('agents');
  });
  useCommand('agents.newTask', 'Agents: New Task…', () => {
    setSidebarVisible(true);
    setSidebarPanel('agents');
    setNewAgentTaskOpen(true);
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface text-fg">
      <HeaderToolbar
        sidebarVisible={sidebarVisible}
        onToggleSidebar={() => setSidebarVisible((prev) => !prev)}
        loggerVisible={loggerVisible}
        onToggleLogger={() => setLoggerVisible((prev) => !prev)}
        aiChatVisible={aiChatVisible}
        onToggleAiChat={() => setAiChatVisible((prev) => !prev)}
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
          ) : sidebarPanel === 'workspace' ? (
            <WorkspaceManager onNewProject={() => setNewProjectOpen(true)} />
          ) : sidebarPanel === 'search' ? (
            <GlobalSearch />
          ) : (
            <AgentsDashboard onNewTask={() => setNewAgentTaskOpen(true)} />
          ))}
        <div className="flex min-w-0 flex-1 flex-col">
          <main className="flex min-h-0 flex-1 overflow-auto">
            {hasOpenTabs ? (
              <div
                className={`flex min-h-0 min-w-0 flex-1 ${
                  splitDirection === 'horizontal' ? 'flex-col' : 'flex-row'
                }`}
              >
                <MonacoEditorPane groupId="primary" />
                {splitDirection && (
                  <div
                    className={
                      splitDirection === 'horizontal'
                        ? 'h-px shrink-0 bg-border'
                        : 'w-px shrink-0 bg-border'
                    }
                  />
                )}
                {splitDirection && <MonacoEditorPane groupId="secondary" />}
              </div>
            ) : (
              <Dashboard
                onOpenSettings={() => setSettingsOpen(true)}
                onNewProject={() => setNewProjectOpen(true)}
              />
            )}
          </main>
          {loggerVisible && <LoggerPanel onClose={() => setLoggerVisible(false)} />}
        </div>
        {aiChatVisible && <ChatPanel />}
      </div>
      <StatusBar />
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
      {newProjectOpen && <NewProjectWizard onClose={() => setNewProjectOpen(false)} />}
      {newAgentTaskOpen && <NewAgentTaskModal onClose={() => setNewAgentTaskOpen(false)} />}
      {commandPaletteOpen && <CommandPalette onClose={() => setCommandPaletteOpen(false)} />}
      {quickOpenOpen && projectPath && <QuickOpen onClose={() => setQuickOpenOpen(false)} />}
    </div>
  );
}
