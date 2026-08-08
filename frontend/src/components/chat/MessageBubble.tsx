import { AlertTriangle, FileCode2 } from 'lucide-react';
import { basename } from '../../project/pathUtils';
import { MarkdownLite } from './MarkdownLite';

interface MessageBubbleProps {
  message: AiMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex flex-col gap-1 px-3 py-2 ${isUser ? 'items-end' : 'items-start'}`}>
      {message.context_refs && message.context_refs.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {message.context_refs.map((ref, index) => (
            <span
              key={index}
              className="flex items-center gap-1 rounded border border-border bg-surface-sunken px-1.5 py-0.5 text-[10px] text-fg-muted"
              title={ref.path}
            >
              <FileCode2 size={10} />
              {basename(ref.path)}
              {ref.start_line !== null && ref.end_line !== null && (
                <span>
                  :{ref.start_line}-{ref.end_line}
                </span>
              )}
            </span>
          ))}
        </div>
      )}
      <div
        className={`max-w-[92%] rounded-lg px-2.5 py-1.5 ${
          isUser ? 'bg-accent/15 text-fg' : 'bg-surface-elevated text-fg'
        }`}
      >
        <MarkdownLite content={message.content} />
        {message.status === 'error' && (
          <div className="mt-1 flex items-start gap-1.5 rounded border border-danger/30 bg-danger/10 px-2 py-1 text-xs text-danger">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <span>{message.error_message ?? 'The AI request failed.'}</span>
          </div>
        )}
        {message.status === 'cancelled' && (
          <p className="mt-1 text-[11px] italic text-fg-muted">Cancelled</p>
        )}
      </div>
      {!isUser && (message.prompt_tokens !== null || message.completion_tokens !== null) && (
        <span className="px-0.5 text-[10px] text-fg-muted">
          {message.model} · {(message.prompt_tokens ?? 0) + (message.completion_tokens ?? 0)} tokens
        </span>
      )}
    </div>
  );
}
