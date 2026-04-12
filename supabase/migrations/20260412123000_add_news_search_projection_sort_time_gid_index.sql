-- Supports events/news exact-parity replay and validation scans that read
-- projection rows in sort_time, gid order across month windows.

CREATE INDEX IF NOT EXISTS idx_steam_news_search_projection_sort_time_gid
  ON public.steam_news_search_projection (sort_time, gid);
