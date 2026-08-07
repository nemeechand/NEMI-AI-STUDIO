const EXTENSION_TO_LANGUAGE: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'css',
  less: 'css',
  json: 'json',
  jsonc: 'json',
  md: 'markdown',
  markdown: 'markdown',
  py: 'python',
  pyw: 'python',
  yml: 'yaml',
  yaml: 'yaml',
  xml: 'xml',
};

export function languageForPath(filePath: string): string {
  const match = /\.([^./\\]+)$/.exec(filePath);
  const extension = match?.[1]?.toLowerCase();
  return (extension && EXTENSION_TO_LANGUAGE[extension]) ?? 'plaintext';
}
