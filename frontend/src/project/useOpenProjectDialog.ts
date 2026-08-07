import { useProject } from './useProject';

interface OpenProjectDialog {
  openExisting: () => Promise<void>;
}

export function useOpenProjectDialog(): OpenProjectDialog {
  const { openProject } = useProject();

  async function openExisting(): Promise<void> {
    const path = await window.nemi.fs.selectProjectFolder();
    if (path) await openProject(path);
  }

  return { openExisting };
}
