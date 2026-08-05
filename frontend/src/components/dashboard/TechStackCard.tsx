import { Layers } from 'lucide-react';
import { DashboardCard } from './DashboardCard';
import { TECH_STACK } from './dashboardData';

export function TechStackCard() {
  return (
    <DashboardCard title="Tech Stack" icon={<Layers size={14} />}>
      <div className="flex flex-col gap-2">
        {TECH_STACK.map((group) => (
          <div key={group.category} className="flex items-baseline gap-2 text-sm">
            <span className="w-28 shrink-0 text-fg-muted">{group.category}</span>
            <span className="text-fg">{group.items.join(', ')}</span>
          </div>
        ))}
      </div>
    </DashboardCard>
  );
}
