'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { AreaChartComponent, PlatformIcons, TrendSparkline } from '@/components/data-display';
import type {
  ChatEntityClarificationCandidate,
  ChatHistoryMetric,
  ChatMetricHistorySeries,
  ChatRenderData,
} from '@/lib/chat/chat-render-data';
import type { ChatRequestOptions } from '@/lib/llm/types';

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

function formatCompactNumber(value: number | null): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 'n/a';
  }

  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: value >= 1000 ? 1 : 0,
    notation: value >= 1000 ? 'compact' : 'standard',
  }).format(value);
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

function clarificationTierLabel(candidate: ChatEntityClarificationCandidate): string {
  switch (candidate.resolutionTier) {
    case 'platform_id_exact':
      return 'Exact ID';
    case 'canonical_exact':
      return 'Exact title';
    case 'alias_exact':
      return 'Exact alias';
    case 'normalized_exact':
      return 'Normalized exact';
    case 'canonical_prefix':
    case 'alias_prefix':
    case 'legacy_prefix':
      return 'Prefix match';
    case 'canonical_substring':
    case 'alias_substring':
    case 'legacy_substring':
      return 'Substring match';
    case 'legacy_exact':
      return 'Exact title';
    case 'fuzzy':
    default:
      return candidate.matchQuality === 'fuzzy' ? 'Fuzzy match' : 'Possible match';
  }
}

function ClarificationSlotVisual({
  onSuggestionClick,
  originalPrompt,
  slot,
}: {
  onSuggestionClick?: (query: string, requestOptions?: ChatRequestOptions) => void;
  originalPrompt: string;
  slot: Extract<ChatRenderData, { kind: 'entity_clarification' }>['slots'][number];
}): ReactNode {
  return (
    <section className="space-y-3 rounded-2xl border border-border-subtle/80 bg-surface-raised/60 p-4">
      <div className="space-y-1">
        <p className="text-caption font-medium uppercase tracking-[0.18em] text-text-muted">
          {slot.label}
        </p>
        <p className="text-body-sm text-text-secondary">
          {slot.totalCandidates && slot.totalCandidates > slot.candidates.length
            ? `Showing ${slot.candidates.length} of ${slot.totalCandidates} matches for ${slot.query}`
            : `Choose the correct match for ${slot.query}`}
        </p>
      </div>

      <div className="space-y-2">
        {slot.candidates.map((candidate) => (
          <button
            key={`${slot.slotId}-${candidate.entityUid}`}
            type="button"
            onClick={() => onSuggestionClick?.(originalPrompt, {
              selectedEntities: [candidate.selectedEntity],
            })}
            className="w-full rounded-2xl border border-border-subtle bg-surface-base/80 px-4 py-3 text-left transition-colors hover:border-border-muted hover:bg-surface-elevated"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex min-w-7 items-center justify-center rounded-full bg-surface-elevated px-2 py-0.5 text-caption font-semibold text-text-secondary">
                    {candidate.ordinal}
                  </span>
                  <span className="text-body font-medium text-text-primary">
                    {candidate.displayName}
                  </span>
                  <span className="text-caption uppercase tracking-[0.14em] text-text-muted">
                    {candidate.entityKind}
                  </span>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-caption text-text-muted">
                  <span>{clarificationTierLabel(candidate)}</span>
                  {typeof candidate.releaseYear === 'number' && <span>{candidate.releaseYear}</span>}
                  <span>ID {candidate.platformEntityId}</span>
                  {candidate.totalReviews != null && (
                    <span>{formatCompactNumber(candidate.totalReviews)} reviews</span>
                  )}
                </div>
              </div>
              <span className="text-caption font-medium text-text-secondary">
                Select
              </span>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

function EntityClarificationVisual({
  onSuggestionClick,
  renderData,
}: {
  onSuggestionClick?: (query: string, requestOptions?: ChatRequestOptions) => void;
  renderData: Extract<ChatRenderData, { kind: 'entity_clarification' }>;
}): ReactNode {
  if (renderData.slots.length === 0 || !onSuggestionClick) {
    return null;
  }

  return (
    <div className="space-y-4 rounded-2xl border border-border-subtle bg-surface-base/70 p-4">
      <div className="space-y-1">
        <p className="text-caption font-medium uppercase tracking-[0.18em] text-text-muted">
          Select The Exact Match
        </p>
        <p className="text-body-sm text-text-secondary">
          Chat could not safely choose a single title. Pick the exact game below.
        </p>
      </div>

      <div className="space-y-3">
        {renderData.slots.map((slot) => (
          <ClarificationSlotVisual
            key={slot.slotId}
            onSuggestionClick={onSuggestionClick}
            originalPrompt={renderData.originalPrompt}
            slot={slot}
          />
        ))}
      </div>
    </div>
  );
}

export function ChatStructuredVisuals({
  onSuggestionClick,
  renderData,
}: {
  onSuggestionClick?: (query: string, requestOptions?: ChatRequestOptions) => void;
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

  if (renderData.kind === 'entity_clarification') {
    return (
      <EntityClarificationVisual
        onSuggestionClick={onSuggestionClick}
        renderData={renderData}
      />
    );
  }

  return null;
}
