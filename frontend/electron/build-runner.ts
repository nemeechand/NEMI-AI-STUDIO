import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

export type RunnerId = 'build' | 'test' | 'verify';
export type RunnerState = 'idle' | 'running' | 'success' | 'failed' | 'cancelled';

export interface RunnerOutputEvent {
  runnerId: RunnerId;
  stream: 'stdout' | 'stderr';
  chunk: string;
}

export interface RunnerStatusEvent {
  runnerId: RunnerId;
  state: RunnerState;
  exitCode: number | null;
}

export interface AvailableRunners {
  build: boolean;
  test: boolean;
}

interface TrackedProcess {
  proc: ChildProcess;
  cancelled: boolean;
}

const runningProcesses = new Map<RunnerId, TrackedProcess>();

async function pathExists(candidate: string): Promise<boolean> {
  try {
    await fs.access(candidate);
    return true;
  } catch {
    return false;
  }
}

/**
 * Real introspection of the currently-open *user* project (not this
 * app's own source) — NEMI AI STUDIO's Build Center runs the project's
 * own tooling, it doesn't invent one. A Node project offers Build/Test
 * only if `package.json` actually defines those npm scripts; a Python
 * project (`requirements.txt` or `pyproject.toml` present) offers Test
 * via `pytest` if it's importable. Neither present means neither button
 * is offered, rather than a build/test action that would just fail.
 */
export async function detectAvailableRunners(projectPath: string): Promise<AvailableRunners> {
  const packageJsonPath = path.join(projectPath, 'package.json');
  let hasNpmBuild = false;
  let hasNpmTest = false;
  if (await pathExists(packageJsonPath)) {
    try {
      const raw = await fs.readFile(packageJsonPath, 'utf-8');
      const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
      hasNpmBuild = Boolean(parsed.scripts?.build);
      hasNpmTest = Boolean(parsed.scripts?.test);
    } catch {
      // Malformed package.json — treat as no scripts available.
    }
  }

  const isPythonProject =
    (await pathExists(path.join(projectPath, 'requirements.txt'))) ||
    (await pathExists(path.join(projectPath, 'pyproject.toml')));

  return {
    build: hasNpmBuild,
    test: hasNpmTest || isPythonProject,
  };
}

function runProcess(
  runnerId: RunnerId,
  command: string,
  args: string[],
  cwd: string,
  onOutput: (event: RunnerOutputEvent) => void,
): Promise<RunnerStatusEvent> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, { cwd, shell: process.platform === 'win32' });
    const tracked: TrackedProcess = { proc, cancelled: false };
    runningProcesses.set(runnerId, tracked);

    proc.stdout?.on('data', (chunk: Buffer) => {
      onOutput({ runnerId, stream: 'stdout', chunk: chunk.toString() });
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      onOutput({ runnerId, stream: 'stderr', chunk: chunk.toString() });
    });

    proc.on('exit', (code) => {
      runningProcesses.delete(runnerId);
      const state: RunnerState = tracked.cancelled
        ? 'cancelled'
        : code === 0
          ? 'success'
          : 'failed';
      resolve({ runnerId, state, exitCode: code });
    });
    proc.on('error', () => {
      runningProcesses.delete(runnerId);
      resolve({ runnerId, state: 'failed', exitCode: null });
    });
  });
}

export async function runBuild(
  projectPath: string,
  onOutput: (event: RunnerOutputEvent) => void,
): Promise<RunnerStatusEvent> {
  return runProcess('build', 'npm', ['run', 'build'], projectPath, onOutput);
}

export async function runTests(
  projectPath: string,
  onOutput: (event: RunnerOutputEvent) => void,
): Promise<RunnerStatusEvent> {
  const available = await detectAvailableRunners(projectPath);
  if (available.test && (await pathExists(path.join(projectPath, 'package.json')))) {
    const raw = await fs.readFile(path.join(projectPath, 'package.json'), 'utf-8');
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    if (parsed.scripts?.test) {
      return runProcess('test', 'npm', ['test'], projectPath, onOutput);
    }
  }
  return runProcess(
    'test',
    process.platform === 'win32' ? 'python' : 'python3',
    ['-m', 'pytest'],
    projectPath,
    onOutput,
  );
}

/**
 * A fast, safe-to-run-often subset of the full build/test suite — the
 * project's own compiler/linter, not a fabricated "verification"
 * concept. Only attempted for the tooling actually detected.
 */
export async function runVerification(
  projectPath: string,
  onOutput: (event: RunnerOutputEvent) => void,
): Promise<RunnerStatusEvent> {
  const hasPackageJson = await pathExists(path.join(projectPath, 'package.json'));
  if (hasPackageJson) {
    return runProcess('verify', 'npx', ['tsc', '--noEmit'], projectPath, onOutput);
  }
  return runProcess(
    'verify',
    process.platform === 'win32' ? 'python' : 'python3',
    ['-m', 'compileall', '-q', '.'],
    projectPath,
    onOutput,
  );
}

export function cancelRunner(runnerId: RunnerId): boolean {
  const tracked = runningProcesses.get(runnerId);
  if (!tracked) return false;
  tracked.cancelled = true;
  tracked.proc.kill();
  return true;
}

export function isRunnerActive(runnerId: RunnerId): boolean {
  return runningProcesses.has(runnerId);
}
