-- Function to get app IDs that haven't been PICS synced yet
-- Used for resume capability in bulk sync

CREATE OR REPLACE FUNCTION get_unsynced_app_ids()
RETURNS TABLE(appid INTEGER) AS $$
BEGIN
    RETURN QUERY
    SELECT a.appid
    FROM apps a
    LEFT JOIN sync_status s ON a.appid = s.appid
    WHERE s.last_pics_sync IS NULL
    ORDER BY a.appid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_unsynced_app_ids() TO service_role;
