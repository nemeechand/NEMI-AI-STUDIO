/** A tiny side-channel so Global Search results can open a file *and* land
 * on the right line/column, without threading that through
 * WorkspaceContext (which stays Monaco-agnostic — see workspace-context.ts).
 * requestReveal() is called right before openFile(); whichever
 * MonacoEditorPane ends up attaching a model for that path consumes (and
 * clears) the request once. */
interface PendingReveal {
  path: string;
  line: number;
  column: number;
}

let pending: PendingReveal | null = null;

export function requestReveal(path: string, line: number, column = 1): void {
  pending = { path, line, column };
}

export function consumePendingReveal(path: string): { line: number; column: number } | null {
  if (pending && pending.path === path) {
    const { line, column } = pending;
    pending = null;
    return { line, column };
  }
  return null;
}
