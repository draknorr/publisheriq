'use client';

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react';
import { Send } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import type { ChatRequestOptions } from '@/lib/llm/types';

interface ChatInputProps {
  onSend: (message: string, requestOptions?: ChatRequestOptions) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [input, setInput] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }

    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, [input]);

  const handleSubmit = useCallback(() => {
    const message = input.trim();
    if (!message || disabled) {
      return;
    }

    onSend(message);
    setInput('');
  }, [disabled, input, onSend]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      if (disabled) {
        return;
      }

      event.preventDefault();
      handleSubmit();
    }
  }, [disabled, handleSubmit]);

  return (
    <div className="flex gap-3 items-end">
      <div className="flex-1">
        <textarea
          ref={textareaRef}
          data-testid="chat-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about Steam games, publishers, or trends..."
          aria-disabled={disabled}
          rows={1}
          autoComplete="off"
          className={`
            block w-full min-h-[40px] max-h-[200px] overflow-x-hidden overflow-y-auto scrollbar-none py-2.5 px-4 rounded-lg resize-none
            bg-surface-elevated border border-border-muted
            text-body text-text-primary placeholder:text-text-muted
            transition-colors duration-150
            hover:border-border-prominent
            focus:outline-none focus:border-accent-primary focus:ring-1 focus:ring-accent-primary
            ${disabled ? 'opacity-90' : 'opacity-100'}
          `}
        />
      </div>

      <Button
        data-testid="chat-send"
        onClick={handleSubmit}
        disabled={disabled || !input.trim()}
        size="lg"
      >
        <Send className="w-4 h-4" />
        <span className="sr-only">Send message</span>
      </Button>
    </div>
  );
}
