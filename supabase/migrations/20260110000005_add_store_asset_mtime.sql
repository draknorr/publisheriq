-- Migration: Add store_asset_mtime from PICS data
--
-- This migration:
-- 1. Renames page_creation_date to store_asset_mtime (actual PICS field name)
-- 2. Drops page_creation_date_raw (never used, scraper artifact)
-- 3. Removes orphaned first_page_creation_date from publishers/developers
-- 4. Removes scraper tracking columns from sync_status (PICS now provides this data)
--
-- Background:
-- The page creation date scraper was fundamentally broken - it looked for a
-- "Founded" date on Steam App Community pages that doesn't exist. However,
-- PICS provides store_asset_mtime which is when the store page was created.

-- Rename page_creation_date to store_asset_mtime (actual PICS field name)
ALTER TABLE apps RENAME COLUMN page_creation_date TO store_asset_mtime;

-- Drop the raw column (scraper artifact, never used)
ALTER TABLE apps DROP COLUMN IF EXISTS page_creation_date_raw;

-- Remove orphaned columns from publishers/developers (never populated, no data source)
ALTER TABLE publishers DROP COLUMN IF EXISTS first_page_creation_date;
ALTER TABLE developers DROP COLUMN IF EXISTS first_page_creation_date;

-- Remove scraper tracking columns (PICS now provides this data)
ALTER TABLE sync_status DROP COLUMN IF EXISTS needs_page_creation_scrape;
ALTER TABLE sync_status DROP COLUMN IF EXISTS last_page_creation_scrape;

-- Remove the scraper index
DROP INDEX IF EXISTS idx_sync_status_needs_scrape;

-- Add comment explaining the column
COMMENT ON COLUMN apps.store_asset_mtime IS 'When Steam store page was created (from PICS store_asset_mtime)';
