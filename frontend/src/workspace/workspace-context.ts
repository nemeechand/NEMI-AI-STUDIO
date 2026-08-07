import { createContext } from 'react';

export type EditorGroupId = 'primary' | 'secondary';
export type SplitDirection = 'horizontal' | 'vertical';

export interface EditorTab {
  path: string;
  isDirty: boolean;
}

export interface EditorGroup {
  id: EditorGroupId;
  tabs: EditorTab[];
  activeTabPath: string | null;
}

export interface WorkspaceContextValue {
  groups: EditorGroup[];
  splitDirection: SplitDirection | null;
  /** Adds (or activates, if already open) a tab in the given group. Purely
   * structural — does not read file content or touch Monaco; the owning
   * MonacoEditorPane reacts to the resulting activeTabPath change. */
  openFile: (path: string, groupId?: EditorGroupId) => void;
  setActiveTab: (groupId: EditorGroupId, path: string) => void;
  closeTab: (groupId: EditorGroupId, path: string) => void;
  closeOthers: (groupId: EditorGroupId, path: string) => void;
  reopenClosedTab: () => void;
  split: (direction: SplitDirection) => void;
  unsplit: () => void;
  saveAll: () => Promise<void>;
  registerGroupSaveHandler: (
    groupId: EditorGroupId,
    handler: (path: string) => Promise<void>,
  ) => () => void;
  setTabDirty: (groupId: EditorGroupId, path: string, dirty: boolean) => void;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
