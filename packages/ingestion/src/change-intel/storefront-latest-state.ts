import type { TypedSupabaseClient } from '@publisheriq/database';
import { APP_TYPES, type AppType } from '@publisheriq/shared';
import type { ParsedStorefrontApp } from '../apis/storefront.js';

const VALID_APP_TYPES = new Set<string>(APP_TYPES);

export function normalizeAppType(type: string | undefined): AppType {
  if (!type) {
    return 'game';
  }

  const lower = type.toLowerCase();
  return VALID_APP_TYPES.has(lower) ? (lower as AppType) : 'game';
}

export async function upsertLatestStorefrontState(
  supabase: TypedSupabaseClient,
  appid: number,
  details: ParsedStorefrontApp
): Promise<void> {
  const db = supabase as any;

  const { error } = await db.rpc('upsert_storefront_app', {
    p_appid: appid,
    p_name: details.name,
    p_type: normalizeAppType(details.type),
    p_is_free: details.isFree,
    p_is_delisted: details.isDelisted,
    p_release_date: details.releaseDate,
    p_release_date_raw: details.releaseDateRaw,
    p_has_workshop: details.hasWorkshop,
    p_current_price_cents: details.priceCents ?? 0,
    p_current_discount_percent: details.discountPercent,
    p_is_released: !details.comingSoon,
    p_developers: details.developers,
    p_publishers: details.publishers,
    ...(details.dlcAppids.length > 0 ? { p_dlc_appids: details.dlcAppids } : {}),
    ...(details.parentAppid !== null ? { p_parent_appid: details.parentAppid } : {}),
  });

  if (error) {
    throw new Error(error.message);
  }
}
