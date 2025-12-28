'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, type DisplayMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatLoadingIndicator } from './ChatLoadingIndicator';
import { MessageSquare } from 'lucide-react';
import type { Message, ChatResponse } from '@/lib/llm/types';

export function ChatContainer() {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    setError(null);

    // Add user message
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Build message history for API (only user/assistant content)
      const apiMessages: Message[] = messages
        .map((m) => ({ role: m.role, content: m.content }))
        .concat({ role: 'user', content: content.trim() });

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data: ChatResponse = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Failed to get response');
      }

      // Add assistant message
      const assistantMessage: DisplayMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.response,
        toolCalls: data.toolCalls,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-full bg-accent-blue/10 flex items-center justify-center mb-4">
              <MessageSquare className="w-8 h-8 text-accent-blue" />
            </div>
            <h3 className="text-subheading text-text-primary mb-2">Ask about Steam data</h3>
            <p className="text-body-sm text-text-secondary max-w-md mb-6">
              Ask questions in plain English and I&apos;ll query the database for you.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg">
              {[
                'What publisher has the most games?',
                'Show me indie games with great reviews',
                'What games are trending up?',
                'How many games did Valve release?',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => sendMessage(suggestion)}
                  className="px-3 py-1.5 text-body-sm text-text-secondary bg-surface-elevated hover:bg-surface-overlay border border-border-subtle hover:border-border-muted rounded-full transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}

        {isLoading && <ChatLoadingIndicator />}

        {error && (
          <div className="p-4 rounded-lg bg-accent-red/10 border border-accent-red/20">
            <p className="text-body-sm text-accent-red">{error}</p>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-border-subtle p-4 bg-surface-raised">
        <ChatInput onSend={sendMessage} disabled={isLoading} />
      </div>
    </div>
  );
}
