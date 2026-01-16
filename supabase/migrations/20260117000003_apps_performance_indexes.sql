-- =============================================================================
-- Migration: Apps Page Performance Indexes
--
-- Adds compound and covering indexes to optimize common query patterns.
-- These indexes are designed to support the optimized RPC functions.
-- =============================================================================

-- ============================================================================
-- Compound indexes for latest_daily_metrics
-- These support the most common filter combinations
-- ============================================================================

-- Primary lookup with metrics: appid + key metrics
-- INCLUDE clause adds columns that are frequently selected but not filtered on
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ldm_appid_metrics
  ON latest_daily_metrics(appid)
  INCLUDE (ccu_peak, total_reviews, review_score, price_cents, owners_midpoint);

COMMENT ON INDEX idx_ldm_appid_metrics IS
  'Covering index for common app metrics lookups - avoids heap fetch for included columns';


-- CCU-based filtering (common in presets like "Top Games")
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ldm_ccu_peak_desc
  ON latest_daily_metrics(ccu_peak DESC NULLS LAST)
  WHERE ccu_peak > 0;

COMMENT ON INDEX idx_ldm_ccu_peak_desc IS
  'Descending CCU index for "Top Games" style queries';


-- Review score filtering (common in "Highly Rated" presets)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ldm_review_score_desc
  ON latest_daily_metrics(review_score DESC NULLS LAST)
  WHERE review_score >= 80;

COMMENT ON INDEX idx_ldm_review_score_desc IS
  'Descending review score index for "Highly Rated" style queries';


-- Total reviews filtering (minimum review threshold filters)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ldm_total_reviews_desc
  ON latest_daily_metrics(total_reviews DESC NULLS LAST)
  WHERE total_reviews >= 10;

COMMENT ON INDEX idx_ldm_total_reviews_desc IS
  'Descending reviews index for minimum review count filters';


-- ============================================================================
-- Indexes for apps table sorting/filtering
-- ============================================================================

-- Release date sorting (common for "New Releases" preset)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apps_release_date_desc
  ON apps(release_date DESC NULLS LAST)
  WHERE is_released = TRUE AND is_delisted = FALSE;

COMMENT ON INDEX idx_apps_release_date_desc IS
  'Release date index for new releases queries';


-- Type filtering (game/dlc/demo)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_apps_type_released
  ON apps(type)
  WHERE is_released = TRUE AND is_delisted = FALSE;

COMMENT ON INDEX idx_apps_type_released IS
  'App type index for type filtering on released apps';


-- ============================================================================
-- Indexes for ccu_tier_assignments
-- ============================================================================

-- CCU growth filtering (common in "Trending" presets)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ccu_tier_growth_7d_desc
  ON ccu_tier_assignments(ccu_growth_7d_percent DESC NULLS LAST)
  WHERE ccu_growth_7d_percent IS NOT NULL;

COMMENT ON INDEX idx_ccu_tier_growth_7d_desc IS
  'CCU growth index for trending queries';


-- CCU tier filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ccu_tier_assignments_tier
  ON ccu_tier_assignments(ccu_tier, appid);

COMMENT ON INDEX idx_ccu_tier_assignments_tier IS
  'CCU tier index for tier-based filtering';


-- ============================================================================
-- Indexes for review_velocity_stats
-- ============================================================================

-- Velocity 7d filtering and sorting
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rvs_velocity_7d_desc
  ON review_velocity_stats(velocity_7d DESC NULLS LAST)
  WHERE velocity_7d > 0;

COMMENT ON INDEX idx_rvs_velocity_7d_desc IS
  'Velocity index for high review activity queries';


-- Velocity tier filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rvs_velocity_tier
  ON review_velocity_stats(velocity_tier)
  WHERE velocity_tier IS NOT NULL;

COMMENT ON INDEX idx_rvs_velocity_tier IS
  'Velocity tier index for tier-based filtering';


-- ============================================================================
-- Indexes for app_trends (sentiment filtering)
-- ============================================================================

-- Sentiment delta calculation support
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_app_trends_sentiment
  ON app_trends(appid)
  INCLUDE (current_positive_ratio, previous_positive_ratio);

COMMENT ON INDEX idx_app_trends_sentiment IS
  'Covering index for sentiment delta calculation';


-- ============================================================================
-- Analyze tables to update statistics
-- ============================================================================

ANALYZE latest_daily_metrics;
ANALYZE apps;
ANALYZE ccu_tier_assignments;
ANALYZE review_velocity_stats;
ANALYZE app_trends;
ANALYZE app_filter_data;
