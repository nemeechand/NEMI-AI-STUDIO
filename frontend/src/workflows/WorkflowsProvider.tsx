import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useProject } from '../project/useProject';
import { joinPath } from '../project/pathUtils';
import { fetchWithStartupRetry } from '../lib/fetchWithStartupRetry';
import { WorkflowsContext, type WorkflowsContextValue } from './workflows-context';

// Matches AgentsProvider's own poll cadence — a light backup alongside
// whatever push events exist (agents:tasks-changed, reused here since a
// workflow's tasks are agent_tasks too), self-healing if one is ever missed.
const POLL_INTERVAL_MS = 5000;

function processedIdsKey(projectId: string | null, kind: 'tests' | 'docs'): string {
  return `nemi.workflows.${kind}Processed.${projectId ?? 'global'}`;
}

function loadProcessedIds(projectId: string | null, kind: 'tests' | 'docs'): Set<string> {
  try {
    const raw = window.localStorage.getItem(processedIdsKey(projectId, kind));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function saveProcessedIds(
  projectId: string | null,
  kind: 'tests' | 'docs',
  ids: Set<string>,
): void {
  window.localStorage.setItem(processedIdsKey(projectId, kind), JSON.stringify([...ids]));
}

/** Slugifies a feature title into a safe filename component. */
function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'feature'
  );
}

async function fileExists(path: string): Promise<boolean> {
  return window.nemi.fs.readFile(path).then(
    () => true,
    () => false,
  );
}

/** Sprint 15's Documentation Engine write-out: the backend generates real,
 * grounded Markdown (see app/ai/orchestration/documentation.py) but never
 * writes files itself (Sprint 5) — only the renderer reliably knows the
 * open project's path, same reasoning as Fully Automatic's file-apply
 * below. Always appends a real CHANGELOG.md entry and a per-feature doc
 * file; conditionally appends to PROJECT_MEMORY.md/ARCHITECTURE.md only if
 * the open project already has them (never assumes an arbitrary project
 * follows this app's own documentation convention). */
async function writeFeatureDocumentation(projectPath: string, workflow: Workflow): Promise<void> {
  const documentation = workflow.documentation;
  if (!documentation) return;

  const changelogPath = joinPath(projectPath, 'CHANGELOG.md');
  const existingChangelog = await window.nemi.fs.readFile(changelogPath).catch(() => '');
  const changelogHeader = existingChangelog.trim() ? '' : '# Changelog\n\n';
  const entryDate = new Date().toISOString().slice(0, 10);
  const newChangelog =
    `${changelogHeader}${documentation}\n\n_Generated ${entryDate} by NEMI AI Studio's Autonomous Coding Engine._\n\n---\n\n${existingChangelog}`.trim() +
    '\n';
  await window.nemi.fs.writeFile(changelogPath, newChangelog);

  const featureDocDir = joinPath(projectPath, 'docs/features');
  await window.nemi.fs.createDirectory(joinPath(projectPath, 'docs'), 'features').catch(() => {});
  const featureDocPath = joinPath(featureDocDir, `${slugify(workflow.title)}.md`);
  await window.nemi.fs.writeFile(featureDocPath, `${documentation}\n`);

  for (const conventionFile of ['PROJECT_MEMORY.md', 'ARCHITECTURE.md']) {
    const conventionPath = joinPath(projectPath, conventionFile);
    if (!(await fileExists(conventionPath))) continue;
    const existing = await window.nemi.fs.readFile(conventionPath).catch(() => '');
    await window.nemi.fs.writeFile(
      conventionPath,
      `${existing.trimEnd()}\n\n## ${workflow.title} (auto-recorded)\n\n${documentation}\n`,
    );
  }
}

