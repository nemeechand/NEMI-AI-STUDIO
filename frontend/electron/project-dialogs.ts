import { dialog, type BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import { postLog } from './backend-client';

export async function selectProjectFolder(
  window: BrowserWindow,
  mode: 'open' | 'new',
): Promise<string | null> {
  if (mode === 'open') {
    const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  }

  const result = await dialog.showSaveDialog(window, {
    title: 'Create New Project',
    buttonLabel: 'Create Project',
    properties: ['createDirectory'],
  });
  if (result.canceled || !result.filePath) return null;

  await fs.mkdir(result.filePath, { recursive: true });
  postLog('INFO', 'fs.project', `Created new project folder ${result.filePath}`);
  return result.filePath;
}
