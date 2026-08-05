import { Users } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { AI_TEAM, FUTURE_AI_MEMBERS } from './dashboardData';

export function AITeamCard() {
  return (
    <DashboardCard title="AI Team" icon={<Users size={14} />}>
      <ul className="flex flex-col gap-2">
        {AI_TEAM.map((member) => (
          <li key={member.role} className="flex items-center justify-between text-sm">
            <span className="text-fg-muted">{member.role}</span>
            <span className="font-medium text-fg">{member.name}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 border-t border-border pt-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          Future Members
        </p>
        <p className="mt-1 text-sm text-fg-muted">{FUTURE_AI_MEMBERS.join(', ')}</p>
      </div>
    </DashboardCard>
  );
}
