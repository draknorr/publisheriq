-- Migration: Add Steam change intelligence foundation
-- Creates snapshot history, change events, capture queue, news/media versioning,
-- sync_status extensions, hero asset metadata storage, and read/query RPCs.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_capture_source') THEN
    CREATE TYPE app_capture_source AS ENUM ('storefront', 'news', 'hero_asset');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_snapshot_source') THEN
    CREATE TYPE app_snapshot_source AS ENUM ('storefront', 'pics');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_change_source') THEN
    CREATE TYPE app_change_source AS ENUM ('storefront', 'pics', 'news', 'media');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_capture_status') THEN
    CREATE TYPE app_capture_status AS ENUM ('queued', 'claimed', 'completed', 'failed', 'dead_letter');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_change_type') THEN
    CREATE TYPE app_change_type AS ENUM (
      'description_rewrite',
      'short_description_rewrite',
      'release_date_text_change',
      'price_change',
      'discount_start',
      'discount_end',
      'tags_added',
      'tags_removed',
      'genres_changed',
      'categories_changed',
      'languages_changed',
      'platforms_changed',
      'controller_support_changed',
      'steam_deck_status_changed',
      'publisher_association_changed',
      'developer_association_changed',
      'dlc_references_changed',
      'package_references_changed',
      'build_id_changed',
      'last_content_update_changed',
      'news_published',
      'news_edited',
      'capsule_url_changed',
      'header_url_changed',
      'background_url_changed',
      'screenshot_added',
      'screenshot_removed',
      'screenshot_reordered',
      'trailer_added',
      'trailer_removed',
      'trailer_reordered',
      'trailer_thumbnail_changed'
    );
  END IF;
END $$;

ALTER TYPE app_change_type ADD VALUE IF NOT EXISTS 'package_references_changed';

ALTER TYPE sync_source ADD VALUE IF NOT EXISTS 'news';
ALTER TYPE sync_source ADD VALUE IF NOT EXISTS 'hero_asset';
ALTER TYPE sync_source ADD VALUE IF NOT EXISTS 'change_hints';

