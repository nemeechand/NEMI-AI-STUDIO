import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const GIT_TIMEOUT_MS = 8_000;

export interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

export interface GitStatus {
  isRepo: boolean;
  branch: string | null;
  isDirty: boolean;
  ahead: number | null;
  behind: number | null;
  lastCommit: GitCommit | null;
  recentCommits: GitCommit[];
}

const NOT_A_REPO: GitStatus = {
  isRepo: false,
  branch: null,
  isDirty: false,
  ahead: null,
  behind: null,
  lastCommit: null,
  recentCommits: [],
};

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd, timeout: GIT_TIMEOUT_MS });
  return stdout.trim();
}

// %x1f/%x1e are ASCII unit/record separators — safe delimiters that won't
// collide with real commit message content, unlike a comma or pipe.
const LOG_FORMAT = '%H%x1f%s%x1f%an%x1f%aI';

function parseLogOutput(raw: string): GitCommit[] {
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [hash, message, author, date] = line.split('\x1f');
      return { hash: hash.slice(0, 8), message, author, date };
    });
}

/**
 * Real git status for whatever project folder is currently open (not
 * NEMI AI STUDIO's own source repo — a packaged install has no `.git`
 * at all, and the whole point of this app is helping the user build
 * *their* project). Never throws: any failure (git not installed, not a
 * repo, no commits yet) is reported as `isRepo: false` / null fields
 * rather than surfaced as an error — this is informational, not a
 * required capability.
 */
export async function getGitStatus(projectPath: string): Promise<GitStatus> {
  try {
    const inside = await git(projectPath, ['rev-parse', '--is-inside-work-tree']).catch(
      () => 'false',
    );
    if (inside !== 'true') return NOT_A_REPO;

    const branch = await git(projectPath, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => null);
    const statusPorcelain = await git(projectPath, ['status', '--porcelain']).catch(() => '');
    const isDirty = statusPorcelain.length > 0;

    let ahead: number | null = null;
    let behind: number | null = null;
    const aheadBehind = await git(projectPath, [
      'rev-list',
      '--left-right',
      '--count',
      'HEAD...@{u}',
    ]).catch(() => null);
    if (aheadBehind) {
      const [aheadStr, behindStr] = aheadBehind.split(/\s+/);
      ahead = Number(aheadStr);
      behind = Number(behindStr);
    }

    const recentLog = await git(projectPath, ['log', `--pretty=format:${LOG_FORMAT}`, '-10']).catch(
      () => '',
    );
    const recentCommits = parseLogOutput(recentLog);

    return {
      isRepo: true,
      branch,
      isDirty,
      ahead,
      behind,
      lastCommit: recentCommits[0] ?? null,
      recentCommits,
    };
  } catch {
    return NOT_A_REPO;
  }
}
