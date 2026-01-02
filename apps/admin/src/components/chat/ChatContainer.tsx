'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { MessageSquare, StopCircle, Database } from 'lucide-react';
import { getRandomPrompts } from '@/lib/example-prompts';
import { useChatStream } from '@/hooks/useChatStream';

interface ChatContainerProps {
  initialQuery?: string;
}

export function ChatContainer({ initialQuery }: ChatContainerProps) {
  const [error, setError] = useState<string | null>(null);
  const [suggestions] = useState(() => getRandomPrompts(4));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const hasSubmittedInitialQuery = useRef(false);

  const {
    messages,
    isStreaming,
    pendingToolCalls,
    sendMessage,
    stopStreaming,
  } = useChatStream({
    onError: setError,
  });

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming, scrollToBottom]);

  // Auto-submit initial query from URL
  useEffect(() => {
    if (initialQuery && !hasSubmittedInitialQuery.current && !isStreaming) {
      hasSubmittedInitialQuery.current = true;
      sendMessage(initialQuery);
    }
  }, [initialQuery, isStreaming, sendMessage]);

  const handleSend = useCallback((content: string) => {
    setError(null);
    sendMessage(content);
  }, [sendMessage]);

  // Find the last assistant message to determine if it's streaming
  const lastMessage = messages[messages.length - 1];
  const isLastMessageStreaming = isStreaming && lastMessage?.role === 'assistant';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isStreaming && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-accent-blue/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-accent-blue" />
            </div>
            <h3 className="text-subheading text-text-primary mb-2">Ask about Steam data</h3>
            <p className="text-body-sm text-text-secondary max-w-md mb-6">
              Ask questions in plain English and I&apos;ll query the database for you.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSend(suggestion)}
                  className="px-3 py-1.5 text-body-sm text-text-secondary bg-surface-elevated hover:bg-surface-overlay border border-border-subtle hover:border-border-muted rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message, idx) => (
          <ChatMessage
            key={message.id}
            message={message}
            isStreaming={isLastMessageStreaming && idx === messages.length - 1}
          />
        ))}

        {/* Pending tool calls indicator */}
        {isStreaming && pendingToolCalls.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-elevated border border-border-subtle">
            <div className="w-4 h-4 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
            <Database className="w-4 h-4 text-text-muted" />
            <span className="text-body-sm text-text-secondary">
              Executing {pendingToolCalls.map(tc => tc.name).join(', ')}...
            </span>
          </div>
        )}

        {error && (
          <div className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/20">
            <p className="text-body-sm text-accent-red">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border-subtle p-4 bg-surface-raised">
        <div className="flex gap-2">
          <div className="flex-1">
            <ChatInput onSend={handleSend} disabled={isStreaming} />
          </div>
          {isStreaming && (
            <button
              onClick={stopStreaming}
              className="px-3 py-2 rounded-lg bg-accent-red/10 hover:bg-accent-red/20 border border-accent-red/20 text-accent-red transition-colors flex items-center gap-2"
              title="Stop generating"
            >
              <StopCircle className="w-4 h-4" />
              <span className="text-body-sm">Stop</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
