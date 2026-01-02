'use client';

import { useState, useCallback, useRef } from 'react';
import type { Message, ChatToolCall, ChatTiming } from '@/lib/llm/types';
import type { StreamEvent } from '@/lib/llm/streaming-types';

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolCalls?: ChatToolCall[];
  timing?: ChatTiming;
  timestamp: Date;
}

interface PendingToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

interface UseChatStreamOptions {
  onError?: (error: string) => void;
}

export function useChatStream(options: UseChatStreamOptions = {}) {
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [pendingToolCalls, setPendingToolCalls] = useState<PendingToolCall[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || isStreaming) return;

    // Add user message
    const userMessage: DisplayMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    // Create placeholder assistant message
    const assistantId = crypto.randomUUID();
    const assistantMessage: DisplayMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setIsStreaming(true);
    setPendingToolCalls([]);

    // Build message history for API
    const currentMessages = messages;
    const apiMessages: Message[] = currentMessages
      .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
      .concat({ role: 'user', content: content.trim() });

    try {
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = '';
      const toolCalls: ChatToolCall[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const event: StreamEvent = JSON.parse(line.slice(6));

            switch (event.type) {
              case 'text_delta':
                accumulatedContent += event.delta;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: accumulatedContent }
                    : m
                ));
                break;

              case 'tool_start':
                setPendingToolCalls(prev => [...prev, {
                  id: event.toolCallId,
                  name: event.name,
                  arguments: event.arguments,
                }]);
                break;

              case 'tool_result': {
                // Find arguments from pending tool call
                const pendingTc = pendingToolCalls.find(tc => tc.id === event.toolCallId);
                // Remove from pending and add to completed
                setPendingToolCalls(prev =>
                  prev.filter(tc => tc.id !== event.toolCallId)
                );
                toolCalls.push({
                  name: event.name,
                  arguments: pendingTc?.arguments || {},
                  result: event.result,
                  timing: event.timing,
                });
                break;
              }

              case 'message_end':
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? {
                        ...m,
                        content: accumulatedContent,
                        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                        timing: event.timing,
                      }
                    : m
                ));
                break;

              case 'error':
                options.onError?.(event.message);
                // Update assistant message to show error
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, content: accumulatedContent || 'An error occurred.' }
                    : m
                ));
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        options.onError?.(error.message);
        // Update assistant message to show error state
        setMessages(prev => prev.map(m =>
          m.id === assistantId
            ? { ...m, content: m.content || 'Failed to get response.' }
            : m
        ));
      }
    } finally {
      setIsStreaming(false);
      setPendingToolCalls([]);
      abortControllerRef.current = null;
    }
  }, [messages, isStreaming, options]);

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    setPendingToolCalls([]);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isStreaming,
    pendingToolCalls,
    sendMessage,
    stopStreaming,
    clearMessages,
  };
}
