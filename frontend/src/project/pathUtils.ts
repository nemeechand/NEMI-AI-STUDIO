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
