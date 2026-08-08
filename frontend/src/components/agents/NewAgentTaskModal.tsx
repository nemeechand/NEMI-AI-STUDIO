import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useAi } from '../../ai/useAi';
import { useAgents } from '../../agents/useAgents';
import { SUGGESTED_MODELS } from '../../ai/providerDefaults';
import { ROLE_LABELS } from './roleMeta';

const ALL_STAGES: AgentRoleKey[] = ['planner', 'developer', 'reviewer', 'tester'];

interface NewAgentTaskModalProps {
  onClose: () => void;
}

export function NewAgentTaskModal({ onClose }: NewAgentTaskModalProps) {
  const { providers, ollamaModels, configuredProviders, selectedProvider, selectedModel } = useAi();
  const { createPipeline } = useAgents();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [provider, setProvider] = useState(selectedProvider);
  const [model, setModel] = useState(selectedModel);
  const [priority, setPriority] = useState(2);
  const [stages, setStages] = useState<AgentRoleKey[]>(ALL_STAGES);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const suggestions = provider === 'ollama' ? ollamaModels : (SUGGESTED_MODELS[provider] ?? []);

  function toggleStage(role: AgentRoleKey) {
    setStages((prev) =>
      prev.includes(role)
        ? prev.filter((r) => r !== role)
        : [...prev, role].sort((a, b) => ALL_STAGES.indexOf(a) - ALL_STAGES.indexOf(b)),
    );
  }

  async function handleCreate() {
    const trimmedTitle = title.trim();
    const trimmedDescription = description.trim();
    if (!trimmedTitle) {
      setError('Task title is required.');
      return;
    }
    if (!trimmedDescription) {
      setError('Describe what you want the agents to do.');
      return;
    }
    if (stages.length === 0) {
      setError('Select at least one stage.');
      return;
    }
    if (!model.trim()) {
      setError('Choose a model.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await createPipeline({
        title: trimmedTitle,
        description: trimmedDescription,
        provider,
        model: model.trim(),
        priority,
        stages,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create task');
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
        className="w-full max-w-lg rounded-lg border border-border bg-surface-elevated shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold text-fg">New Agent Task</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div>
            <label htmlFor="new-task-title" className="mb-1 block text-xs text-fg-muted">
              Title
            </label>
            <input
              id="new-task-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add dark mode toggle"
              autoFocus
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="new-task-description" className="mb-1 block text-xs text-fg-muted">
              What should the agents do?
            </label>
            <textarea
              id="new-task-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              placeholder="Describe the goal. The Planner Agent will break this into a plan for the rest of the pipeline."
              className="w-full resize-none rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
          <div className="flex gap-1.5">
            <select
              value={provider}
              onChange={(event) => {
                setProvider(event.target.value);
                setModel('');
              }}
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
            >
              {providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                  {!configuredProviders.has(p.id) && p.requires_api_key ? ' (no key)' : ''}
                </option>
              ))}
            </select>
            <input
              list="new-task-model-suggestions"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="model id"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
            />
            <datalist id="new-task-model-suggestions">
              {suggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            <select
              value={priority}
              onChange={(event) => setPriority(Number(event.target.value))}
              title="Priority"
              className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
            >
              <option value={1}>Highest</option>
              <option value={2}>Normal</option>
              <option value={3}>Low</option>
              <option value={4}>Lowest</option>
            </select>
          </div>
          <div>
            <span className="mb-1 block text-xs text-fg-muted">Pipeline stages</span>
            <div className="flex flex-wrap gap-3">
              {ALL_STAGES.map((role) => (
                <label key={role} className="flex items-center gap-1.5 text-xs text-fg">
                  <input
                    type="checkbox"
                    checked={stages.includes(role)}
                    onChange={() => toggleStage(role)}
                  />
                  {ROLE_LABELS[role]}
                </label>
              ))}
            </div>
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
              {creating ? 'Starting…' : 'Start Pipeline'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
