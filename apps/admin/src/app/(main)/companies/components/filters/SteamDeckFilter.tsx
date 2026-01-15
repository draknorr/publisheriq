'use client';

import type { SteamDeckFilterValue } from '../../lib/companies-types';

interface SteamDeckFilterProps {
  value: SteamDeckFilterValue;
  onChange: (value: SteamDeckFilterValue) => void;
  disabled?: boolean;
}

const OPTIONS: { id: SteamDeckFilterValue; label: string; description: string }[] = [
  { id: null, label: 'Any', description: 'No Steam Deck filter' },
  { id: 'verified', label: 'Verified', description: 'Has games with Verified status' },
  { id: 'playable', label: 'Playable', description: 'Has games with Verified or Playable status' },
];

/**
 * Radio buttons for filtering by Steam Deck compatibility
 */
export function SteamDeckFilter({ value, onChange, disabled = false }: SteamDeckFilterProps) {
  return (
    <div className="space-y-2">
      <label className="block text-body-sm font-medium text-text-secondary">Steam Deck</label>
      <div className="flex gap-2">
        {OPTIONS.map((option) => (
          <button
            key={option.id ?? 'any'}
            type="button"
            onClick={() => onChange(option.id)}
            disabled={disabled}
            title={option.description}
            className={`px-3 py-1.5 rounded text-body-sm transition-colors ${
              value === option.id
                ? 'bg-accent-primary/20 text-accent-primary border border-accent-primary/40'
                : 'bg-surface-elevated text-text-secondary border border-border-subtle hover:border-border-prominent'
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
