'use client';

import Link from 'next/link';
import { Gamepad2, Building2, Code } from 'lucide-react';

interface PinnedEntity {
  pin_id: string;
  entity_type: 'game' | 'publisher' | 'developer';
  entity_id: number;
  display_name: string;
  pin_order: number;
  pinned_at: string;
  // Game-specific metrics
  ccu_current: number | null;
  ccu_change_pct: number | null;
  total_reviews: number | null;
  positive_pct: number | null;
  review_velocity: number | null;
  trend_direction: string | null;
  price_cents: number | null;
  discount_percent: number | null;
}

interface PinnedCardProps {
  pin: PinnedEntity;
}

function formatNumber(value: number | null): string {
  if (value === null) return '-';
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toLocaleString();
}

function formatPrice(cents: number | null): string {
  if (cents === null) return '-';
  if (cents === 0) return 'Free';
  return `$${(cents / 100).toFixed(2)}`;
}

function getEntityIcon(entityType: string) {
  switch (entityType) {
    case 'game':
      return <Gamepad2 className="h-3.5 w-3.5" />;
    case 'publisher':
      return <Building2 className="h-3.5 w-3.5" />;
    case 'developer':
      return <Code className="h-3.5 w-3.5" />;
    default:
      return null;
  }
}

function getEntityHref(entityType: string, entityId: number): string {
  switch (entityType) {
    case 'game':
      return `/apps/${entityId}`;
    case 'publisher':
      return `/publishers/${entityId}`;
    case 'developer':
      return `/developers/${entityId}`;
    default:
      return '#';
  }
}

function getEntityBadgeStyles(entityType: string): string {
  switch (entityType) {
    case 'game':
      return 'bg-accent-cyan/15 text-accent-cyan';
    case 'publisher':
      return 'bg-accent-purple/15 text-accent-purple';
    case 'developer':
      return 'bg-accent-blue/15 text-accent-blue';
    default:
      return 'bg-surface-overlay text-text-secondary';
  }
}

function getReviewColor(percent: number | null): string {
  if (percent === null) return 'text-text-muted';
  if (percent >= 80) return 'text-accent-green';
  if (percent >= 70) return 'text-lime-400';
  if (percent >= 50) return 'text-accent-yellow';
  return 'text-accent-red';
}

export function PinnedCard({ pin }: PinnedCardProps) {
  const href = getEntityHref(pin.entity_type, pin.entity_id);
  const isGame = pin.entity_type === 'game';

  return (
    <Link
      href={href}
      className="block p-4 rounded-lg bg-surface-elevated border border-border-subtle hover:border-accent-blue/50 transition-colors"
    >
      {/* Header: Name + Type Badge */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <h3 className="font-medium text-text-primary line-clamp-2 text-body-sm leading-tight">
          {pin.display_name}
        </h3>
        <span
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-caption font-medium flex-shrink-0 ${getEntityBadgeStyles(pin.entity_type)}`}
        >
          {getEntityIcon(pin.entity_type)}
          {pin.entity_type.charAt(0).toUpperCase() + pin.entity_type.slice(1)}
        </span>
      </div>

      {/* Metrics (games only for now) */}
      {isGame && (
        <div className="space-y-2 text-body-sm">
          {/* CCU Row */}
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">CCU</span>
            <span className="text-text-primary font-medium">
              {formatNumber(pin.ccu_current)}
              {pin.ccu_change_pct !== null && (
                <span
                  className={`ml-1.5 text-caption ${pin.ccu_change_pct >= 0 ? 'text-accent-green' : 'text-accent-red'}`}
                >
                  {pin.ccu_change_pct >= 0 ? '+' : ''}
                  {pin.ccu_change_pct.toFixed(1)}%
                </span>
              )}
            </span>
          </div>

          {/* Reviews Row */}
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Reviews</span>
            <span className="text-text-primary">
              {formatNumber(pin.total_reviews)}
              {pin.positive_pct !== null && (
                <span className={`ml-1.5 ${getReviewColor(pin.positive_pct)}`}>
                  ({pin.positive_pct.toFixed(0)}%)
                </span>
              )}
            </span>
          </div>

          {/* Price Row */}
          <div className="flex justify-between items-center">
            <span className="text-text-secondary">Price</span>
            <span className="text-text-primary">
              {formatPrice(pin.price_cents)}
              {pin.discount_percent !== null && pin.discount_percent > 0 && (
                <span className="ml-1.5 text-accent-green text-caption font-medium">
                  -{pin.discount_percent}%
                </span>
              )}
            </span>
          </div>

          {/* Trend indicator */}
          {pin.trend_direction && (
            <div className="flex justify-between items-center pt-1 border-t border-border-subtle">
              <span className="text-text-secondary">Trend</span>
              <span
                className={`text-caption font-medium ${
                  pin.trend_direction === 'up'
                    ? 'text-accent-green'
                    : pin.trend_direction === 'down'
                      ? 'text-accent-red'
                      : 'text-text-muted'
                }`}
              >
                {pin.trend_direction === 'up'
                  ? 'Trending Up'
                  : pin.trend_direction === 'down'
                    ? 'Trending Down'
                    : 'Stable'}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Publisher/Developer placeholder - just show entity type for now */}
      {!isGame && (
        <div className="text-body-sm text-text-muted">
          View details
        </div>
      )}
    </Link>
  );
}
