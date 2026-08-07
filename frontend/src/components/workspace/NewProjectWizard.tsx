import { useEffect, useState } from 'react';
import { FolderOpen, X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useProject } from '../../project/useProject';

interface NewProjectWizardProps {
  onClose: () => void;
}

const INVALID_NAME_CHARS = /[\\/]/;

export function NewProjectWizard({ onClose }: NewProjectWizardProps) {
  const { openProject } = useProject();
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleBrowse() {
    const path = await window.nemi.fs.selectDirectory();
    if (path) setLocation(path);
  }

  async function handleCreate() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Project name is required.');
      return;
    }
    if (INVALID_NAME_CHARS.test(trimmedName)) {
      setError('Project name cannot contain "/" or "\\".');
      return;
    }
    if (!location) {
      setError('Choose a location for the project.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      const finalPath = await window.nemi.fs.createDirectory(location, trimmedName);
      await openProject(finalPath, description.trim() || undefined);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-surface-elevated shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">New Project</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div>
            <label htmlFor="new-project-name" className="mb-1 block text-xs text-fg-muted">
              Name
            </label>
            <input
              id="new-project-name"
              type="text"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="my-project"
              autoFocus
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="new-project-location" className="mb-1 block text-xs text-fg-muted">
              Location
            </label>
            <div className="flex gap-1.5">
              <input
                id="new-project-location"
                type="text"
                value={location}
                readOnly
                placeholder="Choose a folder…"
                className="w-full min-w-0 flex-1 rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none"
              />
              <button
                type="button"
                onClick={() => void handleBrowse()}
                className="flex shrink-0 items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs text-fg hover:border-accent hover:text-accent"
              >
                <FolderOpen size={13} /> Browse
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="new-project-description" className="mb-1 block text-xs text-fg-muted">
              Description (optional)
            </label>
            <textarea
              id="new-project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              className="w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-sm text-fg-muted hover:text-fg"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={creating}
              className="rounded-md bg-accent px-3 py-1.5 text-sm text-accent-fg disabled:cursor-not-allowed disabled:opacity-60"
            >
              {creating ? 'Creating…' : 'Create Project'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
