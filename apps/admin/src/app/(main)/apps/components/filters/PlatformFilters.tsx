'use client';

import { useCallback } from 'react';
import type { FilterMode } from './GenreTagFilter';

type Platform = 'windows' | 'macos' | 'linux';
type SteamDeckValue = 'verified' | 'playable' | 'unsupported' | undefined;
type ControllerValue = 'full' | 'partial' | undefined;

interface PlatformFiltersProps {
  platforms: Platform[];
  platformMode: FilterMode;
  onPlatformsChange: (platforms: Platform[]) => void;
  onPlatformModeChange: (mode: FilterMode) => void;

  steamDeck: SteamDeckValue;
  onSteamDeckChange: (value: SteamDeckValue) => void;

  controller: ControllerValue;
  onControllerChange: (value: ControllerValue) => void;

  disabled?: boolean;
}

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: 'windows', label: 'Windows' },
  { value: 'macos', label: 'Mac' },
  { value: 'linux', label: 'Linux' },
];

const STEAM_DECK_OPTIONS: { value: SteamDeckValue; label: string }[] = [
  { value: undefined, label: 'Any' },
  { value: 'verified', label: 'Verified' },
  { value: 'playable', label: 'Playable' },
  { value: 'unsupported', label: 'Unsupported' },
];

const CONTROLLER_OPTIONS: { value: ControllerValue; label: string }[] = [
  { value: undefined, label: 'Any' },
  { value: 'full', label: 'Full Support' },
  { value: 'partial', label: 'Partial' },
];

/**
 * Platform filters: Platforms, Steam Deck, Controller Support
 */
export function PlatformFilters({
  platforms,
  platformMode,
  onPlatformsChange,
  onPlatformModeChange,
  steamDeck,
  onSteamDeckChange,
  controller,
  onControllerChange,
  disabled = false,
}: PlatformFiltersProps) {
  const handlePlatformToggle = useCallback(
    (platform: Platform) => {
      if (platforms.includes(platform)) {
        onPlatformsChange(platforms.filter((p) => p !== platform));
      } else {
        onPlatformsChange([...platforms, platform]);
      }
    },
    [platforms, onPlatformsChange]
  );

  return (
    <div className="space-y-4">
      {/* Platforms checkboxes */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-body-sm font-medium text-text-secondary">Platforms</label>
          {platforms.length > 0 && (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => onPlatformModeChange('any')}
                disabled={disabled}
                className={`px-2 py-0.5 text-caption rounded transition-colors ${
                  platformMode === 'any'
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
                }`}
              >
                Any
              </button>
              <button
                type="button"
                onClick={() => onPlatformModeChange('all')}
                disabled={disabled}
                className={`px-2 py-0.5 text-caption rounded transition-colors ${
                  platformMode === 'all'
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
                }`}
              >
                All
              </button>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ value, label }) => {
            const isSelected = platforms.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => handlePlatformToggle(value)}
                disabled={disabled}
                className={`px-3 py-1.5 rounded-md text-body-sm transition-colors ${
                  isSelected
                    ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/30'
                    : 'bg-surface-elevated text-text-secondary border border-border-muted hover:border-border-prominent'
                } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Steam Deck filter */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-text-secondary">Steam Deck</label>
        <div className="flex flex-wrap gap-1">
          {STEAM_DECK_OPTIONS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => onSteamDeckChange(value)}
              disabled={disabled}
              className={`px-2.5 py-1 text-caption rounded transition-colors ${
                steamDeck === value
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Controller support filter */}
      <div className="space-y-2">
        <label className="text-body-sm font-medium text-text-secondary">Controller</label>
        <div className="flex flex-wrap gap-1">
          {CONTROLLER_OPTIONS.map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => onControllerChange(value)}
              disabled={disabled}
              className={`px-2.5 py-1 text-caption rounded transition-colors ${
                controller === value
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
