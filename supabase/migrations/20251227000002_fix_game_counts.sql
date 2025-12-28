-- Migration: Add triggers to maintain game_count on developers and publishers
-- Purpose: Keep game_count in sync when apps are linked/unlinked

-- =============================================
-- TRIGGER FUNCTIONS
-- =============================================

-- Function to update developer game_count
CREATE OR REPLACE FUNCTION update_developer_game_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE developers
        SET game_count = game_count + 1
        WHERE id = NEW.developer_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE developers
        SET game_count = game_count - 1
        WHERE id = OLD.developer_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to update publisher game_count
CREATE OR REPLACE FUNCTION update_publisher_game_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE publishers
        SET game_count = game_count + 1
        WHERE id = NEW.publisher_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE publishers
        SET game_count = game_count - 1
        WHERE id = OLD.publisher_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- CREATE TRIGGERS
-- =============================================

-- Trigger for app_developers
DROP TRIGGER IF EXISTS trigger_app_developers_count ON app_developers;
CREATE TRIGGER trigger_app_developers_count
    AFTER INSERT OR DELETE ON app_developers
    FOR EACH ROW EXECUTE FUNCTION update_developer_game_count();

-- Trigger for app_publishers
DROP TRIGGER IF EXISTS trigger_app_publishers_count ON app_publishers;
CREATE TRIGGER trigger_app_publishers_count
    AFTER INSERT OR DELETE ON app_publishers
    FOR EACH ROW EXECUTE FUNCTION update_publisher_game_count();

-- =============================================
-- BACKFILL: Recalculate existing counts
-- =============================================

-- Update developer game counts based on current data
UPDATE developers d
SET game_count = (
    SELECT COUNT(*) FROM app_developers ad WHERE ad.developer_id = d.id
);

-- Update publisher game counts based on current data
UPDATE publishers p
SET game_count = (
    SELECT COUNT(*) FROM app_publishers ap WHERE ap.publisher_id = p.id
);
