import { WelcomeHeader } from './WelcomeHeader';
import { QuickActionsCard } from './QuickActionsCard';
import { RecentProjectsCard } from './RecentProjectsCard';
import { SystemHealthCard } from './SystemHealthCard';
import { AITeamCard } from './AITeamCard';
import { TechStackCard } from './TechStackCard';

interface DashboardProps {
  onOpenSettings: () => void;
  onNewProject: () => void;
}

export function Dashboard({ onOpenSettings, onNewProject }: DashboardProps) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 overflow-y-auto px-6 py-6">
      <WelcomeHeader />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <QuickActionsCard onOpenSettings={onOpenSettings} onNewProject={onNewProject} />
        <RecentProjectsCard />
        <SystemHealthCard />
        <AITeamCard />
        <TechStackCard />
      </div>
    </div>
  );
}
