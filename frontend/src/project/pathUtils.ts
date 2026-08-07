export function basename(fullPath: string): string {
  return fullPath.split(/[\\/]/).filter(Boolean).pop() ?? fullPath;
}
