import { useState } from 'react';
import { ChevronRight, File, Folder, FolderOpen } from 'lucide-react';
import type { ProjectNode } from './mockProjectTree';

interface ExplorerTreeItemProps {
  node: ProjectNode;
  depth?: number;
}

export function ExplorerTreeItem({ node, depth = 0 }: ExplorerTreeItemProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const isFolder = node.type === 'folder';

  return (
    <div>
      <button
        type="button"
        onClick={() => isFolder && setExpanded((prev) => !prev)}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-sm text-fg-muted hover:bg-surface-elevated hover:text-fg"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        {isFolder ? (
          <ChevronRight
            size={14}
            className={`shrink-0 transition-transform ${expanded ? 'rotate-90' : ''}`}
          />
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {isFolder ? (
          expanded ? (
            <FolderOpen size={14} className="shrink-0 text-accent" />
          ) : (
            <Folder size={14} className="shrink-0 text-accent" />
          )
        ) : (
          <File size={14} className="shrink-0" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {isFolder && expanded && node.children && (
        <div>
          {node.children.map((child) => (
            <ExplorerTreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
