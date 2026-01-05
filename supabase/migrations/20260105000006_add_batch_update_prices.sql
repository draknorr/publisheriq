-- Migration: Add batch_update_prices RPC for efficient bulk price updates
--
-- Used by the price-sync worker to update prices for many apps in a single call.
-- This is much more efficient than calling upsert_storefront_app for each app.

CREATE OR REPLACE FUNCTION batch_update_prices(
  p_appids INTEGER[],
  p_prices INTEGER[],
  p_discounts INTEGER[]
)
RETURNS INTEGER AS $$
DECLARE
  v_updated INTEGER;
BEGIN
  -- Validate arrays have same length
  IF array_length(p_appids, 1) IS DISTINCT FROM array_length(p_prices, 1) OR
     array_length(p_appids, 1) IS DISTINCT FROM array_length(p_discounts, 1) THEN
    RAISE EXCEPTION 'All input arrays must have the same length';
  END IF;

  -- Bulk update prices
  WITH price_data AS (
    SELECT
      unnest(p_appids) as appid,
      unnest(p_prices) as price,
      unnest(p_discounts) as discount
  )
  UPDATE apps a SET
    current_price_cents = pd.price,
    current_discount_percent = pd.discount,
    updated_at = NOW()
  FROM price_data pd
  WHERE a.appid = pd.appid;

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  -- Update last_price_sync timestamp for these apps
  UPDATE sync_status SET
    last_price_sync = NOW()
  WHERE appid = ANY(p_appids);

  RETURN v_updated;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION batch_update_prices IS
  'Bulk update prices for multiple apps in a single transaction. Returns number of updated rows.';

-- Add last_price_sync column to track price-specific sync
ALTER TABLE sync_status ADD COLUMN IF NOT EXISTS last_price_sync TIMESTAMPTZ;

-- Add index for price sync selection
CREATE INDEX IF NOT EXISTS idx_sync_status_price_sync
ON sync_status (last_price_sync, priority_score DESC)
WHERE is_syncable = TRUE;
