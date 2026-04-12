-- Incremental Tiger bootstrap delta for events/news projection reconcile
-- performance. Add the replay/validation index without rebuilding the slice.

CREATE INDEX IF NOT EXISTS idx_docs_steam_news_search_projection_sort_time_gid
  ON docs.steam_news_search_projection (sort_time, gid);
