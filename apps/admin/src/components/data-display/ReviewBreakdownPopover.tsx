'use client';

import { type ReactNode, useMemo } from 'react';
import Link from 'next/link';
import { Popover } from '../ui/Popover';
import { ReviewScoreBadge } from './TrendIndicator';

export interface GameReviewData {
  appid: number;
  name: string;
  positive_reviews: number;
  negative_reviews: number;
  total_reviews: number;
}

interface ReviewBreakdownPopoverProps {
  games: GameReviewData[];
  trigger: ReactNode;
  title?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  maxGames?: number;
}

export function ReviewBreakdownPopover({
  games,
  trigger,
  title = 'Review Breakdown by Game',
  position = 'bottom',
  align = 'start',
  maxGames = 7,
}: ReviewBreakdownPopoverProps) {
  // Sort games by negative reviews (most first) and calculate stats
  const sortedGames = useMemo(() => {
    const totalNegative = games.reduce((sum, g) => sum + g.negative_reviews, 0);

    return games
      .filter((g) => g.total_reviews > 0)
      .map((g) => ({
        ...g,
        score: Math.round((g.positive_reviews / g.total_reviews) * 100),
        negativePercent: totalNegative > 0 ? (g.negative_reviews / totalNegative) * 100 : 0,
      }))
      .sort((a, b) => b.negative_reviews - a.negative_reviews)
      .slice(0, maxGames);
  }, [games, maxGames]);

  const totalGamesWithReviews = games.filter((g) => g.total_reviews > 0).length;
  const hasMore = totalGamesWithReviews > maxGames;

  if (sortedGames.length === 0) {
    return <>{trigger}</>;
  }

  const content = (
    <div className="p-4 min-w-[320px] max-w-[400px]">
      <div className="mb-3">
        <h4 className="text-subheading text-text-primary">{title}</h4>
        <p className="text-caption text-text-tertiary">
          {totalGamesWithReviews} game{totalGamesWithReviews !== 1 ? 's' : ''} with reviews
        </p>
      </div>

      <div className="space-y-2">
        {sortedGames.map((game) => (
          <Link
            key={game.appid}
            href={`/apps/${game.appid}`}
            className="flex items-center gap-3 p-2 -mx-2 rounded hover:bg-surface-raised transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-sm text-text-primary truncate group-hover:text-accent-blue transition-colors">
                {game.name}
              </p>
              <div className="flex items-center gap-2 text-caption text-text-tertiary">
                <span className="text-accent-red">{game.negative_reviews.toLocaleString()} negative</span>
                {game.negativePercent > 0 && (
                  <span>({game.negativePercent.toFixed(1)}% of total)</span>
                )}
              </div>
            </div>
            <ReviewScoreBadge score={game.score} />
          </Link>
        ))}
      </div>

      {hasMore && (
        <p className="mt-3 pt-3 border-t border-border-subtle text-caption text-text-tertiary text-center">
          +{totalGamesWithReviews - maxGames} more game{totalGamesWithReviews - maxGames !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );

  return <Popover trigger={trigger} content={content} position={position} align={align} />;
}

// Version for monthly histogram data
export interface MonthlyGameReviewData {
  appid: number;
  name: string;
  recommendations_up: number;
  recommendations_down: number;
}

interface MonthlyReviewBreakdownPopoverProps {
  games: MonthlyGameReviewData[];
  trigger: ReactNode;
  monthLabel: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
  maxGames?: number;
}

export function MonthlyReviewBreakdownPopover({
  games,
  trigger,
  monthLabel,
  position = 'bottom',
  align = 'start',
  maxGames = 7,
}: MonthlyReviewBreakdownPopoverProps) {
  // Sort games by negative reviews (most first) and calculate stats
  const sortedGames = useMemo(() => {
    const totalNegative = games.reduce((sum, g) => sum + g.recommendations_down, 0);

    return games
      .filter((g) => g.recommendations_up + g.recommendations_down > 0)
      .map((g) => {
        const total = g.recommendations_up + g.recommendations_down;
        return {
          ...g,
          total,
          score: Math.round((g.recommendations_up / total) * 100),
          negativePercent: totalNegative > 0 ? (g.recommendations_down / totalNegative) * 100 : 0,
        };
      })
      .sort((a, b) => b.recommendations_down - a.recommendations_down)
      .slice(0, maxGames);
  }, [games, maxGames]);

  const totalGamesWithReviews = games.filter((g) => g.recommendations_up + g.recommendations_down > 0).length;
  const hasMore = totalGamesWithReviews > maxGames;

  if (sortedGames.length === 0) {
    return <>{trigger}</>;
  }

  const content = (
    <div className="p-4 min-w-[320px] max-w-[400px]">
      <div className="mb-3">
        <h4 className="text-subheading text-text-primary">{monthLabel} Breakdown</h4>
        <p className="text-caption text-text-tertiary">
          {totalGamesWithReviews} game{totalGamesWithReviews !== 1 ? 's' : ''} received reviews
        </p>
      </div>

      <div className="space-y-2">
        {sortedGames.map((game) => (
          <Link
            key={game.appid}
            href={`/apps/${game.appid}`}
            className="flex items-center gap-3 p-2 -mx-2 rounded hover:bg-surface-raised transition-colors group"
          >
            <div className="flex-1 min-w-0">
              <p className="text-body-sm text-text-primary truncate group-hover:text-accent-blue transition-colors">
                {game.name}
              </p>
              <div className="flex items-center gap-2 text-caption text-text-tertiary">
                <span className="text-accent-green">+{game.recommendations_up.toLocaleString()}</span>
                <span className="text-accent-red">-{game.recommendations_down.toLocaleString()}</span>
                {game.negativePercent > 0 && game.recommendations_down > 0 && (
                  <span>({game.negativePercent.toFixed(1)}% of negatives)</span>
                )}
              </div>
            </div>
            <ReviewScoreBadge score={game.score} />
          </Link>
        ))}
      </div>

      {hasMore && (
        <p className="mt-3 pt-3 border-t border-border-subtle text-caption text-text-tertiary text-center">
          +{totalGamesWithReviews - maxGames} more game{totalGamesWithReviews - maxGames !== 1 ? 's' : ''}
        </p>
      )}
    </div>
  );

  return <Popover trigger={trigger} content={content} position={position} align={align} />;
}
