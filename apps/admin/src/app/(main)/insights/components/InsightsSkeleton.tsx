'use client';

import { Card } from '@/components/ui';

function SkeletonPulse({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse bg-surface-overlay rounded ${className}`} />
  );
}

export function InsightsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Summary Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i} padding="md">
            <div className="flex items-center gap-3">
              <SkeletonPulse className="w-10 h-10 rounded-lg" />
              <div className="space-y-2">
                <SkeletonPulse className="w-16 h-3" />
                <SkeletonPulse className="w-24 h-6" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Games List Skeleton */}
      <Card padding="none">
        <div className="px-4 pt-4 pb-2">
          <SkeletonPulse className="w-48 h-6" />
        </div>
        <div className="p-4 space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <GameCardSkeleton key={i} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function GameCardSkeleton() {
  return (
    <Card variant="default" padding="md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3 flex-1">
          {/* Rank */}
          <SkeletonPulse className="w-8 h-8 rounded-lg" />

          {/* Game Info */}
          <div className="flex-1 space-y-2">
            <SkeletonPulse className="w-48 h-5" />
            <div className="flex items-center gap-3">
              <SkeletonPulse className="w-20 h-4" />
              <SkeletonPulse className="w-16 h-4" />
            </div>
          </div>
        </div>

        {/* Tier Badge */}
        <SkeletonPulse className="w-14 h-5 rounded" />
      </div>
    </Card>
  );
}

/**
 * Inline skeleton for the tabs area
 */
export function TabsSkeleton() {
  return (
    <div className="flex items-center gap-1 p-1 bg-surface-elevated rounded-lg border border-border-subtle">
      <SkeletonPulse className="w-24 h-8 rounded-md" />
      <SkeletonPulse className="w-20 h-8 rounded-md" />
      <SkeletonPulse className="w-24 h-8 rounded-md" />
    </div>
  );
}
