-- Fix app types for apps where PICS didn't set them correctly
-- This uses heuristics based on available data (parent_appid, name patterns)

-- DLC: apps with parent_appid set (most reliable indicator)
UPDATE apps SET type = 'dlc', updated_at = now()
WHERE type = 'game' AND parent_appid IS NOT NULL;

-- Demo: name contains "Demo" (excluding false positives like "Demon", "Democracy")
UPDATE apps SET type = 'demo', updated_at = now()
WHERE type = 'game'
  AND (
    name ILIKE '% demo'          -- ends with "Demo"
    OR name ILIKE '% demo %'     -- "Demo" as a word
    OR name ILIKE '%demo:%'      -- "Demo:" prefix
    OR name ILIKE '%(demo)%'     -- "(Demo)" suffix
    OR name ILIKE '%[demo]%'     -- "[Demo]" suffix
  )
  AND name NOT ILIKE '%demon%'
  AND name NOT ILIKE '%democracy%'
  AND name NOT ILIKE '%demolition%'
  AND name NOT ILIKE '%demographic%';

-- Music: soundtracks and OSTs
UPDATE apps SET type = 'music', updated_at = now()
WHERE type = 'game'
  AND (
    name ILIKE '%soundtrack%'
    OR name ILIKE '% ost'
    OR name ILIKE '% ost %'
    OR name ILIKE '%original score%'
    OR name ILIKE '%music pack%'
  );

-- Tool: SDKs, dedicated servers, editors
UPDATE apps SET type = 'tool', updated_at = now()
WHERE type = 'game'
  AND (
    name ILIKE '% sdk%'
    OR name ILIKE '%dedicated server%'
    OR name ILIKE '%level editor%'
    OR name ILIKE '%modding tool%'
    OR name ILIKE '%map editor%'
    OR name ILIKE '%authoring tool%'
  );

-- Video: trailers and videos (common pattern)
UPDATE apps SET type = 'video', updated_at = now()
WHERE type = 'game'
  AND (
    name ILIKE '%trailer%'
    OR name ILIKE '%- video%'
    OR name ILIKE '%making of%'
    OR name ILIKE '%behind the scenes%'
  );

-- Log results
DO $$
DECLARE
  r RECORD;
  total_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_count FROM apps;
  RAISE NOTICE 'Total apps: %', total_count;
  RAISE NOTICE '---';
  FOR r IN SELECT type, COUNT(*) as cnt FROM apps GROUP BY type ORDER BY cnt DESC LOOP
    RAISE NOTICE '% : % (%.1f%%)', r.type, r.cnt, (r.cnt::float / total_count * 100);
  END LOOP;
END $$;
