import { useState } from 'react';
import { AlertTriangle, History, Maximize2, Minimize2, Plus } from 'lucide-react';
import { useAi } from '../../ai/useAi';
import { ProviderSelector } from './ProviderSelector';
import { TokenUsageIndicator } from './TokenUsageIndicator';
import { ConversationHistoryList } from './ConversationHistoryList';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';

interface ChatPanelProps {
  /** Full Page Chat mode: fills the whole central workspace instead of the
   * narrow right sidebar. Header/input behave identically either way. */
  fullPage?: boolean;
  onToggleFullPage?: () => void;
}

export function ChatPanel({ fullPage = false, onToggleFullPage }: ChatPanelProps) {
  const { newConversation, lastError } = useAi();
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <aside
      className={
        fullPage
          ? 'flex min-w-0 flex-1 flex-col bg-surface-elevated'
          : 'flex w-96 shrink-0 flex-col border-l border-border bg-surface-elevated'
      }
    >
      <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
        <span className="text-xs font-semibold uppercase tracking-wider text-fg-muted">
          AI Chat
        </span>
        <div className="flex items-center gap-1">
          <TokenUsageIndicator />
          <button
            type="button"
            onClick={() => setHistoryOpen((v) => !v)}
            title="Conversation history"
            className={`rounded p-1 text-fg-muted hover:bg-surface hover:text-fg ${historyOpen ? 'bg-surface text-fg' : ''}`}
          >
            <History size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              newConversation();
              setHistoryOpen(false);
            }}
            title="New conversation"
            className="rounded p-1 text-fg-muted hover:bg-surface hover:text-fg"
          >
            <Plus size={14} />
          </button>
          {onToggleFullPage && (
            <button
              type="button"
              onClick={onToggleFullPage}
              title={fullPage ? 'Exit Full Page' : 'Full Page'}
              className="rounded p-1 text-fg-muted hover:bg-surface hover:text-fg"
            >
              {fullPage ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          )}
        </div>
      </div>

      {historyOpen && <ConversationHistoryList onClose={() => setHistoryOpen(false)} />}

      <ProviderSelector />

      {lastError && (
        <div className="mx-2 mb-1 flex items-start gap-1.5 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          <span>{lastError}</span>
        </div>
      )}

      <MessageList />
      <ChatInput />
    </aside>
  );
}
