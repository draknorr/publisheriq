'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, ArrowRight } from 'lucide-react';
import { getRandomPrompts } from '@/lib/example-prompts';

export function DashboardSearch() {
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [suggestions] = useState(() => getRandomPrompts(4));
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
    <div className="py-12 md:py-16">
      <div className="max-w-2xl mx-auto text-center">
        {/* Heading */}
        <h1 className="text-display text-text-primary mb-3">
          Gaming Intelligence at Your Fingertips
        </h1>
        <p className="text-body-lg text-text-secondary mb-8 max-w-lg mx-auto">
          Research games, track market trends, and benchmark competitors with natural language queries
        </p>

        {/* Search Input */}
        <form onSubmit={handleSubmit} className="relative mb-8">
          <div
            className={`
              relative rounded-2xl transition-all duration-200
              ${isFocused ? 'shadow-glow-primary' : ''}
            `}
          >
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="Ask anything about games, publishers, or market trends..."
              className={`
                w-full pl-14 pr-14 py-5 text-body-lg
                bg-surface-raised border rounded-2xl
                text-text-primary placeholder:text-text-muted
                focus:outline-none transition-all duration-200
                ${isFocused
                  ? 'border-accent-primary'
                  : 'border-border-subtle hover:border-border-muted'
                }
              `}
            />
            {query.trim() && (
              <button
                type="submit"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-xl bg-accent-primary hover:bg-accent-primary-hover text-white transition-colors"
              >
                <ArrowRight className="w-5 h-5" />
              </button>
            )}
          </div>
        </form>

        {/* Example Prompts */}
        <div className="flex flex-wrap gap-2 justify-center">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              onClick={() => handleSuggestionClick(suggestion)}
              className={`
                px-4 py-2 text-body-sm text-text-secondary
                bg-surface-elevated hover:bg-surface-overlay
                border border-border-subtle hover:border-border-muted
                rounded-full transition-all duration-150
                hover:text-text-primary
                animate-fade-in-up
              `}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
