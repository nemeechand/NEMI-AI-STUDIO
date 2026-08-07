import { FolderKanban, FolderTree, Settings } from 'lucide-react';
import { IconButton } from '../common/IconButton';

export type SidebarPanel = 'explorer' | 'workspace';

interface SidebarProps {
  activePanel: SidebarPanel;
  onSelectPanel: (panel: SidebarPanel) => void;
  onOpenSettings: () => void;
}

export function Sidebar({ activePanel, onSelectPanel, onOpenSettings }: SidebarProps) {
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center justify-between border-r border-border bg-surface-elevated py-2">
      <div className="flex flex-col items-center gap-1">
        <IconButton
          label="Project Explorer"
          active={activePanel === 'explorer'}
          onClick={() => onSelectPanel('explorer')}
        >
          <FolderTree size={18} />
        </IconButton>
        <IconButton
          label="Workspace Manager"
          active={activePanel === 'workspace'}
          onClick={() => onSelectPanel('workspace')}
        >
          <FolderKanban size={18} />
        </IconButton>
      </div>
      <IconButton label="Settings" onClick={onOpenSettings}>
        <Settings size={18} />
      </IconButton>
    </nav>
  );
}
