-- Migration: Fix case-insensitive conflict detection for publisher/developer upserts
--
-- Problem: ON CONFLICT (name) is case-sensitive but idx_*_name_ci is case-insensitive
-- This causes race conditions when concurrent workers insert same publisher with different casing
--
-- Solution: Use normalized_name (already stores LOWER(TRIM(name))) for conflict detection
-- First writer wins for canonical casing

-- Add unique constraint on normalized_name (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'publishers_normalized_name_key') THEN
    ALTER TABLE publishers ADD CONSTRAINT publishers_normalized_name_key UNIQUE (normalized_name);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'developers_normalized_name_key') THEN
    ALTER TABLE developers ADD CONSTRAINT developers_normalized_name_key UNIQUE (normalized_name);
  END IF;
END $$;

-- Drop the ad-hoc CI indexes (now redundant with normalized_name unique constraint)
DROP INDEX IF EXISTS idx_publishers_name_ci;
DROP INDEX IF EXISTS idx_developers_name_ci;

-- Update upsert function to use normalized_name for conflict detection
DROP FUNCTION IF EXISTS upsert_storefront_app(INTEGER, TEXT, TEXT, BOOLEAN, DATE, TEXT, BOOLEAN, INTEGER, INTEGER, BOOLEAN, TEXT[], TEXT[], INTEGER[], INTEGER);

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
  p_parent_appid INTEGER DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_valid_parent BOOLEAN := FALSE;
  v_has_dev_or_pub BOOLEAN := FALSE;
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
    parent_appid = CASE
      WHEN v_valid_parent THEN p_parent_appid
      ELSE parent_appid
    END
  WHERE appid = p_appid;

  -- Bulk upsert developers and create junction records using unnest()
  -- Use normalized_name for conflict detection (case-insensitive)
  -- DISTINCT prevents "ON CONFLICT DO UPDATE cannot affect row a second time" error
  IF p_developers IS NOT NULL AND array_length(p_developers, 1) > 0 THEN
    WITH valid_names AS (
      SELECT DISTINCT TRIM(dev_name) as name, LOWER(TRIM(dev_name)) as normalized_name
      FROM unnest(p_developers) AS dev_name
      WHERE dev_name IS NOT NULL AND TRIM(dev_name) != ''
    ),
    dev_upserts AS (
      INSERT INTO developers (name, normalized_name)
      SELECT vn.name, vn.normalized_name
      FROM valid_names vn
      ON CONFLICT (normalized_name) DO UPDATE SET updated_at = NOW()
      RETURNING id, name
    )
    INSERT INTO app_developers (appid, developer_id)
    SELECT p_appid, du.id
    FROM dev_upserts du
    ON CONFLICT (appid, developer_id) DO NOTHING;

    -- Check if we had any developers
    SELECT EXISTS(
      SELECT 1 FROM unnest(p_developers) AS dev_name
      WHERE dev_name IS NOT NULL AND TRIM(dev_name) != ''
    ) INTO v_has_dev_or_pub;
  END IF;

  -- Bulk upsert publishers and create junction records using unnest()
  -- Use normalized_name for conflict detection (case-insensitive)
  -- DISTINCT prevents "ON CONFLICT DO UPDATE cannot affect row a second time" error
  IF p_publishers IS NOT NULL AND array_length(p_publishers, 1) > 0 THEN
    WITH valid_names AS (
      SELECT DISTINCT TRIM(pub_name) as name, LOWER(TRIM(pub_name)) as normalized_name
      FROM unnest(p_publishers) AS pub_name
      WHERE pub_name IS NOT NULL AND TRIM(pub_name) != ''
    ),
    pub_upserts AS (
      INSERT INTO publishers (name, normalized_name)
      SELECT vn.name, vn.normalized_name
      FROM valid_names vn
      ON CONFLICT (normalized_name) DO UPDATE SET updated_at = NOW()
      RETURNING id, name
    )
    INSERT INTO app_publishers (appid, publisher_id)
    SELECT p_appid, pu.id
    FROM pub_upserts pu
    ON CONFLICT (appid, publisher_id) DO NOTHING;

    -- Check if we had any publishers
    IF NOT v_has_dev_or_pub THEN
      SELECT EXISTS(
        SELECT 1 FROM unnest(p_publishers) AS pub_name
        WHERE pub_name IS NOT NULL AND TRIM(pub_name) != ''
      ) INTO v_has_dev_or_pub;
    END IF;
  END IF;

  -- Update has_developer_info flag if we linked any devs/pubs
  IF v_has_dev_or_pub THEN
    UPDATE apps SET has_developer_info = TRUE WHERE appid = p_appid;
  END IF;

  -- Sync DLC relationships to junction table
  -- DISTINCT prevents duplicate DLC entries
  IF p_dlc_appids IS NOT NULL AND array_length(p_dlc_appids, 1) > 0 THEN
    INSERT INTO app_dlc (parent_appid, dlc_appid, source)
    SELECT DISTINCT p_appid, dlc_id, 'storefront'
    FROM unnest(p_dlc_appids) AS dlc_id
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
  'Single-call upsert using normalized_name for case-insensitive conflict detection';
