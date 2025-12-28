'use client';

import { Bot } from 'lucide-react';

export function ChatLoadingIndicator() {
  return (
    <div className="flex gap-3">
      {/* Bot avatar */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-surface-elevated border border-border-muted flex items-center justify-center">
        <Bot className="w-4 h-4 text-accent-blue" />
      </div>

      {/* Typing indicator */}
      <div className="p-4 rounded-lg bg-surface-raised border border-border-subtle">
        <div className="flex gap-1.5">
          <span
            className="w-2 h-2 rounded-full bg-text-muted animate-bounce"
            style={{ animationDelay: '0ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-text-muted animate-bounce"
            style={{ animationDelay: '150ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-text-muted animate-bounce"
            style={{ animationDelay: '300ms' }}
          />
        </div>
      </div>
    </div>
  );
}
