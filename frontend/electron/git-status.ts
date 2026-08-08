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

export interface CommitWithFiles extends GitCommit {
  files: string[];
}

// A sentinel unlikely to appear in a real commit message/filename, used to
// mark the boundary between one commit's header and its changed-file list
// in a single `git log --name-only` call — one process spawn instead of N,
// which matters once Sprint 14's knowledge indexer wants file-level
// commit->file "modifies" edges for a real project history.
const COMMIT_BOUNDARY = '\x02NEMI-COMMIT\x02';

/**
 * Real commit history (bounded to `limit`) with each commit's changed file
 * paths — feeds the Sprint 14 knowledge graph's commit/author/`modifies`
 * nodes. Git access itself stays here (Sprint 13's git ownership rule);
 * the backend only ever receives what this function already gathered.
 */
export async function getCommitLog(projectPath: string, limit = 50): Promise<CommitWithFiles[]> {
  try {
    const inside = await git(projectPath, ['rev-parse', '--is-inside-work-tree']).catch(
      () => 'false',
    );
    if (inside !== 'true') return [];

    const raw = await git(projectPath, [
      'log',
      `--pretty=format:${COMMIT_BOUNDARY}${LOG_FORMAT}`,
      '--name-only',
      `-${limit}`,
    ]).catch(() => '');
    if (!raw) return [];

    const blocks = raw.split(COMMIT_BOUNDARY).filter(Boolean);
    return blocks.map((block) => {
      const lines = block.split('\n').filter((line) => line.length > 0);
      const [hash, message, author, date] = (lines[0] ?? '').split('\x1f');
      const files = lines.slice(1);
      return { hash: (hash ?? '').slice(0, 8), message, author, date, files };
    });
  } catch {
    return [];
  }
}
