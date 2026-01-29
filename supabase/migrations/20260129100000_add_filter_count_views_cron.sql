-- Add pg_cron job to refresh filter count views every 4 hours
-- This backs up the GitHub Actions workflow in case of failures

-- Ensure pg_cron extension is available (should already be enabled on Supabase)
-- CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule refresh of filter count materialized views every 4 hours
-- The function refresh_filter_count_views() already exists from migration 20260117000001
SELECT cron.schedule(
  'refresh-filter-count-views',
  '0 */4 * * *',
  $$ SELECT refresh_filter_count_views() $$
);

COMMENT ON FUNCTION refresh_filter_count_views IS
  'Refreshes all Games page filter count MVs. Called by pg_cron every 4h and GitHub Actions daily.';
