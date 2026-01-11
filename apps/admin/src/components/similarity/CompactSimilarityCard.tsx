/**
 * Compact card for similar games - information dense, minimal vertical space
 * Used in horizontal scroll layouts
 */

import Link from 'next/link';
import { SimilarityScore } from './SimilarityScore';

interface CompactSimilarityCardProps {
  id: number;
  name: string;
  score: number; // 0-100
  type?: string;
  genres?: string[];
  tags?: string[];
  reviewPercentage?: number | null;
  priceCents?: number | null;
  isFree?: boolean;
  entityType?: 'game' | 'publisher' | 'developer';
  matchReasons?: string[]; // Why this game is similar (from hybrid scoring)
}

function formatPrice(cents: number | null | undefined, isFree?: boolean): string {
  if (isFree) return 'Free';
  if (cents === null || cents === undefined) return '';
  return `$${(cents / 100).toFixed(2)}`;
}

function getReviewColor(percentage: number | null | undefined): string {
  if (percentage === null || percentage === undefined) return 'text-text-muted';
  if (percentage >= 70) return 'text-accent-green';
  if (percentage >= 50) return 'text-accent-yellow';
  return 'text-accent-red';
}

export function CompactSimilarityCard({
  id,
  name,
  score,
  type,
  genres,
  tags,
  reviewPercentage,
  priceCents,
  isFree,
  entityType = 'game',
  matchReasons,
}: CompactSimilarityCardProps) {
  const href = entityType === 'game'
    ? `/apps/${id}`
    : entityType === 'publisher'
      ? `/publishers/${id}`
      : `/developers/${id}`;

  // Use matchReasons from hybrid scoring if available, otherwise fall back to genres/tags
  const displayReasons = matchReasons && matchReasons.length > 0
    ? matchReasons.slice(0, 3)
    : [...(genres?.slice(0, 2) ?? []), ...(tags?.slice(0, 1) ?? [])].slice(0, 3);

  const hasPrice = priceCents !== null || isFree;
  const hasReview = reviewPercentage !== null && reviewPercentage !== undefined;

  return (
    <Link
      href={href}
      className="flex-shrink-0 w-56 p-3 rounded-lg border border-border-subtle bg-surface-raised hover:border-border-muted hover:bg-surface-elevated transition-all group"
    >
      {/* Row 1: Name + Score */}
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="flex-1 min-w-0">
          <h4 className="text-body-sm font-medium text-text-primary line-clamp-1 group-hover:text-accent-blue transition-colors">
            {name}
          </h4>
          {type && type !== 'game' && (
            <span className="text-caption text-text-muted capitalize">{type}</span>
          )}
        </div>
        <SimilarityScore score={score} size="sm" />
      </div>

      {/* Row 2: Review % + Price */}
      {(hasReview || hasPrice) && (
        <div className="flex items-center gap-2 text-caption mb-1.5">
          {hasReview && (
            <span className={getReviewColor(reviewPercentage)}>
              {reviewPercentage}%
            </span>
          )}
          {hasPrice && (
            <span className={isFree ? 'text-accent-green' : 'text-text-secondary'}>
              {formatPrice(priceCents, isFree)}
            </span>
          )}
        </div>
      )}

      {/* Row 3: Why similar (compact tags) */}
      {displayReasons.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {displayReasons.map((reason, i) => {
            // Special styling for relationship-based reasons
            const isRelationship = reason.includes('series') || reason === 'Same developer' || reason === 'Same publisher';
            return (
              <span
                key={`${reason}-${i}`}
                className={`px-1 py-0.5 rounded text-caption truncate max-w-[5rem] ${
                  isRelationship
                    ? 'bg-accent-blue/15 text-accent-blue'
                    : 'bg-surface-overlay text-text-tertiary'
                }`}
              >
                {reason}
              </span>
            );
          })}
        </div>
      )}
    </Link>
  );
}
