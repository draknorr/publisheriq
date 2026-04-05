'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AreaChartComponent, PlatformIcons, TrendSparkline } from '@/components/data-display';
import type {
  ChatHistoryMetric,
  ChatMetricHistorySeries,
  ChatRenderData,
} from '@/lib/chat/chat-render-data';

function formatNumber(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value).toLocaleString()
    : 'n/a';
}

function formatPercent(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`
    : 'n/a';
}

function formatCurrencyCents(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `$${(value / 100).toFixed(2)}`
    : 'n/a';
}

function parseUtcDate(value: string): Date {
  return value.includes('T') ? new Date(value) : new Date(`${value}T00:00:00.000Z`);
}

function formatShortDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(parseUtcDate(value));
}

function formatLongDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
    year: 'numeric',
  }).format(parseUtcDate(value));
}

function historyMetricLabel(metric: ChatHistoryMetric): string {
  switch (metric) {
    case 'ccu_peak':
      return 'Peak CCU';
    case 'discount_percent':
      return 'Discount';
    case 'owners_midpoint':
      return 'Owners';
    case 'positive_percentage':
      return 'Positive %';
    case 'price_cents':
      return 'Price';
    case 'review_score':
      return 'Review %';
    case 'total_reviews':
      return 'Total Reviews';
    default:
      return metric;
  }
}

function historyMetricColor(metric: ChatHistoryMetric): 'amber' | 'coral' | 'green' | 'teal' {
  switch (metric) {
    case 'ccu_peak':
      return 'coral';
    case 'discount_percent':
      return 'amber';
    case 'owners_midpoint':
      return 'teal';
    case 'positive_percentage':
    case 'review_score':
      return 'green';
    case 'price_cents':
      return 'amber';
    case 'total_reviews':
      return 'coral';
    default:
      return 'coral';
  }
}

function formatHistoryValue(metric: ChatHistoryMetric, value: number | null): string {
  if (metric === 'price_cents') {
    return formatCurrencyCents(value);
  }

  if (metric === 'discount_percent' || metric === 'positive_percentage' || metric === 'review_score') {
    return formatPercent(value);
  }

  return formatNumber(value);
}

function MetricHistorySection({
  series,
}: {
  series: ChatMetricHistorySeries;
}): ReactNode {
  const valuedPoints = series.points
    .filter((point): point is { date: string; value: number } => typeof point.value === 'number')
    .map((point) => ({
      date: formatShortDate(point.date),
      value: point.value,
    }));

  if (valuedPoints.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-2xl border border-border-subtle/80 bg-surface-raised/60 p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <p className="text-caption font-medium uppercase tracking-[0.18em] text-text-muted">
            {historyMetricLabel(series.metric)}
          </p>
          <p className="text-body-sm text-text-secondary">
            {formatHistoryValue(series.metric, series.summary.startValue)} to{' '}
            {formatHistoryValue(series.metric, series.summary.latestValue)}
          </p>
        </div>
        <p className="text-caption text-text-muted">
          {series.summary.deltaAbs == null
            ? 'No material change'
            : `${formatHistoryValue(series.metric, series.summary.deltaAbs)}${series.summary.deltaPct == null ? '' : ` · ${formatPercent(series.summary.deltaPct)}`}`}
        </p>
      </div>

      <AreaChartComponent
        className="h-[220px]"
        color={historyMetricColor(series.metric)}
        data={valuedPoints}
        formatTooltip={(value) => formatHistoryValue(series.metric, value)}
        formatXAxis={(value) => String(value)}
        formatYAxis={(value) => formatHistoryValue(series.metric, value)}
        height={220}
        showGrid
        showYAxis={valuedPoints.length > 1}
        xKey="date"
        yKey="value"
      />
    </section>
  );
}

function MetricHistoryVisual({
  renderData,
}: {
  renderData: Extract<ChatRenderData, { kind: 'metric_history' }>;
}): ReactNode {
  const visibleSeries = renderData.series.filter((series) =>
    series.points.some((point) => typeof point.value === 'number')
  );

  if (visibleSeries.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-base/70 p-4">
      <div className="space-y-1">
        <p className="text-caption font-medium uppercase tracking-[0.18em] text-text-muted">Metric History</p>
        <h3 className="text-body font-semibold text-text-primary">{renderData.entityName}</h3>
        <p className="text-caption text-text-muted">
          {formatLongDate(renderData.startDate)} to {formatLongDate(renderData.endDate)}
        </p>
      </div>

      <div className="space-y-3">
        {visibleSeries.map((series) => (
          <MetricHistorySection key={series.metric} series={series} />
        ))}
      </div>
    </div>
  );
}

function MomentumCurrentPlayersVisual({
  renderData,
}: {
  renderData: Extract<ChatRenderData, { kind: 'momentum_current_players' }>;
}): ReactNode {
  if (renderData.rows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border-subtle bg-surface-base/70">
      <div className="overflow-x-auto scrollbar-none">
        <table className="min-w-[700px] w-full table-fixed text-body-sm">
          <colgroup>
            <col className="w-[35%]" />
            <col className="w-[14%]" />
            <col className="w-[27%]" />
            <col className="w-[15%]" />
            <col className="w-[9%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border-subtle/80 bg-surface-raised/70">
              <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-[0.16em] text-text-muted">
                Game
              </th>
              <th className="px-4 py-3 text-right text-caption font-medium uppercase tracking-[0.16em] text-text-muted">
                {renderData.rankingLabel}
              </th>
              <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-[0.16em] text-text-muted">
                Trendline
              </th>
              <th className="px-4 py-3 text-right text-caption font-medium uppercase tracking-[0.16em] text-text-muted">
                Total Reviews
              </th>
              <th className="px-4 py-3 text-left text-caption font-medium uppercase tracking-[0.16em] text-text-muted">
                Platforms
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle/60">
            {renderData.rows.map((row) => (
              <tr key={row.appid} className="align-middle">
                <td className="px-4 py-3 text-text-primary">
                  <Link
                    href={`/apps/${row.appid}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="chat-accent-link font-medium"
                  >
                    {row.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                  {formatNumber(row.ccuPeak)}
                </td>
                <td className="px-2 py-3 text-text-primary">
                  {row.ccuSparkline.length > 1 ? (
                    <TrendSparkline
                      className="h-6 w-full"
                      data={row.ccuSparkline}
                      height={24}
                      trend={row.trendDirection ?? 'stable'}
                      variant="line"
                    />
                  ) : (
                    <span className="text-text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-text-primary">
                  {formatNumber(row.totalReviews)}
                </td>
                <td className="px-4 py-3 text-text-secondary">
                  {row.platformSupport.length > 0 ? (
                    <PlatformIcons
                      className="min-h-4"
                      platforms={row.platformSupport.join(',')}
                      size="md"
                    />
                  ) : 'n/a'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ChatStructuredVisuals({
  renderData,
}: {
  renderData?: ChatRenderData;
}): ReactNode {
  if (!renderData) {
    return null;
  }

  if (renderData.kind === 'metric_history') {
    return <MetricHistoryVisual renderData={renderData} />;
  }

  if (renderData.kind === 'momentum_current_players') {
    return <MomentumCurrentPlayersVisual renderData={renderData} />;
  }

  return null;
}
