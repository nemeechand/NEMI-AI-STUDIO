import { useEffect, useState } from 'react';
import { ChevronRight, File, FilePlus, Folder, FolderOpen, Pencil, Trash2 } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { InlineNameInput } from './InlineNameInput';

interface ExplorerTreeItemProps {
  entry: ExplorerEntry;
  depth: number;
  watchVersion: number;
  onOpenFile: (path: string) => void;
}

export function ExplorerTreeItem({
  entry,
  depth,
  watchVersion,
  onOpenFile,
}: ExplorerTreeItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [children, setChildren] = useState<ExplorerEntry[] | null>(null);
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [displayName, setDisplayName] = useState(entry.name);
  const [deleted, setDeleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isFolder = entry.type === 'folder';

  useEffect(() => {
    setDisplayName(entry.name);
  }, [entry.name]);

  async function loadChildren() {
    try {
      const result = await window.nemi.fs.listDirectory(entry.path);
      setChildren(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load folder');
    }
  }

  useEffect(() => {
    if (isFolder && expanded) void loadChildren();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded, watchVersion]);

  function handleToggle() {
    if (!isFolder) {
      onOpenFile(entry.path);
      return;
    }
    setExpanded((prev) => !prev);
  }

  async function handleCreate(name: string) {
    await window.nemi.fs.createFile(entry.path, name);
    setCreating(false);
    setExpanded(true);
    void loadChildren();
  }

  async function handleRename(name: string) {
    await window.nemi.fs.renameEntry(entry.path, name);
    setDisplayName(name);
    setRenaming(false);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${entry.name}"? This cannot be undone.`)) return;
    await window.nemi.fs.deleteEntry(entry.path);
    setDeleted(true);
  }

  if (deleted) return null;

  if (renaming) {
    return (
      <InlineNameInput
        depth={depth}
        initialValue={entry.name}
        onConfirm={handleRename}
        onCancel={() => setRenaming(false)}
      />
    );
  }

  return (
    <div>
      <div
        className="group flex w-full items-center gap-1 rounded px-1 py-0.5 text-sm text-fg-muted hover:bg-surface-elevated hover:text-fg"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <button
          type="button"
          onClick={handleToggle}
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
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
          <span className="truncate">{displayName}</span>
        </button>
        <div className="hidden shrink-0 items-center gap-0.5 group-hover:flex">
          {isFolder && (
            <IconButton
              label="New File"
              onClick={() => {
                setCreating(true);
                setExpanded(true);
              }}
            >
              <FilePlus size={12} />
            </IconButton>
          )}
          <IconButton label="Rename" onClick={() => setRenaming(true)}>
            <Pencil size={12} />
          </IconButton>
          <IconButton label="Delete" onClick={() => void handleDelete()}>
            <Trash2 size={12} />
          </IconButton>
        </div>
      </div>
      {error && (
        <p
          className="px-3 py-0.5 text-xs text-danger"
          style={{ paddingLeft: `${depth * 14 + 20}px` }}
        >
          {error}
        </p>
      )}
      {isFolder && expanded && creating && (
        <InlineNameInput
          depth={depth + 1}
          placeholder="File name"
          onConfirm={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}
      {isFolder &&
        expanded &&
        children?.map((child) => (
          <ExplorerTreeItem
            key={child.path}
            entry={child}
            depth={depth + 1}
            watchVersion={watchVersion}
            onOpenFile={onOpenFile}
          />
        ))}
    </div>
  );
}
