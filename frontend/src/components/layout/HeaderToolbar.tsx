import { PanelBottom, PanelLeft } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { WindowControls } from './WindowControls';

interface HeaderToolbarProps {
  sidebarVisible: boolean;
  onToggleSidebar: () => void;
  loggerVisible: boolean;
  onToggleLogger: () => void;
}

export function HeaderToolbar({
  sidebarVisible,
  onToggleSidebar,
  loggerVisible,
  onToggleLogger,
}: HeaderToolbarProps) {
  return (
    <header className="app-drag flex h-10 shrink-0 items-center justify-between border-b border-border bg-surface-elevated pl-3 text-sm text-fg">
      <span className="font-semibold tracking-wide">NEMI AI STUDIO</span>
      <div className="app-no-drag flex h-full items-center gap-1 pr-1">
        <IconButton label="Toggle Sidebar" active={sidebarVisible} onClick={onToggleSidebar}>
          <PanelLeft size={16} />
        </IconButton>
        <IconButton label="Toggle Logger Panel" active={loggerVisible} onClick={onToggleLogger}>
          <PanelBottom size={16} />
        </IconButton>
        <div className="mx-1 h-5 w-px bg-border" />
        <WindowControls />
      </div>
    </header>
  );
}
