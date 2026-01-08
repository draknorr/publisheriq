-- Add created_at timestamps to junction tables for tracking when relationships were created
-- This enables "what's new" queries to see recently added tags, genres, categories, franchises

-- Add created_at to app_steam_tags
ALTER TABLE app_steam_tags ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add created_at to app_genres
ALTER TABLE app_genres ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add created_at to app_categories
ALTER TABLE app_categories ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Add created_at to app_franchises
ALTER TABLE app_franchises ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Create indexes for efficient "what's new" queries
CREATE INDEX IF NOT EXISTS idx_app_steam_tags_created_at ON app_steam_tags(created_at);
CREATE INDEX IF NOT EXISTS idx_app_genres_created_at ON app_genres(created_at);
CREATE INDEX IF NOT EXISTS idx_app_categories_created_at ON app_categories(created_at);
CREATE INDEX IF NOT EXISTS idx_app_franchises_created_at ON app_franchises(created_at);
