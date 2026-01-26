-- Fix: Drop OLD function signature (Version 1 from 20260124000000)
-- This resolves the "Could not choose the best candidate function" error
-- by removing the duplicate overload with pagination params at the END.
-- The optimized Version 2 (from 20260125000000) with pagination at START remains.

DROP FUNCTION IF EXISTS get_apps_with_filters(
  p_type text,
  p_search text,
  p_min_ccu integer,
  p_max_ccu integer,
  p_min_owners bigint,
  p_max_owners bigint,
  p_min_reviews integer,
  p_max_reviews integer,
  p_min_score integer,
  p_max_score integer,
  p_min_price integer,
  p_max_price integer,
  p_min_playtime integer,
  p_max_playtime integer,
  p_min_growth_7d numeric,
  p_max_growth_7d numeric,
  p_min_growth_30d numeric,
  p_max_growth_30d numeric,
  p_min_momentum numeric,
  p_max_momentum numeric,
  p_min_sentiment_delta numeric,
  p_max_sentiment_delta numeric,
  p_velocity_tier text,
  p_min_active_pct numeric,
  p_min_review_rate numeric,
  p_min_value_score numeric,
  p_genres integer[],
  p_genre_mode text,
  p_tags integer[],
  p_tag_mode text,
  p_categories integer[],
  p_has_workshop boolean,
  p_platforms text[],
  p_platform_mode text,
  p_steam_deck text,
  p_controller text,
  p_min_age integer,
  p_max_age integer,
  p_release_year integer,
  p_early_access boolean,
  p_min_hype integer,
  p_max_hype integer,
  p_publisher_search text,
  p_developer_search text,
  p_self_published boolean,
  p_min_vs_publisher numeric,
  p_publisher_size text,
  p_ccu_tier integer,
  p_is_free boolean,
  p_sort_field text,
  p_sort_order text,
  p_limit integer,
  p_offset integer
);

-- Verify only one function remains
DO $$
DECLARE
  func_count INT;
BEGIN
  SELECT COUNT(*) INTO func_count
  FROM pg_proc
  WHERE proname = 'get_apps_with_filters';

  IF func_count != 1 THEN
    RAISE EXCEPTION 'Expected 1 function, found %', func_count;
  END IF;
  RAISE NOTICE 'Successfully resolved function overloading. 1 function remains.';
END $$;
