-- =============================================
-- Migration: Add PICS Data Storage
-- File: 20251230000000_add_pics_data.sql
-- Description: Adds tables and columns for Steam PICS data
-- =============================================

-- =============================================
-- 1. NEW ENUM TYPES
-- =============================================

-- Steam Deck compatibility category
DO $$ BEGIN
    CREATE TYPE steam_deck_category AS ENUM ('unknown', 'unsupported', 'playable', 'verified');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- 2. REFERENCE TABLES
-- =============================================

-- Steam Tags (official tag ID -> name mapping)
CREATE TABLE IF NOT EXISTS steam_tags (
    tag_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steam Genres (official genre ID -> name mapping)
CREATE TABLE IF NOT EXISTS steam_genres (
    genre_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Steam Categories (feature flags like achievements, multiplayer, etc.)
CREATE TABLE IF NOT EXISTS steam_categories (
    category_id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Franchises (game series/franchises)
CREATE TABLE IF NOT EXISTS franchises (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. JUNCTION TABLES (Many-to-Many)
-- =============================================

-- App to Steam Tags (PICS tags, different from SteamSpy app_tags)
CREATE TABLE IF NOT EXISTS app_steam_tags (
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES steam_tags(tag_id) ON DELETE CASCADE,
    rank INTEGER,
    PRIMARY KEY (appid, tag_id)
);

-- App to Genres
CREATE TABLE IF NOT EXISTS app_genres (
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    genre_id INTEGER NOT NULL REFERENCES steam_genres(genre_id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (appid, genre_id)
);

-- App to Categories (features)
CREATE TABLE IF NOT EXISTS app_categories (
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    category_id INTEGER NOT NULL REFERENCES steam_categories(category_id) ON DELETE CASCADE,
    PRIMARY KEY (appid, category_id)
);

-- App to Franchises
CREATE TABLE IF NOT EXISTS app_franchises (
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    franchise_id INTEGER NOT NULL REFERENCES franchises(id) ON DELETE CASCADE,
    PRIMARY KEY (appid, franchise_id)
);

-- =============================================
-- 4. STEAM DECK COMPATIBILITY TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS app_steam_deck (
    appid INTEGER PRIMARY KEY REFERENCES apps(appid) ON DELETE CASCADE,
    category steam_deck_category NOT NULL DEFAULT 'unknown',
    test_timestamp TIMESTAMPTZ,
    tested_build_id TEXT,
    tests JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. NEW COLUMNS ON APPS TABLE
-- =============================================

-- Controller support: "full", "partial", or NULL
ALTER TABLE apps ADD COLUMN IF NOT EXISTS controller_support TEXT;

-- PICS review data (prefixed to distinguish from daily_metrics)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS pics_review_score SMALLINT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS pics_review_percentage SMALLINT;

-- Metacritic
ALTER TABLE apps ADD COLUMN IF NOT EXISTS metacritic_score SMALLINT;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS metacritic_url TEXT;

-- Platform support (comma-separated: "windows,macos,linux")
ALTER TABLE apps ADD COLUMN IF NOT EXISTS platforms TEXT;

-- Release state from PICS ("released", "prerelease", "unavailable", etc.)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS release_state TEXT;

-- Parent app (for DLC, demos, mods)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS parent_appid INTEGER REFERENCES apps(appid) ON DELETE SET NULL;

-- Publisher/Developer homepage
ALTER TABLE apps ADD COLUMN IF NOT EXISTS homepage_url TEXT;

-- App state from extended section
ALTER TABLE apps ADD COLUMN IF NOT EXISTS app_state TEXT;

-- Content update tracking
ALTER TABLE apps ADD COLUMN IF NOT EXISTS last_content_update TIMESTAMPTZ;
ALTER TABLE apps ADD COLUMN IF NOT EXISTS current_build_id TEXT;

-- Content descriptors (stored as JSONB)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS content_descriptors JSONB;

-- Supported languages (stored as JSONB)
ALTER TABLE apps ADD COLUMN IF NOT EXISTS languages JSONB;

-- =============================================
-- 6. SYNC STATUS UPDATES
-- =============================================

-- Add PICS to sync_source enum if it doesn't exist
DO $$ BEGIN
    ALTER TYPE sync_source ADD VALUE IF NOT EXISTS 'pics';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add PICS tracking columns to sync_status
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS last_pics_sync TIMESTAMPTZ;
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS pics_change_number BIGINT;

-- =============================================
-- 7. PICS SYNC STATE TABLE
-- =============================================

-- Global PICS sync state (singleton)
CREATE TABLE IF NOT EXISTS pics_sync_state (
    id INTEGER PRIMARY KEY DEFAULT 1,
    last_change_number BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert initial state
INSERT INTO pics_sync_state (id, last_change_number)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- 8. INDEXES
-- =============================================

-- Steam tags for filtering by tag
CREATE INDEX IF NOT EXISTS idx_app_steam_tags_tag_id ON app_steam_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_steam_tags_name ON steam_tags(name);

-- Genres for filtering
CREATE INDEX IF NOT EXISTS idx_app_genres_genre_id ON app_genres(genre_id);
CREATE INDEX IF NOT EXISTS idx_app_genres_primary ON app_genres(appid) WHERE is_primary = TRUE;

-- Categories for feature filtering
CREATE INDEX IF NOT EXISTS idx_app_categories_category_id ON app_categories(category_id);

-- Steam Deck queries
CREATE INDEX IF NOT EXISTS idx_app_steam_deck_category ON app_steam_deck(category);

-- Parent-child relationships (DLC lookup)
CREATE INDEX IF NOT EXISTS idx_apps_parent_appid ON apps(parent_appid) WHERE parent_appid IS NOT NULL;

-- Platform filtering
CREATE INDEX IF NOT EXISTS idx_apps_platforms ON apps(platforms) WHERE platforms IS NOT NULL;

-- Franchises
CREATE INDEX IF NOT EXISTS idx_franchises_normalized ON franchises(normalized_name);
CREATE INDEX IF NOT EXISTS idx_app_franchises_franchise ON app_franchises(franchise_id);

-- PICS sync status
CREATE INDEX IF NOT EXISTS idx_sync_status_pics ON sync_status(last_pics_sync)
    WHERE is_syncable = TRUE;

-- =============================================
-- 9. UPDATE get_apps_for_sync FUNCTION
-- =============================================

-- Drop and recreate to add PICS support
DROP FUNCTION IF EXISTS get_apps_for_sync(sync_source, INTEGER);

CREATE OR REPLACE FUNCTION get_apps_for_sync(p_source sync_source, p_limit INTEGER)
RETURNS TABLE(appid INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT s.appid
  FROM sync_status s
  JOIN apps a ON s.appid = a.appid
  WHERE s.is_syncable = TRUE
    AND s.next_sync_after <= NOW()
    AND (
      (p_source = 'storefront' AND (s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'reviews' AND (s.last_reviews_sync IS NULL OR s.last_reviews_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'histogram' AND (s.last_histogram_sync IS NULL OR s.last_histogram_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'steamspy' AND (s.last_steamspy_sync IS NULL OR s.last_steamspy_sync < NOW() - INTERVAL '1 day'))
      OR (p_source = 'scraper' AND s.needs_page_creation_scrape = TRUE)
      OR (p_source = 'pics' AND (s.last_pics_sync IS NULL OR s.last_pics_sync < NOW() - INTERVAL '1 day'))
    )
  ORDER BY
    -- FIRST: Prioritize apps that have NEVER been synced for this source
    CASE
      WHEN p_source = 'storefront' AND s.last_storefront_sync IS NULL THEN 0
      WHEN p_source = 'reviews' AND s.last_reviews_sync IS NULL THEN 0
      WHEN p_source = 'histogram' AND s.last_histogram_sync IS NULL THEN 0
      WHEN p_source = 'steamspy' AND s.last_steamspy_sync IS NULL THEN 0
      WHEN p_source = 'scraper' AND s.last_page_creation_scrape IS NULL THEN 0
      WHEN p_source = 'pics' AND s.last_pics_sync IS NULL THEN 0
      ELSE 1
    END,
    -- SECOND: For storefront, prioritize apps missing developer info
    CASE WHEN p_source = 'storefront' AND a.has_developer_info = FALSE THEN 0 ELSE 1 END,
    -- THIRD: By priority score
    s.priority_score DESC,
    -- FINALLY: By when they're due
    s.next_sync_after ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 10. HELPER FUNCTIONS
-- =============================================

-- Upsert franchise and return ID
CREATE OR REPLACE FUNCTION upsert_franchise(p_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_normalized TEXT;
BEGIN
    v_normalized := LOWER(TRIM(p_name));

    INSERT INTO franchises (name, normalized_name)
    VALUES (TRIM(p_name), v_normalized)
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Upsert steam tag (for building tag mapping)
CREATE OR REPLACE FUNCTION upsert_steam_tag(p_tag_id INTEGER, p_name TEXT)
RETURNS INTEGER AS $$
BEGIN
    INSERT INTO steam_tags (tag_id, name)
    VALUES (p_tag_id, p_name)
    ON CONFLICT (tag_id) DO UPDATE SET
        name = EXCLUDED.name,
        updated_at = NOW();

    RETURN p_tag_id;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 11. ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new tables
ALTER TABLE steam_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE steam_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_steam_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_genres ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_franchises ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_steam_deck ENABLE ROW LEVEL SECURITY;
ALTER TABLE pics_sync_state ENABLE ROW LEVEL SECURITY;

-- Allow public read access
DROP POLICY IF EXISTS "Allow public read access" ON steam_tags;
CREATE POLICY "Allow public read access" ON steam_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON steam_genres;
CREATE POLICY "Allow public read access" ON steam_genres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON steam_categories;
CREATE POLICY "Allow public read access" ON steam_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON franchises;
CREATE POLICY "Allow public read access" ON franchises FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON app_steam_tags;
CREATE POLICY "Allow public read access" ON app_steam_tags FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON app_genres;
CREATE POLICY "Allow public read access" ON app_genres FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON app_categories;
CREATE POLICY "Allow public read access" ON app_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON app_franchises;
CREATE POLICY "Allow public read access" ON app_franchises FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON app_steam_deck;
CREATE POLICY "Allow public read access" ON app_steam_deck FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public read access" ON pics_sync_state;
CREATE POLICY "Allow public read access" ON pics_sync_state FOR SELECT USING (true);

-- =============================================
-- 12. SEED DATA (Reference Tables)
-- =============================================

-- Seed steam_genres with known values
INSERT INTO steam_genres (genre_id, name) VALUES
    (1, 'Action'),
    (2, 'Strategy'),
    (3, 'RPG'),
    (4, 'Casual'),
    (5, 'Racing'),
    (9, 'Racing'),
    (12, 'Sports'),
    (18, 'Sports'),
    (23, 'Indie'),
    (25, 'Adventure'),
    (28, 'Simulation'),
    (29, 'Massively Multiplayer'),
    (37, 'Free to Play'),
    (51, 'Animation & Modeling'),
    (53, 'Design & Illustration'),
    (54, 'Education'),
    (55, 'Software Training'),
    (56, 'Utilities'),
    (57, 'Video Production'),
    (58, 'Web Publishing'),
    (59, 'Game Development'),
    (60, 'Photo Editing'),
    (70, 'Early Access'),
    (71, 'Audio Production'),
    (72, 'Accounting'),
    (81, 'Documentary'),
    (82, 'Episodic'),
    (83, 'Feature Film'),
    (84, 'Short'),
    (85, 'Benchmark'),
    (86, 'VR'),
    (87, '360 Video')
ON CONFLICT (genre_id) DO NOTHING;

-- Seed steam_categories with known values
INSERT INTO steam_categories (category_id, name, description) VALUES
    (1, 'Multi-player', 'Multiplayer gameplay'),
    (2, 'Single-player', 'Single-player gameplay'),
    (9, 'Co-op', 'Cooperative gameplay'),
    (20, 'MMO', 'Massively Multiplayer Online'),
    (22, 'Steam Achievements', 'Has Steam Achievements'),
    (23, 'Steam Cloud', 'Cloud save support'),
    (27, 'Cross-Platform Multiplayer', 'Cross-platform multiplayer'),
    (28, 'Full Controller Support', 'Full controller support'),
    (29, 'Steam Trading Cards', 'Has trading cards'),
    (30, 'Steam Workshop', 'Workshop support'),
    (35, 'In-App Purchases', 'Has in-app purchases'),
    (36, 'Online PvP', 'Online player vs player'),
    (37, 'Online Co-op', 'Online cooperative'),
    (38, 'Local Co-op', 'Local cooperative'),
    (43, 'Remote Play on TV', 'Remote Play on TV'),
    (44, 'Remote Play Together', 'Remote Play Together'),
    (45, 'Captions Available', 'Has captions'),
    (46, 'LAN PvP', 'LAN player vs player'),
    (47, 'LAN Co-op', 'LAN cooperative'),
    (48, 'HDR', 'HDR support'),
    (49, 'VR Supported', 'VR supported'),
    (50, 'VR Only', 'VR only'),
    (51, 'Steam China Workshop', 'Steam China Workshop'),
    (52, 'Tracked Controller Support', 'Tracked controller support'),
    (53, 'Family Sharing', 'Supports Family Sharing'),
    (55, 'Timeline Support', 'Steam Timeline support'),
    (56, 'GPU Recording', 'GPU recording support'),
    (57, 'Cloud Gaming', 'Cloud gaming support'),
    (59, 'Co-op Campaigns', 'Cooperative campaigns'),
    (60, 'Steam Overlay Support', 'Steam Overlay support'),
    (61, 'Remote Play on Phone', 'Remote Play on Phone'),
    (62, 'Remote Play on Tablet', 'Remote Play on Tablet')
ON CONFLICT (category_id) DO NOTHING;

-- =============================================
-- 13. COMMENTS
-- =============================================

COMMENT ON TABLE steam_tags IS 'Reference table mapping Steam tag IDs to names';
COMMENT ON TABLE steam_genres IS 'Reference table for Steam genre IDs';
COMMENT ON TABLE steam_categories IS 'Reference table for Steam feature categories';
COMMENT ON TABLE franchises IS 'Game franchises/series from PICS associations';
COMMENT ON TABLE app_steam_tags IS 'App to Steam tag relationships from PICS';
COMMENT ON TABLE app_genres IS 'App to genre relationships from PICS';
COMMENT ON TABLE app_categories IS 'App to feature category relationships from PICS';
COMMENT ON TABLE app_franchises IS 'App to franchise relationships from PICS';
COMMENT ON TABLE app_steam_deck IS 'Steam Deck compatibility data from PICS';
COMMENT ON TABLE pics_sync_state IS 'Global PICS sync state tracking change numbers';

COMMENT ON COLUMN apps.controller_support IS 'Controller support level: "full", "partial", or NULL';
COMMENT ON COLUMN apps.pics_review_score IS 'Steam review score (1-9) from PICS';
COMMENT ON COLUMN apps.pics_review_percentage IS 'Positive review percentage (0-100) from PICS';
COMMENT ON COLUMN apps.platforms IS 'Supported platforms: comma-separated (windows,macos,linux)';
COMMENT ON COLUMN apps.release_state IS 'PICS release state: released, prerelease, unavailable, etc.';
COMMENT ON COLUMN apps.parent_appid IS 'Parent app ID for DLC, demos, mods';
COMMENT ON COLUMN apps.last_content_update IS 'Last content update from PICS depots';
COMMENT ON COLUMN apps.current_build_id IS 'Current build ID from PICS depots';
COMMENT ON COLUMN apps.content_descriptors IS 'Mature content descriptors as JSONB';
COMMENT ON COLUMN apps.languages IS 'Supported languages as JSONB';

COMMENT ON COLUMN sync_status.last_pics_sync IS 'Last successful PICS data sync';
COMMENT ON COLUMN sync_status.pics_change_number IS 'Last processed PICS change number for incremental updates';
