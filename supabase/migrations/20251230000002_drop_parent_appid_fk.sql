-- Drop the self-referential FK on parent_appid
-- This constraint causes issues during bulk sync when child apps
-- are inserted before their parent apps exist

ALTER TABLE apps DROP CONSTRAINT IF EXISTS apps_parent_appid_fkey;
