'use client';

import { useRef, useEffect } from 'react';
import { TrendSparkline } from '@/components/data-display';

interface SparklineCellProps {
  companyId: number;
  companyType: 'publisher' | 'developer';
  growthPercent: number | null;
  registerRow: (
    id: number,
    type: 'publisher' | 'developer',
    el: HTMLElement | null
  ) => void;
  getSparklineData: (
    id: number,
    type: string
  ) => { dataPoints: number[]; trend: 'up' | 'down' | 'stable' } | null;
  isLoading: (id: number, type: string) => boolean;
}

export function SparklineCell({
  companyId,
  companyType,
  growthPercent,
  registerRow,
  getSparklineData,
  isLoading,
}: SparklineCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerRow(companyId, companyType, cellRef.current);
    return () => registerRow(companyId, companyType, null);
  }, [companyId, companyType, registerRow]);

  const sparklineData = getSparklineData(companyId, companyType);
  const loading = isLoading(companyId, companyType);

  // Determine trend from growth percent (fallback if no sparkline data)
  const trend =
    sparklineData?.trend ??
    (growthPercent === null
      ? 'stable'
      : growthPercent > 5
        ? 'up'
        : growthPercent < -5
          ? 'down'
          : 'stable');

  if (loading) {
    return (
      <div
        ref={cellRef}
        className="w-[70px] h-[24px] bg-surface-overlay animate-pulse rounded"
      />
    );
  }

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
