import { Coins } from 'lucide-react';
import { useAi } from '../../ai/useAi';

export function TokenUsageIndicator() {
  const { conversationTokenTotals, activeConversationId } = useAi();

  if (!activeConversationId) return null;
  const total = conversationTokenTotals.promptTokens + conversationTokenTotals.completionTokens;
  if (total === 0) return null;

  return (
    <span
      className="flex items-center gap-1 text-[10px] text-fg-muted"
      title={`Prompt: ${conversationTokenTotals.promptTokens} · Completion: ${conversationTokenTotals.completionTokens}`}
    >
      <Coins size={10} />
      {total.toLocaleString()} tokens
    </span>
  );
}
