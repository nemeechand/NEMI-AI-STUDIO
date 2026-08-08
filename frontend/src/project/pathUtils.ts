export function basename(fullPath: string): string {
  return fullPath.split(/[\\/]/).filter(Boolean).pop() ?? fullPath;
}

/** Joins a project root with a relative path (e.g. one a Developer Agent
 * proposes) into an absolute path. Node's fs APIs on Windows accept
 * forward-slash paths without issue, so a plain "/" join is portable
 * enough here — no need for a native path module in the renderer. */
export function joinPath(root: string, relative: string): string {
  const normalizedRoot = root.replace(/[\\/]+$/, '');
  const normalizedRelative = relative.replace(/^[\\/]+/, '');
  return `${normalizedRoot}/${normalizedRelative}`;
}

/** Inverse of joinPath — strips a project root off an absolute file path
 * (as Monaco/the Explorer track it) to get the `relative_path` form the
 * backend's knowledge graph indexes files under. Returns null if `full`
 * isn't actually under `root` (shouldn't happen for files opened from
 * within the current project, but callers should treat it as "can't
 * resolve" rather than guessing). */
export function relativePath(root: string, full: string): string | null {
  const normalizedRoot = root.replace(/\\/g, '/').replace(/\/+$/, '');
  const normalizedFull = full.replace(/\\/g, '/');
  if (!normalizedFull.startsWith(`${normalizedRoot}/`)) return null;
  return normalizedFull.slice(normalizedRoot.length + 1);
}
