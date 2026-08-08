import { useState } from 'react';
import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react';
import { useAi } from '../../ai/useAi';

interface ConversationHistoryListProps {
  onClose: () => void;
}

export function ConversationHistoryList({ onClose }: ConversationHistoryListProps) {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    renameConversation,
    deleteConversation,
  } = useAi();
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  if (conversations.length === 0) {
    return (
      <div className="border-b border-border px-3 py-3 text-xs text-fg-muted">
        No conversations yet in this project.
      </div>
    );
  }

  return (
    <div className="max-h-56 overflow-y-auto border-b border-border">
      {conversations.map((conversation) => (
        <div
          key={conversation.id}
          className={`group flex items-center gap-1.5 px-2 py-1.5 text-xs ${
            conversation.id === activeConversationId ? 'bg-accent/10' : 'hover:bg-surface'
          }`}
        >
          <MessageSquare size={12} className="shrink-0 text-fg-muted" />
          {renamingId === conversation.id ? (
            <>
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void renameConversation(conversation.id, renameValue).then(() =>
                      setRenamingId(null),
                    );
                  } else if (event.key === 'Escape') {
                    setRenamingId(null);
                  }
                }}
                className="min-w-0 flex-1 rounded border border-accent bg-surface px-1 py-0.5 text-xs outline-none"
              />
              <button
                type="button"
                onClick={() =>
                  void renameConversation(conversation.id, renameValue).then(() =>
                    setRenamingId(null),
                  )
                }
                className="text-fg-muted hover:text-fg"
              >
                <Check size={12} />
              </button>
              <button
                type="button"
                onClick={() => setRenamingId(null)}
                className="text-fg-muted hover:text-fg"
              >
                <X size={12} />
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  selectConversation(conversation.id);
                  onClose();
                }}
                className="min-w-0 flex-1 truncate text-left text-fg"
                title={conversation.title}
              >
                {conversation.title}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRenamingId(conversation.id);
                  setRenameValue(conversation.title);
                }}
                className="shrink-0 text-fg-muted opacity-0 hover:text-fg group-hover:opacity-100"
                aria-label="Rename conversation"
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                onClick={() => void deleteConversation(conversation.id)}
                className="shrink-0 text-fg-muted opacity-0 hover:text-danger group-hover:opacity-100"
                aria-label="Delete conversation"
              >
                <Trash2 size={11} />
              </button>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
