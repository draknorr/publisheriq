'use client';

import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { TimeRangeSelector } from './components/TimeRangeSelector';
import { TopGamesTab } from './components/TopGamesTab';
import { NewestGamesTab } from './components/NewestGamesTab';
import { TrendingGamesTab } from './components/TrendingGamesTab';
import { MyDashboardTab } from './components/MyDashboardTab';
import { InsightsSkeleton } from './components/InsightsSkeleton';
import type { GameInsight, TimeRange, InsightsTab, NewestSortMode } from './lib/insights-types';

interface InsightsTabsProps {
  initialData: {
    topGames: GameInsight[];
    newestGames: GameInsight[];
    trendingGames: GameInsight[];
  };
  initialTimeRange: TimeRange;
  initialTab: InsightsTab;
  initialNewestSort: NewestSortMode;
}

export function InsightsTabs({
  initialData,
  initialTimeRange,
  initialTab,
  initialNewestSort,
}: InsightsTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state (synced with URL)
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange);
  const [activeTab, setActiveTab] = useState<InsightsTab>(initialTab);
  const [newestSort, setNewestSort] = useState<NewestSortMode>(initialNewestSort);

  const updateUrl = (
    newTimeRange: TimeRange,
    newTab: InsightsTab,
    newSort?: NewestSortMode
  ) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('timeRange', newTimeRange);
    params.set('tab', newTab);

    // Only include sort param when on newest tab
    if (newTab === 'newest' && newSort) {
      params.set('sort', newSort);
    } else {
      params.delete('sort');
    }

    startTransition(() => {
      router.push(`/insights?${params.toString()}`);
    });
  };

  const handleTimeRangeChange = (newRange: TimeRange) => {
    setTimeRange(newRange);
    updateUrl(newRange, activeTab, activeTab === 'newest' ? newestSort : undefined);
  };

  const handleTabChange = (tab: string) => {
    const newTab = tab as InsightsTab;
    setActiveTab(newTab);
    updateUrl(timeRange, newTab, newTab === 'newest' ? newestSort : undefined);
  };

  const handleNewestSortChange = (sort: NewestSortMode) => {
    setNewestSort(sort);
    updateUrl(timeRange, activeTab, sort);
  };

  return (
    <div className="space-y-6">
      {/* Controls Row */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange}>
          <TabsList>
            <TabsTrigger value="dashboard">My Dashboard</TabsTrigger>
            <TabsTrigger value="top">Top Games</TabsTrigger>
            <TabsTrigger value="newest">Newest</TabsTrigger>
            <TabsTrigger value="trending">Trending</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Time Range + Loading Indicator (hidden on dashboard tab) */}
        {activeTab !== 'dashboard' && (
          <div className="flex items-center gap-3">
            {isPending && (
              <span className="text-caption text-text-muted animate-pulse">Updating...</span>
            )}
            <TimeRangeSelector
              value={timeRange}
              onChange={handleTimeRangeChange}
              disabled={isPending}
            />
          </div>
        )}
      </div>

      {/* Tab Content */}
      <div className={isPending && activeTab !== 'dashboard' ? 'opacity-60 pointer-events-none' : ''}>
        {activeTab === 'dashboard' && <MyDashboardTab />}
        {activeTab === 'top' &&
          (isPending ? (
            <InsightsSkeleton />
          ) : (
            <TopGamesTab games={initialData.topGames} timeRange={timeRange} />
          ))}
        {activeTab === 'newest' &&
          (isPending ? (
            <InsightsSkeleton />
          ) : (
            <NewestGamesTab
              games={initialData.newestGames}
              timeRange={timeRange}
              sortBy={newestSort}
              onSortChange={handleNewestSortChange}
            />
          ))}
        {activeTab === 'trending' &&
          (isPending ? (
            <InsightsSkeleton />
          ) : (
            <TrendingGamesTab games={initialData.trendingGames} timeRange={timeRange} />
          ))}
      </div>
    </div>
  );
}
