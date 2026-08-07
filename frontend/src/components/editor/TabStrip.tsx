import { X } from 'lucide-react';
import { basename } from '../../project/pathUtils';
import type { EditorGroup } from '../../workspace/workspace-context';

interface TabStripProps {
  group: EditorGroup;
  onActivate: (path: string) => void;
  onClose: (path: string) => void;
  onCloseOthers: (path: string) => void;
}

export function TabStrip({ group, onActivate, onClose, onCloseOthers }: TabStripProps) {
  if (group.tabs.length === 0) return null;

  return (
    <div className="flex shrink-0 items-stretch overflow-x-auto border-b border-border bg-surface-elevated">
      {group.tabs.map((tab) => {
        const isActive = tab.path === group.activeTabPath;
        return (
          <div
            key={tab.path}
            role="button"
            tabIndex={0}
            onClick={() => onActivate(tab.path)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') onActivate(tab.path);
            }}
            onDoubleClick={() => onCloseOthers(tab.path)}
            title={`${tab.path}\n(double-click: close others)`}
            className={`group flex shrink-0 cursor-pointer items-center gap-1.5 border-r border-border px-2.5 py-1.5 text-xs ${
              isActive ? 'bg-surface text-fg' : 'text-fg-muted hover:bg-surface'
            }`}
          >
            {tab.isDirty ? (
              <span
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
                title="Unsaved changes"
              />
            ) : (
              <span className="h-1.5 w-1.5 shrink-0" />
            )}
            <span className="max-w-[12rem] truncate">{basename(tab.path)}</span>
            <button
              type="button"
              aria-label={`Close ${basename(tab.path)}`}
              onClick={(event) => {
                event.stopPropagation();
                onClose(tab.path);
              }}
              className="shrink-0 rounded p-0.5 text-fg-muted opacity-0 hover:bg-surface-sunken hover:text-fg group-hover:opacity-100"
            >
              <X size={12} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
