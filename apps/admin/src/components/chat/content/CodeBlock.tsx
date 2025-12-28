'use client';

import { useState, useEffect, useMemo } from 'react';
import { CopyButton } from './CopyButton';
import { detectSql } from './parsers';

interface CodeBlockProps {
  code: string;
  language?: string;
}

// Lazy-loaded highlighter promise (singleton)
let highlighterPromise: Promise<{
  codeToHtml: (code: string, options: { lang: string; theme: string }) => string;
}> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then(({ createHighlighter }) =>
      createHighlighter({
        themes: ['github-dark'],
        langs: ['sql', 'javascript', 'typescript', 'json', 'bash', 'python', 'text'],
      })
    );
  }
  return highlighterPromise;
}

export function CodeBlock({ code, language: providedLanguage }: CodeBlockProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Auto-detect SQL if no language provided
  const language = useMemo(() => {
    if (providedLanguage && providedLanguage !== 'text') {
      return providedLanguage;
    }
    return detectSql(code) ? 'sql' : providedLanguage || 'text';
  }, [providedLanguage, code]);

  // Map common language aliases
  const normalizedLang = useMemo(() => {
    const langMap: Record<string, string> = {
      js: 'javascript',
      ts: 'typescript',
      py: 'python',
      sh: 'bash',
      shell: 'bash',
    };
    return langMap[language.toLowerCase()] || language.toLowerCase();
  }, [language]);

  useEffect(() => {
    let mounted = true;

    getHighlighter()
      .then((highlighter) => {
        if (!mounted) return;

        try {
          // Check if language is supported
          const supportedLangs = ['sql', 'javascript', 'typescript', 'json', 'bash', 'python', 'text'];
          const lang = supportedLangs.includes(normalizedLang) ? normalizedLang : 'text';

          const html = highlighter.codeToHtml(code, {
            lang,
            theme: 'github-dark',
          });
          setHighlightedHtml(html);
        } catch {
          // Fallback to plain text
          setHighlightedHtml(null);
        }
      })
      .catch(() => {
        if (mounted) setHighlightedHtml(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [code, normalizedLang]);

  const displayLanguage = language.toUpperCase();

  return (
    <div className="my-3 rounded-lg border border-border-subtle overflow-hidden bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-surface-overlay/30 border-b border-border-subtle/50">
        <span className="text-caption font-mono text-text-tertiary uppercase tracking-wider">
          {displayLanguage}
        </span>
        <CopyButton text={code} size="sm" />
      </div>

      {/* Code content */}
      <div className="overflow-x-auto scrollbar-thin">
        {isLoading ? (
          <pre className="p-4 font-mono text-body-sm text-text-secondary">
            <code>{code}</code>
          </pre>
        ) : highlightedHtml ? (
          <div
            className="shiki-wrapper p-4 font-mono text-body-sm [&>pre]:!bg-transparent [&>pre]:!p-0 [&>pre]:!m-0"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <pre className="p-4 font-mono text-body-sm text-text-primary">
            <code>{code}</code>
          </pre>
        )}
      </div>
    </div>
  );
}
