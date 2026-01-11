'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import {
  Search,
  Gamepad2,
  Building2,
  User,
  MessageSquare,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { useGlobalSearch } from './GlobalSearchProvider';
import type { SearchResponse, GameSearchResult, PublisherSearchResult, DeveloperSearchResult } from './types';

export function GlobalSearch() {
  const { isOpen, close } = useGlobalSearch();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResponse['results'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setResults(null);
      setIsLoading(false);
    }
  }, [isOpen]);

  // Debounced search
  const search = useCallback(async (searchQuery: string) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    if (searchQuery.trim().length < 2) {
      setResults(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, limit: 5 }),
        signal: abortControllerRef.current.signal,
      });

      const data: SearchResponse = await response.json();
      if (data.success) {
        setResults(data.results);
      }
    } catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
        console.error('Search error:', error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Handle input change with debounce
  const handleInputChange = useCallback(
    (value: string) => {
      setQuery(value);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      debounceRef.current = setTimeout(() => {
        search(value);
      }, 150);
    },
    [search]
  );

  // Navigation handlers
  const handleSelectGame = useCallback(
    (game: GameSearchResult) => {
      close();
      router.push(`/apps/${game.appid}`);
    },
    [close, router]
  );

  const handleSelectPublisher = useCallback(
    (publisher: PublisherSearchResult) => {
      close();
      router.push(`/publishers/${publisher.id}`);
    },
    [close, router]
  );

  const handleSelectDeveloper = useCallback(
    (developer: DeveloperSearchResult) => {
      close();
      router.push(`/developers/${developer.id}`);
    },
    [close, router]
  );

  const handleAskInChat = useCallback(() => {
    close();
    router.push(`/chat?q=${encodeURIComponent(`Tell me about ${query}`)}`);
  }, [close, router, query]);

  const handleFindSimilar = useCallback(() => {
    close();
    router.push(`/chat?q=${encodeURIComponent(`Find games similar to ${query}`)}`);
  }, [close, router, query]);

  // Format review score
  const formatScore = (score: number | null) => {
    if (score === null) return null;
    return `${Math.round(score)}%`;
  };

  // Format review count
  const formatReviews = (count: number | null) => {
    if (count === null) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const hasResults =
    results && (results.games.length > 0 || results.publishers.length > 0 || results.developers.length > 0);
  const showEmpty = query.trim().length >= 2 && !isLoading && results && !hasResults;

  return (
    <Command.Dialog
      open={isOpen}
      onOpenChange={(open) => !open && close()}
      label="Global Search"
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={close} />

      {/* Dialog */}
      <div className="fixed left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl">
        <div className="bg-surface-elevated border border-border-subtle rounded-xl shadow-overlay overflow-hidden animate-scale-in">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 border-b border-border-subtle">
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-text-muted animate-spin" />
            ) : (
              <Search className="w-5 h-5 text-text-muted" />
            )}
            <Command.Input
              value={query}
              onValueChange={handleInputChange}
              placeholder="Search games, publishers, developers..."
              className="flex-1 py-4 bg-transparent text-body-lg text-text-primary placeholder:text-text-muted focus:outline-none"
              autoFocus
            />
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-caption text-text-tertiary bg-surface rounded border border-border-subtle">
              esc
            </kbd>
          </div>

          {/* Results List */}
          <Command.List className="max-h-[60vh] overflow-y-auto p-2">
            {/* Empty state - type to search */}
            {!query.trim() && (
              <div className="py-8 text-center text-text-secondary">
                <Search className="w-8 h-8 mx-auto mb-2 text-text-muted" />
                <p className="text-body">Type to search games, publishers, or developers</p>
                <p className="text-body-sm text-text-tertiary mt-1">Minimum 2 characters</p>
              </div>
            )}

            {/* Empty state - no results */}
            {showEmpty && (
              <Command.Empty className="py-8 text-center text-text-secondary">
                <p className="text-body">No results found for &ldquo;{query}&rdquo;</p>
                <p className="text-body-sm text-text-tertiary mt-1">Try a different search term</p>
              </Command.Empty>
            )}

            {/* Games */}
            {results && results.games.length > 0 && (
              <Command.Group
                heading={
                  <span className="flex items-center gap-2 px-2 py-1.5 text-caption text-text-tertiary uppercase tracking-wide">
                    <Gamepad2 className="w-3.5 h-3.5" />
                    Games
                  </span>
                }
              >
                {results.games.map((game) => (
                  <Command.Item
                    key={`game-${game.appid}`}
                    value={`game-${game.name}`}
                    onSelect={() => handleSelectGame(game)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-overlay transition-colors"
                  >
                    <Gamepad2 className="w-4 h-4 text-accent-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-body text-text-primary truncate">{game.name}</span>
                        {game.releaseYear && (
                          <span className="text-caption text-text-tertiary shrink-0">{game.releaseYear}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-caption text-text-secondary">
                        {formatScore(game.reviewScore) && (
                          <span
                            className={
                              game.reviewScore && game.reviewScore >= 80
                                ? 'text-trend-positive'
                                : game.reviewScore && game.reviewScore >= 70
                                  ? 'text-accent-yellow'
                                  : 'text-text-secondary'
                            }
                          >
                            {formatScore(game.reviewScore)}
                          </span>
                        )}
                        {formatReviews(game.totalReviews) && <span>{formatReviews(game.totalReviews)} reviews</span>}
                        {game.isFree && <span className="text-accent-cyan">Free</span>}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Publishers */}
            {results && results.publishers.length > 0 && (
              <Command.Group
                heading={
                  <span className="flex items-center gap-2 px-2 py-1.5 text-caption text-text-tertiary uppercase tracking-wide">
                    <Building2 className="w-3.5 h-3.5" />
                    Publishers
                  </span>
                }
              >
                {results.publishers.map((publisher) => (
                  <Command.Item
                    key={`publisher-${publisher.id}`}
                    value={`publisher-${publisher.name}`}
                    onSelect={() => handleSelectPublisher(publisher)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-overlay transition-colors"
                  >
                    <Building2 className="w-4 h-4 text-accent-purple shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-body text-text-primary truncate block">{publisher.name}</span>
                      <span className="text-caption text-text-secondary">{publisher.gameCount} games</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Developers */}
            {results && results.developers.length > 0 && (
              <Command.Group
                heading={
                  <span className="flex items-center gap-2 px-2 py-1.5 text-caption text-text-tertiary uppercase tracking-wide">
                    <User className="w-3.5 h-3.5" />
                    Developers
                  </span>
                }
              >
                {results.developers.map((developer) => (
                  <Command.Item
                    key={`developer-${developer.id}`}
                    value={`developer-${developer.name}`}
                    onSelect={() => handleSelectDeveloper(developer)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-overlay transition-colors"
                  >
                    <User className="w-4 h-4 text-accent-green shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-body text-text-primary truncate block">{developer.name}</span>
                      <span className="text-caption text-text-secondary">{developer.gameCount} games</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions - shown when query has content */}
            {query.trim().length >= 2 && (
              <Command.Group
                heading={
                  <span className="flex items-center gap-2 px-2 py-1.5 text-caption text-text-tertiary uppercase tracking-wide">
                    Actions
                  </span>
                }
              >
                <Command.Item
                  value={`action-chat-${query}`}
                  onSelect={handleAskInChat}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-overlay transition-colors"
                >
                  <MessageSquare className="w-4 h-4 text-accent-blue shrink-0" />
                  <span className="text-body text-text-primary">
                    Ask about &ldquo;{query}&rdquo; in chat
                  </span>
                </Command.Item>
                <Command.Item
                  value={`action-similar-${query}`}
                  onSelect={handleFindSimilar}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer data-[selected=true]:bg-surface-overlay transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-accent-orange shrink-0" />
                  <span className="text-body text-text-primary">
                    Find games similar to &ldquo;{query}&rdquo;
                  </span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </div>
      </div>
    </Command.Dialog>
  );
}
