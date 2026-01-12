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
