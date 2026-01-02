-- Migration: Add unique indexes for concurrent materialized view refresh
-- The REFRESH MATERIALIZED VIEW CONCURRENTLY command requires a unique index

-- Drop existing non-unique index on appid (we'll replace with unique composite)
DROP INDEX IF EXISTS idx_developer_game_metrics_appid;
DROP INDEX IF EXISTS idx_publisher_game_metrics_appid;

-- Add unique indexes for game metrics
-- (developer_id + appid is unique since a game can have multiple developers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_developer_game_metrics_unique
ON developer_game_metrics(developer_id, appid);

CREATE UNIQUE INDEX IF NOT EXISTS idx_publisher_game_metrics_unique
ON publisher_game_metrics(publisher_id, appid);

-- Year metrics already have unique indexes from previous migration:
-- idx_developer_year_metrics_pk and idx_publisher_year_metrics_pk

COMMENT ON INDEX idx_developer_game_metrics_unique IS
  'Required for REFRESH MATERIALIZED VIEW CONCURRENTLY';
COMMENT ON INDEX idx_publisher_game_metrics_unique IS
  'Required for REFRESH MATERIALIZED VIEW CONCURRENTLY';
