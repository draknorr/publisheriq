-- Migration: Add review_deltas table for daily review change tracking
-- Purpose: Enable per-game trend charts and velocity-based sync scheduling

-- Create review_deltas table
CREATE TABLE review_deltas (
    id BIGSERIAL PRIMARY KEY,
    appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
    delta_date DATE NOT NULL,

    -- Absolute values at sync time
    total_reviews INTEGER NOT NULL,
    positive_reviews INTEGER NOT NULL,
    review_score SMALLINT,
    review_score_desc TEXT,

    -- Calculated deltas from previous sync
    reviews_added INTEGER NOT NULL DEFAULT 0,
    positive_added INTEGER NOT NULL DEFAULT 0,
    negative_added INTEGER NOT NULL DEFAULT 0,

    -- Time tracking for accurate velocity calculation
    hours_since_last_sync DECIMAL(6,2),

    -- Computed daily velocity (normalized to 24h)
    daily_velocity DECIMAL(8,4) GENERATED ALWAYS AS (
        CASE WHEN hours_since_last_sync > 0
        THEN (reviews_added * 24.0 / hours_since_last_sync)
        ELSE 0 END
    ) STORED,

    -- Flag for interpolated vs actual data
    is_interpolated BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- One record per app per day
    UNIQUE(appid, delta_date)
);

-- Index for time-series queries per game (trend charts)
CREATE INDEX idx_review_deltas_appid_date ON review_deltas(appid, delta_date DESC);

-- Index for finding high-velocity games (discovery)
CREATE INDEX idx_review_deltas_velocity ON review_deltas(daily_velocity DESC)
    WHERE is_interpolated = FALSE;

-- Index for date-based queries (cleanup, aggregations)
CREATE INDEX idx_review_deltas_date ON review_deltas(delta_date DESC);

-- Add comment for documentation
COMMENT ON TABLE review_deltas IS 'Daily review change tracking for trend visualization and velocity-based sync scheduling';
COMMENT ON COLUMN review_deltas.daily_velocity IS 'Reviews per day, normalized from hours_since_last_sync to 24h';
COMMENT ON COLUMN review_deltas.is_interpolated IS 'TRUE if this record was estimated between actual syncs, FALSE if from API';
