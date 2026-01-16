'use client';

import { useRef, useEffect } from 'react';
import { TrendSparkline } from '@/components/data-display/Sparkline';
import type { SparklineData } from '../../hooks/useSparklineLoader';

interface SparklineCellProps {
  appid: number;
  growthPercent: number | null; // Fallback for trend if sparkline data not loaded
  registerRow: (appid: number, element: HTMLElement | null) => void;
  getSparklineData: (appid: number) => SparklineData | null;
  isLoading: (appid: number) => boolean;
}

/**
 * Table cell that displays a lazy-loaded CCU sparkline
 * Uses IntersectionObserver to load data when visible
 */
export function SparklineCell({
  appid,
  growthPercent,
  registerRow,
  getSparklineData,
  isLoading,
}: SparklineCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);

  // Register/unregister element with the sparkline loader
  useEffect(() => {
    registerRow(appid, cellRef.current);
    return () => registerRow(appid, null);
  }, [appid, registerRow]);

  const sparklineData = getSparklineData(appid);
  const loading = isLoading(appid);

  // Determine trend from sparkline data, or fall back to growth percent
  const trend =
    sparklineData?.trend ??
    (growthPercent === null
      ? 'stable'
      : growthPercent > 5
        ? 'up'
        : growthPercent < -5
          ? 'down'
          : 'stable');

  // Loading state: skeleton
  if (loading) {
    return (
      <div
        ref={cellRef}
        className="w-[70px] h-[24px] bg-surface-overlay animate-pulse rounded"
      />
    );
  }

  // No data state: em-dash
  if (!sparklineData || sparklineData.dataPoints.length === 0) {
    return (
      <div
        ref={cellRef}
        className="w-[70px] h-[24px] flex items-center justify-center"
      >
        <span className="text-text-muted text-caption">&mdash;</span>
      </div>
    );
  }

  // Loaded state: sparkline visualization
  return (
    <div ref={cellRef}>
      <TrendSparkline
        data={sparklineData.dataPoints}
        trend={trend}
        height={24}
        width={70}
      />
    </div>
  );
}
