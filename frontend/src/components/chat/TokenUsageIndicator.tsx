import { Clock, Coins } from 'lucide-react';
import { useAi } from '../../ai/useAi';

function formatCost(cost: number | null): string {
  if (cost === null) return 'unknown';
  if (cost === 0) return 'free';
  return `$${cost < 0.01 ? cost.toFixed(4) : cost.toFixed(2)}`;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return '';
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

export function TokenUsageIndicator() {
  const {
    conversationTokenTotals,
    conversationEstimatedCostUsd,
    lastResponseMs,
    activeConversationId,
  } = useAi();

  if (!activeConversationId) return null;
  const total = conversationTokenTotals.promptTokens + conversationTokenTotals.completionTokens;
  if (total === 0) return null;

  return (
    <span className="flex items-center gap-2 text-[10px] text-fg-muted">
      <span
        className="flex items-center gap-1"
        title={`Prompt: ${conversationTokenTotals.promptTokens} · Completion: ${conversationTokenTotals.completionTokens}`}
      >
        <Coins size={10} />
        {total.toLocaleString()} tokens · {formatCost(conversationEstimatedCostUsd)}
      </span>
      {lastResponseMs !== null && (
        <span className="flex items-center gap-1" title="Last response time">
          <Clock size={10} />
          {formatLatency(lastResponseMs)}
        </span>
      )}
    </span>
  );
}
