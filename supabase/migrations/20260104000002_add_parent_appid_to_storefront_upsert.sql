-- Migration: Add p_parent_appid parameter to upsert_storefront_app
--
-- This allows setting parent_appid from Storefront API's fullgame field
-- for DLC items. Includes validation to only accept parent if it exists.

-- Drop the old function signature to avoid overloading
DROP FUNCTION IF EXISTS upsert_storefront_app(INTEGER, TEXT, TEXT, BOOLEAN, DATE, TEXT, BOOLEAN, INTEGER, INTEGER, BOOLEAN, TEXT[], TEXT[], INTEGER[]);

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
  p_publishers TEXT[],
  p_dlc_appids INTEGER[] DEFAULT NULL,
  p_parent_appid INTEGER DEFAULT NULL  -- NEW: Parent game appid for DLC (from fullgame field)
)
RETURNS VOID AS $$
DECLARE
  v_dev_name TEXT;
  v_pub_name TEXT;
  v_dev_id INTEGER;
  v_pub_id INTEGER;
  v_has_dev_or_pub BOOLEAN := FALSE;
  v_valid_parent BOOLEAN := FALSE;
BEGIN
  -- Validate parent_appid exists in apps table (prevent garbage data)
  IF p_parent_appid IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM apps WHERE appid = p_parent_appid) INTO v_valid_parent;
  END IF;

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
    is_released = p_is_released,
    -- Only set parent_appid if valid (exists in apps table)
    parent_appid = CASE
      WHEN v_valid_parent THEN p_parent_appid
      ELSE parent_appid  -- Keep existing value
    END
  WHERE appid = p_appid;

  -- Upsert developers and create junction records
  IF p_developers IS NOT NULL THEN
    FOREACH v_dev_name IN ARRAY p_developers LOOP
      IF v_dev_name IS NOT NULL AND TRIM(v_dev_name) != '' THEN
        -- Upsert developer (include normalized_name)
        INSERT INTO developers (name, normalized_name)
        VALUES (TRIM(v_dev_name), LOWER(TRIM(v_dev_name)))
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
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
        -- Upsert publisher (include normalized_name)
        INSERT INTO publishers (name, normalized_name)
        VALUES (TRIM(v_pub_name), LOWER(TRIM(v_pub_name)))
        ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
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

  -- Sync DLC relationships to junction table
  -- Only insert DLC appids that exist in apps table (avoid FK violations)
  IF p_dlc_appids IS NOT NULL AND array_length(p_dlc_appids, 1) > 0 THEN
    INSERT INTO app_dlc (parent_appid, dlc_appid, source)
    SELECT p_appid, dlc_id, 'storefront'
    FROM unnest(p_dlc_appids) AS dlc_id
    WHERE EXISTS (SELECT 1 FROM apps WHERE appid = dlc_id)
    ON CONFLICT (parent_appid, dlc_appid) DO UPDATE SET source = 'storefront';
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

COMMENT ON FUNCTION upsert_storefront_app(INTEGER, TEXT, TEXT, BOOLEAN, DATE, TEXT, BOOLEAN, INTEGER, INTEGER, BOOLEAN, TEXT[], TEXT[], INTEGER[], INTEGER) IS
  'Optimized single-call function to update app with storefront data, developers, publishers, DLC relationships, parent_appid, and sync status';
