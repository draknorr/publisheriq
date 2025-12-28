'use client';

import { useMemo } from 'react';
import Link from 'next/link';
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
 * Format inline text elements (bold, inline code, game links, etc.)
 */
function formatTextContent(text: string): React.ReactNode {
  // Combined pattern for: game links [Name](game:ID), bold **text**, inline code `code`
  type Segment =
    | { type: 'text'; content: string }
    | { type: 'bold'; content: string }
    | { type: 'code'; content: string }
    | { type: 'gameLink'; name: string; appId: string };

  const segments: Segment[] = [];
  let lastIndex = 0;

  // Pattern matches: [Game Name](game:12345) OR **bold** OR `code`
  const combinedPattern = /(\[([^\]]+)\]\(game:(\d+)\)|\*\*(.+?)\*\*|`([^`]+)`)/g;
  let match;

  while ((match = combinedPattern.exec(text)) !== null) {
    // Add text before match
    if (match.index > lastIndex) {
      segments.push({ type: 'text', content: text.slice(lastIndex, match.index) });
    }

    // Determine match type
    if (match[0].startsWith('[') && match[0].includes('](game:')) {
      // Game link: [Name](game:ID)
      segments.push({ type: 'gameLink', name: match[2], appId: match[3] });
    } else if (match[0].startsWith('**')) {
      // Bold text
      segments.push({ type: 'bold', content: match[4] });
    } else if (match[0].startsWith('`')) {
      // Inline code
      segments.push({ type: 'code', content: match[5] });
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
      case 'gameLink':
        return (
          <Link
            key={idx}
            href={`/apps/${segment.appId}`}
            className="text-accent-blue hover:text-accent-blue/80 hover:underline transition-colors"
          >
            {segment.name}
          </Link>
        );
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

/**
 * Export formatTextContent for use in other components (like MarkdownTable)
 */
export { formatTextContent };
