import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';

// A deliberately small, dependency-free renderer for the subset of
// Markdown AI responses actually use in practice: fenced code blocks,
// inline code, bold/italic, and lists. Not full CommonMark/GFM — that's a
// reasonable future enhancement, not something worth a new dependency
// chain (react-markdown + remark/rehype) just to render chat bubbles.

interface CodeBlock {
  type: 'code';
  language: string;
  code: string;
}

interface TextBlock {
  type: 'text';
  content: string;
}

type Block = CodeBlock | TextBlock;

function splitCodeBlocks(source: string): Block[] {
  const blocks: Block[] = [];
  const fenceRegex = /```(\w*)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = fenceRegex.exec(source)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: source.slice(lastIndex, match.index) });
    }
    blocks.push({
      type: 'code',
      language: match[1] || 'plaintext',
      code: match[2].replace(/\n$/, ''),
    });
    lastIndex = fenceRegex.lastIndex;
  }
  if (lastIndex < source.length) {
    blocks.push({ type: 'text', content: source.slice(lastIndex) });
  }
  return blocks;
}

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const inlineRegex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = inlineRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    const key = `${keyPrefix}-${index++}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="rounded bg-surface-sunken px-1 py-0.5 text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    lastIndex = inlineRegex.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function CodeBlockView({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="my-1.5 overflow-hidden rounded-md border border-border bg-surface-sunken">
      <div className="flex items-center justify-between border-b border-border px-2 py-1 text-[10px] uppercase tracking-wide text-fg-muted">
        <span>{language}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
          }}
          className="flex items-center gap-1 rounded px-1 py-0.5 hover:bg-surface hover:text-fg"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto px-2 py-1.5 text-xs">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function TextBlockView({ content }: { content: string }) {
  const paragraphs = content.split(/\n{2,}/).filter((p) => p.trim().length > 0);
  return (
    <>
      {paragraphs.map((paragraph, pIndex) => {
        const lines = paragraph.split('\n');
        const isList = lines.every(
          (line) => /^\s*([-*]|\d+\.)\s+/.test(line) || line.trim() === '',
        );
        if (isList) {
          return (
            <ul key={pIndex} className="my-1 list-disc space-y-0.5 pl-4">
              {lines
                .filter((line) => line.trim() !== '')
                .map((line, lIndex) => (
                  <li key={lIndex}>
                    {renderInline(line.replace(/^\s*([-*]|\d+\.)\s+/, ''), `${pIndex}-${lIndex}`)}
                  </li>
                ))}
            </ul>
          );
        }
        return (
          <p key={pIndex} className="my-1 whitespace-pre-wrap">
            {lines.flatMap((line, lIndex) => [
              ...(lIndex > 0 ? [<br key={`br-${lIndex}`} />] : []),
              ...renderInline(line, `${pIndex}-${lIndex}`),
            ])}
          </p>
        );
      })}
    </>
  );
}

export function MarkdownLite({ content }: { content: string }) {
  const blocks = splitCodeBlocks(content);
  return (
    <div className="text-sm leading-snug text-fg">
      {blocks.map((block, index) =>
        block.type === 'code' ? (
          <CodeBlockView key={index} language={block.language} code={block.code} />
        ) : (
          <TextBlockView key={index} content={block.content} />
        ),
      )}
    </div>
  );
}
