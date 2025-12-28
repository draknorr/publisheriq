'use client';

import { useMemo } from 'react';
import { parseMessageContent, type ContentBlock } from './parsers';
import { MarkdownTable } from './MarkdownTable';
import { CodeBlock } from './CodeBlock';
import { CollapsibleSection } from './CollapsibleSection';

interface MessageContentProps {
  content: string;
  enableCollapse?: boolean;
}

export function MessageContent({ content, enableCollapse = true }: MessageContentProps) {
  const blocks = useMemo(() => parseMessageContent(content), [content]);

  const renderedBlocks = (
    <div className="space-y-2">
      {blocks.map((block, idx) => (
        <ContentBlockRenderer key={idx} block={block} />
      ))}
    </div>
  );

  if (enableCollapse) {
    return (
      <CollapsibleSection content={content}>
        {renderedBlocks}
      </CollapsibleSection>
    );
  }

  return renderedBlocks;
}

interface ContentBlockRendererProps {
  block: ContentBlock;
}

function ContentBlockRenderer({ block }: ContentBlockRendererProps) {
  switch (block.type) {
    case 'table':
      return (
        <MarkdownTable
          headers={block.headers}
          rows={block.rows}
          alignments={block.alignments}
        />
      );

    case 'code':
      return <CodeBlock code={block.content} language={block.language} />;

    case 'text':
      return <TextBlock content={block.content} />;

    default:
      return null;
  }
}

interface TextBlockProps {
  content: string;
}

function TextBlock({ content }: TextBlockProps) {
  // Split by double newlines for paragraphs
  const paragraphs = content.split(/\n\n+/);

  return (
    <div className="space-y-3">
      {paragraphs.map((paragraph, idx) => (
        <p key={idx} className="text-body text-text-primary whitespace-pre-wrap leading-relaxed">
          {formatTextContent(paragraph)}
        </p>
      ))}
    </div>
  );
}

/**
 * Format inline text elements (bold, inline code, etc.)
 */
function formatTextContent(text: string): React.ReactNode {
  // First pass: split by patterns and mark segments
  type Segment = { type: 'text' | 'bold' | 'code'; content: string };
  const segments: Segment[] = [];
  let lastIndex = 0;
  const combinedPattern = /(\*\*(.+?)\*\*|`([^`]+)`)/g;
  let match;

  while ((match = combinedPattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    // Determine match type
    if (match[0].startsWith('**')) {
      segments.push({ type: 'bold', content: match[2] });
    } else if (match[0].startsWith('`')) {
      segments.push({ type: 'code', content: match[3] });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', content: text.slice(lastIndex) });
  }

  // If no special formatting found, return plain text
  if (segments.length === 0) {
    return text;
  }

  return segments.map((segment, idx) => {
    switch (segment.type) {
      case 'bold':
        return (
          <strong key={idx} className="font-semibold text-text-primary">
            {segment.content}
          </strong>
        );
      case 'code':
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-surface-overlay text-accent-cyan font-mono text-[0.9em]"
          >
            {segment.content}
          </code>
        );
      default:
        return <span key={idx}>{segment.content}</span>;
    }
  });
}
