import { FolderTree, Settings } from 'lucide-react';
import { IconButton } from '../common/IconButton';

interface SidebarProps {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  return (
    <nav className="flex w-12 shrink-0 flex-col items-center justify-between border-r border-border bg-surface-elevated py-2">
      <IconButton label="Project Explorer" active>
        <FolderTree size={18} />
      </IconButton>
      <IconButton label="Settings" onClick={onOpenSettings}>
        <Settings size={18} />
      </IconButton>
    </nav>
  );
}
