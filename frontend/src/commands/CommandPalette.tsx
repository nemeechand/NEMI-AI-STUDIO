import { useEffect, useState } from 'react';
import { listCommands, onCommandsChange, type Command } from './command-registry';
import { fuzzyFilter } from './fuzzyMatch';

interface CommandPaletteProps {
  onClose: () => void;
}

export function CommandPalette({ onClose }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [commands, setCommands] = useState<Command[]>(() => listCommands());
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => onCommandsChange(() => setCommands(listCommands())), []);

  const results = fuzzyFilter(commands, query, (c) => c.label);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function runActive() {
    const command = results[activeIndex];
    if (command) {
      command.run();
      onClose();
    }
  }

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        runActive();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [results, activeIndex, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-24"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-surface-elevated shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          type="text"
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Type a command…"
          className="w-full border-b border-border bg-transparent px-3 py-2.5 text-sm text-fg outline-none placeholder:text-fg-muted"
        />
        <div className="max-h-80 overflow-y-auto py-1">
          {results.length === 0 && (
            <p className="px-3 py-3 text-xs text-fg-muted">No matching commands.</p>
          )}
          {results.map((command, index) => (
            <button
              key={command.id}
              type="button"
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => {
                command.run();
                onClose();
              }}
              className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-sm ${
                index === activeIndex ? 'bg-accent/10 text-fg' : 'text-fg-muted'
              }`}
            >
              <span>{command.label}</span>
              {command.keybinding && (
                <span className="text-xs text-fg-muted">{command.keybinding}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
