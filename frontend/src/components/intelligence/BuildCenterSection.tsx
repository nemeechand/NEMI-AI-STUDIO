import { Hammer, Square, TestTube2, ShieldCheck } from 'lucide-react';
import { useIntelligence } from '../../intelligence/useIntelligence';
import { useProject } from '../../project/useProject';

const RUNNER_LABEL: Record<RunnerId, string> = {
  build: 'Build',
  test: 'Test',
  verify: 'Verify',
};

export function BuildCenterSection() {
  const { projectPath } = useProject();
  const {
    gitStatus,
    availableRunners,
    runners,
    runBuild,
    runTests,
    runVerification,
    cancelRunner,
  } = useIntelligence();

  if (!projectPath) {
    return <p className="text-xs text-fg-muted">Open a project folder to use the Build Center.</p>;
  }

  return (
    <div className="max-w-2xl space-y-4">
      <div className="rounded border border-border p-3 text-xs">
        <p className="mb-1.5 font-medium text-fg">Git Status</p>
        {gitStatus?.isRepo ? (
          <div className="grid grid-cols-2 gap-2 text-fg-muted">
            <span>
              Branch: <span className="text-fg">{gitStatus.branch}</span>
            </span>
            <span>
              Working tree: <span className="text-fg">{gitStatus.isDirty ? 'dirty' : 'clean'}</span>
            </span>
            <span>
              Push status:{' '}
              <span className="text-fg">
                {gitStatus.ahead === null
                  ? 'no upstream configured'
                  : `${gitStatus.ahead} ahead, ${gitStatus.behind} behind`}
              </span>
            </span>
            <span>
              Last commit:{' '}
              <span className="text-fg">
                {gitStatus.lastCommit
                  ? `${gitStatus.lastCommit.hash} — ${gitStatus.lastCommit.message}`
                  : 'none yet'}
              </span>
            </span>
          </div>
        ) : (
          <p className="text-fg-muted">This project isn't a git repository.</p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <RunnerButton
          icon={Hammer}
          label="Run Build"
          disabled={!availableRunners.build}
          state={runners.build.state}
          onRun={() => void runBuild()}
          onCancel={() => void cancelRunner('build')}
        />
        <RunnerButton
          icon={TestTube2}
          label="Run Tests"
          disabled={!availableRunners.test}
          state={runners.test.state}
          onRun={() => void runTests()}
          onCancel={() => void cancelRunner('test')}
        />
        <RunnerButton
          icon={ShieldCheck}
          label="Run Verification"
          disabled={false}
          state={runners.verify.state}
          onRun={() => void runVerification()}
          onCancel={() => void cancelRunner('verify')}
        />
      </div>
      {!availableRunners.build && !availableRunners.test && (
        <p className="text-[11px] text-fg-muted">
          No `build`/`test` npm scripts (or Python project files) detected in this project — Run
          Build/Run Tests stay disabled rather than running a command that would just fail.
        </p>
      )}

      {(['build', 'test', 'verify'] as RunnerId[]).map((runnerId) =>
        runners[runnerId].output.length > 0 ? (
          <div key={runnerId}>
            <p className="mb-1 text-xs font-medium text-fg">{RUNNER_LABEL[runnerId]} output</p>
            <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded border border-border bg-surface-elevated p-2 font-mono text-[11px] text-fg-muted">
              {runners[runnerId].output.join('')}
            </div>
          </div>
        ) : null,
      )}
    </div>
  );
}

function RunnerButton({
  icon: Icon,
  label,
  disabled,
  state,
  onRun,
  onCancel,
}: {
  icon: typeof Hammer;
  label: string;
  disabled: boolean;
  state: RunnerState;
  onRun: () => void;
  onCancel: () => void;
}) {
  const isRunning = state === 'running';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={isRunning ? onCancel : onRun}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-fg hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
    >
      {isRunning ? <Square size={13} /> : <Icon size={13} />}
      {isRunning ? `Cancel ${label}` : label}
      {state !== 'idle' && !isRunning && (
        <span
          className={`ml-1 rounded px-1.5 py-0.5 text-[10px] ${
            state === 'success'
              ? 'bg-success/20 text-success'
              : state === 'failed'
                ? 'bg-danger/20 text-danger'
                : 'bg-surface-elevated text-fg-muted'
          }`}
        >
          {state}
        </span>
      )}
    </button>
  );
}
