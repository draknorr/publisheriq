'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TopGamesTab } from './components/TopGamesTab';
import { NewestGamesTab } from './components/NewestGamesTab';
import { TrendingGamesTab } from './components/TrendingGamesTab';
import { InsightsSkeleton } from './components/InsightsSkeleton';
import type { GameInsight, TimeRange, InsightsTab } from './lib/insights-types';

interface InsightsTabsProps {
  initialData: {
    topGames: GameInsight[];
    newestGames: GameInsight[];
    trendingGames: GameInsight[];
  };
  initialTimeRange: TimeRange;
  initialTab: InsightsTab;
}

export function InsightsTabs({
  initialData,
  initialTimeRange,
  initialTab,
}: InsightsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state (synced with URL)
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [activeTab, setActiveTab] = useState<InsightsTab>(initialTab);

  const updateUrl = (newTimeRange: TimeRange, newTab: InsightsTab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('timeRange', newTimeRange);
    params.set('tab', newTab);
    startTransition(() => {
      router.push(`/insights?${params.toString()}`);
    });
  };

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
    updateUrl(newRange, activeTab);
  };

  const handleTabChange = (tab: string) => {
    const newTab = tab as InsightsTab;
    setActiveTab(newTab);
    updateUrl(timeRange, newTab);
  };

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="top">Top Games</TabsTrigger>
            <TabsTrigger value="newest">Newest</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Time Range + Loading Indicator */}
        <div className="flex items-center gap-3">
          {isPending && (
            <span className="text-caption text-text-muted animate-pulse">
              Updating...
            </span>
          )}
          <TimeRangeSelector
            value={timeRange}
            onChange={handleTimeRangeChange}
            disabled={isPending}
          />
        </div>
      </div>

      {/* Tab Content */}
      <div className={isPending ? 'opacity-60 pointer-events-none' : ''}>
        {activeTab === 'top' && (
          isPending ? <InsightsSkeleton /> : <TopGamesTab games={initialData.topGames} />
        )}
        {activeTab === 'newest' && (
          isPending ? <InsightsSkeleton /> : <NewestGamesTab games={initialData.newestGames} />
        )}
        {activeTab === 'trending' && (
          isPending ? <InsightsSkeleton /> : <TrendingGamesTab games={initialData.trendingGames} />
        )}
      </div>
    </div>
  );
}