CREATE TABLE IF NOT EXISTS app_source_snapshots (
  id BIGSERIAL PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  source app_snapshot_source NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  content_hash TEXT NOT NULL,
  previous_snapshot_id BIGINT REFERENCES app_source_snapshots(id) ON DELETE SET NULL,
  trigger_reason TEXT NOT NULL,
  trigger_cursor TEXT,
  snapshot_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS steam_news_items (
  gid TEXT PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  url TEXT NOT NULL,
  author TEXT,
  feedlabel TEXT,
  feedname TEXT,
  published_at TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS steam_news_versions (
  id BIGSERIAL PRIMARY KEY,
  gid TEXT NOT NULL REFERENCES steam_news_items(gid) ON DELETE CASCADE,
  content_hash TEXT NOT NULL,
  title TEXT,
  contents TEXT,
  url TEXT NOT NULL,
  previous_version_id BIGINT REFERENCES steam_news_versions(id) ON DELETE SET NULL,
  normalized_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_media_versions (
  id BIGSERIAL PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  storefront_snapshot_id BIGINT REFERENCES app_source_snapshots(id) ON DELETE SET NULL,
  content_hash TEXT NOT NULL,
  hero_assets JSONB NOT NULL DEFAULT '{}'::jsonb,
  screenshots JSONB NOT NULL DEFAULT '[]'::jsonb,
  trailers JSONB NOT NULL DEFAULT '[]'::jsonb,
  previous_version_id BIGINT REFERENCES app_media_versions(id) ON DELETE SET NULL,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_hero_asset_versions (
  id UUID PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  asset_kind TEXT NOT NULL CHECK (asset_kind IN ('header', 'capsule', 'background')),
  source_url TEXT NOT NULL,
  object_key TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  mime_type TEXT,
  content_length INTEGER NOT NULL,
  width INTEGER,
  height INTEGER,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_change_events (
  id BIGSERIAL PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  source app_change_source NOT NULL,
  change_type app_change_type NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_snapshot_id BIGINT REFERENCES app_source_snapshots(id) ON DELETE SET NULL,
  related_snapshot_id BIGINT REFERENCES app_source_snapshots(id) ON DELETE SET NULL,
  media_version_id BIGINT REFERENCES app_media_versions(id) ON DELETE SET NULL,
  news_item_gid TEXT REFERENCES steam_news_items(gid) ON DELETE SET NULL,
  before_value JSONB,
  after_value JSONB,
  context JSONB NOT NULL DEFAULT '{}'::jsonb,
  trigger_cursor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_capture_queue (
  id BIGSERIAL PRIMARY KEY,
  appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  source app_capture_source NOT NULL,
  status app_capture_status NOT NULL DEFAULT 'queued',
  priority INTEGER NOT NULL DEFAULT 100,
  trigger_reason TEXT NOT NULL,
  trigger_cursor TEXT NOT NULL DEFAULT '',
  attempts INTEGER NOT NULL DEFAULT 0,
  available_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  claimed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  worker_id TEXT,
  last_error TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE sync_status
  ADD COLUMN IF NOT EXISTS steam_last_modified BIGINT,
  ADD COLUMN IF NOT EXISTS steam_price_change_number BIGINT,
  ADD COLUMN IF NOT EXISTS last_news_sync TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_media_sync TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_app_source_snapshots_app_source_time
  ON app_source_snapshots(appid, source, first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_source_snapshots_source_time
  ON app_source_snapshots(source, first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_steam_news_items_appid_published
  ON steam_news_items(appid, published_at DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_steam_news_versions_gid_time
  ON steam_news_versions(gid, first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_media_versions_appid_time
  ON app_media_versions(appid, first_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_hero_asset_versions_appid_time
  ON app_hero_asset_versions(appid, first_seen_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_hero_asset_versions_unique_content
  ON app_hero_asset_versions(appid, asset_kind, content_hash);

CREATE INDEX IF NOT EXISTS idx_app_change_events_appid_time
  ON app_change_events(appid, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_change_events_type_time
  ON app_change_events(change_type, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_change_events_source_time
  ON app_change_events(source, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_capture_queue_status_source_priority
  ON app_capture_queue(status, source, priority DESC, available_at ASC, id ASC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_app_capture_queue_dedupe_active
  ON app_capture_queue(appid, source, trigger_cursor)
  WHERE status IN ('queued', 'claimed');

CREATE INDEX IF NOT EXISTS idx_sync_status_change_hints
  ON sync_status(steam_last_modified DESC NULLS LAST, steam_price_change_number DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_sync_status_news_media
  ON sync_status(last_news_sync, last_media_sync);

COMMENT ON TABLE app_source_snapshots IS
  'Normalized storefront and PICS snapshots. Raw payloads stay out of hot tables; only normalized JSONB is stored here.';

COMMENT ON TABLE app_change_events IS
  'Structured change feed derived from snapshot, media, and news version changes.';

COMMENT ON TABLE app_capture_queue IS
  'Durable capture queue for storefront/news recaptures and hero asset archival.';

COMMENT ON TABLE steam_news_items IS
  'Stable Steam news item records keyed by gid.';

COMMENT ON TABLE steam_news_versions IS
  'Version history for Steam news items when normalized content changes.';

COMMENT ON TABLE app_media_versions IS
  'Versioned media surface derived from storefront snapshots, including hero URLs and ordered screenshots/trailers.';

COMMENT ON TABLE app_hero_asset_versions IS
  'Archived hero asset binaries and metadata stored in Supabase Storage, deduped by sha256 hash.';

COMMENT ON COLUMN sync_status.steam_last_modified IS
  'Latest IStoreService/GetAppList.last_modified hint observed for this app.';

COMMENT ON COLUMN sync_status.steam_price_change_number IS
  'Latest IStoreService/GetAppList.price_change_number hint observed for this app.';

COMMENT ON COLUMN sync_status.last_news_sync IS
  'Last successful Steam News capture for this app.';

COMMENT ON COLUMN sync_status.last_media_sync IS
  'Last successful storefront media extraction for this app.';

CREATE OR REPLACE FUNCTION claim_app_capture_queue(
  p_sources app_capture_source[],
  p_worker_id TEXT,
  p_limit INTEGER DEFAULT 50
)
RETURNS TABLE (
  id BIGINT,
  appid INTEGER,
  source app_capture_source,
  priority INTEGER,
  trigger_reason TEXT,
  trigger_cursor TEXT,
  payload JSONB,
  attempts INTEGER,
  available_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH candidates AS (
    SELECT q.id
    FROM app_capture_queue q
    WHERE q.status = 'queued'
      AND q.available_at <= NOW()
      AND q.source = ANY (p_sources)
    ORDER BY q.priority DESC, q.available_at ASC, q.id ASC
    FOR UPDATE SKIP LOCKED
    LIMIT LEAST(COALESCE(p_limit, 50), 500)
  )
  UPDATE app_capture_queue q
  SET status = 'claimed',
      worker_id = p_worker_id,
      claimed_at = NOW(),
      attempts = q.attempts + 1
  FROM candidates c
  WHERE q.id = c.id
  RETURNING q.id, q.appid, q.source, q.priority, q.trigger_reason, q.trigger_cursor, q.payload, q.attempts, q.available_at;
END;
$$;

CREATE OR REPLACE FUNCTION complete_app_capture_queue(
  p_ids BIGINT[],
  p_status app_capture_status DEFAULT 'completed',
  p_error TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  IF p_status NOT IN ('completed', 'failed', 'queued', 'dead_letter') THEN
    RAISE EXCEPTION 'Unsupported queue completion status: %', p_status;
  END IF;

  UPDATE app_capture_queue
  SET status = p_status,
      last_error = CASE WHEN p_status = 'completed' THEN NULL ELSE p_error END,
      worker_id = CASE WHEN p_status = 'queued' THEN NULL ELSE worker_id END,
      claimed_at = CASE WHEN p_status = 'queued' THEN NULL ELSE claimed_at END,
      completed_at = CASE WHEN p_status IN ('completed', 'failed', 'dead_letter') THEN NOW() ELSE NULL END,
      available_at = CASE WHEN p_status = 'queued' THEN NOW() ELSE available_at END
  WHERE id = ANY (p_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

CREATE OR REPLACE FUNCTION get_change_window_metrics(
  p_appid INTEGER,
  p_start TIMESTAMPTZ,
  p_end TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily JSONB;
  v_reviews JSONB;
  v_ccu JSONB;
BEGIN
  SELECT jsonb_build_object(
    'days', COUNT(*),
    'avg_price_cents', AVG(dm.price_cents),
    'avg_discount_percent', AVG(dm.discount_percent),
    'max_total_reviews', MAX(dm.total_reviews),
    'avg_review_score', AVG(dm.review_score),
    'max_ccu_peak', MAX(dm.ccu_peak)
  )
  INTO v_daily
  FROM daily_metrics dm
  WHERE dm.appid = p_appid
    AND dm.metric_date BETWEEN p_start::date AND p_end::date;

  SELECT jsonb_build_object(
    'days', COUNT(*),
    'reviews_added', COALESCE(SUM(rd.reviews_added), 0),
    'positive_added', COALESCE(SUM(rd.positive_added), 0),
    'negative_added', COALESCE(SUM(rd.negative_added), 0),
    'avg_daily_velocity', AVG(rd.daily_velocity)
  )
  INTO v_reviews
  FROM review_deltas rd
  WHERE rd.appid = p_appid
    AND rd.delta_date BETWEEN p_start::date AND p_end::date;

  SELECT jsonb_build_object(
    'samples', COUNT(*),
    'avg_player_count', AVG(source_data.player_count),
    'max_player_count', MAX(source_data.player_count),
    'source', MAX(source_data.source_label)
  )
  INTO v_ccu
  FROM (
    SELECT cs.player_count, 'ccu_snapshots'::TEXT AS source_label
    FROM ccu_snapshots cs
    WHERE cs.appid = p_appid
      AND cs.snapshot_time BETWEEN p_start AND p_end

    UNION ALL

    SELECT dm.ccu_peak AS player_count, 'daily_metrics'::TEXT AS source_label
    FROM daily_metrics dm
    WHERE dm.appid = p_appid
      AND dm.metric_date BETWEEN p_start::date AND p_end::date
      AND NOT EXISTS (
        SELECT 1
        FROM ccu_snapshots cs
        WHERE cs.appid = p_appid
          AND cs.snapshot_time BETWEEN p_start AND p_end
      )
  ) source_data;

  RETURN jsonb_build_object(
    'daily_metrics', COALESCE(v_daily, '{}'::jsonb),
    'review_deltas', COALESCE(v_reviews, '{}'::jsonb),
    'ccu', COALESCE(v_ccu, '{}'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_app_change_feed(
  p_appid INTEGER,
  p_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_to TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  appid INTEGER,
  app_name TEXT,
  event_id BIGINT,
  source TEXT,
  change_type app_change_type,
  occurred_at TIMESTAMPTZ,
  before_value JSONB,
  after_value JSONB,
  context JSONB,
  source_snapshot_id BIGINT,
  related_snapshot_id BIGINT,
  media_version_id BIGINT,
  news_item_gid TEXT,
  baseline_7d JSONB,
  baseline_30d JSONB,
  response_1d JSONB,
  response_7d JSONB,
  response_30d JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      e.appid,
      a.name AS app_name,
      e.id AS event_id,
      e.source,
      e.change_type,
      e.occurred_at,
      e.before_value,
      e.after_value,
      e.context,
      e.source_snapshot_id,
      e.related_snapshot_id,
      e.media_version_id,
      e.news_item_gid
    FROM app_change_events e
    JOIN apps a ON a.appid = e.appid
    WHERE e.appid = p_appid
      AND e.occurred_at >= COALESCE(p_from, NOW() - INTERVAL '30 days')
      AND e.occurred_at <= COALESCE(p_to, NOW())
    ORDER BY e.occurred_at DESC
    LIMIT LEAST(COALESCE(p_limit, 100), 500)
  )
  SELECT
    b.appid,
    b.app_name,
    b.event_id,
    b.source,
    b.change_type,
    b.occurred_at,
    b.before_value,
    b.after_value,
    b.context,
    b.source_snapshot_id,
    b.related_snapshot_id,
    b.media_version_id,
    b.news_item_gid,
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '7 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '30 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '1 day'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '7 days'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '30 days')
  FROM base b
  ORDER BY b.occurred_at DESC;
$$;

CREATE OR REPLACE FUNCTION get_recent_app_changes(
  p_days INTEGER DEFAULT 30,
  p_types app_change_type[] DEFAULT NULL,
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  appid INTEGER,
  app_name TEXT,
  event_id BIGINT,
  source TEXT,
  change_type app_change_type,
  occurred_at TIMESTAMPTZ,
  before_value JSONB,
  after_value JSONB,
  context JSONB,
  source_snapshot_id BIGINT,
  related_snapshot_id BIGINT,
  media_version_id BIGINT,
  news_item_gid TEXT,
  baseline_7d JSONB,
  baseline_30d JSONB,
  response_1d JSONB,
  response_7d JSONB,
  response_30d JSONB
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH base AS (
    SELECT
      e.appid,
      a.name AS app_name,
      e.id AS event_id,
      e.source,
      e.change_type,
      e.occurred_at,
      e.before_value,
      e.after_value,
      e.context,
      e.source_snapshot_id,
      e.related_snapshot_id,
      e.media_version_id,
      e.news_item_gid
    FROM app_change_events e
    JOIN apps a ON a.appid = e.appid
    WHERE e.occurred_at >= NOW() - make_interval(days => GREATEST(COALESCE(p_days, 30), 1))
      AND (p_types IS NULL OR e.change_type = ANY (p_types))
    ORDER BY e.occurred_at DESC
    LIMIT LEAST(COALESCE(p_limit, 100), 500)
  )
  SELECT
    b.appid,
    b.app_name,
    b.event_id,
    b.source,
    b.change_type,
    b.occurred_at,
    b.before_value,
    b.after_value,
    b.context,
    b.source_snapshot_id,
    b.related_snapshot_id,
    b.media_version_id,
    b.news_item_gid,
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '7 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at - INTERVAL '30 days', b.occurred_at),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '1 day'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '7 days'),
    get_change_window_metrics(b.appid, b.occurred_at, b.occurred_at + INTERVAL '30 days')
  FROM base b
  ORDER BY b.occurred_at DESC;
$$;

ALTER TABLE app_source_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_news_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_news_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_media_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_hero_asset_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_change_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_capture_queue ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS trigger_steam_news_items_updated_at ON steam_news_items;
CREATE TRIGGER trigger_steam_news_items_updated_at
  BEFORE UPDATE ON steam_news_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

REVOKE EXECUTE ON FUNCTION claim_app_capture_queue(app_capture_source[], TEXT, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION claim_app_capture_queue(app_capture_source[], TEXT, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION claim_app_capture_queue(app_capture_source[], TEXT, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION claim_app_capture_queue(app_capture_source[], TEXT, INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION complete_app_capture_queue(BIGINT[], app_capture_status, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION complete_app_capture_queue(BIGINT[], app_capture_status, TEXT) FROM anon;
REVOKE EXECUTE ON FUNCTION complete_app_capture_queue(BIGINT[], app_capture_status, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION complete_app_capture_queue(BIGINT[], app_capture_status, TEXT) TO service_role;

REVOKE EXECUTE ON FUNCTION get_change_window_metrics(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_change_window_metrics(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM anon;
REVOKE EXECUTE ON FUNCTION get_change_window_metrics(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) FROM authenticated;
GRANT EXECUTE ON FUNCTION get_change_window_metrics(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ) TO service_role;

REVOKE EXECUTE ON FUNCTION get_app_change_feed(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_app_change_feed(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION get_app_change_feed(INTEGER, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION get_recent_app_changes(INTEGER, app_change_type[], INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION get_recent_app_changes(INTEGER, app_change_type[], INTEGER) FROM anon;
GRANT EXECUTE ON FUNCTION get_recent_app_changes(INTEGER, app_change_type[], INTEGER) TO authenticated, service_role;
