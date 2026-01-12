-- =============================================
-- Personalization: Pins, Alerts & Preferences
-- =============================================
-- This migration adds:
-- 1. User pins for tracking games/publishers/developers
-- 2. Alert system for monitoring pinned entities
-- 3. User preferences for alert thresholds and delivery
-- 4. Detection state for change tracking
-- 5. Real-time price change trigger
-- =============================================

-- =============================================
-- ENUMS
-- =============================================

CREATE TYPE entity_type AS ENUM ('game', 'publisher', 'developer');

CREATE TYPE alert_type AS ENUM (
    'ccu_spike',         -- CCU significantly above baseline
    'ccu_drop',          -- CCU significantly below baseline
    'trend_reversal',    -- 30-day trend direction changed
    'review_surge',      -- Review velocity spiked
    'sentiment_shift',   -- Positive ratio changed significantly
    'price_change',      -- Price or discount changed
    'new_release',       -- Pinned publisher/developer released new game
    'milestone'          -- Review count crossed threshold (10K, 100K, 1M)
);

CREATE TYPE alert_severity AS ENUM ('low', 'medium', 'high');

-- =============================================
-- USER PINS TABLE
-- =============================================

CREATE TABLE user_pins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    entity_type entity_type NOT NULL,
    entity_id INTEGER NOT NULL,
    display_name TEXT NOT NULL,
    pin_order INTEGER DEFAULT 0,
    pinned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(user_id, entity_type, entity_id)
);

-- Query user's pins by order
CREATE INDEX idx_user_pins_user_id ON user_pins(user_id, pin_order);

-- Find all pins for a specific entity (for alert worker)
CREATE INDEX idx_user_pins_entity ON user_pins(entity_type, entity_id);

COMMENT ON TABLE user_pins IS 'User-pinned entities (games, publishers, developers) for personalized dashboard';
COMMENT ON COLUMN user_pins.pin_order IS 'User-defined ordering for drag-and-drop reordering';
COMMENT ON COLUMN user_pins.display_name IS 'Cached entity name for quick display without joins';

-- =============================================
-- USER ALERTS TABLE
-- =============================================

CREATE TABLE user_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    pin_id UUID NOT NULL REFERENCES user_pins(id) ON DELETE CASCADE,
    alert_type alert_type NOT NULL,
    severity alert_severity NOT NULL DEFAULT 'medium',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    metric_name TEXT,
    previous_value DECIMAL,
    current_value DECIMAL,
    change_percent DECIMAL,
    dedup_key TEXT NOT NULL UNIQUE,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_data JSONB
);

-- Fetch unread alerts for badge count
CREATE INDEX idx_user_alerts_user_unread ON user_alerts(user_id, created_at DESC)
    WHERE is_read = FALSE;

-- Fetch all alerts for user (history view)
CREATE INDEX idx_user_alerts_user_date ON user_alerts(user_id, created_at DESC);

COMMENT ON TABLE user_alerts IS 'System-generated alerts for pinned entities. Dedup_key prevents duplicate alerts per day.';
COMMENT ON COLUMN user_alerts.dedup_key IS 'Format: {user_id}:{entity_type}:{entity_id}:{alert_type}:{date}';
COMMENT ON COLUMN user_alerts.source_data IS 'Debug info: raw values at time of alert creation';

-- =============================================
-- USER ALERT PREFERENCES TABLE
-- =============================================

