-- Extend the Tiger compatibility landing zone with feature parity metadata and
-- the control-plane tables needed for personalized chat context.

CREATE TABLE IF NOT EXISTS legacy.app_steam_deck (
    appid integer PRIMARY KEY,
    category text NOT NULL DEFAULT 'unknown',
    test_timestamp timestamp with time zone,
    tested_build_id text,
    tests jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT legacy_app_steam_deck_category_check CHECK (
      category IN ('unknown', 'unsupported', 'playable', 'verified')
    )
);

COMMENT ON TABLE legacy.app_steam_deck IS 'Near-lossless landing table for public.app_steam_deck from the live source database.';

CREATE INDEX IF NOT EXISTS idx_legacy_app_steam_deck_category
  ON legacy.app_steam_deck (category)
  WHERE category IS NOT NULL;

CREATE TABLE IF NOT EXISTS legacy.user_pins (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    entity_type text NOT NULL,
    entity_id integer NOT NULL,
    display_name text NOT NULL,
    pin_order integer DEFAULT 0,
    pinned_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT legacy_user_pins_entity_type_check CHECK (
      entity_type IN ('game', 'publisher', 'developer')
    ),
    CONSTRAINT legacy_user_pins_user_entity_key UNIQUE (user_id, entity_type, entity_id)
);

COMMENT ON TABLE legacy.user_pins IS 'Near-lossless landing table for public.user_pins from the live source database.';

CREATE INDEX IF NOT EXISTS idx_legacy_user_pins_user_id
  ON legacy.user_pins (user_id, pin_order);
CREATE INDEX IF NOT EXISTS idx_legacy_user_pins_entity
  ON legacy.user_pins (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS legacy.user_alert_preferences (
    user_id uuid PRIMARY KEY,
    alerts_enabled boolean NOT NULL DEFAULT true,
    email_digest_enabled boolean NOT NULL DEFAULT false,
    email_digest_frequency text DEFAULT 'daily',
    ccu_sensitivity numeric(3,2) NOT NULL DEFAULT 1.0,
    review_sensitivity numeric(3,2) NOT NULL DEFAULT 1.0,
    sentiment_sensitivity numeric(3,2) NOT NULL DEFAULT 1.0,
    alert_ccu_spike boolean NOT NULL DEFAULT true,
    alert_ccu_drop boolean NOT NULL DEFAULT true,
    alert_trend_reversal boolean NOT NULL DEFAULT true,
    alert_review_surge boolean NOT NULL DEFAULT true,
    alert_sentiment_shift boolean NOT NULL DEFAULT true,
    alert_price_change boolean NOT NULL DEFAULT true,
    alert_new_release boolean NOT NULL DEFAULT true,
    alert_milestone boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

COMMENT ON TABLE legacy.user_alert_preferences IS 'Near-lossless landing table for public.user_alert_preferences from the live source database.';

CREATE TABLE IF NOT EXISTS legacy.user_pin_alert_settings (
    pin_id uuid PRIMARY KEY,
    use_custom_settings boolean NOT NULL DEFAULT true,
    alerts_enabled boolean NOT NULL DEFAULT true,
    ccu_sensitivity numeric(3,2),
    review_sensitivity numeric(3,2),
    sentiment_sensitivity numeric(3,2),
    alert_ccu_spike boolean,
    alert_ccu_drop boolean,
    alert_trend_reversal boolean,
    alert_review_surge boolean,
    alert_sentiment_shift boolean,
    alert_price_change boolean,
    alert_new_release boolean,
    alert_milestone boolean,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT legacy_user_pin_alert_settings_ccu_sensitivity_check CHECK (
      ccu_sensitivity IS NULL OR (ccu_sensitivity >= 0.5 AND ccu_sensitivity <= 2.0)
    ),
    CONSTRAINT legacy_user_pin_alert_settings_review_sensitivity_check CHECK (
      review_sensitivity IS NULL OR (review_sensitivity >= 0.5 AND review_sensitivity <= 2.0)
    ),
    CONSTRAINT legacy_user_pin_alert_settings_sentiment_sensitivity_check CHECK (
      sentiment_sensitivity IS NULL OR (sentiment_sensitivity >= 0.5 AND sentiment_sensitivity <= 2.0)
    )
);

COMMENT ON TABLE legacy.user_pin_alert_settings IS 'Near-lossless landing table for public.user_pin_alert_settings from the live source database.';

CREATE TABLE IF NOT EXISTS legacy.user_alerts (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    pin_id uuid NOT NULL,
    alert_type text NOT NULL,
    severity text NOT NULL DEFAULT 'medium',
    title text NOT NULL,
    description text NOT NULL,
    metric_name text,
    previous_value numeric,
    current_value numeric,
    change_percent numeric,
    dedup_key text NOT NULL,
    is_read boolean NOT NULL DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    source_data jsonb,
    CONSTRAINT legacy_user_alerts_dedup_key_key UNIQUE (dedup_key),
    CONSTRAINT legacy_user_alerts_alert_type_check CHECK (
      alert_type IN (
        'ccu_spike',
        'ccu_drop',
        'trend_reversal',
        'review_surge',
        'sentiment_shift',
        'price_change',
        'new_release',
        'milestone'
      )
    ),
    CONSTRAINT legacy_user_alerts_severity_check CHECK (
      severity IN ('low', 'medium', 'high')
    )
);

COMMENT ON TABLE legacy.user_alerts IS 'Near-lossless landing table for public.user_alerts from the live source database.';

CREATE INDEX IF NOT EXISTS idx_legacy_user_alerts_user_date
  ON legacy.user_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_legacy_user_alerts_user_unread
  ON legacy.user_alerts (user_id, created_at DESC)
  WHERE is_read = false;
