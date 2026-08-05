import { FolderOpen, FolderPlus, Settings } from 'lucide-react';
import { DashboardCard } from './DashboardCard';

interface QuickActionsCardProps {
  onOpenSettings: () => void;
}

export function QuickActionsCard({ onOpenSettings }: QuickActionsCardProps) {
  return (
    <DashboardCard title="Quick Actions" icon={<FolderPlus size={14} />}>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled
          title="Available in a future sprint"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-fg-muted opacity-60 cursor-not-allowed"
        >
          <FolderPlus size={16} />
          New Project
          <span className="ml-auto text-xs uppercase tracking-wide">Coming Soon</span>
        </button>
        <button
          type="button"
          disabled
          title="Available in a future sprint"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-left text-sm text-fg-muted opacity-60 cursor-not-allowed"
        >
          <FolderOpen size={16} />
          Open Project
          <span className="ml-auto text-xs uppercase tracking-wide">Coming Soon</span>
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
