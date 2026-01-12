export interface AlertPreferences {
  alerts_enabled: boolean;
  ccu_sensitivity: number;
  review_sensitivity: number;
  sentiment_sensitivity: number;
  alert_ccu_spike: boolean;
  alert_ccu_drop: boolean;
  alert_trend_reversal: boolean;
  alert_review_surge: boolean;
  alert_sentiment_shift: boolean;
  alert_price_change: boolean;
  alert_new_release: boolean;
  alert_milestone: boolean;
}

export type AlertType =
  | 'ccu_spike'
  | 'ccu_drop'
  | 'trend_reversal'
  | 'review_surge'
  | 'sentiment_shift'
  | 'price_change'
  | 'new_release'
  | 'milestone';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  ccu_spike: 'CCU Spikes',
  ccu_drop: 'CCU Drops',
  trend_reversal: 'Trend Reversals',
  review_surge: 'Review Surges',
  sentiment_shift: 'Sentiment Shifts',
  price_change: 'Price Changes',
  new_release: 'New Releases',
  milestone: 'Milestones',
};

export const ALERT_TYPE_DESCRIPTIONS: Record<AlertType, string> = {
  ccu_spike: 'Significant increase in concurrent players',
  ccu_drop: 'Significant decrease in concurrent players',
  trend_reversal: '30-day trend direction changes',
  review_surge: 'Review velocity exceeds normal rate',
  sentiment_shift: 'Positive review ratio changes significantly',
  price_change: 'Price or discount changes',
  new_release: 'Publisher/developer releases a new game',
  milestone: 'Review count crosses major thresholds',
};

export const DEFAULT_PREFERENCES: AlertPreferences = {
  alerts_enabled: true,
  ccu_sensitivity: 1.0,
  review_sensitivity: 1.0,
  sentiment_sensitivity: 1.0,
  alert_ccu_spike: true,
  alert_ccu_drop: true,
  alert_trend_reversal: true,
  alert_review_surge: true,
  alert_sentiment_shift: true,
  alert_price_change: true,
  alert_new_release: true,
  alert_milestone: true,
};

// Per-pin alert settings (stored in user_pin_alert_settings table)
// null values mean "inherit from global user_alert_preferences"
export interface PinAlertSettings {
  use_custom_settings: boolean;
  alerts_enabled: boolean;
  ccu_sensitivity: number | null;
  review_sensitivity: number | null;
  sentiment_sensitivity: number | null;
  alert_ccu_spike: boolean | null;
  alert_ccu_drop: boolean | null;
  alert_trend_reversal: boolean | null;
  alert_review_surge: boolean | null;
  alert_sentiment_shift: boolean | null;
  alert_price_change: boolean | null;
  alert_new_release: boolean | null;
  alert_milestone: boolean | null;
}

// Keys that can be inherited from global preferences
export type InheritablePreferenceKey = keyof Omit<AlertPreferences, 'alerts_enabled'>;

// API response for GET /api/pins/[id]/alert-settings
export interface PinAlertSettingsResponse {
  // Raw settings from database (null = inherit)
  settings: PinAlertSettings | null;
  // Which fields are inherited from global (true = using global value)
  inherited: Record<InheritablePreferenceKey, boolean>;
  // Effective (merged) values actually used for alert detection
  effective: AlertPreferences;
}

// Default per-pin settings (all null = inherit everything from global)
export const DEFAULT_PIN_SETTINGS: PinAlertSettings = {
  use_custom_settings: false,
  alerts_enabled: true,
  ccu_sensitivity: null,
  review_sensitivity: null,
  sentiment_sensitivity: null,
  alert_ccu_spike: null,
  alert_ccu_drop: null,
  alert_trend_reversal: null,
  alert_review_surge: null,
  alert_sentiment_shift: null,
  alert_price_change: null,
  alert_new_release: null,
  alert_milestone: null,
};
