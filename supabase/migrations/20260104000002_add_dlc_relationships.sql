-- Junction table for parent→DLC relationships
-- Stores the authoritative list of DLC for each parent game from PICS/Storefront data

CREATE TABLE IF NOT EXISTS app_dlc (
  parent_appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  dlc_appid INTEGER NOT NULL REFERENCES apps(appid) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'pics', -- 'pics' or 'storefront'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (parent_appid, dlc_appid)
);

-- Index for finding all DLC for a parent game
CREATE INDEX idx_app_dlc_parent ON app_dlc(parent_appid);

-- Index for finding which game a DLC belongs to (reverse lookup)
CREATE INDEX idx_app_dlc_child ON app_dlc(dlc_appid);

-- Backfill from existing parent_appid data on apps table
-- This captures relationships where DLC apps already have their parent_appid set
-- Only insert where the parent app actually exists (avoid orphaned references)
INSERT INTO app_dlc (parent_appid, dlc_appid, source)
SELECT a.parent_appid, a.appid, 'pics'
FROM apps a
INNER JOIN apps parent ON parent.appid = a.parent_appid  -- Ensure parent exists
WHERE a.parent_appid IS NOT NULL
ON CONFLICT DO NOTHING;
