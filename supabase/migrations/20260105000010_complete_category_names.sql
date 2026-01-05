-- Migration: Complete Steam category name mappings
-- Fixes all "Category XX" placeholders with actual names from Steam API
-- Gathered from Steam Storefront API calls on 30+ games

-- Core gameplay modes (1-9)
UPDATE steam_categories SET name = 'Multi-player' WHERE category_id = 1;
UPDATE steam_categories SET name = 'Single-player' WHERE category_id = 2;
UPDATE steam_categories SET name = 'Mods (require HL2)' WHERE category_id = 6;
UPDATE steam_categories SET name = 'Valve Anti-Cheat enabled' WHERE category_id = 8;
UPDATE steam_categories SET name = 'Co-op' WHERE category_id = 9;

-- Steam features (13-25)
UPDATE steam_categories SET name = 'Captions available' WHERE category_id = 13;
UPDATE steam_categories SET name = 'Commentary available' WHERE category_id = 14;
UPDATE steam_categories SET name = 'Stats' WHERE category_id = 15;
UPDATE steam_categories SET name = 'Includes Source SDK' WHERE category_id = 16;
UPDATE steam_categories SET name = 'Includes level editor' WHERE category_id = 17;
UPDATE steam_categories SET name = 'Partial Controller Support' WHERE category_id = 18;
UPDATE steam_categories SET name = 'Mods' WHERE category_id = 19;
UPDATE steam_categories SET name = 'MMO' WHERE category_id = 20;
UPDATE steam_categories SET name = 'Downloadable Content' WHERE category_id = 21;
UPDATE steam_categories SET name = 'Steam Achievements' WHERE category_id = 22;
UPDATE steam_categories SET name = 'Steam Cloud' WHERE category_id = 23;
UPDATE steam_categories SET name = 'Shared/Split Screen' WHERE category_id = 24;
UPDATE steam_categories SET name = 'Steam Leaderboards' WHERE category_id = 25;

-- Multiplayer features (27-54)
UPDATE steam_categories SET name = 'Cross-Platform Multiplayer' WHERE category_id = 27;
UPDATE steam_categories SET name = 'Full controller support' WHERE category_id = 28;
UPDATE steam_categories SET name = 'Steam Trading Cards' WHERE category_id = 29;
UPDATE steam_categories SET name = 'Steam Workshop' WHERE category_id = 30;
UPDATE steam_categories SET name = 'VR Support' WHERE category_id = 31;
UPDATE steam_categories SET name = 'Steam Turn Notifications' WHERE category_id = 32;
UPDATE steam_categories SET name = 'In-App Purchases' WHERE category_id = 35;
UPDATE steam_categories SET name = 'Online PvP' WHERE category_id = 36;
UPDATE steam_categories SET name = 'Shared/Split Screen PvP' WHERE category_id = 37;
UPDATE steam_categories SET name = 'Online Co-op' WHERE category_id = 38;
UPDATE steam_categories SET name = 'Shared/Split Screen Co-op' WHERE category_id = 39;
UPDATE steam_categories SET name = 'SteamVR Collectibles' WHERE category_id = 40;
UPDATE steam_categories SET name = 'Remote Play on Phone' WHERE category_id = 41;
UPDATE steam_categories SET name = 'Remote Play on Tablet' WHERE category_id = 42;
UPDATE steam_categories SET name = 'Remote Play on TV' WHERE category_id = 43;
UPDATE steam_categories SET name = 'Remote Play Together' WHERE category_id = 44;
UPDATE steam_categories SET name = 'Captions available' WHERE category_id = 45;
UPDATE steam_categories SET name = 'LAN PvP' WHERE category_id = 46;
UPDATE steam_categories SET name = 'LAN Co-op' WHERE category_id = 47;
UPDATE steam_categories SET name = 'LAN Co-op' WHERE category_id = 48;
UPDATE steam_categories SET name = 'PvP' WHERE category_id = 49;
UPDATE steam_categories SET name = 'VR Only' WHERE category_id = 50;
UPDATE steam_categories SET name = 'Steam Workshop' WHERE category_id = 51;
UPDATE steam_categories SET name = 'Tracked Controller Support' WHERE category_id = 52;
UPDATE steam_categories SET name = 'VR Supported' WHERE category_id = 53;
UPDATE steam_categories SET name = 'VR Only' WHERE category_id = 54;

-- HDR and new features (55-63)
UPDATE steam_categories SET name = 'Timeline Support' WHERE category_id = 55;
UPDATE steam_categories SET name = 'GPU Recording' WHERE category_id = 56;
UPDATE steam_categories SET name = 'Cloud Gaming' WHERE category_id = 57;
UPDATE steam_categories SET name = 'Steam Input API' WHERE category_id = 58;
UPDATE steam_categories SET name = 'Co-op Campaigns' WHERE category_id = 59;
UPDATE steam_categories SET name = 'Steam Overlay Support' WHERE category_id = 60;
UPDATE steam_categories SET name = 'HDR available' WHERE category_id = 61;
UPDATE steam_categories SET name = 'Family Sharing' WHERE category_id = 62;
UPDATE steam_categories SET name = 'Steam Timeline' WHERE category_id = 63;

-- Accessibility features (64-79)
UPDATE steam_categories SET name = 'Adjustable Text Size' WHERE category_id = 64;
UPDATE steam_categories SET name = 'Subtitle Options' WHERE category_id = 65;
UPDATE steam_categories SET name = 'Color Alternatives' WHERE category_id = 66;
UPDATE steam_categories SET name = 'Camera Comfort' WHERE category_id = 67;
UPDATE steam_categories SET name = 'Custom Volume Controls' WHERE category_id = 68;
UPDATE steam_categories SET name = 'Stereo Sound' WHERE category_id = 69;
UPDATE steam_categories SET name = 'Surround Sound' WHERE category_id = 70;
UPDATE steam_categories SET name = 'Narrated Game Menus' WHERE category_id = 71;
UPDATE steam_categories SET name = 'Chat Speech-to-text' WHERE category_id = 72;
UPDATE steam_categories SET name = 'Playable without Timed Input' WHERE category_id = 74;
UPDATE steam_categories SET name = 'Keyboard Only Option' WHERE category_id = 75;
UPDATE steam_categories SET name = 'Mouse Only Option' WHERE category_id = 76;
UPDATE steam_categories SET name = 'Touch Only Option' WHERE category_id = 77;
UPDATE steam_categories SET name = 'Adjustable Difficulty' WHERE category_id = 78;
UPDATE steam_categories SET name = 'Save Anytime' WHERE category_id = 79;
