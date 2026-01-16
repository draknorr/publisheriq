'use client';

import { Search } from 'lucide-react';
import type { PublisherSize } from '../../lib/apps-types';

interface RelationshipFiltersProps {
  publisherSearch: string | undefined;
  developerSearch: string | undefined;
  selfPublished: boolean | undefined;
  publisherSize: PublisherSize | undefined;
  minVsPublisher: number | undefined;

  onPublisherSearchChange: (value: string | undefined) => void;
  onDeveloperSearchChange: (value: string | undefined) => void;
  onSelfPublishedChange: (value: boolean | undefined) => void;
  onPublisherSizeChange: (value: PublisherSize | undefined) => void;
  onVsPublisherChange: (value: number | undefined) => void;

  disabled?: boolean;
}

const SIZE_OPTIONS: { value: PublisherSize | undefined; label: string; description: string }[] = [
  { value: undefined, label: 'Any', description: 'All sizes' },
  { value: 'indie', label: 'Indie', description: '<5 games' },
  { value: 'mid', label: 'Mid', description: '5-20 games' },
  { value: 'major', label: 'Major', description: '20+ games' },
];

const VS_PUBLISHER_PRESETS = [
  { label: 'Above +5', value: 5 },
  { label: 'Top +10', value: 10 },
  { label: 'Below -5', value: -5 },
];

/**
 * Relationship filters: Publisher/Developer search, Self-published, Publisher Size, vs Publisher Avg
 */
export function RelationshipFilters({
  publisherSearch,
  developerSearch,
  selfPublished,
  publisherSize,
  minVsPublisher,
  onPublisherSearchChange,
  onDeveloperSearchChange,
  onSelfPublishedChange,
  onPublisherSizeChange,
  onVsPublisherChange,
  disabled = false,
}: RelationshipFiltersProps) {
  return (
    <div className="space-y-4">
      {/* Publisher/Developer search */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-body-sm font-medium text-text-secondary">Publisher</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={publisherSearch ?? ''}
              onChange={(e) => onPublisherSearchChange(e.target.value || undefined)}
              placeholder="Search publisher..."
              disabled={disabled}
              className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-elevated border border-border-muted text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary disabled:opacity-50"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-body-sm font-medium text-text-secondary">Developer</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-text-muted" />
            <input
              type="text"
              value={developerSearch ?? ''}
              onChange={(e) => onDeveloperSearchChange(e.target.value || undefined)}
              placeholder="Search developer..."
              disabled={disabled}
              className="w-full h-9 pl-8 pr-3 rounded-md bg-surface-elevated border border-border-muted text-body-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent-primary disabled:opacity-50"
            />
          </div>
        </div>
      </div>

      {/* Self-published toggle */}
      <div className="flex items-center gap-3">
        <label className="text-body-sm font-medium text-text-secondary">Self-Published</label>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onSelfPublishedChange(undefined)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              selfPublished === undefined
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Any
          </button>
          <button
            type="button"
            onClick={() => onSelfPublishedChange(true)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              selfPublished === true
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Self-Published
          </button>
          <button
            type="button"
            onClick={() => onSelfPublishedChange(false)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              selfPublished === false
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            External Publisher
          </button>
        </div>
      </div>

      {/* Publisher Size */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-text-secondary">Publisher Size</label>
        <div className="flex flex-wrap gap-1">
          {SIZE_OPTIONS.map(({ value, label, description }) => (
            <button
              key={label}
              type="button"
              onClick={() => onPublisherSizeChange(value)}
              disabled={disabled}
              title={description}
              className={`px-2.5 py-1 text-caption rounded transition-colors ${
                publisherSize === value
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* vs Publisher Average */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-text-secondary">vs Publisher Avg</label>
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onVsPublisherChange(undefined)}
            disabled={disabled}
            className={`px-2.5 py-1 text-caption rounded transition-colors ${
              minVsPublisher === undefined
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            Any
          </button>
          {VS_PUBLISHER_PRESETS.map(({ label, value }) => (
            <button
              key={label}
              type="button"
              onClick={() => onVsPublisherChange(value)}
              disabled={disabled}
              className={`px-2.5 py-1 text-caption rounded transition-colors ${
                minVsPublisher === value
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-caption text-text-muted">Points above/below publisher&apos;s average score</p>
      </div>
    </div>
  );
}
