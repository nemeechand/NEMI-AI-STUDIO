import { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../theme/useTheme';
import { useWorkspace } from '../../workspace/useWorkspace';
import type { EditorGroupId } from '../../workspace/workspace-context';
import { TabStrip } from './TabStrip';
import { acquireModel, getModel, isDirty, markSaved, releaseModel } from './modelRegistry';
import { consumePendingReveal } from './pendingReveal';
import {
  getAutoSaveEnabled,
  getWordWrapEnabled,
  onEditorSettingsChange,
} from '../../settings/editorSettings';
import { useAi } from '../../ai/useAi';
import type { AiContextValue } from '../../ai/ai-context';

const AUTO_SAVE_DEBOUNCE_MS = 1000;

type MonacoNS = typeof import('monaco-editor');
type IStandaloneCodeEditor = import('monaco-editor').editor.IStandaloneCodeEditor;

interface SelectionContext {
  content: string;
  startLine?: number;
  endLine?: number;
}

/** Falls back to the whole file when nothing is selected — a reasonable
 * default for "Explain"/"Fix"/"Refactor" (there's still something concrete
 * to act on), not an empty no-op. */
function getSelectionContext(editor: IStandaloneCodeEditor): SelectionContext {
  const model = editor.getModel();
  const selection = editor.getSelection();
  if (model && selection && !selection.isEmpty()) {
    return {
      content: model.getValueInRange(selection),
      startLine: selection.startLineNumber,
      endLine: selection.endLineNumber,
    };
  }
  return { content: model?.getValue() ?? '' };
}

interface AiEditorAction {
  id: string;
  label: string;
  order: number;
  prompt: string;
  autoSend: boolean;
  /** Monaco KeyCode name (e.g. 'KeyE'), combined with Ctrl+Shift+Alt below
   * — an unusual enough chord to be very unlikely to collide with any of
   * editor.all.js's own default bindings (e.g. plain Shift+Alt+F is
   * "Format Document"). Also gives these actions a keyboard-accessible
   * path beyond the right-click context menu, not just a testing
   * convenience — real UX value for keyboard-first users. */
  keyCode: keyof typeof import('monaco-editor').KeyCode;
}

const AI_EDITOR_ACTIONS: AiEditorAction[] = [
  {
    id: 'nemi.ai.askAboutSelection',
    label: 'AI: Ask About Selection',
    order: 1,
    prompt: '',
    autoSend: false,
    keyCode: 'KeyA',
  },
  {
    id: 'nemi.ai.explain',
    label: 'AI: Explain Code',
    order: 2,
    prompt: 'Explain what this code does.',
    autoSend: true,
    keyCode: 'KeyE',
  },
  {
    id: 'nemi.ai.fix',
    label: 'AI: Fix Code',
    order: 3,
    prompt: 'Find and fix any bugs in this code. Explain the fix.',
    autoSend: true,
    keyCode: 'KeyX',
  },
  {
    id: 'nemi.ai.refactor',
    label: 'AI: Refactor Code',
    order: 4,
    prompt:
      'Refactor this code to improve readability and maintainability, without changing its behavior.',
    autoSend: true,
    keyCode: 'KeyR',
  },
  {
    id: 'nemi.ai.generate',
    label: 'AI: Generate Code…',
    order: 5,
    prompt: 'Generate code that ',
    autoSend: false,
    keyCode: 'KeyG',
  },
];

interface MonacoEditorPaneProps {
  groupId: EditorGroupId;
}

export function MonacoEditorPane({ groupId }: MonacoEditorPaneProps) {
  const { theme } = useTheme();
  const { groups, setActiveTab, closeTab, closeOthers, setTabDirty, registerGroupSaveHandler } =
    useWorkspace();
  const group = groups.find((g) => g.id === groupId);
  const { askAboutSelection } = useAi();
  // The mount effect below only ever runs once, but askAboutSelection's
  // identity changes whenever AiProvider's streaming state does — a ref
  // keeps the addAction callbacks calling the current implementation
  // instead of whatever was in scope at mount time.
  const askAboutSelectionRef = useRef<AiContextValue['askAboutSelection']>(askAboutSelection);
  useEffect(() => {
    askAboutSelectionRef.current = askAboutSelection;
  }, [askAboutSelection]);

  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoNS | null>(null);
  // The active tab's original path string, kept in sync separately from
  // Monaco's own model URI: monaco.Uri.file() lowercases the Windows drive
  // letter on round-trip, so `editor.getModel()?.uri.fsPath` does not equal
  // the path used as the modelRegistry map key — reading it back that way
  // silently misses the registry and drops the save. Tracking the path
  // ourselves sidesteps that URI round-trip entirely.
  const activePathRef = useRef<string | null>(null);
  const acquiredByThisPaneRef = useRef<Set<string>>(new Set());
  const prevTabPathsRef = useRef<Set<string>>(new Set());
  const autoSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function saveTab(path: string): Promise<void> {
    const model = getModel(path);
    if (!model) return;
    const content = model.getValue();
    await window.nemi.fs.writeFile(path, content);
    markSaved(path, content);
    setTabDirty(groupId, path, false);
  }

  function scheduleAutoSave(path: string) {
    const timers = autoSaveTimers.current;
    const existing = timers.get(path);
    if (existing) clearTimeout(existing);
    timers.set(
      path,
      setTimeout(() => {
        timers.delete(path);
        if (getAutoSaveEnabled()) void saveTab(path);
      }, AUTO_SAVE_DEBOUNCE_MS),
    );
  }

  // Mount: lazy-load Monaco, create the editor instance, wire focus-scoped
  // keybindings (Ctrl+S/Ctrl+W only fire while *this* pane has focus —
  // Monaco's own editor.addCommand scoping, no manual focus tracking
  // needed for multi-pane correctness).
  useEffect(() => {
    let disposed = false;
    void import('./monacoSetup').then(({ monaco, ensureMonacoThemes }) => {
      if (disposed || !containerRef.current) return;
      ensureMonacoThemes();
      monacoRef.current = monaco;
      const editor = monaco.editor.create(containerRef.current, {
        theme: theme === 'dark' ? 'nemi-dark' : 'nemi-light',
        automaticLayout: true,
        minimap: { enabled: true },
        wordWrap: getWordWrapEnabled() ? 'on' : 'off',
        fontSize: 13,
      });
      editorRef.current = editor;

      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
        const path = activePathRef.current;
        if (path) void saveTab(path);
      });
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
        const path = activePathRef.current;
        if (path) closeTab(groupId, path);
      });

      for (const action of AI_EDITOR_ACTIONS) {
        editor.addAction({
          id: action.id,
          label: action.label,
          contextMenuGroupId: 'nemi-ai',
          contextMenuOrder: action.order,
          keybindings: [
            monaco.KeyMod.CtrlCmd |
              monaco.KeyMod.Shift |
              monaco.KeyMod.Alt |
              monaco.KeyCode[action.keyCode],
          ],
          run: () => {
            const path = activePathRef.current;
            if (!path) return;
            const { content, startLine, endLine } = getSelectionContext(editor);
            askAboutSelectionRef.current({
              prompt: action.prompt,
              path,
              content,
              startLine,
              endLine,
              autoSend: action.autoSend,
            });
          },
        });
      }

      setReady(true);
    });

    // Captured once per effect run (this effect only ever runs once, on
    // mount) so the cleanup below references the same Set/Map instances
    // regardless of what the refs' `.current` might point to by unmount —
    // satisfies react-hooks/exhaustive-deps without changing behavior,
    // since these refs are never reassigned, only mutated in place.
    const acquiredPaths = acquiredByThisPaneRef.current;
    const timers = autoSaveTimers.current;

    return () => {
      disposed = true;
      editorRef.current?.dispose();
      editorRef.current = null;
      for (const path of acquiredPaths) {
        releaseModel(path);
      }
      acquiredPaths.clear();
      for (const timer of timers.values()) clearTimeout(timer);
      timers.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Register this pane's save handler for Save All.
  useEffect(() => registerGroupSaveHandler(groupId, saveTab), [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme changes.
  useEffect(() => {
    if (!ready) return;
    monacoRef.current?.editor.setTheme(theme === 'dark' ? 'nemi-dark' : 'nemi-light');
  }, [theme, ready]);

  // Word wrap / auto-save setting changes (live, no reload needed).
  useEffect(() => {
    const unsubscribe = onEditorSettingsChange(() => {
      editorRef.current?.updateOptions({ wordWrap: getWordWrapEnabled() ? 'on' : 'off' });
    });
    return unsubscribe;
  }, []);

  // Active tab changed: attach (acquiring on first display) its model.
  useEffect(() => {
    if (!ready || !group) return;
    const monacoNS = monacoRef.current;
    const path = group.activeTabPath;
    activePathRef.current = path;
    if (!path || !monacoNS) {
      editorRef.current?.setModel(null);
      return;
    }

    let cancelled = false;
    void (async () => {
      let model = getModel(path);
      if (!model) {
        try {
          const content = await window.nemi.fs.readFile(path);
          if (cancelled) return;
          model = acquireModel(monacoNS, path, content);
          model.onDidChangeContent(() => {
            const dirty = isDirty(path);
            setTabDirty(groupId, path, dirty);
            if (getAutoSaveEnabled()) scheduleAutoSave(path);
          });
        } catch (error) {
          if (!cancelled) {
            setLoadError(error instanceof Error ? error.message : 'Failed to open file');
            closeTab(groupId, path);
          }
          return;
        }
      } else if (!acquiredByThisPaneRef.current.has(path)) {
        // Model already exists (opened in the other split group, or a
        // previous activation in this pane already acquired it) — bump the
        // ref count so this pane's later release is symmetric.
        acquireModel(monacoNS, path, model.getValue());
      }
      acquiredByThisPaneRef.current.add(path);
      if (!cancelled) {
        setLoadError(null);
        editorRef.current?.setModel(model);
        const reveal = consumePendingReveal(path);
        if (reveal) {
          editorRef.current?.revealLineInCenter(reveal.line);
          editorRef.current?.setPosition({ lineNumber: reveal.line, column: reveal.column });
          editorRef.current?.focus();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, group?.activeTabPath]);

  // Tabs closed in this group: release the models this pane had acquired.
  useEffect(() => {
    if (!group) return;
    const current = new Set(group.tabs.map((t) => t.path));
    for (const path of prevTabPathsRef.current) {
      if (!current.has(path) && acquiredByThisPaneRef.current.has(path)) {
        releaseModel(path);
        acquiredByThisPaneRef.current.delete(path);
        const timer = autoSaveTimers.current.get(path);
        if (timer) clearTimeout(timer);
        autoSaveTimers.current.delete(path);
      }
    }
    prevTabPathsRef.current = current;
  }, [group?.tabs]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!group) return null;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TabStrip
        group={group}
        onActivate={(path) => setActiveTab(groupId, path)}
        onClose={(path) => closeTab(groupId, path)}
        onCloseOthers={(path) => closeOthers(groupId, path)}
      />
      {loadError && (
        <p className="border-b border-border px-3 py-1 text-xs text-danger">{loadError}</p>
      )}
      <div className="min-h-0 flex-1" ref={containerRef} />
    </div>
  );
}
