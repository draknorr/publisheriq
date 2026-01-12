'use client';

import { useEffect, useState, useTransition } from 'react';
import { ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  type AlertType,
  type PinAlertSettingsResponse,
  type InheritablePreferenceKey,
  ALERT_TYPE_LABELS,
  DEFAULT_PIN_SETTINGS,
} from '@/types/alerts';

interface PinAlertSettingsPanelProps {
  pinId: string;
  isExpanded: boolean;
  onToggle: () => void;
}

const ALERT_TYPES: AlertType[] = [
  'ccu_spike',
  'ccu_drop',
  'trend_reversal',
  'review_surge',
  'sentiment_shift',
  'price_change',
  'new_release',
  'milestone',
];

const SENSITIVITY_LABELS: Record<string, string> = {
  ccu_sensitivity: 'CCU',
  review_sensitivity: 'Reviews',
  sentiment_sensitivity: 'Sentiment',
};

export function PinAlertSettingsPanel({
  pinId,
  isExpanded,
  onToggle,
}: PinAlertSettingsPanelProps) {
  const [data, setData] = useState<PinAlertSettingsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch settings when expanded
  useEffect(() => {
    if (!isExpanded) return;

    const fetchSettings = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/pins/${pinId}/alert-settings`);
        if (!res.ok) {
          throw new Error('Failed to fetch settings');
        }
        const responseData = await res.json();
        setData(responseData);
        setHasChanges(false);
      } catch (err) {
        console.error('Error fetching pin settings:', err);
        setError('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [isExpanded, pinId]);

  const handleSave = () => {
    if (!data) return;

    startTransition(async () => {
      try {
        const res = await fetch(`/api/pins/${pinId}/alert-settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data.settings),
        });

        if (!res.ok) {
          throw new Error('Failed to save settings');
        }

        const responseData = await res.json();
        setData(responseData);
        setHasChanges(false);
      } catch (err) {
        console.error('Error saving pin settings:', err);
        setError('Failed to save settings');
      }
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/pins/${pinId}/alert-settings`, {
          method: 'DELETE',
        });

        if (!res.ok) {
          throw new Error('Failed to reset settings');
        }

        // Refetch to get global defaults
        const fetchRes = await fetch(`/api/pins/${pinId}/alert-settings`);
        if (fetchRes.ok) {
          const responseData = await fetchRes.json();
          setData(responseData);
        }
        setHasChanges(false);
      } catch (err) {
        console.error('Error resetting pin settings:', err);
        setError('Failed to reset settings');
      }
    });
  };

  const updateSetting = (key: string, value: boolean | number | null) => {
    if (!data) return;

    setData({
      ...data,
      settings: {
        ...(data.settings ?? DEFAULT_PIN_SETTINGS),
        [key]: value,
      },
    });
    setHasChanges(true);
  };

  const settings = data?.settings ?? DEFAULT_PIN_SETTINGS;
  const inherited = data?.inherited;
  const useCustom = settings?.use_custom_settings ?? false;

  return (
    <div className="border-t border-border-subtle">
      {/* Collapsed header */}
      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle();
        }}
        className="w-full flex items-center justify-between px-4 py-2 text-caption text-text-muted hover:text-text-secondary hover:bg-surface-overlay transition-colors"
      >
        <span>Alert Settings</span>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4" />
        ) : (
          <ChevronDown className="h-4 w-4" />
        )}
      </button>

      {/* Expanded content */}
      <div
        className={`overflow-hidden transition-all duration-200 ${
          isExpanded ? 'max-h-[600px] opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className="px-4 pb-4 space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 bg-surface-overlay rounded animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <p className="text-caption text-accent-red">{error}</p>
          ) : (
            <>
              {/* Use Custom Settings Toggle */}
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-body-sm text-text-primary">
                    Use custom settings
                  </p>
                  <p className="text-caption text-text-muted">
                    Override global preferences for this item
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useCustom}
                    onChange={(e) =>
                      updateSetting('use_custom_settings', e.target.checked)
                    }
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-surface-overlay peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary"></div>
                </label>
              </div>

              {/* Custom settings content */}
              <div
                className={`space-y-4 ${
                  useCustom ? '' : 'opacity-40 pointer-events-none'
                }`}
              >
                {/* Per-pin alerts enabled */}
                <div className="flex items-center justify-between py-1">
                  <p className="text-body-sm text-text-primary">
                    Enable alerts for this item
                  </p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings?.alerts_enabled ?? true}
                      onChange={(e) =>
                        updateSetting('alerts_enabled', e.target.checked)
                      }
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-surface-overlay peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-accent-primary"></div>
                  </label>
                </div>

                {/* Alert Types */}
                <div>
                  <h4 className="text-caption font-medium text-text-secondary mb-2">
                    Alert Types
                  </h4>
                  <div className="grid grid-cols-2 gap-1">
                    {ALERT_TYPES.map((type) => {
                      const fieldKey = `alert_${type}` as InheritablePreferenceKey;
                      // Use local settings value if set, otherwise fall back to effective
                      const localValue = settings?.[fieldKey as keyof typeof settings];
                      const isInherited = localValue === null || localValue === undefined;
                      const displayValue = isInherited
                        ? (data?.effective?.[fieldKey] ?? true)
                        : localValue;

                      return (
                        <label
                          key={type}
                          className="flex items-center gap-2 py-1 px-2 -mx-2 rounded hover:bg-surface-overlay cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={displayValue as boolean}
                            onChange={(e) => {
                              updateSetting(fieldKey, e.target.checked);
                            }}
                            className="h-3.5 w-3.5 rounded border-border-subtle text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
                          />
                          <span className="text-caption text-text-primary flex-1">
                            {ALERT_TYPE_LABELS[type]}
                          </span>
                          {isInherited && (
                            <span className="text-[10px] text-text-muted bg-surface-overlay px-1 rounded">
                              global
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Sensitivity Sliders */}
                <div>
                  <h4 className="text-caption font-medium text-text-secondary mb-2">
                    Sensitivity
                  </h4>
                  <div className="space-y-3">
                    {Object.entries(SENSITIVITY_LABELS).map(([key, label]) => {
                      // Use local settings value if set, otherwise fall back to effective
                      const localValue = settings?.[key as keyof typeof settings] as number | null;
                      const isInherited = localValue === null || localValue === undefined;
                      const displayValue = isInherited
                        ? ((data?.effective?.[key as keyof typeof data.effective] as number) ?? 1.0)
                        : localValue;

                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-caption text-text-primary">
                              {label}
                            </span>
                            <div className="flex items-center gap-1">
                              <span className="text-caption text-text-muted tabular-nums">
                                {displayValue.toFixed(1)}x
                              </span>
                              {isInherited && (
                                <span className="text-[10px] text-text-muted bg-surface-overlay px-1 rounded">
                                  global
                                </span>
                              )}
                            </div>
                          </div>
                          <input
                            type="range"
                            min="0.5"
                            max="2.0"
                            step="0.1"
                            value={displayValue}
                            onChange={(e) =>
                              updateSetting(key, parseFloat(e.target.value))
                            }
                            className="w-full h-1.5 bg-surface-overlay rounded-lg appearance-none cursor-pointer accent-accent-primary"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border-subtle">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  disabled={isPending}
                  className="text-text-muted hover:text-text-secondary"
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  Reset
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || isPending}
                  isLoading={isPending}
                >
                  Save
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
