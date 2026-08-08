import { useEffect, useRef, useState } from 'react';
import { FileCode2, Paperclip, Send, Square, X } from 'lucide-react';
import { useAi } from '../../ai/useAi';
import { useProject } from '../../project/useProject';
import { fuzzyFilter } from '../../commands/fuzzyMatch';
import { basename } from '../../project/pathUtils';

const MAX_FILE_PICKER_RESULTS = 8;

export function ChatInput() {
  const {
    draftContent,
    setDraftContent,
    pendingAttachments,
    addAttachment,
    removeAttachment,
    sendMessage,
    cancelActiveMessage,
    isStreaming,
  } = useAi();
  const { projectPath } = useProject();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [allFiles, setAllFiles] = useState<string[]>([]);
  const [filePickerQuery, setFilePickerQuery] = useState<string | null>(null);

  useEffect(() => {
    if (!projectPath) return;
    void window.nemi.fs.listAllFiles(projectPath).then(setAllFiles);
  }, [projectPath]);

  function handleChange(value: string) {
    setDraftContent(value);
    const atIndex = value.lastIndexOf('@');
    if (atIndex === -1) {
      setFilePickerQuery(null);
      return;
    }
    const afterAt = value.slice(atIndex + 1);
    if (/\s/.test(afterAt)) {
      setFilePickerQuery(null);
    } else {
      setFilePickerQuery(afterAt);
    }
  }

  async function attachFile(path: string) {
    const atIndex = draftContent.lastIndexOf('@');
    const withoutTrigger = atIndex === -1 ? draftContent : draftContent.slice(0, atIndex);
    setDraftContent(withoutTrigger);
    setFilePickerQuery(null);
    try {
      const content = await window.nemi.fs.readFile(path);
      addAttachment({ path, content });
    } catch (error) {
      console.error('[ai] Failed to read file for @-reference', error);
    }
    textareaRef.current?.focus();
  }

  function handleSend() {
    if (!draftContent.trim() || isStreaming) return;
    void sendMessage(draftContent);
  }

  const filePickerResults =
    filePickerQuery !== null
      ? fuzzyFilter(allFiles, filePickerQuery, (path) => path).slice(0, MAX_FILE_PICKER_RESULTS)
      : [];

  return (
    <div className="border-t border-border bg-surface-elevated p-2">
      {pendingAttachments.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {pendingAttachments.map((attachment, index) => (
            <span
              key={`${attachment.path}-${index}`}
              className="flex items-center gap-1 rounded border border-border bg-surface px-1.5 py-0.5 text-[10px] text-fg-muted"
              title={attachment.path}
            >
              <FileCode2 size={10} />
              {basename(attachment.path)}
              <button
                type="button"
                onClick={() => removeAttachment(index)}
                className="ml-0.5 rounded hover:text-fg"
                aria-label={`Remove ${basename(attachment.path)}`}
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}

      {filePickerQuery !== null && filePickerResults.length > 0 && (
        <div className="mb-1.5 max-h-40 overflow-y-auto rounded-md border border-border bg-surface">
          {filePickerResults.map((path) => (
            <button
              key={path}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                void attachFile(path);
              }}
              className="flex w-full flex-col items-start px-2 py-1 text-left text-xs hover:bg-surface-elevated"
            >
              <span className="text-fg">{basename(path)}</span>
              <span className="truncate text-[10px] text-fg-muted">{path}</span>
            </button>
          ))}
        </div>
      )}

      <div className="flex items-end gap-1.5">
        <textarea
          ref={textareaRef}
          value={draftContent}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            } else if (event.key === 'Escape') {
              setFilePickerQuery(null);
            }
          }}
          placeholder="Ask about this project… (@ to reference a file)"
          rows={2}
          className="max-h-40 min-h-[2.5rem] flex-1 resize-none rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-fg outline-none placeholder:text-fg-muted focus:border-accent"
        />
        {isStreaming ? (
          <button
            type="button"
            onClick={cancelActiveMessage}
            title="Stop generating"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-fg-muted hover:border-danger hover:text-danger"
          >
            <Square size={14} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSend}
            disabled={!draftContent.trim()}
            title="Send (Enter)"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent text-accent-fg disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={14} />
          </button>
        )}
      </div>
      <p className="mt-1 flex items-center gap-1 text-[10px] text-fg-muted">
        <Paperclip size={10} /> Type @ to attach a file · Shift+Enter for a new line
      </p>
    </div>
  );
}
