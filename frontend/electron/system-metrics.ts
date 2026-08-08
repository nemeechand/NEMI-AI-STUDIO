import { app } from 'electron';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface SystemMetrics {
  cpu: { usedPercent: number | null; cores: number };
  memory: { totalMb: number; freeMb: number; usedPercent: number };
  disk: { totalMb: number | null; freeMb: number | null; usedPercent: number | null };
  electronMemoryMb: number;
}

function snapshotCpuTimes(): { idle: number; total: number }[] {
  return os.cpus().map((cpu) => {
    const times = cpu.times;
    const total = times.user + times.nice + times.sys + times.irq + times.idle;
    return { idle: times.idle, total };
  });
}

/**
 * `os.loadavg()` always returns `[0, 0, 0]` on Windows (Node's own
 * documented limitation) — the standard cross-platform workaround is
 * sampling `os.cpus()` twice with a short delay and diffing idle vs.
 * total ticks, which is what this does. The ~150ms delay is deliberate
 * (long enough for a meaningfully non-zero tick delta, short enough to
 * stay invisible in a dashboard poll) and only paid when this function
 * is actually called, not continuously.
 */
async function getCpuUsagePercent(): Promise<number> {
  const before = snapshotCpuTimes();
  await new Promise((resolve) => setTimeout(resolve, 150));
  const after = snapshotCpuTimes();

  let idleDelta = 0;
  let totalDelta = 0;
  for (let i = 0; i < before.length; i++) {
    idleDelta += after[i].idle - before[i].idle;
    totalDelta += after[i].total - before[i].total;
  }
  if (totalDelta <= 0) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - idleDelta / totalDelta)));
}

async function getDiskUsage(
  forPath: string,
): Promise<{ totalMb: number | null; freeMb: number | null; usedPercent: number | null }> {
  if (process.platform !== 'win32') return { totalMb: null, freeMb: null, usedPercent: null };
  try {
    const driveLetter = path.parse(forPath).root.replace(/[\\/]/g, '').replace(':', '');
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `$d = Get-PSDrive -Name ${driveLetter}; "$($d.Used)"; "$($d.Free)"`,
    ]);
    const [usedStr, freeStr] = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const used = Number(usedStr);
    const free = Number(freeStr);
    if (!Number.isFinite(used) || !Number.isFinite(free)) {
      return { totalMb: null, freeMb: null, usedPercent: null };
    }
    const totalMb = (used + free) / (1024 * 1024);
    const freeMb = free / (1024 * 1024);
    return { totalMb, freeMb, usedPercent: (used / (used + free)) * 100 };
  } catch {
    return { totalMb: null, freeMb: null, usedPercent: null };
  }
}

/**
 * "Disk" and "CPU" here are genuinely real, system-wide measurements
 * (not this app's own footprint) — `path.parse().root` targets whichever
 * drive currently hosts the open project (falling back to whatever
 * `forPath` resolves to), since that's the disk that actually matters
 * for a build/test run. "Network" from Sprint 13's spec is deliberately
 * NOT included here: Node has no built-in cross-platform bandwidth API,
 * and fabricating a number would violate this project's own established
 * practice of never inventing metrics — see docs/ARCHITECTURE.md's
 * Sprint 13 section for the honest substitute (connectivity, not
 * throughput).
 */
export async function getSystemMetrics(forPath: string): Promise<SystemMetrics> {
  const [usedPercent, disk] = await Promise.all([getCpuUsagePercent(), getDiskUsage(forPath)]);

  const totalMb = os.totalmem() / (1024 * 1024);
  const freeMb = os.freemem() / (1024 * 1024);

  const appMetrics = app.getAppMetrics();
  const electronMemoryMb =
    appMetrics.reduce((sum, entry) => sum + entry.memory.workingSetSize, 0) / 1024;

  return {
    cpu: { usedPercent, cores: os.cpus().length },
    memory: { totalMb, freeMb, usedPercent: ((totalMb - freeMb) / totalMb) * 100 },
    disk,
    electronMemoryMb,
  };
}
