import { useTheme } from '../../theme/useTheme';

export function StatusBar() {
  const { theme } = useTheme();

  return (
    <footer className="flex h-6 shrink-0 items-center justify-between border-t border-border bg-accent px-3 text-xs text-accent-fg">
      <div className="flex items-center gap-3">
        <span>NEMI AI STUDIO</span>
        <span>Sprint 2 — Desktop Shell</span>
      </div>
      <div className="flex items-center gap-3">
        <span className="capitalize">{theme} theme</span>
        <span className="flex items-center gap-1">
          <span className="h-1.5 w-1.5 rounded-full bg-success" />
          Ready
        </span>
      </div>
    </footer>
  );
}
