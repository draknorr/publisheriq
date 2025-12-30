-- Add steamspy_available column to track apps that SteamSpy has data for
-- Apps not in SteamSpy's catalog (DLCs, tools, etc.) will be marked FALSE after a full sync

ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS steamspy_available BOOLEAN DEFAULT NULL;

-- Create index for filtering
CREATE INDEX IF NOT EXISTS idx_sync_status_steamspy_available ON sync_status(steamspy_available) WHERE steamspy_available = FALSE;
