-- =============================================
-- Alert Detection: RPCs and Triggers
-- =============================================
-- This migration adds:
-- 1. RPC function to batch update detection state
-- 2. Triggers for new release detection
-- =============================================

-- =============================================
-- UPDATE DETECTION STATE RPC
-- =============================================
-- Used by alert detection worker to update baseline metrics after processing

CREATE OR REPLACE FUNCTION update_alert_detection_state(
    p_entity_type entity_type,
    p_entity_id INTEGER,
    p_ccu_7d_avg INTEGER DEFAULT NULL,
    p_ccu_7d_max INTEGER DEFAULT NULL,
    p_ccu_7d_min INTEGER DEFAULT NULL,
    p_ccu_prev_value INTEGER DEFAULT NULL,
    p_review_velocity_7d_avg DECIMAL DEFAULT NULL,
    p_positive_ratio_prev DECIMAL DEFAULT NULL,
    p_total_reviews_prev INTEGER DEFAULT NULL,
    p_price_cents_prev INTEGER DEFAULT NULL,
    p_discount_percent_prev INTEGER DEFAULT NULL,
    p_trend_30d_direction_prev TEXT DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    INSERT INTO alert_detection_state (
        entity_type,
        entity_id,
        ccu_7d_avg,
        ccu_7d_max,
        ccu_7d_min,
        ccu_prev_value,
        review_velocity_7d_avg,
        positive_ratio_prev,
        total_reviews_prev,
        price_cents_prev,
        discount_percent_prev,
        trend_30d_direction_prev,
        updated_at
    ) VALUES (
        p_entity_type,
        p_entity_id,
        p_ccu_7d_avg,
        p_ccu_7d_max,
        p_ccu_7d_min,
        p_ccu_prev_value,
        p_review_velocity_7d_avg,
        p_positive_ratio_prev,
        p_total_reviews_prev,
        p_price_cents_prev,
        p_discount_percent_prev,
        p_trend_30d_direction_prev,
        NOW()
    )
    ON CONFLICT (entity_type, entity_id) DO UPDATE SET
        ccu_7d_avg = COALESCE(p_ccu_7d_avg, alert_detection_state.ccu_7d_avg),
        ccu_7d_max = COALESCE(p_ccu_7d_max, alert_detection_state.ccu_7d_max),
        ccu_7d_min = COALESCE(p_ccu_7d_min, alert_detection_state.ccu_7d_min),
        ccu_prev_value = COALESCE(p_ccu_prev_value, alert_detection_state.ccu_prev_value),
        review_velocity_7d_avg = COALESCE(p_review_velocity_7d_avg, alert_detection_state.review_velocity_7d_avg),
        positive_ratio_prev = COALESCE(p_positive_ratio_prev, alert_detection_state.positive_ratio_prev),
        total_reviews_prev = COALESCE(p_total_reviews_prev, alert_detection_state.total_reviews_prev),
        price_cents_prev = COALESCE(p_price_cents_prev, alert_detection_state.price_cents_prev),
        discount_percent_prev = COALESCE(p_discount_percent_prev, alert_detection_state.discount_percent_prev),
        trend_30d_direction_prev = COALESCE(p_trend_30d_direction_prev, alert_detection_state.trend_30d_direction_prev),
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_alert_detection_state IS 'Updates baseline metrics for an entity. Used by alert detection worker.';

-- =============================================
-- NEW RELEASE DETECTION TRIGGERS
-- =============================================
-- Real-time triggers when a game is linked to a pinned publisher/developer

-- Publisher new release trigger function
CREATE OR REPLACE FUNCTION detect_publisher_new_release_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_pin RECORD;
    v_app_name TEXT;
    v_dedup_key TEXT;
BEGIN
    -- Get the app name
    SELECT name INTO v_app_name FROM apps WHERE appid = NEW.appid;

    -- Find users who pinned this publisher and have new_release alerts enabled
    FOR v_pin IN
        SELECT p.id as pin_id, p.user_id, p.display_name
        FROM user_pins p
        LEFT JOIN user_alert_preferences pref ON p.user_id = pref.user_id
        WHERE p.entity_type = 'publisher'
          AND p.entity_id = NEW.publisher_id
          AND COALESCE(pref.alerts_enabled, TRUE) = TRUE
          AND COALESCE(pref.alert_new_release, TRUE) = TRUE
    LOOP
        v_dedup_key := v_pin.user_id || ':publisher:' || NEW.publisher_id || ':new_release:' || CURRENT_DATE;

        INSERT INTO user_alerts (
            user_id,
            pin_id,
            alert_type,
            severity,
            title,
            description,
            metric_name,
            dedup_key,
            source_data
        ) VALUES (
            v_pin.user_id,
            v_pin.pin_id,
            'new_release',
            'high',
            'New Release: ' || COALESCE(v_app_name, 'Unknown Game'),
            v_pin.display_name || ' released: ' || COALESCE(v_app_name, 'Unknown Game'),
            'appid',
            v_dedup_key,
            jsonb_build_object('appid', NEW.appid, 'app_name', v_app_name, 'publisher_id', NEW.publisher_id)
        )
        ON CONFLICT (dedup_key) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_publisher_new_release_alert() IS 'Creates new_release alerts when a game is linked to a pinned publisher';

-- Developer new release trigger function
CREATE OR REPLACE FUNCTION detect_developer_new_release_alert()
RETURNS TRIGGER AS $$
DECLARE
    v_pin RECORD;
    v_app_name TEXT;
    v_dedup_key TEXT;
BEGIN
    -- Get the app name
    SELECT name INTO v_app_name FROM apps WHERE appid = NEW.appid;

    -- Find users who pinned this developer and have new_release alerts enabled
    FOR v_pin IN
        SELECT p.id as pin_id, p.user_id, p.display_name
        FROM user_pins p
        LEFT JOIN user_alert_preferences pref ON p.user_id = pref.user_id
        WHERE p.entity_type = 'developer'
          AND p.entity_id = NEW.developer_id
          AND COALESCE(pref.alerts_enabled, TRUE) = TRUE
          AND COALESCE(pref.alert_new_release, TRUE) = TRUE
    LOOP
        v_dedup_key := v_pin.user_id || ':developer:' || NEW.developer_id || ':new_release:' || CURRENT_DATE;

        INSERT INTO user_alerts (
            user_id,
            pin_id,
            alert_type,
            severity,
            title,
            description,
            metric_name,
            dedup_key,
            source_data
        ) VALUES (
            v_pin.user_id,
            v_pin.pin_id,
            'new_release',
            'high',
            'New Release: ' || COALESCE(v_app_name, 'Unknown Game'),
            v_pin.display_name || ' released: ' || COALESCE(v_app_name, 'Unknown Game'),
            'appid',
            v_dedup_key,
            jsonb_build_object('appid', NEW.appid, 'app_name', v_app_name, 'developer_id', NEW.developer_id)
        )
        ON CONFLICT (dedup_key) DO NOTHING;
    END LOOP;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION detect_developer_new_release_alert() IS 'Creates new_release alerts when a game is linked to a pinned developer';

-- Create triggers on app_publishers and app_developers tables
CREATE TRIGGER trigger_publisher_new_release
    AFTER INSERT ON app_publishers
    FOR EACH ROW
    EXECUTE FUNCTION detect_publisher_new_release_alert();

CREATE TRIGGER trigger_developer_new_release
    AFTER INSERT ON app_developers
    FOR EACH ROW
    EXECUTE FUNCTION detect_developer_new_release_alert();

-- =============================================
-- GRANTS
-- =============================================

-- Grant execute on the RPC function to service role only (worker access)
-- Note: This function is called by the background worker, not by authenticated users directly
GRANT EXECUTE ON FUNCTION update_alert_detection_state TO service_role;
