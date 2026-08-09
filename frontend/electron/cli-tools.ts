import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import type { CliToolId } from './cli-tools-client';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 15_000;
// A real, generous ceiling on how long one CLI coding agent invocation may
// run before it's treated as hung — long enough for a genuine multi-file
// implementation task, short enough that a stuck process doesn't block the
// single-flight dispatch lock (see `activeDispatch` below) forever.
const CLI_DISPATCH_TIMEOUT_MS = 15 * 60_000;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, timeout: GIT_TIMEOUT_MS });
  return stdout.trim();
}

export interface CliCheckpoint {
  ok: boolean;
  reason?: string;
  beforeCommit: string | null;
  checkpointCreated: boolean;
}

/**
 * Sprint 16 safety net for a CLI coding agent's DIRECT filesystem writes
 * (unlike an API Developer task's human-gated fenced-block proposals —
 * see manager.py's build_task_prompt) — verifies the project is a real
 * git repository (required; a CLI agent is never dispatched into a
 * non-git project, since there would be no way to isolate or revert its
 * changes) and, if the working tree is dirty, commits the user's own
 * pending changes as an explicit checkpoint FIRST so the CLI agent's
 * changes are never mixed into un-reviewed pre-existing edits — "never
 * overwrite unrelated user changes" from a real, inspectable git history,
 * not a guess.
 */
export async function prepareCliCheckpoint(projectPath: string): Promise<CliCheckpoint> {
  const inside = await git(projectPath, ['rev-parse', '--is-inside-work-tree']).catch(
    () => 'false',
  );
  if (inside !== 'true') {
    return {
      ok: false,
      reason:
        'This project is not a git repository. CLI coding agents require git so their ' +
        'changes can be safely checkpointed and reviewed — initialize a git repository ' +
        '(git init) and commit at least once, then retry.',
      beforeCommit: null,
      checkpointCreated: false,
    };
  }

  const hasCommits = await git(projectPath, ['rev-parse', '--verify', 'HEAD'])
    .then(() => true)
    .catch(() => false);
  if (!hasCommits) {
    return {
      ok: false,
      reason:
        'This git repository has no commits yet. Make an initial commit before dispatching ' +
        'a CLI coding agent, so its changes have a real baseline to diff/revert against.',
      beforeCommit: null,
      checkpointCreated: false,
    };
  }

  const statusPorcelain = await git(projectPath, ['status', '--porcelain']).catch(() => '');
  let checkpointCreated = false;
  if (statusPorcelain.length > 0) {
    await git(projectPath, ['add', '-A']);
    await git(projectPath, [
      'commit',
      '-m',
      'NEMI: checkpoint before CLI coding agent run (Sprint 16 Task Router)',
    ]);
    checkpointCreated = true;
  }

  const beforeCommit = await git(projectPath, ['rev-parse', 'HEAD']).catch(() => null);
  return { ok: true, beforeCommit, checkpointCreated };
}

/**
 * After a CLI agent finishes, commits whatever it changed (a second real
 * commit, distinct from the checkpoint) and returns the list of paths
 * that differ between the checkpoint and this new commit — the CLI
 * dispatch equivalent of a Developer task's `proposed_files`, except
 * these files are already safely committed rather than merely proposed.
 * Returns an empty list (never throws) if the agent made no changes.
 */
export async function commitCliChanges(
  projectPath: string,
  beforeCommit: string,
  taskTitle: string,
): Promise<string[]> {
  const statusPorcelain = await git(projectPath, ['status', '--porcelain']).catch(() => '');
  if (statusPorcelain.length === 0) return [];
  await git(projectPath, ['add', '-A']);
  await git(projectPath, ['commit', '-m', `NEMI: CLI agent changes — ${taskTitle}`]);
  const diffOutput = await git(projectPath, ['diff', '--name-only', beforeCommit, 'HEAD']).catch(
    () => '',
  );
  return diffOutput.split('\n').filter(Boolean);
}

interface CliDispatchConfig {
  binary: string;
  buildArgs: (prompt: string) => string[];
}

