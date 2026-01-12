'use client';

import { useEffect, useState, useTransition } from 'react';
import { X, Settings } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  type AlertPreferences,
  type AlertType,
  ALERT_TYPE_LABELS,
  ALERT_TYPE_DESCRIPTIONS,
  DEFAULT_PREFERENCES,
} from '@/types/alerts';

interface AlertPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  ccu_sensitivity: 'CCU Changes',
  review_sensitivity: 'Review Surges',
  sentiment_sensitivity: 'Sentiment Shifts',
};

export function AlertPreferencesModal({ isOpen, onClose }: AlertPreferencesModalProps) {
  const [preferences, setPreferences] = useState<AlertPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPreferences = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/alerts/preferences');
        if (!res.ok) {
          throw new Error('Failed to fetch preferences');
        }
        const data = await res.json();
        setPreferences(data);
        setHasChanges(false);
      } catch (err) {
        console.error('Error fetching preferences:', err);
        setError('Failed to load preferences');
      } finally {
        setLoading(false);
      }
    };

    fetchPreferences();
  }, [isOpen]);

  const handleSave = () => {
    startTransition(async () => {
      try {
        const res = await fetch('/api/alerts/preferences', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(preferences),
        });

        if (!res.ok) {
          throw new Error('Failed to save preferences');
        }

        setHasChanges(false);
        onClose();
      } catch (err) {
        console.error('Error saving preferences:', err);
        setError('Failed to save preferences');
      }
    });
  };

  const updatePreference = <K extends keyof AlertPreferences>(
    key: K,
    value: AlertPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-md mx-4 bg-surface-raised border border-border-subtle rounded-xl shadow-lg max-h-[85vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-subtle">
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-text-secondary" />
            <h2 className="text-subheading font-medium text-text-primary">
              Alert Preferences
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 -m-1.5 rounded-lg hover:bg-surface-overlay transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6">
          {loading ? (
            <div className="space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-12 bg-surface-elevated rounded-lg animate-pulse" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-6 text-accent-red">
              <p className="text-body-sm">{error}</p>
            </div>
          ) : (
            <>
              {/* Global Toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-body font-medium text-text-primary">Enable Alerts</p>
                  <p className="text-caption text-text-muted">
                    Turn all alerts on or off
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferences.alerts_enabled}
                    onChange={(e) => updatePreference('alerts_enabled', e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-surface-overlay peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-accent-primary rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-accent-primary"></div>
                </label>
              </div>

              {/* Alert Types */}
              <div className={preferences.alerts_enabled ? '' : 'opacity-50 pointer-events-none'}>
                <h3 className="text-body-sm font-medium text-text-secondary mb-3">
                  Alert Types
                </h3>
                <div className="space-y-2">
                  {ALERT_TYPES.map((type) => {
                    const fieldKey = `alert_${type}` as keyof AlertPreferences;
                    return (
                      <label
                        key={type}
                        className="flex items-start gap-3 py-2 px-3 -mx-3 rounded-lg hover:bg-surface-elevated cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={preferences[fieldKey] as boolean}
                          onChange={(e) => updatePreference(fieldKey, e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-border-subtle text-accent-primary focus:ring-accent-primary focus:ring-offset-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-body-sm text-text-primary">
                            {ALERT_TYPE_LABELS[type]}
                          </p>
                          <p className="text-caption text-text-muted">
                            {ALERT_TYPE_DESCRIPTIONS[type]}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Sensitivity Settings */}
              <div className={preferences.alerts_enabled ? '' : 'opacity-50 pointer-events-none'}>
                <h3 className="text-body-sm font-medium text-text-secondary mb-3">
                  Sensitivity
                </h3>
                <p className="text-caption text-text-muted mb-4">
                  Higher sensitivity means more alerts for smaller changes
                </p>
                <div className="space-y-4">
                  {Object.entries(SENSITIVITY_LABELS).map(([key, label]) => {
                    const value = preferences[key as keyof AlertPreferences] as number;
                    return (
                      <div key={key} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-body-sm text-text-primary">{label}</span>
                          <span className="text-caption text-text-muted tabular-nums">
                            {value.toFixed(1)}x
                          </span>
                        </div>
                        <input
                          type="range"
                          min="0.5"
                          max="2.0"
                          step="0.1"
                          value={value}
                          onChange={(e) =>
                            updatePreference(
                              key as keyof AlertPreferences,
                              parseFloat(e.target.value)
                            )
                          }
                          className="w-full h-2 bg-surface-overlay rounded-lg appearance-none cursor-pointer accent-accent-primary"
                        />
                        <div className="flex justify-between text-caption text-text-muted">
                          <span>Less</span>
                          <span>More</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-border-subtle bg-surface-raised">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleSave}
            disabled={!hasChanges || loading}
            isLoading={isPending}
          >
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