CREATE TABLE user_alert_preferences (
    user_id UUID PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
    alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_digest_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    email_digest_frequency TEXT DEFAULT 'daily',

    -- Sensitivity multipliers (0.5 = less sensitive, 2.0 = more sensitive)
    ccu_sensitivity DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    review_sensitivity DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    sentiment_sensitivity DECIMAL(3,2) NOT NULL DEFAULT 1.0,

    -- Per-alert-type toggles
    alert_ccu_spike BOOLEAN NOT NULL DEFAULT TRUE,
    alert_ccu_drop BOOLEAN NOT NULL DEFAULT TRUE,
    alert_trend_reversal BOOLEAN NOT NULL DEFAULT TRUE,
    alert_review_surge BOOLEAN NOT NULL DEFAULT TRUE,
    alert_sentiment_shift BOOLEAN NOT NULL DEFAULT TRUE,
    alert_price_change BOOLEAN NOT NULL DEFAULT TRUE,
    alert_new_release BOOLEAN NOT NULL DEFAULT TRUE,
    alert_milestone BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_alert_preferences IS 'User settings for alert sensitivity and delivery preferences';
COMMENT ON COLUMN user_alert_preferences.ccu_sensitivity IS 'Multiplier for CCU thresholds: 0.5=half, 1.0=default, 2.0=double';

-- =============================================
-- ALERT DETECTION STATE TABLE
-- =============================================

CREATE TABLE alert_detection_state (
    id BIGSERIAL PRIMARY KEY,
    entity_type entity_type NOT NULL,
    entity_id INTEGER NOT NULL,

    -- CCU baseline (for spike/drop detection)
    ccu_7d_avg INTEGER,
    ccu_7d_max INTEGER,
    ccu_7d_min INTEGER,
    ccu_prev_value INTEGER,

    -- Review baseline
    review_velocity_7d_avg DECIMAL(8,4),
    positive_ratio_prev DECIMAL(5,4),
    total_reviews_prev INTEGER,

    -- Price baseline
    price_cents_prev INTEGER,
    discount_percent_prev INTEGER,

    -- Trend baseline
    trend_30d_direction_prev TEXT,

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(entity_type, entity_id)
);

-- Lookup state for entity
CREATE INDEX idx_alert_state_entity ON alert_detection_state(entity_type, entity_id);

COMMENT ON TABLE alert_detection_state IS 'Baseline metrics for each pinned entity, used for change detection';
COMMENT ON COLUMN alert_detection_state.ccu_7d_avg IS '7-day rolling average CCU, baseline for spike/drop detection';

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE user_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_alert_preferences ENABLE ROW LEVEL SECURITY;

-- User pins: Users can manage own pins
CREATE POLICY "Users can read own pins" ON user_pins
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own pins" ON user_pins
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own pins" ON user_pins
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own pins" ON user_pins
    FOR DELETE USING (user_id = auth.uid());

-- User alerts: Users can read and update (mark read) own alerts
CREATE POLICY "Users can read own alerts" ON user_alerts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own alerts" ON user_alerts
    FOR UPDATE USING (user_id = auth.uid());

-- User alert preferences: Users can manage own preferences
CREATE POLICY "Users can read own preferences" ON user_alert_preferences
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own preferences" ON user_alert_preferences
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own preferences" ON user_alert_preferences
    FOR UPDATE USING (user_id = auth.uid());

-- Note: alert_detection_state does not need RLS - accessed only by service role

-- =============================================
-- RPC FUNCTIONS
-- =============================================

-- Function: get_pinned_entities_with_metrics
-- Used by alert detection worker to fetch all pinned entities with current metrics
-- Returns data for all users' pinned entities in a single query

CREATE OR REPLACE FUNCTION get_pinned_entities_with_metrics()
RETURNS TABLE (
    user_id UUID,
    pin_id UUID,
    entity_type entity_type,
    entity_id INTEGER,
    display_name TEXT,
    ccu_current INTEGER,
    ccu_7d_avg INTEGER,
    review_velocity DECIMAL,
    positive_ratio DECIMAL,
    total_reviews INTEGER,
    price_cents INTEGER,
    discount_percent INTEGER,
    trend_30d_direction TEXT,
    sensitivity_ccu DECIMAL,
    sensitivity_review DECIMAL,
    sensitivity_sentiment DECIMAL,
    alerts_enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.user_id,
        p.id as pin_id,
        p.entity_type,
        p.entity_id,
        p.display_name,
        CASE WHEN p.entity_type = 'game' THEN ldm.ccu_peak END as ccu_current,
        CASE WHEN p.entity_type = 'game' THEN ads.ccu_7d_avg END as ccu_7d_avg,
        CASE WHEN p.entity_type = 'game' THEN at.review_velocity_7d END as review_velocity,
        CASE WHEN p.entity_type = 'game' THEN
            CASE WHEN ldm.total_reviews > 0
                THEN ldm.positive_reviews::DECIMAL / ldm.total_reviews
                ELSE NULL
            END
        END as positive_ratio,
        CASE WHEN p.entity_type = 'game' THEN ldm.total_reviews END as total_reviews,
        CASE WHEN p.entity_type = 'game' THEN a.current_price_cents END as price_cents,
        CASE WHEN p.entity_type = 'game' THEN a.current_discount_percent END as discount_percent,
        CASE WHEN p.entity_type = 'game' THEN at.trend_30d_direction::TEXT END as trend_30d_direction,
        COALESCE(pref.ccu_sensitivity, 1.0) as sensitivity_ccu,
        COALESCE(pref.review_sensitivity, 1.0) as sensitivity_review,
        COALESCE(pref.sentiment_sensitivity, 1.0) as sensitivity_sentiment,
        COALESCE(pref.alerts_enabled, TRUE) as alerts_enabled
    FROM user_pins p
    LEFT JOIN apps a ON p.entity_type = 'game' AND p.entity_id = a.appid
    LEFT JOIN latest_daily_metrics ldm ON p.entity_type = 'game' AND p.entity_id = ldm.appid
    LEFT JOIN app_trends at ON p.entity_type = 'game' AND p.entity_id = at.appid
    LEFT JOIN alert_detection_state ads ON p.entity_type = ads.entity_type AND p.entity_id = ads.entity_id
    LEFT JOIN user_alert_preferences pref ON p.user_id = pref.user_id
    WHERE COALESCE(pref.alerts_enabled, TRUE) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_pinned_entities_with_metrics() IS 'Fetch all pinned entities with current metrics for alert detection worker';

-- Function: get_user_pins_with_metrics
-- Used by dashboard to display user's pinned items with current metrics

CREATE OR REPLACE FUNCTION get_user_pins_with_metrics(p_user_id UUID)
RETURNS TABLE (
    pin_id UUID,
    entity_type entity_type,
    entity_id INTEGER,
    display_name TEXT,
    pin_order INTEGER,
    pinned_at TIMESTAMPTZ,
    ccu_current INTEGER,
    ccu_change_pct DECIMAL,
    total_reviews INTEGER,
    positive_pct DECIMAL,
    review_velocity DECIMAL,
    trend_direction TEXT,
    price_cents INTEGER,
    discount_percent INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.id as pin_id,
        p.entity_type,
        p.entity_id,
        p.display_name,
        p.pin_order,
        p.pinned_at,
        ldm.ccu_peak as ccu_current,
        at.trend_30d_change_pct as ccu_change_pct,
        ldm.total_reviews,
        CASE WHEN ldm.total_reviews > 0
            THEN (ldm.positive_reviews::DECIMAL / ldm.total_reviews * 100)::DECIMAL(5,2)
            ELSE NULL
        END as positive_pct,
        at.review_velocity_7d as review_velocity,
        at.trend_30d_direction::TEXT as trend_direction,
        a.current_price_cents as price_cents,
        a.current_discount_percent as discount_percent
    FROM user_pins p
    LEFT JOIN apps a ON p.entity_type = 'game' AND p.entity_id = a.appid
    LEFT JOIN latest_daily_metrics ldm ON p.entity_type = 'game' AND p.entity_id = ldm.appid
    LEFT JOIN app_trends at ON p.entity_type = 'game' AND p.entity_id = at.appid
    WHERE p.user_id = p_user_id
    ORDER BY p.pin_order ASC, p.pinned_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_user_pins_with_metrics(UUID) IS 'Fetch user pins with current metrics for dashboard display';

-- =============================================
-- PRICE CHANGE TRIGGER
-- =============================================

-- Function: Create alert when price or discount changes on a pinned game
CREATE OR REPLACE FUNCTION detect_price_change_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_pin RECORD;
    v_dedup_key TEXT;
    v_title TEXT;
BEGIN
    -- Skip if price and discount are unchanged
    IF OLD.current_price_cents = NEW.current_price_cents
       AND COALESCE(OLD.current_discount_percent, 0) = COALESCE(NEW.current_discount_percent, 0) THEN
        RETURN NEW;
    END IF;

    -- Find all users who pinned this game and have price alerts enabled
    FOR v_pin IN
        SELECT p.id as pin_id, p.user_id, p.display_name, pref.alert_price_change
        FROM user_pins p
        LEFT JOIN user_alert_preferences pref ON p.user_id = pref.user_id
        WHERE p.entity_type = 'game'
          AND p.entity_id = NEW.appid
          AND COALESCE(pref.alerts_enabled, TRUE) = TRUE
          AND COALESCE(pref.alert_price_change, TRUE) = TRUE
    LOOP
        v_dedup_key := v_pin.user_id || ':game:' || NEW.appid || ':price_change:' || CURRENT_DATE;

        -- Determine alert title based on change type
        IF COALESCE(NEW.current_discount_percent, 0) > COALESCE(OLD.current_discount_percent, 0) THEN
            v_title := 'Sale: ' || NEW.current_discount_percent || '% off';
        ELSIF COALESCE(NEW.current_discount_percent, 0) < COALESCE(OLD.current_discount_percent, 0)
              AND COALESCE(OLD.current_discount_percent, 0) > 0 THEN
            v_title := 'Sale Ended';
        ELSIF NEW.current_price_cents > OLD.current_price_cents THEN
            v_title := 'Price Increased';
        ELSE
            v_title := 'Price Decreased';
        END IF;

        -- Insert alert (ignore if duplicate key)
        INSERT INTO user_alerts (
            user_id, pin_id, alert_type, severity, title, description,
            metric_name, previous_value, current_value, dedup_key
        ) VALUES (
            v_pin.user_id,
            v_pin.pin_id,
            'price_change',
            CASE WHEN COALESCE(NEW.current_discount_percent, 0) >= 50 THEN 'high' ELSE 'low' END,
            v_title,
            v_pin.display_name || ': ' || v_title,
            'price_cents',
            OLD.current_price_cents,
            NEW.current_price_cents,
            v_dedup_key
        )
        ON CONFLICT (dedup_key) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on apps table
CREATE TRIGGER trigger_price_change_alert
    AFTER UPDATE OF current_price_cents, current_discount_percent ON apps
    FOR EACH ROW
    EXECUTE FUNCTION detect_price_change_alert();

COMMENT ON FUNCTION detect_price_change_alert() IS 'Real-time trigger: creates price_change alerts when pinned games have price/discount updates';

-- =============================================
-- UPDATED_AT TRIGGER FOR PREFERENCES
-- =============================================

CREATE OR REPLACE FUNCTION update_alert_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_alert_preferences_updated_at
    BEFORE UPDATE ON user_alert_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_alert_preferences_updated_at();

-- =============================================
-- GRANTS
-- =============================================

-- Grant execute on RPC functions to authenticated users
GRANT EXECUTE ON FUNCTION get_pinned_entities_with_metrics() TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_pins_with_metrics(UUID) TO authenticated;
