import { mockProjectTree } from './mockProjectTree';
import { ExplorerTreeItem } from './ExplorerTreeItem';

export function ProjectExplorer() {
  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-surface-elevated">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        Project Explorer
      </div>
      <div className="flex-1 overflow-y-auto px-1 pb-2">
        {mockProjectTree.map((node) => (
          <ExplorerTreeItem key={node.id} node={node} />
        ))}
      </div>
    </aside>
  );
}
