-- Migration: Harden PICS latest-state relation sync RPCs
--
-- Adds transactional per-app replacement RPCs for categories, genres, and
-- Steam tags. These preserve unchanged junction rows and their created_at
-- timestamps while updating mutable fields in place.

CREATE OR REPLACE FUNCTION replace_app_categories(
  p_appid INTEGER,
  p_category_ids INTEGER[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH desired AS (
    SELECT DISTINCT category_id
    FROM unnest(COALESCE(p_category_ids, ARRAY[]::INTEGER[])) AS category_id
    WHERE category_id IS NOT NULL
  )
  INSERT INTO app_categories (appid, category_id)
  SELECT p_appid, desired.category_id
  FROM desired
  ON CONFLICT (appid, category_id) DO NOTHING;

  DELETE FROM app_categories existing
  WHERE existing.appid = p_appid
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_category_ids, ARRAY[]::INTEGER[])) AS desired_category_id(category_id)
      WHERE desired_category_id.category_id IS NOT NULL
        AND desired_category_id.category_id = existing.category_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION replace_app_genres(
  p_appid INTEGER,
  p_genre_ids INTEGER[],
  p_primary_genre_id INTEGER DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH desired AS (
    SELECT
      genre_id,
      COALESCE(genre_id = p_primary_genre_id, FALSE) AS is_primary
    FROM (
      SELECT DISTINCT genre_id
      FROM unnest(COALESCE(p_genre_ids, ARRAY[]::INTEGER[])) AS genre_id
      WHERE genre_id IS NOT NULL
    ) deduped
  )
  INSERT INTO app_genres (appid, genre_id, is_primary)
  SELECT p_appid, desired.genre_id, desired.is_primary
  FROM desired
  ON CONFLICT (appid, genre_id) DO UPDATE
  SET is_primary = EXCLUDED.is_primary
  WHERE app_genres.is_primary IS DISTINCT FROM EXCLUDED.is_primary;

  DELETE FROM app_genres existing
  WHERE existing.appid = p_appid
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_genre_ids, ARRAY[]::INTEGER[])) AS desired_genre_id(genre_id)
      WHERE desired_genre_id.genre_id IS NOT NULL
        AND desired_genre_id.genre_id = existing.genre_id
    );
END;
$$;

CREATE OR REPLACE FUNCTION replace_app_steam_tags(
  p_appid INTEGER,
  p_tag_ids INTEGER[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  WITH desired AS (
    SELECT DISTINCT ON (tag_id)
      tag_id,
      ordinality - 1 AS rank
    FROM unnest(COALESCE(p_tag_ids, ARRAY[]::INTEGER[])) WITH ORDINALITY AS desired_tag(tag_id, ordinality)
    WHERE tag_id IS NOT NULL
    ORDER BY tag_id, ordinality
  )
  INSERT INTO app_steam_tags (appid, tag_id, rank)
  SELECT p_appid, desired.tag_id, desired.rank
  FROM desired
  ON CONFLICT (appid, tag_id) DO UPDATE
  SET rank = EXCLUDED.rank
  WHERE app_steam_tags.rank IS DISTINCT FROM EXCLUDED.rank;

  DELETE FROM app_steam_tags existing
  WHERE existing.appid = p_appid
    AND NOT EXISTS (
      SELECT 1
      FROM unnest(COALESCE(p_tag_ids, ARRAY[]::INTEGER[])) AS desired_tag_id(tag_id)
      WHERE desired_tag_id.tag_id IS NOT NULL
        AND desired_tag_id.tag_id = existing.tag_id
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION replace_app_categories(INTEGER, INTEGER[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION replace_app_categories(INTEGER, INTEGER[]) FROM anon;
REVOKE EXECUTE ON FUNCTION replace_app_categories(INTEGER, INTEGER[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION replace_app_categories(INTEGER, INTEGER[]) TO service_role;

REVOKE EXECUTE ON FUNCTION replace_app_genres(INTEGER, INTEGER[], INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION replace_app_genres(INTEGER, INTEGER[], INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION replace_app_genres(INTEGER, INTEGER[], INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION replace_app_genres(INTEGER, INTEGER[], INTEGER) TO service_role;

REVOKE EXECUTE ON FUNCTION replace_app_steam_tags(INTEGER, INTEGER[]) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION replace_app_steam_tags(INTEGER, INTEGER[]) FROM anon;
REVOKE EXECUTE ON FUNCTION replace_app_steam_tags(INTEGER, INTEGER[]) FROM authenticated;
GRANT EXECUTE ON FUNCTION replace_app_steam_tags(INTEGER, INTEGER[]) TO service_role;
