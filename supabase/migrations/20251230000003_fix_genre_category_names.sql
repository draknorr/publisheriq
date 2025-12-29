-- Fix genre and category names that were incorrectly set to placeholders
-- The PICS sync was using "Genre X" and "Category X" instead of actual names

-- =============================================
-- 1. FIX GENRE NAMES
-- =============================================
UPDATE steam_genres SET name = 'Action' WHERE genre_id = 1 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Strategy' WHERE genre_id = 2 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'RPG' WHERE genre_id = 3 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Casual' WHERE genre_id = 4 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Racing' WHERE genre_id = 5 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Racing' WHERE genre_id = 9 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Sports' WHERE genre_id = 12 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Sports' WHERE genre_id = 18 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Indie' WHERE genre_id = 23 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Adventure' WHERE genre_id = 25 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Simulation' WHERE genre_id = 28 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Massively Multiplayer' WHERE genre_id = 29 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Free to Play' WHERE genre_id = 37 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Animation & Modeling' WHERE genre_id = 51 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Design & Illustration' WHERE genre_id = 53 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Education' WHERE genre_id = 54 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Software Training' WHERE genre_id = 55 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Utilities' WHERE genre_id = 56 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Video Production' WHERE genre_id = 57 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Web Publishing' WHERE genre_id = 58 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Game Development' WHERE genre_id = 59 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Photo Editing' WHERE genre_id = 60 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Early Access' WHERE genre_id = 70 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Audio Production' WHERE genre_id = 71 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Accounting' WHERE genre_id = 72 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Documentary' WHERE genre_id = 81 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Episodic' WHERE genre_id = 82 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Feature Film' WHERE genre_id = 83 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Short' WHERE genre_id = 84 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'Benchmark' WHERE genre_id = 85 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = 'VR' WHERE genre_id = 86 AND name LIKE 'Genre%';
UPDATE steam_genres SET name = '360 Video' WHERE genre_id = 87 AND name LIKE 'Genre%';

-- =============================================
-- 2. FIX CATEGORY NAMES
-- =============================================
UPDATE steam_categories SET name = 'Multi-player' WHERE category_id = 1 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Single-player' WHERE category_id = 2 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Co-op' WHERE category_id = 9 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'MMO' WHERE category_id = 20 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Steam Achievements' WHERE category_id = 22 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Steam Cloud' WHERE category_id = 23 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Cross-Platform Multiplayer' WHERE category_id = 27 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Full Controller Support' WHERE category_id = 28 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Steam Trading Cards' WHERE category_id = 29 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Steam Workshop' WHERE category_id = 30 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'In-App Purchases' WHERE category_id = 35 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Online PvP' WHERE category_id = 36 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Online Co-op' WHERE category_id = 37 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Local Co-op' WHERE category_id = 38 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Shared/Split Screen' WHERE category_id = 41 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Partial Controller Support' WHERE category_id = 42 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Remote Play on TV' WHERE category_id = 43 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Remote Play Together' WHERE category_id = 44 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Captions Available' WHERE category_id = 45 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'LAN PvP' WHERE category_id = 46 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'LAN Co-op' WHERE category_id = 47 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'HDR' WHERE category_id = 48 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'VR Supported' WHERE category_id = 49 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'VR Only' WHERE category_id = 50 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Steam China Workshop' WHERE category_id = 51 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Tracked Controller Support' WHERE category_id = 52 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Family Sharing' WHERE category_id = 53 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Timeline Support' WHERE category_id = 55 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'GPU Recording' WHERE category_id = 56 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Cloud Gaming' WHERE category_id = 57 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Co-op Campaigns' WHERE category_id = 59 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Steam Overlay Support' WHERE category_id = 60 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Remote Play on Phone' WHERE category_id = 61 AND name LIKE 'Category%';
UPDATE steam_categories SET name = 'Remote Play on Tablet' WHERE category_id = 62 AND name LIKE 'Category%';
