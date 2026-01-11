'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { Search, Gamepad2, Building2, User, MessageSquare, Sparkles, Loader2 } from 'lucide-react';
import { useGlobalSearch } from './GlobalSearchProvider';
import { TrendSparkline } from '@/components/data-display';
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

  // Handle escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // Debounced search
  const search = useCallback(async (searchQuery: string) => {
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
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => search(value), 150);
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

  const formatScore = (score: number | null) => (score === null ? null : `${Math.round(score)}%`);

  const formatReviews = (count: number | null) => {
    if (count === null) return null;
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(0)}K`;
    return count.toString();
  };

  const hasResults =
    results && (results.games.length > 0 || results.publishers.length > 0 || results.developers.length > 0);
  const showEmpty = query.trim().length >= 2 && !isLoading && results && !hasResults;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={close} />

      {/* Dialog Container */}
      <div className="fixed inset-0 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
        <Command
          label="Global Search"
          className="w-full max-w-[560px] bg-surface-elevated rounded-2xl shadow-2xl border border-border-subtle overflow-hidden animate-scale-in pointer-events-auto"
          shouldFilter={false}
        >
          {/* Search Input */}
          <div className="flex items-center px-4 py-3 border-b border-border-subtle">
            <div className="flex items-center justify-center w-10 h-10">
              {isLoading ? (
                <Loader2 className="w-5 h-5 text-accent-primary animate-spin" />
              ) : (
                <Search className="w-5 h-5 text-text-muted" />
              )}
            </div>
            <Command.Input
              value={query}
              onValueChange={handleInputChange}
              placeholder="Search games, publishers, developers..."
              autoFocus
              className="flex-1 h-10 bg-transparent text-[15px] text-text-primary placeholder:text-text-muted border-0 outline-none focus:outline-none focus:ring-0"
            />
            <kbd className="hidden sm:flex items-center h-6 px-1.5 text-[11px] font-medium text-text-tertiary bg-surface-raised rounded border border-border-subtle">
              ESC
            </kbd>
          </div>

          {/* Results List */}
          <Command.List className="max-h-[400px] overflow-y-auto overscroll-contain">
            {/* Empty state - type to search */}
            {!query.trim() && (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <div className="w-12 h-12 rounded-full bg-surface-raised flex items-center justify-center mb-3">
                  <Search className="w-5 h-5 text-text-muted" />
                </div>
                <p className="text-[14px] text-text-secondary">Search games, publishers, or developers</p>
                <p className="text-[12px] text-text-tertiary mt-1">Type at least 2 characters</p>
              </div>
            )}

            {/* Loading state */}
            {query.trim().length >= 2 && isLoading && !results && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 text-accent-primary animate-spin" />
              </div>
            )}

            {/* Empty state - no results */}
            {showEmpty && (
              <Command.Empty className="flex flex-col items-center justify-center py-12 px-4">
                <p className="text-[14px] text-text-secondary">No results for &ldquo;{query}&rdquo;</p>
                <p className="text-[12px] text-text-tertiary mt-1">Try a different search term</p>
              </Command.Empty>
            )}

            {/* Games */}
            {results && results.games.length > 0 && (
              <Command.Group>
                <div className="px-3 py-2">
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Games</span>
                </div>
                {results.games.map((game) => (
                  <Command.Item
                    key={`game-${game.appid}`}
                    value={`game-${game.name}`}
                    onSelect={() => handleSelectGame(game)}
                    className="mx-2 px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 data-[selected=true]:bg-accent-primary/10 hover:bg-surface-overlay transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent-primary/10 flex items-center justify-center shrink-0">
                      <Gamepad2 className="w-4 h-4 text-accent-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[14px] font-medium text-text-primary truncate">{game.name}</span>
                        {game.releaseYear && (
                          <span className="text-[12px] text-text-tertiary shrink-0">{game.releaseYear}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {formatScore(game.reviewScore) && (
                          <span
                            className={`text-[12px] font-medium ${
                              game.reviewScore && game.reviewScore >= 80
                                ? 'text-trend-positive'
                                : game.reviewScore && game.reviewScore >= 70
                                  ? 'text-accent-yellow'
                                  : 'text-text-secondary'
                            }`}
                          >
                            {formatScore(game.reviewScore)}
                          </span>
                        )}
                        {formatScore(game.reviewScore) && formatReviews(game.totalReviews) && (
                          <span className="text-text-tertiary">·</span>
                        )}
                        {formatReviews(game.totalReviews) && (
                          <span className="text-[12px] text-text-secondary">{formatReviews(game.totalReviews)} reviews</span>
                        )}
                        {game.isFree && (
                          <>
                            <span className="text-text-tertiary">·</span>
                            <span className="text-[12px] font-medium text-accent-cyan">Free</span>
                          </>
                        )}
                      </div>
                    </div>
                    {/* 7-day CCU trend sparkline */}
                    {game.sparkline && game.sparkline.length > 0 && (
                      <div className="shrink-0 w-16">
                        <TrendSparkline
                          data={game.sparkline}
                          trend={game.sparklineTrend}
                          height={24}
                          variant="line"
                        />
                      </div>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Publishers */}
            {results && results.publishers.length > 0 && (
              <Command.Group>
                <div className="px-3 py-2 mt-1">
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Publishers</span>
                </div>
                {results.publishers.map((publisher) => (
                  <Command.Item
                    key={`publisher-${publisher.id}`}
                    value={`publisher-${publisher.name}`}
                    onSelect={() => handleSelectPublisher(publisher)}
                    className="mx-2 px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 data-[selected=true]:bg-accent-purple/10 hover:bg-surface-overlay transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent-purple/10 flex items-center justify-center shrink-0">
                      <Building2 className="w-4 h-4 text-accent-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-medium text-text-primary truncate block">{publisher.name}</span>
                      <span className="text-[12px] text-text-secondary">{publisher.gameCount} games</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Developers */}
            {results && results.developers.length > 0 && (
              <Command.Group>
                <div className="px-3 py-2 mt-1">
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Developers</span>
                </div>
                {results.developers.map((developer) => (
                  <Command.Item
                    key={`developer-${developer.id}`}
                    value={`developer-${developer.name}`}
                    onSelect={() => handleSelectDeveloper(developer)}
                    className="mx-2 px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 data-[selected=true]:bg-accent-green/10 hover:bg-surface-overlay transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-accent-green/10 flex items-center justify-center shrink-0">
                      <User className="w-4 h-4 text-accent-green" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-[14px] font-medium text-text-primary truncate block">{developer.name}</span>
                      <span className="text-[12px] text-text-secondary">{developer.gameCount} games</span>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Actions */}
            {query.trim().length >= 2 && (
              <Command.Group>
                <div className="px-3 py-2 mt-1">
                  <span className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">Actions</span>
                </div>
                <Command.Item
                  value={`action-chat-${query}`}
                  onSelect={handleAskInChat}
                  className="mx-2 px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 data-[selected=true]:bg-accent-blue/10 hover:bg-surface-overlay transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-blue/10 flex items-center justify-center shrink-0">
                    <MessageSquare className="w-4 h-4 text-accent-blue" />
                  </div>
                  <span className="text-[14px] text-text-primary">
                    Ask about <span className="font-medium">&ldquo;{query}&rdquo;</span> in chat
                  </span>
                </Command.Item>
                <Command.Item
                  value={`action-similar-${query}`}
                  onSelect={handleFindSimilar}
                  className="mx-2 px-3 py-2.5 rounded-lg cursor-pointer flex items-center gap-3 data-[selected=true]:bg-accent-orange/10 hover:bg-surface-overlay transition-colors mb-2"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent-orange/10 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-accent-orange" />
                  </div>
                  <span className="text-[14px] text-text-primary">
                    Find games similar to <span className="font-medium">&ldquo;{query}&rdquo;</span>
                  </span>
                </Command.Item>
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
