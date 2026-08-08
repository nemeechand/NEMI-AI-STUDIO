import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { IconButton } from '../common/IconButton';
import { useAi } from '../../ai/useAi';
import { useWorkflows } from '../../workflows/useWorkflows';
import { SUGGESTED_MODELS } from '../../ai/providerDefaults';
import { APPROVAL_MODE_LABELS } from './roleMeta';

const ALL_APPROVAL_MODES: ApprovalMode[] = ['review', 'auto', 'manual'];

const APPROVAL_MODE_HELP: Record<ApprovalMode, string> = {
  auto: 'Every stage runs unattended, and the Developer stage’s proposed files are written to disk automatically.',
  review: 'Every stage runs unattended, but Developer-proposed files wait for you to Apply them.',
  manual: 'Every stage waits for your explicit approval before it starts.',
};

interface NewWorkflowModalProps {
  onClose: () => void;
}

export function NewWorkflowModal({ onClose }: NewWorkflowModalProps) {
  const { providers, ollamaModels, configuredProviders, selectedProvider, selectedModel } = useAi();
  const { createWorkflow } = useWorkflows();

  const [title, setTitle] = useState('');
  const [goal, setGoal] = useState('');
  const [provider, setProvider] = useState(selectedProvider);
  const [model, setModel] = useState(selectedModel);
  const [approvalMode, setApprovalMode] = useState<ApprovalMode>('review');
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

  async function handleCreate() {
    const trimmedTitle = title.trim();
    const trimmedGoal = goal.trim();
    if (!trimmedTitle) {
      setError('Give this goal a short title.');
      return;
    }
    if (!trimmedGoal) {
      setError('Describe the goal you want the AI Project Manager to plan.');
      return;
    }
    if (!model.trim()) {
      setError('Choose a model.');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await createWorkflow({
        title: trimmedTitle,
        goal: trimmedGoal,
        provider,
        model: model.trim(),
        approvalMode,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create workflow');
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
          <h2 className="text-sm font-semibold text-fg">New Goal (AI Project Manager)</h2>
          <IconButton label="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="space-y-3 px-4 py-4">
          <div>
            <label htmlFor="new-workflow-title" className="mb-1 block text-xs text-fg-muted">
              Title
            </label>
            <input
              id="new-workflow-title"
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Build a todo app"
              autoFocus
              className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-fg outline-none focus:border-accent"
            />
          </div>
          <div>
            <label htmlFor="new-workflow-goal" className="mb-1 block text-xs text-fg-muted">
              High-level goal
            </label>
            <textarea
              id="new-workflow-goal"
              value={goal}
              onChange={(event) => setGoal(event.target.value)}
              rows={5}
              placeholder="Describe what you want built. The AI Project Manager will break this into milestones, each run through its own Planner/Developer/Reviewer/Tester pipeline."
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
              list="new-workflow-model-suggestions"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              placeholder="model id"
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-fg outline-none focus:border-accent"
            />
            <datalist id="new-workflow-model-suggestions">
              {suggestions.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </div>
          <div>
            <span className="mb-1 block text-xs text-fg-muted">Human Approval Mode</span>
            <div className="space-y-1.5">
              {ALL_APPROVAL_MODES.map((mode) => (
                <label
                  key={mode}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-border px-2.5 py-1.5 has-[:checked]:border-accent"
                >
                  <input
                    type="radio"
                    name="approval-mode"
                    className="mt-0.5"
                    checked={approvalMode === mode}
                    onChange={() => setApprovalMode(mode)}
                  />
                  <span>
                    <span className="block text-xs font-medium text-fg">
                      {APPROVAL_MODE_LABELS[mode]}
                    </span>
                    <span className="block text-[11px] text-fg-muted">
                      {APPROVAL_MODE_HELP[mode]}
                    </span>
                  </span>
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
              {creating ? 'Starting…' : 'Start Planning'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
