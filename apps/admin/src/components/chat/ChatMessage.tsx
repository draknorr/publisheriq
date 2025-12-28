'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/Card';
import { ChevronDown, ChevronRight, Database, User, Bot } from 'lucide-react';
import type { ChatToolCall } from '@/lib/llm/types';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ChatToolCall[];
  timestamp: Date;
}

interface ChatMessageProps {
  message: DisplayMessage;
}

export function ChatMessage({ message }: ChatMessageProps) {
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
      <div className={`flex-1 max-w-[80%] ${isUser ? 'flex flex-col items-end' : ''}`}>
        <Card
          variant={isUser ? 'default' : 'elevated'}
          padding="md"
          className={isUser ? 'bg-accent-blue/10 border-accent-blue/20' : ''}
        >
          {/* Message text */}
          <div className="text-body text-text-primary whitespace-pre-wrap">{message.content}</div>

          {/* Query details (for assistant messages with tool calls) */}
          {!isUser && message.toolCalls && message.toolCalls.length > 0 && (
            <div className="mt-3 pt-3 border-t border-border-subtle">
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
                  {message.toolCalls.length} database{' '}
                  {message.toolCalls.length === 1 ? 'query' : 'queries'}
                </span>
              </button>

              {showQueries && (
                <div className="mt-2 space-y-3">
                  {message.toolCalls.map((tc, idx) => {
                    const args = tc.arguments as { reasoning?: string; sql?: string };
                    return (
                      <div key={idx} className="p-3 bg-surface-overlay rounded-md">
                        <p className="text-caption text-text-muted mb-2">{args.reasoning}</p>
                        <pre className="text-caption text-text-tertiary font-mono overflow-x-auto whitespace-pre-wrap">
                          {args.sql}
                        </pre>
                        {tc.result.success ? (
                          <p className="text-caption text-accent-green mt-2">
                            {tc.result.rowCount} rows returned
                            {tc.result.truncated && ' (truncated)'}
                          </p>
                        ) : (
                          <p className="text-caption text-accent-red mt-2">
                            Error: {tc.result.error}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Timestamp */}
        <p className={`text-caption text-text-muted mt-1 px-1 ${isUser ? 'text-right' : ''}`}>
          {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

export type { DisplayMessage };
