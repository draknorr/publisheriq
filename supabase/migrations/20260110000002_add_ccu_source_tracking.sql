-- Add source tracking for CCU data
-- This lets us distinguish between exact Steam API data and SteamSpy estimates

-- Add ccu_source column to track where CCU data came from
ALTER TABLE daily_metrics
ADD COLUMN IF NOT EXISTS ccu_source text;

-- Add check constraint for valid values
ALTER TABLE daily_metrics
ADD CONSTRAINT chk_ccu_source CHECK (ccu_source IS NULL OR ccu_source IN ('steamspy', 'steam_api'));

-- Add index for analytics on data sources
CREATE INDEX IF NOT EXISTS idx_daily_metrics_ccu_source
ON daily_metrics (ccu_source)
WHERE ccu_source IS NOT NULL;

-- Add comments
COMMENT ON COLUMN daily_metrics.ccu_source IS
  'Source of CCU data: steam_api (exact from GetNumberOfCurrentPlayers) or steamspy (from SteamSpy sync). NULL for legacy data.';
