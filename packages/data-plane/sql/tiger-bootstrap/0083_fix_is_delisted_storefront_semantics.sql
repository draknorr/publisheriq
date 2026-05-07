-- Fix storefront delisting semantics in Tiger.
--
-- `legacy.apps.is_delisted` now means the Steam storefront is inaccessible or
-- removed. Accessible pages without purchase package references are represented
-- by `legacy.apps.has_purchase_packages = false`.

SET statement_timeout = '15min';

ALTER TABLE legacy.apps
  ADD COLUMN IF NOT EXISTS has_purchase_packages boolean;

COMMENT ON COLUMN legacy.apps.is_delisted IS
  'True when the Steam storefront is inaccessible/removed. Does not mean an accessible page lacks purchase packages.';

COMMENT ON COLUMN legacy.apps.has_purchase_packages IS
  'True when the latest accessible Steam storefront payload exposed package/package-group purchase references; false when accessible but not currently purchasable; null when unknown or inaccessible.';

CREATE OR REPLACE FUNCTION legacy.upsert_storefront_app(
    p_appid integer,
    p_name text,
    p_type text,
    p_is_free boolean,
    p_is_delisted boolean,
    p_release_date date,
    p_release_date_raw text,
    p_has_workshop boolean,
    p_current_price_cents integer,
    p_current_discount_percent integer,
    p_is_released boolean,
    p_developers text[],
    p_publishers text[],
    p_dlc_appids integer[] DEFAULT ARRAY[]::integer[],
    p_parent_appid integer DEFAULT NULL,
    p_has_purchase_packages boolean DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    v_developer_id integer;
    v_developer_name text;
    v_dlc_appid integer;
    v_publisher_id integer;
    v_publisher_name text;
BEGIN
    INSERT INTO legacy.apps (
      appid, name, type, is_free, is_delisted, has_purchase_packages,
      release_date, release_date_raw, has_workshop, current_price_cents,
      current_discount_percent, is_released, parent_appid,
      has_developer_info, updated_at
    )
    VALUES (
      p_appid, p_name, COALESCE(p_type, 'game'), COALESCE(p_is_free, false),
      COALESCE(p_is_delisted, false), p_has_purchase_packages,
      p_release_date, p_release_date_raw,
      COALESCE(p_has_workshop, false), p_current_price_cents,
      COALESCE(p_current_discount_percent, 0), COALESCE(p_is_released, true),
      p_parent_appid,
      COALESCE(array_length(p_developers, 1), 0) > 0
        OR COALESCE(array_length(p_publishers, 1), 0) > 0,
      now()
    )
    ON CONFLICT (appid)
    DO UPDATE SET
      name = EXCLUDED.name,
      type = EXCLUDED.type,
      is_free = EXCLUDED.is_free,
      is_delisted = EXCLUDED.is_delisted,
      has_purchase_packages = EXCLUDED.has_purchase_packages,
      release_date = EXCLUDED.release_date,
      release_date_raw = EXCLUDED.release_date_raw,
      has_workshop = EXCLUDED.has_workshop,
      current_price_cents = EXCLUDED.current_price_cents,
      current_discount_percent = EXCLUDED.current_discount_percent,
      is_released = EXCLUDED.is_released,
      parent_appid = EXCLUDED.parent_appid,
      has_developer_info = EXCLUDED.has_developer_info,
      updated_at = now();

    DELETE FROM legacy.app_developers WHERE appid = p_appid;
    FOREACH v_developer_name IN ARRAY COALESCE(p_developers, ARRAY[]::text[])
    LOOP
      v_developer_name := btrim(v_developer_name);
      IF v_developer_name IS NULL OR v_developer_name = '' THEN
        CONTINUE;
      END IF;

      INSERT INTO legacy.developers (name, normalized_name, updated_at)
      VALUES (v_developer_name, lower(v_developer_name), now())
      ON CONFLICT (normalized_name)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id INTO v_developer_id;

      INSERT INTO legacy.app_developers (appid, developer_id)
      VALUES (p_appid, v_developer_id)
      ON CONFLICT (appid, developer_id) DO NOTHING;
    END LOOP;

    DELETE FROM legacy.app_publishers WHERE appid = p_appid;
    FOREACH v_publisher_name IN ARRAY COALESCE(p_publishers, ARRAY[]::text[])
    LOOP
      v_publisher_name := btrim(v_publisher_name);
      IF v_publisher_name IS NULL OR v_publisher_name = '' THEN
        CONTINUE;
      END IF;

      INSERT INTO legacy.publishers (name, normalized_name, updated_at)
      VALUES (v_publisher_name, lower(v_publisher_name), now())
      ON CONFLICT (normalized_name)
      DO UPDATE SET name = EXCLUDED.name, updated_at = now()
      RETURNING id INTO v_publisher_id;

      INSERT INTO legacy.app_publishers (appid, publisher_id)
      VALUES (p_appid, v_publisher_id)
      ON CONFLICT (appid, publisher_id) DO NOTHING;
    END LOOP;

    DELETE FROM legacy.app_dlc WHERE parent_appid = p_appid AND source = 'storefront';
    FOREACH v_dlc_appid IN ARRAY COALESCE(p_dlc_appids, ARRAY[]::integer[])
    LOOP
      IF v_dlc_appid IS NULL OR v_dlc_appid <= 0 THEN
        CONTINUE;
      END IF;

      INSERT INTO legacy.app_dlc (parent_appid, dlc_appid, source)
      VALUES (p_appid, v_dlc_appid, 'storefront')
      ON CONFLICT (parent_appid, dlc_appid)
      DO UPDATE SET source = EXCLUDED.source;
    END LOOP;

    INSERT INTO ops.sync_status (
      appid, storefront_accessible, last_storefront_sync, updated_at
    )
    VALUES (p_appid, true, now(), now())
    ON CONFLICT (appid)
    DO UPDATE SET
      storefront_accessible = true,
      last_storefront_sync = EXCLUDED.last_storefront_sync,
      last_error_source = NULL,
      last_error_message = NULL,
      last_error_at = NULL,
      updated_at = now();
END;
$$;

WITH latest_storefront_snapshot AS (
  SELECT DISTINCT ON (appid)
    appid,
    snapshot_summary
  FROM docs.app_source_snapshots
  WHERE source = 'storefront'
  ORDER BY appid, first_seen_at DESC, id DESC
)
UPDATE legacy.apps a
SET has_purchase_packages = (
  COALESCE((latest.snapshot_summary #>> '{counts,packageIds}')::integer, 0)
  + COALESCE((latest.snapshot_summary #>> '{counts,packageGroupSubs}')::integer, 0)
) > 0
FROM latest_storefront_snapshot latest
JOIN ops.sync_status s ON s.appid = latest.appid
WHERE a.appid = latest.appid
  AND COALESCE(s.storefront_accessible, false) = true;

CREATE TABLE IF NOT EXISTS ops.storefront_delisted_repair_audit_20260506 (
  appid integer PRIMARY KEY,
  old_is_delisted boolean,
  new_is_delisted boolean,
  repaired_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO ops.storefront_delisted_repair_audit_20260506 (
  appid,
  old_is_delisted,
  new_is_delisted
)
SELECT
  a.appid,
  a.is_delisted AS old_is_delisted,
  CASE
    WHEN COALESCE(s.storefront_accessible, false) = true THEN false
    WHEN COALESCE(s.storefront_accessible, false) = false THEN true
    ELSE a.is_delisted
  END AS new_is_delisted
FROM legacy.apps a
LEFT JOIN ops.sync_status s ON s.appid = a.appid
WHERE s.storefront_accessible IS NOT NULL
  AND a.is_delisted IS DISTINCT FROM (
    CASE
      WHEN COALESCE(s.storefront_accessible, false) = true THEN false
      WHEN COALESCE(s.storefront_accessible, false) = false THEN true
      ELSE a.is_delisted
    END
  )
ON CONFLICT (appid) DO NOTHING;

UPDATE legacy.apps a
SET
  is_delisted = audit.new_is_delisted,
  has_purchase_packages = CASE
    WHEN audit.new_is_delisted THEN NULL
    ELSE a.has_purchase_packages
  END,
  updated_at = now()
FROM ops.storefront_delisted_repair_audit_20260506 audit
WHERE audit.appid = a.appid;
