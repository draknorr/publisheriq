'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ChevronDown, ChevronRight, Database, User, Bot } from 'lucide-react';
import type { ChatToolCall, ChatTiming } from '@/lib/llm/types';
import type { StreamDebugInfo } from '@/lib/llm/streaming-types';
import { Clock } from 'lucide-react';
import { StreamingContent, CopyButton, CodeBlock } from './content';
import { EntityLinkProvider } from './content/EntityLinkContext';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ChatToolCall[];
  timing?: ChatTiming;
  debug?: StreamDebugInfo;
  timestamp: Date;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface ChatMessageProps {
  message: DisplayMessage;
  isStreaming?: boolean;
}

export function ChatMessage({ message, isStreaming = false }: ChatMessageProps) {
  const [showQueries, setShowQueries] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`
        flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center
        ${isUser ? 'bg-accent-blue' : 'bg-surface-elevated border border-border-muted'}
      `}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white" />
        ) : (
          <Bot className="w-4 h-4 text-accent-blue" />
        )}
      </div>

      {/* Message content */}
      <div className={`flex-1 max-w-[85%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        <Card
          variant={isUser ? 'default' : 'elevated'}
          padding="md"
          className={`relative group ${isUser ? 'bg-accent-blue/10 border-accent-blue/20' : ''}`}
        >
          {/* Copy button for assistant messages */}
          {!isUser && (
            <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <CopyButton text={message.content} size="sm" />
            </div>
          )}

          {/* Message text */}
          {isUser ? (
            <div className="text-body text-text-primary whitespace-pre-wrap">
              {message.content}
            </div>
          ) : (
            <div className="pr-8">
              <EntityLinkProvider toolCalls={message.toolCalls}>
                <StreamingContent content={message.content} isStreaming={isStreaming} />
              </EntityLinkProvider>
            </div>
          )}

          {/* Query details (for assistant messages with tool calls) */}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border-subtle">
              <button
                onClick={() => setShowQueries(!showQueries)}
                className="flex items-center gap-2 text-body-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                {showQueries ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
                <Database className="w-4 h-4" />
                <span>
                  {message.toolCalls.length} tool{' '}
                  {message.toolCalls.length === 1 ? 'call' : 'calls'}
                </span>
                {message.timing && (
                  <span className="flex items-center gap-1 text-text-muted">
                    <Clock className="w-3 h-3" />
                    {formatMs(message.timing.totalMs)}
                    <span className="text-caption">
                      (LLM: {formatMs(message.timing.llmMs)} | Tools: {formatMs(message.timing.toolsMs)})
                    </span>
                  </span>
                )}
              </button>

              {showQueries && (
                <div className="mt-3 space-y-4">
                  {message.toolCalls.map((tc, idx) => {
                    // Handle database query results
                    if (tc.name === 'query_database') {
                      const args = tc.arguments as { reasoning?: string; sql?: string };
                      const result = tc.result as { success: boolean; rowCount?: number; truncated?: boolean; error?: string; debug?: Record<string, unknown> };
                      return (
                        <div key={idx} className="space-y-2">
                          {args.reasoning && (
                            <p className="text-body-sm text-text-secondary italic">
                              {args.reasoning}
                            </p>
                          )}
                          {args.sql && <CodeBlock code={args.sql} language="sql" />}
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-green/10 text-accent-green">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                                {result.rowCount} rows returned
                                {result.truncated && ' (truncated)'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-red/10 text-accent-red">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                                Error: {result.error}
                              </span>
                            )}
                          </div>
                          {result.debug && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-caption text-text-muted hover:text-text-secondary">
                                Debug Info
                              </summary>
                              <pre className="mt-1 p-2 bg-surface-base rounded text-xs overflow-x-auto max-h-48">
                                {JSON.stringify(result.debug, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    }

                    // Handle similarity search results
                    if (tc.name === 'find_similar') {
                      const args = tc.arguments as { reference_name?: string; entity_type?: string };
                      const result = tc.result as { success: boolean; total_found?: number; error?: string; debug?: Record<string, unknown> };
                      return (
                        <div key={idx} className="space-y-2">
                          <p className="text-body-sm text-text-secondary italic">
                            Finding {args.entity_type}s similar to &quot;{args.reference_name}&quot;
                          </p>
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-green/10 text-accent-green">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                                {result.total_found} similar results found
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-red/10 text-accent-red">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                                Error: {result.error}
                              </span>
                            )}
                          </div>
                          {result.debug && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-caption text-text-muted hover:text-text-secondary">
                                Debug Info
                              </summary>
                              <pre className="mt-1 p-2 bg-surface-base rounded text-xs overflow-x-auto max-h-48">
                                {JSON.stringify(result.debug, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    }

                    // Handle Cube.dev analytics queries
                    if (tc.name === 'query_analytics') {
                      const args = tc.arguments as { reasoning?: string; cube?: string };
                      const result = tc.result as { success: boolean; rowCount?: number; cached?: boolean; error?: string; debug?: Record<string, unknown> };
                      return (
                        <div key={idx} className="space-y-2">
                          {args.reasoning && (
                            <p className="text-body-sm text-text-secondary italic">
                              {args.reasoning}
                            </p>
                          )}
                          {args.cube && (
                            <p className="text-body-sm text-text-muted">
                              Querying: {args.cube}
                            </p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-green/10 text-accent-green">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                                {result.rowCount} rows returned
                                {result.cached && ' (cached)'}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-red/10 text-accent-red">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                                Error: {result.error}
                              </span>
                            )}
                            {tc.timing && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-caption bg-surface-elevated text-text-muted">
                                <Clock className="w-3 h-3" />
                                {formatMs(tc.timing.executionMs)}
                              </span>
                            )}
                          </div>
                          {result.debug && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-caption text-text-muted hover:text-text-secondary">
                                Debug Info
                              </summary>
                              <pre className="mt-1 p-2 bg-surface-base rounded text-xs overflow-x-auto max-h-48">
                                {JSON.stringify(result.debug, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    }

                    // Handle search_games results
                    if (tc.name === 'search_games') {
                      const args = tc.arguments as { query?: string };
                      const result = tc.result as { success: boolean; count?: number; error?: string; debug?: Record<string, unknown> };
                      return (
                        <div key={idx} className="space-y-2">
                          <p className="text-body-sm text-text-secondary italic">
                            Searching games for &quot;{args.query}&quot;
                          </p>
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-green/10 text-accent-green">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                                {result.count} games found
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-red/10 text-accent-red">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                                Error: {result.error}
                              </span>
                            )}
                          </div>
                          {result.debug && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-caption text-text-muted hover:text-text-secondary">
                                Debug Info
                              </summary>
                              <pre className="mt-1 p-2 bg-surface-base rounded text-xs overflow-x-auto max-h-48">
                                {JSON.stringify(result.debug, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    }

                    // Handle lookup_tags results
                    if (tc.name === 'lookup_tags') {
                      const args = tc.arguments as { tag_names?: string[] };
                      const result = tc.result as { success: boolean; found?: number; error?: string; debug?: Record<string, unknown> };
                      return (
                        <div key={idx} className="space-y-2">
                          <p className="text-body-sm text-text-secondary italic">
                            Looking up tags: {args.tag_names?.join(', ') || 'unknown'}
                          </p>
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-green/10 text-accent-green">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-green" />
                                {result.found} tags found
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-caption bg-accent-red/10 text-accent-red">
                                <span className="w-1.5 h-1.5 rounded-full bg-accent-red" />
                                Error: {result.error}
                              </span>
                            )}
                          </div>
                          {result.debug && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-caption text-text-muted hover:text-text-secondary">
                                Debug Info
                              </summary>
                              <pre className="mt-1 p-2 bg-surface-base rounded text-xs overflow-x-auto max-h-48">
                                {JSON.stringify(result.debug, null, 2)}
                              </pre>
                            </details>
                          )}
                        </div>
                      );
                    }

                    // Unknown tool
                    return (
                      <div key={idx} className="text-body-sm text-text-muted">
                        Unknown tool: {tc.name}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Stream debug info (collapsed by default) */}
          {!isUser && message.debug && (
            <details className="mt-3 pt-3 border-t border-border-subtle">
              <summary className="cursor-pointer text-caption text-text-muted hover:text-text-secondary">
                Stream Debug Info
              </summary>
              <pre className="mt-2 p-2 bg-surface-base rounded text-xs overflow-x-auto">
                {JSON.stringify(message.debug, null, 2)}
              </pre>
            </details>
          )}
        </Card>

        {/* Timestamp */}
        <p className={`text-caption text-text-muted mt-1.5 px-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export type { DisplayMessage };
