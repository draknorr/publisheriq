/**
 * Card displaying a similar game with score and metadata
 */

import Link from 'next/link';
import { Card } from '@/components/ui';
import { SimilarityScore } from './SimilarityScore';
import { Check } from 'lucide-react';

interface SimilarityCardProps {
  id: number;
  name: string;
  score: number; // 0-100
  type?: string;
  genres?: string[];
  tags?: string[];
  reviewPercentage?: number | null;
  priceCents?: number | null;
  isFree?: boolean;
  steamDeckVerified?: boolean;
  gameCount?: number; // For publishers/developers
  entityType?: 'game' | 'publisher' | 'developer';
  className?: string;
}

function formatPrice(cents: number | null | undefined, isFree?: boolean): string {
  if (isFree) return 'Free';
  if (cents === null || cents === undefined) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function getReviewColor(percentage: number | null): string {
  if (percentage === null) return 'text-text-muted';
  if (percentage >= 70) return 'text-accent-green';
  if (percentage >= 50) return 'text-accent-yellow';
  return 'text-accent-red';
}

export function SimilarityCard({
  id,
  name,
  score,
  type,
  genres,
  tags,
  reviewPercentage,
  priceCents,
  isFree,
  steamDeckVerified,
  gameCount,
  entityType = 'game',
  className = '',
}: SimilarityCardProps) {
  const href = entityType === 'game'
    ? `/apps/${id}`
    : entityType === 'publisher'
      ? `/publishers/${id}`
      : `/developers/${id}`;

  // Show top 2 genres and top 3 tags
  const displayGenres = genres?.slice(0, 2) ?? [];
  const displayTags = tags?.slice(0, 3) ?? [];
  const sharedMetadata = [...displayGenres, ...displayTags];

  return (
    <Link href={href}>
      <Card
        variant="interactive"
        padding="md"
        className={`h-full ${className}`}
      >
        {/* Header with name and score */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-body font-medium text-text-primary line-clamp-2 flex-1">
            {name}
          </h4>
          <SimilarityScore score={score} size="sm" />
        </div>

        {/* Type indicator for games */}
        {type && type !== 'game' && (
          <span className="inline-block px-1.5 py-0.5 rounded text-caption bg-surface-overlay text-text-muted mb-2 capitalize">
            {type}
          </span>
        )}

        {/* Metrics row */}
        <div className="flex items-center gap-3 text-body-sm mb-3">
          {reviewPercentage !== null && reviewPercentage !== undefined && (
            <span className={getReviewColor(reviewPercentage)}>
              {reviewPercentage}% positive
            </span>
          )}
          {(priceCents !== null || isFree) && (
            <span className={isFree ? 'text-accent-green' : 'text-text-secondary'}>
              {formatPrice(priceCents, isFree)}
            </span>
          )}
          {steamDeckVerified && (
            <span className="inline-flex items-center gap-0.5 text-accent-green">
              <Check className="h-3 w-3" />
              Deck
            </span>
          )}
          {gameCount !== undefined && (
            <span className="text-text-secondary">
              {gameCount} games
            </span>
          )}
        </div>

        {/* Shared metadata tags */}
        {sharedMetadata.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {sharedMetadata.map((item, i) => (
              <span
                key={`${item}-${i}`}
                className="px-1.5 py-0.5 rounded text-caption bg-surface-overlay text-text-tertiary"
              >
                {item}
              </span>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}
