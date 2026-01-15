'use client';

import type { PlatformValue, FilterMode } from '../../lib/companies-types';

interface PlatformFilterProps {
  selected: PlatformValue[];
  mode: FilterMode;
  onSelect: (platforms: PlatformValue[]) => void;
  onModeChange: (mode: FilterMode) => void;
  disabled?: boolean;
}

const PLATFORMS: { id: PlatformValue; label: string }[] = [
  { id: 'windows', label: 'Windows' },
  { id: 'mac', label: 'macOS' },
  { id: 'linux', label: 'Linux' },
];

/**
 * Platform checkboxes (Windows, Mac, Linux) with mode toggle
 */
export function PlatformFilter({
  selected,
  mode,
  onSelect,
  onModeChange,
  disabled = false,
}: PlatformFilterProps) {
  const handleToggle = (platform: PlatformValue) => {
    if (selected.includes(platform)) {
      onSelect(selected.filter((p) => p !== platform));
    } else {
      onSelect([...selected, platform]);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-body-sm font-medium text-text-secondary">Platforms</label>
        {selected.length > 1 && (
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => onModeChange('any')}
              disabled={disabled}
              className={`px-2 py-0.5 text-caption rounded transition-colors ${
                mode === 'any'
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              }`}
            >
              Any
            </button>
            <button
              type="button"
              onClick={() => onModeChange('all')}
              disabled={disabled}
              className={`px-2 py-0.5 text-caption rounded transition-colors ${
                mode === 'all'
                  ? 'bg-accent-primary/20 text-accent-primary'
                  : 'bg-surface-elevated text-text-muted hover:text-text-secondary'
              }`}
            >
              All
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        {PLATFORMS.map((platform) => {
          const isChecked = selected.includes(platform.id);
          return (
            <label
              key={platform.id}
              className={`flex items-center gap-2 px-3 py-2 rounded border cursor-pointer transition-colors ${
                isChecked
                  ? 'border-accent-primary bg-accent-primary/10 text-text-primary'
                  : 'border-border-muted bg-surface-elevated text-text-secondary hover:border-border-prominent'
              } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(platform.id)}
                disabled={disabled}
                className="sr-only"
              />
              <span className="text-body-sm">{platform.label}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
