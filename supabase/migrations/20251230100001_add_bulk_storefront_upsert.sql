-- Migration: Add optimized bulk storefront upsert function
-- Reduces 7-11 database round trips per app to a single call
-- Handles: app update, developers, publishers, and sync_status in one transaction

CREATE OR REPLACE FUNCTION upsert_storefront_app(
  p_appid INTEGER,
  p_name TEXT,
  p_type TEXT,
  p_is_free BOOLEAN,
  p_release_date DATE,
  p_release_date_raw TEXT,
  p_has_workshop BOOLEAN,
  p_current_price_cents INTEGER,
  p_current_discount_percent INTEGER,
  p_is_released BOOLEAN,
  p_developers TEXT[],
  p_publishers TEXT[]
)
RETURNS VOID AS $$
DECLARE
  v_dev_name TEXT;
  v_pub_name TEXT;
  v_dev_id INTEGER;
  v_pub_id INTEGER;
  v_has_dev_or_pub BOOLEAN := FALSE;
BEGIN
  -- Update app with storefront data
  UPDATE apps SET
    name = p_name,
    type = p_type::app_type,
    is_free = p_is_free,
    release_date = p_release_date,
    release_date_raw = p_release_date_raw,
    has_workshop = p_has_workshop,
    current_price_cents = p_current_price_cents,
    current_discount_percent = p_current_discount_percent,
    is_released = p_is_released
  WHERE appid = p_appid;

  -- Upsert developers and create junction records
  IF p_developers IS NOT NULL THEN
    FOREACH v_dev_name IN ARRAY p_developers LOOP
      IF v_dev_name IS NOT NULL AND TRIM(v_dev_name) != '' THEN
        -- Upsert developer
        INSERT INTO developers (name)
        VALUES (TRIM(v_dev_name))
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_dev_id;

        -- Create junction record
        INSERT INTO app_developers (appid, developer_id)
        VALUES (p_appid, v_dev_id)
        ON CONFLICT (appid, developer_id) DO NOTHING;

        v_has_dev_or_pub := TRUE;
      END IF;
    END LOOP;
  END IF;

  -- Upsert publishers and create junction records
  IF p_publishers IS NOT NULL THEN
    FOREACH v_pub_name IN ARRAY p_publishers LOOP
      IF v_pub_name IS NOT NULL AND TRIM(v_pub_name) != '' THEN
        -- Upsert publisher
        INSERT INTO publishers (name)
        VALUES (TRIM(v_pub_name))
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id INTO v_pub_id;

        -- Create junction record
        INSERT INTO app_publishers (appid, publisher_id)
        VALUES (p_appid, v_pub_id)
        ON CONFLICT (appid, publisher_id) DO NOTHING;

        v_has_dev_or_pub := TRUE;
      END IF;
    END LOOP;
  END IF;

  -- Update has_developer_info flag if we linked any devs/pubs
  IF v_has_dev_or_pub THEN
    UPDATE apps SET has_developer_info = TRUE WHERE appid = p_appid;
  END IF;

  -- Update sync status
  UPDATE sync_status SET
    storefront_accessible = TRUE,
    last_storefront_sync = NOW(),
    consecutive_errors = 0,
    last_error_source = NULL,
    last_error_message = NULL,
    last_error_at = NULL
  WHERE appid = p_appid;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION upsert_storefront_app IS
  'Optimized single-call function to update app with storefront data, developers, publishers, and sync status';
