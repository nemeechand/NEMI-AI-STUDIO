import { useTheme } from '../../theme/useTheme';

export function GeneralSettingsTab() {
  const { theme, setTheme } = useTheme();

  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-muted">
        Appearance
      </h3>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${
            theme === 'dark'
              ? 'border-accent bg-accent/10 text-fg'
              : 'border-border text-fg-muted hover:text-fg'
          }`}
        >
          Dark
        </button>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex-1 rounded-md border px-3 py-2 text-sm ${
            theme === 'light'
              ? 'border-accent bg-accent/10 text-fg'
              : 'border-border text-fg-muted hover:text-fg'
          }`}
        >
          Light
        </button>
      </div>
    </div>
  );
}
