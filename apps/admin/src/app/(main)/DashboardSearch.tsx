'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, MessageSquare } from 'lucide-react';

const suggestions = [
  'What publisher has the most games?',
  'Show me indie games with great reviews',
  'What games are trending up?',
  'How many games did Valve release?',
];

export function DashboardSearch() {
  const [query, setQuery] = useState('');
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      router.push(`/chat?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    router.push(`/chat?q=${encodeURIComponent(suggestion)}`);
  };

  return (
    <div className="mb-12 py-8">
      <div className="max-w-2xl mx-auto text-center">
        {/* Icon */}
        <div className="w-16 h-16 rounded-full bg-accent-blue/10 flex items-center justify-center mx-auto mb-6">
          <MessageSquare className="w-8 h-8 text-accent-blue" />
        </div>

        {/* Heading */}
        <h2 className="text-heading text-text-primary mb-3">
          Welcome to PublisherIQ
        </h2>
        <p className="text-body text-text-secondary mb-8">
          Ask anything about Steam or browse the full catalogue of data
        </p>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="relative mb-6">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about games, publishers, or trends..."
              className="w-full pl-12 pr-4 py-4 text-body bg-surface-raised border border-border-subtle rounded-xl text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-blue focus:ring-1 focus:ring-accent-blue transition-all"
            />
          </div>
        </form>

        {/* Example Prompts */}
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className="px-4 py-2 text-body-sm text-text-secondary bg-surface-elevated hover:bg-surface-overlay border border-border-subtle hover:border-border-muted rounded-full transition-all hover:text-text-primary"
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
