-- Remove FK constraints on app_dlc to allow DLC relationships even when apps don't exist yet
-- This prevents FK violations during bulk sync when processing order is unpredictable
-- (e.g., DLC may be processed before its parent game, or vice versa)

-- Drop the foreign key constraints
ALTER TABLE app_dlc DROP CONSTRAINT IF EXISTS app_dlc_parent_appid_fkey;
ALTER TABLE app_dlc DROP CONSTRAINT IF EXISTS app_dlc_dlc_appid_fkey;

-- Add comment explaining why FKs are removed
COMMENT ON TABLE app_dlc IS 'DLC parent-child relationships. FK constraints removed to handle sync order issues where DLC or parent may be processed first.';
