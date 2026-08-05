import { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

export function WindowControls() {
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    window.nemi.windowControls.isMaximized().then(setIsMaximized);
    return window.nemi.windowControls.onMaximizedChange(setIsMaximized);
  }, []);

  return (
    <div className="app-no-drag flex h-full">
      <button
        type="button"
        aria-label="Minimize"
        className="inline-flex h-full w-11 items-center justify-center text-fg-muted hover:bg-surface-elevated hover:text-fg"
        onClick={() => window.nemi.windowControls.minimize()}
      >
        <Minus size={14} />
      </button>
      <button
        type="button"
        aria-label={isMaximized ? 'Restore' : 'Maximize'}
        className="inline-flex h-full w-11 items-center justify-center text-fg-muted hover:bg-surface-elevated hover:text-fg"
        onClick={() => window.nemi.windowControls.maximizeToggle()}
      >
        {isMaximized ? <Copy size={13} /> : <Square size={12} />}
      </button>
      <button
        type="button"
        aria-label="Close"
        className="inline-flex h-full w-11 items-center justify-center text-fg-muted hover:bg-danger hover:text-white"
        onClick={() => window.nemi.windowControls.close()}
      >
        <X size={15} />
      </button>
    </div>
  );
}
