import { useEffect, useState } from 'react';
import { useProject } from '../../project/useProject';
import { useWorkflows } from '../../workflows/useWorkflows';

const POLL_INTERVAL_MS = 4000;

/**
 * Picks the workflow the Live Sprint Center / Workflow View should
 * follow: whichever non-terminal workflow was updated most recently
 * (there's normally at most a handful active at once for a single
 * user), falling back to the most recently updated workflow overall so
 * the dashboard still shows something meaningful right after the last
 * sprint finished. Polls that one workflow's full detail independently
 * of WorkflowsProvider's own `selectedWorkflow` (which the Agents
 * Dashboard sidebar drives via user clicks) so the two selections never
 * fight each other.
 */
export function useActiveWorkflow(): WorkflowDetail | null {
  const { projectId } = useProject();
  const { workflows } = useWorkflows();
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);

  const active = [...workflows].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  const candidate =
    active.find((w) => !['completed', 'failed', 'cancelled'].includes(w.status)) ??
    active[0] ??
    null;
  const candidateId = candidate?.id ?? null;

  useEffect(() => {
    if (!candidateId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    async function poll() {
      const result = await window.nemi.workflows.get(candidateId as string).catch(() => null);
      if (!cancelled && result) setDetail(result);
    }
    void poll();
    const interval = setInterval(() => void poll(), POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [candidateId, projectId]);

  return detail;
}
