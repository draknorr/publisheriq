-- Backfill app_dlc junction table from existing parent_appid data
-- This captures DLC relationships that were set via PICS but couldn't be inserted due to FK constraints

-- Insert relationships where DLC apps have parent_appid set
-- Note: We don't require the parent to exist in apps table since we removed FK constraints
INSERT INTO app_dlc (parent_appid, dlc_appid, source)
SELECT a.parent_appid, a.appid, 'pics'
FROM apps a
WHERE a.parent_appid IS NOT NULL
ON CONFLICT (parent_appid, dlc_appid) DO NOTHING;

-- Log counts for verification
DO $$
DECLARE
  total_dlc_apps INTEGER;
  total_relationships INTEGER;
  apps_with_parent INTEGER;
BEGIN
  -- Count DLC type apps
  SELECT COUNT(*) INTO total_dlc_apps FROM apps WHERE type = 'dlc';

  -- Count relationships in junction table
  SELECT COUNT(*) INTO total_relationships FROM app_dlc;

  -- Count apps that have parent_appid set
  SELECT COUNT(*) INTO apps_with_parent FROM apps WHERE parent_appid IS NOT NULL;

  RAISE NOTICE 'Backfill complete:';
  RAISE NOTICE '  - Total DLC type apps: %', total_dlc_apps;
  RAISE NOTICE '  - Apps with parent_appid set: %', apps_with_parent;
  RAISE NOTICE '  - Total relationships in app_dlc: %', total_relationships;
END $$;
