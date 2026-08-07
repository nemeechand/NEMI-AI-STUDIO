import { dialog, type BrowserWindow } from 'electron';

export async function selectProjectFolder(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}

/**
 * Picks a parent directory for the New Project Wizard (name/description are
 * entered in-app, not via a native save-dialog — see NewProjectWizard.tsx).
 * Distinct from selectProjectFolder() to avoid overloading "pick a folder to
 * open as a project" with "pick a folder to create a new project inside."
 */
export async function selectDirectory(window: BrowserWindow): Promise<string | null> {
  const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
}
