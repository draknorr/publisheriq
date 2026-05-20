-- Persist Steam Storefront demo/prologue relationships discovered from parent
-- app payloads. This is Tiger-only; Supabase ingestion surfaces are unchanged.

SET statement_timeout = '15min';

CREATE TABLE IF NOT EXISTS legacy.app_demos (
    parent_appid integer NOT NULL,
    demo_appid integer NOT NULL,
    source text NOT NULL DEFAULT 'storefront',
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT legacy_app_demos_pkey PRIMARY KEY (parent_appid, demo_appid)
);

COMMENT ON TABLE legacy.app_demos IS
  'Steam Storefront parent-to-demo/prologue app relationships discovered from parent appdetails payloads.';

CREATE INDEX IF NOT EXISTS idx_legacy_app_demos_parent
  ON legacy.app_demos (parent_appid);

CREATE INDEX IF NOT EXISTS idx_legacy_app_demos_child
  ON legacy.app_demos (demo_appid);

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
    p_demo_appids integer[] DEFAULT ARRAY[]::integer[],
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
    IF p_parent_appid IS NOT NULL AND p_parent_appid > 0 AND p_parent_appid <> p_appid THEN
      INSERT INTO legacy.apps (
        appid, name, type, catalog_seed_state, is_delisted, has_purchase_packages,
        created_at, updated_at
      )
      VALUES (
        p_parent_appid,
        format('Steam app %s (pending metadata)', p_parent_appid),
        'game',
        'stub',
        false,
        NULL,
        now(),
        now()
      )
      ON CONFLICT (appid) DO NOTHING;

      INSERT INTO ops.sync_status (
        appid, priority_score, next_sync_after, is_syncable, updated_at
      )
      VALUES (p_parent_appid, 5, now(), true, now())
      ON CONFLICT (appid) DO NOTHING;
    END IF;

    IF COALESCE(array_length(p_demo_appids, 1), 0) > 0 THEN
      WITH unique_demos AS (
        SELECT DISTINCT demo_appid
        FROM unnest(p_demo_appids) AS demo_appid
        WHERE demo_appid IS NOT NULL
          AND demo_appid > 0
          AND demo_appid <> p_appid
      ),
      seeded_apps AS (
        INSERT INTO legacy.apps (
          appid, name, type, parent_appid, catalog_seed_state,
          is_delisted, has_purchase_packages, created_at, updated_at
        )
        SELECT
          demo_appid,
          format('Steam app %s (pending metadata)', demo_appid),
          'demo',
          p_appid,
          'stub',
          false,
          NULL,
          now(),
          now()
        FROM unique_demos
        ON CONFLICT (appid)
        DO UPDATE SET
          type = CASE
            WHEN legacy.apps.catalog_seed_state = 'stub' THEN 'demo'
            ELSE legacy.apps.type
          END,
          parent_appid = COALESCE(legacy.apps.parent_appid, EXCLUDED.parent_appid),
          updated_at = CASE
            WHEN legacy.apps.catalog_seed_state = 'stub'
              OR legacy.apps.parent_appid IS NULL
            THEN now()
            ELSE legacy.apps.updated_at
          END
        RETURNING appid
      )
      INSERT INTO ops.sync_status (
        appid, priority_score, next_sync_after, is_syncable, updated_at
      )
      SELECT appid, 20, now(), true, now()
      FROM seeded_apps
      ON CONFLICT (appid)
      DO UPDATE SET
        priority_score = GREATEST(COALESCE(ops.sync_status.priority_score, 0), 20),
        is_syncable = true,
        updated_at = now();
    END IF;

    INSERT INTO legacy.apps (
      appid, name, type, is_free, is_delisted, has_purchase_packages,
      release_date, release_date_raw, has_workshop, current_price_cents,
      current_discount_percent, is_released, parent_appid,
      catalog_seed_state, has_developer_info, updated_at
    )
    VALUES (
      p_appid, p_name, COALESCE(p_type, 'game'), COALESCE(p_is_free, false),
      COALESCE(p_is_delisted, false), p_has_purchase_packages,
      p_release_date, p_release_date_raw,
      COALESCE(p_has_workshop, false), p_current_price_cents,
      COALESCE(p_current_discount_percent, 0), COALESCE(p_is_released, true),
      CASE
        WHEN p_parent_appid IS NOT NULL AND p_parent_appid > 0 AND p_parent_appid <> p_appid
          THEN p_parent_appid
        ELSE NULL
      END,
      'hydrated',
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
      catalog_seed_state = 'hydrated',
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
      IF v_dlc_appid IS NULL OR v_dlc_appid <= 0 OR v_dlc_appid = p_appid THEN
        CONTINUE;
      END IF;

      INSERT INTO legacy.app_dlc (parent_appid, dlc_appid, source)
      VALUES (p_appid, v_dlc_appid, 'storefront')
      ON CONFLICT (parent_appid, dlc_appid)
      DO UPDATE SET source = EXCLUDED.source;
    END LOOP;

    DELETE FROM legacy.app_demos WHERE parent_appid = p_appid AND source = 'storefront';
    INSERT INTO legacy.app_demos (parent_appid, demo_appid, source)
    SELECT DISTINCT p_appid, demo_appid, 'storefront'
    FROM unnest(COALESCE(p_demo_appids, ARRAY[]::integer[])) AS demo_appid
    WHERE demo_appid IS NOT NULL
      AND demo_appid > 0
      AND demo_appid <> p_appid
    ON CONFLICT (parent_appid, demo_appid)
    DO UPDATE SET source = EXCLUDED.source;

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

COMMENT ON FUNCTION legacy.upsert_storefront_app(
  integer, text, text, boolean, boolean, date, text, boolean, integer,
  integer, boolean, text[], text[], integer[], integer, integer[], boolean
) IS
  'Tiger Storefront upsert that persists DLC and demo references, seeds demo stubs, and treats is_delisted as inaccessible/removed.';
