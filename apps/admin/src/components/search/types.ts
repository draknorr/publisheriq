/**
 * Global Search Types
 */

export interface GameSearchResult {
  appid: number;
  name: string;
  releaseYear: number | null;
  reviewScore: number | null;
  totalReviews: number | null;
  isFree: boolean;
  // Sparkline data (7-day CCU trend)
  sparkline?: number[];
  sparklineTrend?: 'up' | 'down' | 'stable';
}

export interface PublisherSearchResult {
  id: number;
  name: string;
  gameCount: number;
}

export interface DeveloperSearchResult {
  id: number;
  name: string;
  gameCount: number;
}

export interface SearchResults {
  games: GameSearchResult[];
  publishers: PublisherSearchResult[];
  developers: DeveloperSearchResult[];
  // Best similarity score for each category (0-1, used for section ordering)
  scores?: {
    games: number;
    publishers: number;
    developers: number;
  };
}

export interface SearchResponse {
  success: boolean;
  query: string;
  results: SearchResults;
  timing?: {
    total_ms: number;
  };
  error?: string;
}

export interface GlobalSearchContextValue {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}
