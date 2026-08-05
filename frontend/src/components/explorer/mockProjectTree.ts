export interface ProjectNode {
  id: string;
  name: string;
  type: 'folder' | 'file';
  children?: ProjectNode[];
}

export const mockProjectTree: ProjectNode[] = [
  {
    id: 'frontend',
    name: 'frontend',
    type: 'folder',
    children: [
      {
        id: 'frontend-src',
        name: 'src',
        type: 'folder',
        children: [
          { id: 'frontend-app', name: 'App.tsx', type: 'file' },
          { id: 'frontend-main', name: 'main.tsx', type: 'file' },
        ],
      },
      {
        id: 'frontend-electron',
        name: 'electron',
        type: 'folder',
        children: [
          { id: 'frontend-electron-main', name: 'main.ts', type: 'file' },
          { id: 'frontend-electron-preload', name: 'preload.ts', type: 'file' },
        ],
      },
    ],
  },
  {
    id: 'backend',
    name: 'backend',
    type: 'folder',
    children: [
      {
        id: 'backend-app',
        name: 'app',
        type: 'folder',
        children: [{ id: 'backend-main', name: 'main.py', type: 'file' }],
      },
    ],
  },
];
