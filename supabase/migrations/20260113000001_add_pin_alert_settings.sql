-- =============================================
-- Per-Pin Alert Settings
-- =============================================
-- This migration adds per-entity alert preferences, allowing users to
-- customize alert settings for individual pinned games/publishers/developers
-- while keeping global defaults.
--
-- Design: Nullable override fields. NULL = inherit from user_alert_preferences.
-- =============================================

-- =============================================
-- USER PIN ALERT SETTINGS TABLE
-- =============================================

CREATE TABLE user_pin_alert_settings (
    pin_id UUID PRIMARY KEY REFERENCES user_pins(id) ON DELETE CASCADE,

    -- Master toggle: if FALSE, all overrides ignored (use global settings)
    use_custom_settings BOOLEAN NOT NULL DEFAULT TRUE,

    -- Per-pin master toggle (can disable alerts for just this pin)
    alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,

    -- Sensitivity overrides (NULL = inherit from user_alert_preferences)
    ccu_sensitivity DECIMAL(3,2) CHECK (ccu_sensitivity IS NULL OR (ccu_sensitivity >= 0.5 AND ccu_sensitivity <= 2.0)),
    review_sensitivity DECIMAL(3,2) CHECK (review_sensitivity IS NULL OR (review_sensitivity >= 0.5 AND review_sensitivity <= 2.0)),
    sentiment_sensitivity DECIMAL(3,2) CHECK (sentiment_sensitivity IS NULL OR (sentiment_sensitivity >= 0.5 AND sentiment_sensitivity <= 2.0)),

    -- Alert type toggles (NULL = inherit from user_alert_preferences)
    alert_ccu_spike BOOLEAN,
    alert_ccu_drop BOOLEAN,
    alert_trend_reversal BOOLEAN,
    alert_review_surge BOOLEAN,
    alert_sentiment_shift BOOLEAN,
    alert_price_change BOOLEAN,
    alert_new_release BOOLEAN,
    alert_milestone BOOLEAN,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE user_pin_alert_settings IS 'Per-pin alert overrides. NULL values inherit from user_alert_preferences.';
COMMENT ON COLUMN user_pin_alert_settings.use_custom_settings IS 'When FALSE, all overrides ignored and global settings apply';
COMMENT ON COLUMN user_pin_alert_settings.alerts_enabled IS 'Per-pin master toggle - can disable alerts for just this entity';

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE user_pin_alert_settings ENABLE ROW LEVEL SECURITY;

-- Users can only manage settings for pins they own
CREATE POLICY "Users manage own pin settings" ON user_pin_alert_settings
    FOR ALL
    USING (pin_id IN (SELECT id FROM user_pins WHERE user_id = auth.uid()))
    WITH CHECK (pin_id IN (SELECT id FROM user_pins WHERE user_id = auth.uid()));

-- =============================================
-- UPDATED_AT TRIGGER
-- =============================================

CREATE TRIGGER trigger_pin_alert_settings_updated_at
    BEFORE UPDATE ON user_pin_alert_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_alert_preferences_updated_at();

-- =============================================
-- UPDATE RPC: get_pinned_entities_with_metrics
-- =============================================
-- Now returns merged (effective) settings per pin, including per-alert-type toggles

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
    -- Effective (merged) sensitivity settings
    sensitivity_ccu DECIMAL,
    sensitivity_review DECIMAL,
    sensitivity_sentiment DECIMAL,
    alerts_enabled BOOLEAN,
    -- Effective (merged) per-alert-type toggles
    alert_ccu_spike BOOLEAN,
    alert_ccu_drop BOOLEAN,
    alert_trend_reversal BOOLEAN,
    alert_review_surge BOOLEAN,
    alert_sentiment_shift BOOLEAN,
    alert_price_change BOOLEAN,
    alert_new_release BOOLEAN,
    alert_milestone BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        p.user_id,
        p.id as pin_id,
        p.entity_type,
        p.entity_id,
        p.display_name,
        -- Metrics (unchanged)
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

        -- Merged sensitivities: pin (if custom enabled) > global > default
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.ccu_sensitivity IS NOT NULL
            THEN ps.ccu_sensitivity
            ELSE COALESCE(pref.ccu_sensitivity, 1.0)
        END as sensitivity_ccu,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.review_sensitivity IS NOT NULL
            THEN ps.review_sensitivity
            ELSE COALESCE(pref.review_sensitivity, 1.0)
        END as sensitivity_review,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.sentiment_sensitivity IS NOT NULL
            THEN ps.sentiment_sensitivity
            ELSE COALESCE(pref.sentiment_sensitivity, 1.0)
        END as sensitivity_sentiment,

        -- Merged alerts_enabled: global must be TRUE, then check pin-level
        CASE
            WHEN COALESCE(pref.alerts_enabled, TRUE) = FALSE THEN FALSE
            WHEN ps.use_custom_settings = TRUE THEN COALESCE(ps.alerts_enabled, TRUE)
            ELSE TRUE
        END as alerts_enabled,

        -- Merged alert type toggles: pin (if custom enabled) > global > default (TRUE)
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_ccu_spike IS NOT NULL
            THEN ps.alert_ccu_spike
            ELSE COALESCE(pref.alert_ccu_spike, TRUE)
        END as alert_ccu_spike,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_ccu_drop IS NOT NULL
            THEN ps.alert_ccu_drop
            ELSE COALESCE(pref.alert_ccu_drop, TRUE)
        END as alert_ccu_drop,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_trend_reversal IS NOT NULL
            THEN ps.alert_trend_reversal
            ELSE COALESCE(pref.alert_trend_reversal, TRUE)
        END as alert_trend_reversal,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_review_surge IS NOT NULL
            THEN ps.alert_review_surge
            ELSE COALESCE(pref.alert_review_surge, TRUE)
        END as alert_review_surge,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_sentiment_shift IS NOT NULL
            THEN ps.alert_sentiment_shift
            ELSE COALESCE(pref.alert_sentiment_shift, TRUE)
        END as alert_sentiment_shift,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_price_change IS NOT NULL
            THEN ps.alert_price_change
            ELSE COALESCE(pref.alert_price_change, TRUE)
        END as alert_price_change,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_new_release IS NOT NULL
            THEN ps.alert_new_release
            ELSE COALESCE(pref.alert_new_release, TRUE)
        END as alert_new_release,
        CASE
            WHEN ps.use_custom_settings = TRUE AND ps.alert_milestone IS NOT NULL
            THEN ps.alert_milestone
            ELSE COALESCE(pref.alert_milestone, TRUE)
        END as alert_milestone

    FROM user_pins p
    LEFT JOIN apps a ON p.entity_type = 'game' AND p.entity_id = a.appid
    LEFT JOIN latest_daily_metrics ldm ON p.entity_type = 'game' AND p.entity_id = ldm.appid
    LEFT JOIN app_trends at ON p.entity_type = 'game' AND p.entity_id = at.appid
    LEFT JOIN alert_detection_state ads ON p.entity_type = ads.entity_type AND p.entity_id = ads.entity_id
    LEFT JOIN user_alert_preferences pref ON p.user_id = pref.user_id
    LEFT JOIN user_pin_alert_settings ps ON p.id = ps.pin_id
    WHERE COALESCE(pref.alerts_enabled, TRUE) = TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_pinned_entities_with_metrics() IS 'Fetch all pinned entities with current metrics and merged alert settings for detection worker';

-- =============================================
-- UPDATE TRIGGER: detect_price_change_alert
-- =============================================
-- Now respects per-pin alert_price_change setting

CREATE OR REPLACE FUNCTION detect_price_change_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_pin RECORD;
    v_dedup_key TEXT;
    v_title TEXT;
    v_effective_price_change BOOLEAN;
BEGIN
    -- Skip if price and discount are unchanged
    IF OLD.current_price_cents = NEW.current_price_cents
       AND COALESCE(OLD.current_discount_percent, 0) = COALESCE(NEW.current_discount_percent, 0) THEN
        RETURN NEW;
    END IF;

    -- Find all users who pinned this game with merged price alert settings
    FOR v_pin IN
        SELECT
            p.id as pin_id,
            p.user_id,
            p.display_name,
            -- Compute effective alert_price_change
            CASE
                WHEN ps.use_custom_settings = TRUE AND ps.alert_price_change IS NOT NULL
                THEN ps.alert_price_change
                ELSE COALESCE(pref.alert_price_change, TRUE)
            END as effective_alert_price_change,
            -- Check if pin-level alerts are enabled
            CASE
                WHEN ps.use_custom_settings = TRUE
                THEN COALESCE(ps.alerts_enabled, TRUE)
                ELSE TRUE
            END as pin_alerts_enabled
        FROM user_pins p
        LEFT JOIN user_alert_preferences pref ON p.user_id = pref.user_id
        LEFT JOIN user_pin_alert_settings ps ON p.id = ps.pin_id
        WHERE p.entity_type = 'game'
          AND p.entity_id = NEW.appid
          AND COALESCE(pref.alerts_enabled, TRUE) = TRUE
    LOOP
        -- Skip if pin-level alerts disabled or price_change alert type disabled
        IF NOT v_pin.pin_alerts_enabled OR NOT v_pin.effective_alert_price_change THEN
            CONTINUE;
        END IF;

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

COMMENT ON FUNCTION detect_price_change_alert() IS 'Real-time trigger: creates price_change alerts respecting per-pin settings';

-- =============================================
-- GRANTS
-- =============================================

-- Users need to access pin alert settings via API
GRANT SELECT, INSERT, UPDATE, DELETE ON user_pin_alert_settings TO authenticated;
