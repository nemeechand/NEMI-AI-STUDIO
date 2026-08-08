import { useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { useAi } from '../../ai/useAi';
import { MessageBubble } from './MessageBubble';
import { MarkdownLite } from './MarkdownLite';

export function MessageList() {
  const { activeMessages, isStreaming, streamingText } = useAi();
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeMessages.length, streamingText]);

  if (activeMessages.length === 0 && !isStreaming) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 text-center text-xs text-fg-muted">
        Ask about the active file, a selection, or anything about this project.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {activeMessages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {isStreaming && (
        <div className="flex flex-col items-start gap-1 px-3 py-2">
          <div className="max-w-[92%] rounded-lg bg-surface-elevated px-2.5 py-1.5 text-fg">
            {streamingText ? (
              <MarkdownLite content={streamingText} />
            ) : (
              <Loader2 size={14} className="animate-spin text-fg-muted" />
            )}
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