// Sprint 16: the officially documented non-interactive/"print mode"
// invocation for each CLI's own coding-agent behavior as of this sprint
// — spawned with the project directory as cwd so the tool operates on
// the currently open project the same way a user running it from a
// terminal there would. A future CLI version changing its flags would
// need this updated; detection (app/ai/cli_tools.py) is independent of
// this and stays correct either way.
const CLI_DISPATCH_CONFIG: Record<CliToolId, CliDispatchConfig> = {
  'claude-code-cli': {
    binary: 'claude',
    buildArgs: (prompt) => ['-p', prompt, '--permission-mode', 'acceptEdits'],
  },
  'codex-cli': {
    binary: 'codex',
    buildArgs: (prompt) => ['exec', '--full-auto', prompt],
  },
  'gemini-cli': {
    binary: 'gemini',
    buildArgs: (prompt) => ['-p', prompt, '--yolo'],
  },
};

export interface CliOutputEvent {
  taskId: string;
  stream: 'stdout' | 'stderr';
  chunk: string;
}

export interface CliDispatchResult {
  success: boolean;
  exitCode: number | null;
  output: string;
  cancelled: boolean;
  timedOut: boolean;
}

interface TrackedDispatch {
  taskId: string;
  proc: ChildProcess;
  cancelled: boolean;
}

// Sprint 16 SAFETY rule: "never allow two coding agents to modify the
// same files simultaneously" — a CLI agent has direct filesystem write
// access (unlike an API Developer task's human-gated proposals), so
// rather than trying to prove file-level isolation between two live CLI
// runs, dispatch is strictly single-flight, project-wide: only one CLI
// coding agent process runs at a time across the whole app.
let activeDispatch: TrackedDispatch | null = null;

export function isCliDispatchActive(): boolean {
  return activeDispatch !== null;
}

export async function dispatchCliTask(params: {
  taskId: string;
  cliToolId: CliToolId;
  prompt: string;
  projectPath: string;
  onOutput: (event: CliOutputEvent) => void;
}): Promise<CliDispatchResult> {
  if (activeDispatch) {
    throw new Error(
      `A CLI coding agent is already running (task ${activeDispatch.taskId}). ` +
        'Only one may run at a time to guarantee file-write isolation.',
    );
  }
  const config = CLI_DISPATCH_CONFIG[params.cliToolId];

  return new Promise((resolve) => {
    const proc = spawn(config.binary, config.buildArgs(params.prompt), {
      cwd: params.projectPath,
      shell: process.platform === 'win32',
    });
    const tracked: TrackedDispatch = { taskId: params.taskId, proc, cancelled: false };
    activeDispatch = tracked;

    const outputChunks: string[] = [];
    let settled = false;
    const timeoutHandle = setTimeout(() => {
      if (settled) return;
      tracked.cancelled = true;
      proc.kill();
    }, CLI_DISPATCH_TIMEOUT_MS);

    proc.stdout?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      outputChunks.push(text);
      params.onOutput({ taskId: params.taskId, stream: 'stdout', chunk: text });
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      outputChunks.push(text);
      params.onOutput({ taskId: params.taskId, stream: 'stderr', chunk: text });
    });

    proc.on('exit', (code) => {
      settled = true;
      clearTimeout(timeoutHandle);
      activeDispatch = null;
      resolve({
        success: !tracked.cancelled && code === 0,
        exitCode: code,
        output: outputChunks.join(''),
        cancelled: tracked.cancelled,
        timedOut: tracked.cancelled && code !== 0,
      });
    });
    proc.on('error', (error) => {
      settled = true;
      clearTimeout(timeoutHandle);
      activeDispatch = null;
      outputChunks.push(`\n[NEMI] Failed to start ${config.binary}: ${error.message}`);
      resolve({
        success: false,
        exitCode: null,
        output: outputChunks.join(''),
        cancelled: false,
        timedOut: false,
      });
    });
  });
}

export function cancelCliDispatch(taskId: string): boolean {
  if (!activeDispatch || activeDispatch.taskId !== taskId) return false;
  activeDispatch.cancelled = true;
  activeDispatch.proc.kill();
  return true;
}
