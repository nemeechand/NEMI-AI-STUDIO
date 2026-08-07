import { useEffect } from 'react';
import { registerCommand, type Command } from './command-registry';

/** Registers a command for the lifetime of the calling component. Pass the
 * live `run` callback each render — the effect re-registers whenever `id`
 * or `enabled` changes, always capturing the latest closure. */
export function useCommand(
  id: string,
  label: string,
  run: () => void,
  options?: { keybinding?: string; enabled?: boolean },
): void {
  const enabled = options?.enabled ?? true;
  useEffect(() => {
    if (!enabled) return undefined;
    const command: Command = { id, label, keybinding: options?.keybinding, run };
    return registerCommand(command);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, label, enabled, options?.keybinding]);
}