export function WorkflowsProvider({ children }: { children: ReactNode }) {
  const { projectId, projectPath } = useProject();
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedWorkflow, setSelectedWorkflow] = useState<WorkflowDetail | null>(null);
  // Tracks task ids already auto-applied THIS session so a fresh 'auto'
  // workflow's proposed files are only ever written once, even if a poll
  // races the mark-files-applied round trip.
  const autoAppliedRef = useRef<Set<string>>(new Set());
  // Sprint 15: which workflows have already had a real test run triggered
  // / real documentation written to disk — persisted per-project in
  // localStorage (not just in-memory) so a relaunch doesn't re-run tests
  // or re-append documentation for a workflow that finished in an earlier
  // session, mirroring how workspace session state is already persisted.
  const testsProcessedRef = useRef<Set<string>>(loadProcessedIds(projectId, 'tests'));
  const docsProcessedRef = useRef<Set<string>>(loadProcessedIds(projectId, 'docs'));

  useEffect(() => {
    testsProcessedRef.current = loadProcessedIds(projectId, 'tests');
    docsProcessedRef.current = loadProcessedIds(projectId, 'docs');
  }, [projectId]);

  const refresh = useCallback(async () => {
    const list = await window.nemi.workflows.list(projectId);
    setWorkflows(list);

    if (selectedId) {
      const detail = await window.nemi.workflows.get(selectedId).catch(() => null);
      setSelectedWorkflow(detail);
    }

    // Human Approval Mode = Fully Automatic: apply a completed Developer
    // stage's proposed files without waiting for a click, then record
    // that it happened server-side (the same mark-files-applied the
    // manual Apply button uses) so a later poll doesn't repeat it.
    const autoWorkflows = list.filter(
      (w) => w.approval_mode === 'auto' && (w.status === 'queued' || w.status === 'running'),
    );
    for (const workflow of autoWorkflows) {
      if (!projectPath) continue;
      const detail =
        workflow.id === selectedId && selectedWorkflow
          ? selectedWorkflow
          : await window.nemi.workflows.get(workflow.id).catch(() => null);
      if (!detail) continue;
      for (const task of detail.tasks) {
        if (
          task.status !== 'completed' ||
          task.proposed_files_applied ||
          !task.proposed_files?.length ||
          autoAppliedRef.current.has(task.id)
        ) {
          continue;
        }
        autoAppliedRef.current.add(task.id);
        const snapshots: FileSnapshotInput[] = [];
        for (const file of task.proposed_files) {
          const fullPath = joinPath(projectPath, file.path);
          const previousContent = await window.nemi.fs.readFile(fullPath).catch(() => null);
          snapshots.push({ path: file.path, previousContent });
          await window.nemi.fs.writeFile(fullPath, file.content);
        }
        await window.nemi.agents.markFilesApplied(task.id, snapshots);
      }
    }

    // Sprint 15's Test Engine + Documentation Engine: for every workflow
    // that has actually finished, run the open project's real test suite
    // once (if one was detected — never a button that would just fail,
    // same principle as Sprint 13's Build Center) and write out any real
    // generated documentation once it's ready.
    if (projectPath) {
      const availableRunners = await window.nemi.build.detectRunners(projectPath).catch(() => null);
      for (const workflow of list) {
        if (workflow.status !== 'completed') continue;
        if (availableRunners?.test && !testsProcessedRef.current.has(workflow.id)) {
          testsProcessedRef.current.add(workflow.id);
          saveProcessedIds(projectId, 'tests', testsProcessedRef.current);
          const result = await window.nemi.build.runTests(projectPath).catch(() => null);
          if (result) {
            await window.nemi.workflows
              .recordTestResult(workflow.id, {
                passed: result.state === 'success',
                exitCode: result.exitCode,
                outputTail: null,
              })
              .catch(() => {});
          }
        }
        if (workflow.documentation && !docsProcessedRef.current.has(workflow.id)) {
          docsProcessedRef.current.add(workflow.id);
          saveProcessedIds(projectId, 'docs', docsProcessedRef.current);
          await writeFeatureDocumentation(projectPath, workflow).catch(() => {});
        }
      }
    }
  }, [projectId, projectPath, selectedId, selectedWorkflow]);

  useEffect(() => {
    void fetchWithStartupRetry(() => window.nemi.workflows.list(projectId)).then(setWorkflows);
  }, [projectId]);

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, selectedId]);

  useEffect(() => window.nemi.agents.onTasksChanged(() => void refresh()), [refresh]);

  useEffect(() => {
    const interval = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [refresh]);

  const selectWorkflow = useCallback((id: string | null) => {
    setSelectedId(id);
    if (!id) setSelectedWorkflow(null);
  }, []);

  const createWorkflow = useCallback(
    async (input: {
      title: string;
      goal: string;
      provider: string;
      model: string;
      approvalMode: ApprovalMode;
    }) => {
      const created = await window.nemi.workflows.create({ projectId, ...input });
      await refresh();
      return created;
    },
    [projectId, refresh],
  );

  const pauseWorkflow = useCallback(
    async (id: string) => {
      await window.nemi.workflows.pause(id);
      await refresh();
    },
    [refresh],
  );

  const resumeWorkflow = useCallback(
    async (id: string) => {
      await window.nemi.workflows.resume(id);
      await refresh();
    },
    [refresh],
  );

  const cancelWorkflow = useCallback(
    async (id: string) => {
      await window.nemi.workflows.cancel(id);
      await refresh();
    },
    [refresh],
  );

  const approveTask = useCallback(
    async (taskId: string) => {
      await window.nemi.agents.approveTask(taskId);
      await refresh();
    },
    [refresh],
  );

  const value = useMemo<WorkflowsContextValue>(
    () => ({
      workflows,
      selectedWorkflow,
      selectWorkflow,
      createWorkflow,
      pauseWorkflow,
      resumeWorkflow,
      cancelWorkflow,
      approveTask,
      refresh,
    }),
    [
      workflows,
      selectedWorkflow,
      selectWorkflow,
      createWorkflow,
      pauseWorkflow,
      resumeWorkflow,
      cancelWorkflow,
      approveTask,
      refresh,
    ],
  );

  return <WorkflowsContext.Provider value={value}>{children}</WorkflowsContext.Provider>;
}
