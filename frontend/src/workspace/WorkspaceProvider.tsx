import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import {
  WorkspaceContext,
  type EditorGroup,
  type EditorGroupId,
  type SplitDirection,
  type WorkspaceContextValue,
} from './workspace-context';

const STORAGE_PREFIX = 'nemi.workspace.tabs.';
const CLOSED_TABS_STACK_LIMIT = 20;

interface PersistedState {
  splitDirection: SplitDirection | null;
  groups: { id: EditorGroupId; tabs: string[]; activeTabPath: string | null }[];
}

function storageKey(projectPath: string): string {
  return `${STORAGE_PREFIX}${projectPath}`;
}

function emptyGroups(): EditorGroup[] {
  return [{ id: 'primary', tabs: [], activeTabPath: null }];
}

function readPersistedState(
  projectPath: string,
): { groups: EditorGroup[]; splitDirection: SplitDirection | null } | null {
  const raw = window.localStorage.getItem(storageKey(projectPath));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedState;
    return {
      splitDirection: parsed.splitDirection,
      groups: parsed.groups.map((g) => ({
        id: g.id,
        activeTabPath: g.activeTabPath,
        tabs: g.tabs.map((path) => ({ path, isDirty: false })),
      })),
    };
  } catch {
    return null;
  }
}

/**
 * Auto-saves and restores the workspace — active project's open tabs,
 * per-group, plus split layout — scoped per project path (Sprint 7's
 * per-project-scoped localStorage principle, extended for Sprint 9's
 * multi-tab/split model). Only structure (paths, active tab, split
 * direction) is ever persisted — never file content, matching the
 * principle locked in Sprint 7. Window chrome remains out of scope.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { projectPath } = useProject();
  const [groups, setGroups] = useState<EditorGroup[]>(emptyGroups());
  const [splitDirection, setSplitDirection] = useState<SplitDirection | null>(null);
  const closedTabsStack = useRef<string[]>([]);
  const saveHandlers = useRef<Map<EditorGroupId, (path: string) => Promise<void>>>(new Map());

  // Re-derive tabs/split whenever the active project changes (including
  // launch-time restore, once ProjectProvider resolves it) — same reactive
  // pattern as Sprint 7's single-file version.
  useEffect(() => {
    closedTabsStack.current = [];
    if (!projectPath) {
      setGroups(emptyGroups());
      setSplitDirection(null);
      return;
    }
    const restored = readPersistedState(projectPath);
    if (restored && restored.groups.length > 0) {
      setGroups(restored.groups);
      setSplitDirection(restored.groups.length > 1 ? restored.splitDirection : null);
    } else {
      setGroups(emptyGroups());
      setSplitDirection(null);
    }
  }, [projectPath]);

  // Auto-save structure on every change.
  useEffect(() => {
    if (!projectPath) return;
    const hasAnyTabs = groups.some((g) => g.tabs.length > 0);
    if (!hasAnyTabs) {
      window.localStorage.removeItem(storageKey(projectPath));
      return;
    }
    const persisted: PersistedState = {
      splitDirection,
      groups: groups.map((g) => ({
        id: g.id,
        activeTabPath: g.activeTabPath,
        tabs: g.tabs.map((t) => t.path),
      })),
    };
    window.localStorage.setItem(storageKey(projectPath), JSON.stringify(persisted));
  }, [projectPath, groups, splitDirection]);

  const value = useMemo<WorkspaceContextValue>(() => {
    function updateGroup(groupId: EditorGroupId, updater: (group: EditorGroup) => EditorGroup) {
      setGroups((prev) => prev.map((g) => (g.id === groupId ? updater(g) : g)));
    }

    function openFile(path: string, groupId: EditorGroupId = 'primary') {
      updateGroup(groupId, (group) => {
        const exists = group.tabs.some((t) => t.path === path);
        return {
          ...group,
          tabs: exists ? group.tabs : [...group.tabs, { path, isDirty: false }],
          activeTabPath: path,
        };
      });
    }

    function setActiveTab(groupId: EditorGroupId, path: string) {
      updateGroup(groupId, (group) => ({ ...group, activeTabPath: path }));
    }

    function closeTab(groupId: EditorGroupId, path: string) {
      closedTabsStack.current = [path, ...closedTabsStack.current].slice(
        0,
        CLOSED_TABS_STACK_LIMIT,
      );
      setGroups((prev) => {
        const next = prev.map((g) => {
          if (g.id !== groupId) return g;
          const tabs = g.tabs.filter((t) => t.path !== path);
          const wasActive = g.activeTabPath === path;
          const activeTabPath = wasActive ? (tabs[tabs.length - 1]?.path ?? null) : g.activeTabPath;
          return { ...g, tabs, activeTabPath };
        });
        // Closing the last tab in the secondary (split) group collapses
        // the split — matches the bounded 2-group design (no empty panes).
        const secondary = next.find((g) => g.id === 'secondary');
        if (secondary && secondary.tabs.length === 0) {
          setSplitDirection(null);
          return next.filter((g) => g.id !== 'secondary');
        }
        return next;
      });
    }

    function closeOthers(groupId: EditorGroupId, path: string) {
      updateGroup(groupId, (group) => ({
        ...group,
        tabs: group.tabs.filter((t) => t.path === path),
        activeTabPath: path,
      }));
    }

    function reopenClosedTab() {
      const [mostRecent, ...rest] = closedTabsStack.current;
      if (!mostRecent) return;
      closedTabsStack.current = rest;
      openFile(mostRecent, 'primary');
    }

    function split(direction: SplitDirection) {
      setSplitDirection(direction);
      setGroups((prev) => {
        if (prev.some((g) => g.id === 'secondary')) return prev;
        const primary = prev.find((g) => g.id === 'primary');
        const seedTab = primary?.activeTabPath;
        const secondary: EditorGroup = {
          id: 'secondary',
          tabs: seedTab ? [{ path: seedTab, isDirty: false }] : [],
          activeTabPath: seedTab ?? null,
        };
        return [...prev, secondary];
      });
    }

    function unsplit() {
      setSplitDirection(null);
      setGroups((prev) => prev.filter((g) => g.id !== 'secondary'));
    }

    async function saveAll() {
      await Promise.all(
        groups.flatMap((group) => {
          const handler = saveHandlers.current.get(group.id);
          if (!handler) return [];
          return group.tabs.filter((t) => t.isDirty).map((t) => handler(t.path));
        }),
      );
    }

    function registerGroupSaveHandler(
      groupId: EditorGroupId,
      handler: (path: string) => Promise<void>,
    ) {
      saveHandlers.current.set(groupId, handler);
      return () => {
        if (saveHandlers.current.get(groupId) === handler) {
          saveHandlers.current.delete(groupId);
        }
      };
    }

    function setTabDirty(groupId: EditorGroupId, path: string, dirty: boolean) {
      updateGroup(groupId, (group) => ({
        ...group,
        tabs: group.tabs.map((t) => (t.path === path ? { ...t, isDirty: dirty } : t)),
      }));
    }

    return {
      groups,
      splitDirection,
      openFile,
      setActiveTab,
      closeTab,
      closeOthers,
      reopenClosedTab,
      split,
      unsplit,
      saveAll,
      registerGroupSaveHandler,
      setTabDirty,
    };
  }, [groups, splitDirection]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}
