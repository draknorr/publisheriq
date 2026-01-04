-- Add missing Steam app types to the enum
-- These types are returned by Steam's Storefront API but were not in our original enum

ALTER TYPE app_type ADD VALUE IF NOT EXISTS 'episode';      -- Episodic video content (e.g., Oats Studios)
ALTER TYPE app_type ADD VALUE IF NOT EXISTS 'tool';         -- Steam tools
ALTER TYPE app_type ADD VALUE IF NOT EXISTS 'application';  -- Non-game applications
ALTER TYPE app_type ADD VALUE IF NOT EXISTS 'series';       -- Video series
ALTER TYPE app_type ADD VALUE IF NOT EXISTS 'advertising';  -- Advertising content
