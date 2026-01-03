'use client';

/**
 * Similarity section component for detail pages
 * Fetches and displays similar entities with optional filters
 */

import { useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui';
import { SimilarityCard } from './SimilarityCard';
import { CompactSimilarityCard } from './CompactSimilarityCard';
import { Loader2, AlertCircle, Filter } from 'lucide-react';

type EntityType = 'game' | 'publisher' | 'developer';

interface SimilarEntity {
  id: number;
  name: string;
  score: number;
  type?: string;
  genres?: string[];
  tags?: string[];
  review_percentage?: number | null;
  price_cents?: number | null;
  is_free?: boolean;
  game_count?: number;
}

interface SimilarityResponse {
  success: boolean;
  reference?: {
    id: number;
    name: string;
    type: string;
  };
  results?: SimilarEntity[];
  total_found?: number;
  error?: string;
}

interface SimilaritySectionProps {
  entityId?: number; // Reserved for future cache key use
  entityName: string;
  entityType: EntityType;
  limit?: number;
  showFilters?: boolean;
  compact?: boolean; // Use horizontal scroll layout with compact cards
  className?: string;
}

type PopularityFilter = 'any' | 'less_popular' | 'similar' | 'more_popular';

const popularityOptions: { value: PopularityFilter; label: string }[] = [
  { value: 'any', label: 'Any' },
  { value: 'less_popular', label: 'Less Popular' },
  { value: 'similar', label: 'Similar' },
  { value: 'more_popular', label: 'More Popular' },
];

export function SimilaritySection({
  entityName,
  entityType,
  limit = 8,
  showFilters = false,
  compact = false,
  className = '',
}: SimilaritySectionProps) {
  const [results, setResults] = useState<SimilarEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [popularityFilter, setPopularityFilter] = useState<PopularityFilter>('any');

  const fetchSimilar = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        entity_type: entityType,
        reference_name: entityName,
        limit: limit.toString(),
      });

      if (popularityFilter !== 'any') {
        params.set('popularity_comparison', popularityFilter);
      }

      const response = await fetch(`/api/similarity?${params.toString()}`);
      const data: SimilarityResponse = await response.json();

      if (!data.success) {
        setError(data.error || 'Failed to fetch similar entities');
        setResults([]);
      } else {
        setResults(data.results || []);
      }
    } catch {
      setError('Failed to fetch similar entities');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityName, limit, popularityFilter]);

  useEffect(() => {
    fetchSimilar();
  }, [fetchSimilar]);

  const sectionTitle = entityType === 'game'
    ? 'Similar Games'
    : entityType === 'publisher'
      ? 'Similar Publishers'
      : 'Similar Developers';

  return (
    <section className={className}>
      {/* Header with optional filters */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-subheading text-text-primary">{sectionTitle}</h3>
        {showFilters && entityType === 'game' && (
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-text-tertiary" />
            <div className="flex gap-1">
              {popularityOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setPopularityFilter(option.value)}
                  className={`px-2 py-1 rounded text-caption transition-colors ${
                    popularityFilter === option.value
                      ? 'bg-accent-blue/15 text-accent-blue'
                      : 'bg-surface-elevated text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <Card className="p-8 flex items-center justify-center">
          <Loader2 className="h-6 w-6 text-text-muted animate-spin" />
          <span className="ml-2 text-text-muted">Finding similar {entityType}s...</span>
        </Card>
      ) : error ? (
        <Card className="p-6 flex items-center gap-3 bg-accent-red/5 border-accent-red/20">
          <AlertCircle className="h-5 w-5 text-accent-red" />
          <p className="text-body-sm text-accent-red">{error}</p>
        </Card>
      ) : results.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-muted">No similar {entityType}s found</p>
          <p className="text-caption text-text-tertiary mt-1">
            This {entityType} may not be indexed for similarity search yet
          </p>
        </Card>
      ) : compact ? (
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border-subtle scrollbar-track-transparent">
            {results.map((entity) => (
              <CompactSimilarityCard
                key={entity.id}
                id={entity.id}
                name={entity.name}
                score={entity.score}
                type={entity.type}
                genres={entity.genres}
                tags={entity.tags}
                reviewPercentage={entity.review_percentage}
                priceCents={entity.price_cents}
                isFree={entity.is_free}
                entityType={entityType}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {results.map((entity) => (
            <SimilarityCard
              key={entity.id}
              id={entity.id}
              name={entity.name}
              score={entity.score}
              type={entity.type}
              genres={entity.genres}
              tags={entity.tags}
              reviewPercentage={entity.review_percentage}
              priceCents={entity.price_cents}
              isFree={entity.is_free}
              gameCount={entity.game_count}
              entityType={entityType}
            />
          ))}
        </div>
      )}
    </section>
  );
}
