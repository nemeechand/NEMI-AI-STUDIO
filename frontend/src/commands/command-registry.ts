export interface Command {
  id: string;
  label: string;
  /** Human-readable hint only (e.g. "Ctrl+Shift+P") — registering a command
   * here does not itself bind a key; actual keybindings are wired
   * separately (AppShell / MonacoEditorPane) and just happen to share an
   * id with a palette entry for discoverability. */
  keybinding?: string;
  run: () => void;
}

/**
 * A small in-memory command registry — not VS Code's extension-contribution
 * system, just enough for this app's own actions to be listed in the
 * Command Palette (Ctrl+Shift+P) and run by id. Components register their
 * commands on mount via useCommand() and are automatically deregistered on
 * unmount, so the palette only ever lists commands whose action is
 * currently valid (e.g. no "Save" entry when nothing is open).
 */
const commands = new Map<string, Command>();
type Listener = () => void;
const listeners = new Set<Listener>();

function notify(): void {
  listeners.forEach((listener) => listener());
}

export function registerCommand(command: Command): () => void {
  commands.set(command.id, command);
  notify();
  return () => {
    if (commands.get(command.id) === command) {
      commands.delete(command.id);
      notify();
    }
  };
}

export function listCommands(): Command[] {
  return Array.from(commands.values());
}

export function runCommand(id: string): void {
  commands.get(id)?.run();
}

export function onCommandsChange(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
