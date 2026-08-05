import type { ReactNode } from 'react';

interface DashboardCardProps {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}

export function DashboardCard({ title, icon, children }: DashboardCardProps) {
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface-elevated">
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-fg-muted">{icon}</span>
        <h2 className="text-xs font-semibold uppercase tracking-wider text-fg-muted">{title}</h2>
      </div>
      <div className="flex-1 px-4 py-3">{children}</div>
    </section>
  );
}
