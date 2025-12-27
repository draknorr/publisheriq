-- =============================================
-- PublisherIQ Initial Schema Migration
-- =============================================

-- =============================================
-- ENUMS
-- =============================================
CREATE TYPE app_type AS ENUM ('game', 'dlc', 'demo', 'mod', 'video', 'hardware', 'music');
CREATE TYPE sync_source AS ENUM ('steamspy', 'storefront', 'reviews', 'histogram', 'scraper');
CREATE TYPE trend_direction AS ENUM ('up', 'down', 'stable');

-- =============================================
-- CORE ENTITIES
-- =============================================

-- Publishers table
CREATE TABLE publishers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT NOT NULL,
    steam_vanity_url TEXT,
    first_game_release_date DATE,
    first_page_creation_date DATE,
    game_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Developers table
CREATE TABLE developers (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    normalized_name TEXT NOT NULL,
    steam_vanity_url TEXT,
    first_game_release_date DATE,
    first_page_creation_date DATE,
    game_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Apps table (games, DLC, etc.)
CREATE TABLE apps (
    appid INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    type app_type DEFAULT 'game',
    is_free BOOLEAN DEFAULT FALSE,
    release_date DATE,
    release_date_raw TEXT,
    page_creation_date DATE,
    page_creation_date_raw TEXT,
    has_workshop BOOLEAN DEFAULT FALSE,
    current_price_cents INTEGER,
    current_discount_percent INTEGER DEFAULT 0,
    is_released BOOLEAN DEFAULT TRUE,
    is_delisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Many-to-many: Apps to Developers
CREATE TABLE app_developers (
    appid INTEGER REFERENCES apps(appid) ON DELETE CASCADE,
    developer_id INTEGER REFERENCES developers(id) ON DELETE CASCADE,
    PRIMARY KEY (appid, developer_id)
);

-- Many-to-many: Apps to Publishers
CREATE TABLE app_publishers (
    appid INTEGER REFERENCES apps(appid) ON DELETE CASCADE,
    publisher_id INTEGER REFERENCES publishers(id) ON DELETE CASCADE,
    PRIMARY KEY (appid, publisher_id)
);

-- App tags (from SteamSpy)
CREATE TABLE app_tags (
    appid INTEGER REFERENCES apps(appid) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    vote_count INTEGER DEFAULT 0,
    PRIMARY KEY (appid, tag)
);

-- =============================================
-- HISTORICAL METRICS
-- =============================================

CREATE TABLE daily_metrics (
    id BIGSERIAL PRIMARY KEY,
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    owners_min INTEGER,
    owners_max INTEGER,
    ccu_peak INTEGER,
    average_playtime_forever INTEGER,
    average_playtime_2weeks INTEGER,
    total_reviews INTEGER,
    positive_reviews INTEGER,
    negative_reviews INTEGER,
    review_score SMALLINT,
    review_score_desc TEXT,
    recent_total_reviews INTEGER,
    recent_positive INTEGER,
    recent_negative INTEGER,
    recent_score_desc TEXT,
    price_cents INTEGER,
    discount_percent SMALLINT DEFAULT 0,
    UNIQUE(appid, metric_date)
);

-- =============================================
-- REVIEW HISTOGRAM (Monthly aggregates from Steam)
-- =============================================

CREATE TABLE review_histogram (
    id BIGSERIAL PRIMARY KEY,
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    month_start DATE NOT NULL,
    recommendations_up INTEGER NOT NULL,
    recommendations_down INTEGER NOT NULL,
    fetched_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(appid, month_start)
);

-- =============================================
-- COMPUTED TRENDS
-- =============================================

CREATE TABLE app_trends (
    appid INTEGER PRIMARY KEY REFERENCES apps(appid) ON DELETE CASCADE,
    trend_30d_direction trend_direction,
    trend_30d_change_pct DECIMAL(6,2),
    trend_90d_direction trend_direction,
    trend_90d_change_pct DECIMAL(6,2),
    current_positive_ratio DECIMAL(5,4),
    previous_positive_ratio DECIMAL(5,4),
    review_velocity_7d DECIMAL(10,2),
    review_velocity_30d DECIMAL(10,2),
    ccu_trend_7d_pct DECIMAL(6,2),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- SYNC TRACKING
-- =============================================

CREATE TABLE sync_status (
    appid INTEGER PRIMARY KEY REFERENCES apps(appid) ON DELETE CASCADE,
    last_steamspy_sync TIMESTAMPTZ,
    last_storefront_sync TIMESTAMPTZ,
    last_reviews_sync TIMESTAMPTZ,
    last_histogram_sync TIMESTAMPTZ,
    last_page_creation_scrape TIMESTAMPTZ,
    priority_score INTEGER DEFAULT 0,
    priority_calculated_at TIMESTAMPTZ,
    next_sync_after TIMESTAMPTZ DEFAULT NOW(),
    sync_interval_hours INTEGER DEFAULT 24,
    consecutive_errors INTEGER DEFAULT 0,
    last_error_source sync_source,
    last_error_message TEXT,
    last_error_at TIMESTAMPTZ,
    needs_page_creation_scrape BOOLEAN DEFAULT TRUE,
    is_syncable BOOLEAN DEFAULT TRUE
);

CREATE TABLE sync_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    job_type TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    status TEXT DEFAULT 'running',
    items_processed INTEGER DEFAULT 0,
    items_succeeded INTEGER DEFAULT 0,
    items_failed INTEGER DEFAULT 0,
    batch_size INTEGER,
    error_message TEXT,
    github_run_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

-- Publisher/Developer lookups
CREATE INDEX idx_publishers_normalized ON publishers(normalized_name);
CREATE INDEX idx_developers_normalized ON developers(normalized_name);

-- App lookups
CREATE INDEX idx_apps_name ON apps(name);
CREATE INDEX idx_apps_type ON apps(type) WHERE type = 'game';
CREATE INDEX idx_apps_released ON apps(is_released, is_delisted);

-- Daily metrics queries
CREATE INDEX idx_daily_metrics_appid_date ON daily_metrics(appid, metric_date DESC);
CREATE INDEX idx_daily_metrics_date ON daily_metrics(metric_date);

-- Review histogram for trend analysis
CREATE INDEX idx_review_histogram_appid_month ON review_histogram(appid, month_start DESC);

-- Sync status for finding apps due for update
CREATE INDEX idx_sync_status_priority ON sync_status(priority_score DESC) WHERE is_syncable = TRUE;
CREATE INDEX idx_sync_status_next_sync ON sync_status(next_sync_after) WHERE is_syncable = TRUE;
CREATE INDEX idx_sync_status_needs_scrape ON sync_status(appid) WHERE needs_page_creation_scrape = TRUE AND is_syncable = TRUE;

-- App tags for filtering
CREATE INDEX idx_app_tags_tag ON app_tags(tag);

-- Trends for dashboard queries
CREATE INDEX idx_app_trends_30d ON app_trends(trend_30d_direction, trend_30d_change_pct DESC) WHERE trend_30d_direction = 'up';

-- Sync jobs for monitoring
CREATE INDEX idx_sync_jobs_type_started ON sync_jobs(job_type, started_at DESC);
CREATE INDEX idx_sync_jobs_status ON sync_jobs(status) WHERE status = 'running';

-- =============================================
-- FUNCTIONS
-- =============================================

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to relevant tables
CREATE TRIGGER trigger_apps_updated_at
    BEFORE UPDATE ON apps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_publishers_updated_at
    BEFORE UPDATE ON publishers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER trigger_developers_updated_at
    BEFORE UPDATE ON developers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Function to upsert developer and return ID
CREATE OR REPLACE FUNCTION upsert_developer(p_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_normalized TEXT;
BEGIN
    v_normalized := LOWER(TRIM(p_name));

    INSERT INTO developers (name, normalized_name)
    VALUES (TRIM(p_name), v_normalized)
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to upsert publisher and return ID
CREATE OR REPLACE FUNCTION upsert_publisher(p_name TEXT)
RETURNS INTEGER AS $$
DECLARE
    v_id INTEGER;
    v_normalized TEXT;
BEGIN
    v_normalized := LOWER(TRIM(p_name));

    INSERT INTO publishers (name, normalized_name)
    VALUES (TRIM(p_name), v_normalized)
    ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
    RETURNING id INTO v_id;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get apps due for sync
CREATE OR REPLACE FUNCTION get_apps_for_sync(
    p_source sync_source,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (appid INTEGER, priority_score INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT s.appid, s.priority_score
    FROM sync_status s
    WHERE s.is_syncable = TRUE
      AND s.next_sync_after <= NOW()
      AND CASE p_source
          WHEN 'steamspy' THEN s.last_steamspy_sync IS NULL OR s.last_steamspy_sync < NOW() - INTERVAL '1 day'
          WHEN 'storefront' THEN s.last_storefront_sync IS NULL OR s.last_storefront_sync < NOW() - INTERVAL '1 day'
          WHEN 'reviews' THEN s.last_reviews_sync IS NULL OR s.last_reviews_sync < NOW() - INTERVAL '1 day'
          WHEN 'histogram' THEN s.last_histogram_sync IS NULL OR s.last_histogram_sync < NOW() - INTERVAL '7 days'
          WHEN 'scraper' THEN s.needs_page_creation_scrape = TRUE
          ELSE TRUE
      END
    ORDER BY s.priority_score DESC, s.next_sync_after ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all tables
ALTER TABLE publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_developers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_publishers ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_histogram ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_trends ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anon key can read)
CREATE POLICY "Allow public read access" ON publishers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON developers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON apps FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON app_developers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON app_publishers FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON app_tags FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON daily_metrics FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON review_histogram FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON app_trends FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON sync_status FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON sync_jobs FOR SELECT USING (true);

-- Service role has full access (bypasses RLS by default)
-- No additional policies needed for service role
