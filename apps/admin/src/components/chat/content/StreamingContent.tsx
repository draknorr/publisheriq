'use client';

import { useMemo, memo, type ComponentPropsWithoutRef } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { EntityLinkRenderer } from './EntityLinkRenderer';
import { MermaidBlock } from './MermaidBlock';
import { CopyButton } from './CopyButton';
import { detectSql } from './parsers';

interface StreamingContentProps {
  content: string;
  isStreaming?: boolean;
}

// Memoized code block with syntax highlighting
const CodeBlockRenderer = memo(function CodeBlockRenderer({
  children,
  className,
}: ComponentPropsWithoutRef<'code'>) {
  const match = /language-(\w+)/.exec(className || '');
  const language = match?.[1] || '';
  const code = String(children).replace(/\n$/, '');

  // Check if this is a mermaid diagram
  if (language === 'mermaid') {
    return <MermaidBlock chart={code} />;
  }

  // For inline code, render simple styled span
  if (!className && !code.includes('\n')) {
    return (
      <code className="px-1.5 py-0.5 rounded bg-surface-overlay text-accent-cyan font-mono text-[0.9em]">
        {children}
      </code>
    );
  }

  // Auto-detect SQL if no language
  const displayLanguage = language || (detectSql(code) ? 'sql' : 'text');

  return (
    <div className="my-3 rounded-lg border border-border-subtle overflow-hidden bg-[#0d1117]">
      <div className="flex items-center justify-between px-3 py-2 bg-surface-overlay/30 border-b border-border-subtle/50">
        <span className="text-caption font-mono text-text-tertiary uppercase tracking-wider">
          {displayLanguage}
        </span>
        <CopyButton text={code} size="sm" />
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <pre className="p-4 font-mono text-body-sm text-text-primary !bg-transparent !m-0">
          <code>{code}</code>
        </pre>
      </div>
    </div>
  );
});

// Custom components for react-markdown with proper typing
const components: Components = {
  // Links with entity detection
  a: EntityLinkRenderer as Components['a'],

  // Code blocks and inline code
  code: CodeBlockRenderer as Components['code'],

  // Tables
  table: ({ children }) => (
    <div className="my-3 overflow-hidden rounded-lg border border-border-subtle">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-body-sm">{children}</table>
      </div>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-surface-overlay/50">{children}</thead>,
  tr: ({ children }) => (
    <tr className="hover:bg-surface-overlay/30 transition-colors border-b border-border-subtle/50 last:border-0">
      {children}
    </tr>
  ),
  th: ({ children }) => (
    <th className="px-4 py-2.5 font-medium text-text-secondary border-b border-border-subtle text-left">
      {children}
    </th>
  ),
  td: ({ children }) => <td className="px-4 py-2.5 text-text-primary">{children}</td>,

  // Headers
  h1: ({ children }) => (
    <h1 className="text-heading font-semibold text-text-primary mt-4 mb-2 first:mt-0">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-subheading font-semibold text-text-primary mt-4 mb-2 first:mt-0">
      {children}
    </h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-body font-semibold text-text-primary mt-3 mb-1.5 first:mt-0">
      {children}
    </h3>
  ),
  h4: ({ children }) => (
    <h4 className="text-body font-medium text-text-primary mt-2 mb-1 first:mt-0">
      {children}
    </h4>
  ),

  // Paragraphs
  p: ({ children }) => (
    <p className="text-body text-text-primary leading-relaxed mb-3 last:mb-0">{children}</p>
  ),

  // Lists
  ul: ({ children }) => (
    <ul className="my-2 ml-4 space-y-1 list-disc list-outside text-text-primary">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-2 ml-4 space-y-1 list-decimal list-outside text-text-primary">{children}</ol>
  ),
  li: ({ children }) => <li className="text-body text-text-primary pl-1">{children}</li>,

  // Blockquotes
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent-blue pl-4 my-3 text-text-secondary italic">
      {children}
    </blockquote>
  ),

  // Horizontal rule
  hr: () => <hr className="my-4 border-border-muted" />,

  // Strong/Bold
  strong: ({ children }) => (
    <strong className="font-semibold text-text-primary">{children}</strong>
  ),

  // Emphasis/Italic
  em: ({ children }) => <em className="italic">{children}</em>,

  // Images
  img: ({ src, alt }) => (
    <img
      src={src}
      alt={alt || ''}
      className="rounded-lg my-3 max-w-full h-auto"
      loading="lazy"
    />
  ),
};

export function StreamingContent({ content, isStreaming = false }: StreamingContentProps) {
  // Memoize the markdown parsing
  const memoizedContent = useMemo(() => content, [content]);

  return (
    <div className="prose-chat">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {memoizedContent}
      </ReactMarkdown>
      {isStreaming && <StreamingCursor />}
    </div>
  );
}

function StreamingCursor() {
  return (
    <span
      className="inline-block w-0.5 h-4 bg-accent-blue ml-0.5 align-middle animate-pulse"
      aria-label="Streaming..."
    />
  );
}
