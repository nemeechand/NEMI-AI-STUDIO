import { FolderOpen, FolderPlus, Settings } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { useOpenProjectDialog } from '../../project/useOpenProjectDialog';

interface QuickActionsCardProps {
  onOpenSettings: () => void;
}

export function QuickActionsCard({ onOpenSettings }: QuickActionsCardProps) {
  const { openExisting, createNew } = useOpenProjectDialog();

  return (
    <DashboardCard title="Quick Actions" icon={<FolderPlus size={14} />}>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => void createNew()}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <FolderPlus size={16} />
          New Project
        </button>
        <button
          type="button"
          onClick={() => void openExisting()}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <FolderOpen size={16} />
          Open Project
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-fg transition-colors hover:border-accent hover:text-accent"
        >
          <Settings size={16} />
          Open Settings
        </button>
      </div>
    </DashboardCard>
  );
}
