import { useProject } from './useProject';

interface OpenProjectDialog {
  openExisting: () => Promise<void>;
  createNew: () => Promise<void>;
}

export function useOpenProjectDialog(): OpenProjectDialog {
  const { openProject } = useProject();

  async function openExisting(): Promise<void> {
    const path = await window.nemi.fs.selectProjectFolder('open');
    if (path) await openProject(path);
  }

  async function createNew(): Promise<void> {
    const path = await window.nemi.fs.selectProjectFolder('new');
    if (path) await openProject(path);
  }

  return { openExisting, createNew };
}
