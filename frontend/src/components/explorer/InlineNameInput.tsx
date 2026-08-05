import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { IconButton } from '../common/IconButton';

interface InlineNameInputProps {
  depth: number;
  initialValue?: string;
  placeholder?: string;
  onConfirm: (name: string) => void | Promise<void>;
  onCancel: () => void;
}

export function InlineNameInput({
  depth,
  initialValue = '',
  placeholder,
  onConfirm,
  onCancel,
}: InlineNameInputProps) {
  const [value, setValue] = useState(initialValue);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  async function submit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(trimmed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div
        className="flex items-center gap-1 py-0.5 pr-1"
        style={{ paddingLeft: `${depth * 14 + 4}px` }}
      >
        <input
          ref={inputRef}
          value={value}
          disabled={submitting}
          placeholder={placeholder}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void submit();
            if (event.key === 'Escape') onCancel();
          }}
          className="min-w-0 flex-1 rounded border border-accent bg-surface px-1.5 py-0.5 text-sm text-fg outline-none"
        />
        <IconButton label="Confirm" onClick={() => void submit()} disabled={submitting}>
          <Check size={12} />
        </IconButton>
        <IconButton label="Cancel" onClick={onCancel} disabled={submitting}>
          <X size={12} />
        </IconButton>
      </div>
      {error && (
        <p className="px-3 text-xs text-danger" style={{ paddingLeft: `${depth * 14 + 4}px` }}>
          {error}
        </p>
      )}
    </div>
  );
}
