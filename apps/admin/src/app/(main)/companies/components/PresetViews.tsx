'use client';

import { PRESETS } from '../lib/companies-presets';

interface PresetViewsProps {
  activePreset: string | null;
  onSelectPreset: (presetId: string) => void;
  onClearPreset: () => void;
  disabled?: boolean;
}

export function PresetViews({
  activePreset,
  onSelectPreset,
  onClearPreset,
  disabled = false,
}: PresetViewsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-body-sm text-text-muted font-medium">Presets:</span>
      {PRESETS.map((preset) => {
        const isActive = activePreset === preset.id;

        return (
          <button
            key={preset.id}
            onClick={() => (isActive ? onClearPreset() : onSelectPreset(preset.id))}
            disabled={disabled}
            title={preset.description}
            className={`
              px-3 py-1.5 rounded-md text-body-sm font-medium transition-all
              ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              ${
                isActive
                  ? 'bg-accent-secondary/20 text-accent-secondary border border-accent-secondary/40 shadow-sm'
                  : 'bg-surface-elevated text-text-secondary hover:text-text-primary hover:bg-surface-overlay border border-border-subtle'
              }
            `}
          >
            {preset.emoji && <span className="mr-1">{preset.emoji}</span>}
            {preset.label}
          </button>
        );
      })}

      {activePreset && (
        <button
          onClick={onClearPreset}
          disabled={disabled}
          className="px-2 py-1 text-body-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Clear preset
        </button>
      )}
    </div>
  );
}
