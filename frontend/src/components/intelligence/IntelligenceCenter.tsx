import { useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { SECTIONS, type SectionId } from './sections';
import { HealthCenterSection } from './HealthCenterSection';
import { SprintCenterSection } from './SprintCenterSection';
import { AgentMonitorSection } from './AgentMonitorSection';
import { WorkflowViewSection } from './WorkflowViewSection';
import { TerminalSection } from './TerminalSection';
import { AiThinkingSection } from './AiThinkingSection';
import { ResourceMonitorSection } from './ResourceMonitorSection';
import { TokenCostSection } from './TokenCostSection';
import { BuildCenterSection } from './BuildCenterSection';
import { ControlCenterSection } from './ControlCenterSection';
import { HistorySection } from './HistorySection';
import { NotificationCenterSection } from './NotificationCenterSection';
import { PerformanceSection } from './PerformanceSection';
import { NotificationToasts } from './NotificationToasts';

interface IntelligenceCenterProps {
  onClose: () => void;
}

export function IntelligenceCenter({ onClose }: IntelligenceCenterProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('sprint');

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-surface">
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h1 className="text-sm font-semibold text-fg">Live Development Dashboard</h1>
        <IconButton label="Close Dashboard" onClick={onClose}>
          <X size={16} />
        </IconButton>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav className="flex w-48 shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-border bg-surface-elevated p-2">
          {SECTIONS.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.id;
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs ${
                  active
                    ? 'bg-accent text-accent-fg'
                    : 'text-fg-muted hover:bg-surface hover:text-fg'
                }`}
              >
                <Icon size={14} className="shrink-0" />
                {section.label}
              </button>
            );
          })}
        </nav>
        <div className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4">
          {activeSection === 'health' && <HealthCenterSection />}
          {activeSection === 'sprint' && <SprintCenterSection />}
          {activeSection === 'agents' && <AgentMonitorSection />}
          {activeSection === 'workflow' && <WorkflowViewSection />}
          {activeSection === 'terminal' && <TerminalSection />}
          {activeSection === 'thinking' && <AiThinkingSection />}
          {activeSection === 'resources' && <ResourceMonitorSection />}
          {activeSection === 'tokens' && <TokenCostSection />}
          {activeSection === 'build' && <BuildCenterSection />}
          {activeSection === 'control' && <ControlCenterSection />}
          {activeSection === 'history' && <HistorySection />}
          {activeSection === 'notifications' && <NotificationCenterSection />}
          {activeSection === 'performance' && <PerformanceSection />}
        </div>
      </div>
      <NotificationToasts />
    </div>
  );
}
