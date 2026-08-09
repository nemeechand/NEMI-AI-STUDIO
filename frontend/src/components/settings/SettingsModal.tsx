import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { EditorSettingsTab } from './EditorSettingsTab';
import { AiProvidersTab } from './AiProvidersTab';
import { ModelsTab } from './ModelsTab';
import { UsageTab } from './UsageTab';
import { SecurityTab } from './SecurityTab';
import { AboutTab } from './AboutTab';

interface SettingsModalProps {
  onClose: () => void;
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'editor', label: 'Editor' },
  { id: 'providers', label: 'AI Providers' },
  { id: 'models', label: 'Models' },
  { id: 'usage', label: 'Usage' },
  { id: 'security', label: 'Security' },
  { id: 'about', label: 'About' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function SettingsModal({ onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>('general');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="flex h-[80vh] w-full max-w-3xl flex-col rounded-lg border border-border bg-surface-elevated shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">Settings</h2>
          <IconButton label="Close Settings" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="flex min-h-0 flex-1">
          <nav className="w-40 shrink-0 space-y-0.5 overflow-y-auto border-r border-border p-2">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`w-full rounded-md px-2.5 py-1.5 text-left text-xs font-medium ${
                  activeTab === tab.id
                    ? 'bg-accent/10 text-accent'
                    : 'text-fg-muted hover:bg-surface hover:text-fg'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="min-w-0 flex-1 overflow-y-auto p-4">
            {activeTab === 'general' && <GeneralSettingsTab />}
            {activeTab === 'editor' && <EditorSettingsTab />}
            {activeTab === 'providers' && <AiProvidersTab />}
            {activeTab === 'models' && <ModelsTab />}
            {activeTab === 'usage' && <UsageTab />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'about' && <AboutTab />}
          </div>
        </div>
      </div>
    </div>
  );
}
