-- Migration: Clean orphaned parent_appid values
--
-- Problem: PICS common.parent field contains garbage data
-- - 165 apps have parent_appid pointing to non-existent apps
-- - Examples: Returnal (AAA game) incorrectly has parent_appid=17951 (doesn't exist)
--
-- Solution: Clear invalid parent_appid and reset mis-typed DLC to game

-- Step 1: Clear parent_appid where parent doesn't exist in apps table
UPDATE apps a
SET parent_appid = NULL
WHERE a.parent_appid IS NOT NULL
AND NOT EXISTS (SELECT 1 FROM apps p WHERE p.appid = a.parent_appid);

-- Step 2: Reset type to 'game' for apps that were incorrectly typed as DLC
-- Only applies to apps that now have no parent_appid (after cleanup above)
UPDATE apps
SET type = 'game'
WHERE type = 'dlc'
AND parent_appid IS NULL;
